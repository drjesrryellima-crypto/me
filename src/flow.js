const { getLead, saveLead, createLeadIfMissing } = require('./state');
const messages = require('./messages');
const { sendText } = require('./whatsapp');
const { isCrisisSignal, isBuyingSignal, isPrecoDoPlano, isPedidoDeAgendamento, isOutOfScope } =
  require('./triggers');
const { sendHandoffAlert } = require('./alert');
const telegram = require('./telegram');
const { planejarAvisoDeRetorno, montarTexto, camposDeRetorno } = require('./retorno-handoff');
const { pediuDescadastro, camposDeDescadastro } = require('./descadastro');
const { linkDaConversa } = require('./link-whatsapp');
const { appendLeadRow } = require('./sheets');
const assistente = require('./assistente');
const { explicarErroMeta } = require('./erros-meta');

// Envio "seguro": se a chamada à API do WhatsApp falhar (token inválido,
// instabilidade, etc.), isso NUNCA deve impedir o estado do lead de ser
// salvo — senão perdemos o rastro da conversa. O erro fica só no log.
async function enviar(to, texto) {
  try {
    await sendText(to, texto);
    // Registrar o SUCESSO também, não só a falha. Sem esta linha, "nada no log"
    // significa duas coisas incompatíveis — a Meta aceitou o envio, ou o código
    // nem chegou a tentar — e não dá pra distinguir uma da outra. Foi
    // exatamente onde a investigação travou ao ligar o webhook.
    //
    // Sem o conteúdo: são mensagens de paciente sobre saúde mental, e o log da
    // Railway é visível pra quem tem acesso ao projeto. O tamanho basta pra
    // saber que saiu a mensagem certa.
    console.log(`[whatsapp] enviado para ${to} (${texto.length} caracteres)`);
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
  const campos = { historicoConversa: historicoConversa.slice(-40) };
  // Marca quando o PACIENTE falou pela última vez. É o relógio da janela de
  // 24h da Meta, e updatedAt não serve: ele também mexe quando quem escreve
  // é o bot, o que faria a janela parecer aberta depois de fechada.
  if (role === 'user') campos.ultimaEntradaEm = new Date().toISOString();
  return saveLead(phone, campos);
}

async function encaminharParaHumano(from, { texto, priority, notas, state = 'HANDOFF', ultimaMensagem }) {
  await enviar(from, texto);
  registrarTurno(from, 'assistant', texto);
  // handoffEm é o relógio do re-alerta (src/handoff-parado.js). Os contadores
  // são zerados aqui: um lead que volta a precisar de humano merece a mesma
  // insistência do primeiro handoff, não o saldo gasto no anterior.
  const campos = { state, notas };
  if (state === 'HANDOFF') {
    campos.handoffEm = new Date().toISOString();
    campos.atendidoEm = null;
    campos.realertasEnviados = 0;
    campos.ultimoRealertaEm = null;
  }
  const lead = saveLead(from, campos);
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

  // O estado decide todo o resto — inclusive os casos em que a automação fica
  // calada de propósito (HANDOFF/DESQUALIFICADO/CLIENTE). Sem isto no log, um
  // silêncio esperado é indistinguível de uma falha.
  //
  // "chegou com o lead em" e não "entrou em estado": esta linha reporta o
  // estado em que a mensagem ENCONTROU o lead, não uma transição. A redação
  // antiga dizia "entrou em estado HANDOFF" a cada mensagem de alguém que já
  // estava em HANDOFF há dias — e fez a gente procurar um bug de entrega
  // durante um bom tempo quando o sistema estava fazendo exatamente o que devia.
  console.log(`[flow] mensagem de ${from} chegou com o lead em estado ${lead.state}`);

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

  // PRIORIDADE 1.5 — pedido de descadastro.
  //
  // DEPOIS da crise, de propósito. Se a mensagem for sinal de risco, risco
  // ganha: ninguém é descadastrado no meio de um pedido de socorro. Na prática
  // as duas listas não se cruzam (descadastro exige a mensagem INTEIRA ser a
  // palavra), mas a ordem precisa estar certa de qualquer jeito.
  //
  // ANTES do silêncio de HANDOFF, também de propósito: quem está com o médico
  // e pede pra sair tem o mesmo direito de sair. Era o único caminho de saída
  // que a pessoa tinha, e ficava bloqueado justamente para quem mais tinha
  // motivo de usá-lo.
  if (pediuDescadastro(textoOriginal)) {
    const texto = messages.descadastroConfirmado();
    await enviar(from, texto);
    registrarTurno(from, 'assistant', texto);
    saveLead(from, camposDeDescadastro());
    console.log(`[descadastro] ${from} pediu para não receber mais mensagens — atendido`);
    await appendLeadRow(getLead(from));
    return;
  }

  // Pessoa já descadastrada que volta a escrever. A automação não reage por
  // conta própria: o consentimento foi revogado, e um bot que volta a falar
  // sozinho depois de "pare" é exatamente o que a pessoa pediu para não
  // acontecer. Mas também não pode ser buraco negro — se ela está escrevendo,
  // quer alguma coisa. Quem decide é o médico, pelo botão Reativar.
  if (lead.state === 'DESCADASTRADO') {
    console.log(`[descadastro] ${from} voltou a escrever depois de se descadastrar — avisando`);
    await telegram.enviarAlerta(
      `✉️ DESCADASTRADO VOLTOU A ESCREVER\n` +
        `Telefone: ${from}\n` +
        (linkDaConversa(from) ? `Abrir conversa: ${linkDaConversa(from)}\n` : '') +
        `\nEsta pessoa pediu para não receber mais mensagens, então a automação não respondeu.\n` +
        `Mensagem: "${textoOriginal}"`
    );
    await appendLeadRow(getLead(from));
    return;
  }

  // PRIORIDADE 2 — o que a assistente NÃO resolve, por palavra-chave.
  //
  // Esta lista encolheu muito. Antes pegava "pix", "cartao", "quanto custa" e
  // "qual o endereco" — ou seja, encaminhava quem só queria uma informação que
  // o consultório tem. Agora a assistente responde isso (ver consultorio.js), e
  // aqui ficou só o que é de fato do humano: fechar um programa, e marcar.
  if (isBuyingSignal(textoOriginal)) {
    const precoDoPlano = isPrecoDoPlano(textoOriginal);
    await encaminharParaHumano(from, {
      texto: precoDoPlano ? messages.handoffValor() : messages.handoffAgendamento(),
      priority: 'INTENÇÃO DE COMPRA',
      notas: precoDoPlano
        ? 'Perguntou o valor do programa de acompanhamento'
        : isPedidoDeAgendamento(textoOriginal)
          ? 'Quer marcar consulta'
          : 'Interesse em fechar programa de acompanhamento',
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

    // Calada para o paciente, sim. Calada para o médico também, não: alguém em
    // HANDOFF que volta a escrever está esperando agora, e até aqui isso só
    // virava linha de log.
    const plano = planejarAvisoDeRetorno(lead);
    if (plano.avisar) {
      const texto = montarTexto(lead, textoOriginal, plano);
      console.log(
        `[retorno] ${from} voltou a escrever em HANDOFF${plano.risco ? ' (RISCO)' : ''} — ` +
          `avisando (${(textoOriginal || '').length} caracteres)`
      );
      const entregue = await telegram.enviarAlerta(texto);
      if (!entregue) {
        console.warn(`[retorno] ⚠️  NINGUÉM FOI AVISADO de que ${from} voltou a escrever.`);
      } else {
        // Só grava depois de entregue: marcar um aviso que não saiu faria a
        // janela de agrupamento engolir os próximos dez minutos em silêncio.
        saveLead(from, camposDeRetorno());
      }
    }

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

  // A assistente admitiu que não sabe. Vale um handoff de prioridade mais
  // baixa que compra: é dúvida, não venda — mas continua sendo alguém
  // esperando resposta, e o médico precisa saber o que foi perguntado.
  if (ia.intencao === 'nao_sei') {
    await encaminharParaHumano(from, {
      texto: messages.handoffNaoSei(),
      priority: 'DÚVIDA QUE A ASSISTENTE NÃO SOUBE',
      notas: 'A assistente não tinha a informação e não inventou',
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
