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
    CONSULTA_AVULSA.oQueAcontece,
    CONSULTA_AVULSA.retornoEscrito,
  ]) {
    assert.ok(prompt.includes(trecho), `o prompt não carrega: "${trecho}"`);
  }
});

test('o prompt manda apresentar os programas mesmo a quem perguntou da avulsa', () => {
  assert.match(systemPrompt(), /mesmo para quem só perguntou da consulta avulsa/i);
});

// Os fatos que vieram da automação antiga do n8n (desligada em 14/10/2026).
// Lá eles conviviam com o preço na mesma mensagem; aqui as regras continuam
// valendo inteiras, então cada um precisa PASSAR pelo compliance.
const { violaCompliance } = require('../src/assistente');

test('a descrição dos programas tem substância, não adjetivo', () => {
  // "cuidado mais próximo" não diz nada a quem está decidindo. Número de
  // encontros diz. Se alguém encurtar isso de volta, o teste reclama.
  assert.match(PROGRAMAS.recomeco, /90 dias/);
  assert.match(PROGRAMAS.recomeco, /6 encontros/);
  assert.match(PROGRAMAS.constancia, /ciclos de 3 meses/);
});

test('descrever os programas inteiros não trava no compliance', () => {
  for (const texto of [PROGRAMAS.recomeco, PROGRAMAS.constancia, PROGRAMAS.equipe]) {
    assert.equal(
      violaCompliance(texto, { perguntaDoLead: 'como funciona o acompanhamento?' }),
      false,
      `o compliance bloqueou a própria descrição do programa: ${texto.slice(0, 50)}…`
    );
  }
});

// A palavra "plano" é bloqueada (colide com "plano de saúde" e com o nome
// errado dos programas). O texto da consulta dizia "plano terapêutico" na
// automação antiga — aqui não pode voltar, ou a resposta certa morre na trava.
test('o texto da consulta não usa a palavra proibida "plano"', () => {
  assert.doesNotMatch(CONSULTA_AVULSA.oQueAcontece, /\bplanos?\b/i);
  assert.equal(
    violaCompliance(CONSULTA_AVULSA.oQueAcontece, { perguntaDoLead: 'como é a consulta?' }),
    false
  );
});

test('o retorno é dito, não descoberto depois', () => {
  assert.equal(CONSULTA_AVULSA.retornoIncluso, false);
  assert.match(CONSULTA_AVULSA.retornoEscrito, /retorno/i);
});

// Ninguém acha um prédio por CEP em Mossoró; acha por referência.
test('o endereço carrega a referência do Partage', () => {
  assert.match(PRESENCIAL.escrito, /Partage/);
});
