const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

// O laço de follow-up tem que sobreviver a um lead que a Meta recusa. Sem isso,
// o primeiro erro mata o lote e todo mundo depois dele fica sem follow-up
// naquele dia — em silêncio, porque o cron só roda de novo no dia seguinte.

async function comAmbiente(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'followup-'));
  const antes = { ...process.env };
  process.env.DATA_DIR = dir;
  process.env.WHATSAPP_TEMPLATE_D2 = 'lembrete_d2';
  for (const m of Object.keys(require.cache)) {
    if (m.includes('/src/')) delete require.cache[m];
  }
  try {
    // await, não `return fn(dir)`: sem esperar, o finally restaura o process.env
    // enquanto o laço assíncrono ainda está rodando, e os leads seguintes veem
    // as variáveis já desfeitas.
    return await fn(dir);
  } finally {
    process.env = antes;
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('um envio recusado não impede os leads seguintes', async () => {
  await comAmbiente(async () => {
    const whatsapp = require('../src/whatsapp');
    const state = require('../src/state');

    const tentados = [];
    whatsapp.sendTemplate = async (phone) => {
      tentados.push(phone);
      if (phone === '5511111111111') {
        const err = new Error('Request failed with status code 400');
        err.response = { data: { error: { code: 131026, message: 'Recipient not on WhatsApp' } } };
        throw err;
      }
    };

    delete require.cache[require.resolve('../src/followup')];
    const { checarFollowups } = require('../src/followup');

    const tresDiasAtras = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    for (const phone of ['5511111111111', '5522222222222', '5533333333333']) {
      state.saveLead(phone, {
        phone,
        nome: 'Teste',
        state: 'CATALOGO_ENVIADO',
        followupsAgendados: true,
        followupsEnviados: [],
        catalogoEnviadoEm: tresDiasAtras,
        ultimaAtualizacao: tresDiasAtras,
      });
    }

    await checarFollowups();

    assert.ok(
      tentados.includes('5522222222222') && tentados.includes('5533333333333'),
      `o lote parou no primeiro erro — só tentou: ${JSON.stringify(tentados)}`
    );
  });
});
