const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { montarConversa } = require('../src/conversa');

test('traduz quem falou — "assistant" na tela não diz nada', () => {
  const c = montarConversa({
    phone: '558499687397',
    historicoConversa: [
      { role: 'user', content: 'oi, queria marcar' },
      { role: 'assistant', content: 'Oi! Posso te ajudar.' },
      { role: 'assistant', content: 'Aqui é o Dr. Jesrryel.', autor: 'medico' },
    ],
  });
  assert.deepEqual(c.turnos.map((t) => t.quem), ['paciente', 'assistente', 'medico']);
  assert.match(c.turnos[2].rotulo, /você/i, 'a fala do médico tem que se distinguir da do bot');
});

// Gravar a hora de agora num turno antigo seria dizer que o paciente falou
// aquilo neste minuto. Numa conversa clínica isso não é detalhe de formatação.
test('turno sem hora registrada devolve null, não a hora de agora', () => {
  const c = montarConversa({
    phone: '55849',
    historicoConversa: [{ role: 'user', content: 'antigo' }],
  });
  assert.equal(c.turnos[0].em, null);
});

test('turno novo carrega a hora', () => {
  const em = '2026-10-14T13:20:00.000Z';
  const c = montarConversa({
    phone: '55849',
    historicoConversa: [{ role: 'user', content: 'oi', em }],
  });
  assert.equal(c.turnos[0].em, em);
});

test('turno sem conteúdo não entra — viraria bolha vazia na tela', () => {
  const c = montarConversa({
    phone: '55849',
    historicoConversa: [
      { role: 'user', content: 'oi' },
      { role: 'assistant', content: '' },
      null,
      { role: 'assistant' },
    ],
  });
  assert.equal(c.turnos.length, 1);
});

test('lead inexistente devolve null — a rota responde 404 com isso', () => {
  assert.equal(montarConversa(null), null);
});

test('avisa quando a conversa foi cortada, pra ninguém achar que ela começou ali', () => {
  const muitos = Array.from({ length: 40 }, (_, i) => ({ role: 'user', content: `m${i}` }));
  assert.equal(montarConversa({ phone: '1', historicoConversa: muitos }).truncada, true);
  assert.equal(montarConversa({ phone: '1', historicoConversa: muitos.slice(0, 5) }).truncada, false);
});

// A rota existe justamente porque o conteúdo não está em lugar nenhum visível.
// Mas o log da Railway continua sendo um servidor de terceiro: o texto do
// paciente não pode aparecer nele nem quando o médico abre a conversa.
function montarRota() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'conv-'));
  process.env.DATA_DIR = dir;
  process.env.DASHBOARD_TOKEN = 'senha-longa-de-teste';
  for (const m of ['../src/state', '../src/dashboard']) {
    delete require.cache[require.resolve(m)];
  }
  const state = require('../src/state');
  const dashboard = require('../src/dashboard');
  return { state, dashboard };
}

function chamar(router, phone) {
  return new Promise((resolve) => {
    const req = {
      method: 'GET',
      params: { phone },
      get: () => 'senha-longa-de-teste',
      query: {},
    };
    const res = {
      statusCode: 200,
      status(c) { this.statusCode = c; return this; },
      json(corpo) { resolve({ status: this.statusCode, corpo }); },
    };
    const camada = router.stack.find(
      (c) => c.route && c.route.path === '/api/leads/:phone/conversa'
    );
    const handlers = camada.route.stack.map((s) => s.handle);
    const proximo = (i) => (i >= handlers.length ? null : handlers[i](req, res, () => proximo(i + 1)));
    proximo(0);
  });
}

test('a rota devolve a conversa e não escreve o texto no log', async () => {
  const { state, dashboard } = montarRota();
  const segredo = 'faz meses que eu nao durmo direito';
  state.saveLead('558499687397', {
    state: 'HANDOFF',
    historicoConversa: [{ role: 'user', content: segredo }],
  });

  const linhas = [];
  const original = console.log;
  console.log = (...args) => linhas.push(args.join(' '));
  let r;
  try {
    r = await chamar(dashboard.criarRouter(), '558499687397');
  } finally {
    console.log = original;
  }

  assert.equal(r.status, 200);
  assert.equal(r.corpo.turnos[0].texto, segredo);
  const tudo = linhas.join('\n');
  assert.doesNotMatch(tudo, /nao durmo/, 'o texto do paciente não pode ir pro log');
  assert.match(tudo, /conversa de 558499687397 aberta/, 'mas o acesso tem que ficar registrado');
});

test('conversa de lead que não existe é 404', async () => {
  const { dashboard } = montarRota();
  const r = await chamar(dashboard.criarRouter(), '550000000000');
  assert.equal(r.status, 404);
});

test('sem token a conversa não sai', async () => {
  const { state, dashboard } = montarRota();
  state.saveLead('558499687397', { historicoConversa: [{ role: 'user', content: 'oi' }] });
  const router = dashboard.criarRouter();
  const camada = router.stack.find((c) => c.route && c.route.path === '/api/leads/:phone/conversa');
  const handlers = camada.route.stack.map((s) => s.handle);
  const r = await new Promise((resolve) => {
    const req = { params: { phone: '558499687397' }, get: () => null, query: {} };
    const res = {
      statusCode: 200,
      status(c) { this.statusCode = c; return this; },
      json(corpo) { resolve({ status: this.statusCode, corpo }); },
    };
    const proximo = (i) => (i >= handlers.length ? null : handlers[i](req, res, () => proximo(i + 1)));
    proximo(0);
  });
  assert.equal(r.status, 401);
});
