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
// Até 04/10/2026 esta lista era um alçapão. "pix", "cartao" e "parcelar"
// sozinhos jogavam a pessoa direto no colo do médico — alguém escrevia
// "aceita pix?" e virava handoff. Somado à proibição de falar preço no prompt,
// o resultado era um bot que não respondia nada concreto e um médico virando o
// FAQ do próprio consultório.
//
// Agora a assistente SABE o valor avulso, o endereço, as faixas de horário e
// as formas de pagamento (ver src/consultorio.js), então essas perguntas são
// respondidas, não encaminhadas.
//
// O que sobrou aqui é só o que não dá pra errar: quem quer FECHAR um programa
// de acompanhamento, ou quer efetivamente marcar. Tudo o mais a IA decide com
// o contexto da conversa, que é onde ela é melhor que uma lista de palavras.
const PRECO_PLANO_PHRASES = [
  // o único preço que a assistente não diz
  'quanto custa o recomeco',
  'quanto custa o constancia',
  'quanto custa o programa',
  'quanto custa o acompanhamento',
  'valor do recomeco',
  'valor do constancia',
  'valor do programa',
  'valor do acompanhamento',
  'preco do recomeco',
  'preco do constancia',
  'preco do programa',
  'preco do acompanhamento',
  'quanto e o recomeco',
  'quanto e o constancia',
];

// Querer FECHAR é diferente de perguntar o preço: a pessoa já decidiu. As duas
// coisas vão para o médico, mas com texto diferente — e misturá-las numa lista
// só fazia "quero fazer o Recomeço" ser tratado como pergunta de valor.
const FECHAMENTO_PHRASES = [
  'quero fazer o recomeco',
  'quero fazer o constancia',
  'quero contratar',
  'quero fechar',
  'quero assinar',
  'onde eu assino',
  'quero comecar o acompanhamento',
];

// Marcar é do humano: o médico escolheu que o bot informa as faixas e não
// agenda. Quem já quer marcar não deve ouvir "ele atende de manhã" de novo.
const AGENDAMENTO_PHRASES = [
  'quero marcar',
  'quero agendar',
  'gostaria de agendar',
  'gostaria de marcar',
  'pode marcar',
  'pode agendar',
  'vamos marcar',
  'quero marcar uma consulta',
  'como faco pra marcar',
  'como faco pra agendar',
];

const BUYING_PHRASES = [...PRECO_PLANO_PHRASES, ...FECHAMENTO_PHRASES, ...AGENDAMENTO_PHRASES];

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

// A pessoa puxou assunto de dinheiro? Usado para decidir se a assistente pode
// falar de valor NESTA resposta — ela só informa preço quando perguntam.
const DINHEIRO_PHRASES = [
  'quanto custa', 'quanto fica', 'quanto sai', 'quanto e', 'quanto seria',
  'qual o valor', 'qual valor', 'valor da consulta', 'valor da sessao',
  'qual o preco', 'qual preco', 'preco da consulta', 'quanto cobra',
  'me passa o valor', 'valores', 'tabela', 'investimento',
  'pix', 'cartao', 'parcel', 'pagamento', 'pagar', 'dinheiro', 'desconto',
  'caro', 'barato', 'cabe no meu bolso', 'quanto vou pagar',
];

module.exports = {
  isCrisisSignal: (text) => matchesAny(text, CRISIS_PHRASES),
  isBuyingSignal: (text) => matchesAny(text, BUYING_PHRASES),
  isPrecoDoPlano: (text) => matchesAny(text, PRECO_PLANO_PHRASES),
  isPedidoDeAgendamento: (text) => matchesAny(text, AGENDAMENTO_PHRASES),
  isOutOfScope: (text) => matchesAny(text, OUT_OF_SCOPE_PHRASES),
  perguntouDeDinheiro: (text) => matchesAny(text, DINHEIRO_PHRASES),
  CRISIS_PHRASES,
  BUYING_PHRASES,
  PRECO_PLANO_PHRASES,
  FECHAMENTO_PHRASES,
  AGENDAMENTO_PHRASES,
  OUT_OF_SCOPE_PHRASES,
  DINHEIRO_PHRASES,
};
