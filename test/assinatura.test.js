const test = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');

const SECRET = 'segredo-de-teste';
process.env.WHATSAPP_APP_SECRET = SECRET;
const { assinaturaConfere } = require('../src/assinatura');

const corpo = Buffer.from(JSON.stringify({ entry: [{ changes: [] }] }));
const assinar = (body, secret = SECRET) =>
  'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex');

test('aceita assinatura legítima da Meta', () => {
  assert.strictEqual(assinaturaConfere(corpo, assinar(corpo)), true);
});

test('rejeita assinatura feita com outro segredo', () => {
  assert.strictEqual(assinaturaConfere(corpo, assinar(corpo, 'segredo-errado')), false);
});

// O ataque óbvio: mandar um lead falso, ou um falso alerta de RISCO/CRISE,
// reaproveitando uma assinatura vista antes.
test('rejeita corpo adulterado com assinatura antiga', () => {
  const assinaturaDoOriginal = assinar(corpo);
  const adulterado = Buffer.from(JSON.stringify({ entry: [{ changes: ['injetado'] }] }));
  assert.strictEqual(assinaturaConfere(adulterado, assinaturaDoOriginal), false);
});

test('rejeita header ausente, vazio ou malformado', () => {
  for (const header of [undefined, null, '', 'lixo', 'sha1=abc', assinar(corpo).slice(7)]) {
    assert.strictEqual(assinaturaConfere(corpo, header), false, `aceitou header: ${header}`);
  }
});

test('rejeita quando não há corpo', () => {
  assert.strictEqual(assinaturaConfere(undefined, assinar(corpo)), false);
});
