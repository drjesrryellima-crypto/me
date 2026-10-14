const { google } = require('googleapis');
const { opcoesDeAuth, contaEmUso } = require('./google-credenciais');
const { estagioCrm, ehRisco } = require('./estados');

const SHEET_ID = process.env.GOOGLE_SHEET_ID;
const TAB = process.env.GOOGLE_SHEET_TAB || 'Leads';

let sheetsClient = null;

async function getClient() {
  if (sheetsClient) return sheetsClient;
  const opcoes = opcoesDeAuth(['https://www.googleapis.com/auth/spreadsheets']);
  if (!opcoes) {
    console.warn('[sheets] credenciais do Google não encontradas — pulando gravação na planilha.');
    return null;
  }
  const auth = new google.auth.GoogleAuth(opcoes);
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
// Diz QUEM tentou escrever em QUE planilha, e devolve a dica certa para cada
// causa. "The caller does not have permission" sozinho não diz nada: a conta
// pode estar sem acesso, a planilha pode ser outra, ou a API pode estar
// desligada no projeto do Google — e as três têm conserto diferente.
//
// Nada aqui é segredo: e-mail de conta de serviço e id de planilha são
// identificadores, não credencial. A chave privada não aparece.
function explicarErroDoSheets(err) {
  const motivo = (err && err.message) || String(err);
  const quem = contaEmUso() || '(credencial não identificada)';
  const onde = SHEET_ID || '(GOOGLE_SHEET_ID vazio)';
  const base = `[sheets] falha ao gravar — conta ${quem}, planilha ${onde}, aba "${TAB}": ${motivo}`;

  if (/permission/i.test(motivo)) {
    return `${base}
  Três causas possíveis, nesta ordem:
  1. a conta acima não está como Editor NESSA planilha (compartilhe com ela);
  2. GOOGLE_SHEET_ID aponta para outra planilha — confira o id acima;
  3. a API do Google Sheets está desligada no projeto dono dessa conta.`;
  }
  if (/Unable to parse range|not found/i.test(motivo)) {
    return `${base}
  A aba "${TAB}" provavelmente não existe com esse nome exato (maiúsculas e
  acentos contam). Ajuste GOOGLE_SHEET_TAB ou renomeie a aba.`;
  }
  return base;
}

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

// A planilha é um espelho do estado, não o estado: quem manda é o disco
// (src/state.js), e a resposta ao paciente já saiu antes desta chamada.
//
// Antes, um erro aqui subia até o agrupador e aparecia como
// "[agrupador] falha ao processar <telefone>" — como se a MENSAGEM tivesse
// falhado. Ela não falhou: o paciente foi respondido. Só o espelho ficou
// desatualizado, e o log fazia parecer coisa muito pior do que é.
async function gravarLeadNaPlanilha(lead) {
  try {
    await appendLeadRow(lead);
  } catch (err) {
    console.error(explicarErroDoSheets(err));
  }
}

module.exports = {
  appendLeadRow,
  gravarLeadNaPlanilha,
  explicarErroDoSheets,
  soDigitos,
  encontrarLinha,
  montarLinha,
  COLUNAS,
  ULTIMA_COLUNA,
};
