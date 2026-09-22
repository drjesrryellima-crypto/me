require('dotenv').config();
const express = require('express');
const { handleIncomingMessage } = require('./flow');
const { iniciarAgendador } = require('./followup');
const { criarRouter, avisarSeDesprotegido } = require('./dashboard');
const { exigirAssinatura, avisarSeSemAppSecret } = require('./assinatura');
const { jaProcessado } = require('./dedupe');
const { carregarCredenciais } = require('./google-credenciais');
const assistente = require('./assistente');

const app = express();
// verify guarda o corpo CRU antes do parse. A assinatura da Meta é calculada
// sobre os bytes exatos que ela enviou — reserializar o JSON com
// JSON.stringify daria outro resultado e a conferência nunca bateria.
app.use(express.json({ verify: (req, res, buf) => { req.rawBody = buf; } }));

// Painel de leads (/dashboard + /api/leads) — protegido por DASHBOARD_TOKEN
app.use(criarRouter());

const PORT = process.env.PORT || 3000;
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;

function checkGoogleSheetsSetup() {
  if (!carregarCredenciais()) {
    console.warn(
      '[sheets] ⚠️  credencial do Google não encontrada — gravação no Google Sheets desativada ' +
        '(leads continuam sendo salvos em data/leads.json). Defina GOOGLE_SERVICE_ACCOUNT_JSON ' +
        '(caminho do arquivo, no Mac) ou GOOGLE_SERVICE_ACCOUNT_CREDENTIALS (conteúdo do JSON, em servidor). ' +
        'Seção 3 do README.'
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
app.post('/webhook', exigirAssinatura, async (req, res) => {
  // Responder rápido pra Meta não reenviar o mesmo evento
  res.sendStatus(200);

  try {
    const entry = req.body.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;
    const message = value?.messages?.[0];

    if (!message) return; // pode ser um evento de status (entregue/lido), não uma mensagem nova

    // A Meta reenvia o mesmo evento quando o webhook demora ou falha. Sem isso,
    // o reenvio avançaria a máquina de estados uma casa a mais e a resposta do
    // lead cairia no campo errado.
    if (jaProcessado(message.id)) {
      console.log(`[webhook] evento ${message.id} já processado — reenvio da Meta, ignorado.`);
      return;
    }

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
  avisarSeSemAppSecret();
  assistente.avisarSeDesligada();
  iniciarAgendador();
});
