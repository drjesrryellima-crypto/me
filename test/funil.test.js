const test = require('node:test');
const assert = require('node:assert');

const {
  montarLinhas, qualificados, decidirGravacao, parseDataBR, LINHA_DO_CABECALHO,
} = require('../src/funil');

// A aba FUNIL tem título e legenda nas três primeiras linhas: o cabeçalho
// está na QUARTA. Ler a partir da primeira traria "Dr. Jesrryel Lima" como
// nome de coluna e nenhuma linha casaria — o follow-up ficaria mudo sem erro.
const CABECALHO = ['Nome', 'Telefone', 'Fonte', 'Interesse Principal', 'Estágio', 'Data 1º Contato', 'Escolha', 'Formato'];

function planilha(...linhas) {
  return [
    ['CRM do consultório'],
    [],
    ['Leads que chegaram pelo WhatsApp'],
    CABECALHO,
    ...linhas,
  ];
}

const QUALIFICADA = ['Ana', '5584988880001', 'WhatsApp', 'ansiedade', 'Consulta Proposta', '10/10/2026', '', 'Online'];

test('o cabeçalho é lido da linha 4, não da 1', () => {
  assert.strictEqual(LINHA_DO_CABECALHO, 4);
  const linhas = montarLinhas(planilha(QUALIFICADA));
  assert.strictEqual(linhas.length, 1);
  assert.strictEqual(linhas[0]['Telefone'], '5584988880001');
  assert.strictEqual(linhas[0]['Estágio'], 'Consulta Proposta');
});

test('planilha sem cabeçalho não quebra nem inventa lead', () => {
  assert.deepStrictEqual(montarLinhas([]), []);
  assert.deepStrictEqual(montarLinhas(null), []);
  assert.deepStrictEqual(montarLinhas([['a'], ['b']]), []);
});

test('entra na fila quem viu os programas e não respondeu', () => {
  const alvos = qualificados(montarLinhas(planilha(QUALIFICADA)), { ehTesteFn: () => false });
  assert.strictEqual(alvos.length, 1);
  assert.strictEqual(alvos[0].phone, '5584988880001');
  assert.strictEqual(alvos[0].motivo, 'ansiedade');
});

test('quem ainda está sendo qualificado NÃO entra', () => {
  const emQualificacao = ['Bia', '5584988880002', 'WhatsApp', '', 'Qualificação', '10/10/2026', '', ''];
  const alvos = qualificados(montarLinhas(planilha(emQualificacao)), { ehTesteFn: () => false });
  assert.deepStrictEqual(alvos, []);
});

// Quem escolheu já está com o médico ou já recebeu as instruções. Mandar
// "ficou alguma dúvida?" para quem acabou de ser transferido é ruído.
test('quem já escolheu NÃO entra', () => {
  for (const escolha of ['Programa', 'Consulta']) {
    const linha = ['Caio', '5584988880003', 'WhatsApp', 'insônia', 'Consulta Proposta', '10/10/2026', escolha, 'Online'];
    const alvos = qualificados(montarLinhas(planilha(linha)), { ehTesteFn: () => false });
    assert.deepStrictEqual(alvos, [], `escolha "${escolha}" entrou na fila`);
  }
});

test('linha sem telefone, com telefone curto ou sem data é ignorada', () => {
  const ruins = [
    ['Sem telefone', '', 'WhatsApp', 'x', 'Consulta Proposta', '10/10/2026', '', ''],
    ['Curto', '99887', 'WhatsApp', 'x', 'Consulta Proposta', '10/10/2026', '', ''],
    ['Sem data', '5584988880004', 'WhatsApp', 'x', 'Consulta Proposta', '', '', ''],
    ['Data torta', '5584988880005', 'WhatsApp', 'x', 'Consulta Proposta', 'ontem', '', ''],
  ];
  const alvos = qualificados(montarLinhas(planilha(...ruins)), { ehTesteFn: () => false });
  assert.deepStrictEqual(alvos, []);
});

test('telefone repetido na planilha entra uma vez só', () => {
  const alvos = qualificados(montarLinhas(planilha(QUALIFICADA, QUALIFICADA)), { ehTesteFn: () => false });
  assert.strictEqual(alvos.length, 1);
});

test('o número de teste do médico não entra na fila paga', () => {
  const alvos = qualificados(montarLinhas(planilha(QUALIFICADA)), { ehTesteFn: () => true });
  assert.deepStrictEqual(alvos, []);
});

test('o telefone é comparado só pelos dígitos', () => {
  const formatado = ['Dê', '+55 (84) 98888-0006', 'WhatsApp', 'x', 'Consulta Proposta', '10/10/2026', '', ''];
  const alvos = qualificados(montarLinhas(planilha(formatado)), { ehTesteFn: () => false });
  assert.strictEqual(alvos[0].phone, '5584988880006');
});

test('parseDataBR lê dd/mm/aaaa e recusa data impossível', () => {
  const d = parseDataBR('10/10/2026');
  assert.strictEqual(d.toISOString().slice(0, 10), '2026-10-10');
  // Meio-dia de Mossoró, para a contagem de dias não oscilar com o fuso.
  assert.strictEqual(d.getUTCHours(), 15);
  assert.strictEqual(parseDataBR('31/02/2026'), null);
  assert.strictEqual(parseDataBR('2026-10-10'), null);
  assert.strictEqual(parseDataBR(''), null);
  assert.strictEqual(parseDataBR(null), null);
});

// O coração da sincronização: o que NÃO reescrever.
const DA_PLANILHA = {
  phone: '5584988880001', nome: 'Ana', motivo: 'ansiedade', formato: 'Online',
  catalogoEnviadoEm: '2026-10-10T15:00:00.000Z',
};

test('lead novo entra na fila com o relógio ancorado na data da planilha', () => {
  const campos = decidirGravacao(DA_PLANILHA, null);
  assert.strictEqual(campos.followupsAgendados, true);
  assert.strictEqual(campos.catalogoEnviadoEm, '2026-10-10T15:00:00.000Z');
  assert.strictEqual(campos.state, 'CATALOGO_ENVIADO');
});

// Sem isto o relógio seria reancorado a cada leitura diária, o D+2 venceria
// sempre "amanhã" e NENHUM follow-up sairia nunca — falha muda.
test('quem já está na fila não tem o relógio reancorado', () => {
  const local = { state: 'CATALOGO_ENVIADO', catalogoEnviadoEm: '2026-10-01T15:00:00.000Z' };
  assert.strictEqual(decidirGravacao(DA_PLANILHA, local), null);
});

test('a planilha nunca ressuscita quem saiu', () => {
  for (const state of ['DESCADASTRADO', 'HANDOFF', 'CLIENTE', 'DESQUALIFICADO']) {
    assert.strictEqual(decidirGravacao(DA_PLANILHA, { state }), null, `${state} foi ressuscitado`);
  }
});

test('nome e motivo que já existiam no disco não são apagados por célula vazia', () => {
  const vazio = { ...DA_PLANILHA, nome: '', motivo: '' };
  const local = { state: 'NOVO', nome: 'Ana Maria', motivo: 'insônia' };
  const campos = decidirGravacao(vazio, local);
  assert.strictEqual(campos.nome, 'Ana Maria');
  assert.strictEqual(campos.motivo, 'insônia');
});
