const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

// O roteiro fixo (pedido do Dr. Jesrryel, 26/10/2026): motivo -> histórico -> formato ->
// programas -> "programas ou consulta?". A IA só responde dúvida e o roteiro é retomado no
// mesmo ponto. Quem quer saber mais dos programas chega ao médico; quem quer consulta já
// recebe os horários.
function montar({ agenda = true, ocupados = [] } = {}) {
  process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'rot-'));
  delete process.env.ANTHROPIC_API_KEY;
  process.env.GOOGLE_CALENDAR_ID = 'agenda@exemplo.com';
  process.env.GOOGLE_SERVICE_ACCOUNT_CREDENTIALS = JSON.stringify({
    client_email: 'bot@exemplo.iam.gserviceaccount.com',
    private_key: '-----BEGIN PRIVATE KEY-----\nfalsa\n-----END PRIVATE KEY-----\n',
  });
  for (const m of ['../src/state', '../src/telegram', '../src/flow', '../src/whatsapp', '../src/sheets',
    '../src/alert', '../src/google-agenda', '../src/agendamento', '../src/vagas', '../src/agenda',
    '../src/google-credenciais', '../src/messages', '../src/freio']) {
    delete require.cache[require.resolve(m)];
  }
  require('../src/funil-escrita').gravarNoFunil = async () => {};   // sem rede: o FUNIL tem teste próprio
  // O freio (teto de mensagens por minuto) tem teste próprio; aqui o teste conversa rápido demais.
  require('../src/freio').registrarEnvio = () => ({ liberado: true, enviadas: 0 });
  const avisos = [];
  require('../src/telegram').enviarAlerta = async (t) => { avisos.push(t); return true; };
  const enviados = [];
  require('../src/whatsapp').sendText = async (to, body) => { enviados.push(body); return {}; };
  require('../src/sheets').appendLeadRow = async () => {};
  const g = require('../src/google-agenda');
  g.ocupados = async () => ocupados;
  g.marcar = async () => ({ ok: true, link: 'https://x', id: 'e' });
  g.configurado = () => agenda;
  return {
    flow: require('../src/flow'), state: require('../src/state'),
    messages: require('../src/messages'), enviados, avisos,
  };
}

const FONE = '558499990001';
const ia = (over = {}) => ({
  intencao: 'conversando', resposta: 'Atendemos de segunda a sábado.', motivo: '', historico: '',
  formato: '', classificacao: '', qualificacaoCompleta: false, fezPergunta: false, ...over,
});

test('a ordem: saudação com nome -> motivo -> cidade -> formato -> programas + consulta avulsa', async () => {
  const { flow, state, messages, enviados } = montar();
  await flow.handleIncomingMessage({ from: FONE, text: 'oi', nome: 'Ana Souza' });
  assert.equal(state.getLead(FONE).state, 'AGUARDANDO_MOTIVO');
  assert.match(enviados[0], /^(Bom dia|Boa tarde|Boa noite), Ana! Aqui é do consultório/);
  assert.ok(enviados[0].includes(messages.boasVindas()));

  await flow.handleIncomingMessage({ from: FONE, text: 'ansiedade no trabalho' });
  assert.equal(state.getLead(FONE).state, 'AGUARDANDO_CIDADE');
  assert.equal(state.getLead(FONE).motivo, 'ansiedade no trabalho');
  assert.equal(enviados[1], messages.perguntaCidade());

  await flow.handleIncomingMessage({ from: FONE, text: 'Mossoró' });
  assert.equal(state.getLead(FONE).state, 'AGUARDANDO_FORMATO');
  assert.equal(state.getLead(FONE).cidade, 'Mossoró');
  assert.equal(enviados[2], messages.perguntaFormato());
  assert.match(enviados[2], /consulta presencial ou online\?/);

  await flow.handleIncomingMessage({ from: FONE, text: 'prefiro online' });
  const lead = state.getLead(FONE);
  assert.equal(lead.state, 'CATALOGO_ENVIADO');
  assert.equal(lead.formato, 'Online');
  assert.ok(lead.followupsAgendados);
  assert.match(enviados[3], /Recomeço/);
  assert.match(enviados[3], /Constância/);
  assert.match(enviados[3], /consulta avulsa/);
  assert.match(enviados[3], /programas de acompanhamento, ou a consulta avulsa\?$/);
});

