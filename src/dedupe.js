const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'processados.json');

// A Meta reenvia o MESMO evento quando o webhook demora a responder, responde
// erro, ou o ngrok cai no meio. Sem dedupe, o reenvio entra de novo em
// handleIncomingMessage e avança a máquina de estados uma casa a mais: o lead
// que só respondeu "ansiedade" pula de AGUARDANDO_MOTIVO direto pra
// AGUARDANDO_FORMATO, e a resposta dele vira o campo errado na planilha.
//
// Cada mensagem da Meta tem um id único (wamid...). Guardamos os ids já
// processados em disco (e não só em memória) porque reinício de processo é
// rotina aqui — Mac dormindo, ngrok reiniciando, deploy — e a janela de
// reenvio da Meta é maior que isso.

const TTL_MS = 48 * 60 * 60 * 1000; // a Meta reenvia por bem menos que isso
const LIMITE = 5000; // teto de segurança pro arquivo não crescer sem fim

function ensureDb() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(DB_PATH)) fs.writeFileSync(DB_PATH, '{}');
}

function readAll() {
  ensureDb();
  try {
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf8') || '{}');
  } catch {
    return {};
  }
}

// Descarta ids velhos e, se ainda assim passar do teto, mantém só os mais
// recentes. Sem isso o arquivo cresceria pra sempre.
function limpar(registros) {
  const corte = Date.now() - TTL_MS;
  let vivos = Object.entries(registros).filter(([, ts]) => ts > corte);
  if (vivos.length > LIMITE) {
    vivos = vivos.sort((a, b) => b[1] - a[1]).slice(0, LIMITE);
  }
  return Object.fromEntries(vivos);
}

// Retorna true se este id JÁ tinha sido processado antes (ou seja: é reenvio,
// ignore). Retorna false na primeira vez, e nesse caso já marca o id como
// processado — checar e marcar são a mesma operação de propósito, pra não
// existir janela entre uma coisa e outra.
function jaProcessado(messageId) {
  // Sem id não dá pra deduplicar. Acontece no curl de teste do README, nunca
  // numa mensagem real da Meta. Deixa passar em vez de descartar.
  if (!messageId) return false;

  const registros = readAll();
  if (registros[messageId]) return true;

  const atualizado = limpar(registros);
  atualizado[messageId] = Date.now();
  ensureDb();
  fs.writeFileSync(DB_PATH, JSON.stringify(atualizado));
  return false;
}

module.exports = { jaProcessado, limpar, TTL_MS, LIMITE };
