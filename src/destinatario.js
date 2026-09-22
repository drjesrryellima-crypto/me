// Confere se a mensagem chegou no MESMO número de onde o bot responde.
//
// Toda mensagem que a Meta entrega traz, em value.metadata.phone_number_id, o
// número que a RECEBEU. O bot responde sempre pelo WHATSAPP_PHONE_NUMBER_ID do
// ambiente. Quando os dois são diferentes — porque a conta tem mais de um
// número, e é fácil escrever para um e configurar o outro — o efeito é
// silencioso e enganoso:
//
//   1. o webhook recebe a mensagem normalmente, e o log mostra isso
//   2. o envio da resposta é ACEITO pela Meta, e o log mostra isso também
//   3. a entrega falha com o código 131047, "passaram mais de 24h desde a
//      última mensagem dessa pessoa para ESTE número"
//
// E 131047 leva a investigação pro lado errado: parece janela de 24h vencida,
// quando na verdade a pessoa nunca escreveu pro número que está respondendo.
// Nenhuma das três linhas aponta para a causa. Esta checagem aponta.

const CONFIGURADO = () => process.env.WHATSAPP_PHONE_NUMBER_ID;

/**
 * @param {object} value o `value` do evento de webhook
 * @returns {string|null} o aviso pro log, ou null quando está tudo certo
 */
function conferirNumeroQueRecebeu(value) {
  const meta = (value && value.metadata) || {};
  const recebeu = meta.phone_number_id;
  const configurado = CONFIGURADO();

  if (!recebeu || !configurado) return null;
  if (String(recebeu) === String(configurado)) return null;

  const visivel = meta.display_phone_number ? ` (${meta.display_phone_number})` : '';
  return (
    `⚠️  a mensagem chegou no número ${recebeu}${visivel}, mas o bot responde pelo ` +
    `${configurado}. São números diferentes: a resposta vai sair por um número que essa ` +
    'pessoa nunca escreveu, e a Meta vai recusar a entrega com o código 131047 (que diz ' +
    '"passaram 24h", mas a causa é esta). Aponte WHATSAPP_PHONE_NUMBER_ID para ' +
    `${recebeu}, ou escreva para o número ${configurado}.`
  );
}

module.exports = { conferirNumeroQueRecebeu };
