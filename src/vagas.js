const { CONSULTA_AVULSA } = require('./consultorio');

// Transforma "as faixas em que o consultório atende" em HORÁRIOS CONCRETOS que
// o paciente pode escolher — descontando o que já está ocupado na agenda.
//
// Tudo aqui é função pura: entra agenda, data e lista de ocupados, sai lista de
// vagas. O Google fica em google-agenda.js. A separação não é estética — é
// onde moram os dois bugs que custam caro (fuso e sobreposição), e eles
// precisam ser testáveis sem rede, sem credencial e sem calendário de verdade.

// Mossoró é UTC-3 o ano todo. O Brasil não tem mais horário de verão desde
// 2019, e o servidor roda em UTC. Fixar o deslocamento evita arrastar uma
// biblioteca de fuso inteira para somar três horas — mas é também a linha que
// precisa mudar se o horário de verão voltar.
const FUSO = '-03:00';

// Quanto tempo no mínimo entre agora e a vaga oferecida.
//
// Oferecer "daqui a 20 minutos" marca uma consulta que o médico ainda não viu,
// com alguém que precisa se deslocar. Três horas dão tempo de ele ler o aviso e
// cancelar se não puder — sem matar o agendamento no mesmo dia, que é
// justamente o que converte.
const ANTECEDENCIA_HORAS = Number(process.env.VAGAS_ANTECEDENCIA_HORAS || 3);
const HORIZONTE_DIAS = Number(process.env.VAGAS_HORIZONTE_DIAS || 14);
const DURACAO_MIN = CONSULTA_AVULSA.duracaoMinutos;

const CHAVE_DO_DIA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];
const NOME_DO_DIA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const MES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

// O dia/mês/dia-da-semana COMO SE LÊ EM MOSSORÓ, não como o servidor vê.
// Sem isto, uma consulta às 22h de terça vira quarta no log e no texto, porque
// em UTC já é quarta — e o paciente recebe a confirmação do dia errado.
function emMossoro(data) {
  const deslocado = new Date(data.getTime() - 3 * 60 * 60 * 1000);
  return {
    ano: deslocado.getUTCFullYear(),
    mes: deslocado.getUTCMonth(),
    dia: deslocado.getUTCDate(),
    diaDaSemana: deslocado.getUTCDay(),
    hora: deslocado.getUTCHours(),
    minuto: deslocado.getUTCMinutes(),
  };
}

function montarInstante({ ano, mes, dia }, horaMinuto) {
  const mm = String(mes + 1).padStart(2, '0');
  const dd = String(dia).padStart(2, '0');
  return new Date(`${ano}-${mm}-${dd}T${horaMinuto}:00${FUSO}`);
}

/** Os horários de início possíveis dentro de uma faixa, de hora em hora. */
function fatiarFaixa(dataBase, faixa) {
  if (!Array.isArray(faixa) || faixa.length !== 2 || !faixa[0] || !faixa[1]) return [];
  const inicio = montarInstante(dataBase, faixa[0]);
  const fim = montarInstante(dataBase, faixa[1]);
  const vagas = [];
  for (let t = inicio.getTime(); t + DURACAO_MIN * 60000 <= fim.getTime(); t += DURACAO_MIN * 60000) {
    vagas.push(new Date(t));
  }
  return vagas;
}

/** Todos os horários que a agenda PERMITE, sem olhar o que já está ocupado. */
function candidatos(agenda, agora, dias = HORIZONTE_DIAS) {
  const minimo = new Date(agora.getTime() + ANTECEDENCIA_HORAS * 60 * 60 * 1000);
  const lista = [];
  for (let d = 0; d <= dias; d += 1) {
    const base = emMossoro(new Date(agora.getTime() + d * 24 * 60 * 60 * 1000));
    const doDia = agenda[CHAVE_DO_DIA[base.diaDaSemana]];
    if (!doDia) continue;
    for (const turno of ['manha', 'tarde']) {
      for (const vaga of fatiarFaixa(base, doDia[turno])) {
        if (vaga >= minimo) lista.push(vaga);
      }
    }
  }
  return lista.sort((a, b) => a - b);
}

// Dois intervalos se sobrepõem quando um começa antes do outro acabar, dos dois
// lados. Encostar não é sobrepor: um evento que termina 14h não bloqueia a vaga
// que começa 14h — senão todo almoço comeria a primeira consulta da tarde.
function conflita(inicio, fim, ocupado) {
  return inicio < new Date(ocupado.fim) && new Date(ocupado.inicio) < fim;
}

function livres(agenda, agora, ocupados = [], dias = HORIZONTE_DIAS) {
  return candidatos(agenda, agora, dias).filter((inicio) => {
    const fim = new Date(inicio.getTime() + DURACAO_MIN * 60000);
    return !ocupados.some((o) => conflita(inicio, fim, o));
  });
}

// Três opções, de dias diferentes quando der.
//
// Oferecer 08h, 09h e 10h da mesma terça parece escolha e não é: quem não pode
// terça de manhã não pode nenhuma das três, e precisa escrever de novo. Espalhar
// por dias diferentes faz as três perguntas que importam de uma vez só.
function sugerir(vagas, quantas = 3) {
  const escolhidas = [];
  const diasUsados = new Set();
  for (const vaga of vagas) {
    const { ano, mes, dia } = emMossoro(vaga);
    const chave = `${ano}-${mes}-${dia}`;
    if (diasUsados.has(chave)) continue;
    diasUsados.add(chave);
    escolhidas.push(vaga);
    if (escolhidas.length === quantas) return escolhidas;
  }
  // Menos dias disponíveis que vagas pedidas: completa com o que sobrou, em
  // ordem. Melhor três horários do mesmo dia do que só um.
  for (const vaga of vagas) {
    if (escolhidas.length === quantas) break;
    if (!escolhidas.includes(vaga)) escolhidas.push(vaga);
  }
  return escolhidas.sort((a, b) => a - b);
}

/** "terça, 21 de outubro, às 14h" — como alguém fala, não como máquina. */
function descrever(data) {
  const { dia, mes, diaDaSemana, hora, minuto } = emMossoro(data);
  const relogio = minuto ? `${hora}h${String(minuto).padStart(2, '0')}` : `${hora}h`;
  return `${NOME_DO_DIA[diaDaSemana]}, ${dia} de ${MES[mes]}, às ${relogio}`;
}

module.exports = {
  candidatos, livres, sugerir, descrever, emMossoro, conflita, fatiarFaixa,
  FUSO, ANTECEDENCIA_HORAS, HORIZONTE_DIAS, DURACAO_MIN,
};