test('quem já estava na etapa de histórico (que saiu do roteiro) segue para a cidade', async () => {
  const { flow, state, messages, enviados } = montar();
  state.createLeadIfMissing(FONE);
  state.saveLead(FONE, { state: 'AGUARDANDO_HISTORICO', motivo: 'insônia' });
  await flow.handleIncomingMessage({ from: FONE, text: 'primeira vez' });
  assert.equal(state.getLead(FONE).state, 'AGUARDANDO_CIDADE');
  assert.equal(state.getLead(FONE).historico, 'primeira vez');
  assert.ok(enviados[0].endsWith(messages.perguntaCidade()));
});

test('normalizarFormato: só Online/Presencial exatos; o resto fica como a pessoa disse', () => {
  const { flow } = montar();
  assert.equal(flow.normalizarFormato('online'), 'Online');
  assert.equal(flow.normalizarFormato('Prefiro por vídeo'), 'Online');
  assert.equal(flow.normalizarFormato('presencial mesmo'), 'Presencial');
  assert.equal(flow.normalizarFormato('no consultório'), 'Presencial');
  assert.equal(flow.normalizarFormato('tanto faz'), 'tanto faz');
  assert.equal(flow.normalizarFormato('presencial ou online'), 'presencial ou online');
});

test('dúvida no meio do roteiro: a IA responde e o roteiro volta ao MESMO ponto', async () => {
  const { flow, state, messages, enviados } = montar();
  state.createLeadIfMissing(FONE);
  state.saveLead(FONE, { state: 'AGUARDANDO_CIDADE', motivo: 'insônia' });

  await flow.aplicarRespostaDaIA(FONE, state.getLead(FONE),
    ia({ fezPergunta: true, resposta: 'Atendemos de segunda a sábado.' }), 'que horas vocês atendem?');

  const lead = state.getLead(FONE);
  assert.equal(lead.state, 'AGUARDANDO_CIDADE', 'a dúvida avançou o roteiro');
  assert.ok(!lead.cidade, 'a pergunta virou resposta da cidade');
  assert.ok(enviados[0].includes('Atendemos de segunda a sábado.'));
  assert.ok(enviados[0].endsWith(messages.perguntaCidade()));
});

test('dúvida logo na primeira mensagem: responde e já faz a primeira pergunta do roteiro', async () => {
  const { flow, state, messages, enviados } = montar();
  state.createLeadIfMissing(FONE);
  await flow.aplicarRespostaDaIA(FONE, state.getLead(FONE),
    ia({ fezPergunta: true, resposta: 'A consulta custa o valor tal.' }), 'quanto custa a consulta?');
  assert.equal(state.getLead(FONE).state, 'AGUARDANDO_MOTIVO');
  assert.ok(enviados[0].endsWith(messages.perguntaMotivo()));
});

test('sem pergunta, a IA não improvisa: segue o texto fixo do roteiro', async () => {
  const { flow, state, messages, enviados } = montar();
  state.createLeadIfMissing(FONE);
  state.saveLead(FONE, { state: 'AGUARDANDO_MOTIVO' });
  await flow.aplicarRespostaDaIA(FONE, state.getLead(FONE),
    ia({ resposta: 'Texto livre da IA que NÃO deve sair' }), 'tristeza');
  assert.ok(enviados[0].includes(messages.perguntaCidade()));
  assert.ok(!enviados[0].includes('Texto livre da IA'));
});

test('quer saber mais dos programas: avisa o médico (Telegram) e passa a conversa', async () => {
  const { flow, state, enviados, avisos } = montar();
  state.createLeadIfMissing(FONE);
  state.saveLead(FONE, { state: 'CATALOGO_ENVIADO', nome: 'Ana' });
  await flow.handleIncomingMessage({ from: FONE, text: 'quero conhecer melhor os programas' });

  const lead = state.getLead(FONE);
  assert.equal(lead.state, 'HANDOFF');
  assert.equal(lead.escolha, 'Programa');
  assert.match(enviados[0], /Dr\. Jesrryel/);
  assert.equal(avisos.length, 1);
  assert.match(avisos[0], /QUER SABER MAIS DOS PROGRAMAS/);
});

