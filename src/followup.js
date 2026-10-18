const cron = require('node-cron');
const { readAll, saveLead } = require('./state');
const { sendTemplate } = require('./whatsapp');
const { explicarErroMeta } = require('./erros-meta');
const { planejarFollowup } = require('./followup-plano');
const { registrarEnvio } = require('./freio');
const { registrarTemplate } = require('./orcamento');
const { ehTeste } = require('./numeros-de-teste');
const funil = require('./funil');

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
// Os textos em messages.js (followupD3/D5/D7) não são mais enviados
// diretamente — eles servem de referência do conteúdo a cadastrar como
// template no Meta Business Manager. Depois de criar e ter cada template
// aprovado, coloque o nome dele nas variáveis WHATSAPP_TEMPLATE_D3/D5/D7
// do .env (veja .env.example e a seção "Limitação importante" do README).

const TEMPLATE_LANGUAGE = process.env.WHATSAPP_TEMPLATE_LANGUAGE || 'pt_BR';

function diasDesde(dataIso) {
  const ms = Date.now() - new Date(dataIso).getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

async function checarFollowups(agora = new Date()) {
  // Quem conversa com o paciente é o n8n desde 18/10/2026, então os leads não
  // nascem mais aqui: nascem na aba FUNIL da planilha. Esta linha traz de lá
  // quem ainda não está na fila. Tudo depois dela é o motor de sempre — teto
  // diário, freio por pessoa, PARAR, uma etapa por rodada.
  //
  // Falha de leitura não derruba a rodada (o sincronizar engole e loga): quem
  // já está na fila continua sendo atendido pelo que está no disco.
  await funil.sincronizar();

  const leads = readAll();
  for (const phone of Object.keys(leads)) {
    const lead = leads[phone];

    // Follow-up é mensagem PAGA. Mandar para o número do próprio médico é
    // cobrar dele para avisá-lo de algo que ele mesmo escreveu.
    if (ehTeste(phone)) continue;

    const plano = planejarFollowup(lead, agora);
    if (plano.acao === 'nada') continue;

    if (plano.acao === 'pular') {
      // Registrado, não enviado. Sem o registro, estas etapas voltariam a
      // "vencer" em toda rodada seguinte, para sempre.
      saveLead(phone, {
        followupsPulados: [...(lead.followupsPulados || []), ...plano.chaves],
        followupsAgendados: false,
      });
      console.log(
        `[followup] ${phone}: ${plano.chaves.join(', ')} pulado(s) — ${plano.motivo}`
      );
      continue;
    }

    const { etapa, dias } = plano;
    const template = process.env[etapa.variavel];
    if (!template) {
      console.warn(
        `[followup] ${etapa.variavel} não configurado — pulando ${etapa.chave} para ${phone}. ` +
          'Veja TEMPLATES-WHATSAPP.md.'
      );
      continue;
    }

    // O freio vale para template também. Ele mora no enviar() do flow.js, que
    // este caminho não usa — era um buraco por onde uma rajada paga passaria
    // inteira.
    const { liberado, enviadas } = registrarEnvio(phone);
    if (!liberado) {
      console.error(
        `[freio] 🚨 FOLLOW-UP BLOQUEADO para ${phone}: ${enviadas} mensagens no último minuto.`
      );
      continue;
    }

    // O freio é por pessoa; este é global. Um laço disparando para centenas de
    // leads diferentes passa por aquele e é barrado por este — e é esse o caso
    // que vira conta surpresa.
    const orcamento = registrarTemplate(agora);
    if (!orcamento.liberado) {
      console.error(
        `[orcamento] 🚨 TETO DIÁRIO ATINGIDO: ${orcamento.enviadosHoje}/${orcamento.teto} ` +
          'mensagens pagas hoje. O resto da fila fica para amanhã. Se isto não era esperado, ' +
          'é bug — investigue antes de aumentar TETO_TEMPLATES_DIA.'
      );
      // break, não continue: o teto é global, então não adianta tentar o
      // próximo lead.
      break;
    }

    // O try é por lead, não pelo lote. Sem ele, um único número que a Meta
    // recusa (saiu do WhatsApp, template ainda não aprovado, janela vencida)
    // estoura o await e mata o laço — e TODO MUNDO que vinha depois na fila
    // fica sem follow-up naquele dia, em silêncio.
    try {
      await sendTemplate(phone, template, TEMPLATE_LANGUAGE, []);
    } catch (err) {
      console.error(
        `[followup] falha ao enviar ${etapa.chave} para ${phone}: ${explicarErroMeta(err)}`
      );
      continue;
    }

    saveLead(phone, {
      followupsEnviados: [...(lead.followupsEnviados || []), etapa.chave],
      followupsPulados: [...(lead.followupsPulados || []), ...plano.pular],
      state: `FOLLOWUP_${etapa.chave}`,
      // Última etapa entregue: encerra a sequência aqui mesmo, sem depender de
      // uma rodada futura para perceber.
      ...(etapa.chave === 'D7'
        ? { state: 'REENGAJAMENTO_MENSAL', followupsAgendados: false }
        : {}),
    });
    console.log(
      `[followup] ${etapa.chave} enviado para ${phone} (${dias} dias, template: ${template})` +
        (plano.pular.length ? ` — ${plano.pular.join(', ')} pulado(s) por atraso` : '')
    );
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
