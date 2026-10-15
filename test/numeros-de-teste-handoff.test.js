const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

// O buraco que estes testes fecham, registrado porque foi caro:
//
// Em 15/10/2026 os números de teste do médico pararam de gerar alerta. Fazia
// sentido — teste dele não toca o celular dele. Mas HANDOFF e DESQUALIFICADO
// deixam a automação CALADA de propósito, esperando o humano que o alerta
// chamaria. Sem alerta, nenhum humano vem. O teste caía em HANDOFF e ficava
// mudo para sempre: porta trancada e chave jogada fora no mesmo commit.
//
// Aconteceu de verdade às 05:02 e só apareceu às 08:15, quando o médico
// escreveu de novo e não recebeu nada.
const NA_VARIAVEL = '+5584991110000';
const NO_WEBHOOK = '558491110000';
const PACIENTE = '5584988887777';

function montar() {
  process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'teste-handoff-'));
  process.env.NUMEROS_DE_TESTE = NA_VARIAVEL;
  delete process.env.ANTHROPIC_API_KEY;
  for (const m of Object.keys(require.cache)) {
    if (m.includes('/src/')) delete require.cache[m];
  }
  const alertas = [];
  require('../src/alert').sendHandoffAlert = async (a) => { alertas.push(a); };
  require('../src/telegram').enviarAlerta = async (t) => { alertas.push({ telegram: t }); return true; };
  require('../src/sheets').appendLeadRow = async () => {};
  const enviados = [];
  require('../src/whatsapp').sendText = async (to, body) => { enviados.push({ to, body }); return {}; };
  return { state: require('../src/state'), flow: require('../src/flow'), enviados, alertas };
}

// "quanto custa o Recomeço?" é o caminho que levou o teste do médico ao
// silêncio: preço de programa é handoff por palavra-chave.
const PERGUNTA_QUE_GERA_HANDOFF = 'quanto custa o Recomeço?';

test('o teste do médico não fica preso em HANDOFF', async () => {
  const { flow, state } = montar();
  await flow.handleIncomingMessage({ from: NO_WEBHOOK, text: PERGUNTA_QUE_GERA_HANDOFF });

  const lead = state.getLead(NO_WEBHOOK);
  assert.notStrictEqual(lead.state, 'HANDOFF', 'o número de teste entrou no estado calado');
});

test('e continua sendo respondido na mensagem seguinte', async () => {
  const { flow, enviados } = montar();
  await flow.handleIncomingMessage({ from: NO_WEBHOOK, text: PERGUNTA_QUE_GERA_HANDOFF });
  const depoisDoHandoff = enviados.length;

  await flow.handleIncomingMessage({ from: NO_WEBHOOK, text: 'e o programa Constância?' });
  assert.ok(
    enviados.length > depoisDoHandoff,
    'o bot emudeceu para o número de teste depois do handoff'
  );
});

test('mas recebe o mesmo texto que o paciente receberia', async () => {
  const teste = montar();
  await teste.flow.handleIncomingMessage({ from: NO_WEBHOOK, text: PERGUNTA_QUE_GERA_HANDOFF });

  const paciente = montar();
  await paciente.flow.handleIncomingMessage({ from: PACIENTE, text: PERGUNTA_QUE_GERA_HANDOFF });

  // A abertura carrega o cumprimento da hora, então compara só o corpo.
  const corpo = (m) => m.body.split('\n').slice(2).join('\n');
  assert.strictEqual(corpo(teste.enviados[0]), corpo(paciente.enviados[0]));
});

test('o paciente de verdade continua indo para HANDOFF e gerando alerta', async () => {
  const { flow, state, alertas } = montar();
  await flow.handleIncomingMessage({ from: PACIENTE, text: PERGUNTA_QUE_GERA_HANDOFF });

  assert.strictEqual(state.getLead(PACIENTE).state, 'HANDOFF');
  assert.ok(alertas.length > 0, 'o paciente de verdade ficou sem alerta');
});

// Um lead de teste que já estava em HANDOFF de antes do portão continua lá até
// ser reativado no painel. Enquanto isso, o aviso de "voltou a escrever" era o
// único alerta que ainda tocava o celular do médico por um teste dele.
test('teste que já estava em HANDOFF não avisa o médico ao voltar a escrever', async () => {
  const { flow, state, alertas } = montar();
  state.saveLead(NO_WEBHOOK, {
    phone: NO_WEBHOOK,
    state: 'HANDOFF',
    handoffEm: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
  });

  await flow.handleIncomingMessage({ from: NO_WEBHOOK, text: 'oi?' });
  assert.deepStrictEqual(alertas, [], 'o teste do médico tocou o celular dele');
});
