const test = require('node:test');
const assert = require('node:assert');
const { explicarErroMeta } = require('../src/erros-meta');

const erroDaMeta = (code, message, details) => ({
  message: 'Request failed with status code 400',
  response: { data: { error: { code, message, ...(details ? { error_data: { details } } : {}) } } },
});

test('troca o "status code 400" pelo motivo de verdade', () => {
  const msg = explicarErroMeta(erroDaMeta(131030, 'Recipient phone number not in allowed list'));
  assert.match(msg, /lista de destinatários permitidos/);
  assert.match(msg, /\[código 131030\]/);
  assert.doesNotMatch(msg, /status code 400/);
});

test('nome de exibição não aprovado explica o que dá e o que não dá pra fazer', () => {
  const msg = explicarErroMeta(erroDaMeta(131037, 'Display name not approved'));
  assert.match(msg, /RECEBER/);
  assert.match(msg, /ENVIAR/);
});

test('token expirado aponta as 24h do temporário', () => {
  assert.match(explicarErroMeta(erroDaMeta(190, 'Invalid OAuth token')), /24h/);
});

test('código sem dica ainda devolve a mensagem da Meta e o número', () => {
  const msg = explicarErroMeta(erroDaMeta(999999, 'Algo novo que a Meta inventou'));
  assert.match(msg, /Algo novo que a Meta inventou/);
  assert.match(msg, /\[código 999999\]/);
});

test('details da Meta entram entre parênteses', () => {
  const msg = explicarErroMeta(erroDaMeta(100, 'Invalid parameter', 'phone number id inválido'));
  assert.match(msg, /\(phone number id inválido\)/);
});

test('erro que não é da Meta (rede, proxy) mostra o corpo cru em vez de engolir', () => {
  const err = { message: 'ECONNREFUSED', response: { data: '<html>502 Bad Gateway</html>' } };
  const msg = explicarErroMeta(err);
  assert.match(msg, /ECONNREFUSED/);
  assert.match(msg, /502 Bad Gateway/);
  assert.match(msg, /rede, proxy ou firewall/);
});

test('erro sem response nenhuma não quebra', () => {
  assert.match(explicarErroMeta(new Error('socket hang up')), /socket hang up/);
  assert.doesNotThrow(() => explicarErroMeta(undefined));
});

test('padrão é uma linha só — é o que serve num log', () => {
  const msg = explicarErroMeta(erroDaMeta(131030, 'Recipient not allowed'));
  assert.doesNotMatch(msg, /\n/);
});

test('multilinha quebra em parágrafos — é o que serve num terminal', () => {
  const msg = explicarErroMeta(erroDaMeta(131030, 'Recipient not allowed'), { multilinha: true });
  assert.match(msg, /\n\n/);
});
