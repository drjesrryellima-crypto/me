const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

function montar() {
  process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'desc-'));
  delete process.env.ANTHROPIC_API_KEY;
  for (const m of ['../src/state', '../src/telegram', '../src/flow', '../src/whatsapp', '../src/sheets']) {
    delete require.cache[require.resolve(m)];
  }
  const telegram = require('../src/telegram');
  const avisos = [];
  telegram.enviarAlerta = async (t) => { avisos.push(t); return true; };

  const whatsapp = require('../src/whatsapp');
  const enviados = [];
  whatsapp.sendText = async (to, body) => { enviados.push({ to, body }); return {}; };

  require('../src/sheets').appendLeadRow = async () => {};
  return { state: require('../src/state'), flow: require('../src/flow'), enviados, avisos };
}

test('"PARAR" descadastra, confirma e mantém o 188 à vista', async () => {
  const { state, flow, enviados } = montar();
  await flow.handleIncomingMessage({ from: '558499687397', text: 'PARAR' });

  assert.equal(enviados.length, 1);
  assert.match(enviados[0].body, /não vou mais te mandar mensagem/i);
  assert.match(enviados[0].body, /188/, 'o 188 some justo para quem pediu silêncio');
  assert.match(enviados[0].body, /escrever de novo/, 'sair não pode virar porta trancada');
  assert.equal(state.getLead('558499687397').state, 'DESCADASTRADO');
});

// Era o único caminho de saída, e ficava bloqueado justamente para quem mais
// tinha motivo de usá-lo.
test('quem está em HANDOFF também consegue sair', async () => {
  const { state, flow, enviados } = montar();
  state.saveLead('558499687397', { state: 'HANDOFF' });
  await flow.handleIncomingMessage({ from: '558499687397', text: 'sair' });

  assert.equal(state.getLead('558499687397').state, 'DESCADASTRADO');
  assert.equal(enviados.length, 1, 'a confirmação precisa sair mesmo em handoff');
});

// Ninguém é descadastrado no meio de um pedido de socorro.
test('sinal de crise ganha do descadastro', async () => {
  const { state, flow, enviados } = montar();
  await flow.handleIncomingMessage({ from: '558499687397', text: 'quero me matar' });

  assert.equal(state.getLead('558499687397').state, 'HANDOFF');
  assert.match(enviados[0].body, /188/);
});

test('descadastrado que volta a escrever não recebe resposta do bot, mas avisa o médico', async () => {
  const { state, flow, enviados, avisos } = montar();
  state.saveLead('558499687397', { state: 'DESCADASTRADO' });

  await flow.handleIncomingMessage({ from: '558499687397', text: 'oi, mudei de ideia' });

  assert.equal(enviados.length, 0, 'um bot que volta a falar depois de "pare" é o que ela pediu para não acontecer');
  assert.equal(avisos.length, 1);
  assert.match(avisos[0], /DESCADASTRADO VOLTOU A ESCREVER/);
  assert.match(avisos[0], /mudei de ideia/);
  assert.equal(state.getLead('558499687397').state, 'DESCADASTRADO');
});

test('o médico pode trazer de volta pelo painel', () => {
  const { planejarReativacao } = require('../src/reativar');
  const plano = planejarReativacao({ phone: '558499687397', state: 'DESCADASTRADO' });
  assert.equal(plano.ok, true);
  assert.equal(plano.campos.state, 'NOVO');
});
