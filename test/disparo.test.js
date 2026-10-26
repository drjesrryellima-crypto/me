const test = require('node:test');
const assert = require('node:assert');
const axios = require('axios');

function carregar(env) {
  for (const k of ['FORWARD_SECRET', 'DISPARO_URL']) delete process.env[k];
  Object.assign(process.env, env);
  delete require.cache[require.resolve('../src/disparo')];
  return require('../src/disparo');
}

test('sem FORWARD_SECRET não chama a rede e a fonte cai em WhatsApp', async () => {
  const chamadas = [];
  const orig = axios.post; axios.post = async (...a) => { chamadas.push(a); return { data: {} }; };
  try {
    const d = carregar({});
    assert.strictEqual(await d.repassar({ entry: [] }), false);
    assert.strictEqual(await d.fonteDoTelefone('5584'), 'WhatsApp');
    assert.strictEqual(chamadas.length, 0);
  } finally { axios.post = orig; }
});

test('repassa o corpo cru com o segredo no cabeçalho', async () => {
  const chamadas = [];
  const orig = axios.post; axios.post = async (...a) => { chamadas.push(a); return { data: {} }; };
  try {
    const d = carregar({ FORWARD_SECRET: 's3', DISPARO_URL: 'https://disparo.exemplo/' });
    const corpo = { entry: [{ changes: [] }] };
    assert.strictEqual(await d.repassar(corpo), true);
    const [url, enviado, cfg] = chamadas[0];
    assert.strictEqual(url, 'https://disparo.exemplo/webhook');
    assert.strictEqual(enviado, corpo);
    assert.strictEqual(cfg.headers['X-Forward-Secret'], 's3');
  } finally { axios.post = orig; }
});

test('falha de rede ao repassar não lança e não vaza conteúdo no log', async () => {
  const orig = axios.post; axios.post = async () => { const e = new Error('boom'); e.code = 'ECONNRESET'; throw e; };
  const erros = []; const origErr = console.error; console.error = (m) => erros.push(String(m));
  try {
    const d = carregar({ FORWARD_SECRET: 's3' });
    assert.strictEqual(await d.repassar({ texto: 'segredo do paciente' }), false);
    assert.ok(erros.some((m) => m.includes('ECONNRESET')));
    assert.ok(!erros.join('').includes('segredo do paciente'));
  } finally { axios.post = orig; console.error = origErr; }
});

test('origem: devolve o que o disparo disser; erro cai em WhatsApp', async () => {
  const orig = axios.post;
  const origErr = console.error; console.error = () => {};
  try {
    const d = carregar({ FORWARD_SECRET: 's3' });
    axios.post = async () => ({ data: { origem: 'Meta Ads' } });
    assert.strictEqual(await d.fonteDoTelefone('5584'), 'Meta Ads');
    axios.post = async () => ({ data: { origem: '' } });
    assert.strictEqual(await d.fonteDoTelefone('5584'), 'WhatsApp');
    axios.post = async () => { throw new Error('fora do ar'); };
    assert.strictEqual(await d.fonteDoTelefone('5584'), 'WhatsApp');
  } finally { axios.post = orig; console.error = origErr; }
});
