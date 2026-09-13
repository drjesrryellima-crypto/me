// ATENÇÃO: estas listas são um PONTO DE PARTIDA, não uma solução completa.
// Detecção por palavra-chave é um instrumento grosseiro para um tema tão sério quanto risco de crise.
// Revise e amplie estas listas com a equipe clínica antes de ir para produção,
// e NUNCA trate isso como a única rede de segurança do sistema.

const normalize = (text) =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .trim();

const CRISIS_PHRASES = [
  'quero morrer',
  'nao aguento mais viver',
  'pensando em me matar',
  'vou me matar',
  'me machucar',
  'me cortar',
  'tirar minha vida',
  'nao quero mais existir',
  'sem saida',
  'penso em suicidio',
  'quero desistir de tudo',
];

const BUYING_PHRASES = [
  // valor / pagamento
  'quanto custa',
  'qual o valor',
  'quanto e',
  'tem desconto',
  'em quantas vezes',
  'parcelar',
  'pix',
  'cartao',
  // agendamento / inicio
  'quero marcar',
  'pode marcar',
  'tem vaga',
  'quando posso comecar',
  'como faco pra comecar',
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
