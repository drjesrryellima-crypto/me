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

  // A mensagem mais importante do sistema, e a única que pode chegar a alguém
  // em risco imediato. Três decisões deliberadas:
  //
  // 1. Dá o 188 ANTES de falar do médico. O alerta chega no celular dele, mas
  //    ele pode estar dormindo, dirigindo, atendendo. O CVV atende agora.
  // 2. Não faz pergunta nenhuma. Quem está em crise não deve ter que responder
  //    um robô para ser ajudado.
  // 3. Diz explicitamente para não esperar pelo médico. A versão anterior
  //    prometia "vou te colocar em contato com alguém agora mesmo" e deixava a
  //    pessoa aguardando um contato que depende de um humano acordar.
  acolhimentoRisco: () =>
    `Obrigado por me dizer isso. O que você está sentindo é sério, e você não precisa atravessar isso sozinho(a).\n\n` +
    `Se a vontade de se machucar estiver presente agora, ligue *188*. É o CVV — gratuito, 24 horas, e tem uma pessoa pronta pra te ouvir neste momento.\n\n` +
    `Se o risco for imediato, procure o pronto-socorro mais próximo ou ligue *192* (SAMU).\n\n` +
    `O Dr. Jesrryel já foi avisado e vai te procurar. Mas não espere por isso se você precisar de ajuda agora — o 188 atende neste instante.`,

  handoffCompra: () =>
    `Que bom que você quer dar esse passo. Vou te colocar em contato com o Dr. Jesrryel agora mesmo pra continuarmos essa conversa com todo o cuidado que ela merece. Já volto com você 💙`,

  // Pergunta de preço é intenção de compra, mas é PERGUNTA — e pergunta espera
  // resposta. Responder "que bom que você quer dar esse passo" a quem perguntou
  // quanto custa não responde nada e soa como fuga. A assistente não pode falar
  // valor, mas pode dizer isso, e dizer quem fala.
  handoffValor: () =>
    `Sobre valores quem te responde é o próprio Dr. Jesrryel — assim ele já te explica o que faz sentido pro seu caso, em vez de um número solto. Vou chamar ele agora. Já volto com você 💙`,

  // Quem quer marcar não pode ouvir "ele atende de manhã" outra vez: já
  // passou dessa fase. O texto confirma que entendeu e diz o que acontece
  // agora, sem prometer horário que o sistema não tem como garantir.
  handoffAgendamento: () =>
    `Perfeito. Quem acerta o horário com você é o próprio Dr. Jesrryel, pra encaixar no que estiver livre de verdade na agenda dele. Já estou avisando — ele te chama por aqui mesmo 💙`,

  // Quando a assistente não sabe. Honestidade é melhor que improviso: um bot
  // que inventa convênio ou estacionamento cria problema real no dia da
  // consulta, e quebra a confiança em tudo que ele falou antes.
  handoffNaoSei: () =>
    `Essa eu não sei te responder com certeza, e prefiro não chutar. Já perguntei pro Dr. Jesrryel e ele te responde por aqui 💙`,

  // Confirmação do descadastro. Três coisas, nesta ordem e por este motivo:
  //
  // 1. Confirma sem perguntar nada. Quem pede pra sair não quer negociar.
  // 2. Diz como voltar, porque sair não pode virar porta trancada: muita
  //    gente desiste de tratamento num dia ruim e volta semanas depois.
  // 3. Mantém o 188 visível. É a única linha que precisa sobreviver a
  //    qualquer configuração, inclusive à vontade de não ouvir mais nada.
  descadastroConfirmado: () =>
    `Pronto. Não vou mais te mandar mensagem por aqui.\n\n` +
    `Se um dia você quiser retomar, é só escrever de novo — a porta continua aberta.\n\n` +
    `E se em algum momento você precisar de ajuda imediata, o *188* (CVV) atende de graça, 24 horas.`,

  followupD2: () =>
    `Separei um conteúdo que fala exatamente sobre o que você me contou — acho que vai fazer sentido pra você. Dá uma olhada com calma 💙\n[link do conteúdo]`,

  followupD3: (nome) =>
    `Oi${nome ? ', ' + nome : ''}! Passando aqui só pra saber: ficou alguma dúvida sobre o Recomeço ou o Constância? Pode perguntar à vontade, tô por aqui.`,

  followupD5: () =>
    `Queria compartilhar mais uma coisa com você.\n[novo conteúdo]\nMuita gente que chega até a gente se sente exatamente como você descreveu — e dá pra mudar essa história.`,

  followupD7: (nome, horarios) =>
    `${nome ? nome + ', ' : ''}que tal a gente conversar por 15 minutinhos, com calma, pra eu tirar todas as suas dúvidas e te ajudar a decidir o melhor caminho? Tenho estes horários: ${horarios}. Qual funciona melhor pra você?`,
};
