const test = require('node:test');
const assert = require('node:assert');
const { isBuyingSignal, isPrecoDoPlano, isPedidoDeAgendamento } = require('../src/triggers');
const messages = require('../src/messages');

// Até 04/10/2026 QUALQUER pergunta de preço virava handoff — "aceita pix?"
// incluído. Era a maior fonte de sobrecarga do médico: ele virou o FAQ do
// próprio consultório. Agora a assistente responde o que o consultório sabe.
test('pergunta sobre a consulta avulsa NÃO encaminha mais', () => {
  for (const frase of [
    'Qual o valor da consulta?',
    'quanto custa a consulta',
    'aceita pix',
    'tem como parcelar',
    'aceita cartão',
    'qual o endereço',
    'que horas vocês atendem',
    'atende sábado?',
    'é online ou presencial?',
    'quanto tempo dura a consulta',
  ]) {
    assert.ok(!isBuyingSignal(frase), `ainda encaminha: "${frase}"`);
  }
});

// O preço do acompanhamento continua sendo do médico: é na conversa dele que
// o valor é justificado, e é nela que a pessoa decide.
test('preço do acompanhamento continua sendo do humano', () => {
  for (const frase of [
    'quanto custa o Recomeço',
    'qual o valor do programa',
    'preço do acompanhamento',
    'quanto é o Constância',
  ]) {
    assert.ok(isBuyingSignal(frase), `não viu compra em "${frase}"`);
    assert.ok(isPrecoDoPlano(frase), `não viu preço de plano em "${frase}"`);
  }
});

test('querer fechar o programa encaminha, e não é pergunta de preço', () => {
  for (const frase of ['quero fazer o Recomeço', 'quero contratar', 'onde eu assino']) {
    assert.ok(isBuyingSignal(frase), `não viu compra em "${frase}"`);
    assert.ok(!isPrecoDoPlano(frase), `confundiu com preço: "${frase}"`);
  }
});

// O médico escolheu que o bot informa as faixas e não agenda. Quem já quer
// marcar não pode ouvir "ele atende de manhã" outra vez.
test('querer marcar encaminha, com texto próprio', () => {
  for (const frase of ['quero agendar', 'quero marcar', 'pode marcar']) {
    assert.ok(isPedidoDeAgendamento(frase), `não viu agendamento em "${frase}"`);
    assert.ok(isBuyingSignal(frase));
  }
  assert.ok(!isPedidoDeAgendamento('quanto custa o Recomeço'));
});

test('conversa comum não dispara nada', () => {
  for (const frase of ['Oi', 'tenho dormido mal', 'minha ansiedade piorou']) {
    assert.ok(!isBuyingSignal(frase));
    assert.ok(!isPrecoDoPlano(frase));
  }
});

test('as respostas de handoff reconhecem a pergunta em vez de mudar de assunto', () => {
  assert.match(messages.handoffValor(), /valores/i);
  assert.match(messages.handoffValor(), /Dr\. Jesrryel/);
  assert.match(messages.handoffAgendamento(), /hor[áa]rio/i);
  assert.match(messages.handoffNaoSei(), /n[ãa]o sei/i);
});

test('nenhuma resposta de handoff diz preço', () => {
  const PROIBIDO = [/R\$/, /\d+\s*reais/i];
  for (const texto of [
    messages.handoffValor(),
    messages.handoffCompra(),
    messages.handoffAgendamento(),
    messages.handoffNaoSei(),
  ]) {
    for (const padrao of PROIBIDO) {
      assert.doesNotMatch(texto, padrao, `vazou valor: "${texto}"`);
    }
  }
});

// Quem perguntou o preço do programa e quem quer marcar estão em momentos
// diferentes; a mesma frase para os dois não responde nenhum.
test('as três respostas são diferentes entre si', () => {
  const textos = [messages.handoffValor(), messages.handoffAgendamento(), messages.handoffNaoSei()];
  assert.equal(new Set(textos).size, 3);
});
