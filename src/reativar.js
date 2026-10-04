// Devolve um lead parado para a automação.
//
// Quando a assistente passa uma conversa para o médico (HANDOFF), ou desqualifica
// um pedido fora de escopo (DESQUALIFICADO), ela se cala com aquele número — e
// continua calada para sempre. Faz sentido enquanto o atendimento está em curso.
// Seis meses depois, a mesma pessoa escreve de novo e não recebe nada: nem ela
// nem o médico ficam sabendo, porque o silêncio é indistinguível de "ninguém
// escreveu".
//
// A decisão do Dr. Jesrryel foi que o bot NÃO deve retomar sozinho por tempo:
// uma automação reaparecendo no meio de um acompanhamento é pior que o silêncio.
// Então a reativação é um ato explícito dele, pelo painel.
//
// O que NÃO se apaga: o histórico da conversa, o motivo, a classificação. A
// pessoa não vira estranha — a assistente reencontra alguém de quem já sabe
// alguma coisa. Só o estado volta, para o fluxo poder andar de novo.

// DESCADASTRADO entra aqui porque a pessoa pode voltar a escrever querendo
// retomar — e aí só um humano pode decidir que o consentimento voltou. O bot
// nunca se reativa sozinho depois de um "pare".
const REATIVAVEIS = new Set(['HANDOFF', 'DESQUALIFICADO', 'CLIENTE', 'DESCADASTRADO']);

/**
 * @param {object} lead o lead como está gravado
 * @returns {{ok: true, campos: object} | {ok: false, motivo: string}}
 */
function planejarReativacao(lead) {
  if (!lead || !lead.phone) {
    return { ok: false, motivo: 'lead não encontrado' };
  }
  if (!REATIVAVEIS.has(lead.state)) {
    return {
      ok: false,
      motivo: `o lead está em ${lead.state}, que não é um estado parado — a automação já responde a ele`,
    };
  }

  const anterior = lead.state;
  return {
    ok: true,
    campos: {
      state: 'NOVO',
      reativadoEm: new Date().toISOString(),
      estadoAntesDaReativacao: anterior,
      notas: `Reativado manualmente pelo painel (estava em ${anterior})`,
      // Um lead que volta não deve herdar a agenda de follow-up da rodada
      // anterior: os prazos D+2/3/5/7 contam a partir do catálogo, e o catálogo
      // dessa vez ainda nem foi enviado.
      followupsAgendados: false,
      followupsEnviados: [],
      catalogoEnviadoEm: null,
    },
  };
}

module.exports = { planejarReativacao, REATIVAVEIS };
