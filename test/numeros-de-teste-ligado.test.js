const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

// O módulo estar certo não é o mesmo que estar ligado. Estes testes cobrem os
// lugares por onde o teste do próprio médico vazava: a fila paga, a planilha de
// CRM, o alerta no celular e a conta de leads do painel.
//
// Os números abaixo são de teste no sentido literal (não existem) e estão em
// formatos diferentes de propósito: na variável com o 9º dígito, no lead sem
// ele — é assim que a Meta entrega.
const NA_VARIAVEL = '+5584991110000';
const NO_WEBHOOK = '558491110000';
const OUTRO = '5584988887777';

async function comAmbiente(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'teste-numeros-'));
  const antes = { ...process.env };
  process.env.DATA_DIR = dir;
  process.env.NUMEROS_DE_TESTE = NA_VARIAVEL;
  process.env.WHATSAPP_TEMPLATE_D3 = 'lembrete_d3';
  for (const m of Object.keys(require.cache)) {
    if (m.includes('/src/')) delete require.cache[m];
  }
  try {
    return await fn(dir);
  } finally {
    process.env = antes;
    for (const m of Object.keys(require.cache)) {
      if (m.includes('/src/')) delete require.cache[m];
    }
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('o follow-up pago não vai para o número de teste, e vai para os outros', async () => {
  await comAmbiente(async () => {
    const whatsapp = require('../src/whatsapp');
    const state = require('../src/state');

    const tentados = [];
    whatsapp.sendTemplate = async (phone) => { tentados.push(phone); };

    delete require.cache[require.resolve('../src/followup')];
    const { checarFollowups } = require('../src/followup');

    const tresDiasAtras = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    for (const phone of [NO_WEBHOOK, OUTRO]) {
      state.saveLead(phone, {
        phone,
        state: 'CATALOGO_ENVIADO',
        followupsAgendados: true,
        followupsEnviados: [],
        catalogoEnviadoEm: tresDiasAtras,
        ultimaAtualizacao: tresDiasAtras,
      });
    }

    await checarFollowups();

    assert.ok(!tentados.includes(NO_WEBHOOK), `cobrou um template para o número de teste: ${JSON.stringify(tentados)}`);
    assert.ok(tentados.includes(OUTRO), `o paciente de verdade ficou sem follow-up: ${JSON.stringify(tentados)}`);
  });
});

test('o número de teste não entra na planilha de CRM', async () => {
  await comAmbiente(async () => {
    const sheets = require('../src/sheets');

    // gravarLeadNaPlanilha chama appendLeadRow por dentro do módulo, então
    // trocar a função exportada não intercepta nada — e um teste assim passaria
    // igual sem a proteção, que é pior do que não ter teste. O que o portão faz
    // de observável é a linha de log; é nela que o teste encosta.
    const logs = [];
    const original = console.log;
    console.log = (...args) => logs.push(args.join(' '));
    try {
      await sheets.gravarLeadNaPlanilha({ phone: NO_WEBHOOK, nome: 'Teste' });
      await sheets.gravarLeadNaPlanilha({ phone: OUTRO, nome: 'Paciente' });
    } finally {
      console.log = original;
    }

    const barrados = logs.filter((l) => l.includes('fora da planilha'));
    assert.strictEqual(barrados.length, 1, `esperava barrar só o teste, barrou: ${JSON.stringify(logs)}`);
    assert.ok(barrados[0].includes(NO_WEBHOOK), `barrou o telefone errado: ${barrados[0]}`);
  });
});

test('o número de teste não toca o celular do médico', async () => {
  await comAmbiente(async () => {
    const telegram = require('../src/telegram');
    const enviados = [];
    telegram.enviarAlerta = async (texto) => { enviados.push(texto); return true; };

    const { sendHandoffAlert } = require('../src/alert');

    await sendHandoffAlert({
      priority: 'ALTA',
      phone: NO_WEBHOOK,
      motivo: 'teste',
      classificacao: 'quente',
      ultimaMensagem: 'oi',
    });
    assert.deepStrictEqual(enviados, [], 'o teste do médico virou alerta no celular dele');

    await sendHandoffAlert({
      priority: 'ALTA',
      phone: OUTRO,
      motivo: 'dúvida de valor',
      classificacao: 'quente',
      ultimaMensagem: 'quanto custa?',
    });
    assert.strictEqual(enviados.length, 1, 'o paciente de verdade ficou sem alerta');
  });
});

test('o painel esconde o teste por padrão e mostra com ?testes=1', async () => {
  await comAmbiente(async () => {
    const state = require('../src/state');
    state.saveLead(NO_WEBHOOK, { phone: NO_WEBHOOK, state: 'HANDOFF' });
    state.saveLead(OUTRO, { phone: OUTRO, state: 'NOVO' });

    process.env.DASHBOARD_TOKEN = 'token-de-teste';
    delete require.cache[require.resolve('../src/dashboard')];
    const express = require('express');
    const { criarRouter } = require('../src/dashboard');

    const app = express();
    app.use(criarRouter());
    const servidor = app.listen(0);
    const porta = servidor.address().port;

    try {
      const base = `http://127.0.0.1:${porta}/api/leads?token=token-de-teste`;

      const escondido = await (await fetch(base)).json();
      assert.deepStrictEqual(escondido.leads.map((l) => l.phone), [OUTRO]);
      assert.strictEqual(escondido.testes.escondidos, 1);

      const mostrando = await (await fetch(`${base}&testes=1`)).json();
      const telefones = mostrando.leads.map((l) => l.phone).sort();
      assert.deepStrictEqual(telefones, [NO_WEBHOOK, OUTRO].sort());
      // Precisa poder reativar um teste travado em HANDOFF — por isso ele
      // reaparece, e por isso vem marcado.
      const linha = mostrando.leads.find((l) => l.phone === NO_WEBHOOK);
      assert.strictEqual(linha.teste, true);
    } finally {
      servidor.close();
    }
  });
});
