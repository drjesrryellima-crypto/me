const test = require('node:test');
const assert = require('node:assert');
const { systemPrompt } = require('../src/assistente');
const { isCrisisSignal } = require('../src/triggers');

// 14/10/2026, 14h33. Um paciente escreveu "O dr Jesrryel está?" e recebeu a
// mensagem de crise inteira: CVV 188, SAMU 192, "se a vontade de se machucar
// estiver presente agora". Quem só queria saber se o médico estava.
//
// Não foi palavra-chave — isCrisisSignal devolve false para essa frase. Foi o
// prompt, que dizia "na dúvida entre risco e conversando, escolha risco". Uma
// pergunta que não diz nada sobre como a pessoa está deixa a IA em dúvida por
// FALTA DE INFORMAÇÃO, e a instrução transformava isso em crise.
//
// Custa dos dois lados: assusta quem não estava em crise, e gasta o alerta
// urgente do médico — que é o alerta que não pode virar rotina ignorada,
// porque um dia ele vai ser de verdade.
const FRASES_QUE_NAO_SAO_CRISE = [
  'O dr Jesrryel está?',
  'Oi',
  'Boa tarde',
  'qual o endereço?',
  'você é robô?',
  'tem horário amanhã?',
];

test('as palavras-chave nunca acusaram essas frases', () => {
  for (const frase of FRASES_QUE_NAO_SAO_CRISE) {
    assert.equal(isCrisisSignal(frase), false, `palavra-chave acusou: "${frase}"`);
  }
});

test('o prompt diz que mensagem sem sofrimento não é risco', () => {
  const p = systemPrompt();
  assert.match(p, /não é sinal de risco/i);
  assert.match(p, /falta de informação/i);
});

// A frase exata que causou o episódio fica no prompt como exemplo. Se alguém
// reescrever a seção, o teste cai junto com ela.
test('o prompt cita o caso que aconteceu de verdade', () => {
  assert.match(systemPrompt(), /o Dr\. Jesrryel está\?/);
});

// O conserto não pode virar o contrário: deixar de acusar crise de verdade é
// muito pior que o falso positivo que ele resolve.
test('o viés de segurança continua escrito, para sofrimento real', () => {
  const p = systemPrompt();
  assert.match(p, /errar para menos custa uma vida/i);
  assert.match(p, /risco à própria vida/i);
});

test('a instrução antiga, que causou o erro, não voltou', () => {
  assert.doesNotMatch(systemPrompt(), /Na dúvida entre risco e conversando, escolha risco/i);
});

// As palavras-chave continuam pegando o que sempre pegaram: elas são a rede
// que não depende de modelo nenhum.
test('crise de verdade continua sendo pega pelas palavras-chave', () => {
  for (const frase of ['quero morrer', 'não aguento mais', 'penso em me matar', 'quero sumir']) {
    assert.equal(isCrisisSignal(frase), true, `deixou passar: "${frase}"`);
  }
});
