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
  // O que acontece na hora. Sem isso, "1 hora, R$ 350" é preço sem nada do
  // outro lado da balança — e quem está decidindo buscar ajuda precisa saber o
  // que vai receber, não quanto vai pagar.
  //
  // Evita de propósito a palavra "plano" (como em "plano terapêutico"): ela é
  // bloqueada pelo compliance, porque colide com "plano de saúde" e com
  // "plano de acompanhamento". Aqui é "proposta de tratamento".
  oQueAcontece:
    'O Dr. Jesrryel conhece com calma os vários aspectos da sua vida, avalia sua ' +
    'condição física, levanta hipóteses diagnósticas e monta uma proposta de ' +
    'tratamento junto com você.',
  // Dito antes, não descoberto depois. Quem marca achando que o retorno vem
  // junto descobre na pior hora, e a conta vira ressentimento.
  retornoIncluso: false,
  retornoEscrito: 'O retorno é cobrado à parte, não está incluído na consulta.',
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
  // A referência do Partage vale mais que o CEP para quem é de Mossoró: ninguém
  // acha um prédio por CEP, acha por "é perto do quê".
  referencia: 'vizinho ao Partage Shopping',
  escrito:
    'No West Home and Business (WHB), vizinho ao Partage Shopping — Avenida João da ' +
    'Escóssia, 3715, Nova Betânia, Mossoró/RN, CEP 59607-330. 1º andar, sala 67.',
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
//
// A descrição detalhada (duração, número de encontros, o que está incluído)
// veio da automação antiga do n8n, desligada em 14/10/2026. Lá ela convivia
// com o preço na mesma mensagem; aqui não — a regra de nunca falar o valor
// dos programas continua valendo inteira. O que o texto ganhou foi substância:
// "cuidado mais próximo" não diz nada; "6 encontros médicos em 90 dias" diz.
const PROGRAMAS = {
  falaPreco: false,
  recomeco:
    'Recomeço — 90 dias de acompanhamento próximo, para quem está começando ou ' +
    'retomando o cuidado agora. São 6 encontros com o médico, 8 com psicólogo, ' +
    '2 com nutricionista e 2 com educador físico, mais um canal de mensagens com a ' +
    'equipe e um resumo escrito depois de cada encontro.',
  constancia:
    'Constância — para quem já encontrou seu equilíbrio e quer manter esse cuidado ' +
    'vivo: encontros médicos mensais com a mesma equipe ao lado, em ciclos de 3 meses. ' +
    'Começa a partir de uma avaliação inicial com o Dr. Jesrryel.',
  equipe:
    'Nos dois, a pessoa é cuidada por inteiro — saúde mental, sono, rotina, ' +
    'alimentação e movimento — com os profissionais conversando entre si, ' +
    'presencial ou online.',
};

module.exports = { CONSULTA_AVULSA, PAGAMENTO, PRESENCIAL, ONLINE, LEMBRETE, PROGRAMAS };
