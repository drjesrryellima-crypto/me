const test = require('node:test');
const assert = require('node:assert');

function comSegredo(valor, fn) {
  const antes = process.env.WHATSAPP_APP_SECRET;
  if (valor === undefined) delete process.env.WHATSAPP_APP_SECRET;
  else process.env.WHATSAPP_APP_SECRET = valor;
  delete require.cache[require.resolve('../src/assinatura')];
  delete require.cache[require.resolve('../src/dashboard')];
  try { return fn(require('../src/dashboard')); } finally {
    if (antes === undefined) delete process.env.WHATSAPP_APP_SECRET;
    else process.env.WHATSAPP_APP_SECRET = antes;
  }
}

test('sem App Secret o painel diz que o webhook está desprotegido', () => {
  comSegredo(undefined, (dashboard) => {
    const resumo = dashboard.montarResumo([]);
    assert.equal(resumo.seguranca.webhookProtegido, false);
  });
});

test('com App Secret o painel diz que está protegido', () => {
  comSegredo('um-segredo-qualquer', (dashboard) => {
    assert.equal(dashboard.montarResumo([]).seguranca.webhookProtegido, true);
  });
});

// Variável definida como string vazia é o caso que mais engana: ela existe no
// painel da Railway, parece configurada, e não protege nada.
test('App Secret em branco não conta como protegido', () => {
  for (const vazio of ['', '   ']) {
    comSegredo(vazio, (dashboard) => {
      assert.equal(
        dashboard.montarResumo([]).seguranca.webhookProtegido,
        false,
        `"${vazio}" foi tratado como protegido`
      );
    });
  }
});

// O estado é lido a cada chamada, não no boot: depois de um redeploy com a
// variável nova, o painel tem que contar a verdade de agora.
test('o painel reflete a variável do momento, não a do boot', () => {
  const { webhookProtegido } = require('../src/assinatura');
  const antes = process.env.WHATSAPP_APP_SECRET;
  try {
    delete process.env.WHATSAPP_APP_SECRET;
    assert.equal(webhookProtegido(), false);
    process.env.WHATSAPP_APP_SECRET = 'agora-tem';
    assert.equal(webhookProtegido(), true);
  } finally {
    if (antes === undefined) delete process.env.WHATSAPP_APP_SECRET;
    else process.env.WHATSAPP_APP_SECRET = antes;
  }
});
