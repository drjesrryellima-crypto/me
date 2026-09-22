// Lê o aviso de ENTREGA que a Meta manda depois do envio.
//
// Aceitar o envio e entregar a mensagem são coisas diferentes. A chamada de
// envio pode voltar 200 — "recebi, vou cuidar disso" — e a mensagem nunca
// chegar no celular. Quando isso acontece a Meta avisa, mas num segundo evento
// de webhook, com `statuses` em vez de `messages`.
//
// O código descartava esse evento inteiro (`if (!message) return`). O resultado
// prático: envio bem-sucedido no log, nada no celular do destinatário, e
// nenhuma pista de por quê — que foi exatamente onde a investigação do webhook
// empacou depois que todo o resto já estava funcionando.

const { explicarErroMeta } = require('./erros-meta');

// A Meta manda um status por etapa: sent (saiu), delivered (chegou no
// aparelho), read (a pessoa abriu), failed (não vai chegar).
const RELEVANTES = new Set(['sent', 'delivered', 'read', 'failed']);

/**
 * @param {object} value o `value` do evento de webhook
 * @returns {string[]} linhas prontas pro log, vazio quando não há nada a dizer
 */
function descreverStatus(value) {
  const statuses = (value && value.statuses) || [];

  return statuses
    .filter((s) => s && RELEVANTES.has(s.status))
    .map((s) => {
      const para = s.recipient_id || '(destinatário desconhecido)';

      if (s.status !== 'failed') {
        return `[entrega] ${s.status} — para ${para}`;
      }

      const erros = s.errors || [];
      if (!erros.length) {
        return `[entrega] FALHOU — para ${para}, sem detalhe da Meta`;
      }

      // explicarErroMeta espera o formato do axios; o erro de status vem solto.
      const motivos = erros
        .map((erro) => explicarErroMeta({ response: { data: { error: erro } } }))
        .join(' | ');

      return `[entrega] FALHOU — para ${para}: ${motivos}`;
    });
}

module.exports = { descreverStatus };
