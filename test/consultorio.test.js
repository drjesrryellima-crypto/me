const test = require('node:test');
const assert = require('node:assert');
const { CONSULTA_AVULSA, PAGAMENTO, PRESENCIAL, ONLINE, LEMBRETE, PROGRAMAS } =
  require('../src/consultorio');
const { systemPrompt } = require('../src/assistente');

test('os fatos conferem com o que o consultório informou', () => {
  assert.equal(CONSULTA_AVULSA.valor, 350);
  assert.equal(CONSULTA_AVULSA.duracaoMinutos, 60);
  assert.match(PRESENCIAL.escrito, /João da Escóssia, 3715/);
  assert.match(PRESENCIAL.escrito, /sala 67/);
  assert.match(ONLINE.escrito, /Meet/);
  assert.match(PAGAMENTO.escrito, /Pix/);
});

// O lembrete é enviado PELO MÉDICO: não existe agendamento gravado no sistema,
// logo não existe nada para disparar um lembrete. Marcar automatico: true aqui
// faria o bot prometer algo que ninguém entrega.
test('o lembrete está marcado como não-automático', () => {
  assert.equal(LEMBRETE.automatico, false);
});

test('o preço dos programas não existe em lugar nenhum do código', () => {
  assert.equal(PROGRAMAS.falaPreco, false);
  const tudo = JSON.stringify(PROGRAMAS);
  assert.doesNotMatch(tudo, /R\$/);
  assert.doesNotMatch(tudo, /\d{3,}/, 'número com cara de preço no texto dos programas');
});

// Se o prompt deixar de carregar um fato, a assistente volta a encaminhar a
// pergunta — que é exatamente a sobrecarga que isto veio resolver.
test('todo fato do consultório chega ao prompt da assistente', () => {
  const prompt = systemPrompt();
  for (const trecho of [
    CONSULTA_AVULSA.valorEscrito,
    CONSULTA_AVULSA.duracaoEscrita,
    PAGAMENTO.escrito,
    PRESENCIAL.escrito,
    ONLINE.escrito,
    LEMBRETE.escrito,
  ]) {
    assert.ok(prompt.includes(trecho), `o prompt não carrega: "${trecho}"`);
  }
});

test('o prompt manda apresentar os programas mesmo a quem perguntou da avulsa', () => {
  assert.match(systemPrompt(), /mesmo para quem só perguntou da consulta avulsa/i);
});
