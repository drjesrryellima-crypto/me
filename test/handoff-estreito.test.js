const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

// O pedido do médico: "o bot direciona o lead pra mim rápido demais e eu fico
// sobrecarregado". Estes testes travam o limite novo — se alguém reintroduzir
// uma palavra ampla nos gatilhos, a sobrecarga volta e ninguém percebe.
function montar() {
  process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'he-'));
  delete process.env.ANTHROPIC_API_KEY; // sem IA: só o caminho determinístico
  for (const m of ['../src/state', '../src/telegram', '../src/flow', '../src/whatsapp', '../src/sheets', '../src/alert']) {
    delete require.cache[require.resolve(m)];
  }
  require('../src/telegram').enviarAlerta = async () => true;
  const whatsapp = require('../src/whatsapp');
  const enviados = [];
  whatsapp.sendText = async (to, body) => { enviados.push(body); return {}; };
  require('../src/sheets').appendLeadRow = async () => {};
  return { state: require('../src/state'), flow: require('../src/flow'), enviados };
}

async function estadoApos(texto) {
  const { state, flow } = montar();
  await flow.handleIncomingMessage({ from: '558499687397', text: texto });
  return state.getLead('558499687397').state;
}

test('pergunta que o consultório sabe responder não vira HANDOFF', async () => {
  for (const texto of [
    'quanto custa a consulta?',
    'aceita pix?',
    'qual o endereço?',
    'que horas vocês atendem?',
    'atende sábado?',
    'é online ou presencial?',
  ]) {
    assert.notEqual(await estadoApos(texto), 'HANDOFF', `ainda encaminha: "${texto}"`);
  }
});

test('preço do acompanhamento continua indo para o humano', async () => {
  assert.equal(await estadoApos('quanto custa o Recomeço?'), 'HANDOFF');
  assert.equal(await estadoApos('qual o valor do programa?'), 'HANDOFF');
});

test('querer fechar ou marcar vai para o humano', async () => {
  assert.equal(await estadoApos('quero contratar'), 'HANDOFF');
  assert.equal(await estadoApos('quero agendar'), 'HANDOFF');
});

// Crise continua ganhando de tudo na PRECEDÊNCIA — ela é checada antes de
// qualquer outra coisa. O que mudou em 15/10/2026 é o desfecho: orienta para
// 188/192 e não aciona o médico, então também não vira HANDOFF.
test('crise continua ganhando de tudo, e agora aponta para a urgência', async () => {
  const { state, flow, enviados } = montar();
  await flow.handleIncomingMessage({ from: '558499687397', text: 'quero me matar' });
  assert.match(enviados[0], /188/);
  assert.match(enviados[0], /192/);
  assert.notEqual(state.getLead('558499687397').state, 'HANDOFF');
});

test('quem quer marcar não ouve o horário de novo — ouve que você vai chamar', async () => {
  const { flow, enviados } = montar();
  await flow.handleIncomingMessage({ from: '558499687397', text: 'quero agendar' });
  assert.match(enviados[0], /hor[áa]rio/i);
  assert.match(enviados[0], /Dr\. Jesrryel/);
  assert.doesNotMatch(enviados[0], /\d{1,2}h/, 'prometeu horário que o sistema não tem');
});

test('nenhum texto fixo de handoff vaza preço', async () => {
  const { flow, enviados } = montar();
  for (const texto of ['quanto custa o Recomeço?', 'quero agendar', 'quero contratar']) {
    await flow.handleIncomingMessage({ from: '55849968739' + enviados.length, text: texto });
  }
  for (const corpo of enviados) {
    assert.doesNotMatch(corpo, /R\$/, `vazou valor: "${corpo}"`);
  }
});
