const test = require('node:test');
const assert = require('node:assert');
const {
  planejarGravacao, camposDoLead, acharLinha, indiceDoCabecalho, letraDaColuna, dataBR,
} = require('../src/funil-escrita');

// Cabeçalho na linha 4, como a aba FUNIL real (3 linhas de título antes).
const CAB = ['Nome', 'Email', 'Telefone', 'Fonte', 'Interesse Principal', 'Estágio', 'Data 1º Contato',
  'Data do proximo checkpoint', 'Notas', 'Fase do Programa', 'Cidade', 'Formato', 'Escolha'];
const planilha = (...linhas) => [['Título'], [''], [''], CAB, ...linhas];
const linha = (o) => CAB.map((c) => (o[c] === undefined ? '' : o[c]));

const lead = (extra = {}) => ({
  phone: '558497096643', nome: 'Maria', state: 'AGUARDANDO_MOTIVO', motivo: '', formato: '',
  createdAt: '2026-10-26T15:00:00.000Z', notas: '', ...extra,
});

test('letra da coluna: A, Z, AA', () => {
  assert.deepStrictEqual([0, 25, 26, 27].map(letraDaColuna), ['A', 'Z', 'AA', 'AB']);
});

test('data no formato do FUNIL, no fuso de Mossoró (23h de lá ainda é o mesmo dia)', () => {
  assert.strictEqual(dataBR('2026-10-27T01:30:00.000Z'), '26/10/2026');
});

test('lead novo vira linha alinhada ao CABEÇALHO, não a posições fixas', () => {
  const p = planejarGravacao(planilha(), lead({ fonte: 'Meta Ads' }));
  assert.strictEqual(p.tipo, 'incluir');
  const idx = indiceDoCabecalho(planilha());
  assert.strictEqual(p.linha[idx['Telefone']], '558497096643');
  assert.strictEqual(p.linha[idx['Nome']], 'Maria');
  assert.strictEqual(p.linha[idx['Fonte']], 'Meta Ads');
  assert.strictEqual(p.linha[idx['Estágio']], 'Qualificação');
  assert.strictEqual(p.linha[idx['Data 1º Contato']], '26/10/2026');
  assert.strictEqual(p.linha[idx['Email']], '');
});

test('coluna inserida no meio do cabeçalho não desloca nada', () => {
  const cab2 = ['Nome', 'COLUNA NOVA', ...CAB.slice(1)];
  const v = [[''], [''], [''], cab2];
  const p = planejarGravacao(v, lead());
  assert.strictEqual(p.linha[cab2.indexOf('Telefone')], '558497096643');
  assert.strictEqual(p.linha[cab2.indexOf('COLUNA NOVA')], '');
});

test('sem a coluna Telefone no cabeçalho não grava nada', () => {
  assert.strictEqual(planejarGravacao([[''], [''], [''], ['A', 'B']], lead()).tipo, 'nada');
});

test('telefone com e sem o 9º dígito é a MESMA pessoa (não cria linha duplicada)', () => {
  const v = planilha(linha({ Telefone: '5584997096643', Nome: 'Maria', Estágio: 'Qualificação' }));
  assert.strictEqual(acharLinha(v, 2, '558497096643'), 4);
  assert.strictEqual(planejarGravacao(v, lead({ motivo: 'ansiedade' })).tipo, 'atualizar');
});

test('telefone gravado como número (sem aspas) ainda casa', () => {
  const v = planilha(linha({ Telefone: 558497096643 }));
  assert.strictEqual(acharLinha(v, 2, '558497096643'), 4);
});

test('atualização mexe SÓ nas células do bot e preserva o resto da linha', () => {
  const v = planilha(linha({
    Nome: 'Maria', Email: 'm@x.com', Telefone: '558497096643', Fonte: 'Meta Ads', Cidade: 'Mossoró',
    'Fase do Programa': 'Fase 2', Estágio: 'Qualificação', 'Data 1º Contato': '20/10/2026',
  }));
  const p = planejarGravacao(v, lead({ motivo: 'ansiedade', state: 'AGUARDANDO_HISTORICO' }));
  assert.strictEqual(p.tipo, 'atualizar');
  assert.strictEqual(p.linha, 5);
  const colunas = p.celulas.map((c) => c.coluna).sort();
  assert.deepStrictEqual(colunas, ['E']);   // só Interesse Principal
  assert.ok(!p.celulas.some((c) => ['B', 'K', 'J', 'D', 'G', 'A'].includes(c.coluna)));
});

