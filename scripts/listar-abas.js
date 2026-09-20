// Lista os nomes exatos das abas da planilha, entre colchetes pra deixar
// visível espaço sobrando no começo ou no fim — que é invisível na tela do
// Sheets e faz o GOOGLE_SHEET_TAB não bater.
//
//   node scripts/listar-abas.js

require('dotenv').config();
const { google } = require('googleapis');

(async () => {
  const auth = new google.auth.GoogleAuth({
    keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_JSON,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const sheets = google.sheets({ version: 'v4', auth: await auth.getClient() });
  const { data } = await sheets.spreadsheets.get({ spreadsheetId: process.env.GOOGLE_SHEET_ID });

  console.log(`\nPlanilha: ${data.properties.title}\n`);
  console.log('Abas (o nome entre [ ] é o valor exato, com espaços):\n');
  for (const s of data.sheets) console.log(`  [${s.properties.title}]`);

  const atual = process.env.GOOGLE_SHEET_TAB;
  const existe = data.sheets.some((s) => s.properties.title === atual);
  console.log(`\nGOOGLE_SHEET_TAB do .env: [${atual}] -> ${existe ? 'ENCONTRADA ✓' : 'NÃO EXISTE ✗'}\n`);
})().catch((err) => {
  console.error(`\nErro: ${err.message}\n`);
  process.exit(1);
});
