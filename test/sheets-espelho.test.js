const test = require('node:test');
const assert = require('node:assert');
const { espelhoLigado } = require('../src/sheets');

// A aba "Leads" da planilha real é a lista de leads do Meta Ads. O espelho do bot
// ali sujaria a lista que o disparo usa, então só liga se pedirem de propósito.
test('espelho da aba Leads fica DESLIGADO por padrão', () => {
  delete process.env.GRAVAR_ABA_LEADS;
  assert.strictEqual(espelhoLigado(), false);
});

test('só o valor "true" liga o espelho', () => {
  for (const v of ['', '1', 'sim', 'false', 'TRUEE']) {
    process.env.GRAVAR_ABA_LEADS = v;
    assert.strictEqual(espelhoLigado(), false, `ligou com "${v}"`);
  }
  for (const v of ['true', ' TRUE ']) {
    process.env.GRAVAR_ABA_LEADS = v;
    assert.strictEqual(espelhoLigado(), true);
  }
  delete process.env.GRAVAR_ABA_LEADS;
});
