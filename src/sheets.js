const { google } = require('googleapis');
const fs = require('fs');
const { estagioCrm, ehRisco } = require('./estados');

const SHEET_ID = process.env.GOOGLE_SHEET_ID;
const TAB = process.env.GOOGLE_SHEET_TAB || 'Leads';
const CREDS_PATH = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;

let sheetsClient = null;

async function getClient() {
  if (sheetsClient) return sheetsClient;
  if (!CREDS_PATH || !fs.existsSync(CREDS_PATH)) {
    console.warn('[sheets] credenciais do Google não encontradas — pulando gravação na planilha.');
    return null;
  }
  const auth = new google.auth.GoogleAuth({
    keyFile: CREDS_PATH,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const authClient = await auth.getClient();
  sheetsClient = google.sheets({ version: 'v4', auth: authClient });
  return sheetsClient;
}

// Compara telefones só pelos dígitos. O telefone é gravado com
// valueInputOption USER_ENTERED, então o Sheets guarda "5584999990001" como
// NÚMERO, não como texto — e na leitura ele pode voltar formatado
// ("5.584.999.990.001", "5,5849E+12") dependendo do formato da célula e do
// locale da planilha. Comparar string crua contra isso nunca daria match: o
// lead jamais seria encontrado, e cada mensagem criaria uma linha nova —
// exatamente o log duplicado que este upsert existe pra evitar.
const soDigitos = (valor) => String(valor ?? '').replace(/\D/g, '');

// As colunas da planilha, na ordem. Mudar isto exige mudar o cabeçalho da
// planilha junto — a gravação é posicional (coluna A é telefone, B é nome...),
// não por nome de coluna.
const COLUNAS = [
  'Telefone',
  'Nome',
  'Estágio',
  'Classificação',
  'Risco',
  'Motivo',
  'Histórico',
  'Formato',
  'Follow-ups enviados',
  'Notas',
  'Primeiro contato',
  'Última atualização',
  'Estado (técnico)',
];

const ULTIMA_COLUNA = 'M'; // 13 colunas: A..M. Mudou COLUNAS? Mude isto também.

// Data em formato que o Sheets entende como data de verdade (e o humano
// consegue ler), não o ISO cru que vira texto e não ordena direito.
function formatarData(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function montarLinha(lead) {
  return [
    lead.phone,
    lead.nome || '',
    estagioCrm(lead.state),
    lead.classificacao || '',
    ehRisco(lead) ? 'SIM' : '',
    lead.motivo || '',
    lead.historico || '',
    lead.formato || '',
    (lead.followupsEnviados || []).join(', '),
    lead.notas || '',
    formatarData(lead.createdAt),
    formatarData(lead.updatedAt || new Date().toISOString()),
    lead.state || '',
  ];
}

// Índice (0-based) da linha do lead na coluna A, ou -1 se ele ainda não está
// na planilha. Separado de appendLeadRow pra poder ser testado sem chamar a API.
function encontrarLinha(colunaA, phone) {
  const alvo = soDigitos(phone);
  if (!alvo) return -1;
  return (colunaA || []).findIndex((linha) => soDigitos(linha && linha[0]) === alvo);
}

// Grava/atualiza uma linha por lead. Como isso é chamado a cada mensagem
// recebida (ver flow.js), sempre adicionar uma linha nova faria a planilha
// virar um log da conversa inteira, com várias linhas por lead. Em vez
// disso, procura o telefone na coluna A: se já existe uma linha pra esse
// lead, atualiza ela; senão, adiciona uma linha nova. Resultado: 1 linha
// por lead, sempre com os dados mais recentes.
async function appendLeadRow(lead) {
  const client = await getClient();
  if (!client || !SHEET_ID) return;

  const row = montarLinha(lead);

  const { data } = await client.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${TAB}!A:A`,
    // UNFORMATTED_VALUE devolve o número cru, sem separador de milhar do locale.
    valueRenderOption: 'UNFORMATTED_VALUE',
  });
  const existingRowIndex = encontrarLinha(data.values, lead.phone);

  if (existingRowIndex >= 0) {
    const rowNumber = existingRowIndex + 1; // 1-based, mesma linha do telefone encontrado
    await client.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `${TAB}!A${rowNumber}:${ULTIMA_COLUNA}${rowNumber}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [row] },
    });
  } else {
    await client.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: `${TAB}!A:${ULTIMA_COLUNA}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [row] },
    });
  }
}

module.exports = { appendLeadRow, soDigitos, encontrarLinha, montarLinha, COLUNAS, ULTIMA_COLUNA };
