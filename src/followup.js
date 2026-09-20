const cron = require('node-cron');
const { readAll, saveLead } = require('./state');
const { sendTemplate } = require('./whatsapp');

// MVP simples: roda uma vez por dia (09:00) e verifica, para cada lead com
// followupsAgendados = true, quantos dias se passaram desde que o catálogo
// foi enviado (catalogoEnviadoEm). Dispara a mensagem do dia correspondente
// se ainda não foi enviada e se o lead não avançou (não está em HANDOFF/CLIENTE).
//
// Importante: fora da janela de 24h desde a última mensagem do lead, a Meta
// exige o uso de "message templates" pré-aprovados em vez de texto livre — e os
// follow-ups de D+2, D+3, D+5, D+7 quase certamente vão cair fora dessa janela.
// Por isso os follow-ups são enviados via sendTemplate, não sendText.
//
// Os textos em messages.js (followupD2/D3/D5/D7) não são mais enviados
// diretamente — eles servem de referência do conteúdo a cadastrar como
// template no Meta Business Manager. Depois de criar e ter cada template
// aprovado, coloque o nome dele nas variáveis WHATSAPP_TEMPLATE_D2/D3/D5/D7
// do .env (veja .env.example e a seção "Limitação importante" do README).

const TEMPLATE_LANGUAGE = process.env.WHATSAPP_TEMPLATE_LANGUAGE || 'pt_BR';

function textParams(...values) {
  return values.map((value) => ({ type: 'text', text: String(value || '') }));
}

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
    let enviados = lead.followupsEnviados || [];

    // params: variáveis do corpo do template, na ordem em que aparecem nele
    // (ex: {{1}}, {{2}}...). Ajuste depois de ver a estrutura real do template aprovado.
    const etapas = [
      { dia: 2, chave: 'D2', template: process.env.WHATSAPP_TEMPLATE_D2, params: [] },
      { dia: 3, chave: 'D3', template: process.env.WHATSAPP_TEMPLATE_D3, params: textParams(lead.nome) },
      { dia: 5, chave: 'D5', template: process.env.WHATSAPP_TEMPLATE_D5, params: [] },
      {
        dia: 7,
        chave: 'D7',
        template: process.env.WHATSAPP_TEMPLATE_D7,
        params: textParams(lead.nome, '[preencher 3 horários]'),
      },
    ];

    for (const etapa of etapas) {
      if (dias < etapa.dia || enviados.includes(etapa.chave)) continue;

      if (!etapa.template) {
        console.warn(
          `[followup] WHATSAPP_TEMPLATE_${etapa.chave} não configurado no .env — pulando follow-up ${etapa.chave} para ${phone}. Veja a seção "Limitação importante" do README.`
        );
        continue;
      }

      const components = etapa.params.length ? [{ type: 'body', parameters: etapa.params }] : [];
      await sendTemplate(phone, etapa.template, TEMPLATE_LANGUAGE, components);
      enviados = [...enviados, etapa.chave];
      saveLead(phone, {
        followupsEnviados: enviados,
        state: `FOLLOWUP_${etapa.chave}`,
      });
      console.log(`[followup] ${etapa.chave} enviado para ${phone} (template: ${etapa.template})`);
    }

    if (dias > 7 && enviados.includes('D7')) {
      saveLead(phone, { state: 'REENGAJAMENTO_MENSAL', followupsAgendados: false });
    }
  }
}

// Servidor em nuvem roda em UTC por padrão. Sem fixar o fuso aqui, "09:00"
// viraria 06:00 em Mossoró e o lead receberia o follow-up de madrugada.
const FUSO_PADRAO = 'America/Fortaleza'; // Mossoró/RN
const FUSO = process.env.FOLLOWUP_TIMEZONE || FUSO_PADRAO;
const HORA = process.env.FOLLOWUP_HORA || '9';

function iniciarAgendador() {
  const tarefa = () => checarFollowups().catch((err) => console.error('[followup] erro:', err));

  try {
    cron.schedule(`0 ${HORA} * * *`, tarefa, { timezone: FUSO });
    console.log(`[followup] agendador iniciado (todo dia às ${HORA}:00, fuso ${FUSO})`);
  } catch (err) {
    // Fuso escrito errado no .env derrubava o processo inteiro no boot — ou
    // seja, o webhook parava de receber mensagem por causa de uma config de
    // follow-up. Melhor agendar no fuso padrão e gritar no log.
    console.error(
      `[followup] ⚠️  FOLLOWUP_TIMEZONE inválido ("${FUSO}"): ${err.message}. ` +
        `Agendando em ${FUSO_PADRAO} — corrija o .env.`
    );
    cron.schedule(`0 ${HORA} * * *`, tarefa, { timezone: FUSO_PADRAO });
  }
}

module.exports = { iniciarAgendador, checarFollowups };
