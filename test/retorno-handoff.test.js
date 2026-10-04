const test = require('node:test');
const assert = require('node:assert');
const { planejarAvisoDeRetorno, montarTexto, camposDeRetorno, JANELA_AGRUPAMENTO_MIN } =
  require('../src/retorno-handoff');

const MIN = 60000;
const AGORA = new Date('2026-10-04T17:00:00Z');
const lead = (extra) => ({ phone: '558499687397', state: 'HANDOFF', ...extra });

test('paciente em handoff que volta a escrever gera aviso', () => {
  const plano = planejarAvisoDeRetorno(lead(), AGORA);
  assert.equal(plano.avisar, true);
});

// Quem está em sofrimento escreve em rajada. Cinco notificações em dois
// minutos ensinam a silenciar o alerta — e aí o de crise some junto.
test('rajada de mensagens vira um aviso só', () => {
  const recemAvisado = lead({
    ultimoAvisoDeRetornoEm: new Date(AGORA.getTime() - 2 * MIN).toISOString(),
  });
  const plano = planejarAvisoDeRetorno(recemAvisado, AGORA);
  assert.equal(plano.avisar, false);
  assert.match(plano.motivo, /rajada/);
});

test('passada a janela de agrupamento, avisa de novo', () => {
  const antigo = lead({
    ultimoAvisoDeRetornoEm: new Date(
      AGORA.getTime() - (JANELA_AGRUPAMENTO_MIN + 1) * MIN
    ).toISOString(),
  });
  assert.equal(planejarAvisoDeRetorno(antigo, AGORA).avisar, true);
});

test('risco aparece no cabeçalho — é o que decide se ele larga o que está fazendo', () => {
  const plano = planejarAvisoDeRetorno(lead({ notas: 'RISCO/CRISE' }), AGORA);
  assert.equal(plano.risco, true);
  const texto = montarTexto(lead({ notas: 'RISCO/CRISE' }), 'preciso falar', plano);
  assert.match(texto, /CRISE/);
  assert.match(texto, /https:\/\/wa\.me\/558499687397/);
  assert.match(texto, /preciso falar/);
});

// Desqualificado pediu laudo e foi recusado; cliente já é paciente. Nenhum dos
// dois é alguém esperando resposta agora.
test('só HANDOFF avisa — desqualificado e cliente não', () => {
  for (const state of ['DESQUALIFICADO', 'CLIENTE', 'NOVO', 'CATALOGO_ENVIADO']) {
    assert.equal(planejarAvisoDeRetorno(lead({ state }), AGORA).avisar, false, state);
  }
  assert.equal(planejarAvisoDeRetorno(null, AGORA).avisar, false);
});

// Sem reiniciar o relógio, o vigia de handoff parado ou acharia que a pessoa
// espera desde o handoff original (e dispararia na hora, mentindo no tempo),
// ou a daria por atendida e nunca mais olharia para ela.
test('mensagem nova reinicia o relógio do vigia', () => {
  const campos = camposDeRetorno(AGORA);
  assert.equal(campos.handoffEm, AGORA.toISOString());
  assert.equal(campos.atendidoEm, null);
  assert.equal(campos.realertasEnviados, 0);
  assert.equal(campos.ultimoRealertaEm, null);
  assert.equal(campos.ultimoAvisoDeRetornoEm, AGORA.toISOString());
});

test('o relógio reiniciado faz o vigia tratar a espera como nova', () => {
  const { planejarRealerta } = require('../src/handoff-parado');
  const depois = new Date(AGORA.getTime() + 5 * MIN);
  const atualizado = lead({ notas: 'RISCO/CRISE', ...camposDeRetorno(AGORA) });
  // 5 minutos depois ainda é cedo para o re-alerta de crise (espera 20 min).
  assert.equal(planejarRealerta(atualizado, depois).realertar, false);
  // 25 minutos depois, não.
  assert.equal(
    planejarRealerta(atualizado, new Date(AGORA.getTime() + 25 * MIN)).realertar,
    true
  );
});
