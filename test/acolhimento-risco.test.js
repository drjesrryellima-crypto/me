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

// Desde 15/10/2026 o risco não aciona o médico, por decisão dele: quem está em
// risco iminente precisa de um serviço que atende 24 horas, não de um WhatsApp
// de consultório. O teste anterior checava que o 188 vinha ANTES do nome do
// médico; agora o nome dele não pode aparecer de jeito nenhum.
test('a mensagem não promete que o médico vai procurar a pessoa', () => {
  const texto = messages.acolhimentoRisco();
  assert.doesNotMatch(texto, /Jesrryel/, 'prometer o médico sem avisá-lo é mentir para quem está em crise');
  assert.doesNotMatch(texto, /avisado|vai te procurar|já chamei/i);
});

// O que substituiu a promessa: dizer a verdade sobre o que este canal é.
test('a mensagem é honesta sobre o que este canal não consegue fazer', () => {
  assert.match(messages.acolhimentoRisco(), /não consegue te acompanhar/i);
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
