const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'leads.json');

function ensureDb() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(DB_PATH)) fs.writeFileSync(DB_PATH, '{}');
}

function readAll() {
  ensureDb();
  const raw = fs.readFileSync(DB_PATH, 'utf8');
  try {
    return JSON.parse(raw || '{}');
  } catch {
    return {};
  }
}

function writeAll(data) {
  ensureDb();
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

function getLead(phone) {
  const all = readAll();
  return all[phone] || null;
}

function saveLead(phone, lead) {
  const all = readAll();
  all[phone] = { ...(all[phone] || {}), ...lead, phone, updatedAt: new Date().toISOString() };
  writeAll(all);
  return all[phone];
}

function createLeadIfMissing(phone) {
  const existing = getLead(phone);
  if (existing) return existing;
  return saveLead(phone, {
    phone,
    state: 'NOVO',
    motivo: '',
    historico: '',
    formato: '',
    classificacao: '',
    createdAt: new Date().toISOString(),
    followupsAgendados: false,
  });
}

module.exports = { getLead, saveLead, createLeadIfMissing, readAll };
