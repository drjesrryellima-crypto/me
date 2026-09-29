const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

// O alerta de crise é a peça que protege alguém escrevendo às 3 da manhã. Estes
// testes sobem um servidor fingindo ser a API do Telegram e conferem o caminho
// inteiro — inclusive os casos em que ele falha, porque falhar em silêncio aqui
// é pior que não ter o canal.

function recarregar() {
  delete require.cache[require.resolve('../src/telegram')];
  return require('../src/telegram');
}

async function comApiFalsa(rotas, fn) {
  const http = require('node:http');
  const chamadas = [];
  const servidor = http.createServer((req, res) => {
    let corpo = '';
    req.on('data', (p) => { corpo += p; });
    req.on('end', () => {
      const metodo = req.url.split('/').pop().split('?')[0];
      chamadas.push({ metodo, corpo: corpo ? JSON.parse(corpo) : null });
      const resposta = rotas[metodo] || { ok: true, result: [] };
      res.writeHead(resposta.__status || 200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(resposta));
    });
  });
  await new Promise((ok) => servidor.listen(0, '127.0.0.1', ok));

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tg-'));
  const antes = { ...process.env };
  process.env.DATA_DIR = dir;
  process.env.TELEGRAM_BOT_TOKEN = 'token-de-teste';
  delete process.env.TELEGRAM_CHAT_ID;

  // aponta a lib para o servidor local
  const original = require('axios');
  const base = `http://127.0.0.1:${servidor.address().port}`;
  const patch = (fnOriginal) => (url, ...resto) =>
    fnOriginal(url.replace(/^https:\/\/api\.telegram\.org/, base), ...resto);
  const getAntes = original.get;
  const postAntes = original.post;
  original.get = patch(getAntes);
  original.post = patch(postAntes);

  try {
    return await fn(chamadas, dir);
  } finally {
    original.get = getAntes;
    original.post = postAntes;
    process.env = antes;
    fs.rmSync(dir, { recursive: true, force: true });
    await new Promise((ok) => servidor.close(ok));
  }
}

test('descobre sozinho para quem mandar, a partir de quem falou com o bot', async () => {
  await comApiFalsa(
    { getUpdates: { ok: true, result: [{ message: { chat: { id: 987654321 } } }] } },
    async (chamadas) => {
      const { enviarAlerta } = recarregar();
      assert.strictEqual(await enviarAlerta('🔔 RISCO/CRISE'), true);

      const envio = chamadas.find((c) => c.metodo === 'sendMessage');
      assert.ok(envio, 'não chamou sendMessage');
      assert.strictEqual(String(envio.corpo.chat_id), '987654321');
      assert.match(envio.corpo.text, /RISCO\/CRISE/);
    }
  );
});

test('guarda o chat_id e não redescobre a cada alerta', async () => {
  await comApiFalsa(
    { getUpdates: { ok: true, result: [{ message: { chat: { id: 111 } } }] } },
    async (chamadas, dir) => {
      const tg = recarregar();
      await tg.enviarAlerta('primeiro');
      await tg.enviarAlerta('segundo');

      const descobertas = chamadas.filter((c) => c.metodo === 'getUpdates').length;
      assert.strictEqual(descobertas, 1, 'redescobriu à toa');
      assert.ok(fs.existsSync(path.join(dir, 'telegram-chat.json')));
    }
  );
});

test('ninguém falou com o bot ainda: avisa em vez de falhar calado', async () => {
  await comApiFalsa({ getUpdates: { ok: true, result: [] } }, async () => {
    const { enviarAlerta } = recarregar();
    const avisos = [];
    const antes = console.warn;
    console.warn = (...a) => avisos.push(a.join(' '));
    try {
      assert.strictEqual(await enviarAlerta('🔔 RISCO/CRISE'), false);
      assert.match(avisos.join('\n'), /mande qualquer coisa para ele uma vez/);
    } finally {
      console.warn = antes;
    }
  });
});

