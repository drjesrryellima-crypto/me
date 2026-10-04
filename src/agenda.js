const fs = require('fs');
const path = require('path');

// As faixas em que o consultório atende, editáveis no painel.
//
// O bot fala em FAIXAS, nunca em vagas: "atendo terça de manhã", nunca "terça
// às 15h está livre". Ele não enxerga a agenda real — prometer vaga exata
// seria marcar em cima de paciente que já está lá.
//
// Essa limitação é a razão de o arquivo existir em vez de o horário ficar solto
// no prompt: o médico muda a faixa sozinho, sem deploy, e sem poder prometer
// mais do que o sistema sabe.

const DIAS = [
  { chave: 'seg', nome: 'segunda-feira', curto: 'segunda' },
  { chave: 'ter', nome: 'terça-feira', curto: 'terça' },
  { chave: 'qua', nome: 'quarta-feira', curto: 'quarta' },
  { chave: 'qui', nome: 'quinta-feira', curto: 'quinta' },
  { chave: 'sex', nome: 'sexta-feira', curto: 'sexta' },
  { chave: 'sab', nome: 'sábado', curto: 'sábado' },
  { chave: 'dom', nome: 'domingo', curto: 'domingo' },
];

const PADRAO = {
  seg: { manha: ['08:00', '12:00'], tarde: ['14:00', '18:00'] },
  ter: { manha: ['08:00', '12:00'], tarde: ['14:00', '18:00'] },
  qua: { manha: ['08:00', '12:00'], tarde: ['14:00', '18:00'] },
  qui: { manha: ['08:00', '12:00'], tarde: ['14:00', '18:00'] },
  sex: { manha: ['08:00', '12:00'], tarde: ['14:00', '18:00'] },
  sab: { manha: ['08:00', '12:00'], tarde: ['14:00', '18:00'] },
  dom: { manha: null, tarde: null },
};

const DATA_DIR = () => process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const ARQUIVO = () => path.join(DATA_DIR(), 'agenda.json');

const HORA = /^([01]\d|2[0-3]):([0-5]\d)$/;

function faixaValida(faixa) {
  if (faixa === null || faixa === undefined) return true;
  if (!Array.isArray(faixa) || faixa.length !== 2) return false;
  const [inicio, fim] = faixa;
  if (!HORA.test(String(inicio)) || !HORA.test(String(fim))) return false;
  // Fim antes do início não é "agenda vazia", é erro de digitação — e viraria
  // o bot anunciando "atendo das 18h às 8h".
  return String(inicio) < String(fim);
}

/**
 * @returns {{ok: true, agenda: object} | {ok: false, erro: string}}
 */
function validarAgenda(bruta) {
  if (!bruta || typeof bruta !== 'object') return { ok: false, erro: 'agenda ausente' };
  const agenda = {};
  for (const dia of DIAS) {
    const entrada = bruta[dia.chave] || {};
    for (const turno of ['manha', 'tarde']) {
      if (!faixaValida(entrada[turno])) {
        return {
          ok: false,
          erro: `horário inválido em ${dia.nome} (${turno === 'manha' ? 'manhã' : 'tarde'}) — ` +
            'use HH:MM, e o fim depois do início',
        };
      }
    }
    agenda[dia.chave] = {
      manha: entrada.manha || null,
      tarde: entrada.tarde || null,
    };
  }
  if (!DIAS.some((d) => agenda[d.chave].manha || agenda[d.chave].tarde)) {
    // Agenda toda vazia faria o bot dizer que o consultório não atende nunca.
    // Quase sempre é alguém que limpou o formulário sem querer.
    return { ok: false, erro: 'a agenda ficaria sem nenhum dia de atendimento' };
  }
  return { ok: true, agenda };
}

function lerAgenda() {
  try {
    const bruta = JSON.parse(fs.readFileSync(ARQUIVO(), 'utf8'));
    const validada = validarAgenda(bruta);
    // Arquivo corrompido não pode calar o bot sobre horário: cai no padrão e
    // grita no log, em vez de responder "não sei quando atendemos".
    if (!validada.ok) {
      console.warn(`[agenda] arquivo inválido (${validada.erro}) — usando o padrão`);
      return PADRAO;
    }
    return validada.agenda;
  } catch (err) {
    return PADRAO;
  }
}

function salvarAgenda(agenda) {
  fs.mkdirSync(DATA_DIR(), { recursive: true });
  fs.writeFileSync(ARQUIVO(), JSON.stringify(agenda, null, 2));
  return agenda;
}

const semMinutos = (hora) => (hora.endsWith(':00') ? `${Number(hora.slice(0, 2))}h` : hora.replace(':', 'h'));

function descreverTurno(faixa) {
  if (!faixa) return null;
  return `${semMinutos(faixa[0])} às ${semMinutos(faixa[1])}`;
}

/**
 * Uma frase em português com as faixas, para o prompt da assistente.
 *
 * Agrupa dias com o mesmo horário ("de segunda a sábado") em vez de listar
 * sete linhas: o bot responde no WhatsApp, e sete linhas de horário é a
 * resposta que ninguém lê.
 */
function descreverAgenda(agenda = lerAgenda()) {
  const grupos = [];
  for (const dia of DIAS) {
    const { manha, tarde } = agenda[dia.chave] || {};
    if (!manha && !tarde) continue;
    const assinatura = JSON.stringify([manha, tarde]);
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.assinatura === assinatura && ultimo.fim === DIAS.indexOf(dia) - 1) {
      ultimo.fim = DIAS.indexOf(dia);
    } else {
      grupos.push({ assinatura, inicio: DIAS.indexOf(dia), fim: DIAS.indexOf(dia), manha, tarde });
    }
  }
  if (!grupos.length) return 'Sem horários de atendimento configurados.';

  return grupos
    .map((g) => {
      const dias =
        g.inicio === g.fim
          ? DIAS[g.inicio].curto
          : g.fim === g.inicio + 1
            ? `${DIAS[g.inicio].curto} e ${DIAS[g.fim].curto}`
            : `de ${DIAS[g.inicio].curto} a ${DIAS[g.fim].curto}`;
      const turnos = [descreverTurno(g.manha), descreverTurno(g.tarde)].filter(Boolean);
      return `${dias}, ${turnos.join(' e ')}`;
    })
    .join('; ');
}

module.exports = { lerAgenda, salvarAgenda, validarAgenda, descreverAgenda, DIAS, PADRAO };
