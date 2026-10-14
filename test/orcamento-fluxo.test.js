const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const DIA = 86400000;

// O freio de src/freio.js é por pessoa. Um laço disparando template para
// centenas de leads DIFERENTES passa por ele inteiro, cada um dentro do seu
// limite individual — e é esse o caso que vira conta surpresa.
function montar(teto) {
  process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'orcf-'));
  process.env.TETO_TEMPLATES_DIA = String(teto);
  for (const c of ['D2', 'D3', 'D5', 'D7']) {
    process.env[`WHATSAPP_TEMPLATE_${c}`] = `followup_${c.toLowerCase()}`;
  }
  for (const m of ['../src/state', '../src/followup', '../src/whatsapp', '../src/freio', '../src/orcamento', '../src/followup-plano']) {
    delete require.cache[require.resolve(m)];
  }
  const whatsapp = require('../src/whatsapp');
  const enviados = [];
  whatsapp.sendTemplate = async (to) => { enviados.push(to); return {}; };
  return { state: require('../src/state'), followup: require('../src/followup'), enviados };
}

test('o teto diário segura um disparo em massa que o freio deixaria passar', async () => {
  const { state, followup, enviados } = montar(5);
  // 40 leads diferentes, todos vencendo D2 hoje: o freio por pessoa libera
  // todos, porque é um por número.
  for (let i = 0; i < 40; i++) {
    state.saveLead(`5584990${String(i).padStart(4, '0')}`, {
      state: 'CATALOGO_ENVIADO',
      followupsAgendados: true,
      catalogoEnviadoEm: new Date(Date.now() - 2 * DIA).toISOString(),
    });
  }

  await followup.checarFollowups();

  assert.equal(enviados.length, 5, `saíram ${enviados.length} mensagens pagas com teto de 5`);
});

test('abaixo do teto, o dia inteiro roda normalmente', async () => {
  const { state, followup, enviados } = montar(50);
  for (let i = 0; i < 6; i++) {
    state.saveLead(`5584991${String(i).padStart(4, '0')}`, {
      state: 'CATALOGO_ENVIADO',
      followupsAgendados: true,
      catalogoEnviadoEm: new Date(Date.now() - 2 * DIA).toISOString(),
    });
  }

  await followup.checarFollowups();
  assert.equal(enviados.length, 6);
});

// Barrar pelo teto não pode marcar o lead como atendido: ele precisa receber
// o follow-up amanhã, quando houver orçamento.
test('lead barrado pelo teto não é dado como enviado', async () => {
  const { state, followup } = montar(1);
  for (let i = 0; i < 3; i++) {
    state.saveLead(`5584992${String(i).padStart(4, '0')}`, {
      state: 'CATALOGO_ENVIADO',
      followupsAgendados: true,
      catalogoEnviadoEm: new Date(Date.now() - 2 * DIA).toISOString(),
    });
  }

  await followup.checarFollowups();

  const barrados = [1, 2].map((i) => state.getLead(`5584992${String(i).padStart(4, '0')}`));
  for (const lead of barrados) {
    assert.deepEqual(lead.followupsEnviados || [], [], 'marcou como enviado sem ter enviado');
    assert.equal(lead.followupsAgendados, true, 'tirou o lead da fila sem atendê-lo');
  }
});
