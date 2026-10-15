const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

// A conversa inteira: "quero marcar" → três opções → "2" → marcado.
// É onde as peças se encontram, e onde um erro vira consulta errada de verdade.
function montar({ ocupados = [], marcarFalha = false } = {}) {
  process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'ag-'));
  process.env.GOOGLE_CALENDAR_ID = 'agenda@exemplo.com';
  process.env.GOOGLE_SERVICE_ACCOUNT_CREDENTIALS = JSON.stringify({
    client_email: 'bot@exemplo.iam.gserviceaccount.com',
    private_key: '-----BEGIN PRIVATE KEY-----\nfalsa\n-----END PRIVATE KEY-----\n',
  });
  delete process.env.ANTHROPIC_API_KEY; // só o caminho determinístico
  for (const m of ['../src/state', '../src/telegram', '../src/flow', '../src/whatsapp',
    '../src/sheets', '../src/alert', '../src/google-agenda', '../src/agendamento',
    '../src/vagas', '../src/agenda', '../src/google-credenciais']) {
    delete require.cache[require.resolve(m)];
  }
  const avisos = [];
  require('../src/telegram').enviarAlerta = async (t) => { avisos.push(t); return true; };
  const enviados = [];
  require('../src/whatsapp').sendText = async (to, body) => { enviados.push(body); return {}; };
  require('../src/sheets').appendLeadRow = async () => {};
  const criados = [];
  const g = require('../src/google-agenda');
  g.ocupados = async () => ocupados;
  g.marcar = async (req) => {
    criados.push(req);
    return marcarFalha ? { ok: false, erro: 'The caller does not have permission' }
      : { ok: true, link: 'https://calendar.google.com/evento', id: 'ev1' };
  };
  g.configurado = () => true;
  return { state: require('../src/state'), flow: require('../src/flow'), enviados, avisos, criados };
}

const FONE = '558499687397';

test('quem quer marcar recebe três horários numerados, não uma promessa', async () => {
  const { flow, enviados, state } = montar();
  await flow.handleIncomingMessage({ from: FONE, text: 'quero agendar' });

  assert.equal(enviados.length, 1);
  assert.match(enviados[0], /\*1\.\*/);
  assert.match(enviados[0], /\*2\.\*/);
  assert.match(enviados[0], /\*3\.\*/);
  // O texto antigo mandava esperar o médico chamar. Agora resolve na hora.
  assert.doesNotMatch(enviados[0], /vou avisar|já estou avisando/i);
  assert.equal(state.getLead(FONE).vagasOferecidas.horarios.length, 3);
});

test('o paciente responde o número e a consulta é criada de verdade', async () => {
  const { flow, enviados, criados, state } = montar();
  await flow.handleIncomingMessage({ from: FONE, text: 'quero agendar' });
  await flow.handleIncomingMessage({ from: FONE, text: '2' });

  assert.equal(criados.length, 1, 'não criou o compromisso');
  assert.match(enviados[1], /marquei/i);

  // O horário criado é o MESMO que foi oferecido na posição 2 — não o 1, não
  // um recalculado. Conferir isso é o ponto do teste.
  const oferecidoNaPosicao2 = state.getLead(FONE).consultaEm;
  assert.equal(criados[0].inicio.toISOString(), oferecidoNaPosicao2);
  assert.equal(state.getLead(FONE).vagasOferecidas, null, 'deixou a oferta pendurada');
});

test('o médico é avisado do que foi marcado', async () => {
  const { flow, avisos } = montar();
  await flow.handleIncomingMessage({ from: FONE, text: 'quero agendar' });
  await flow.handleIncomingMessage({ from: FONE, text: '2' });

  const aviso = avisos.find((a) => /CONSULTA MARCADA/.test(a));
  assert.ok(aviso, 'marcou e não avisou ninguém');
  assert.match(aviso, new RegExp(FONE));
});

