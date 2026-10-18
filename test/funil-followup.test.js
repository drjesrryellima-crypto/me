const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

// A corrente inteira: linha na aba FUNIL -> fila -> template enviado no dia
// certo. Os testes de funil.test.js provam as peças; este prova que elas
// estão LIGADAS, que é onde as coisas costumam falhar calado.

const CABECALHO = ['Nome', 'Telefone', 'Fonte', 'Interesse Principal', 'Estágio', 'Data 1º Contato', 'Escolha', 'Formato'];

function planilha(...linhas) {
  return [['CRM'], [], ['legenda'], CABECALHO, ...linhas];
}

function diasAtras(n) {
  const d = new Date(Date.now() - n * 86400000);
  return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;
}

async function comAmbiente(linhasDaPlanilha, fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'funil-'));
  const antes = { ...process.env };
  process.env.DATA_DIR = dir;
  process.env.WHATSAPP_TEMPLATE_D2 = 'followup_d2_conteudo';
  process.env.WHATSAPP_TEMPLATE_D3 = 'followup_d3_duvida';
  delete process.env.NUMEROS_DE_TESTE;
  for (const m of Object.keys(require.cache)) {
    if (m.includes('/src/')) delete require.cache[m];
  }

  const funil = require('../src/funil');
  const sincronizarReal = funil.sincronizar;
  let ler = async () => funil.montarLinhas(linhasDaPlanilha);
  // Passa pela costura `ler`, então o sincronizar REAL roda: o que o teste
  // troca é só de onde vêm as linhas, não a lógica.
  funil.sincronizar = () => sincronizarReal({ ler: () => ler() });
  const usarLeitor = (novo) => { ler = novo; };

  const whatsapp = require('../src/whatsapp');
  const enviados = [];
  whatsapp.sendTemplate = async (phone, template) => { enviados.push({ phone, template }); };

  delete require.cache[require.resolve('../src/followup')];
  const { checarFollowups } = require('../src/followup');

  try {
    return await fn({ checarFollowups, enviados, state: require('../src/state'), usarLeitor });
  } finally {
    process.env = antes;
    for (const m of Object.keys(require.cache)) {
      if (m.includes('/src/')) delete require.cache[m];
    }
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

const linha = (phone, dataBR, estagio = 'Consulta Proposta', escolha = '') =>
  ['Ana', phone, 'WhatsApp', 'ansiedade', estagio, dataBR, escolha, 'Online'];

test('lead da planilha com 2 dias recebe o D2', async () => {
  await comAmbiente(planilha(linha('5584988880001', diasAtras(2))), async ({ checarFollowups, enviados }) => {
    await checarFollowups();
    assert.deepStrictEqual(enviados, [{ phone: '5584988880001', template: 'followup_d2_conteudo' }]);
  });
});

// A trava que mais importa: quem está há semanas na planilha não pode levar
// os quatro follow-ups pagos de uma vez na primeira rodada.
test('lead antigo na planilha não leva uma rajada de templates', async () => {
  await comAmbiente(planilha(linha('5584988880002', diasAtras(30))), async ({ checarFollowups, enviados }) => {
    await checarFollowups();
    assert.deepStrictEqual(enviados, []);
  });
});

test('quem ainda está em Qualificação não recebe nada', async () => {
  await comAmbiente(planilha(linha('5584988880003', diasAtras(2), 'Qualificação')), async ({ checarFollowups, enviados }) => {
    await checarFollowups();
    assert.deepStrictEqual(enviados, []);
  });
});

test('quem já escolheu não recebe nada', async () => {
  await comAmbiente(planilha(linha('5584988880004', diasAtras(2), 'Consulta Proposta', 'Programa')), async ({ checarFollowups, enviados }) => {
    await checarFollowups();
    assert.deepStrictEqual(enviados, []);
  });
});

// Duas rodadas no mesmo dia (um redeploy, por exemplo) não podem cobrar duas
// vezes pela mesma etapa.
test('rodar duas vezes não manda o mesmo D2 de novo', async () => {
  await comAmbiente(planilha(linha('5584988880005', diasAtras(2))), async ({ checarFollowups, enviados }) => {
    await checarFollowups();
    await checarFollowups();
    assert.strictEqual(enviados.length, 1);
  });
});

// A planilha é espelho, não dono: quem pediu PARAR fica fora mesmo
// continuando listado lá.
test('quem pediu PARAR não volta pela planilha', async () => {
  await comAmbiente(planilha(linha('5584988880006', diasAtras(2))), async ({ checarFollowups, enviados, state }) => {
    state.saveLead('5584988880006', { phone: '5584988880006', state: 'DESCADASTRADO' });
    await checarFollowups();
    assert.deepStrictEqual(enviados, []);
  });
});

// Se a leitura da planilha falhar, quem JÁ está na fila continua sendo
// atendido — a rodada não pode morrer junto com a rede do Google.
test('falha ao ler a planilha não derruba a rodada', async () => {
  await comAmbiente(planilha(), async ({ checarFollowups, enviados, state, usarLeitor }) => {
    usarLeitor(async () => { throw new Error('Google fora do ar'); });

    state.saveLead('5584988880007', {
      phone: '5584988880007',
      state: 'CATALOGO_ENVIADO',
      followupsAgendados: true,
      followupsEnviados: [],
      catalogoEnviadoEm: new Date(Date.now() - 2 * 86400000).toISOString(),
    });

    await checarFollowups();
    assert.deepStrictEqual(enviados, [{ phone: '5584988880007', template: 'followup_d2_conteudo' }]);
  });
});
