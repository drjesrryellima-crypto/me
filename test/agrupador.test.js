const test = require('node:test');
const assert = require('node:assert');

function novo(espera = 40, teto = 200) {
  process.env.AGRUPADOR_ESPERA_MS = String(espera);
  process.env.AGRUPADOR_ESPERA_MAXIMA_MS = String(teto);
  delete require.cache[require.resolve('../src/agrupador')];
  return require('../src/agrupador');
}

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

// O episódio: três linhas de um desabafo viraram três respostas.
test('mensagens seguidas viram UMA resposta', async () => {
  const { agrupar } = novo();
  const respostas = [];
  const processar = async (t) => { respostas.push(t); };

  agrupar('5584', 'abri uma caixa hoje', processar);
  await esperar(10);
  agrupar('5584', 'tinha foto da minha avó', processar);
  await esperar(10);
  agrupar('5584', 'chorei que nem criança', processar);

  await esperar(120);
  assert.equal(respostas.length, 1, `mandou ${respostas.length} respostas`);
  assert.equal(respostas[0], 'abri uma caixa hoje\ntinha foto da minha avó\nchorei que nem criança');
});

test('mensagem sozinha é respondida normalmente', async () => {
  const { agrupar } = novo();
  const respostas = [];
  agrupar('5584', 'oi', async (t) => { respostas.push(t); });
  await esperar(120);
  assert.deepEqual(respostas, ['oi']);
});

// Quem escreve sem parar nunca receberia resposta, e silêncio para quem está
// em sofrimento é pior que uma resposta no meio.
test('o teto garante resposta a quem não para de escrever', async () => {
  const { agrupar } = novo(40, 120);
  const respostas = [];
  const processar = async (t) => { respostas.push(t); };

  const fim = Date.now() + 400;
  while (Date.now() < fim) {
    agrupar('5584', 'x', processar);
    await esperar(20);
  }
  await esperar(120);
  assert.ok(respostas.length >= 1, 'ninguém foi respondido');
});

test('pessoas diferentes não se misturam', async () => {
  const { agrupar } = novo();
  const porNumero = {};
  const processar = (n) => async (t) => { porNumero[n] = t; };

  agrupar('5584A', 'oi do A', processar('A'));
  agrupar('5584B', 'oi do B', processar('B'));
  await esperar(120);
  assert.equal(porNumero.A, 'oi do A');
  assert.equal(porNumero.B, 'oi do B');
});

// Esperar 8 segundos de silêncio para responder a quem disse que quer se
// matar é exatamente o tipo de otimização que não se faz.
test('esvaziar devolve o que estava pendente e cancela o timer', async () => {
  const { agrupar, esvaziar, pendente } = novo();
  const respostas = [];
  agrupar('5584', 'primeira', async (t) => { respostas.push(t); });
  agrupar('5584', 'segunda', async (t) => { respostas.push(t); });

  assert.equal(pendente('5584'), 2);
  assert.deepEqual(esvaziar('5584'), ['primeira', 'segunda']);
  assert.equal(pendente('5584'), 0);

  await esperar(120);
  assert.equal(respostas.length, 0, 'o timer cancelado disparou mesmo assim');
});

// Exceção solta em callback de setTimeout mata o processo Node inteiro.
test('erro ao processar não derruba o processo', async () => {
  const { agrupar } = novo();
  agrupar('5584', 'oi', async () => { throw new Error('falha de propósito'); });
  await esperar(120);
  assert.ok(true, 'sobreviveu');
});
