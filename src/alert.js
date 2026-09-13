const axios = require('axios');

const WEBHOOK_URL = process.env.HANDOFF_ALERT_WEBHOOK_URL;

// Envia um alerta para o humano assumir a conversa. Por padrão, apenas
// loga no console — configure HANDOFF_ALERT_WEBHOOK_URL (ex: um webhook do
// Zapier/Slack) para receber isso de verdade no seu celular.
async function sendHandoffAlert({ priority, phone, motivo, classificacao, ultimaMensagem }) {
  const texto =
    `🔔 HANDOFF [${priority}]\n` +
    `Telefone: ${phone}\n` +
    `Motivo: ${motivo || '-'}\n` +
    `Classificação: ${classificacao || '-'}\n` +
    `Última mensagem do lead: "${ultimaMensagem}"`;

  console.log(texto);

  if (WEBHOOK_URL) {
    try {
      await axios.post(WEBHOOK_URL, { text: texto, priority, phone, motivo, classificacao, ultimaMensagem });
    } catch (err) {
      console.error('[alert] falha ao enviar webhook de alerta:', err.message);
    }
  }
}

module.exports = { sendHandoffAlert };
