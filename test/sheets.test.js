const test = require('node:test');
const assert = require('node:assert');
const { encontrarLinha, soDigitos } = require('../src/sheets');

// A coluna A vem da API do Sheets. O telefone é gravado com USER_ENTERED, então
// o Sheets guarda como número — e devolve em formatos diferentes conforme o
// locale e o formato da célula. O upsert precisa reconhecer o lead em todos eles,
// senão cada mensagem recebida cria uma linha nova e a planilha vira um log.
test('encontra o lead independente de como o Sheets formatou o telefone', () => {
  const cabecalho = ['Telefone'];

  const casos = {
    'texto puro': '5584999990001',
    'número cru (UNFORMATTED_VALUE)': 5584999990001,
    'com separador de milhar do locale pt-BR': '5.584.999.990.001',
    'notação científica': '5584999990001',
    'com máscara de telefone': '+55 (84) 99999-0001',
  };

  for (const [descricao, valorNaCelula] of Object.entries(casos)) {
    const colunaA = [cabecalho, ['5584988887777'], [valorNaCelula]];
    assert.strictEqual(encontrarLinha(colunaA, '5584999990001'), 2, `falhou com ${descricao}`);
  }
});

test('retorna -1 quando o lead ainda não está na planilha', () => {
  const colunaA = [['Telefone'], ['5584988887777']];
  assert.strictEqual(encontrarLinha(colunaA, '5584999990001'), -1);
});

test('nunca casa com a linha de cabeçalho', () => {
  assert.strictEqual(encontrarLinha([['Telefone'], ['']], ''), -1);
  assert.strictEqual(encontrarLinha([['Telefone']], undefined), -1);
});

test('planilha vazia não quebra', () => {
  assert.strictEqual(encontrarLinha(undefined, '5584999990001'), -1);
  assert.strictEqual(encontrarLinha([], '5584999990001'), -1);
});

test('soDigitos descarta tudo que não é dígito', () => {
  assert.strictEqual(soDigitos('+55 (84) 99999-0001'), '5584999990001');
  assert.strictEqual(soDigitos(null), '');
});
