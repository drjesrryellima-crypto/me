const test = require('node:test');
const assert = require('node:assert');
const { violaCompliance, montarMensagens, MAX_TURNOS, systemPrompt } = require('../src/assistente');

// O system prompt proíbe tudo isso, mas "o prompt manda" não é garantia.
// Esta é a rede determinística: se escapar, a resposta é barrada e o fluxo
// fixo assume, em vez de o lead receber algo que quebra o compliance.
test('barra preço de programa, valor inventado e parcela inventada', () => {
  const proibidas = [
    'O programa sai por R$ 500 por mês',
    'O valor do acompanhamento é esse',
    'O Recomeço custa bem menos do que parece',
    // Valor que não é o da consulta avulsa: ou é invenção do modelo, ou é
    // preço de programa escapando.
    'A consulta é R$ 400',
    // O consultório diz "dá pra parcelar no cartão", e só. Número de parcelas
    // e "sem juros" viram discussão no balcão no dia do pagamento.
    'Dá pra parcelar em 3x sem juros',
  ];
  for (const texto of proibidas) {
    assert.strictEqual(violaCompliance(texto), true, `deixou passar: "${texto}"`);
  }
});

// Desde 04/10/2026 a assistente PODE dizer o valor da consulta avulsa. Se esta
// rede continuasse barrando, o recurso seria anulado em silêncio: a resposta
// certa cairia no fluxo fixo e o lead receberia como se nada tivesse mudado.
test('deixa passar o valor da consulta avulsa, que agora é dela', () => {
  for (const texto of [
    'A consulta avulsa é R$ 350 e dura 1 hora.',
    'São 350 reais, e dá pra pagar no Pix.',
    'Dá pra parcelar no cartão.',
  ]) {
    assert.strictEqual(violaCompliance(texto), false, `barrou indevidamente: "${texto}"`);
  }
});

// A frase certa quando perguntam o preço do acompanhamento. Se a rede barrasse
// isto, a assistente não teria como nem ENCAMINHAR direito.
test('deixa passar mandar falar com o médico sobre o valor do programa', () => {
  for (const texto of [
    'Sobre o valor do acompanhamento, quem te explica é o Dr. Jesrryel.',
    'O valor do Recomeço ele te conta direitinho.',
  ]) {
    assert.strictEqual(violaCompliance(texto), false, `barrou indevidamente: "${texto}"`);
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

// A proibição de falar preço virou DUAS regras diferentes em 04/10/2026: o
// valor avulso a assistente diz (quando perguntado), o do acompanhamento
// nunca. Misturar as duas de novo traria de volta a sobrecarga que motivou
// a mudança — ou o vazamento do preço que é do médico.
test('o system prompt separa o preço avulso do preço do acompanhamento', () => {
  const prompt = systemPrompt();
  assert.match(prompt, /só quando perguntarem/i, 'perdeu a regra de não oferecer valor sozinha');
  assert.match(prompt, /[Nn]unca diga o preço dos programas/);
  assert.match(prompt, /[Nn]unca use a palavra "plano"/);
  assert.match(prompt, /[Nn]unca use "consulta psiquiátrica"/);
});

test('o system prompt não promete vaga nem lembrete que o sistema não envia', () => {
  const prompt = systemPrompt();
  assert.match(prompt, /[Nn]unca prometa vaga/);
  assert.match(prompt, /[Nn]unca diga que VOCÊ vai lembrar/);
});

// Marcador não substituído viraria "{{VALOR}}" numa mensagem de WhatsApp.
test('nenhum marcador sobra no prompt montado', () => {
  assert.doesNotMatch(systemPrompt(), /\{\{/);
});

test('os fatos do consultório chegam ao prompt', () => {
  const prompt = systemPrompt();
  assert.match(prompt, /R\$ 350/);
  assert.match(prompt, /João da Escóssia/);
  assert.match(prompt, /segunda a sábado/);
  assert.match(prompt, /Pix/);
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

// flow.js e conversar.js registram o turno do usuário no histórico ANTES de
// chamar a IA (pra não depender da API responder pra guardar o que o lead
// disse). Sem tratar isso aqui, a última fala do lead ia duplicada pro modelo.
test('não duplica a mensagem atual quando ela já é o último item do histórico', () => {
  const historico = [
    { role: 'user', content: 'oi' },
    { role: 'assistant', content: 'oi, tudo bem?' },
    { role: 'user', content: 'gostaria de saber sobre valores' },
  ];

  const msgs = montarMensagens(historico, 'gostaria de saber sobre valores');
  assert.deepStrictEqual(msgs, historico);
});
