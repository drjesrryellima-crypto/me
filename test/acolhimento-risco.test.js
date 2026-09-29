const test = require('node:test');
const assert = require('node:assert');
const messages = require('../src/messages');

// A única mensagem do sistema que pode chegar a alguém em risco imediato.
// Estes testes travam o que ela NÃO pode perder numa edição futura.

test('oferece o 188 do CVV', () => {
  assert.match(messages.acolhimentoRisco(), /188/);
  assert.match(messages.acolhimentoRisco(), /CVV/);
});

test('diz o que o 188 é — número solto não ajuda quem está em crise', () => {
  const texto = messages.acolhimentoRisco();
  assert.match(texto, /gratuito/i);
  assert.match(texto, /24 horas/i);
});

test('dá o caminho para risco imediato, não só o telefone de escuta', () => {
  const texto = messages.acolhimentoRisco();
  assert.match(texto, /pronto-socorro/i);
  assert.match(texto, /192/);
});

test('o 188 vem ANTES de falar do médico — ele pode estar dormindo', () => {
  const texto = messages.acolhimentoRisco();
  assert.ok(texto.indexOf('188') < texto.indexOf('Jesrryel'), 'o médico aparece antes do CVV');
});

test('diz para não esperar pelo médico', () => {
  assert.match(messages.acolhimentoRisco(), /não espere/i);
});

test('não faz pergunta — quem está em crise não deve ter que responder um robô', () => {
  assert.doesNotMatch(messages.acolhimentoRisco(), /\?/);
});

test('não promete o que o bot não controla', () => {
  const texto = messages.acolhimentoRisco();
  // A versão anterior dizia "vou te colocar em contato com alguém agora mesmo"
  // e deixava a pessoa esperando um contato que depende de um humano acordar.
  assert.doesNotMatch(texto, /agora mesmo.*contato|contato.*agora mesmo/i);
});
