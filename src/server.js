require('dotenv').config();
const fs = require('fs');
const express = require('express');
const { handleIncomingMessage } = require('./flow');
const { iniciarAgendador } = require('./followup');
const { criarRouter, avisarSeDesprotegido } = require('./dashboard');

const app = express();
app.use(express.json());

// Painel de leads (/dashboard + /api/leads) — protegido por DASHBOARD_TOKEN
app.use(criarRouter());

const PORT = process.env.PORT || 3000;
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;

function checkGoogleSheetsSetup() {
  const credsPath = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!credsPath || !fs.existsSync(credsPath)) {
    console.warn(
      '[sheets] ⚠️  credentials/service-account.json não encontrado — gravação no Google Sheets desativada ' +
        '(leads continuam sendo salvos em data/leads.json). Siga a seção 3 do README para configurar.'
    );
    return;
  }
  if (!process.env.GOOGLE_SHEET_ID) {
    console.warn(
      '[sheets] ⚠️  GOOGLE_SHEET_ID não definido no .env — gravação no Google Sheets desativada. ' +
        'Siga a seção 3 do README para configurar.'
    );
  }
}

// 1) Verificação do webhook (a Meta chama isso uma vez, ao configurar)
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('[webhook] verificação OK');
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

// 2) Recebimento de mensagens
app.post('/webhook', async (req, res) => {
  // Responder rápido pra Meta não reenviar o mesmo evento
  res.sendStatus(200);

  try {
    const entry = req.body.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;
    const message = value?.messages?.[0];

    if (!message) return; // pode ser um evento de status (entregue/lido), não uma mensagem nova

    const from = message.from; // número do lead
    const text = message.text?.body || '';
    const nomePerfil = value.contacts?.[0]?.profile?.name;

    console.log(`[webhook] mensagem de ${from}: "${text}"`);
    await handleIncomingMessage({ from, text, nome: nomePerfil });
  } catch (err) {
    console.error('[webhook] erro ao processar mensagem:', err.message);
  }
});

app.get('/health', (req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
  console.log(`Webhook: http://localhost:${PORT}/webhook`);
  console.log(`Dashboard: http://localhost:${PORT}/dashboard?token=...`);
  checkGoogleSheetsSetup();
  avisarSeDesprotegido();
  iniciarAgendador();
});
