const { google } = require('googleapis');
const { opcoesDeAuth, contaEmUso } = require('./google-credenciais');
const { DURACAO_MIN } = require('./vagas');

// A agenda real do médico, lida e escrita pela conta de serviço.
//
// Ela só enxerga o calendário se ele tiver sido COMPARTILHADO com o e-mail da
// conta de serviço, com permissão de "fazer alterações nos eventos". É o mesmo
// tipo de permissão da planilha, e é por isso que o erro aqui explica o que
// fazer em vez de só repetir o que o Google disse.
const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID || '';
const ESCOPO = ['https://www.googleapis.com/auth/calendar'];

let clienteFalso = null; // só os testes mexem nisto
let cliente = null;

function usarCliente(c) { clienteFalso = c; cliente = null; }

async function getClient() {
  if (clienteFalso) return clienteFalso;
  if (cliente) return cliente;
  const opcoes = opcoesDeAuth(ESCOPO);
  if (!opcoes) {
    console.warn('[agenda-google] credenciais do Google não encontradas — agendamento automático desligado.');
    return null;
  }
  const auth = new google.auth.GoogleAuth(opcoes);
  cliente = google.calendar({ version: 'v3', auth: await auth.getClient() });
  return cliente;
}

function configurado() {
  return Boolean(CALENDAR_ID) && Boolean(opcoesDeAuth(ESCOPO));
}

// Mesma ideia do sheets.js: dizer QUEM tentou, EM QUE agenda, e o que fazer.
// "The caller does not have permission" sozinho já mandou a investigação para
// o lugar errado uma vez neste projeto.
function explicarErro(err) {
  const motivo = (err && err.message) || String(err);
  const quem = contaEmUso() || '(credencial não identificada)';
  const onde = CALENDAR_ID || '(GOOGLE_CALENDAR_ID vazio)';
  const base = `[agenda-google] falha — conta ${quem}, agenda ${onde}: ${motivo}`;
  if (/permission|forbidden|notFound|not found/i.test(motivo)) {
    return `${base}
  Quase sempre é compartilhamento: abra o Google Agenda → Configurações → a
  agenda acima → "Compartilhar com pessoas específicas" → adicione a conta
  ${quem} com permissão de FAZER ALTERAÇÕES NOS EVENTOS.
  Permissão de só ver não serve: o bot precisa criar o compromisso.`;
  }
  return base;
}

/** Intervalos ocupados entre duas datas. Lista vazia quando não dá para saber. */
async function ocupados(inicio, fim) {
  const client = await getClient();
  if (!client || !CALENDAR_ID) return null;
  try {
    const { data } = await client.freebusy.query({
      requestBody: {
        timeMin: inicio.toISOString(),
        timeMax: fim.toISOString(),
        items: [{ id: CALENDAR_ID }],
      },
    });
    const bruto = (data.calendars && data.calendars[CALENDAR_ID] && data.calendars[CALENDAR_ID].busy) || [];
    return bruto.map((b) => ({ inicio: b.start, fim: b.end }));
  } catch (err) {
    console.error(explicarErro(err));
    return null;
  }
}

/**
 * Cria o compromisso. Devolve { ok, link } ou { ok: false, erro }.
 *
 * O nome do paciente vai no título e o telefone na descrição — é o que o
 * médico precisa ver na tela do celular para saber quem vai entrar na sala.
 * O MOTIVO que a pessoa contou NÃO vai: é dado de saúde, e agenda é a coisa
 * mais compartilhada que existe (espelha em celular, relógio, notificação na
 * tela de bloqueio). Quem precisa do motivo abre o painel.
 */
async function marcar({ inicio, nome, phone, formato }) {
  const client = await getClient();
  if (!client || !CALENDAR_ID) return { ok: false, erro: 'agendamento automático não configurado' };
  const fim = new Date(inicio.getTime() + DURACAO_MIN * 60000);
  try {
    const { data } = await client.events.insert({
      calendarId: CALENDAR_ID,
      requestBody: {
        summary: `Consulta — ${nome || phone}`,
        description: `Agendado pela assistente do WhatsApp.\nTelefone: ${phone}\nFormato: ${formato || 'a confirmar'}`,
        start: { dateTime: inicio.toISOString(), timeZone: 'America/Fortaleza' },
        end: { dateTime: fim.toISOString(), timeZone: 'America/Fortaleza' },
      },
    });
    return { ok: true, link: data.htmlLink, id: data.id };
  } catch (err) {
    console.error(explicarErro(err));
    return { ok: false, erro: (err && err.message) || String(err) };
  }
}

module.exports = { ocupados, marcar, configurado, explicarErro, usarCliente, CALENDAR_ID, ESCOPO };
