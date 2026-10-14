const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

function novo(teto = 3) {
  process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'orc-'));
  process.env.TETO_TEMPLATES_DIA = String(teto);
  delete require.cache[require.resolve('../src/orcamento')];
  return require('../src/orcamento');
}

test('deixa passar até o teto e barra depois', () => {
  const { registrarTemplate } = novo(3);
  for (let i = 1; i <= 3; i++) {
    assert.equal(registrarTemplate().liberado, true, `barrou na ${i}ª`);
  }
  const barrado = registrarTemplate();
  assert.equal(barrado.liberado, false);
  assert.equal(barrado.teto, 3);
});

// Em Mossoró (UTC-3) a meia-noite de UTC é 21h local — ainda o mesmo dia de
// trabalho. Se o contador usasse o dia de UTC, o teto zeraria ali, no meio da
// noite, e um laço disparando às 21h01 teria orçamento novo de graça.
test('o dia vira à meia-noite local, não à meia-noite de UTC', () => {
  const { registrarTemplate } = novo(1);
  // 20h local do dia 14 (23:00Z do dia 14).
  assert.equal(registrarTemplate(new Date('2026-10-14T23:00:00Z')).liberado, true);
  // 22h local do MESMO dia 14 — mas já é dia 15 em UTC.
  assert.equal(
    registrarTemplate(new Date('2026-10-15T01:00:00Z')).liberado,
    false,
    'o teto zerou na virada de UTC em vez da virada local'
  );
  // 00h local do dia 15 (03:00Z): agora sim é outro dia.
  assert.equal(registrarTemplate(new Date('2026-10-15T03:00:00Z')).liberado, true);
});

test('vira o dia, zera o contador', () => {
  const { registrarTemplate } = novo(1);
  assert.equal(registrarTemplate(new Date('2026-10-14T15:00:00Z')).liberado, true);
  assert.equal(registrarTemplate(new Date('2026-10-14T16:00:00Z')).liberado, false);
  assert.equal(registrarTemplate(new Date('2026-10-15T15:00:00Z')).liberado, true);
});

test('o contador sobrevive a reinício do processo', () => {
  const { registrarTemplate } = novo(2);
  registrarTemplate();
  registrarTemplate();
  delete require.cache[require.resolve('../src/orcamento')];
  assert.equal(require('../src/orcamento').registrarTemplate().liberado, false);
});

test('gastoDeHoje conta só o dia corrente', () => {
  const { registrarTemplate, gastoDeHoje } = novo(10);
  const hoje = new Date('2026-10-14T15:00:00Z');
  registrarTemplate(hoje);
  registrarTemplate(hoje);
  assert.equal(gastoDeHoje(hoje), 2);
  assert.equal(gastoDeHoje(new Date('2026-10-15T15:00:00Z')), 0);
});
