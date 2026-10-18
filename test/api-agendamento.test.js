const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const express = require('express');

// A ponte que o n8n usa para agendar. O contrato é estreito de propósito:
// este serviço CALCULA e devolve texto; quem fala com o paciente é o n8n.
// Dois sistemas mandando mensagem no mesmo número foi o que produziu o
// episódio das 21 mensagens.

const SEGREDO = 'segredo-de-teste';
const PACIENTE = '5584988887777';

async function comServidor(fn, { semSegredo = false } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'apiag-'));
  const antes = { ...process.env };
  process.env.DATA_DIR = dir;
  if (semSegredo) delete process.env.AGENDAMENTO_TOKEN;
  else process.env.AGENDAMENTO_TOKEN = SEGREDO;
  process.env.GOOGLE_CALENDAR_ID = 'agenda@teste';
  for (const m of Object.keys(require.cache)) {
    if (m.includes('/src/')) delete require.cache[m];
  }

  const agendamento = require('../src/agendamento');
  // disponivel() exige CALENDAR_ID *e* credencial do Google, que o ambiente de
  // teste não tem. O que estes testes exercitam é a ponte, não a configuração
  // do Google — essa tem teste próprio logo abaixo.
  agendamento.disponivel = () => true;

  const { criarRouterDeAgendamento } = require('../src/api-agendamento');
  const app = express();
  app.use(express.json());
  app.use(criarRouterDeAgendamento());
  const servidor = app.listen(0);
  const base = `http://127.0.0.1:${servidor.address().port}`;

  const chamar = (rota, corpo, token = SEGREDO) =>
    fetch(`${base}${rota}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Agendamento-Token': token },
      body: JSON.stringify(corpo),
    });

  try {
    return await fn({ chamar, agendamento, state: require('../src/state') });
  } finally {
    servidor.close();
    process.env = antes;
    for (const m of Object.keys(require.cache)) {
      if (m.includes('/src/')) delete require.cache[m];
    }
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('sem o token, ninguém consulta a agenda do médico', async () => {
  await comServidor(async ({ chamar }) => {
    const r = await chamar('/api/agendamento/oferecer', { phone: PACIENTE }, 'errado');
    assert.strictEqual(r.status, 401);
  });
});

test('sem AGENDAMENTO_TOKEN configurado, responde 503 e diz como resolver', async () => {
  await comServidor(async ({ chamar }) => {
    const r = await chamar('/api/agendamento/oferecer', { phone: PACIENTE });
    assert.strictEqual(r.status, 503);
    const corpo = await r.json();
    assert.match(corpo.comoResolver, /AGENDAMENTO_TOKEN/);
  }, { semSegredo: true });
});

// Telefone torto vindo de um nó mal montado no n8n não pode virar consulta
// marcada para ninguém.
test('telefone curto é recusado antes de encostar na agenda', async () => {
  await comServidor(async ({ chamar }) => {
    for (const phone of ['', '55849', undefined]) {
      const r = await chamar('/api/agendamento/oferecer', { phone });
      assert.strictEqual(r.status, 400, `aceitou "${phone}"`);
    }
  });
});

// Sem GOOGLE_CALENDAR_ID ou sem credencial do Google, o agendamento não pode
// nem tentar: responder "vou ver sua agenda" sem conseguir ler seria pior que
// recusar.
test('agendamento desligado responde 503, não finge que consultou', async () => {
  await comServidor(async ({ chamar, agendamento }) => {
    agendamento.disponivel = () => false;
    const r = await chamar('/api/agendamento/oferecer', { phone: PACIENTE });
    assert.strictEqual(r.status, 503);
    assert.match((await r.json()).erro, /desligado/);
  });
});

test('oferecer devolve o texto das vagas e guarda o que ofereceu', async () => {
  await comServidor(async ({ chamar, agendamento, state }) => {
    agendamento.oferecer = async () => ({
      texto: '1) segunda às 9h\n2) terça às 10h\n3) quarta às 14h',
      campos: { vagasOferecidas: { horarios: ['2026-10-20T12:00:00.000Z'], em: new Date().toISOString() } },
    });

    const r = await chamar('/api/agendamento/oferecer', { phone: PACIENTE, nome: 'Ana' });
    assert.strictEqual(r.status, 200);
    const corpo = await r.json();
    assert.strictEqual(corpo.temVagas, true);
    assert.match(corpo.texto, /segunda às 9h/);

    // O estado da oferta fica AQUI, não no n8n: é este serviço que vai
    // precisar dele para entender a resposta do paciente.
    const lead = state.getLead(PACIENTE);
    assert.ok(lead.vagasOferecidas.horarios.length);
    assert.strictEqual(lead.nome, 'Ana');
  });
});

test('sem vaga no horizonte, diz que não tem — e avisa que não tem', async () => {
  await comServidor(async ({ chamar, agendamento }) => {
    agendamento.oferecer = async () => ({
      texto: 'Não encontrei horário livre.', semVagas: true, motivo: 'nenhuma vaga no horizonte',
    });
    const corpo = await (await chamar('/api/agendamento/oferecer', { phone: PACIENTE })).json();
    assert.strictEqual(corpo.temVagas, false);
    assert.strictEqual(corpo.motivo, 'nenhuma vaga no horizonte');
  });
});

test('confirmar marca e devolve quando', async () => {
  await comServidor(async ({ chamar, agendamento, state }) => {
    state.saveLead(PACIENTE, { phone: PACIENTE });
    agendamento.confirmar = async () => ({
      marcada: true, quando: 'segunda, 20 de outubro, às 9h',
      texto: 'Marcado!', campos: { vagasOferecidas: null, consultaEm: '2026-10-20T12:00:00.000Z' },
    });

    const corpo = await (await chamar('/api/agendamento/confirmar', { phone: PACIENTE, resposta: '1' })).json();
    assert.strictEqual(corpo.marcada, true);
    assert.strictEqual(corpo.quando, 'segunda, 20 de outubro, às 9h');
    assert.strictEqual(state.getLead(PACIENTE).consultaEm, '2026-10-20T12:00:00.000Z');
  });
});

// "semOferta" não é erro: é "esta mensagem não era sobre agendamento". O n8n
// usa isso para seguir o fluxo normal dele em vez de responder bobagem.
test('mensagem que não é resposta a oferta devolve semOferta, não erro', async () => {
  await comServidor(async ({ chamar, agendamento, state }) => {
    state.saveLead(PACIENTE, { phone: PACIENTE });
    agendamento.confirmar = async () => null;
    const r = await chamar('/api/agendamento/confirmar', { phone: PACIENTE, resposta: 'oi tudo bem?' });
    assert.strictEqual(r.status, 200);
    assert.deepStrictEqual(await r.json(), { semOferta: true });
  });
});

test('paciente desconhecido não quebra o confirmar', async () => {
  await comServidor(async ({ chamar }) => {
    const r = await chamar('/api/agendamento/confirmar', { phone: '5584900001111', resposta: '2' });
    assert.strictEqual(r.status, 200);
    assert.deepStrictEqual(await r.json(), { semOferta: true });
  });
});

// A vaga pode ter sido tomada entre a oferta e a resposta. O agendamento
// reconfere antes de marcar; aqui garantimos que a ponte repassa a recusa em
// vez de dizer que marcou.
test('vaga perdida volta como falhou, não como marcada', async () => {
  await comServidor(async ({ chamar, agendamento, state }) => {
    state.saveLead(PACIENTE, { phone: PACIENTE });
    agendamento.confirmar = async () => ({
      falhou: true, texto: 'Esse horário acabou de ser preenchido.',
      motivo: 'o horário foi ocupado', campos: { vagasOferecidas: null },
    });
    const corpo = await (await chamar('/api/agendamento/confirmar', { phone: PACIENTE, resposta: '1' })).json();
    assert.strictEqual(corpo.marcada, false);
    assert.strictEqual(corpo.falhou, true);
  });
});

test('erro na agenda vira 500, não consulta fantasma', async () => {
  await comServidor(async ({ chamar, agendamento, state }) => {
    state.saveLead(PACIENTE, { phone: PACIENTE });
    agendamento.confirmar = async () => { throw new Error('Google fora do ar'); };
    const r = await chamar('/api/agendamento/confirmar', { phone: PACIENTE, resposta: '1' });
    assert.strictEqual(r.status, 500);
  });
});
