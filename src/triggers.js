// ATENÇÃO: estas listas são um PONTO DE PARTIDA, não uma solução completa.
// Detecção por palavra-chave é um instrumento grosseiro para um tema tão sério quanto risco de crise.
// Revise e amplie estas listas com a equipe clínica antes de ir para produção,
// e NUNCA trate isso como a única rede de segurança do sistema.

const normalize = (text) =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/[.,!?;:]/g, ' ') // pontua\u00e7\u00e3o n\u00e3o deve impedir o match
    .replace(/\s+/g, ' ') // colapsa espa\u00e7os repetidos
    .trim();

const CRISIS_PHRASES = [
  'quero morrer',
  'quero morre',
  'nao aguento mais viver',
  'nao aguento mais essa vida',
  'nao aguento mais',
  'cansei de viver',
  'pensando em me matar',
  'penso em me matar',
  'pensei em me matar',
  'vou me matar',
  'quero me matar',
  'quero me suicidar',
  'penso em me suicidar',
  'cometer suicidio',
  'me machucar',
  'me cortar',
  'me cortando',
  'automutilacao',
  'tirar minha vida',
  'acabar com a minha vida',
  'acabar com a propria vida',
  'vou acabar com tudo',
  'quero acabar com tudo',
  'nao quero mais existir',
  'melhor eu nao existir',
  'seria melhor eu nao existir',
  'quero sumir',
  'quero desaparecer',
  'sem saida',
  'nao vejo saida',
  'nao tem mais saida',
  'vida nao tem mais sentido',
  'nao vale a pena viver',
  'penso em suicidio',
  'quero desistir de tudo',
];

// Perguntar o preço é intenção de compra, mas de um tipo diferente de "quero
// agendar": é uma PERGUNTA, e pergunta espera resposta. Tratar os dois com o
// mesmo texto faz a assistente responder "que bom que você quer dar esse passo"
// a quem perguntou quanto custa — que não responde nada e soa como fuga.
//
// A assistente não pode falar valor (é o Dr. Jesrryel quem trata disso), mas
// pode dizer exatamente isso, em vez de mudar de assunto.
const PRICE_PHRASES = [
  'quanto custa',
  'quanto ta custando',
  'quanto fica',
  'qual o valor',
  'qual valor',
  'me passa o valor',
  'quanto e',
  'tem desconto',
  'em quantas vezes',
  'tem como parcelar',
  'parcelar',
  'aceita pix',
  'pix',
  'cartao',
  'qual o preco',
  'qual preco',
  'quanto sai',
  'valor da consulta',
  'preco da consulta',
];

const BUYING_PHRASES = [
  ...PRICE_PHRASES,
  // agendamento / inicio
  'quero marcar',
  'quero agendar',
  'gostaria de agendar',
  'pode marcar',
  'tem vaga',
  'quando posso comecar',
  'como faco pra comecar',
  'quero comecar hoje',
  'vamos marcar',
  'e hoje que da pra comecar',
  // confirmacao direta
  'quero fazer o recomeco',
  'quero fazer o constancia',
  'bora comecar',
  'pode me colocar',
  'eu topo',
  'fechado',
  'aceito',
  'vamos nessa',
  'sim, quero',
  'onde eu assino',
  // logistica de quem ja decidiu
  'qual o endereco',
  'que horas funciona',
  'preciso levar algum documento',
];

const OUT_OF_SCOPE_PHRASES = [
  'laudo',
  'diagnostico fechado',
  'atestado',
  'receita de',
];

function matchesAny(text, phrases) {
  const normalized = normalize(text);
  return phrases.some((phrase) => normalized.includes(normalize(phrase)));
}

module.exports = {
  isCrisisSignal: (text) => matchesAny(text, CRISIS_PHRASES),
  isBuyingSignal: (text) => matchesAny(text, BUYING_PHRASES),
  isPriceQuestion: (text) => matchesAny(text, PRICE_PHRASES),
  isOutOfScope: (text) => matchesAny(text, OUT_OF_SCOPE_PHRASES),
  CRISIS_PHRASES,
  BUYING_PHRASES,
  PRICE_PHRASES,
  OUT_OF_SCOPE_PHRASES,
};