test('erro do Telegram não derruba o atendimento — devolve false e segue', async () => {
  await comApiFalsa(
    {
      getUpdates: { ok: true, result: [{ message: { chat: { id: 222 } } }] },
      sendMessage: { __status: 403, ok: false, description: 'bot was blocked by the user' },
    },
    async () => {
      const { enviarAlerta } = recarregar();
      const erros = [];
      const antes = console.error;
      console.error = (...a) => erros.push(a.join(' '));
      try {
        assert.strictEqual(await enviarAlerta('🔔 RISCO/CRISE'), false);
        assert.match(erros.join('\n'), /bot was blocked by the user/);
      } finally {
        console.error = antes;
      }
    }
  );
});

test('sem token configurado, não tenta nada', async () => {
  const antes = process.env.TELEGRAM_BOT_TOKEN;
  delete process.env.TELEGRAM_BOT_TOKEN;
  try {
    const { enviarAlerta, configurado } = recarregar();
    assert.strictEqual(configurado(), false);
    assert.strictEqual(await enviarAlerta('qualquer coisa'), false);
  } finally {
    if (antes === undefined) delete process.env.TELEGRAM_BOT_TOKEN;
    else process.env.TELEGRAM_BOT_TOKEN = antes;
  }
});

test('TELEGRAM_CHAT_ID definido manda direto, sem descobrir nada', async () => {
  await comApiFalsa({}, async (chamadas) => {
    process.env.TELEGRAM_CHAT_ID = '555';
    const { enviarAlerta } = recarregar();
    await enviarAlerta('direto');
    assert.strictEqual(chamadas.filter((c) => c.metodo === 'getUpdates').length, 0);
    assert.strictEqual(String(chamadas.find((c) => c.metodo === 'sendMessage').corpo.chat_id), '555');
  });
});

// Ligação entre o alerta e o canal: o que sendHandoffAlert monta precisa chegar
// no Telegram com a frase do paciente inteira. É o caminho que o médico usa
// para decidir urgência, e o único que carrega essa frase para fora do servidor.
test('o alerta de crise chega no Telegram com a frase do paciente', async () => {
  await comApiFalsa(
    { getUpdates: { ok: true, result: [{ message: { chat: { id: 42 } } }] } },
    async (chamadas) => {
      delete require.cache[require.resolve('../src/alert')];
      delete require.cache[require.resolve('../src/telegram')];
      const { sendHandoffAlert } = require('../src/alert');

      const antes = console.log;
      console.log = () => {};
      try {
        await sendHandoffAlert({
          priority: 'RISCO/CRISE — URGENTE',
          phone: '5584999990009',
          motivo: 'ansiedade',
          classificacao: 'Recomeço',
          ultimaMensagem: 'nao vejo mais sentido em nada',
        });
      } finally {
        console.log = antes;
      }

      const envio = chamadas.find((c) => c.metodo === 'sendMessage');
      assert.ok(envio, 'o alerta não chegou no Telegram');
      assert.match(envio.corpo.text, /RISCO\/CRISE — URGENTE/);
      assert.match(envio.corpo.text, /5584999990009/);
      assert.match(envio.corpo.text, /nao vejo mais sentido em nada/);
    }
  );
});

test('sem nenhum canal configurado, o log grita que ninguém foi avisado', async () => {
  const antesEnv = { ...process.env };
  delete process.env.TELEGRAM_BOT_TOKEN;
  delete process.env.TELEGRAM_CHAT_ID;
  delete process.env.HANDOFF_ALERT_WEBHOOK_URL;
  delete require.cache[require.resolve('../src/alert')];
  delete require.cache[require.resolve('../src/telegram')];
  const { sendHandoffAlert } = require('../src/alert');

  const avisos = [];
  const logAntes = console.log;
  const warnAntes = console.warn;
  console.log = () => {};
  console.warn = (...a) => avisos.push(a.join(' '));
  try {
    await sendHandoffAlert({
      priority: 'RISCO/CRISE — URGENTE',
      phone: '5584999990009',
      ultimaMensagem: 'nao aguento mais',
    });
    assert.match(avisos.join('\n'), /NINGUÉM FOI AVISADO/);
  } finally {
    console.log = logAntes;
    console.warn = warnAntes;
    process.env = antesEnv;
  }
});
