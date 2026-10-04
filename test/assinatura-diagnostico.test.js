const test = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');

const SEGREDO = 'app-secret-de-teste';
const CORPO = Buffer.from(JSON.stringify({ object: 'whatsapp_business_account' }));

function comSegredo(valor, fn) {
  const antes = process.env.WHATSAPP_APP_SECRET;
  if (valor === undefined) delete process.env.WHATSAPP_APP_SECRET;
  else process.env.WHATSAPP_APP_SECRET = valor;
  delete require.cache[require.resolve('../src/assinatura')];
  try { return fn(require('../src/assinatura')); } finally {
    if (antes === undefined) delete process.env.WHATSAPP_APP_SECRET;
    else process.env.WHATSAPP_APP_SECRET = antes;
  }
}

const assinar = (segredo, corpo) =>
  'sha256=' + crypto.createHmac('sha256', segredo).update(corpo).digest('hex');

test('assinatura correta passa', () => {
  comSegredo(SEGREDO, ({ diagnosticar }) => {
    assert.equal(diagnosticar(CORPO, assinar(SEGREDO, CORPO)).ok, true);
  });
});

// É o caso que importa: o bot para de receber TUDO e o médico não faz ideia
// do porquê. A mensagem precisa dizer onde ir.
test('App Secret errado é apontado como App Secret errado', () => {
  comSegredo(SEGREDO, ({ diagnosticar }) => {
    const d = diagnosticar(CORPO, assinar('outro-segredo-qualquer', CORPO));
    assert.equal(d.ok, false);
    assert.equal(d.daMeta, true, 'veio com header: é config, não scanner');
    assert.match(d.motivo, /App Secret/);
    assert.match(d.motivo, /Configurações/);
  });
});

// Scanner varrendo a internet não pode gritar igual a uma configuração
// quebrada, senão o grito que importa some no barulho.
test('POST sem header é tratado como ruído, não como config quebrada', () => {
  comSegredo(SEGREDO, ({ diagnosticar }) => {
    const d = diagnosticar(CORPO, undefined);
    assert.equal(d.ok, false);
    assert.equal(d.daMeta, false);
    assert.match(d.motivo, /não veio da Meta/);
  });
});

test('o segredo nunca aparece na mensagem', () => {
  comSegredo(SEGREDO, ({ diagnosticar }) => {
    for (const header of [undefined, 'lixo', assinar('errado', CORPO)]) {
      const { motivo } = diagnosticar(CORPO, header);
      assert.doesNotMatch(motivo, new RegExp(SEGREDO), `vazou o segredo: ${motivo}`);
    }
  });
});

test('corpo vazio não é confundido com segredo errado', () => {
  comSegredo(SEGREDO, ({ diagnosticar }) => {
    const d = diagnosticar(Buffer.from(''), assinar(SEGREDO, Buffer.from('')));
    assert.equal(d.ok, false);
    assert.match(d.motivo, /corpo vazio/);
  });
});

test('assinaturaConfere continua valendo para quem já a usava', () => {
  comSegredo(SEGREDO, ({ assinaturaConfere }) => {
    assert.equal(assinaturaConfere(CORPO, assinar(SEGREDO, CORPO)), true);
    assert.equal(assinaturaConfere(CORPO, assinar('errado', CORPO)), false);
    assert.equal(assinaturaConfere(CORPO, undefined), false);
  });
});
