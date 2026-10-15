const test = require('node:test');
const assert = require('node:assert');

const { ehTeste, canonizar, lista, configurados } = require('../src/numeros-de-teste');

const LISTA = '+5584997096643;+5584999687397';

test('canoniza as duas formas do mesmo celular brasileiro na mesma', () => {
  // Como está na agenda do médico (com o 9º dígito) e como a Meta entrega no
  // wa_id (sem). Se estas duas não baterem, a lista não serve para nada.
  assert.strictEqual(canonizar('+55 84 99709-6643'), '558497096643');
  assert.strictEqual(canonizar('558497096643'), '558497096643');
  assert.strictEqual(canonizar('5584997096643'), '558497096643');
});

test('reconhece o número de teste nas duas formas', () => {
  assert.ok(ehTeste('5584997096643', LISTA));
  assert.ok(ehTeste('558497096643', LISTA));
  assert.ok(ehTeste('+55 (84) 99709-6643', LISTA));
  assert.ok(ehTeste('558499687397', LISTA));
  assert.ok(ehTeste('5584999687397', LISTA));
});

test('não confunde outro número com o de teste', () => {
  assert.ok(!ehTeste('558499999999', LISTA));
  assert.ok(!ehTeste('5584997096644', LISTA));
  // O mesmo número com outro DDD é outra pessoa.
  assert.ok(!ehTeste('5511997096643', LISTA));
});

test('sem a variável configurada, ninguém é teste', () => {
  assert.ok(!ehTeste('558497096643', ''));
  assert.ok(!ehTeste('558497096643', undefined));
  assert.strictEqual(configurados(''), 0);
});

test('telefone vazio não é teste nem quando a lista tem lixo', () => {
  assert.ok(!ehTeste('', LISTA));
  assert.ok(!ehTeste(null, LISTA));
  assert.ok(!ehTeste(undefined, LISTA));
  // Uma lista só com separadores não pode casar com string vazia.
  assert.ok(!ehTeste('', ';;,  ,'));
});

test('aceita vírgula, ponto-e-vírgula, espaço e quebra de linha como separador', () => {
  const formas = [
    '5584997096643,5584999687397',
    '5584997096643;5584999687397',
    '5584997096643 5584999687397',
    '5584997096643\n5584999687397',
  ];
  for (const forma of formas) {
    assert.deepStrictEqual(lista(forma), ['558497096643', '558499687397'], forma);
  }
});

test('número estrangeiro passa sem invenção de 9º dígito', () => {
  assert.strictEqual(canonizar('+1 415 555 0101'), '14155550101');
  assert.ok(ehTeste('+1 415 555 0101', '14155550101'));
});

test('não corta o 9 de quem tem 8 dígitos começando com 9', () => {
  // 55 + DDD + 8 dígitos: o primeiro 9 é do número, não o dígito extra.
  assert.strictEqual(canonizar('558497096643'), '558497096643');
  assert.strictEqual(canonizar('5584912345678'), '558412345678');
});

test('configurados conta quantos números a lista tem', () => {
  assert.strictEqual(configurados(LISTA), 2);
  assert.strictEqual(configurados('5584997096643'), 1);
});
