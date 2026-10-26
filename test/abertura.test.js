const test = require('node:test');
const assert = require('node:assert');

const { abertura, saudacao, ehPrimeiraFala, comAbertura, horaEmMossoro } = require('../src/abertura');

// O servidor roda em UTC e Mossoró é UTC-3 o ano inteiro. Sem essa conta, um
// "boa noite" às 21h de Mossoró sairia como "bom dia" — e era exatamente a
// hora em que mais paciente escreve.
test('converte a hora do servidor (UTC) para a hora de Mossoró', () => {
  assert.strictEqual(horaEmMossoro(new Date('2026-10-15T12:00:00Z')), 9);
  assert.strictEqual(horaEmMossoro(new Date('2026-10-15T02:00:00Z')), 23);
  assert.strictEqual(horaEmMossoro(new Date('2026-10-15T00:30:00Z')), 21);
});

test('cumprimenta de acordo com a hora em Mossoró', () => {
  // 08:00 em Mossoró
  assert.strictEqual(saudacao(new Date('2026-10-15T11:00:00Z')), 'Bom dia');
  // 14:00 em Mossoró
  assert.strictEqual(saudacao(new Date('2026-10-15T17:00:00Z')), 'Boa tarde');
  // 21:00 em Mossoró
  assert.strictEqual(saudacao(new Date('2026-10-16T00:00:00Z')), 'Boa noite');
  // 03:00 em Mossoró — madrugada é noite, não "bom dia"
  assert.strictEqual(saudacao(new Date('2026-10-15T06:00:00Z')), 'Boa noite');
});

test('as bordas do dia caem do lado certo', () => {
  const emMossoro = (h, m = 0) => new Date(Date.UTC(2026, 9, 15, h + 3, m));
  assert.strictEqual(saudacao(emMossoro(4, 59)), 'Boa noite');
  assert.strictEqual(saudacao(emMossoro(5, 0)), 'Bom dia');
  assert.strictEqual(saudacao(emMossoro(11, 59)), 'Bom dia');
  assert.strictEqual(saudacao(emMossoro(12, 0)), 'Boa tarde');
  assert.strictEqual(saudacao(emMossoro(17, 59)), 'Boa tarde');
  assert.strictEqual(saudacao(emMossoro(18, 0)), 'Boa noite');
});

// O pedido do médico: cumprimentar, dizer quem está falando, e só então seguir.
test('a abertura diz de quem é o consultório e que quem fala é a assistente', () => {
  const texto = abertura(new Date('2026-10-16T00:00:00Z'));
  assert.ok(texto.startsWith('Boa noite!'), texto);
  assert.ok(texto.includes('consultório do Dr. Jesrryel Lima'), texto);
  assert.ok(/assistente/i.test(texto), texto);
});

test('a apresentação entra na primeira fala do bot e em nenhuma depois', () => {
  const agora = new Date('2026-10-16T00:00:00Z');

  // Lead novo: ninguém falou ainda.
  assert.ok(ehPrimeiraFala({}));
  assert.ok(ehPrimeiraFala({ historicoConversa: [] }));
  // O paciente falou, o bot ainda não.
  assert.ok(ehPrimeiraFala({ historicoConversa: [{ role: 'user', content: 'oi' }] }));

  const primeira = comAbertura('Me conta o que te trouxe aqui.', { historicoConversa: [] }, agora);
  assert.ok(primeira.startsWith('Boa noite! Aqui é do consultório'), primeira);
  assert.ok(primeira.endsWith('Me conta o que te trouxe aqui.'), primeira);

  // O bot já falou: nada é colado de novo.
  const lead = { historicoConversa: [{ role: 'user', content: 'oi' }, { role: 'assistant', content: 'oi' }] };
  assert.ok(!ehPrimeiraFala(lead));
  assert.strictEqual(comAbertura('Segunda mensagem.', lead, agora), 'Segunda mensagem.');
});

// Um lead reativado no painel volta para o estado NOVO. Se a regra olhasse o
// estado em vez do histórico, ele receberia a apresentação no meio da conversa,
// como se o bot tivesse acabado de chegar.
test('lead reativado não é apresentado de novo', () => {
  const reativado = {
    state: 'NOVO',
    historicoConversa: [
      { role: 'user', content: 'quanto custa?' },
      { role: 'assistant', content: 'vou chamar o médico' },
      { role: 'user', content: 'oi?' },
    ],
  };
  assert.ok(!ehPrimeiraFala(reativado));
  assert.strictEqual(comAbertura('Voltei.', reativado), 'Voltei.');
});

test('turno malformado no histórico não quebra nem conta como fala do bot', () => {
  assert.ok(ehPrimeiraFala({ historicoConversa: [null, undefined, {}, { role: 'user' }] }));
  assert.ok(ehPrimeiraFala({ historicoConversa: null }));
  assert.ok(ehPrimeiraFala(null));
  assert.ok(ehPrimeiraFala(undefined));
});

// A apresentação traz um 💙. Se o texto seguinte também trouxesse, a primeira
// mensagem do consultório sairia com dois.
test('o texto de boas-vindas não cumprimenta nem se apresenta sozinho', () => {
  const { boasVindas } = require('../src/messages');
  const texto = boasVindas();
  assert.ok(!/bom dia|boa tarde|boa noite|^oi\b/i.test(texto), texto);
  assert.ok(!/assistente|time do dr/i.test(texto), texto);
  assert.ok(!texto.includes('💙'), texto);
});

// Pedido do Dr. Jesrryel em 26/10/2026: "Boa noite, <nome do paciente>". O nome vem do perfil do
// WhatsApp, que é texto livre; só entra quando parece um nome de pessoa.
test('a abertura chama a pessoa pelo primeiro nome', () => {
  const { abertura } = require('../src/abertura');
  const noite = new Date('2026-10-26T23:00:00Z'); // 20h em Mossoró
  assert.match(abertura(noite, 'ana maria silva'), /^Boa noite, Ana! Aqui é do consultório/);
  assert.match(abertura(noite, 'MARIA DO CARMO'), /^Boa noite, Maria! /);
  assert.match(abertura(noite, 'Jean-Luc'), /^Boa noite, Jean-luc! /);
});

test('nome que não parece nome de pessoa fica de fora (melhor sem nome do que com nome errado)', () => {
  const { abertura, primeiroNome } = require('../src/abertura');
  const noite = new Date('2026-10-26T23:00:00Z');
  for (const ruim of ['', undefined, null, '😀', '𝐹𝓁𝒶𝓋𝒾𝒶', '123', 'A', 'x'.repeat(30), '...']) {
    assert.equal(primeiroNome(ruim), '', JSON.stringify(ruim));
    assert.match(abertura(noite, ruim), /^Boa noite! Aqui é do consultório/);
  }
  assert.equal(primeiroNome('•Maryy•'), 'Maryy');
});
