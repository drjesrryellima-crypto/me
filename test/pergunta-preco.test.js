const test = require('node:test');
const assert = require('node:assert');
const { isBuyingSignal, isPriceQuestion } = require('../src/triggers');
const messages = require('../src/messages');

test('pergunta de preço é intenção de compra E pergunta de preço', () => {
  for (const frase of [
    'Qual o valor da consulta?',
    'quanto custa',
    'quanto fica',
    'tem como parcelar',
    'aceita pix',
    'qual o preço',
    'quanto sai',
  ]) {
    assert.ok(isBuyingSignal(frase), `não viu compra em "${frase}"`);
    assert.ok(isPriceQuestion(frase), `não viu preço em "${frase}"`);
  }
});

test('querer agendar é compra, mas NÃO é pergunta de preço', () => {
  for (const frase of ['quero agendar', 'quero marcar', 'tem vaga', 'vamos nessa', 'eu topo']) {
    assert.ok(isBuyingSignal(frase), `não viu compra em "${frase}"`);
    assert.ok(!isPriceQuestion(frase), `confundiu com preço: "${frase}"`);
  }
});

test('conversa comum não dispara nenhum dos dois', () => {
  for (const frase of ['Oi', 'tenho dormido mal', 'minha ansiedade piorou']) {
    assert.ok(!isBuyingSignal(frase));
    assert.ok(!isPriceQuestion(frase));
  }
});

test('a resposta de valor reconhece a pergunta em vez de mudar de assunto', () => {
  const texto = messages.handoffValor();
  assert.match(texto, /valores/i);
  assert.match(texto, /Dr\. Jesrryel/);
});

test('nenhuma das duas respostas diz preço — é o Dr. Jesrryel quem trata disso', () => {
  const PROIBIDO = [/R\$/, /\d+\s*reais/i, /\bpre[cç]o de\b/i];
  for (const texto of [messages.handoffValor(), messages.handoffCompra()]) {
    for (const padrao of PROIBIDO) {
      assert.doesNotMatch(texto, padrao, `vazou valor: "${texto}"`);
    }
  }
});

test('as duas respostas são diferentes — senão a separação não serviu de nada', () => {
  assert.notStrictEqual(messages.handoffValor(), messages.handoffCompra());
});
