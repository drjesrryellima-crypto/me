const test = require('node:test');
const assert = require('node:assert');
const { montarLinha, COLUNAS, ULTIMA_COLUNA } = require('../src/sheets');
const { rotular, estagioCrm, ESTAGIO_CRM, ROTULO_ESTADO } = require('../src/estados');

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

// A coluna Estágio fala o vocabulário da planilha do consultório, pra dar pra
// cruzar com a aba FUNIL. A precisão não se perde: o código cru vai na coluna
// Estado (técnico), ao lado.
test('grava o estágio no vocabulário do CRM, mantendo o código técnico ao lado', () => {
  const linha = montarLinha({ phone: '1', state: 'FOLLOWUP_D2' });
  assert.strictEqual(linha[COLUNAS.indexOf('Estágio')], 'Nutrição');
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

// --- Vocabulário do CRM ---

test('todo estado do fluxo tem um estágio de CRM correspondente', () => {
  for (const state of Object.keys(ROTULO_ESTADO)) {
    assert.ok(ESTAGIO_CRM[state], `estado sem mapeamento para o CRM: ${state}`);
  }
});

// Estes três dependem do que acontece fora do WhatsApp (a consulta foi marcada?
// aconteceu? o lead sumiu?). O bot não tem como saber, então não pode escrevê-los
// — senão sobrescreveria com palpite o que uma pessoa preencheu sabendo.
test('o bot nunca escreve os estágios que só uma pessoa pode confirmar', () => {
  const soDeHumano = ['Consulta Agendada', 'Convertido', 'Perdido'];
  const escritosPeloBot = Object.entries(ESTAGIO_CRM)
    .filter(([state]) => state !== 'CLIENTE') // CLIENTE só é setado à mão
    .map(([, estagio]) => estagio);

  for (const estagio of soDeHumano) {
    assert.ok(
      !escritosPeloBot.includes(estagio),
      `o bot escreveria "${estagio}", que depende de confirmação humana`
    );
  }
});

test('a qualificação inteira colapsa num único estágio do CRM', () => {
  for (const state of ['AGUARDANDO_MOTIVO', 'AGUARDANDO_HISTORICO', 'AGUARDANDO_FORMATO']) {
    assert.strictEqual(estagioCrm(state), 'Qualificação');
  }
});

test('catálogo e todos os follow-ups viram Nutrição', () => {
  for (const state of ['CATALOGO_ENVIADO', 'FOLLOWUP_D2', 'FOLLOWUP_D5', 'REENGAJAMENTO_MENSAL']) {
    assert.strictEqual(estagioCrm(state), 'Nutrição');
  }
});

// Handoff por risco e handoff por compra caem no mesmo estágio. Quem desempata
// na planilha é a coluna Risco — sem ela, um caso clínico urgente se leria como
// lead quente de vendas.
test('handoff por risco se distingue do handoff por compra pela coluna Risco', () => {
  const risco = montarLinha({ phone: '1', state: 'HANDOFF', notas: 'RISCO/CRISE detectado' });
  const compra = montarLinha({ phone: '2', state: 'HANDOFF', notas: 'Sinal de intenção de compra detectado' });

  assert.strictEqual(risco[COLUNAS.indexOf('Estágio')], 'Consulta Proposta');
  assert.strictEqual(compra[COLUNAS.indexOf('Estágio')], 'Consulta Proposta');
  assert.strictEqual(risco[COLUNAS.indexOf('Risco')], 'SIM');
  assert.strictEqual(compra[COLUNAS.indexOf('Risco')], '');
});

test('estado desconhecido vai cru pra planilha em vez de sumir', () => {
  assert.strictEqual(estagioCrm('ESTADO_QUE_NINGUEM_MAPEOU'), 'ESTADO_QUE_NINGUEM_MAPEOU');
  assert.strictEqual(estagioCrm(undefined), '');
});
