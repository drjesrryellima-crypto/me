const { lerAgenda } = require('./agenda');
const vagas = require('./vagas');
const googleAgenda = require('./google-agenda');
const { escolhida } = require('./escolha-vaga');
const messages = require('./messages');
const { ONLINE, PRESENCIAL } = require('./consultorio');

// Junta as peças: lê a agenda do consultório, desconta o que já está ocupado no
// Google, oferece três horários e marca o que o paciente escolher.
//
// Devolve SEMPRE { texto, ... } em vez de enviar: quem envia é o flow.js, que
// já sabe registrar turno, respeitar o freio e lidar com erro da Meta. Misturar
// as duas coisas aqui duplicaria tudo isso.

// Quanto tempo uma oferta vale.
//
// Horário oferecido ontem pode ter sido preenchido hoje. Depois da validade a
// assistente oferece de novo em vez de marcar um horário que ela viu livre num
// momento que já passou — e, de todo jeito, a vaga é reconferida na hora de
// marcar.
const VALIDADE_MIN = Number(process.env.VAGAS_VALIDADE_MIN || 180);

function disponivel() {
  return googleAgenda.configurado();
}

function ofertaValida(lead, agora = new Date()) {
  const oferta = lead && lead.vagasOferecidas;
  if (!oferta || !Array.isArray(oferta.horarios) || !oferta.horarios.length) return null;
  const idade = agora - new Date(oferta.em);
  if (!(idade >= 0) || idade > VALIDADE_MIN * 60000) return null;
  return oferta;
}

function descricoes(oferta) {
  return oferta.horarios.map((iso) => vagas.descrever(new Date(iso)));
}

/** Monta as três opções. Devolve { texto, campos } ou { texto, semVagas: true }. */
async function oferecer(lead, agora = new Date()) {
  const horizonte = new Date(agora.getTime() + vagas.HORIZONTE_DIAS * 24 * 60 * 60 * 1000);
  const ocupados = await googleAgenda.ocupados(agora, horizonte);

  // null é "não consegui saber", e é diferente de "está tudo livre". Oferecer a
  // agenda inteira porque o Google caiu marcaria em cima de todo mundo — então
  // aqui o agendamento desiste e o humano assume.
  if (ocupados === null) {
    return { texto: messages.semVagas(), semVagas: true, motivo: 'não deu para ler a agenda' };
  }

  // O formato do lead filtra os turnos: presencial só onde o médico está no
  // consultório (ver PRESENCIAL_EM em vagas.js). Sem isso, um paciente que
  // pediu presencial receberia horário de telemedicina e apareceria na porta.
  const livres = vagas.livres(lerAgenda(), agora, ocupados, vagas.HORIZONTE_DIAS, lead.formato);
  const escolhidas = vagas.sugerir(livres, 3);
  if (!escolhidas.length) {
    return { texto: messages.semVagas(), semVagas: true, motivo: 'nenhuma vaga no horizonte' };
  }

  const horarios = escolhidas.map((d) => d.toISOString());
  return {
    texto: messages.oferecerVagas(horarios.map((iso) => vagas.descrever(new Date(iso)))),
    campos: { vagasOferecidas: { horarios, em: agora.toISOString() } },
  };
}

/**
 * O paciente respondeu a uma oferta. Devolve:
 *   { naoEntendi: true, texto }                  — pede o número de novo
 *   { marcada: true, texto, campos, quando }     — deu certo
 *   { falhou: true, texto, motivo }              — vaga perdida ou erro
 * Ou null quando não há oferta válida (aí o fluxo normal segue).
 */
async function confirmar(lead, textoDoLead, agora = new Date()) {
  const oferta = ofertaValida(lead, agora);
  if (!oferta) return null;

  const indice = escolhida(textoDoLead, oferta.horarios.length);
  if (indice === null) return { naoEntendi: true, texto: messages.escolhaNaoEntendida(descricoes(oferta)) };

  const inicio = new Date(oferta.horarios[indice]);

  // Reconfere ANTES de marcar. Entre a oferta e a resposta cabe um paciente
  // inteiro — e marcar dois na mesma hora é o erro que não dá para desfazer
  // sem alguém ficar sem vaga.
  const fim = new Date(inicio.getTime() + vagas.DURACAO_MIN * 60000);
  const ocupados = await googleAgenda.ocupados(inicio, fim);
  if (ocupados === null || ocupados.some((o) => vagas.conflita(inicio, fim, o))) {
    return {
      falhou: true,
      texto: messages.vagaPerdida(),
      motivo: ocupados === null ? 'não deu para reconferir a agenda' : 'o horário foi ocupado',
      campos: { vagasOferecidas: null },
    };
  }

  const formato = lead.formato === 'Online' ? ONLINE.escrito
    : lead.formato === 'Presencial' ? PRESENCIAL.escrito
      : '';

  const r = await googleAgenda.marcar({
    inicio, nome: lead.nome, phone: lead.phone, formato: lead.formato,
  });
  if (!r.ok) {
    return { falhou: true, texto: messages.vagaPerdida(), motivo: r.erro, campos: { vagasOferecidas: null } };
  }

  const quando = vagas.descrever(inicio);
  return {
    marcada: true,
    quando,
    texto: messages.consultaMarcada(quando, formato),
    campos: {
      vagasOferecidas: null,
      consultaEm: inicio.toISOString(),
      consultaLink: r.link || '',
    },
  };
}

module.exports = { oferecer, confirmar, disponivel, ofertaValida, VALIDADE_MIN };
