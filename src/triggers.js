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

const BUYING_PHRASES = [
  // valor / pagamento
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
  isOutOfScope: (text) => matchesAny(text, OUT_OF_SCOPE_PHRASES),
  CRISIS_PHRASES,
  BUYING_PHRASES,
  OUT_OF_SCOPE_PHRASES,
};
