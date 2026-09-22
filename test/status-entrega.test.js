const test = require('node:test');
const assert = require('node:assert');
const { descreverStatus } = require('../src/status-entrega');

test('falha de entrega traz o motivo traduzido, não só o código', () => {
  const [linha] = descreverStatus({
    statuses: [
      {
        status: 'failed',
        recipient_id: '5584999990001',
        errors: [{ code: 131047, message: 'Re-engagement message' }],
      },
    ],
  });
  assert.match(linha, /FALHOU/);
  assert.match(linha, /5584999990001/);
  assert.match(linha, /24h/);
  assert.match(linha, /\[código 131047\]/);
});

test('entrega bem-sucedida também aparece, pra saber que chegou', () => {
  const linhas = descreverStatus({
    statuses: [{ status: 'delivered', recipient_id: '5584999990001' }],
  });
  assert.deepStrictEqual(linhas, ['[entrega] delivered — para 5584999990001']);
});

test('vários status num evento só viram várias linhas', () => {
  const linhas = descreverStatus({
    statuses: [
      { status: 'sent', recipient_id: '111' },
      { status: 'delivered', recipient_id: '111' },
      { status: 'read', recipient_id: '111' },
    ],
  });
  assert.strictEqual(linhas.length, 3);
});

test('falha sem detalhe da Meta diz isso em vez de ficar muda', () => {
  const [linha] = descreverStatus({ statuses: [{ status: 'failed', recipient_id: '111' }] });
  assert.match(linha, /sem detalhe da Meta/);
});

test('evento sem statuses não produz linha nenhuma', () => {
  assert.deepStrictEqual(descreverStatus({}), []);
  assert.deepStrictEqual(descreverStatus({ statuses: [] }), []);
  assert.deepStrictEqual(descreverStatus(undefined), []);
  assert.deepStrictEqual(descreverStatus({ messages: [{ id: 'x' }] }), []);
});

test('status que a Meta inventar depois é ignorado, não quebra', () => {
  assert.deepStrictEqual(descreverStatus({ statuses: [{ status: 'algo_novo' }] }), []);
});

test('vários erros na mesma falha aparecem todos', () => {
  const [linha] = descreverStatus({
    statuses: [
      {
        status: 'failed',
        recipient_id: '111',
        errors: [
          { code: 131026, message: 'Undeliverable' },
          { code: 131042, message: 'Business eligibility' },
        ],
      },
    ],
  });
  assert.match(linha, /131026/);
  assert.match(linha, /131042/);
});
