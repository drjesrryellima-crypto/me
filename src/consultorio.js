// Tudo que o bot pode AFIRMAR sobre o consultório, num lugar só.
//
// Antes, a assistente não sabia nada: o prompt dizia "não invente endereço,
// horário, convênio — se não está aqui, você não sabe". Como quase nada estava
// ali, qualquer pergunta concreta virava handoff, e o médico virou o FAQ do
// próprio consultório.
//
// A regra não mudou — o bot continua proibido de inventar. O que mudou é
// quanto ele sabe. Um fato que não está neste arquivo, ele não afirma.

const CONSULTA_AVULSA = {
  valor: 350,
  valorEscrito: 'R$ 350',
  duracaoMinutos: 60,
  duracaoEscrita: '1 hora',
};

const PAGAMENTO = {
  formas: ['Pix', 'dinheiro', 'cartão'],
  parcela: true,
  // Sem número de parcelas nem taxa: o bot não sabe a maquininha, e prometer
  // "em até Nx sem juros" é o tipo de detalhe que vira discussão no balcão.
  escrito: 'Pix, dinheiro ou cartão — e dá pra parcelar no cartão',
};

const PRESENCIAL = {
  predio: 'West Home and Business (WHB)',
  endereco: 'Avenida João da Escóssia, 3715 — Nova Betânia, Mossoró/RN',
  cep: '59607-330',
  sala: '1º andar, sala 67',
  escrito:
    'No West Home and Business (WHB) — Avenida João da Escóssia, 3715, Nova Betânia, ' +
    'Mossoró/RN, CEP 59607-330. 1º andar, sala 67.',
};

const ONLINE = {
  plataforma: 'Google Meet',
  // "antes da consulta", não "na hora": o link é enviado com antecedência, e
  // dizer "na hora" criaria a expectativa errada em quem está ansioso.
  escrito: 'Por Google Meet. O link chega antes da consulta.',
};

// O lembrete é enviado PELO MÉDICO, não por este sistema: não existe
// agendamento gravado aqui, logo não existe nada para disparar um lembrete.
//
// Por isso o texto fala do lembrete como rotina do consultório e nunca como
// promessa do robô ("eu te lembro"). Se um dia o sistema passar a agendar de
// verdade, esta nota some junto com a ressalva.
const LEMBRETE = {
  automatico: false,
  escrito: 'Você recebe um lembrete no dia anterior à consulta.',
};

// Os programas são o serviço principal do consultório, e o bot deve sempre
// apresentá-los — mas NUNCA com preço. O valor do acompanhamento é conversa
// do médico: é nela que ele é justificado, e é nela que a pessoa decide.
const PROGRAMAS = {
  falaPreco: false,
  recomeco:
    'Recomeço — para quem está começando agora e precisa de um cuidado mais próximo ' +
    'logo de cara, com psiquiatria e psicologia caminhando juntas até a pessoa se ' +
    'sentir mais estável.',
  constancia:
    'Constância — para quem já encontrou seu equilíbrio e quer manter esse cuidado ' +
    'vivo, com uma frequência mais espaçada, sem perder o acompanhamento.',
  equipe:
    'Os dois contam com equipe para olhar a pessoa por inteiro — psiquiatria, ' +
    'psicologia, nutrição e educação física, quando fizer sentido — presencial ou online.',
};

module.exports = { CONSULTA_AVULSA, PAGAMENTO, PRESENCIAL, ONLINE, LEMBRETE, PROGRAMAS };
