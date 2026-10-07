const test = require('node:test');
const assert = require('node:assert');

function comToken(valor, fn) {
  const antes = process.env.DASHBOARD_TOKEN;
  process.env.DASHBOARD_TOKEN = valor;
  delete require.cache[require.resolve('../src/dashboard')];
  try { return fn(require('../src/dashboard')); } finally {
    if (antes === undefined) delete process.env.DASHBOARD_TOKEN;
    else process.env.DASHBOARD_TOKEN = antes;
  }
}

function chamar(dashboard, tokenNaUrl) {
  return new Promise((resolve) => {
    const req = { query: tokenNaUrl === undefined ? {} : { token: tokenNaUrl }, get: () => undefined };
    const res = {
      statusCode: 200,
      status(c) { this.statusCode = c; return this; },
      json(corpo) { resolve({ status: this.statusCode, corpo }); },
    };
    const camada = dashboard.criarRouter().stack.find((c) => c.route && c.route.path === '/api/leads');
    const handlers = camada.route.stack.map((h) => h.handle);
    handlers[0](req, res, () => resolve({ status: 200, corpo: { passou: true } }));
  });
}

test('a senha correta passa', async () => {
  await comToken('senha-longa-de-teste', async (d) => {
    const r = await chamar(d, 'senha-longa-de-teste');
    assert.equal(r.corpo.passou, true);
  });
});

// Um espaço sobrando no valor colado no painel da Railway derrubava o acesso
// com "token inválido", e não havia como descobrir olhando a tela: os dois
// valores parecem idênticos.
test('espaço sobrando dos dois lados não derruba mais o acesso', async () => {
  await comToken('  senha-longa-de-teste  ', async (d) => {
    assert.equal((await chamar(d, 'senha-longa-de-teste')).corpo.passou, true);
  });
  await comToken('senha-longa-de-teste', async (d) => {
    assert.equal((await chamar(d, ' senha-longa-de-teste\n')).corpo.passou, true);
  });
});

test('senha errada continua sendo recusada', async () => {
  await comToken('senha-longa-de-teste', async (d) => {
    const r = await chamar(d, 'outra-senha-qualquer');
    assert.equal(r.status, 401);
  });
});

// Aparar não pode virar porta aberta: espaços de um lado e nada do outro
// precisa continuar sendo recusa.
test('token só de espaços não passa', async () => {
  await comToken('senha-longa-de-teste', async (d) => {
    assert.equal((await chamar(d, '     ')).status, 401);
  });
  await comToken('   ', async (d) => {
    assert.equal((await chamar(d, '   ')).status, 401);
  });
});

// "inválido" sozinho não ajuda: os dois valores parecem iguais na tela.
test('a recusa diz as duas causas reais', async () => {
  await comToken('senha-longa-de-teste', async (d) => {
    const r = await chamar(d, 'errada');
    assert.match(r.corpo.comoResolver, /#/, 'não avisa do caractere que o navegador corta');
    assert.match(r.corpo.comoResolver, /espaço/i);
  });
});

test('token ausente é dito como ausente, não como errado', async () => {
  await comToken('senha-longa-de-teste', async (d) => {
    const r = await chamar(d, undefined);
    assert.equal(r.status, 401);
    assert.match(r.corpo.erro, /ausente/);
  });
});
