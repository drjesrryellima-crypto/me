const test = require('node:test');
const assert = require('node:assert');
const { conferirNumeroQueRecebeu } = require('../src/destinatario');

const comConfig = (id, fn) => {
  const antes = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (id === undefined) delete process.env.WHATSAPP_PHONE_NUMBER_ID;
  else process.env.WHATSAPP_PHONE_NUMBER_ID = id;
  try { return fn(); } finally {
    if (antes === undefined) delete process.env.WHATSAPP_PHONE_NUMBER_ID;
    else process.env.WHATSAPP_PHONE_NUMBER_ID = antes;
  }
};

test('números diferentes: avisa e nomeia os dois', () => {
  comConfig('1350488121473466', () => {
    const aviso = conferirNumeroQueRecebeu({
      metadata: { phone_number_id: '1336481699545220', display_phone_number: '5584998387075' },
    });
    assert.match(aviso, /1336481699545220/);
    assert.match(aviso, /1350488121473466/);
    assert.match(aviso, /5584998387075/);
    assert.match(aviso, /131047/);
  });
});

test('mesmo número: silêncio, sem poluir o log de toda mensagem', () => {
  comConfig('1350488121473466', () => {
    assert.strictEqual(
      conferirNumeroQueRecebeu({ metadata: { phone_number_id: '1350488121473466' } }),
      null
    );
  });
});

test('compara como texto — id numérico e id em string são o mesmo número', () => {
  comConfig('1350488121473466', () => {
    assert.strictEqual(
      conferirNumeroQueRecebeu({ metadata: { phone_number_id: 1350488121473466 } }),
      null
    );
  });
});

test('sem metadata, ou sem variável configurada, não inventa aviso', () => {
  comConfig('1350488121473466', () => {
    assert.strictEqual(conferirNumeroQueRecebeu({}), null);
    assert.strictEqual(conferirNumeroQueRecebeu({ metadata: {} }), null);
    assert.strictEqual(conferirNumeroQueRecebeu(undefined), null);
  });
  comConfig(undefined, () => {
    assert.strictEqual(
      conferirNumeroQueRecebeu({ metadata: { phone_number_id: '999' } }),
      null
    );
  });
});

test('sem display_phone_number o aviso ainda sai, só sem o número visível', () => {
  comConfig('111', () => {
    const aviso = conferirNumeroQueRecebeu({ metadata: { phone_number_id: '222' } });
    assert.match(aviso, /222/);
    assert.doesNotMatch(aviso, /\(\)/);
  });
});
