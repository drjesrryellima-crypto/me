const test = require('node:test');
const assert = require('node:assert');
const { violaCompliance, montarMensagens, MAX_TURNOS, SYSTEM_PROMPT } = require('../src/assistente');

// O system prompt proíbe tudo isso, mas "o prompt manda" não é garantia.
// Esta é a rede determinística: se escapar, a resposta é barrada e o fluxo
// fixo assume, em vez de o lead receber algo que quebra o compliance.
test('barra resposta que fala de preço, valor ou parcelamento', () => {
  const proibidas = [
    'O programa sai por R$ 500 por mês',
    'O valor do acompanhamento é esse',
    'Dá pra parcelar em 3x sem juros',
    'Me diz qual o preço que você esperava',
  ];
  for (const texto of proibidas) {
    assert.strictEqual(violaCompliance(texto), true, `deixou passar: "${texto}"`);
  }
});

test('barra as palavras que o briefing proíbe', () => {
  assert.strictEqual(violaCompliance('Temos dois planos disponíveis'), true);
  assert.strictEqual(violaCompliance('Você quer marcar uma consulta psiquiátrica?'), true);
});

test('deixa passar resposta que respeita o compliance', () => {
  const ok = [
    'Que bom que você veio. Me conta o que te trouxe até aqui?',
    'Temos dois programas de acompanhamento: Recomeço e Constância.',
    'Prefere se cuidar aqui em Mossoró ou online?',
  ];
  for (const texto of ok) {
    assert.strictEqual(violaCompliance(texto), false, `barrou indevidamente: "${texto}"`);
  }
});

test('o system prompt carrega as três proibições do briefing', () => {
  assert.match(SYSTEM_PROMPT, /[Nn]unca fale de preço/);
  assert.match(SYSTEM_PROMPT, /[Nn]unca use a palavra "plano"/);
  assert.match(SYSTEM_PROMPT, /[Nn]unca use "consulta psiquiátrica"/);
});

// Conversa longa não pode crescer o contexto sem fim — cada mensagem seria
// mais cara que a anterior.
test('corta o histórico nos últimos turnos e põe a mensagem nova por último', () => {
  const historico = [];
  for (let i = 0; i < 30; i++) {
    historico.push({ role: i % 2 === 0 ? 'user' : 'assistant', content: `fala ${i}` });
  }

  const msgs = montarMensagens(historico, 'mensagem nova');
  assert.strictEqual(msgs.length, MAX_TURNOS + 1);
  assert.strictEqual(msgs[msgs.length - 1].content, 'mensagem nova');
  assert.strictEqual(msgs[msgs.length - 1].role, 'user');
});

test('descarta turno malformado em vez de mandar pra API', () => {
  const historico = [
    { role: 'user', content: 'ok' },
    { role: 'assistant' },
    null,
    { content: 'sem role' },
  ];
  const msgs = montarMensagens(historico, 'nova');
  assert.deepStrictEqual(msgs, [
    { role: 'user', content: 'ok' },
    { role: 'user', content: 'nova' },
  ]);
});

test('histórico vazio ou ausente não quebra', () => {
  assert.deepStrictEqual(montarMensagens(undefined, 'oi'), [{ role: 'user', content: 'oi' }]);
  assert.deepStrictEqual(montarMensagens([], 'oi'), [{ role: 'user', content: 'oi' }]);
});
