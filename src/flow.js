const { getLead, saveLead, createLeadIfMissing } = require('./state');
const messages = require('./messages');
const { sendText } = require('./whatsapp');
const { isCrisisSignal, isBuyingSignal, isOutOfScope } = require('./triggers');
const { sendHandoffAlert } = require('./alert');
const { appendLeadRow } = require('./sheets');
const assistente = require('./assistente');
const { explicarErroMeta } = require('./erros-meta');

// Envio "seguro": se a chamada à API do WhatsApp falhar (token inválido,
// instabilidade, etc.), isso NUNCA deve impedir o estado do lead de ser
// salvo — senão perdemos o rastro da conversa. O erro fica só no log.
async function enviar(to, texto) {
  try {
    await sendText(to, texto);
  } catch (err) {
    // err.message aqui é "Request failed with status code 400" — o motivo real
    // (o código da Meta) vem no corpo da resposta. Este é o único lugar onde a
    // falha de envio aparece: o catch lá do server.js nunca vê, porque o erro
    // morre aqui de propósito, pra não impedir o estado do lead de ser salvo.
    console.error(`[whatsapp] falha ao enviar mensagem para ${to}: ${explicarErroMeta(err)}`);
  }
}

// Guarda a fala no histórico da conversa, que é o contexto que a assistente
// recebe na próxima mensagem. Cortado nos últimos turnos pelo assistente.js.
function registrarTurno(phone, role, content) {
  const lead = getLead(phone) || {};
  const historicoConversa = [...(lead.historicoConversa || []), { role, content }];
  return saveLead(phone, { historicoConversa: historicoConversa.slice(-40) });
}

async function encaminharParaHumano(from, { texto, priority, notas, state = 'HANDOFF', ultimaMensagem }) {
  await enviar(from, texto);
  registrarTurno(from, 'assistant', texto);
  const lead = saveLead(from, { state, notas });
  if (priority) {
    await sendHandoffAlert({
      priority,
      phone: from,
      motivo: lead.motivo,
      classificacao: lead.classificacao,
      ultimaMensagem,
    });
  }
  await appendLeadRow(getLead(from));
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
  lead = registrarTurno(from, 'user', textoOriginal);

  // PRIORIDADE 1 — sinal de crise/risco, por palavra-chave.
  // Roda ANTES da IA, sempre, de propósito: esta checagem não depende de rede,
  // de saldo na API nem de o modelo ter lido a frase do jeito certo. A IA tem
  // instrução de sinalizar risco também (ver PRIORIDADE 4), mas como segunda
  // camada — nunca como a única.
  if (isCrisisSignal(textoOriginal)) {
    await encaminharParaHumano(from, {
      texto: messages.acolhimentoRisco(),
      priority: 'RISCO/CRISE — URGENTE',
      notas: 'RISCO/CRISE detectado — handoff prioritário',
      ultimaMensagem: textoOriginal,
    });
    return;
  }

  // PRIORIDADE 2 — intenção de compra por palavra-chave. Também antes da IA:
  // "quanto custa" tem resposta fixa e não vale uma chamada de API.
  if (isBuyingSignal(textoOriginal)) {
    await encaminharParaHumano(from, {
      texto: messages.handoffCompra(),
      priority: 'INTENÇÃO DE COMPRA',
      notas: 'Sinal de intenção de compra detectado',
      ultimaMensagem: textoOriginal,
    });
    return;
  }

  // PRIORIDADE 3 — fora de escopo (ex: pedido de laudo/diagnóstico fechado)
  if (isOutOfScope(textoOriginal)) {
    await encaminharParaHumano(from, {
      texto: messages.desqualificacaoGentil(),
      state: 'DESQUALIFICADO',
    });
    return;
  }

  // Conversa já está com um humano — automação fica em silêncio.
  if (['HANDOFF', 'DESQUALIFICADO', 'CLIENTE'].includes(lead.state)) {
    console.log(`[flow] mensagem de ${from} em estado ${lead.state} — ignorada pela automação.`);
    await appendLeadRow(getLead(from));
    return;
  }

  // PRIORIDADE 4 — a assistente com IA. Devolve null quando não pôde ser usada
  // (sem chave, rede fora, resposta inválida, compliance barrado) e aí o fluxo
  // determinístico assume: a automação nunca fica muda porque a API falhou.
  const ia = await assistente.responder({ lead, texto: textoOriginal });
  if (ia) {
    await aplicarRespostaDaIA(from, lead, ia, textoOriginal);
    return;
  }

  await fluxoDeterministico(from, lead, textoOriginal);
}

