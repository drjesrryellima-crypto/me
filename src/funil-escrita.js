// Grava o lead na aba FUNIL do CRM — a mesma que o fluxo do n8n preenchia.
//
// Por que existe: quando o bot deste repositório passa a atender no lugar do
// n8n, o médico continua olhando UMA planilha (FUNIL), com as colunas e o
// vocabulário de sempre. A aba "Leads" (sheets.js) é outra coisa e não some,
// mas o CRM oficial é esta.
//
// Regras que o código segue, em ordem de importância:
//
// 1. NUNCA sobrescreve a linha inteira. O médico e o n8n antigo escreveram
//    ali (Email, Cidade, Fase do Programa, anotações à mão). Cada gravação
//    toca só as células que o bot é dono, achadas PELO NOME da coluna no
//    cabeçalho (linha 4) — se alguém inserir uma coluna, nada cai no lugar
//    errado.
// 2. Nome, Fonte e Data 1º Contato só entram se a célula estiver vazia: são
//    fatos do primeiro contato, e quem corrigiu à mão sabia mais que o bot.
// 3. Os estágios que só uma pessoa confirma ("Consulta Agendada", "Convertido",
//    "Perdido") nunca são trocados pelo bot — mesma regra de estados.js.
// 4. Falha ao gravar nunca derruba a conversa: o paciente já foi respondido.
//
// Tudo que decide é função pura (planejar*), testável sem rede.

const { google } = require('googleapis');
const { opcoesDeAuth, contaEmUso } = require('./google-credenciais');
const { ehRisco } = require('./estados');
const { ehTeste, canonizar } = require('./numeros-de-teste');

const SHEET_ID =
  process.env.GOOGLE_FUNIL_SHEET_ID || '1FN00DcZW17pruFRsyxDHWijtcSifQVj3PrSbRiHyMQg';
const FUNIL_GID = Number(process.env.GOOGLE_FUNIL_GID || 729736578);
const LINHA_DO_CABECALHO = 4;
const FUSO = 'America/Fortaleza';

// Vocabulário do FUNIL. "Consulta Proposta" é o estágio de quem já viu os
// programas/horários; é o que o follow-up (funil.js) procura.
const ESTAGIO_FUNIL = {
  NOVO: 'Qualificação',
  AGUARDANDO_MOTIVO: 'Qualificação',
  AGUARDANDO_HISTORICO: 'Qualificação',
  AGUARDANDO_FORMATO: 'Qualificação',
  CATALOGO_ENVIADO: 'Consulta Proposta',
  FOLLOWUP_D2: 'Consulta Proposta',
  FOLLOWUP_D3: 'Consulta Proposta',
  FOLLOWUP_D5: 'Consulta Proposta',
  FOLLOWUP_D7: 'Consulta Proposta',
  REENGAJAMENTO_MENSAL: 'Consulta Proposta',
  HANDOFF: 'Consulta Proposta',
  DESQUALIFICADO: 'Desqualificado',
  CLIENTE: 'Convertido',
  DESCADASTRADO: 'Descadastrado',
};

// Só uma pessoa escreve estes: o bot não sabe se a consulta aconteceu, se
// virou cliente ou se a pessoa foi perdida.
const ESTAGIOS_HUMANOS = ['Consulta Agendada', 'Convertido', 'Perdido'];

const vazio = (v) => v === undefined || v === null || String(v).trim() === '';

function dataBR(iso) {
  const d = iso ? new Date(iso) : new Date();
  if (Number.isNaN(d.getTime())) return '';
  const p = new Intl.DateTimeFormat('pt-BR', {
    timeZone: FUSO, day: '2-digit', month: '2-digit', year: 'numeric',
  }).format(d);
  return p; // dd/mm/aaaa
}

// A mesma pessoa aparece com 12 ou 13 dígitos (9º dígito). Compara pela forma
// canônica, senão cada mensagem de quem veio sem o 9 criaria uma linha nova.
const chaveTelefone = (t) => canonizar(t);

function letraDaColuna(indice) {
  let n = indice + 1;
  let letra = '';
  while (n > 0) {
    const resto = (n - 1) % 26;
    letra = String.fromCharCode(65 + resto) + letra;
    n = Math.floor((n - 1) / 26);
  }
  return letra;
}

function indiceDoCabecalho(valores) {
  const cab = (valores || [])[LINHA_DO_CABECALHO - 1] || [];
  const mapa = {};
  cab.forEach((nome, i) => {
    const chave = String(nome ?? '').trim();
    if (chave && !(chave in mapa)) mapa[chave] = i;
  });
  return mapa;
}

// Posição (0-based, dentro de `valores`) da linha do telefone, ou -1.
function acharLinha(valores, colTelefone, telefone) {
  const alvo = chaveTelefone(telefone);
  if (!alvo) return -1;
  for (let i = LINHA_DO_CABECALHO; i < (valores || []).length; i++) {
    const celula = (valores[i] || [])[colTelefone];
    if (!vazio(celula) && chaveTelefone(celula) === alvo) return i;
  }
  return -1;
}

// O que o bot sabe sobre o lead, na língua das colunas do FUNIL.
function camposDoLead(lead, { fonte } = {}) {
  const risco = ehRisco(lead);
  const estagio = risco ? 'Atenção' : ESTAGIO_FUNIL[lead.state] || lead.state || '';
  return {
    Nome: lead.nome || '',
    Telefone: lead.phone || '',
    Fonte: fonte || lead.fonte || 'WhatsApp',
    'Interesse Principal': lead.motivo || '',
    Estágio: estagio,
    'Data 1º Contato': dataBR(lead.createdAt),
    Notas: lead.notas || '',
    Formato: lead.formato || '',
    ...(risco ? { 'Data do proximo checkpoint': dataBR() } : {}),
  };
}

