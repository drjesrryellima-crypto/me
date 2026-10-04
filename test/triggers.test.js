const test = require('node:test');
const assert = require('node:assert');
const { isCrisisSignal, isBuyingSignal, isOutOfScope } = require('../src/triggers');

// Detecção de crise é a rede de segurança mais importante do sistema.
// Um falso negativo aqui significa um lead em risco tratado como lead comum.
test('reconhece sinal de crise com acento, pontuação e caixa variada', () => {
  const frases = [
    'Não aguento mais, quero morrer.',
    'QUERO MORRER',
    'às vezes penso em me matar',
    'sinto que não vale a pena viver...',
    'só quero sumir',
  ];
  for (const frase of frases) {
    assert.strictEqual(isCrisisSignal(frase), true, `não detectou crise em: "${frase}"`);
  }
});

test('não marca como crise uma conversa comum sobre sintomas', () => {
  const frases = [
    'estou com muita ansiedade ultimamente',
    'ando dormindo mal',
    'queria entender melhor o programa Recomeço',
  ];
  for (const frase of frases) {
    assert.strictEqual(isCrisisSignal(frase), false, `falso positivo de crise em: "${frase}"`);
  }
});

// "Quanto custa?" e "aceita pix?" saíram desta lista em 04/10/2026: a
// assistente agora responde as duas. Sobrou o que é de fato do humano.
test('reconhece o que é do humano: fechar programa e marcar', () => {
  for (const frase of ['quanto custa o Recomeço', 'quero contratar', 'quero agendar']) {
    assert.strictEqual(isBuyingSignal(frase), true, `não detectou compra em: "${frase}"`);
  }
});

test('pergunta que o consultório sabe responder não vira handoff', () => {
  for (const frase of ['Quanto custa?', 'aceita pix?', 'qual o endereço', 'atende sábado?']) {
    assert.strictEqual(isBuyingSignal(frase), false, `ainda encaminha: "${frase}"`);
  }
});

test('reconhece pedido fora de escopo', () => {
  assert.strictEqual(isOutOfScope('preciso de um laudo'), true);
  assert.strictEqual(isOutOfScope('quero cuidar da minha saúde mental'), false);
});
