const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const MIN = 60000;
const TARDE = new Date('2026-10-04T17:00:00Z');

function montar({ telegramFalha } = {}) {
  process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'hp-'));
  process.env.DASHBOARD_TOKEN = 'senha-longa-de-teste';
  for (const m of ['../src/state', '../src/telegram', '../src/handoff-parado', '../src/dashboard']) {
    delete require.cache[require.resolve(m)];
  }
  const telegram = require('../src/telegram');
  const enviados = [];
  telegram.enviarAlerta = async (texto) => {
    enviados.push(texto);
    return !telegramFalha;
  };
  return {
    state: require('../src/state'),
    hp: require('../src/handoff-parado'),
    dashboard: require('../src/dashboard'),
    enviados,
  };
}

test('o re-alerta sai com o link e diz quanto tempo a pessoa está esperando', async () => {
  const { state, hp, enviados } = montar();
  state.saveLead('558499687397', {
    state: 'HANDOFF',
    notas: 'RISCO/CRISE',
    motivo: 'ansiedade',
    handoffEm: new Date(TARDE.getTime() - 90 * MIN).toISOString(),
  });

  assert.equal(await hp.checarHandoffsParados(TARDE), 1);
  assert.equal(enviados.length, 1);
  assert.match(enviados[0], /CRISE SEM RESPOSTA/);
  assert.match(enviados[0], /90 min/);
  assert.match(enviados[0], /https:\/\/wa\.me\/558499687397/);

  const lead = state.getLead('558499687397');
  assert.equal(lead.realertasEnviados, 1);
  assert.ok(lead.ultimoRealertaEm, 'precisa registrar quando avisou, senão repete no próximo ciclo');
});

// Contar um aviso que não saiu faria o sistema gastar o limite em silêncio e
// parar de insistir sem nunca ter avisado ninguém.
test('aviso que o Telegram não entregou não conta como enviado', async () => {
  const { state, hp } = montar({ telegramFalha: true });
  state.saveLead('558499687397', {
    state: 'HANDOFF',
    notas: 'RISCO/CRISE',
    handoffEm: new Date(TARDE.getTime() - 90 * MIN).toISOString(),
  });

  assert.equal(await hp.checarHandoffsParados(TARDE), 0);
  assert.equal(state.getLead('558499687397').realertasEnviados || 0, 0);
});

test('a frase do paciente não entra no re-alerta', async () => {
  const { state, hp, enviados } = montar();
  state.saveLead('558499687397', {
    state: 'HANDOFF',
    notas: 'RISCO/CRISE',
    handoffEm: new Date(TARDE.getTime() - 90 * MIN).toISOString(),
    historicoConversa: [{ role: 'user', content: 'nao vejo mais sentido em nada' }],
  });

  await hp.checarHandoffsParados(TARDE);
  // O alerta original já levou a frase. Repeti-la em cada re-alerta espalharia
  // a mensagem mais sensível do sistema por mais mensagens do que o necessário.
  assert.doesNotMatch(enviados.join('\n'), /nao vejo mais sentido/);
});

function chamarAtendido(router, phone) {
  return new Promise((resolve) => {
    const req = { params: { phone }, get: () => 'senha-longa-de-teste', query: {} };
    const res = {
      statusCode: 200,
      status(c) { this.statusCode = c; return this; },
      json(corpo) { resolve({ status: this.statusCode, corpo }); },
    };
    const camada = router.stack.find(
      (c) => c.route && c.route.path === '/api/leads/:phone/atendido'
    );
    const handlers = camada.route.stack.map((s) => s.handle);
    const proximo = (i) => (i >= handlers.length ? null : handlers[i](req, res, () => proximo(i + 1)));
    proximo(0);
  });
}

test('marcar como atendido no painel cala os re-alertas', async () => {
  const { state, hp, dashboard, enviados } = montar();
  state.saveLead('558499687397', {
    state: 'HANDOFF',
    notas: 'RISCO/CRISE',
    handoffEm: new Date(TARDE.getTime() - 90 * MIN).toISOString(),
  });

  const r = await chamarAtendido(dashboard.criarRouter(), '558499687397');
  assert.equal(r.status, 200);
  assert.ok(state.getLead('558499687397').atendidoEm);

  assert.equal(await hp.checarHandoffsParados(TARDE), 0);
  assert.equal(enviados.length, 0);
});
