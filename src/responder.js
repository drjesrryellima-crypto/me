// Deixa o médico responder ao paciente PELO MESMO NÚMERO que o paciente
// procurou.
//
// Sem isto, o caminho era: o alerta chega, ele abre o WhatsApp do celular e
// escreve — mas o celular dele é outro número. A pessoa escreveu para o
// consultório e recebe resposta de um desconhecido, às vezes num momento de
// crise, que é exatamente quando confiar em quem está do outro lado mais
// importa. Muita gente não responde a número que não reconhece.
//
// A resposta sai daqui pelo mesmo WHATSAPP_PHONE_NUMBER_ID que a assistente
// usa. Para o paciente é a mesma conversa, a mesma pessoa.

// Limite de texto de uma mensagem do WhatsApp. Cortar aqui é melhor que a Meta
// recusar depois, quando o médico já acha que mandou.
const LIMITE_CARACTERES = 4096;

// A Meta só aceita texto livre até 24h depois da última mensagem RECEBIDA do
// usuário. Depois disso, só template aprovado. O erro dela (131047) fala de
// "re-engagement message" e não ajuda ninguém a entender o que fazer.
const JANELA_HORAS = 24;

function ultimaEntrada(lead) {
  // ultimaEntradaEm é gravado a cada mensagem do paciente. Leads que já
  // existiam antes desse campo caem no updatedAt, que é o melhor palpite
  // disponível — e, no pior caso, deixa o envio ser tentado e falhar com a
  // mensagem da Meta traduzida, em vez de bloquear uma resposta válida.
  const bruto = lead.ultimaEntradaEm || lead.updatedAt;
  if (!bruto) return null;
  const d = new Date(bruto);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Quanto tempo ainda dá para responder em texto livre.
 * @returns {{aberta: boolean, horasRestantes: number|null}}
 */
function janela(lead, agora = new Date()) {
  const desde = lead && ultimaEntrada(lead);
  if (!desde) return { aberta: true, horasRestantes: null };
  const horas = (agora.getTime() - desde.getTime()) / 3600000;
  const restantes = JANELA_HORAS - horas;
  return { aberta: restantes > 0, horasRestantes: Math.max(0, restantes) };
}

/**
 * Decide se a resposta pode sair, antes de gastar uma chamada na Meta.
 * @returns {{ok: true, texto: string} | {ok: false, motivo: string}}
 */
function planejarResposta(lead, textoBruto, agora = new Date()) {
  if (!lead || !lead.phone) {
    return { ok: false, motivo: 'lead não encontrado' };
  }

  const texto = String(textoBruto == null ? '' : textoBruto).trim();
  if (!texto) {
    return { ok: false, motivo: 'a mensagem está vazia' };
  }
  if (texto.length > LIMITE_CARACTERES) {
    return {
      ok: false,
      motivo:
        `a mensagem tem ${texto.length} caracteres e o WhatsApp aceita ${LIMITE_CARACTERES}. ` +
        'Divida em duas.',
    };
  }

  const { aberta } = janela(lead, agora);
  if (!aberta) {
    return {
      ok: false,
      motivo:
        `passaram mais de ${JANELA_HORAS}h desde a última mensagem desta pessoa, e a Meta ` +
        'não deixa mais mandar texto livre para ela. Só um template aprovado — ou esperar ' +
        'que ela escreva de novo.',
    };
  }

  return { ok: true, texto };
}

module.exports = { planejarResposta, janela, LIMITE_CARACTERES, JANELA_HORAS };
