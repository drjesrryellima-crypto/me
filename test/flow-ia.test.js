const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const DATA = path.join(__dirname, '..', 'data');
const limpar = () => fs.rmSync(DATA, { recursive: true, force: true });

const { aplicarRespostaDaIA } = require('../src/flow');
const { getLead, createLeadIfMissing } = require('../src/state');

// Sem WHATSAPP_TOKEN o envio falha e é engolido pelo enviar() do flow.js —
// que é justamente o comportamento desejado: falha de envio nunca pode
// impedir o estado do lead de ser salvo.

const respostaIA = (over = {}) => ({
  intencao: 'conversando',
  resposta: 'Me conta o que te trouxe até aqui?',
  motivo: '',
  historico: '',
  formato: '',
  classificacao: '',
  qualificacaoCompleta: false,
  ...over,
});

test('risco sinalizado pela IA vai pra handoff mesmo sem bater nas palavras-chave', async () => {
  limpar();
  const phone = '5584911111111';
  createLeadIfMissing(phone);

  // Frase real que a lista de palavra-chave não pega: é a segunda camada.
  await aplicarRespostaDaIA(phone, getLead(phone), respostaIA({ intencao: 'risco' }), 'tá tudo escuro pra mim');

  const lead = getLead(phone);
  assert.strictEqual(lead.state, 'HANDOFF');
  assert.match(lead.notas, /RISCO\/CRISE/);
  limpar();
});

test('intenção de compra vai pra handoff', async () => {
  limpar();
  const phone = '5584922222222';
  createLeadIfMissing(phone);

  await aplicarRespostaDaIA(phone, getLead(phone), respostaIA({ intencao: 'compra' }), 'bora que eu quero');

  assert.strictEqual(getLead(phone).state, 'HANDOFF');
  limpar();
});

test('fora de escopo desqualifica', async () => {
  limpar();
  const phone = '5584933333333';
  createLeadIfMissing(phone);

  await aplicarRespostaDaIA(phone, getLead(phone), respostaIA({ intencao: 'fora_de_escopo' }), 'quero um atestado');

  assert.strictEqual(getLead(phone).state, 'DESQUALIFICADO');
  limpar();
});

// String vazia da IA significa "o lead ainda não contou", não "apague".
test('campo vazio da IA não apaga o que o lead já tinha contado', async () => {
  limpar();
  const phone = '5584944444444';
  createLeadIfMissing(phone);
  await aplicarRespostaDaIA(phone, getLead(phone), respostaIA({ motivo: 'ansiedade no trabalho' }), 'ansiedade');
  assert.strictEqual(getLead(phone).motivo, 'ansiedade no trabalho');

  await aplicarRespostaDaIA(phone, getLead(phone), respostaIA({ motivo: '', historico: 'primeira vez' }), 'nunca fiz');

  const lead = getLead(phone);
  assert.strictEqual(lead.motivo, 'ansiedade no trabalho', 'apagou o motivo que já estava salvo');
  assert.strictEqual(lead.historico, 'primeira vez');
  limpar();
});

test('qualificação completa agenda os follow-ups uma única vez', async () => {
  limpar();
  const phone = '5584955555555';
  createLeadIfMissing(phone);

  const completa = respostaIA({
    motivo: 'ansiedade',
    historico: 'primeira vez',
    formato: 'online',
    classificacao: 'Recomeço',
    qualificacaoCompleta: true,
  });
  await aplicarRespostaDaIA(phone, getLead(phone), completa, 'online');

  const depois = getLead(phone);
  assert.strictEqual(depois.state, 'CATALOGO_ENVIADO');
  assert.strictEqual(depois.followupsAgendados, true);
  assert.strictEqual(depois.classificacao, 'Recomeço');
  const agendadoEm = depois.catalogoEnviadoEm;
  assert.ok(agendadoEm);

  // Segunda mensagem ainda com qualificacaoCompleta: não pode reiniciar o relógio
  // dos follow-ups, senão o D+2 nunca chega.
  await aplicarRespostaDaIA(phone, getLead(phone), completa, 'mais uma coisa');
  assert.strictEqual(getLead(phone).catalogoEnviadoEm, agendadoEm, 'reiniciou o relógio do follow-up');
  limpar();
});

test('a conversa fica registrada no histórico pra virar contexto da próxima mensagem', async () => {
  limpar();
  const phone = '5584966666666';
  createLeadIfMissing(phone);

  await aplicarRespostaDaIA(phone, getLead(phone), respostaIA({ resposta: 'Oi! Como posso ajudar?' }), 'oi');

  const historico = getLead(phone).historicoConversa || [];
  assert.deepStrictEqual(historico[historico.length - 1], {
    role: 'assistant',
    content: 'Oi! Como posso ajudar?',
  });
  limpar();
});
