// Lê a aba FUNIL da planilha do consultório e descobre quem merece follow-up.
//
// Desde 18/10/2026 quem conversa com o paciente é o fluxo do n8n, não este
// bot. O n8n grava cada lead na aba FUNIL; este módulo lê de lá e alimenta o
// motor de follow-up que já existe aqui (followup-plano.js), com o teto de
// mensagens pagas, o freio por pessoa e o PARAR que ele já tem.
//
// A divisão é de propósito: tudo que DECIDE é função pura, testável sem rede.
// Só `lerAba` e `sincronizar` encostam no Google.

const { google } = require('googleapis');
const { opcoesDeAuth } = require('./google-credenciais');
const { getLead, saveLead } = require('./state');
const { PARADOS } = require('./followup-plano');
const { ehTeste } = require('./numeros-de-teste');

// A aba FUNIL mora na planilha do CRM, que é a que o n8n preenche. NÃO é a de
// GOOGLE_SHEET_ID: essa passou a ser a planilha "Leads" em 14/10/2026, e desde
// então toda rodada das 9h procurava o FUNIL no lugar errado e não achava —
// nenhum follow-up saía. As duas planilhas são independentes de propósito.
const SHEET_ID =
  process.env.GOOGLE_FUNIL_SHEET_ID || '1FN00DcZW17pruFRsyxDHWijtcSifQVj3PrSbRiHyMQg';

// O gid da aba FUNIL, lido do workflow do n8n que escreve nela. gid não é
// nome: a API de valores pede o NOME da aba, então resolvemos um pelo outro.
const FUNIL_GID = Number(process.env.GOOGLE_FUNIL_GID || 729736578);

// O cabeçalho da aba FUNIL está na linha 4, não na 1 — as três primeiras são
// título e legenda. Ler a partir da 1 traria lixo como nome de coluna e
// NENHUMA linha casaria. Está assim no n8n (headerRow: 4, firstDataRow: 5).
const LINHA_DO_CABECALHO = 4;

// Quem já escolheu saiu do alvo: "Programa" foi transferido para o médico,
// "Consulta" recebeu as instruções de agendamento. Follow-up é para quem viu
// os programas e não respondeu nada.
const ESTAGIO_QUALIFICADO = 'Consulta Proposta';

const soDigitos = (v) => String(v ?? '').replace(/\D/g, '');

// "18/10/2026" -> Date. Ancora à MEIA-NOITE de Mossoró (03:00 UTC): a planilha
// guarda só o dia, e o follow-up conta dias inteiros (Math.floor) às 9h. Até
// 22/10/2026 a âncora era o meio-dia (15:00 UTC), e às 9h do 3º dia tinham se
// passado só 2,9 dias — todo D+3/D+5/D+7 saía um dia atrasado. Com a
// meia-noite, qualquer hora do dia N de Mossoró conta exatamente N dias.
function parseDataBR(texto) {
  const m = /^\s*(\d{1,2})\/(\d{1,2})\/(\d{4})\s*$/.exec(String(texto ?? ''));
  if (!m) return null;
  const [, dia, mes, ano] = m.map(Number);
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;
  const d = new Date(Date.UTC(ano, mes - 1, dia, 3, 0, 0));
  // Rejeita data impossível (31/02 vira 03/03 sozinho no Date).
  if (d.getUTCMonth() !== mes - 1 || d.getUTCDate() !== dia) return null;
  return d;
}

// Transforma a matriz crua do Sheets em objetos com as colunas como chave.
function montarLinhas(valores) {
  const linhas = valores || [];
  const cabecalho = linhas[LINHA_DO_CABECALHO - 1];
  if (!cabecalho) return [];
  return linhas.slice(LINHA_DO_CABECALHO).map((linha) => {
    const obj = {};
    cabecalho.forEach((nome, i) => {
      const chave = String(nome ?? '').trim();
      if (chave) obj[chave] = linha[i];
    });
    return obj;
  });
}

/**
 * Quem, nesta leitura da planilha, deve entrar na fila de follow-up.
 * Pura: recebe as linhas já montadas e devolve o que gravar.
 */
function qualificados(linhas, { ehTesteFn = ehTeste } = {}) {
  const vistos = new Set();
  const saida = [];

  for (const linha of linhas || []) {
    const phone = soDigitos(linha['Telefone']);
    // 12 dígitos = 55 + DDD + 8. Abaixo disso é lixo de planilha, não telefone.
    if (phone.length < 12) continue;
    if (vistos.has(phone)) continue;
    if (ehTesteFn(phone)) continue;

    if (String(linha['Estágio'] ?? '').trim() !== ESTAGIO_QUALIFICADO) continue;
    // Já escolheu: está com o médico ou já foi instruído. Não é alvo.
    if (String(linha['Escolha'] ?? '').trim()) continue;

    const data = parseDataBR(linha['Data 1º Contato']);
    if (!data) continue;

    vistos.add(phone);
    saida.push({
      phone,
      nome: String(linha['Nome'] ?? '').trim(),
      motivo: String(linha['Interesse Principal'] ?? '').trim(),
      formato: String(linha['Formato'] ?? '').trim(),
      catalogoEnviadoEm: data.toISOString(),
    });
  }

  return saida;
}

