const test = require('node:test');
const assert = require('node:assert');
const { validarAgenda, descreverAgenda, PADRAO } = require('../src/agenda');

const vazia = () => ({
  seg: {}, ter: {}, qua: {}, qui: {}, sex: {}, sab: {}, dom: {},
});

test('o padrão descreve a agenda real do consultório', () => {
  assert.equal(descreverAgenda(PADRAO), 'de segunda a sábado, 8h às 12h e 14h às 18h');
});

// Sete linhas de horário no WhatsApp é a resposta que ninguém lê.
test('agrupa dias iguais em vez de listar sete', () => {
  const a = { ...vazia(), seg: { manha: ['08:00', '12:00'] }, ter: { manha: ['08:00', '12:00'] } };
  assert.equal(descreverAgenda(validarAgenda(a).agenda), 'segunda e terça, 8h às 12h');
});

test('dias com horários diferentes aparecem separados', () => {
  const a = { ...vazia(), seg: { manha: ['08:00', '12:00'] }, ter: { tarde: ['14:00', '18:00'] } };
  assert.equal(descreverAgenda(validarAgenda(a).agenda), 'segunda, 8h às 12h; terça, 14h às 18h');
});

test('horário quebrado mantém os minutos', () => {
  const a = { ...vazia(), seg: { tarde: ['14:30', '18:00'] } };
  assert.equal(descreverAgenda(validarAgenda(a).agenda), 'segunda, 14h30 às 18h');
});

// Fim antes do início não é "agenda vazia", é erro de digitação — e viraria o
// bot anunciando "atendo das 18h às 8h".
test('fim antes do início é recusado', () => {
  const r = validarAgenda({ ...vazia(), seg: { manha: ['18:00', '08:00'] } });
  assert.equal(r.ok, false);
  assert.match(r.erro, /segunda/);
});

test('hora em formato inválido é recusada', () => {
  for (const faixa of [['8', '12'], ['08:00', '25:00'], ['oito', 'meio-dia'], ['08:00']]) {
    assert.equal(validarAgenda({ ...vazia(), seg: { manha: faixa } }).ok, false, String(faixa));
  }
});

// Quase sempre é alguém que limpou o formulário sem querer — e o bot passaria
// a dizer que o consultório não atende nunca.
test('agenda sem nenhum dia é recusada', () => {
  const r = validarAgenda(vazia());
  assert.equal(r.ok, false);
  assert.match(r.erro, /sem nenhum dia/);
});

test('dia ausente vira dia sem atendimento, não erro', () => {
  const r = validarAgenda({ seg: { manha: ['08:00', '12:00'] } });
  assert.equal(r.ok, true);
  assert.equal(r.agenda.dom.manha, null);
  assert.equal(r.agenda.sab.tarde, null);
});
