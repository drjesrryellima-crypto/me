const test = require('node:test');
const assert = require('node:assert');

function carregar({ calendarId = 'agenda@exemplo.com', conta = true } = {}) {
  for (const m of ['../src/google-agenda', '../src/google-credenciais', '../src/vagas']) {
    delete require.cache[require.resolve(m)];
  }
  process.env.GOOGLE_CALENDAR_ID = calendarId;
  if (conta) {
    process.env.GOOGLE_SERVICE_ACCOUNT_CREDENTIALS = JSON.stringify({
      client_email: 'bot-whatsapp@exemplo.iam.gserviceaccount.com',
      private_key: '-----BEGIN PRIVATE KEY-----\nfalsa\n-----END PRIVATE KEY-----\n',
    });
  } else {
    delete process.env.GOOGLE_SERVICE_ACCOUNT_CREDENTIALS;
  }
  return require('../src/google-agenda');
}

test('traduz "sem permissão" em o que fazer, com conta e agenda nomeadas', () => {
  const g = carregar({ calendarId: 'drjesrryel@exemplo.com' });
  const texto = g.explicarErro(new Error('The caller does not have permission'));
  assert.match(texto, /bot-whatsapp@exemplo\.iam\.gserviceaccount\.com/);
  assert.match(texto, /drjesrryel@exemplo\.com/);
  assert.match(texto, /FAZER ALTERAÇÕES NOS EVENTOS/);
  // Permissão de leitura não serve, e o erro precisa dizer isso: é o engano
  // mais provável de quem for compartilhar correndo.
  assert.match(texto, /só ver não serve/i);
});

test('a chave privada nunca entra na mensagem de erro', () => {
  const g = carregar();
  const texto = g.explicarErro(new Error('The caller does not have permission'));
  assert.doesNotMatch(texto, /BEGIN PRIVATE KEY/);
  assert.doesNotMatch(texto, /falsa/);
});

test('sem GOOGLE_CALENDAR_ID, o agendamento fica desligado em vez de chutar', () => {
  const g = carregar({ calendarId: '' });
  assert.equal(g.configurado(), false);
});

test('lê os ocupados no formato que o cálculo de vagas espera', async () => {
  const g = carregar();
  g.usarCliente({
    freebusy: {
      query: async () => ({
        data: { calendars: { 'agenda@exemplo.com': { busy: [
          { start: '2026-10-21T12:00:00Z', end: '2026-10-21T13:00:00Z' },
        ] } } },
      }),
    },
  });
  const lista = await g.ocupados(new Date('2026-10-21T00:00:00Z'), new Date('2026-10-22T00:00:00Z'));
  assert.deepEqual(lista, [{ inicio: '2026-10-21T12:00:00Z', fim: '2026-10-21T13:00:00Z' }]);
});

// null e [] significam coisas opostas: [] é "a agenda está livre", null é "não
// consegui saber". Confundir os dois faz o bot oferecer a agenda inteira
// quando o Google está fora do ar — e marcar em cima de todo mundo.
test('falha ao ler devolve null, não lista vazia', async () => {
  const g = carregar();
  g.usarCliente({ freebusy: { query: async () => { throw new Error('ECONNRESET'); } } });
  assert.equal(await g.ocupados(new Date(), new Date()), null);
});

test('marca a consulta com uma hora de duração', async () => {
  const g = carregar();
  let recebido = null;
  g.usarCliente({ events: { insert: async (req) => { recebido = req; return { data: { htmlLink: 'x', id: '1' } }; } } });
  const r = await g.marcar({
    inicio: new Date('2026-10-21T14:00:00-03:00'),
    nome: 'Maria', phone: '5584999990001', formato: 'Online',
  });
  assert.equal(r.ok, true);
  const dur = new Date(recebido.requestBody.end.dateTime) - new Date(recebido.requestBody.start.dateTime);
  assert.equal(dur, 60 * 60 * 1000);
  assert.equal(recebido.requestBody.start.timeZone, 'America/Fortaleza');
});

test('o compromisso diz quem é e como falar com a pessoa', async () => {
  const g = carregar();
  let recebido = null;
  g.usarCliente({ events: { insert: async (req) => { recebido = req; return { data: {} }; } } });
  await g.marcar({ inicio: new Date(), nome: 'Maria', phone: '5584999990001', formato: 'Presencial' });
  assert.match(recebido.requestBody.summary, /Maria/);
  assert.match(recebido.requestBody.description, /5584999990001/);
  assert.match(recebido.requestBody.description, /Presencial/);
});

// Agenda é a coisa mais compartilhada que existe: espelha em celular, relógio
// e notificação na tela de bloqueio. O que a pessoa contou sobre a saúde dela
// não pode viajar junto.
test('o motivo clínico NÃO vai para a agenda', async () => {
  const g = carregar();
  let recebido = null;
  g.usarCliente({ events: { insert: async (req) => { recebido = req; return { data: {} }; } } });
  await g.marcar({
    inicio: new Date(), nome: 'Maria', phone: '5584999990001',
    formato: 'Online', motivo: 'crises de pânico desde a separação',
  });
  const tudo = JSON.stringify(recebido);
  assert.doesNotMatch(tudo, /pânico/i);
  assert.doesNotMatch(tudo, /separação/i);
});

test('falha ao marcar devolve o motivo em vez de explodir', async () => {
  const g = carregar();
  g.usarCliente({ events: { insert: async () => { throw new Error('The caller does not have permission'); } } });
  const r = await g.marcar({ inicio: new Date(), nome: 'Maria', phone: '55849' });
  assert.equal(r.ok, false);
  assert.match(r.erro, /permission/i);
});
