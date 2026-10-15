const test = require('node:test');
const assert = require('node:assert');
const { escolhida } = require('../src/escolha-vaga');

// Errar aqui marca a consulta no horário errado, e a pessoa só descobre
// aparecendo no dia errado. A régua do módulo é: na dúvida, NÃO escolhe.
// Devolver null custa uma mensagem a mais; chutar custa uma consulta.

test('entende o número direto e com volta', () => {
  assert.equal(escolhida('2', 3), 1);
  assert.equal(escolhida('pode ser 2', 3), 1);
  assert.equal(escolhida('3 por favor', 3), 2);
});

test('entende por extenso e em ordinal', () => {
  assert.equal(escolhida('quero a primeira', 3), 0);
  assert.equal(escolhida('a segunda', 3), 1);
  assert.equal(escolhida('o terceiro', 3), 2);
  assert.equal(escolhida('2º', 3), 1);
  assert.equal(escolhida('a 1a', 3), 0);
});

// Estes três vieram de bugs reais encontrados ao escrever o módulo: o regex de
// ordinal aceitava dígito solto e respondia antes da checagem de ambiguidade.
test('número que é de outra coisa não é escolha', () => {
  assert.equal(escolhida('dia 2 pode?', 3), null, '"dia 2" é data, não opção');
  assert.equal(escolhida('2 horas da tarde', 3), null, '"2 horas" é duração');
  assert.equal(escolhida('às 14h', 3), null);
  assert.equal(escolhida('14:00', 3), null);
});

test('dois números na mesma frase não é escolha', () => {
  assert.equal(escolhida('1 ou 2?', 3), null);
  assert.equal(escolhida('pode ser 2 ou 3', 3), null);
});

// "2a feira" é segunda-feira. Quem responde isso está sugerindo um dia, não
// escolhendo a opção 2 — e marcar a 2 aqui erra o horário sem ninguém notar.
test('dia da semana escrito em número não vira opção', () => {
  assert.equal(escolhida('pode ser 2a feira', 3), null);
  assert.equal(escolhida('3a feira fica melhor', 3), null);
});

test('número fora da lista oferecida não conta', () => {
  assert.equal(escolhida('5', 3), null);
  assert.equal(escolhida('3', 2), null, 'ofereceu 2 opções e aceitou a 3');
});

test('resposta sem escolha devolve null em vez de chutar', () => {
  for (const texto of ['pode ser', 'qualquer um', 'tanto faz', '', null, undefined]) {
    assert.equal(escolhida(texto, 3), null, `chutou em: ${JSON.stringify(texto)}`);
  }
});

test('sem opções oferecidas, nunca escolhe', () => {
  assert.equal(escolhida('1', 0), null);
  assert.equal(escolhida('a primeira', undefined), null);
});
