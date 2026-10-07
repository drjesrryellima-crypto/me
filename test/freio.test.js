const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

function novo() {
  process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'freio-'));
  delete require.cache[require.resolve('../src/freio')];
  return require('../src/freio');
}

test('deixa passar o número normal de mensagens de uma conversa', () => {
  const { registrarEnvio, TETO } = novo();
  for (let i = 0; i < TETO; i++) {
    assert.equal(registrarEnvio('558499687397').liberado, true, `travou na ${i + 1}ª`);
  }
});

// O episódio: 21 mensagens em 5 segundos para alguém que acabara de chorar.
test('corta a enxurrada', () => {
  const { registrarEnvio, TETO } = novo();
  for (let i = 0; i < TETO; i++) registrarEnvio('558499687397');
  for (let i = 0; i < 18; i++) {
    assert.equal(registrarEnvio('558499687397').liberado, false);
  }
});

// Um lead em surto de reenvio não pode calar o atendimento de todo mundo.
test('o teto é por pessoa, não global', () => {
  const { registrarEnvio, TETO } = novo();
  for (let i = 0; i < TETO + 5; i++) registrarEnvio('558499687397');
  assert.equal(registrarEnvio('558497096643').liberado, true);
});

test('passada a janela, volta a liberar', () => {
  const { registrarEnvio, TETO, JANELA_MS } = novo();
  const agora = Date.now();
  for (let i = 0; i < TETO; i++) registrarEnvio('558499687397', agora);
  assert.equal(registrarEnvio('558499687397', agora).liberado, false);
  assert.equal(registrarEnvio('558499687397', agora + JANELA_MS + 1).liberado, true);
});

// O contador sobrevive a reinício: o reenvio da Meta atravessa deploy, e um
// freio que zera no boot não freia justamente o caso que o motivou.
test('o contador sobrevive a reinício do processo', () => {
  const { registrarEnvio, TETO } = novo();
  for (let i = 0; i < TETO; i++) registrarEnvio('558499687397');
  delete require.cache[require.resolve('../src/freio')];
  const depois = require('../src/freio');
  assert.equal(depois.registrarEnvio('558499687397').liberado, false);
});
