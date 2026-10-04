const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

// Pelo fluxo real: a mensagem entra como entraria pelo webhook, com o lead já
// em HANDOFF. Garante que o aviso sai, que o paciente continua sem resposta
// automática, e que o texto dele não vai para o log.
function montar({ telegramFalha } = {}) {
  process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'ret-'));
  delete process.env.ANTHROPIC_API_KEY;
  for (const m of ['../src/state', '../src/telegram', '../src/flow', '../src/whatsapp', '../src/sheets', '../src/retorno-handoff']) {
    delete require.cache[require.resolve(m)];
  }
  const telegram = require('../src/telegram');
  const enviados = [];
  telegram.enviarAlerta = async (texto) => {
    enviados.push(texto);
    return !telegramFalha;
  };

  const whatsapp = require('../src/whatsapp');
  const paraOPaciente = [];
  whatsapp.sendText = async (to, body) => {
    paraOPaciente.push({ to, body });
    return {};
  };

  const sheets = require('../src/sheets');
  sheets.appendLeadRow = async () => {};

  return { state: require('../src/state'), flow: require('../src/flow'), enviados, paraOPaciente };
}

test('quem está em handoff e escreve de novo gera aviso, sem resposta automática', async () => {
  const { state, flow, enviados, paraOPaciente } = montar();
  state.saveLead('558497096643', { state: 'HANDOFF', notas: 'RISCO/CRISE', motivo: 'ansiedade' });

  await flow.handleIncomingMessage({ from: '558497096643', text: 'você está aí?' });

  assert.equal(enviados.length, 1, 'o médico tinha que ser avisado');
  assert.match(enviados[0], /ESCREVEU DE NOVO/);
  assert.match(enviados[0], /você está aí\?/);
  assert.equal(paraOPaciente.length, 0, 'a automação continua calada com o paciente');

  const lead = state.getLead('558497096643');
  assert.ok(lead.ultimoAvisoDeRetornoEm);
  assert.equal(lead.atendidoEm, null);
  assert.equal(lead.state, 'HANDOFF', 'avisar não devolve a conversa para o bot');
});

test('rajada não vira enxurrada de notificação', async () => {
  const { state, flow, enviados } = montar();
  state.saveLead('558497096643', { state: 'HANDOFF' });

  await flow.handleIncomingMessage({ from: '558497096643', text: 'oi' });
  await flow.handleIncomingMessage({ from: '558497096643', text: 'você está aí?' });
  await flow.handleIncomingMessage({ from: '558497096643', text: 'preciso falar' });

  assert.equal(enviados.length, 1, `mandou ${enviados.length} avisos para três mensagens seguidas`);
});

// Marcar um aviso que não saiu faria a janela de agrupamento engolir os
// próximos dez minutos em silêncio — e aí ninguém seria avisado de nada.
test('aviso que o Telegram não entregou não fecha a janela', async () => {
  const { state, flow, enviados } = montar({ telegramFalha: true });
  state.saveLead('558497096643', { state: 'HANDOFF' });

  await flow.handleIncomingMessage({ from: '558497096643', text: 'oi' });
  assert.equal(state.getLead('558497096643').ultimoAvisoDeRetornoEm, undefined);

  await flow.handleIncomingMessage({ from: '558497096643', text: 'você está aí?' });
  assert.equal(enviados.length, 2, 'devia ter tentado de novo');
});

test('a mensagem do paciente não vai para o log', async () => {
  const { state, flow } = montar();
  state.saveLead('558497096643', { state: 'HANDOFF' });

  const original = console.log;
  const linhas = [];
  console.log = (...a) => linhas.push(a.join(' '));
  try {
    await flow.handleIncomingMessage({ from: '558497096643', text: 'nao aguento mais isso' });
  } finally {
    console.log = original;
  }
  assert.doesNotMatch(linhas.join('\n'), /nao aguento mais/);
});