// Colunas que só entram quando a célula está vazia (fatos do 1º contato).
const SO_SE_VAZIO = ['Nome', 'Fonte', 'Data 1º Contato'];

/**
 * Decide o que escrever. Devolve:
 *  { tipo: 'nada' }
 *  { tipo: 'atualizar', linha, celulas: [{ coluna, valor }] }   // linha 1-based
 *  { tipo: 'incluir', linha: [..] }                              // alinhada ao cabeçalho
 */
function planejarGravacao(valores, lead, opcoes = {}) {
  const idx = indiceDoCabecalho(valores);
  if (idx['Telefone'] === undefined) return { tipo: 'nada', motivo: 'cabeçalho sem a coluna Telefone' };

  const campos = camposDoLead(lead, opcoes);
  const pos = acharLinha(valores, idx['Telefone'], lead.phone);

  if (pos < 0) {
    const largura = Math.max(...Object.values(idx)) + 1;
    const linha = new Array(largura).fill('');
    for (const [nome, valor] of Object.entries(campos)) {
      if (idx[nome] !== undefined) linha[idx[nome]] = valor;
    }
    return { tipo: 'incluir', linha };
  }

  const atual = valores[pos] || [];
  const celulas = [];
  const estagioAtual = String(atual[idx['Estágio']] ?? '').trim();

  for (const [nome, valor] of Object.entries(campos)) {
    const i = idx[nome];
    if (i === undefined || nome === 'Telefone') continue;
    const naPlanilha = atual[i];

    if (SO_SE_VAZIO.includes(nome) && !vazio(naPlanilha)) continue;
    if (nome === 'Estágio') {
      if (ESTAGIOS_HUMANOS.includes(estagioAtual)) continue;
      // Quem já está em "Consulta Proposta" não volta a "Qualificação" por uma
      // mensagem tardia; o funil só anda para a frente.
      if (estagioAtual === 'Consulta Proposta' && valor === 'Qualificação') continue;
    }
    // Não apaga dado com vazio: o bot só acrescenta ou corrige.
    if (vazio(valor)) continue;
    if (String(naPlanilha ?? '') === String(valor)) continue;

    celulas.push({ coluna: letraDaColuna(i), valor });
  }

  if (celulas.length === 0) return { tipo: 'nada' };
  return { tipo: 'atualizar', linha: pos + 1, celulas };
}

// ---- Google (única parte que usa a rede) ----

async function getClient() {
  const opcoes = opcoesDeAuth(['https://www.googleapis.com/auth/spreadsheets']);
  if (!opcoes) return null;
  const auth = new google.auth.GoogleAuth(opcoes);
  return google.sheets({ version: 'v4', auth: await auth.getClient() });
}

async function tituloDaAba(client) {
  const { data } = await client.spreadsheets.get({ spreadsheetId: SHEET_ID });
  const aba = (data.sheets || []).find((s) => s.properties && s.properties.sheetId === FUNIL_GID);
  return aba ? aba.properties.title : null;
}

function explicarErro(err) {
  const motivo = (err && err.message) || String(err);
  const quem = contaEmUso() || '(credencial não identificada)';
  let dica = '';
  if (/permission|forbidden|403/i.test(motivo)) {
    dica = `\n  A conta ${quem} precisa ser EDITORA da planilha do CRM (hoje pode estar só como leitora). ` +
      'Compartilhe a planilha com ela como Editor.';
  }
  return `[funil-escrita] falha ao gravar no FUNIL (conta ${quem}): ${motivo}${dica}`;
}

async function gravarNoFunil(lead, opcoes = {}) {
  if (!lead || !lead.phone) return;
  if (ehTeste(lead.phone)) return;      // teste do médico não é paciente

  try {
    const client = await getClient();
    if (!client) return;
    const titulo = await tituloDaAba(client);
    if (!titulo) {
      console.error(`[funil-escrita] nenhuma aba com gid ${FUNIL_GID} na planilha ${SHEET_ID}.`);
      return;
    }
    const { data } = await client.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `'${titulo}'!A:Z`,
      valueRenderOption: 'UNFORMATTED_VALUE',
      dateTimeRenderOption: 'FORMATTED_STRING',
    });
    const plano = planejarGravacao(data.values, lead, opcoes);

    if (plano.tipo === 'incluir') {
      await client.spreadsheets.values.append({
        spreadsheetId: SHEET_ID,
        range: `'${titulo}'!A:Z`,
        valueInputOption: 'RAW',          // telefone e data ficam texto, como o n8n gravava
        insertDataOption: 'INSERT_ROWS',
        requestBody: { values: [plano.linha] },
      });
      console.log(`[funil-escrita] ${lead.phone} incluído no FUNIL.`);
    } else if (plano.tipo === 'atualizar') {
      await client.spreadsheets.values.batchUpdate({
        spreadsheetId: SHEET_ID,
        requestBody: {
          valueInputOption: 'RAW',
          data: plano.celulas.map((c) => ({
            range: `'${titulo}'!${c.coluna}${plano.linha}`,
            values: [[c.valor]],
          })),
        },
      });
      console.log(`[funil-escrita] ${lead.phone}: ${plano.celulas.length} célula(s) atualizada(s) no FUNIL.`);
    } else if (plano.motivo) {
      console.error(`[funil-escrita] nada gravado: ${plano.motivo}`);
    }
  } catch (err) {
    console.error(explicarErro(err));
  }
}

module.exports = {
  gravarNoFunil,
  planejarGravacao,
  camposDoLead,
  indiceDoCabecalho,
  acharLinha,
  letraDaColuna,
  dataBR,
  ESTAGIO_FUNIL,
  ESTAGIOS_HUMANOS,
};