test('Nome, Fonte e Data 1º Contato não são sobrescritos quando já têm valor', () => {
  const v = planilha(linha({
    Nome: 'Maria da Silva', Telefone: '558497096643', Fonte: 'Meta Ads', 'Data 1º Contato': '01/10/2026',
    Estágio: 'Qualificação',
  }));
  const p = planejarGravacao(v, lead({ nome: 'Maria', fonte: 'WhatsApp', motivo: 'sono' }));
  assert.ok(!p.celulas.some((c) => ['A', 'D', 'G'].includes(c.coluna)));
});

test('Fonte e Nome vazios na planilha são preenchidos', () => {
  const v = planilha(linha({ Telefone: '558497096643', Estágio: 'Qualificação' }));
  const p = planejarGravacao(v, lead({ fonte: 'Meta Ads' }));
  const por = Object.fromEntries(p.celulas.map((c) => [c.coluna, c.valor]));
  assert.strictEqual(por['A'], 'Maria');
  assert.strictEqual(por['D'], 'Meta Ads');
});

test('estágios que só uma pessoa confirma nunca são trocados pelo bot', () => {
  for (const humano of ['Consulta Agendada', 'Convertido', 'Perdido']) {
    const v = planilha(linha({ Telefone: '558497096643', Estágio: humano, Nome: 'Maria', Fonte: 'x', 'Data 1º Contato': 'x' }));
    const p = planejarGravacao(v, lead({ state: 'HANDOFF', notas: 'RISCO/CRISE — algo' }));
    assert.ok(!(p.celulas || []).some((c) => c.coluna === 'F'), `bot trocou "${humano}"`);
  }
});

test('o funil só anda para a frente: Consulta Proposta não volta a Qualificação', () => {
  const v = planilha(linha({ Telefone: '558497096643', Estágio: 'Consulta Proposta', Nome: 'M', Fonte: 'x', 'Data 1º Contato': 'x' }));
  const p = planejarGravacao(v, lead({ state: 'AGUARDANDO_MOTIVO', motivo: 'x' }));
  assert.ok(!(p.celulas || []).some((c) => c.coluna === 'F'));
});

test('catálogo enviado vira "Consulta Proposta" (o que o follow-up procura)', () => {
  assert.strictEqual(camposDoLead(lead({ state: 'CATALOGO_ENVIADO' }))['Estágio'], 'Consulta Proposta');
});

test('crise vira "Atenção" e marca a data do próximo checkpoint', () => {
  const c = camposDoLead(lead({ state: 'AGUARDANDO_MOTIVO', notas: 'RISCO/CRISE — orientado a 188/192' }));
  assert.strictEqual(c['Estágio'], 'Atenção');
  assert.ok(c['Data do proximo checkpoint']);
});

test('descadastro vira "Descadastrado"', () => {
  assert.strictEqual(camposDoLead(lead({ state: 'DESCADASTRADO' }))['Estágio'], 'Descadastrado');
});

test('valor vazio do bot nunca apaga o que está na planilha', () => {
  const v = planilha(linha({ Telefone: '558497096643', 'Interesse Principal': 'ansiedade', Formato: 'Online', Estágio: 'Qualificação', Nome: 'M', Fonte: 'x', 'Data 1º Contato': 'x' }));
  const p = planejarGravacao(v, lead({ motivo: '', formato: '' }));
  assert.strictEqual(p.tipo, 'nada');
});

test('nada mudou, nada é gravado (não gasta cota do Google à toa)', () => {
  const v = planilha(linha({ Telefone: '558497096643', Nome: 'Maria', Fonte: 'WhatsApp', Estágio: 'Qualificação', 'Data 1º Contato': '26/10/2026' }));
  assert.strictEqual(planejarGravacao(v, lead()).tipo, 'nada');
});

test('a cidade que a pessoa informou vai para a coluna Cidade', () => {
  const p = planejarGravacao(planilha(), lead({ cidade: 'Mossoró' }));
  const idx = indiceDoCabecalho(planilha());
  assert.strictEqual(p.linha[idx['Cidade']], 'Mossoró');
});

test('o estado da cidade conta como Qualificação no FUNIL', () => {
  assert.strictEqual(camposDoLead(lead({ state: 'AGUARDANDO_CIDADE' }))['Estágio'], 'Qualificação');
});