// Aplica o que a assistente devolveu. Nos desfechos que não são "conversando",
// manda o texto fixo de messages.js em vez do texto da IA: são justamente os
// casos em que a palavra exata importa (acolhimento de risco, desqualificação)
// ou em que um deslize custa caro (falar preço numa resposta de compra).
async function aplicarRespostaDaIA(from, lead, ia, textoOriginal) {
  if (ia.intencao === 'risco') {
    await encaminharParaHumano(from, {
      texto: messages.acolhimentoRisco(),
      priority: 'RISCO/CRISE — URGENTE',
      notas: 'RISCO/CRISE sinalizado pela assistente (não pegou nas palavras-chave)',
      ultimaMensagem: textoOriginal,
    });
    return;
  }

  if (ia.intencao === 'compra') {
    await encaminharParaHumano(from, {
      texto: messages.handoffCompra(),
      priority: 'INTENÇÃO DE COMPRA',
      notas: 'Intenção de compra sinalizada pela assistente',
      ultimaMensagem: textoOriginal,
    });
    return;
  }

  if (ia.intencao === 'fora_de_escopo') {
    await encaminharParaHumano(from, {
      texto: messages.desqualificacaoGentil(),
      state: 'DESQUALIFICADO',
    });
    return;
  }

  // conversando — usa o texto da própria assistente.
  await enviar(from, ia.resposta);
  registrarTurno(from, 'assistant', ia.resposta);

  // Só sobrescreve campo que a IA realmente extraiu: string vazia significa
  // "o lead ainda não contou", não "apague o que ele já tinha contado".
  const campos = {};
  for (const campo of ['motivo', 'historico', 'formato', 'classificacao']) {
    if (ia[campo]) campos[campo] = ia[campo];
  }

  // Qualificação completa é o gatilho dos follow-ups D+2/3/5/7 — o mesmo
  // momento que o fluxo determinístico marca ao enviar o catálogo.
  const jaAgendou = lead.followupsAgendados || lead.catalogoEnviadoEm;
  if (ia.qualificacaoCompleta && !jaAgendou) {
    campos.state = 'CATALOGO_ENVIADO';
    campos.catalogoEnviadoEm = new Date().toISOString();
    campos.followupsAgendados = true;
    campos.followupsEnviados = [];
  }

  saveLead(from, campos);
  await appendLeadRow(getLead(from));
}

// O roteiro fixo de antes. Continua sendo o caminho quando a IA está desligada
// e a rede de segurança quando ela falha.
async function fluxoDeterministico(from, lead, textoOriginal) {
  switch (lead.state) {
    case 'NOVO':
      await enviar(from, messages.boasVindas());
      registrarTurno(from, 'assistant', messages.boasVindas());
      saveLead(from, { state: 'AGUARDANDO_MOTIVO' });
      break;

    case 'AGUARDANDO_MOTIVO':
      await enviar(from, messages.perguntaHistorico());
      registrarTurno(from, 'assistant', messages.perguntaHistorico());
      saveLead(from, { motivo: textoOriginal, state: 'AGUARDANDO_HISTORICO' });
      break;

    case 'AGUARDANDO_HISTORICO':
      await enviar(from, messages.perguntaFormato());
      registrarTurno(from, 'assistant', messages.perguntaFormato());
      saveLead(from, { historico: textoOriginal, state: 'AGUARDANDO_FORMATO' });
      break;

    case 'AGUARDANDO_FORMATO': {
      const catalogo = messages.catalogo(lead.nome);
      await enviar(from, catalogo);
      registrarTurno(from, 'assistant', catalogo);
      saveLead(from, {
        formato: textoOriginal,
        classificacao: classificar(lead.historico),
        state: 'CATALOGO_ENVIADO',
        catalogoEnviadoEm: new Date().toISOString(),
        followupsAgendados: true,
        followupsEnviados: [],
      });
      break;
    }

    default:
      // Estados de follow-up ou reengajamento: qualquer resposta do lead aqui
      // é sinal de interesse renovado — melhor mandar pro humano.
      await encaminharParaHumano(from, {
        texto: messages.handoffCompra(),
        priority: 'RETOMADA DE CONTATO',
        notas: `Lead respondeu durante ${lead.state}`,
        ultimaMensagem: textoOriginal,
      });
      return;
  }

  await appendLeadRow(getLead(from));
}

module.exports = { handleIncomingMessage, aplicarRespostaDaIA, fluxoDeterministico };
