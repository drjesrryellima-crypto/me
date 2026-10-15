const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

// Pedido do Dr. Jesrryel em 15/10/2026: a primeira fala do bot cumprimenta,
// diz que é o consultório dele e que quem fala é a assistente — e só então
// segue o assunto.
//
// Estes testes correm o flow.js de ponta a ponta, com a IA DESLIGADA (sem
// ANTHROPIC_API_KEY), porque a regra não pode depender de a IA ter lido o
// prompt. É o caminho determinístico, que é também a rede de segurança.
function montar() {
  process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'abertura-'));
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.NUMEROS_DE_TESTE;
  for (const m of Object.keys(require.cache)) {
    if (m.includes('/src/')) delete require.cache[m];
  }
  require('../src/telegram').enviarAlerta = async () => true;
  require('../src/alert').sendHandoffAlert = async () => {};
  require('../src/sheets').appendLeadRow = async () => {};
  const enviados = [];
  require('../src/whatsapp').sendText = async (to, body) => { enviados.push(body); return {}; };
  return { state: require('../src/state'), flow: require('../src/flow'), enviados };
}

const PACIENTE = '5584977771111';

test('a primeira resposta a um paciente novo se apresenta antes do assunto', async () => {
  const { flow, enviados } = montar();
  await flow.handleIncomingMessage({ from: PACIENTE, text: 'oi' });

  assert.strictEqual(enviados.length, 1);
  const primeira = enviados[0];
  assert.ok(/^(Bom dia|Boa tarde|Boa noite)!/.test(primeira), primeira);
  assert.ok(primeira.includes('consultório do Dr. Jesrryel Lima'), primeira);
  assert.ok(/assistente/i.test(primeira), primeira);
  // E só então o assunto.
  assert.ok(primeira.includes('o que te trouxe até aqui'), primeira);
});

test('a apresentação não se repete nas mensagens seguintes', async () => {
  const { flow, enviados } = montar();
  await flow.handleIncomingMessage({ from: PACIENTE, text: 'oi' });
  await flow.handleIncomingMessage({ from: PACIENTE, text: 'ando muito ansioso' });
  await flow.handleIncomingMessage({ from: PACIENTE, text: 'nunca fiz acompanhamento' });

  assert.strictEqual(enviados.length, 3);
  for (const texto of enviados.slice(1)) {
    assert.ok(!/^(Bom dia|Boa tarde|Boa noite)!/.test(texto), `apresentou de novo: ${texto}`);
    assert.ok(!texto.includes('eu sou a assistente dele'), `apresentou de novo: ${texto}`);
  }
});

// O paciente que já chega perguntando preço não passa pelo roteiro: cai direto
// no handoff. Era a ponta mais fácil de esquecer, porque é um texto só.
test('quem já chega perguntando preço também recebe a apresentação', async () => {
  const { flow, enviados } = montar();
  await flow.handleIncomingMessage({ from: PACIENTE, text: 'quanto custa o Recomeço?' });

  assert.strictEqual(enviados.length, 1);
  assert.ok(/^(Bom dia|Boa tarde|Boa noite)!/.test(enviados[0]), enviados[0]);
  assert.ok(enviados[0].includes('consultório do Dr. Jesrryel Lima'), enviados[0]);
});

// O histórico é o que o painel mostra e o que a IA recebe de contexto. Se ele
// guardasse o texto sem a apresentação, o médico não teria como saber se o bot
// se apresentou — e a conversa na tela não seria a conversa que aconteceu.
test('o histórico guarda o que de fato saiu, com a apresentação', async () => {
  const { flow, state, enviados } = montar();
  await flow.handleIncomingMessage({ from: PACIENTE, text: 'oi' });

  const historico = state.getLead(PACIENTE).historicoConversa;
  const falaDoBot = historico.find((t) => t.role === 'assistant');
  assert.strictEqual(falaDoBot.content, enviados[0]);
});
