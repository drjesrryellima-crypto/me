const { google } = require('googleapis');
const fs = require('fs');

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

// Grava/atualiza uma linha por lead. Como isso é chamado a cada mensagem
// recebida (ver flow.js), sempre adicionar uma linha nova faria a planilha
// virar um log da conversa inteira, com várias linhas por lead. Em vez
// disso, procura o telefone na coluna A: se já existe uma linha pra esse
// lead, atualiza ela; senão, adiciona uma linha nova. Resultado: 1 linha
// por lead, sempre com os dados mais recentes.
async function appendLeadRow(lead) {
  const client = await getClient();
  if (!client || !SHEET_ID) return;

  const row = [
    lead.phone,
    lead.nome || '',
    lead.motivo || '',
    lead.classificacao || '',
    lead.state || '',
    lead.notas || '',
    new Date().toISOString(),
  ];

  const { data } = await client.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${TAB}!A:A`,
  });
  const phones = data.values || [];
  const existingRowIndex = phones.findIndex((r) => r[0] === lead.phone);

  if (existingRowIndex >= 0) {
    const rowNumber = existingRowIndex + 1; // 1-based, mesma linha do telefone encontrado
    await client.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `${TAB}!A${rowNumber}:G${rowNumber}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [row] },
    });
  } else {
    await client.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: `${TAB}!A:G`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [row] },
    });
  }
}

module.exports = { appendLeadRow };
