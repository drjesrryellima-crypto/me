const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

// O follow-up D7 mandava literalmente "[preencher 3 horários]" para o paciente,
// porque a variável do template nunca foi preenchida por ninguém. O bug só
// dispararia no dia em que WHATSAPP_TEMPLATE_D7 fosse configurado — ou seja,
// no primeiro dia em que os follow-ups funcionassem de verdade.
function montar() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fup-'));
  process.env.DATA_DIR = dir;
  for (const c of ['D2', 'D3', 'D5', 'D7']) {
    process.env[`WHATSAPP_TEMPLATE_${c}`] = `followup_${c.toLowerCase()}_teste`;
  }
  for (const m of ['../src/state', '../src/followup', '../src/whatsapp']) {
    delete require.cache[require.resolve(m)];
  }
  const whatsapp = require('../src/whatsapp');
  const enviados = [];
  whatsapp.sendTemplate = async (to, nome, lang, components) => {
    enviados.push({ to, nome, lang, components });
    return {};
  };
  return { state: require('../src/state'), followup: require('../src/followup'), enviados };
}

test('nenhum follow-up manda texto de rascunho para o paciente', async () => {
  const { state, followup, enviados } = montar();
  const oitoDiasAtras = new Date(Date.now() - 8 * 24 * 3600 * 1000).toISOString();
  state.saveLead('558499687397', {
    state: 'CATALOGO_ENVIADO',
    followupsAgendados: true,
    catalogoEnviadoEm: oitoDiasAtras,
  });

  await followup.checarFollowups();

  assert.equal(enviados.length, 4, 'os quatro follow-ups deviam ter saído');

  // Só o que é ENVIADO como texto ao paciente. O JSON inteiro não serve: os
  // colchetes das próprias listas dariam falso positivo.
  //
  // Hoje os templates não têm variável, então esta lista vem vazia e o laço
  // não checa nada — e tudo bem: é justamente por estar vazia que nada pode
  // vazar. O teste existe para o dia em que alguém reintroduzir parâmetros.
  const textos = enviados.flatMap((e) =>
    (e.components || []).flatMap((b) => (b.parameters || []).map((p) => String(p.text || '')))
  );
  for (const texto of textos) {
    assert.doesNotMatch(texto, /preencher/, `rascunho vazou para o paciente: ${texto}`);
    assert.doesNotMatch(texto, /[[\]]/, `sobrou placeholder entre colchetes: ${texto}`);
  }
});

// Parâmetro vazio faz a Meta recusar a mensagem inteira. Lead sem nome é o
// caso normal, não a exceção: muita gente escreve "oi" e nada mais.
test('lead sem nome não gera parâmetro vazio', async () => {
  const { state, followup, enviados } = montar();
  state.saveLead('558499687397', {
    state: 'CATALOGO_ENVIADO',
    followupsAgendados: true,
    catalogoEnviadoEm: new Date(Date.now() - 8 * 24 * 3600 * 1000).toISOString(),
    nome: '',
  });

  await followup.checarFollowups();

  for (const envio of enviados) {
    for (const bloco of envio.components || []) {
      for (const p of bloco.parameters || []) {
        assert.ok(String(p.text || '').trim(), `parâmetro vazio em ${envio.nome}`);
      }
    }
  }
});