test('quer consulta: recebe os horários na hora (sem esperar o médico), sem aviso', async () => {
  const { flow, state, enviados, avisos } = montar();
  state.createLeadIfMissing(FONE);
  state.saveLead(FONE, { state: 'CATALOGO_ENVIADO', formato: 'Online' });
  await flow.handleIncomingMessage({ from: FONE, text: 'prefiro a consulta avulsa' });

  // 1ª mensagem: como funciona (sem valor, que só sai quando perguntam); 2ª: os horários.
  assert.match(enviados[0], /Consulta:\* dura cerca de 1 hora/);
  assert.match(enviados[0], /Online:\*/);
  assert.doesNotMatch(enviados[0], /Presencial:\*/, 'mostrou o presencial a quem escolheu online');
  assert.doesNotMatch(enviados[0], /R\$/);
  assert.match(enviados[1], /\*1\.\*/);
  assert.match(enviados[1], /\*3\.\*/);
  const lead = state.getLead(FONE);
  assert.equal(lead.escolha, 'Consulta');
  assert.equal(lead.vagasOferecidas.horarios.length, 3);
  assert.notEqual(lead.state, 'HANDOFF');
  assert.equal(avisos.length, 0);
});

test('escolher o número do horário marca a consulta', async () => {
  const { flow, state, enviados } = montar();
  state.createLeadIfMissing(FONE);
  state.saveLead(FONE, { state: 'CATALOGO_ENVIADO', formato: 'Online' });
  await flow.handleIncomingMessage({ from: FONE, text: 'quero marcar consulta' });
  await flow.handleIncomingMessage({ from: FONE, text: '2' });
  assert.match(enviados[enviados.length - 1], /marquei/i);
  assert.ok(state.getLead(FONE).consultaEm);
});

test('quer consulta mas a agenda está desligada: o médico é avisado em vez de ficar sem resposta', async () => {
  const { flow, state, avisos } = montar({ agenda: false });
  state.createLeadIfMissing(FONE);
  state.saveLead(FONE, { state: 'CATALOGO_ENVIADO' });
  await flow.fluxoDeterministico(FONE, state.getLead(FONE), 'agendar consulta');
  assert.equal(state.getLead(FONE).state, 'HANDOFF');
  assert.equal(avisos.length, 1);
});

test('resposta que não diz o caminho: repete só a última pergunta', async () => {
  const { flow, state, messages, enviados } = montar();
  state.createLeadIfMissing(FONE);
  state.saveLead(FONE, { state: 'CATALOGO_ENVIADO' });
  await flow.fluxoDeterministico(FONE, state.getLead(FONE), 'hmm não sei');
  assert.ok(enviados[0].includes(messages.perguntaEscolha()));
  assert.equal(state.getLead(FONE).state, 'CATALOGO_ENVIADO');
  assert.ok(!state.getLead(FONE).escolha);
});

test('interpretarEscolha: programa ganha quando cita os dois; sem pista é null', () => {
  const { flow } = montar();
  assert.equal(flow.interpretarEscolha('os programas'), 'programa');
  assert.equal(flow.interpretarEscolha('Recomeço'), 'programa');
  assert.equal(flow.interpretarEscolha('quero saber mais'), 'programa');
  assert.equal(flow.interpretarEscolha('agendar consulta'), 'consulta');
  assert.equal(flow.interpretarEscolha('a avulsa'), 'consulta');
  assert.equal(flow.interpretarEscolha('Consulta, por favor'), 'consulta');
  assert.equal(flow.interpretarEscolha('consulta ou programa?'), 'programa');
  assert.equal(flow.interpretarEscolha('não sei'), null);
  assert.equal(flow.interpretarEscolha(''), null);
});

test('emRoteiro: só as etapas do roteiro; depois da escolha a conversa sai dele', () => {
  const { flow } = montar();
  for (const s of ['NOVO', 'AGUARDANDO_MOTIVO', 'AGUARDANDO_HISTORICO', 'AGUARDANDO_FORMATO']) {
    assert.equal(flow.emRoteiro({ state: s }), true, s);
  }
  assert.equal(flow.emRoteiro({ state: 'CATALOGO_ENVIADO' }), true);
  assert.equal(flow.emRoteiro({ state: 'CATALOGO_ENVIADO', escolha: 'Consulta' }), false);
  assert.equal(flow.emRoteiro({ state: 'HANDOFF' }), false);
  assert.equal(flow.emRoteiro({ state: 'FOLLOWUP_D3' }), false);
  assert.equal(flow.emRoteiro(null), false);
});

test('a IA que pede os programas (compra) também avisa o médico', async () => {
  const { flow, state, avisos } = montar();
  state.createLeadIfMissing(FONE);
  state.saveLead(FONE, { state: 'AGUARDANDO_FORMATO' });
  await flow.aplicarRespostaDaIA(FONE, state.getLead(FONE), ia({ intencao: 'compra' }), 'como funciona o Recomeço por dentro?');
  assert.equal(state.getLead(FONE).state, 'HANDOFF');
  assert.equal(avisos.length, 1);
});
