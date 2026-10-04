// Avisa quando alguém que já está com um humano escreve de novo.
//
// O vigia de handoff parado cobre "ninguém atendeu ainda". Faltava o outro
// caso, que é o mais vivo dos dois: a pessoa ESTÁ escrevendo agora. A
// automação fica calada de propósito — a conversa é do médico — mas até aqui
// ela ficava calada para os DOIS lados: o paciente não recebia resposta do bot
// e o médico não era avisado de nada. A mensagem só virava uma linha de log.
//
// Para quem está do outro lado, é indistinguível de ter sido esquecido.

const { ehRisco } = require('./estados');
const { linkDaConversa } = require('./link-whatsapp');

// Quem está em sofrimento escreve em rajada: "oi", "você está aí?", "preciso
// falar". Um aviso por mensagem viraria cinco notificações em dois minutos, e
// alerta que vira enxurrada é alerta que se aprende a silenciar — o que
// estragaria justamente o de crise.
const JANELA_AGRUPAMENTO_MIN = 10;

function minutosDesde(iso, agora) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return (agora.getTime() - d.getTime()) / 60000;
}

/**
 * @returns {{avisar: boolean, motivo: string, risco?: boolean}}
 */
function planejarAvisoDeRetorno(lead, agora = new Date()) {
  if (!lead || lead.state !== 'HANDOFF') {
    return { avisar: false, motivo: 'não está em handoff' };
  }

  const desde = minutosDesde(lead.ultimoAvisoDeRetornoEm, agora);
  if (desde !== null && desde < JANELA_AGRUPAMENTO_MIN) {
    return { avisar: false, motivo: 'rajada — já avisado há pouco' };
  }

  return { avisar: true, motivo: 'paciente voltou a escrever', risco: ehRisco(lead) };
}

function montarTexto(lead, mensagem, plano) {
  const link = linkDaConversa(lead.phone);
  const cabecalho = plano.risco
    ? '🚨 EM CRISE E ESCREVEU DE NOVO'
    : '💬 ESCREVEU DE NOVO';

  return (
    `${cabecalho}\n` +
    `Telefone: ${lead.phone}\n` +
    (link ? `Abrir conversa: ${link}\n` : '') +
    `\nA automação está calada com esta pessoa porque a conversa é sua.\n` +
    `Mensagem: "${mensagem || ''}"`
  );
}

/**
 * Campos a gravar junto com o aviso.
 *
 * Mensagem nova reinicia o relógio do vigia (src/handoff-parado.js): a pessoa
 * passou a esperar a partir de AGORA, não desde o handoff original. Sem isso o
 * vigia ou acharia que ela espera há dias e dispararia na hora, ou a daria por
 * atendida e nunca mais olharia para ela.
 */
function camposDeRetorno(agora = new Date()) {
  const iso = agora.toISOString();
  return {
    handoffEm: iso,
    atendidoEm: null,
    realertasEnviados: 0,
    ultimoRealertaEm: null,
    ultimoAvisoDeRetornoEm: iso,
  };
}

module.exports = {
  planejarAvisoDeRetorno,
  montarTexto,
  camposDeRetorno,
  JANELA_AGRUPAMENTO_MIN,
};
