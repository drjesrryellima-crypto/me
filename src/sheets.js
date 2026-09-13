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

// Grava/atualiza uma linha por lead. Implementação simples: sempre adiciona
// uma nova linha de log (histórico completo). Se preferir "1 linha por lead
// que se atualiza", dá pra evoluir depois buscando a linha pelo telefone.
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

  await client.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: `${TAB}!A:G`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [row] },
  });
}

module.exports = { appendLeadRow };
