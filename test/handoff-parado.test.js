const test = require('node:test');
const assert = require('node:assert');

const { planejarRealerta, RISCO, NORMAL } = require('../src/handoff-parado');

const MIN = 60000;
// 14:00 em Mossoró (UTC-3) — bem dentro do horário acordado.
const TARDE = new Date('2026-10-04T17:00:00Z');
// 03:00 em Mossoró — madrugada.
const MADRUGADA = new Date('2026-10-04T06:00:00Z');

const handoff = (extra) => ({
  phone: '558499687397',
  state: 'HANDOFF',
  handoffEm: new Date(TARDE.getTime() - 60 * MIN).toISOString(),
  ...extra,
});

test('crise sem resposta há mais de 20 minutos vira re-alerta', () => {
  const plano = planejarRealerta(
    handoff({ notas: 'RISCO/CRISE — paciente falou em se machucar' }),
    TARDE
  );
  assert.equal(plano.realertar, true);
  assert.equal(plano.risco, true);
  assert.equal(plano.esperaMin, RISCO.esperaMin);
});

// É o ponto todo do recurso: se o celular estava no silencioso às 3 da manhã,
// é às 3 da manhã que o aviso tem que voltar.
test('crise não respeita horário de silêncio', () => {
  const lead = handoff({
    notas: 'RISCO/CRISE',
    handoffEm: new Date(MADRUGADA.getTime() - 60 * MIN).toISOString(),
  });
  assert.equal(planejarRealerta(lead, MADRUGADA).realertar, true);
});

test('handoff comum de madrugada espera o dia clarear', () => {
  const lead = handoff({
    notas: 'intenção de compra',
    handoffEm: new Date(MADRUGADA.getTime() - 600 * MIN).toISOString(),
  });
  const plano = planejarRealerta(lead, MADRUGADA);
  assert.equal(plano.realertar, false);
  assert.match(plano.motivo, /silêncio/);
});

test('handoff comum espera 4h, não 20 minutos', () => {
  const base = { notas: 'intenção de compra' };
  const umaHora = handoff({ ...base });
  assert.equal(planejarRealerta(umaHora, TARDE).realertar, false);

  const cincoHoras = handoff({
    ...base,
    handoffEm: new Date(TARDE.getTime() - 300 * MIN).toISOString(),
  });
  const plano = planejarRealerta(cincoHoras, TARDE);
  assert.equal(plano.realertar, true);
  assert.equal(plano.esperaMin, NORMAL.esperaMin);
});

test('atendido não recebe mais aviso', () => {
  const lead = handoff({
    notas: 'RISCO/CRISE',
    atendidoEm: new Date(TARDE.getTime() - 5 * MIN).toISOString(),
  });
  const plano = planejarRealerta(lead, TARDE);
  assert.equal(plano.realertar, false);
  assert.match(plano.motivo, /atendido/);
});

// Insistir para sempre transforma o alerta em ruído, e aí o de crise também
// passa a ser ignorado.
test('para de insistir no limite', () => {
  const lead = handoff({
    notas: 'RISCO/CRISE',
    realertasEnviados: RISCO.maxRealertas,
    ultimoRealertaEm: new Date(TARDE.getTime() - 120 * MIN).toISOString(),
  });
  const plano = planejarRealerta(lead, TARDE);
  assert.equal(plano.realertar, false);
  assert.match(plano.motivo, /limite/);
});

// Sem isso o segundo re-alerta sairia junto com o primeiro: os dois contariam
// desde o handoff, que já passou da espera.
test('a espera conta desde o último aviso, não desde o handoff', () => {
  const lead = handoff({
    notas: 'RISCO/CRISE',
    handoffEm: new Date(TARDE.getTime() - 300 * MIN).toISOString(),
    realertasEnviados: 1,
    ultimoRealertaEm: new Date(TARDE.getTime() - 5 * MIN).toISOString(),
  });
  assert.equal(planejarRealerta(lead, TARDE).realertar, false);
});

test('lead fora de handoff não gera aviso', () => {
  for (const state of ['NOVO', 'CATALOGO_ENVIADO', 'CLIENTE', 'DESQUALIFICADO']) {
    assert.equal(planejarRealerta(handoff({ state, notas: 'RISCO/CRISE' }), TARDE).realertar, false);
  }
  assert.equal(planejarRealerta(null, TARDE).realertar, false);
});

// Um deploy não pode virar avalanche de notificação sobre conversas antigas
// que podem já estar resolvidas.
test('handoff anterior ao recurso não dispara avalanche', () => {
  const lead = { phone: '558499687397', state: 'HANDOFF', notas: 'RISCO/CRISE' };
  const plano = planejarRealerta(lead, TARDE);
  assert.equal(plano.realertar, false);
  assert.match(plano.motivo, /anterior/);
});
