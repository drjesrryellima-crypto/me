const test = require('node:test');
const assert = require('node:assert');
const { planejarFollowup, TOLERANCIA_DIAS } = require('../src/followup-plano');

const DIA = 86400000;
const AGORA = new Date('2026-10-14T12:00:00Z');
const lead = (diasAtras, extra = {}) => ({
  phone: '558499687397',
  state: 'CATALOGO_ENVIADO',
  followupsAgendados: true,
  catalogoEnviadoEm: new Date(AGORA.getTime() - diasAtras * DIA).toISOString(),
  ...extra,
});

// O estrago armado: com os templates desligados, nada era registrado. No dia
// em que o pagamento na Meta fosse ligado, um lead de 30 dias receberia os
// QUATRO follow-ups seguidos — pagos, atrasados semanas, em rajada.
test('lead antigo NÃO recebe os quatro de uma vez', () => {
  const plano = planejarFollowup(lead(30), AGORA);
  assert.equal(plano.acao, 'pular');
  assert.deepEqual(plano.chaves, ['D2', 'D3', 'D5', 'D7']);
});

test('no dia certo, manda a etapa certa', () => {
  const plano = planejarFollowup(lead(2), AGORA);
  assert.equal(plano.acao, 'enviar');
  assert.equal(plano.etapa.chave, 'D2');
});

// Uma por rodada. O agendador roda uma vez por dia; duas de uma vez não é
// conversa, é disparo.
test('duas etapas vencidas juntas mandam só a primeira', () => {
  const plano = planejarFollowup(lead(3), AGORA);
  assert.equal(plano.acao, 'enviar');
  assert.equal(plano.etapa.chave, 'D2', 'começou no meio da sequência');
});

test('o que já foi enviado não volta', () => {
  const plano = planejarFollowup(lead(3, { followupsEnviados: ['D2'] }), AGORA);
  assert.equal(plano.etapa.chave, 'D3');
});

// Sem registrar o que foi pulado, estas etapas voltariam a "vencer" em toda
// rodada seguinte, para sempre.
test('o que foi pulado não volta', () => {
  const plano = planejarFollowup(lead(30, { followupsPulados: ['D2', 'D3', 'D5', 'D7'] }), AGORA);
  assert.equal(plano.acao, 'nada');
});

test('dentro da tolerância ainda vai; fora dela, não', () => {
  const noLimite = planejarFollowup(lead(2 + TOLERANCIA_DIAS), AGORA);
  assert.equal(noLimite.acao, 'enviar');
  assert.equal(noLimite.etapa.chave, 'D2');

  const passou = planejarFollowup(lead(2 + TOLERANCIA_DIAS + 1), AGORA);
  assert.ok(passou.acao !== 'enviar' || passou.etapa.chave !== 'D2');
});

test('etapa atrasada é pulada junto com o envio da que está no prazo', () => {
  // 7 dias: D2 (5 de atraso) e D3 (4) passaram da tolerância; D5 (2) e D7 (0) não.
  const plano = planejarFollowup(lead(7), AGORA);
  assert.equal(plano.acao, 'enviar');
  assert.equal(plano.etapa.chave, 'D5');
  assert.deepEqual(plano.pular, ['D2', 'D3']);
});

test('quem saiu do funil não recebe nada', () => {
  for (const state of ['HANDOFF', 'CLIENTE', 'DESQUALIFICADO', 'DESCADASTRADO']) {
    assert.equal(planejarFollowup(lead(2, { state }), AGORA).acao, 'nada', state);
  }
  assert.equal(planejarFollowup(lead(2, { followupsAgendados: false }), AGORA).acao, 'nada');
  assert.equal(planejarFollowup(null, AGORA).acao, 'nada');
});

test('antes do primeiro vencimento, nada acontece', () => {
  assert.equal(planejarFollowup(lead(0), AGORA).acao, 'nada');
  assert.equal(planejarFollowup(lead(1), AGORA).acao, 'nada');
});
