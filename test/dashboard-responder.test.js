const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

// Rota inteira, com a Meta e o disco trocados por dublês: o que importa aqui é
// que nada seja gravado quando o envio falha, e que o estado do lead não mude.
function montar({ falhaNoEnvio } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'resp-'));
  process.env.DATA_DIR = dir;
  process.env.DASHBOARD_TOKEN = 'senha-longa-de-teste';

  for (const m of ['../src/state', '../src/dashboard', '../src/whatsapp', '../src/responder']) {
    delete require.cache[require.resolve(m)];
  }

  const whatsapp = require('../src/whatsapp');
  const enviados = [];
  whatsapp.sendText = async (to, body) => {
    enviados.push({ to, body });
    if (falhaNoEnvio) {
      const err = new Error('Request failed');
      err.response = { data: { error: { code: 131047, message: 'Re-engagement message' } } };
      throw err;
    }
    return {};
  };

  const state = require('../src/state');
  const dashboard = require('../src/dashboard');
  return { dir, state, dashboard, enviados };
}

function chamar(router, phone, texto) {
  return new Promise((resolve) => {
    const req = {
      method: 'POST',
      url: `/api/leads/${phone}/responder`,
      params: { phone },
      body: { texto },
      get: () => 'senha-longa-de-teste',
      query: {},
    };
    const res = {
      statusCode: 200,
      status(c) { this.statusCode = c; return this; },
      json(corpo) { resolve({ status: this.statusCode, corpo }); },
    };
    const camada = router.stack.find(
      (c) => c.route && c.route.path === '/api/leads/:phone/responder'
    );
    const handlers = camada.route.stack.map((s) => s.handle);
    const proximo = (i) => (i >= handlers.length ? null : handlers[i](req, res, () => proximo(i + 1)));
    proximo(0);
  });
}

test('a resposta sai pelo número do consultório e entra no histórico', async () => {
  const { state, dashboard, enviados } = montar();
  state.saveLead('558499687397', { state: 'HANDOFF', ultimaEntradaEm: new Date().toISOString() });

  const r = await chamar(dashboard.criarRouter(), '558499687397', 'Oi, é o Dr. Jesrryel.');
  assert.equal(r.status, 200);
  assert.deepEqual(enviados, [{ to: '558499687397', body: 'Oi, é o Dr. Jesrryel.' }]);

  const lead = state.getLead('558499687397');
  const ultima = lead.historicoConversa[lead.historicoConversa.length - 1];
  assert.equal(ultima.content, 'Oi, é o Dr. Jesrryel.');
  assert.equal(ultima.autor, 'medico', 'precisa dar pra distinguir do que o bot falou');
});

// Responder não devolve a conversa para a automação — para isso existe o
// Reativar. Se o estado voltasse, o bot atropelaria o médico no meio.
test('responder não tira o lead do HANDOFF', async () => {
  const { state, dashboard } = montar();
  state.saveLead('558499687397', { state: 'HANDOFF', ultimaEntradaEm: new Date().toISOString() });
  await chamar(dashboard.criarRouter(), '558499687397', 'oi');
  assert.equal(state.getLead('558499687397').state, 'HANDOFF');
});

test('envio que falhou não vira histórico — senão o médico acha que respondeu', async () => {
  const { state, dashboard } = montar({ falhaNoEnvio: true });
  state.saveLead('558499687397', { state: 'HANDOFF', ultimaEntradaEm: new Date().toISOString() });

  const r = await chamar(dashboard.criarRouter(), '558499687397', 'oi');
  assert.equal(r.status, 502);
  assert.match(r.corpo.erro, /24h|janela|template/i, `erro cru demais: ${r.corpo.erro}`);
  assert.equal((state.getLead('558499687397').historicoConversa || []).length, 0);
});

test('o texto da resposta não vai para o log', async () => {
  const { state, dashboard } = montar();
  state.saveLead('558499687397', { state: 'HANDOFF', ultimaEntradaEm: new Date().toISOString() });

  const original = console.log;
  const linhas = [];
  console.log = (...a) => linhas.push(a.join(' '));
  try {
    await chamar(dashboard.criarRouter(), '558499687397', 'seu exame deu alterado');
  } finally {
    console.log = original;
  }
  assert.doesNotMatch(linhas.join('\n'), /exame deu alterado/);
});
