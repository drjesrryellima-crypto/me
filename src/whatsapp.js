const axios = require('axios');

const GRAPH_VERSION = process.env.GRAPH_API_VERSION || 'v20.0';
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const TOKEN = process.env.WHATSAPP_TOKEN;

const client = axios.create({
  baseURL: `https://graph.facebook.com/${GRAPH_VERSION}/${PHONE_NUMBER_ID}`,
  headers: {
    Authorization: `Bearer ${TOKEN}`,
    'Content-Type': 'application/json',
  },
});

// Mensagem de texto livre. SÓ funciona dentro da janela de 24h desde a última
// mensagem recebida do lead (regra da própria Meta). Fora dessa janela,
// é obrigatório usar um "message template" pré-aprovado (ver sendTemplate).
async function sendText(to, body) {
  return client.post('/messages', {
    messaging_product: 'whatsapp',
    to,
    type: 'text',
    text: { body },
  });
}

// Envio de template pré-aprovado — necessário para mensagens fora da janela
// de 24h (ex: os follow-ups de D+2, D+3, D+5, D+7 provavelmente vão precisar disso).
// O nome do template e os parâmetros dependem do que for cadastrado e aprovado no Meta Business Manager.
async function sendTemplate(to, templateName, languageCode = 'pt_BR', components = []) {
  return client.post('/messages', {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: templateName,
      language: { code: languageCode },
      components,
    },
  });
}

module.exports = { sendText, sendTemplate };
