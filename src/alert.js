const axios = require('axios');
const telegram = require('./telegram');
const { linkDaConversa } = require('./link-whatsapp');

const WEBHOOK_URL = process.env.HANDOFF_ALERT_WEBHOOK_URL;

// Avisa o médico para assumir a conversa. Sem HANDOFF_ALERT_WEBHOOK_URL
// configurado (ex: um webhook do Zapier/Slack), o alerta só aparece no log —
// e aí ninguém é avisado de verdade.
//
// O alerta tem dois destinos, e eles merecem conteúdo diferente.
//
// O WEBHOOK é o canal do médico — Slack, Zapier, celular. Num alerta de crise
// ele precisa das palavras exatas para julgar a urgência: "quero sumir" e
// "quero sumir dessa cidade" pedem reações diferentes. Vai completo.
//
// O LOG é da Railway, visível para quem tem acesso ao projeto e guardado por
// tempo que o consultório não controla. Ali basta saber que o alerta disparou,
// para quem e por qual motivo — a frase do paciente não precisa ficar escrita
// num servidor de terceiro, e é justamente a mais sensível do sistema.
async function sendHandoffAlert({ priority, phone, motivo, classificacao, ultimaMensagem }) {
  // O link vem logo abaixo do telefone porque é ele que o médico vai tocar.
  // O Telegram transforma URL em plano em link clicável sozinho, então não
  // precisa de parse_mode — que exigiria escapar a frase do paciente e poderia
  // engolir o alerta inteiro por causa de um caractere.
  const link = linkDaConversa(phone);
  const cabecalho =
    `🔔 HANDOFF [${priority}]\n` +
    `Telefone: ${phone}\n` +
    (link ? `Abrir conversa: ${link}\n` : '') +
    `Motivo: ${motivo || '-'}\n` +
    `Classificação: ${classificacao || '-'}`;

  const paraOMedico = `${cabecalho}\nÚltima mensagem do lead: "${ultimaMensagem || ''}"`;

  console.log(`${cabecalho}\nÚltima mensagem do lead: (${(ultimaMensagem || '').length} caracteres)`);

  // O Telegram é o canal que chega no celular. Vai em paralelo com o webhook —
  // quem tiver os dois configurados recebe nos dois, e nenhum depende do outro.
  const entregue = await telegram.enviarAlerta(paraOMedico);
  if (!entregue && !WEBHOOK_URL) {
    // O que fazer depende de onde parou. Mandar "configure o token" para quem
    // já configurou o token empurra para o lugar errado — e num alerta de crise
    // o tempo perdido é o que mais custa.
    const comoResolver = telegram.configurado()
      ? 'O token está configurado, mas a mensagem não saiu — veja a linha [telegram] logo acima.'
      : 'Nenhum canal está configurado. Defina TELEGRAM_BOT_TOKEN.';
    console.warn(`[alert] ⚠️  NINGUÉM FOI AVISADO deste ${priority}. ${comoResolver}`);
  }

  if (WEBHOOK_URL) {
    try {
      await axios.post(WEBHOOK_URL, {
        text: paraOMedico,
        priority,
        phone,
        motivo,
        classificacao,
        ultimaMensagem,
        link,
      });
    } catch (err) {
      console.error('[alert] falha ao enviar webhook de alerta:', err.message);
    }
  }
}

module.exports = { sendHandoffAlert };
