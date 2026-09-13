const { getLead, saveLead, createLeadIfMissing } = require('./state');
const messages = require('./messages');
const { sendText } = require('./whatsapp');
const { isCrisisSignal, isBuyingSignal, isOutOfScope } = require('./triggers');
const { sendHandoffAlert } = require('./alert');
const { appendLeadRow } = require('./sheets');

// Envio "seguro": se a chamada à API do WhatsApp falhar (token inválido,
// instabilidade, etc.), isso NUNCA deve impedir o estado do lead de ser
// salvo — senão perdemos o rastro da conversa. O erro fica só no log.
async function enviar(to, texto) {
  try {
    await sendText(to, texto);
  } catch (err) {
    console.error(`[whatsapp] falha ao enviar mensagem para ${to}: ${err.message}`);
  }
}

function classificar(historico) {
  const texto = (historico || '').toLowerCase();
  if (texto.includes('primeira vez') || texto.includes('nunca fiz')) return 'Recomeço';
  if (texto.includes('ja fiz') || texto.includes('já fiz') || texto.includes('estavel') || texto.includes('estável')) {
    return 'Constância';
  }
  return 'Recomeço'; // default conservador — revisar critério com o médico
}

async function handleIncomingMessage({ from, text, nome }) {
  const textoOriginal = text || '';
  let lead = createLeadIfMissing(from);
  if (nome && !lead.nome) lead = saveLead(from, { nome });

  // PRIORIDADE 1 — sinal de crise/risco. Verificado sempre, em qualquer estado.
  if (isCrisisSignal(textoOriginal)) {
    await enviar(from, messages.acolhimentoRisco());
    saveLead(from, { state: 'HANDOFF', notas: 'RISCO/CRISE detectado — handoff prioritário' });
    await sendHandoffAlert({
      priority: 'RISCO/CRISE — URGENTE',
      phone: from,
      motivo: lead.motivo,
      classificacao: lead.classificacao,
      ultimaMensagem: textoOriginal,
    });
    await appendLeadRow(getLead(from));
    return;
  }

  // PRIORIDADE 2 — sinal de intenção de compra. Interrompe o fluxo em qualquer etapa.
  if (isBuyingSignal(textoOriginal)) {
    await enviar(from, messages.handoffCompra());
    saveLead(from, { state: 'HANDOFF', notas: 'Sinal de intenção de compra detectado' });
    await sendHandoffAlert({
      priority: 'INTENÇÃO DE COMPRA',
      phone: from,
      motivo: lead.motivo,
      classificacao: lead.classificacao,
      ultimaMensagem: textoOriginal,
    });
    await appendLeadRow(getLead(from));
    return;
  }

  // PRIORIDADE 3 — fora de escopo (ex: pedido de laudo/diagnóstico fechado)
  if (isOutOfScope(textoOriginal)) {
    await enviar(from, messages.desqualificacaoGentil());
    saveLead(from, { state: 'DESQUALIFICADO' });
    await appendLeadRow(getLead(from));
    return;
  }

  // Máquina de estados principal
  switch (lead.state) {
    case 'NOVO':
      await enviar(from, messages.boasVindas());
      saveLead(from, { state: 'AGUARDANDO_MOTIVO' });
      break;

    case 'AGUARDANDO_MOTIVO':
      await enviar(from, messages.perguntaHistorico());
      saveLead(from, { motivo: textoOriginal, state: 'AGUARDANDO_HISTORICO' });
      break;

    case 'AGUARDANDO_HISTORICO':
      await enviar(from, messages.perguntaFormato());
      saveLead(from, { historico: textoOriginal, state: 'AGUARDANDO_FORMATO' });
      break;

    case 'AGUARDANDO_FORMATO': {
      const classificacao = classificar(lead.historico);
      await enviar(from, messages.catalogo(lead.nome));
      saveLead(from, {
        formato: textoOriginal,
        classificacao,
        state: 'CATALOGO_ENVIADO',
        catalogoEnviadoEm: new Date().toISOString(),
        followupsAgendados: true,
        followupsEnviados: [],
      });
      break;
    }

    case 'HANDOFF':
    case 'DESQUALIFICADO':
    case 'CLIENTE':
      // Automação fica em silêncio — conversa já está (ou deveria estar) com um humano.
      console.log(`[flow] mensagem recebida de ${from} em estado ${lead.state} — ignorada pela automação.`);
      break;

    default:
      // Estados de follow-up (FOLLOWUP_D2 etc.) ou reengajamento: qualquer resposta
      // do lead aqui é sinal de interesse renovado — melhor mandar pro humano.
      await enviar(from, messages.handoffCompra());
      saveLead(from, { state: 'HANDOFF', notas: `Lead respondeu durante ${lead.state}` });
      await sendHandoffAlert({
        priority: 'RETOMADA DE CONTATO',
        phone: from,
        motivo: lead.motivo,
        classificacao: lead.classificacao,
        ultimaMensagem: textoOriginal,
      });
      break;
  }

  await appendLeadRow(getLead(from));
}

module.exports = { handleIncomingMessage };