/**
 * O que fazer com um lead da planilha, dado o que já existe no disco.
 * Pura. Devolve null quando não se deve mexer.
 */
function decidirGravacao(daPlanilha, leadLocal) {
  // Nunca ressuscita quem saiu. PARAR, desqualificado, já é cliente ou está
  // com o médico — a planilha não pode desfazer nenhum desses.
  if (leadLocal && PARADOS.includes(leadLocal.state)) return null;

  // Já está na fila: não reancora o relógio. Reescrever catalogoEnviadoEm a
  // cada leitura empurraria o D+2 para sempre amanhã, e o follow-up nunca
  // sairia — a falha mais silenciosa possível.
  if (leadLocal && leadLocal.catalogoEnviadoEm) return null;

  return {
    phone: daPlanilha.phone,
    nome: daPlanilha.nome || (leadLocal && leadLocal.nome) || '',
    motivo: daPlanilha.motivo || (leadLocal && leadLocal.motivo) || '',
    formato: daPlanilha.formato || (leadLocal && leadLocal.formato) || '',
    state: 'CATALOGO_ENVIADO',
    catalogoEnviadoEm: daPlanilha.catalogoEnviadoEm,
    followupsAgendados: true,
    followupsEnviados: [],
    origem: 'funil-n8n',
  };
}

async function getClient() {
  const opcoes = opcoesDeAuth(['https://www.googleapis.com/auth/spreadsheets.readonly']);
  if (!opcoes) return null;
  const auth = new google.auth.GoogleAuth(opcoes);
  return google.sheets({ version: 'v4', auth: await auth.getClient() });
}

// O gid identifica a aba de forma estável; o nome o médico pode renomear a
// qualquer momento. Resolvemos um pelo outro a cada leitura.
async function nomeDaAba(client) {
  const { data } = await client.spreadsheets.get({ spreadsheetId: SHEET_ID });
  const aba = (data.sheets || []).find((s) => s.properties && s.properties.sheetId === FUNIL_GID);
  return aba ? aba.properties.title : null;
}

async function lerAba() {
  const client = await getClient();
  if (!client || !SHEET_ID) return null;

  const titulo = await nomeDaAba(client);
  if (!titulo) {
    console.error(
      `[funil] nenhuma aba com gid ${FUNIL_GID} na planilha ${SHEET_ID}. ` +
        'Se a aba FUNIL foi recriada, o gid mudou — ajuste GOOGLE_FUNIL_GID.'
    );
    return null;
  }

  const { data } = await client.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `'${titulo}'!A:Z`,
    valueRenderOption: 'UNFORMATTED_VALUE',
    dateTimeRenderOption: 'FORMATTED_STRING',
  });
  return montarLinhas(data.values);
}

/**
 * Lê a planilha e coloca na fila quem ainda não está. Não envia nada: quem
 * envia é o checarFollowups, com todas as travas dele.
 */
// `ler` é injetável de propósito. Sem essa costura, o teste da corrente
// inteira (planilha -> fila -> template) só conseguiria trocar a função
// exportada, que sincronizar() não usa — e passaria verde sem exercitar nada.
async function sincronizar({ ler = lerAba } = {}) {
  let linhas;
  try {
    linhas = await ler();
  } catch (err) {
    // Falha de leitura NÃO pode derrubar a rodada de follow-up: quem já está
    // na fila continua sendo atendido pelo que está no disco.
    console.error(`[funil] falha ao ler a planilha: ${(err && err.message) || err}`);
    return { lidos: 0, novos: 0 };
  }
  if (!linhas) return { lidos: 0, novos: 0 };

  const alvos = qualificados(linhas);
  let novos = 0;

  for (const alvo of alvos) {
    const campos = decidirGravacao(alvo, getLead(alvo.phone));
    if (!campos) continue;
    saveLead(alvo.phone, campos);
    novos += 1;
    // Sem o nome nem o motivo: o log da Railway é de terceiro, e isso aqui é
    // paciente de saúde mental. O telefone já basta para depurar.
    console.log(`[funil] ${alvo.phone} entrou na fila de follow-up (vindo da planilha).`);
  }

  console.log(`[funil] planilha lida: ${alvos.length} qualificado(s), ${novos} novo(s) na fila.`);
  return { lidos: alvos.length, novos };
}

module.exports = {
  sincronizar,
  lerAba,
  montarLinhas,
  qualificados,
  decidirGravacao,
  parseDataBR,
  soDigitos,
  LINHA_DO_CABECALHO,
  ESTAGIO_QUALIFICADO,
};
