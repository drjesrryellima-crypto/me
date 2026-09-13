const cron = require('node-cron');
const { readAll, saveLead } = require('./state');
const messages = require('./messages');
const { sendText } = require('./whatsapp');

// MVP simples: roda uma vez por dia (09:00) e verifica, para cada lead com
// followupsAgendados = true, quantos dias se passaram desde que o catálogo
// foi enviado (catalogoEnviadoEm). Dispara a mensagem do dia correspondente
// se ainda não foi enviada e se o lead não avançou (não está em HANDOFF/CLIENTE).
//
// Importante: fora da janela de 24h desde a última mensagem do lead, a Meta
// exige o uso de "message templates" pré-aprovados em vez de texto livre.
// Troque sendText por sendTemplate (ver whatsapp.js) quando isso for
// implementado em produção.

function diasDesde(dataIso) {
  const ms = Date.now() - new Date(dataIso).getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

async function checarFollowups() {
  const leads = readAll();
  for (const phone of Object.keys(leads)) {
    const lead = leads[phone];
    if (!lead.followupsAgendados) continue;
    if (['HANDOFF', 'CLIENTE', 'DESQUALIFICADO'].includes(lead.state)) continue;
    if (!lead.catalogoEnviadoEm) continue;

    const dias = diasDesde(lead.catalogoEnviadoEm);
    const enviados = lead.followupsEnviados || [];

    const etapas = [
      { dia: 2, chave: 'D2', texto: messages.followupD2() },
      { dia: 3, chave: 'D3', texto: messages.followupD3(lead.nome) },
      { dia: 5, chave: 'D5', texto: messages.followupD5() },
      { dia: 7, chave: 'D7', texto: messages.followupD7(lead.nome, '[preencher 3 horários]') },
    ];

    for (const etapa of etapas) {
      if (dias >= etapa.dia && !enviados.includes(etapa.chave)) {
        await sendText(phone, etapa.texto);
        saveLead(phone, {
          followupsEnviados: [...enviados, etapa.chave],
          state: `FOLLOWUP_${etapa.chave}`,
        });
        console.log(`[followup] ${etapa.chave} enviado para ${phone}`);
      }
    }

    if (dias > 7 && enviados.includes('D7')) {
      saveLead(phone, { state: 'REENGAJAMENTO_MENSAL', followupsAgendados: false });
    }
  }
}

function iniciarAgendador() {
  // Todo dia às 09:00 (horário do sistema onde o processo estiver rodando)
  cron.schedule('0 9 * * *', () => {
    checarFollowups().catch((err) => console.error('[followup] erro:', err));
  });
  console.log('[followup] agendador iniciado (todo dia às 09:00)');
}

module.exports = { iniciarAgendador, checarFollowups };
