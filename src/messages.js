// Todas as mensagens seguem as regras de compliance definidas no briefing:
// - nunca mencionar preço
// - nunca usar "plano" (sempre "programa de acompanhamento")
// - nunca usar "consulta psiquiátrica" (sempre "saúde mental")

module.exports = {
  boasVindas: () =>
    `Oi! Que bom te receber por aqui 💙\n` +
    `Eu sou do time do Dr. Jesrryel, e vou te ajudar a entender qual caminho faz mais sentido pra você.\n\n` +
    `Antes de mais nada: me conta com suas palavras — o que te trouxe até aqui hoje?`,

  perguntaHistorico: () =>
    `Entendi. E me diz uma coisa: você já buscou algum tipo de acompanhamento em saúde mental antes, ou seria a primeira vez dando esse passo?`,

  perguntaFormato: () =>
    `Perfeito, obrigado por compartilhar isso comigo.\n` +
    `Só mais uma coisa: você prefere se cuidar presencialmente aqui em Mossoró, ou prefere que seja tudo online, do jeito que for mais confortável pra sua rotina?`,

  catalogo: (nome) =>
    `${nome ? nome + ', ' : ''}baseado no que você me contou, acho que faz todo sentido eu te apresentar os dois formatos que temos aqui:\n\n` +
    `🔹 Recomeço — pra quem está começando agora e precisa de um cuidado mais próximo logo de cara, com psiquiatria e psicologia caminhando juntas até você se sentir mais estável.\n` +
    `🔹 Constância — pra quem já encontrou seu equilíbrio e quer manter esse cuidado vivo, com uma frequência mais espaçada, sem perder o acompanhamento.\n\n` +
    `Os dois contam com uma equipe pensada pra te olhar por inteiro — psiquiatria, psicologia, nutrição e educação física, quando fizer sentido pro seu momento — no formato que for melhor pra você: aqui no consultório ou online.\n\n` +
    `Quer que eu te explique qual dos dois combina mais com o que você está vivendo agora?`,

  desqualificacaoGentil: () =>
    `Fico feliz que você tenha vindo até aqui, e quero ser honesto com você: pelo que você me contou, acho que você vai ser melhor cuidado por outro tipo de profissional/serviço. Se quiser, posso te ajudar a pensar no próximo passo, tá bem?`,

  acolhimentoRisco: () =>
    `Sinto muito que você esteja passando por isso. Você não precisa carregar isso sozinho(a), e eu vou te colocar em contato com alguém agora mesmo.`,

  handoffCompra: () =>
    `Que bom que você quer dar esse passo. Vou te colocar em contato com o Dr. Jesrryel agora mesmo pra continuarmos essa conversa com todo o cuidado que ela merece. Já volto com você 💙`,

  // Pergunta de preço é intenção de compra, mas é PERGUNTA — e pergunta espera
  // resposta. Responder "que bom que você quer dar esse passo" a quem perguntou
  // quanto custa não responde nada e soa como fuga. A assistente não pode falar
  // valor, mas pode dizer isso, e dizer quem fala.
  handoffValor: () =>
    `Sobre valores quem te responde é o próprio Dr. Jesrryel — assim ele já te explica o que faz sentido pro seu caso, em vez de um número solto. Vou chamar ele agora. Já volto com você 💙`,

  followupD2: () =>
    `Separei um conteúdo que fala exatamente sobre o que você me contou — acho que vai fazer sentido pra você. Dá uma olhada com calma 💙\n[link do conteúdo]`,

  followupD3: (nome) =>
    `Oi${nome ? ', ' + nome : ''}! Passando aqui só pra saber: ficou alguma dúvida sobre o Recomeço ou o Constância? Pode perguntar à vontade, tô por aqui.`,

  followupD5: () =>
    `Queria compartilhar mais uma coisa com você.\n[novo conteúdo]\nMuita gente que chega até a gente se sente exatamente como você descreveu — e dá pra mudar essa história.`,

  followupD7: (nome, horarios) =>
    `${nome ? nome + ', ' : ''}que tal a gente conversar por 15 minutinhos, com calma, pra eu tirar todas as suas dúvidas e te ajudar a decidir o melhor caminho? Tenho estes horários: ${horarios}. Qual funciona melhor pra você?`,
};
