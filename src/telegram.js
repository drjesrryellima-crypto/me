const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Canal de alerta que chega no celular do médico.
//
// O servidor sozinho não toca o telefone de ninguém: precisa de um canal. As
// alternativas tinham custo que este caso não aceita — SMS por API exige
// cadastro e cartão, e relay de push sem cadastro passaria a frase de um
// paciente em crise por um serviço público.
//
// O Telegram entrega na hora, de graça, sem a janela de 24h que o WhatsApp
// impõe para mensagem iniciada pelo negócio — e a configuração inteira é
// conversar, não preencher painel.
//
// O chat_id é descoberto sozinho: basta o médico mandar uma mensagem para o
// próprio bot uma vez. Sem isso ele teria que caçar um número em documentação
// de API, que é exatamente o tipo de passo que costuma travar tudo.

const TOKEN = () => process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID_FIXO = () => process.env.TELEGRAM_CHAT_ID;
const DATA_DIR = () => process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const CACHE = () => path.join(DATA_DIR(), 'telegram-chat.json');

const api = (metodo) => `https://api.telegram.org/bot${TOKEN()}/${metodo}`;

function lerCache() {
  try {
    return JSON.parse(fs.readFileSync(CACHE(), 'utf8')).chatId || null;
  } catch (err) {
    return null;
  }
}

function gravarCache(chatId) {
  try {
    fs.mkdirSync(DATA_DIR(), { recursive: true });
    fs.writeFileSync(CACHE(), JSON.stringify({ chatId, descobertoEm: new Date().toISOString() }));
  } catch (err) {
    // Sem cache o bot redescobre na próxima vez. Não vale derrubar um alerta
    // de crise por causa de disco.
    console.warn(`[telegram] não deu pra guardar o chat_id: ${err.message}`);
  }
}

/**
 * Procura, nas mensagens recentes recebidas pelo bot, de quem elas vieram.
 * É assim que o médico se identifica: mandando qualquer coisa para o bot dele.
 */
async function descobrirChatId() {
  const { data } = await axios.get(api('getUpdates'), { timeout: 10000 });
  const updates = (data && data.result) || [];
  for (let i = updates.length - 1; i >= 0; i--) {
    const chat = updates[i].message && updates[i].message.chat;
    if (chat && chat.id) return String(chat.id);
  }
  return null;
}

async function chatId() {
  const fixo = CHAT_ID_FIXO();
  if (fixo && fixo.trim()) return fixo.trim();

  const guardado = lerCache();
  if (guardado) return guardado;

  const descoberto = await descobrirChatId();
  if (descoberto) {
    gravarCache(descoberto);
    console.log(`[telegram] conversa identificada (chat_id ${descoberto}) — alertas ativos.`);
  }
  return descoberto;
}

function configurado() {
  const t = TOKEN();
  return Boolean(t && t.trim());
}

/**
 * Manda o alerta. Nunca lança: uma falha aqui não pode derrubar o atendimento
 * do paciente que está do outro lado.
 * @returns {Promise<boolean>} se a mensagem saiu
 */
async function enviarAlerta(texto) {
  if (!configurado()) return false;

  try {
    const destino = await chatId();
    if (!destino) {
      console.warn(
        '[telegram] ⚠️  TELEGRAM_BOT_TOKEN está definido, mas o bot nunca recebeu mensagem ' +
          'nenhuma — então não há para onde mandar o alerta. Abra o Telegram, procure o seu ' +
          'bot e mande qualquer coisa para ele uma vez.'
      );
      return false;
    }

    await axios.post(
      api('sendMessage'),
      { chat_id: destino, text: texto, disable_web_page_preview: true },
      { timeout: 10000 }
    );
    return true;
  } catch (err) {
    const detalhe = (err.response && err.response.data && err.response.data.description) || err.message;
    console.error(`[telegram] falha ao enviar alerta: ${detalhe}`);
    return false;
  }
}

function avisarSeDesligado() {
  if (!configurado()) {
    console.warn(
      '[telegram] ⚠️  TELEGRAM_BOT_TOKEN não definido — alerta de crise só aparece no log, ' +
        'e ninguém é avisado de verdade. Crie um bot com o @BotFather no Telegram e cole o ' +
        'token nesta variável.'
    );
  }
}

module.exports = { enviarAlerta, avisarSeDesligado, configurado, descobrirChatId };
