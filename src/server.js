require('dotenv').config();
const path = require('path');
const express = require('express');
const { handleIncomingMessage } = require('./flow');
const { iniciarAgendador } = require('./followup');
const { iniciarVigiaDeHandoff } = require('./vigia-handoff');
const { criarRouter, avisarSeDesprotegido } = require('./dashboard');
const { exigirAssinatura, avisarSeSemAppSecret } = require('./assinatura');
const { jaProcessado } = require('./dedupe');
const { carregarCredenciais } = require('./google-credenciais');
const { diagnosticarVerificacao } = require('./verificacao');
const { explicarErroMeta } = require('./erros-meta');
const { descreverStatus } = require('./status-entrega');
const { conferirNumeroQueRecebeu } = require('./destinatario');
const telegram = require('./telegram');
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

  // O motivo vai no CORPO da resposta, não só no log. Quem configura o webhook
  // está olhando o navegador, não o painel de logs do servidor — e mandar a
  // pessoa caçar uma linha de log pra descobrir que sobrou um espaço custa um
  // ciclo inteiro de ida e volta. O texto nunca contém o token (garantido por
  // teste); no máximo diz o tamanho dele, o que não abre nada: forjar um POST
  // ainda exige o WHATSAPP_APP_SECRET, que este caminho não toca.
  const motivo = diagnosticarVerificacao(mode, token, VERIFY_TOKEN);
  console.warn(`[webhook] verificação recusada: ${motivo}`);
  return res.status(403).type('text/plain; charset=utf-8').send(`Verificação recusada: ${motivo}\n`);
});

// 2) Recebimento de mensagens
app.post('/webhook', exigirAssinatura, async (req, res) => {
  // Responder rápido pra Meta não reenviar o mesmo evento
  res.sendStatus(200);

  try {
    const entry = req.body.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;
    // TODAS as mensagens do lote, não só a primeira.
    //
    // A Meta agrupa mensagens que chegam juntas num único POST. Lendo só
    // messages[0], quem escrevia três linhas seguidas — "oi", "você está aí?",
    // "preciso falar" — tinha duas delas descartadas em silêncio: não iam para
    // o histórico, não contavam para o alerta, não existiam para o sistema.
    const lote = value?.messages || [];
    const message = lote[0];

    if (!message) {
      // Não é mensagem nova — é o aviso de entrega. Ele diz se a mensagem que
      // NÓS mandamos chegou de fato, e quando falha traz o motivo. Descartar
      // isso calado deixava "a Meta aceitou o envio" e "a pessoa recebeu"
      // indistinguíveis.
      for (const linha of descreverStatus(value)) {
        if (linha.includes('FALHOU')) console.error(`[webhook] ${linha}`);
        else console.log(`[webhook] ${linha}`);
      }
      return;
    }

    // A Meta reenvia o mesmo evento quando o webhook demora ou falha. Sem isso,
    // o reenvio avançaria a máquina de estados uma casa a mais e a resposta do
    // lead cairia no campo errado.
    if (jaProcessado(message.id)) {
      console.log(`[webhook] evento ${message.id} já processado — reenvio da Meta, ignorado.`);
      return;
    }

    // Antes de processar: a mensagem chegou no número de onde o bot responde?
    // Se não, a resposta é aceita pela Meta e recusada na entrega, com um
    // código que aponta pro lugar errado.
    const alerta = conferirNumeroQueRecebeu(value);
    if (alerta) console.warn(`[webhook] ${alerta}`);

    const from = message.from; // número do lead
    const text = message.text?.body || '';
    const nomePerfil = value.contacts?.[0]?.profile?.name;

    // O tamanho, não o texto. A partir do momento em que paciente de verdade
    // escreve, isto aqui é conteúdo de saúde mental — e o log da Railway é
    // visível pra quem tem acesso ao projeto, e guardado por tempo que o
    // consultório não controla. O que serve pra depurar é saber que a mensagem
    // chegou, de quem e quando; o conteúdo vive na planilha e no painel, que
    // são do médico e têm senha.
    console.log(
      `[webhook] mensagem de ${from} (${text.length} caracteres)` +
        (lote.length > 1 ? ` — lote de ${lote.length}` : '')
    );
    await handleIncomingMessage({ from, text, nome: nomePerfil });

    // As demais do mesmo lote, em ordem e uma de cada vez: processar em
    // paralelo embaralharia a máquina de estados, que é sequencial por
    // natureza. Cada uma passa pelo dedupe sozinha.
    for (const extra of lote.slice(1)) {
      if (jaProcessado(extra.id)) continue;
      const textoExtra = extra.text?.body || '';
      console.log(`[webhook] mensagem de ${extra.from} (${textoExtra.length} caracteres) — mesma remessa`);
      await handleIncomingMessage({ from: extra.from, text: textoExtra, nome: nomePerfil });
    }
  } catch (err) {
    // err.message sozinho é "Request failed with status code 400" — não diz a
    // causa. O motivo real vem no corpo da resposta da Meta.
    console.error('[webhook] erro ao processar mensagem:', explicarErroMeta(err));
  }
});

// A Meta exige uma URL pública de política de privacidade pra publicar o app, e
// o bot já tem endereço público — não precisa depender de site separado, que é
// mais uma coisa pra expirar ou sair do ar sem ninguém notar.
app.get('/privacidade', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'privacidade.html'));
});

app.get('/health', (req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
  console.log(`Webhook: http://localhost:${PORT}/webhook`);
  console.log(`Política de privacidade: http://localhost:${PORT}/privacidade`);
  console.log(`Dashboard: http://localhost:${PORT}/dashboard?token=...`);
  checkGoogleSheetsSetup();
  avisarSeDesprotegido();
  avisarSeSemAppSecret();
  if (!VERIFY_TOKEN) {
    console.warn(
      '[webhook] ⚠️  WHATSAPP_VERIFY_TOKEN não definido — a verificação do webhook na Meta vai falhar ' +
        'com "não foi possível validar a URL de callback ou o token".'
    );
  }
  assistente.avisarSeDesligada();
  telegram.avisarSeDesligado();
  iniciarAgendador();
  iniciarVigiaDeHandoff();
});
