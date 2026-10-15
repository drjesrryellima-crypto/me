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
  // Sintomas, não perigo explícito (régua do Dr. Jesrryel, 15/10/2026). São o
  // motivo pelo qual quase todo mundo escreve para um consultório de saúde
  // mental — mandar essa gente para o pronto-socorro é a resposta errada.
  'não aguento mais',
  'quero sumir',
  'não vejo saída',
  'a vida não tem mais sentido',
  'estou tendo uma crise de ansiedade',
  'estou muito triste',
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
// A régua passou a ser perigo EXPLÍCITO, não "sofrimento que não dá pra
// medir": sintoma de saúde mental é o que o consultório trata, não emergência.
test('o prompt define risco como perigo explícito, e diz que sintoma não é', () => {
  const p = systemPrompt();
  assert.match(p, /perigo explícito/i);
  assert.match(p, /NÃO são risco\. São sintomas/);
  assert.match(p, /machucar outra pessoa/);
});

test('a instrução antiga, que causou o erro, não voltou', () => {
  assert.doesNotMatch(systemPrompt(), /Na dúvida entre risco e conversando, escolha risco/i);
});

// As palavras-chave continuam pegando o que sempre pegaram: elas são a rede
// que não depende de modelo nenhum.
test('perigo explícito continua sendo pego pelas palavras-chave', () => {
  const perigo = [
    'quero morrer', 'penso em me matar', 'vou me matar', 'quero me suicidar',
    'vou me cortar', 'automutilação',
    // Risco a terceiros: faltava no sistema inteiro até 15/10/2026.
    'vou machucar alguém', 'vou matar ela',
  ];
  for (const frase of perigo) {
    assert.equal(isCrisisSignal(frase), true, `deixou passar: "${frase}"`);
  }
});
