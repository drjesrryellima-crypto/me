const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

// Decisão do Dr. Jesrryel, 15/10/2026: risco NÃO aciona o celular dele.
//
// O raciocínio é clínico, não de conveniência. Quem está em risco iminente
// precisa de um serviço que atende 24 horas — CVV e pronto-socorro. Um
// WhatsApp de consultório pode estar sem ninguém olhando às 3 da manhã, e
// mandar a pessoa esperar por isso é exatamente o que não se deve fazer.
//
// O alerta criava a expectativa errada dos dois lados: a pessoa esperando o
// médico aparecer, e o médico recebendo um chamado que não é dele atender.
function montar() {
  process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'risco-'));
  delete process.env.ANTHROPIC_API_KEY;
  for (const m of ['../src/state', '../src/telegram', '../src/flow', '../src/whatsapp', '../src/sheets', '../src/alert']) {
    delete require.cache[require.resolve(m)];
  }
  const alertas = [];
  require('../src/alert').sendHandoffAlert = async (a) => { alertas.push(a); };
  require('../src/telegram').enviarAlerta = async (t) => { alertas.push({ telegram: t }); return true; };
  const enviados = [];
  require('../src/whatsapp').sendText = async (to, body) => { enviados.push(body); return {}; };
  require('../src/sheets').appendLeadRow = async () => {};
  return { state: require('../src/state'), flow: require('../src/flow'), enviados, alertas };
}

const FRASES_DE_CRISE = ['quero me matar', 'não aguento mais', 'quero sumir', 'penso em me matar'];

test('crise não manda alerta nenhum para o médico', async () => {
  for (const frase of FRASES_DE_CRISE) {
    const { flow, alertas } = montar();
    await flow.handleIncomingMessage({ from: '558499687397', text: frase });
    assert.deepEqual(alertas, [], `"${frase}" acionou o médico`);
  }
});

test('mas a pessoa recebe os dois caminhos de urgência', async () => {
  const { flow, enviados } = montar();
  await flow.handleIncomingMessage({ from: '558499687397', text: 'quero me matar' });
  assert.equal(enviados.length, 1);
  assert.match(enviados[0], /188/);
  assert.match(enviados[0], /CVV/);
  assert.match(enviados[0], /192/);
  assert.match(enviados[0], /pronto-socorro/i);
});

// Se a crise virasse HANDOFF, a assistente ficaria calada para essa pessoa. E
// como ninguém é avisado, ela escreveria de novo e não receberia NADA.
// Alguém em crise falando com o silêncio é pior que o problema que a mudança
// resolve.
test('o bot continua respondendo quem passou por uma crise', async () => {
  const { state, flow, enviados } = montar();
  await flow.handleIncomingMessage({ from: '558499687397', text: 'quero me matar' });
  assert.notEqual(state.getLead('558499687397').state, 'HANDOFF');

  await flow.handleIncomingMessage({ from: '558499687397', text: 'obrigado, já estou melhor' });
  assert.ok(enviados.length > 1, 'o bot calou depois da crise');
});

// Não avisar não é o mesmo que não registrar: o painel precisa mostrar quem
// passou por isso, mesmo sem ninguém ter sido chamado na hora.
test('fica registrado no lead, para o painel ver depois', async () => {
  const { state, flow } = montar();
  await flow.handleIncomingMessage({ from: '558499687397', text: 'quero me matar' });
  const { ehRisco } = require('../src/estados');
  assert.equal(ehRisco(state.getLead('558499687397')), true);
});

// Prometer o médico sem avisá-lo seria mentir para alguém em crise.
test('a mensagem não promete que o médico vai procurar', async () => {
  const { flow, enviados } = montar();
  await flow.handleIncomingMessage({ from: '558499687397', text: 'quero me matar' });
  assert.doesNotMatch(enviados[0], /Jesrryel/);
  assert.doesNotMatch(enviados[0], /avisado|vai te procurar/i);
});