// Entre a oferta e a resposta cabe um paciente inteiro. Marcar dois na mesma
// hora é o erro que não dá para desfazer sem alguém ficar sem vaga.
test('horário ocupado entre a oferta e a resposta não é marcado', async () => {
  const { flow, state, enviados, criados, avisos } = montar();
  await flow.handleIncomingMessage({ from: FONE, text: 'quero agendar' });

  const escolhido = state.getLead(FONE).vagasOferecidas.horarios[1];
  const g = require('../src/google-agenda');
  g.ocupados = async () => [{
    inicio: escolhido,
    fim: new Date(new Date(escolhido).getTime() + 60 * 60000).toISOString(),
  }];

  await flow.handleIncomingMessage({ from: FONE, text: '2' });

  assert.equal(criados.length, 0, 'marcou em cima de quem já estava lá');
  assert.match(enviados[1], /preenchido/i);
  assert.ok(avisos.some((a) => /HANDOFF/.test(a)), 'falhou e não chamou o humano');
});

test('resposta que não dá pra entender pede o número de novo, sem marcar nada', async () => {
  const { flow, enviados, criados, state } = montar();
  await flow.handleIncomingMessage({ from: FONE, text: 'quero agendar' });
  await flow.handleIncomingMessage({ from: FONE, text: 'pode ser 1 ou 2?' });

  assert.equal(criados.length, 0);
  assert.match(enviados[1], /número/i);
  assert.ok(state.getLead(FONE).vagasOferecidas, 'jogou a oferta fora por não entender');
});

// Falhar ao marcar é culpa do sistema, não da pessoa. Ela tentou e não
// conseguiu — isso precisa virar um humano, não uma mensagem e silêncio.
test('falha ao criar o compromisso vira handoff', async () => {
  const { flow, enviados, avisos } = montar({ marcarFalha: true });
  await flow.handleIncomingMessage({ from: FONE, text: 'quero agendar' });
  await flow.handleIncomingMessage({ from: FONE, text: '2' });

  assert.match(enviados[1], /Dr\. Jesrryel/);
  assert.ok(avisos.some((a) => /AGENDAMENTO FALHOU/.test(a)));
});

// Valor de programa continua sendo conversa do médico — é a regra dele, e é a
// conversa em que o preço é justificado.
test('pergunta de valor do programa não vira oferta de horário', async () => {
  const { flow, enviados, state } = montar();
  await flow.handleIncomingMessage({ from: FONE, text: 'quanto custa o Recomeço?' });
  assert.doesNotMatch(enviados[0], /\*1\.\*/);
  assert.equal(state.getLead(FONE).state, 'HANDOFF');
});

// A IA tem um desfecho próprio para agendamento desde 15/10/2026. Antes,
// "pode ser quinta?" caía em `compra` e ia parar na fila do médico — que é
// exatamente a sobrecarga que ele pediu para resolver.
test('a IA tem um desfecho só para agendar, separado de compra', () => {
  const { systemPrompt } = require('../src/assistente');
  const p = systemPrompt();
  assert.match(p, /`agendar`/);
  assert.match(p, /Não prometa horário nenhum/);
  // E compra passou a ser só o que de fato é dele: o programa.
  assert.match(p, /única coisa que vai para o Dr\. Jesrryel/);
});

test('intenção agendar da IA oferece horários em vez de chamar o médico', async () => {
  const { flow, enviados, state } = montar();
  const { aplicarRespostaDaIA } = flow;
  state.createLeadIfMissing(FONE);
  await aplicarRespostaDaIA(FONE, state.getLead(FONE), {
    intencao: 'agendar', resposta: 'ignorado', motivo: '', historico: '', formato: '', classificacao: '',
  }, 'pode ser quinta?');

  assert.match(enviados[0], /\*1\.\*/);
  assert.notEqual(state.getLead(FONE).state, 'HANDOFF');
});

test('intenção compra da IA continua indo para o médico', async () => {
  const { flow, state } = montar();
  const { aplicarRespostaDaIA } = flow;
  state.createLeadIfMissing(FONE);
  await aplicarRespostaDaIA(FONE, state.getLead(FONE), {
    intencao: 'compra', resposta: 'ignorado', motivo: '', historico: '', formato: '', classificacao: '',
  }, 'quero contratar o Recomeço');

  assert.equal(state.getLead(FONE).state, 'HANDOFF');
});
