const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

function montar() {
  process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'agr-'));
  process.env.AGRUPADOR_ESPERA_MS = '40';
  process.env.AGRUPADOR_ESPERA_MAXIMA_MS = '300';
  delete process.env.ANTHROPIC_API_KEY;
  for (const m of ['../src/state', '../src/telegram', '../src/flow', '../src/whatsapp', '../src/sheets', '../src/agrupador', '../src/freio']) {
    delete require.cache[require.resolve(m)];
  }
  require('../src/telegram').enviarAlerta = async () => true;
  const whatsapp = require('../src/whatsapp');
  const enviados = [];
  whatsapp.sendText = async (to, body) => { enviados.push(body); return {}; };
  require('../src/sheets').appendLeadRow = async () => {};
  return { state: require('../src/state'), flow: require('../src/flow'), enviados };
}

// O caso real: o paciente contou em pedaços que abriu uma caixa de fotos e
// chorou. O bot respondeu cada pedaço separadamente.
test('um desabafo em pedaços recebe UMA resposta', async () => {
  const { flow, enviados } = montar();
  for (const linha of [
    'abri uma caixa hoje',
    'tinha foto da minha avó',
    'chorei que nem criança',
    'não esperava isso',
  ]) {
    await flow.receberMensagem({ from: '558499687397', text: linha });
    await esperar(10);
  }
  await esperar(200);
  assert.equal(enviados.length, 1, `mandou ${enviados.length} respostas para um desabafo só`);
});

// Esperar 8 segundos de silêncio para responder a quem disse que quer se matar
// é exatamente o tipo de otimização que não se faz.
test('sinal de crise não espera o agrupamento', async () => {
  const { state, flow, enviados } = montar();
  await flow.receberMensagem({ from: '558499687397', text: 'quero me matar' });

  assert.equal(enviados.length, 1, 'a crise ficou esperando o timer');
  assert.match(enviados[0], /188/);
  // Desde 15/10/2026 a crise NÃO muda o estado. Se mudasse para HANDOFF a
  // assistente ficaria calada para essa pessoa — e como o médico também não é
  // mais avisado, ela escreveria de novo e não receberia nada.
  assert.notEqual(state.getLead('558499687397').state, 'HANDOFF');
});

// O que já estava no buffer precisa ir junto, senão fica pendurado num timer
// cancelado e o médico nunca vê o que a pessoa escreveu antes.
test('a crise leva junto o que já estava pendente', async () => {
  const { state, flow } = montar();
  await flow.receberMensagem({ from: '558499687397', text: 'não tô bem hoje' });
  await flow.receberMensagem({ from: '558499687397', text: 'quero me matar' });

  const lead = state.getLead('558499687397');
  const turnoDoUsuario = lead.historicoConversa.find((t) => t.role === 'user');
  assert.match(turnoDoUsuario.content, /não tô bem hoje/, 'perdeu o que veio antes');
  assert.match(turnoDoUsuario.content, /quero me matar/);
});

test('PARAR também não espera', async () => {
  const { state, flow, enviados } = montar();
  await flow.receberMensagem({ from: '558499687397', text: 'PARAR' });
  assert.equal(enviados.length, 1);
  assert.equal(state.getLead('558499687397').state, 'DESCADASTRADO');
});

// O freio continua sendo a última linha de defesa, não a primeira.
test('o agrupamento não encosta no teto do freio', async () => {
  const { flow, enviados } = montar();
  for (let i = 0; i < 10; i++) {
    await flow.receberMensagem({ from: '558499687397', text: `linha ${i}` });
    await esperar(5);
  }
  await esperar(400);
  assert.ok(enviados.length <= 2, `${enviados.length} respostas — o agrupamento não segurou`);
});
