const test = require('node:test');
const assert = require('node:assert');
const { planejarReativacao } = require('../src/reativar');

test('lead parado volta para NOVO, guardando de onde veio', () => {
  for (const estado of ['HANDOFF', 'DESQUALIFICADO', 'CLIENTE']) {
    const plano = planejarReativacao({ phone: '5584999990001', state: estado });
    assert.ok(plano.ok, `${estado} deveria poder ser reativado`);
    assert.strictEqual(plano.campos.state, 'NOVO');
    assert.strictEqual(plano.campos.estadoAntesDaReativacao, estado);
    assert.match(plano.campos.notas, new RegExp(estado));
    assert.ok(plano.campos.reativadoEm, 'faltou registrar quando');
  }
});

test('lead que a automação já atende é recusado, com o motivo', () => {
  for (const estado of ['NOVO', 'AGUARDANDO_MOTIVO', 'CATALOGO_ENVIADO', 'FOLLOWUP_D2']) {
    const plano = planejarReativacao({ phone: '5584999990001', state: estado });
    assert.ok(!plano.ok, `${estado} não deveria ser reativável`);
    assert.match(plano.motivo, new RegExp(estado));
  }
});

test('lead inexistente não quebra', () => {
  assert.strictEqual(planejarReativacao(undefined).ok, false);
  assert.strictEqual(planejarReativacao(null).ok, false);
  assert.strictEqual(planejarReativacao({}).ok, false);
});

test('a agenda de follow-up é zerada — os prazos contam do catálogo, que ainda não saiu', () => {
  const plano = planejarReativacao({
    phone: '5584999990001',
    state: 'HANDOFF',
    followupsAgendados: true,
    followupsEnviados: ['D2', 'D3'],
    catalogoEnviadoEm: '2026-01-01T00:00:00.000Z',
  });
  assert.strictEqual(plano.campos.followupsAgendados, false);
  assert.deepStrictEqual(plano.campos.followupsEnviados, []);
  assert.strictEqual(plano.campos.catalogoEnviadoEm, null);
});

test('o que o lead contou NÃO é apagado — ele não vira um estranho', () => {
  const plano = planejarReativacao({ phone: '5584999990001', state: 'HANDOFF' });
  for (const campo of ['motivo', 'historico', 'classificacao', 'historicoConversa', 'nome']) {
    assert.ok(!(campo in plano.campos), `${campo} não deveria ser tocado na reativação`);
  }
});
