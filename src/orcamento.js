const fs = require('fs');
const path = require('path');

// Teto diário de mensagens PAGAS (templates).
//
// O freio de src/freio.js limita 3 por pessoa por minuto. Isso impede uma
// enxurrada em cima de um paciente, mas não impede o caso que custa dinheiro:
// um laço, uma data errada ou uma base grande disparando template para
// centenas de leads diferentes — cada um dentro do seu limite individual.
//
// Este arquivo existe porque o teto de gastos que a Meta oferece é de conta de
// ANÚNCIOS. Para mensagem de WhatsApp a cobrança é por limiar de faturamento:
// ela avisa e cobra, não corta. Ou seja: do lado da Meta não há freio. Do lado
// de cá, há.
//
// O número é conservador de propósito. O consultório manda no máximo 4
// follow-ups por lead, uma etapa por dia: 50 por dia cobre um volume muito
// acima do real e ainda assim torna impossível uma conta surpresa.

const TETO_DIA = Number(process.env.TETO_TEMPLATES_DIA || 50);

const DATA_DIR = () => process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const ARQUIVO = () => path.join(DATA_DIR(), 'orcamento.json');

// Dia no fuso do consultório, não em UTC: em Mossoró (UTC-3) o dia de UTC vira
// às 21h local, e o teto zeraria no meio da noite de trabalho de ninguém.
function hojeLocal(agora) {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: process.env.FOLLOWUP_TIMEZONE || 'America/Fortaleza',
    }).format(agora);
  } catch (err) {
    return agora.toISOString().slice(0, 10);
  }
}

function ler() {
  try {
    return JSON.parse(fs.readFileSync(ARQUIVO(), 'utf8') || '{}');
  } catch (err) {
    return {};
  }
}

/**
 * Conta uma mensagem paga e diz se ela pode sair.
 *
 * Síncrono: ler, decidir e gravar precisam ser uma coisa só, senão dois envios
 * concorrentes passam pelo mesmo teto.
 *
 * @returns {{liberado: boolean, enviadosHoje: number, teto: number}}
 */
function registrarTemplate(agora = new Date()) {
  const dia = hojeLocal(agora);
  const dados = ler();
  // Guarda só o dia corrente: histórico de orçamento não serve para nada aqui
  // e faria o arquivo crescer para sempre.
  const enviadosHoje = dados.dia === dia ? dados.enviados || 0 : 0;

  if (enviadosHoje >= TETO_DIA) {
    return { liberado: false, enviadosHoje, teto: TETO_DIA };
  }

  try {
    fs.mkdirSync(DATA_DIR(), { recursive: true });
    fs.writeFileSync(ARQUIVO(), JSON.stringify({ dia, enviados: enviadosHoje + 1 }));
  } catch (err) {
    // Disco cheio não pode derrubar o follow-up do dia inteiro. Sem o arquivo o
    // teto deixa passar — é o comportamento de antes, ruim mas não pior.
    console.warn(`[orcamento] não deu pra gravar o contador: ${err.message}`);
  }

  return { liberado: true, enviadosHoje: enviadosHoje + 1, teto: TETO_DIA };
}

function gastoDeHoje(agora = new Date()) {
  const dados = ler();
  return dados.dia === hojeLocal(agora) ? dados.enviados || 0 : 0;
}

module.exports = { registrarTemplate, gastoDeHoje, TETO_DIA };
