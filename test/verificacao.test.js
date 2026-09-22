const test = require('node:test');
const assert = require('node:assert');
const { diagnosticarVerificacao } = require('../src/verificacao');

test('variável não definida é a primeira coisa dita', () => {
  const msg = diagnosticarVerificacao('subscribe', 'qualquer', undefined);
  assert.match(msg, /WHATSAPP_VERIFY_TOKEN não está definida/);
});

test('espaço sobrando no valor da Meta é apontado como tal', () => {
  const msg = diagnosticarVerificacao('subscribe', 'segredo ', 'segredo');
  assert.match(msg, /iguais depois de tirar espaços/);
  assert.match(msg, /sobrou espaço no que a Meta mandou/);
  assert.doesNotMatch(msg, /Railway/);
});

test('espaço sobrando na variável da Railway é apontado como tal', () => {
  const msg = diagnosticarVerificacao('subscribe', 'segredo', ' segredo');
  assert.match(msg, /sobrou espaço na variável da Railway/);
});

test('espaço nos dois lados nomeia os dois', () => {
  const msg = diagnosticarVerificacao('subscribe', 'segredo ', ' segredo');
  assert.match(msg, /sobrou espaço no que a Meta mandou e na variável da Railway/);
});

test('tokens realmente diferentes contam os tamanhos, nunca os valores', () => {
  const msg = diagnosticarVerificacao('subscribe', 'abc', 'botjesrryel2026');
  assert.match(msg, /3 caracteres/);
  assert.match(msg, /15/);
  assert.doesNotMatch(msg, /abc/);
  assert.doesNotMatch(msg, /botjesrryel2026/);
});

test('nunca vaza o token, nem quando ele é o único conteúdo', () => {
  const segredo = 'valor-secreto-do-consultorio';
  for (const mode of ['subscribe', 'outra-coisa']) {
    for (const enviado of [segredo, segredo + ' ', 'errado', '', null]) {
      const msg = diagnosticarVerificacao(mode, enviado, segredo);
      assert.doesNotMatch(msg, /valor-secreto/, `vazou com mode=${mode} token=${JSON.stringify(enviado)}`);
    }
  }
});

test('mode errado é reconhecido antes de comparar token', () => {
  const msg = diagnosticarVerificacao('unsubscribe', 'segredo', 'segredo');
  assert.match(msg, /hub\.mode veio como "unsubscribe"/);
});

test('chamada sem token nenhum diz isso, não "são diferentes"', () => {
  for (const vazio of [null, undefined, '']) {
    const msg = diagnosticarVerificacao('subscribe', vazio, 'segredo');
    assert.match(msg, /não trouxe hub\.verify_token/);
  }
});
