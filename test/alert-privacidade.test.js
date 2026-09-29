const test = require('node:test');
const assert = require('node:assert');

// A frase do paciente num alerta de crise é o dado mais sensível que o sistema
// toca. Ela precisa chegar ao médico — que decide a urgência lendo as palavras
// exatas — sem ficar escrita no log da Railway.

function comConsoleCapturado(fn) {
  const original = console.log;
  const linhas = [];
  console.log = (...args) => linhas.push(args.join(' '));
  try { return fn(linhas); } finally { console.log = original; }
}

test('a frase do paciente não vai para o log', async () => {
  delete require.cache[require.resolve('../src/alert')];
  const { sendHandoffAlert } = require('../src/alert');
  const frase = 'nao vejo mais sentido em nada disso';

  await comConsoleCapturado(async (linhas) => {
    await sendHandoffAlert({
      priority: 'RISCO/CRISE — URGENTE',
      phone: '5584999990001',
      motivo: 'ansiedade',
      classificacao: 'Recomeço',
      ultimaMensagem: frase,
    });
    const log = linhas.join('\n');
    assert.doesNotMatch(log, /nao vejo mais sentido/, `vazou no log:\n${log}`);
    // mas o alerta em si tem que aparecer, senão ninguém sabe que disparou
    assert.match(log, /RISCO\/CRISE/);
    assert.match(log, /5584999990001/);
    assert.match(log, /35 caracteres/);
  });
});

test('mensagem ausente não quebra nem imprime undefined', async () => {
  delete require.cache[require.resolve('../src/alert')];
  const { sendHandoffAlert } = require('../src/alert');

  await comConsoleCapturado(async (linhas) => {
    await sendHandoffAlert({ priority: 'INTENÇÃO DE COMPRA', phone: '5584999990001' });
    const log = linhas.join('\n');
    assert.doesNotMatch(log, /undefined/);
    assert.match(log, /0 caracteres/);
  });
});

test('mas a frase chega inteira no canal do médico', async () => {
  const http = require('node:http');
  const recebido = [];

  const servidor = http.createServer((req, res) => {
    let corpo = '';
    req.on('data', (p) => { corpo += p; });
    req.on('end', () => {
      recebido.push(JSON.parse(corpo));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{}');
    });
  });

  await new Promise((ok) => servidor.listen(0, '127.0.0.1', ok));
  const porta = servidor.address().port;

  const antes = process.env.HANDOFF_ALERT_WEBHOOK_URL;
  process.env.HANDOFF_ALERT_WEBHOOK_URL = `http://127.0.0.1:${porta}/alerta`;
  delete require.cache[require.resolve('../src/alert')];
  const { sendHandoffAlert } = require('../src/alert');

  const frase = 'nao vejo mais sentido em nada disso';
  try {
    await comConsoleCapturado(async () => {
      await sendHandoffAlert({
        priority: 'RISCO/CRISE — URGENTE',
        phone: '5584999990001',
        motivo: 'ansiedade',
        ultimaMensagem: frase,
      });
    });

    assert.strictEqual(recebido.length, 1, 'o webhook do médico não foi chamado');
    assert.strictEqual(recebido[0].ultimaMensagem, frase);
    assert.match(recebido[0].text, /nao vejo mais sentido em nada disso/);
    assert.match(recebido[0].text, /RISCO\/CRISE/);
  } finally {
    if (antes === undefined) delete process.env.HANDOFF_ALERT_WEBHOOK_URL;
    else process.env.HANDOFF_ALERT_WEBHOOK_URL = antes;
    await new Promise((ok) => servidor.close(ok));
  }
});
