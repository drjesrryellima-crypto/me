// Re-avisa o médico de um handoff que ninguém atendeu.
//
// O alerta de crise dispara UMA vez. Se o celular estava no silencioso, se ele
// estava em consulta, se a notificação foi arrastada sem ler — o sistema fica
// calado para sempre. O paciente ouviu "o Dr. Jesrryel já foi avisado e vai te
// procurar" e espera. Ninguém mais no sistema sabe que ninguém apareceu.
//
// Era o pior modo de falha que sobrou: silencioso, invisível no painel, e pior
// justamente nos casos de risco.
//
// Não é um lembrete bonitinho. É insistência proporcional: em crise, de 20 em
// 20 minutos, de madrugada inclusive. Em handoff comum, de 4 em 4 horas e só
// em horário em que acordar alguém faz sentido.

const { readAll, saveLead } = require('./state');
const { ehRisco } = require('./estados');
const telegram = require('./telegram');
const { linkDaConversa } = require('./link-whatsapp');

// Crise: 20 min, até 6 vezes (2h de insistência). Depois para — se em duas
// horas ninguém apareceu, insistir mais não resolve, e o paciente já recebeu
// o 188 na primeira mensagem, que é o que de fato o socorre agora.
const RISCO = { esperaMin: 20, maxRealertas: 6, respeitaSilencio: false };

// Handoff comum (intenção de compra): 4h, até 2 vezes. Não é urgência
// clínica — acordar o médico às 3 da manhã por um lead custa mais do que
// ganha, e depois de dois avisos o lead está no painel para ser visto.
const NORMAL = { esperaMin: 240, maxRealertas: 2, respeitaSilencio: true };

const FUSO = process.env.FOLLOWUP_TIMEZONE || 'America/Fortaleza';
const SILENCIO_ANTES_DE = 8;
const SILENCIO_DEPOIS_DE = 21;

function horaLocal(agora, fuso = FUSO) {
  try {
    const h = new Intl.DateTimeFormat('pt-BR', {
      timeZone: fuso,
      hour: 'numeric',
      hour12: false,
    }).format(agora);
    return Number(h);
  } catch (err) {
    // Fuso escrito errado não pode engolir um re-alerta. Na dúvida, manda.
    return 12;
  }
}

function dentroDoSilencio(agora) {
  const h = horaLocal(agora);
  return h < SILENCIO_ANTES_DE || h >= SILENCIO_DEPOIS_DE;
}

function minutosDesde(iso, agora) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return (agora.getTime() - d.getTime()) / 60000;
}

/**
 * Decide se este lead merece um re-alerta agora.
 * @returns {{realertar: boolean, motivo: string, risco?: boolean, esperaMin?: number}}
 */
function planejarRealerta(lead, agora = new Date()) {
  if (!lead || lead.state !== 'HANDOFF') {
    return { realertar: false, motivo: 'não está em handoff' };
  }
  // atendidoEm é gravado quando o médico responde pelo painel, ou quando ele
  // marca como atendido (porque respondeu pelo celular dele, que o sistema não
  // tem como ver). É o único jeito honesto de saber: o bot não enxerga o
  // WhatsApp pessoal dele.
  if (lead.atendidoEm) {
    return { realertar: false, motivo: 'já atendido' };
  }
  if (!lead.handoffEm) {
    // Leads que entraram em handoff antes deste campo existir. Re-alertar todos
    // eles de uma vez, num deploy, seria uma avalanche de notificação sobre
    // conversas que podem já estar resolvidas.
    return { realertar: false, motivo: 'handoff anterior a este controle' };
  }

  const risco = ehRisco(lead);
  const regra = risco ? RISCO : NORMAL;
  const jaMandados = lead.realertasEnviados || 0;

  if (jaMandados >= regra.maxRealertas) {
    return { realertar: false, motivo: 'limite de re-alertas atingido' };
  }
  if (regra.respeitaSilencio && dentroDoSilencio(agora)) {
    return { realertar: false, motivo: 'horário de silêncio' };
  }

  // Conta desde o último aviso, não desde o handoff: senão o segundo re-alerta
  // sairia junto com o primeiro.
  const desde = lead.ultimoRealertaEm || lead.handoffEm;
  const minutos = minutosDesde(desde, agora);
  if (minutos === null || minutos < regra.esperaMin) {
    return { realertar: false, motivo: 'ainda dentro da espera' };
  }

  return { realertar: true, motivo: 'handoff sem atendimento', risco, esperaMin: regra.esperaMin };
}

// agora vem por parâmetro, não de new Date(): o tempo de espera que o texto
// anuncia tem que ser o mesmo que a decisão de re-alertar usou.
function montarTexto(lead, plano, agora) {
  const minutos = Math.round(minutosDesde(lead.handoffEm, agora) || 0);
  const espera = minutos >= 120 ? `${Math.floor(minutos / 60)}h` : `${minutos} min`;
  const link = linkDaConversa(lead.phone);
  const cabecalho = plano.risco
    ? `🚨 CRISE SEM RESPOSTA — ${espera} esperando`
    : `🔔 HANDOFF SEM RESPOSTA — ${espera} esperando`;

  return (
    `${cabecalho}\n` +
    `Telefone: ${lead.phone}\n` +
    (link ? `Abrir conversa: ${link}\n` : '') +
    `Motivo: ${lead.motivo || '-'}\n` +
    `\nEsta pessoa recebeu "o Dr. Jesrryel vai te procurar" e ainda não foi procurada.\n` +
    `Se você já respondeu pelo seu celular, marque como atendido no painel para parar os avisos.`
  );
}

async function checarHandoffsParados(agora = new Date()) {
  const leads = readAll();
  let avisados = 0;

  for (const phone of Object.keys(leads)) {
    const lead = leads[phone];
    const plano = planejarRealerta(lead, agora);
    if (!plano.realertar) continue;

    // O try é por lead: um número que o Telegram recusa não pode matar o laço
    // e deixar os outros handoffs parados sem aviso.
    try {
      const entregue = await telegram.enviarAlerta(montarTexto(lead, plano, agora));
      if (!entregue) {
        console.warn(`[handoff-parado] ⚠️  NINGUÉM FOI AVISADO do handoff parado de ${phone}.`);
        continue;
      }
    } catch (err) {
      console.error(`[handoff-parado] falha ao avisar sobre ${phone}: ${err.message}`);
      continue;
    }

    saveLead(phone, {
      realertasEnviados: (lead.realertasEnviados || 0) + 1,
      ultimoRealertaEm: agora.toISOString(),
    });
    avisados += 1;
    console.log(
      `[handoff-parado] re-alerta ${(lead.realertasEnviados || 0) + 1} enviado para ${phone}` +
        `${plano.risco ? ' (RISCO)' : ''}`
    );
  }

  return avisados;
}

module.exports = { checarHandoffsParados, planejarRealerta, RISCO, NORMAL };
