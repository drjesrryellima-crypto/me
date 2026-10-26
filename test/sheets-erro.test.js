const test = require('node:test');
const assert = require('node:assert');

// O erro real que apareceu em 14/10/2026 era "[agrupador] falha ao processar
// 558497096643: The caller does not have permission". Ele não dizia QUEM tentou
// escrever, nem EM QUE planilha, nem que o paciente já tinha sido respondido —
// e mandou a investigação para o lugar errado (a conta compartilhada na
// planilha estava certa o tempo todo).
function carregar({ sheetId, tab, credenciais } = {}) {
  for (const m of ['../src/sheets', '../src/google-credenciais']) {
    delete require.cache[require.resolve(m)];
  }
  process.env.GOOGLE_SHEET_ID = sheetId || 'ID_DA_PLANILHA';
  process.env.GOOGLE_SHEET_TAB = tab || 'Leads';
  if (credenciais) process.env.GOOGLE_SERVICE_ACCOUNT_CREDENTIALS = credenciais;
  else delete process.env.GOOGLE_SERVICE_ACCOUNT_CREDENTIALS;
  return require('../src/sheets');
}

const CONTA = JSON.stringify({
  client_email: 'bot-whatsapp@exemplo.iam.gserviceaccount.com',
  private_key: '-----BEGIN PRIVATE KEY-----\nfalsa\n-----END PRIVATE KEY-----\n',
});

test('o erro de permissão nomeia a conta, a planilha e a aba', () => {
  const { explicarErroDoSheets } = carregar({ sheetId: 'PLANILHA_X', tab: 'Leads Bot', credenciais: CONTA });
  const texto = explicarErroDoSheets(new Error('The caller does not have permission'));
  assert.match(texto, /bot-whatsapp@exemplo\.iam\.gserviceaccount\.com/);
  assert.match(texto, /PLANILHA_X/);
  assert.match(texto, /Leads Bot/);
});

// As três causas têm conserto diferente. Listar só uma manda procurar no lugar
// errado — foi exatamente o que aconteceu.
test('o erro de permissão lista as três causas possíveis', () => {
  const { explicarErroDoSheets } = carregar({ credenciais: CONTA });
  const texto = explicarErroDoSheets(new Error('The caller does not have permission'));
  assert.match(texto, /Editor/i);
  assert.match(texto, /GOOGLE_SHEET_ID/);
  assert.match(texto, /API do Google Sheets/i);
});

test('aba inexistente aponta para a aba, não para permissão', () => {
  const { explicarErroDoSheets } = carregar({ tab: 'LeadsErrado', credenciais: CONTA });
  const texto = explicarErroDoSheets(new Error('Unable to parse range: LeadsErrado!A:A'));
  assert.match(texto, /GOOGLE_SHEET_TAB/);
  assert.doesNotMatch(texto, /Editor/i);
});

// A chave privada no log vazaria a credencial para quem tem acesso ao projeto
// na Railway — o oposto do que este arquivo existe para fazer.
test('a chave privada nunca entra na mensagem', () => {
  const { explicarErroDoSheets } = carregar({ credenciais: CONTA });
  const texto = explicarErroDoSheets(new Error('The caller does not have permission'));
  assert.doesNotMatch(texto, /BEGIN PRIVATE KEY/);
  assert.doesNotMatch(texto, /falsa/);
});

test('sem credencial, diz isso em vez de quebrar', () => {
  const { explicarErroDoSheets } = carregar({});
  const texto = explicarErroDoSheets(new Error('qualquer coisa'));
  assert.match(texto, /não identificada/i);
});

// A resposta ao paciente sai ANTES da planilha. Deixar o erro subir fazia o
// log dizer "falha ao processar <telefone>", como se a mensagem tivesse
// falhado — e ela não falhou.
test('falha na planilha não derruba o atendimento', async () => {
  const sheets = carregar({ credenciais: CONTA });
  const linhas = [];
  const original = console.error;
  console.error = (...a) => linhas.push(a.join(' '));
  // O espelho da aba "Leads" é opcional (desligado por padrão); aqui ele é o que se testa.
  process.env.GRAVAR_ABA_LEADS = 'true';
  try {
    await sheets.gravarLeadNaPlanilha({ phone: '5584999990001', state: 'NOVO' });
  } finally {
    console.error = original;
    delete process.env.GRAVAR_ABA_LEADS;
  }
  assert.match(linhas.join('\n'), /\[sheets\] falha ao gravar/);
});

// Com o espelho desligado (o padrão), a aba "Leads" — que na planilha real é a lista
// do Meta Ads — nem é tocada: nenhuma tentativa, nenhum erro dela no log.
test('por padrão o bot não escreve na aba Leads', async () => {
  const sheets = carregar({ credenciais: CONTA });
  const linhas = [];
  const original = console.error;
  console.error = (...a) => linhas.push(a.join(' '));
  delete process.env.GRAVAR_ABA_LEADS;
  try {
    await sheets.gravarLeadNaPlanilha({ phone: '5584999990001', state: 'NOVO' });
  } finally {
    console.error = original;
  }
  assert.doesNotMatch(linhas.join('\n'), /\[sheets\] falha ao gravar/);
});
