const test = require('node:test');
const assert = require('node:assert');
const { planejarResposta, janela } = require('../src/responder');

const agora = new Date('2026-09-29T12:00:00Z');
const lead = (extra) => ({ phone: '558499687397', state: 'HANDOFF', ...extra });

test('uma resposta normal passa', () => {
  const plano = planejarResposta(
    lead({ ultimaEntradaEm: '2026-09-29T11:00:00Z' }),
    '  Oi, aqui é o Dr. Jesrryel.  ',
    agora
  );
  assert.equal(plano.ok, true);
  assert.equal(plano.texto, 'Oi, aqui é o Dr. Jesrryel.');
});

test('mensagem vazia não sai', () => {
  const plano = planejarResposta(lead({ ultimaEntradaEm: agora.toISOString() }), '   ', agora);
  assert.equal(plano.ok, false);
  assert.match(plano.motivo, /vazia/);
});

test('acima de 4096 caracteres o problema é dito antes de gastar chamada na Meta', () => {
  const plano = planejarResposta(
    lead({ ultimaEntradaEm: agora.toISOString() }),
    'a'.repeat(4097),
    agora
  );
  assert.equal(plano.ok, false);
  assert.match(plano.motivo, /4097/);
  assert.match(plano.motivo, /4096/);
});

test('fora da janela de 24h explica o que fazer, não devolve código da Meta', () => {
  const plano = planejarResposta(
    lead({ ultimaEntradaEm: '2026-09-27T12:00:00Z' }),
    'oi',
    agora
  );
  assert.equal(plano.ok, false);
  assert.match(plano.motivo, /24h/);
  assert.match(plano.motivo, /template/);
  assert.doesNotMatch(plano.motivo, /131047/);
});

test('lead inexistente não vira envio para número solto', () => {
  assert.equal(planejarResposta(null, 'oi', agora).ok, false);
  assert.equal(planejarResposta({}, 'oi', agora).ok, false);
});

// updatedAt muda quando o BOT escreve. Se a janela olhasse para ele, uma
// conversa morta há dias pareceria aberta e o envio falharia na cara do médico.
test('a janela conta desde a mensagem do paciente, não desde o último toque no lead', () => {
  const l = lead({
    ultimaEntradaEm: '2026-09-27T12:00:00Z',
    updatedAt: '2026-09-29T11:59:00Z',
  });
  assert.equal(janela(l, agora).aberta, false);
});

test('lead antigo sem ultimaEntradaEm cai no updatedAt em vez de travar', () => {
  const l = lead({ updatedAt: '2026-09-29T11:00:00Z' });
  assert.equal(janela(l, agora).aberta, true);
});
