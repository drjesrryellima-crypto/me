const test = require('node:test');
const assert = require('node:assert');

// A quinta porta da lista de números de teste, e a última a ser fechada.
//
// Em 18/10/2026 o médico testou o agendamento pelo 7397 — que ESTÁ na lista —
// e o bot criou uma consulta de verdade para as 8h do dia seguinte. As quatro
// portas anteriores (painel, planilha, follow-up pago, alerta) tinham sido
// fechadas em 15/10; esta passou batida porque o agendamento ainda não existia.
//
// Marcar na agenda é a porta que mais importa das cinco: é a única cujo
// estrago aparece com uma pessoa esperando numa sala.

const NA_VARIAVEL = '+5584991110000';
const NO_WEBHOOK = '558491110000';
const PACIENTE = '5584988887777';

// async + await de propósito. Sem esperar, o finally restaura o process.env
// enquanto o corpo do teste ainda está rodando, e a segunda chamada já não vê
// a lista — exatamente a armadilha que o comAmbiente do followup-lote.test.js
// documenta. Caiu nela na primeira versão deste arquivo.
async function comLista(fn) {
  const antes = process.env.NUMEROS_DE_TESTE;
  process.env.NUMEROS_DE_TESTE = NA_VARIAVEL;
  process.env.GOOGLE_CALENDAR_ID = 'agenda@teste';
  for (const m of Object.keys(require.cache)) {
    if (m.includes('/src/')) delete require.cache[m];
  }
  try {
    return await fn(require('../src/google-agenda'));
  } finally {
    if (antes === undefined) delete process.env.NUMEROS_DE_TESTE;
    else process.env.NUMEROS_DE_TESTE = antes;
    for (const m of Object.keys(require.cache)) {
      if (m.includes('/src/')) delete require.cache[m];
    }
  }
}

const QUANDO = { inicio: new Date('2026-10-19T11:00:00.000Z'), nome: 'Teste', formato: 'Presencial' };

test('número de teste não cria evento na agenda', async () => {
  await comLista(async (googleAgenda) => {
    let inseriu = false;
    googleAgenda.usarCliente({ events: { insert: async () => { inseriu = true; return { data: {} }; } } });

    const r = await googleAgenda.marcar({ ...QUANDO, phone: NO_WEBHOOK });
    assert.strictEqual(inseriu, false, 'criou evento para número de teste');
    // ok: true de propósito — o médico precisa ver o "marcado!" que o paciente
    // veria. O que ele não precisa é do horário fantasma na agenda.
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.simulada, true);
  });
});

test('paciente de verdade continua criando o evento', async () => {
  await comLista(async (googleAgenda) => {
    let inserido = null;
    googleAgenda.usarCliente({
      events: {
        insert: async (req) => { inserido = req; return { data: { htmlLink: 'http://x', id: 'abc' } }; },
      },
    });

    const r = await googleAgenda.marcar({ ...QUANDO, phone: PACIENTE });
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.simulada, undefined);
    assert.ok(inserido, 'o paciente de verdade ficou sem evento');
    assert.match(inserido.requestBody.description, new RegExp(PACIENTE));
  });
});

// A lista compara telefone pelos dígitos canônicos: na variável está com o
// nono dígito, no webhook chega sem. As duas formas são o mesmo celular.
test('reconhece o número de teste na forma que a Meta entrega', async () => {
  await comLista(async (googleAgenda) => {
    let inseriu = false;
    googleAgenda.usarCliente({ events: { insert: async () => { inseriu = true; return { data: {} }; } } });

    for (const forma of ['5584991110000', '558491110000', '+55 84 99111-0000']) {
      inseriu = false;
      await googleAgenda.marcar({ ...QUANDO, phone: forma });
      assert.strictEqual(inseriu, false, `criou evento para "${forma}"`);
    }
  });
});

// O motivo que a pessoa contou nunca vai para a agenda: é dado de saúde, e a
// agenda espelha em celular, relógio e notificação de tela bloqueada.
test('o evento leva telefone e formato, nunca o motivo', async () => {
  await comLista(async (googleAgenda) => {
    let inserido = null;
    googleAgenda.usarCliente({
      events: { insert: async (req) => { inserido = req; return { data: { htmlLink: '', id: '' } }; } },
    });

    await googleAgenda.marcar({ ...QUANDO, phone: PACIENTE, nome: 'Ana', formato: 'Online' });
    const texto = JSON.stringify(inserido.requestBody);
    assert.ok(texto.includes('Online'));
    assert.ok(!/ansiedade|depress|motivo:/i.test(texto), texto);
  });
});
