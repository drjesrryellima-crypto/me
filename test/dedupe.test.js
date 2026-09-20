const test = require('node:test');
const assert = require('node:assert');
const { limpar, TTL_MS, LIMITE } = require('../src/dedupe');

test('limpar descarta ids mais velhos que o TTL e mantém os recentes', () => {
  const agora = Date.now();
  const registros = {
    recente: agora - 1000,
    naBorda: agora - TTL_MS + 60_000,
    velho: agora - TTL_MS - 60_000,
  };
  const resultado = limpar(registros);
  assert.deepStrictEqual(Object.keys(resultado).sort(), ['naBorda', 'recente']);
});

test('limpar respeita o teto e mantém os ids mais recentes', () => {
  const agora = Date.now();
  const registros = {};
  for (let i = 0; i < LIMITE + 10; i++) registros[`id-${i}`] = agora - i; // menor i = mais recente

  const resultado = limpar(registros);
  assert.strictEqual(Object.keys(resultado).length, LIMITE);
  assert.ok(resultado['id-0'], 'descartou o mais recente');
  assert.ok(!resultado[`id-${LIMITE + 5}`], 'manteve um dos mais velhos');
});

test('limpar não quebra com registro vazio', () => {
  assert.deepStrictEqual(limpar({}), {});
});
