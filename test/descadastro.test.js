const test = require('node:test');
const assert = require('node:assert');
const { pediuDescadastro, camposDeDescadastro } = require('../src/descadastro');

test('as palavras de saída são reconhecidas', () => {
  for (const t of ['parar', 'PARAR', ' Sair ', 'cancelar', 'descadastrar', 'stop', 'pare', 'remover']) {
    assert.equal(pediuDescadastro(t), true, `não reconheceu "${t}"`);
  }
});

test('acento e pontuação não atrapalham', () => {
  for (const t of ['PARAR!', 'sair.', 'não quero mais receber', 'Nao quero mais receber?']) {
    assert.equal(pediuDescadastro(t), true, `não reconheceu "${t}"`);
  }
});

// A decisão mais importante do módulo. Um falso positivo aqui cala para sempre
// alguém que estava pedindo ajuda.
test('a palavra no meio de uma frase NÃO descadastra', () => {
  const frases = [
    'não pare de me ajudar',
    'a dor não para nunca',
    'pare pra pensar nisso',
    'quero parar de tomar o remédio',
    'não consigo parar de chorar',
    'preciso sair dessa situação',
    'quero cancelar minha consulta de terça',
    'me ajuda a parar com isso',
  ];
  for (const frase of frases) {
    assert.equal(pediuDescadastro(frase), false, `descadastrou por engano: "${frase}"`);
  }
});

// "para" sozinho ficou de fora: é a palavra mais fácil de aparecer solta numa
// conversa real, e o preço do engano é alto demais.
test('"para" sozinho não descadastra', () => {
  for (const t of ['para', 'Para', 'para.']) {
    assert.equal(pediuDescadastro(t), false);
  }
});

test('mensagem vazia não descadastra', () => {
  for (const t of ['', '   ', null, undefined]) {
    assert.equal(pediuDescadastro(t), false);
  }
});

// Apagar automaticamente destruiria registro que o consultório pode ser
// obrigado a guardar. Quem decide o que vai embora é o médico.
test('descadastrar não apaga o histórico', () => {
  const campos = camposDeDescadastro(new Date('2026-10-04T17:00:00Z'));
  assert.equal(campos.state, 'DESCADASTRADO');
  assert.equal(campos.followupsAgendados, false);
  assert.ok(campos.descadastradoEm);
  for (const proibido of ['motivo', 'historico', 'historicoConversa', 'classificacao', 'nome']) {
    assert.equal(campos[proibido], undefined, `${proibido} seria sobrescrito`);
  }
});
