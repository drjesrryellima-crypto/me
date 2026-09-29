const axios = require('axios');
const telegram = require('./telegram');

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
  const cabecalho =
    `🔔 HANDOFF [${priority}]\n` +
    `Telefone: ${phone}\n` +
    `Motivo: ${motivo || '-'}\n` +
    `Classificação: ${classificacao || '-'}`;

  const paraOMedico = `${cabecalho}\nÚltima mensagem do lead: "${ultimaMensagem || ''}"`;

  console.log(`${cabecalho}\nÚltima mensagem do lead: (${(ultimaMensagem || '').length} caracteres)`);

  // O Telegram é o canal que chega no celular. Vai em paralelo com o webhook —
  // quem tiver os dois configurados recebe nos dois, e nenhum depende do outro.
  const entregue = await telegram.enviarAlerta(paraOMedico);
  if (!entregue && !WEBHOOK_URL) {
    console.warn(
      `[alert] ⚠️  NINGUÉM FOI AVISADO deste ${priority}. O alerta existe só neste log. ` +
        'Configure TELEGRAM_BOT_TOKEN.'
    );
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
      });
    } catch (err) {
      console.error('[alert] falha ao enviar webhook de alerta:', err.message);
    }
  }
}

module.exports = { sendHandoffAlert };
