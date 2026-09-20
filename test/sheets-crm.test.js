const test = require('node:test');
const assert = require('node:assert');
const { montarLinha, COLUNAS, ULTIMA_COLUNA } = require('../src/sheets');
const { rotular } = require('../src/estados');

// A gravação é posicional: coluna A é telefone, B é nome, e assim por diante.
// Se a lista de colunas e o range da planilha saírem de sincronia, os dados
// passam a cair na coluna errada — silenciosamente.
test('a linha tem exatamente uma célula por coluna declarada', () => {
  const linha = montarLinha({ phone: '5584999990001', state: 'NOVO' });
  assert.strictEqual(linha.length, COLUNAS.length);
});

test('o range da planilha cobre todas as colunas', () => {
  const letraEsperada = String.fromCharCode('A'.charCodeAt(0) + COLUNAS.length - 1);
  assert.strictEqual(ULTIMA_COLUNA, letraEsperada, 'ULTIMA_COLUNA não acompanha COLUNAS');
});

test('grava o estágio legível, não o código técnico, mas mantém os dois', () => {
  const linha = montarLinha({ phone: '1', state: 'FOLLOWUP_D2' });
  assert.strictEqual(linha[COLUNAS.indexOf('Estágio')], 'Follow-up D+2');
  assert.strictEqual(linha[COLUNAS.indexOf('Estado (técnico)')], 'FOLLOWUP_D2');
});

// É a coluna que não pode falhar: quem abre a planilha precisa ver na hora
// quem foi marcado como risco.
test('marca a coluna Risco quando o lead foi sinalizado', () => {
  const emRisco = montarLinha({ phone: '1', notas: 'RISCO/CRISE detectado — handoff prioritário' });
  const normal = montarLinha({ phone: '2', notas: 'Sinal de intenção de compra detectado' });
  assert.strictEqual(emRisco[COLUNAS.indexOf('Risco')], 'SIM');
  assert.strictEqual(normal[COLUNAS.indexOf('Risco')], '');
});

test('estado desconhecido aparece cru em vez de virar célula vazia', () => {
  assert.strictEqual(rotular('ESTADO_NOVO_QUE_NINGUEM_MAPEOU'), 'ESTADO_NOVO_QUE_NINGUEM_MAPEOU');
  assert.strictEqual(rotular(undefined), '');
});

test('data vira formato legível e data inválida não quebra', () => {
  const linha = montarLinha({ phone: '1', createdAt: '2026-09-18T14:30:00Z', updatedAt: 'data-quebrada' });
  assert.match(linha[COLUNAS.indexOf('Primeiro contato')], /^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/);
  assert.strictEqual(linha[COLUNAS.indexOf('Última atualização')], '');
});

test('lead sem nenhum campo preenchido vira linha de strings vazias, não de undefined', () => {
  const linha = montarLinha({ phone: '5584999990001' });
  for (const celula of linha) {
    assert.strictEqual(typeof celula, 'string', `célula não é string: ${celula}`);
  }
});

test('follow-ups enviados viram lista legível', () => {
  const linha = montarLinha({ phone: '1', followupsEnviados: ['D2', 'D3'] });
  assert.strictEqual(linha[COLUNAS.indexOf('Follow-ups enviados')], 'D2, D3');
});
