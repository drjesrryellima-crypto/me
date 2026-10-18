const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

// Simula o dia em que o pagamento na Meta é ligado e os templates entram no
// .env, com leads acumulados de semanas atrás. Era aí que o estrago apareceria:
// mensagens pagas, atrasadas, em rajada, em cima de gente que já tinha esfriado.
const DIA = 86400000;

function montar({ comTemplates }) {
  process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'pg-'));
  for (const c of ['D3', 'D5', 'D7']) {
    if (comTemplates) process.env[`WHATSAPP_TEMPLATE_${c}`] = `followup_${c.toLowerCase()}`;
    else delete process.env[`WHATSAPP_TEMPLATE_${c}`];
  }
  for (const m of ['../src/state', '../src/followup', '../src/whatsapp', '../src/freio', '../src/followup-plano']) {
    delete require.cache[require.resolve(m)];
  }
  const whatsapp = require('../src/whatsapp');
  const enviados = [];
  whatsapp.sendTemplate = async (to, nome) => { enviados.push({ to, nome }); return {}; };
  return { state: require('../src/state'), followup: require('../src/followup'), enviados };
}

function semear(state, idades) {
  idades.forEach((dias, i) => {
    state.saveLead(`55849900000${i}`, {
      state: 'CATALOGO_ENVIADO',
      followupsAgendados: true,
      catalogoEnviadoEm: new Date(Date.now() - dias * DIA).toISOString(),
    });
  });
}

test('ligar o pagamento não dispara rajada em quem esfriou', async () => {
  const { state, followup, enviados } = montar({ comTemplates: true });
  semear(state, [45, 30, 21, 14]);

  await followup.checarFollowups();

  assert.equal(enviados.length, 0, `mandou ${enviados.length} mensagens para leads frios`);
  for (let i = 0; i < 4; i++) {
    const lead = state.getLead(`55849900000${i}`);
    assert.equal(lead.followupsAgendados, false, 'o lead frio continua na fila');
    assert.ok((lead.followupsPulados || []).length, 'não registrou o que pulou');
  }
});

test('quem está no prazo recebe UMA mensagem, não a sequência toda', async () => {
  const { state, followup, enviados } = montar({ comTemplates: true });
  // Uma idade por etapa da sequência. O D+2 saiu em 18/10/2026.
  semear(state, [3, 5, 7]);

  await followup.checarFollowups();

  assert.equal(enviados.length, 3, 'um por lead, três leads');
  const porLead = {};
  for (const e of enviados) porLead[e.to] = (porLead[e.to] || 0) + 1;
  for (const [numero, quantas] of Object.entries(porLead)) {
    assert.equal(quantas, 1, `${numero} recebeu ${quantas} de uma vez`);
  }
});

// Sem registro, a mesma etapa "vence" de novo em toda rodada, para sempre.
test('rodar de novo no mesmo dia não manda nada repetido', async () => {
  const { state, followup, enviados } = montar({ comTemplates: true });
  semear(state, [2]);

  await followup.checarFollowups();
  const depoisDaPrimeira = enviados.length;
  await followup.checarFollowups();

  assert.equal(enviados.length, depoisDaPrimeira, 'repetiu na segunda rodada');
});

// Antes de os templates existirem, nada pode ser marcado como enviado — senão
// o lead perderia o follow-up de verdade quando o pagamento fosse ligado.
test('sem template configurado, nada é enviado nem marcado como enviado', async () => {
  const { state, followup, enviados } = montar({ comTemplates: false });
  semear(state, [2]);

  await followup.checarFollowups();

  assert.equal(enviados.length, 0);
  assert.deepEqual(state.getLead('558499000000').followupsEnviados || [], []);
});
