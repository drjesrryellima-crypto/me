const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const MODULO = require.resolve('../src/google-credenciais');
function carregar() {
  delete require.cache[MODULO];
  return require(MODULO);
}

const FAKE = { client_email: 'bot@exemplo.iam.gserviceaccount.com', private_key: '-----BEGIN PRIVATE KEY-----\nx\n-----END PRIVATE KEY-----\n' };

function limpar() {
  delete process.env.GOOGLE_SERVICE_ACCOUNT_CREDENTIALS;
  delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
}

test('lê o conteúdo do JSON colado cru na variável', () => {
  limpar();
  process.env.GOOGLE_SERVICE_ACCOUNT_CREDENTIALS = JSON.stringify(FAKE);
  const { carregarCredenciais } = carregar();
  assert.strictEqual(carregarCredenciais().credentials.client_email, FAKE.client_email);
  limpar();
});

test('lê o mesmo JSON em base64 — formato que sobrevive a painel web', () => {
  limpar();
  process.env.GOOGLE_SERVICE_ACCOUNT_CREDENTIALS =
    Buffer.from(JSON.stringify(FAKE)).toString('base64');
  const { carregarCredenciais } = carregar();
  assert.strictEqual(carregarCredenciais().credentials.client_email, FAKE.client_email);
  limpar();
});

test('continua lendo o arquivo do Mac quando só o caminho está definido', () => {
  limpar();
  const arquivo = path.join(os.tmpdir(), `sa-${Date.now()}.json`);
  fs.writeFileSync(arquivo, JSON.stringify(FAKE));
  process.env.GOOGLE_SERVICE_ACCOUNT_JSON = arquivo;
  const { carregarCredenciais } = carregar();
  assert.strictEqual(carregarCredenciais().keyFile, arquivo);
  fs.unlinkSync(arquivo);
  limpar();
});

test('sem credencial nenhuma devolve null, não explode', () => {
  limpar();
  const { carregarCredenciais, opcoesDeAuth } = carregar();
  assert.strictEqual(carregarCredenciais(), null);
  assert.strictEqual(opcoesDeAuth(['escopo']), null);
});

test('variável com lixo devolve null em vez de derrubar o boot', () => {
  limpar();
  process.env.GOOGLE_SERVICE_ACCOUNT_CREDENTIALS = 'isso-nao-e-json-nem-base64-valido';
  const { carregarCredenciais } = carregar();
  assert.strictEqual(carregarCredenciais(), null);
  limpar();
});

test('JSON válido mas sem private_key é recusado — erro claro, não 403 lá na frente', () => {
  limpar();
  process.env.GOOGLE_SERVICE_ACCOUNT_CREDENTIALS = JSON.stringify({ client_email: 'a@b.com' });
  const { carregarCredenciais } = carregar();
  assert.strictEqual(carregarCredenciais(), null);
  limpar();
});

test('opcoesDeAuth não vaza o campo origem pro GoogleAuth', () => {
  limpar();
  process.env.GOOGLE_SERVICE_ACCOUNT_CREDENTIALS = JSON.stringify(FAKE);
  const { opcoesDeAuth } = carregar();
  const opcoes = opcoesDeAuth(['escopo']);
  assert.deepStrictEqual(Object.keys(opcoes).sort(), ['credentials', 'scopes']);
  limpar();
});
