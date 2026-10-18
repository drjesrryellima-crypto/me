// Todas as mensagens seguem as regras de compliance definidas no briefing:
// - nunca mencionar preço
// - nunca usar "plano" (sempre "programa de acompanhamento")
// - nunca usar "consulta psiquiátrica" (sempre "saúde mental")

module.exports = {
  // Sem cumprimento e sem apresentação de propósito: quem faz isso é o
  // abertura.js, colado pelo responderLead() do flow.js na primeira fala da
  // conversa. Se este texto também cumprimentasse, o paciente receberia
  // "Boa noite! Aqui é do consultório..." seguido de "Oi! Que bom te receber".
  boasVindas: () =>
    `Vou te ajudar a entender qual caminho faz mais sentido pra você.\n\n` +
    `Me conta com suas palavras: o que te trouxe até aqui hoje?`,

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
  // O texto mais importante do sistema, e o único que não pode prometer nada
  // que este canal não cumpra.
  //
  // A versão anterior terminava com "O Dr. Jesrryel já foi avisado e vai te
  // procurar". Desde 15/10/2026 o risco NÃO alerta mais o celular do médico —
  // decisão dele, e clinicamente a certa: quem está em risco iminente precisa
  // de um serviço de urgência que atende 24 horas, não de um WhatsApp de
  // consultório que pode estar sem ninguém olhando às 3 da manhã. Esperar pelo
  // médico é justamente o que não se deve fazer.
  //
  // Então a promessa saiu junto com o alerta. Dizer "ele vai te procurar" sem
  // ninguém ser avisado seria mentir para alguém em crise — o pior lugar
  // possível para uma mentira de conveniência.
  acolhimentoRisco: () =>
    `Obrigado por me dizer isso. O que você está sentindo é sério, e você não precisa atravessar isso sozinho(a).\n\n` +
    `Preciso ser honesta com você: este canal é do consultório e não consegue te acompanhar neste momento. Mas existe ajuda agora, de verdade:\n\n` +
    `Ligue *188* — é o CVV. Gratuito, 24 horas, e tem uma pessoa pronta pra te ouvir neste instante.\n\n` +
    `Se o risco for imediato, procure o pronto-socorro mais próximo ou ligue *192* (SAMU). Não espere passar sozinho(a).\n\n` +
    `Se tiver alguém de confiança por perto, chame essa pessoa pra ficar com você.\n\n` +
    `Quando você estiver em segurança, eu continuo aqui — e a gente fala sobre acompanhamento com calma. 💙`,

  // Agendamento automático: as três opções, numeradas.
  //
  // Numeradas porque a resposta curta ("2") é a que mais aparece no WhatsApp, e
  // é a única que o sistema lê sem risco de errar o dia. O texto pede o número
  // em vez de deixar em aberto — quem responde "quarta de manhã" obriga a
  // assistente a perguntar de novo.
  oferecerVagas: (descricoes) =>
    `Posso já deixar marcado. Estes são os horários livres mais próximos:\n\n` +
    descricoes.map((d, i) => `*${i + 1}.* ${d}`).join('\n') +
    `\n\nResponde com o número que funciona melhor pra você. Se nenhum servir, me diz qual período você prefere que eu procuro outro.`,

  // Confirmação. Diz o que ficou marcado e o que fazer se precisar desmarcar —
  // essa última parte evita o paciente sumir sem avisar, que é o que custa a
  // vaga de outra pessoa.
  consultaMarcada: (quando, formato) =>
    `Pronto, marquei! 💙\n\n` +
    `*${quando}*\n` +
    (formato ? `${formato}\n` : '') +
    `\nSe precisar remarcar ou cancelar, é só me avisar por aqui.`,

  // Não deu pra entender a escolha. Repete as opções em vez de só perguntar de
  // novo: quem respondeu errado provavelmente já não está mais vendo a
  // mensagem anterior na tela.
  escolhaNaoEntendida: (descricoes) =>
    `Desculpa, não consegui entender qual horário você quer. Pode responder só com o número?\n\n` +
    descricoes.map((d, i) => `*${i + 1}.* ${d}`).join('\n'),

  // A vaga foi ocupada entre a oferta e a resposta, ou a agenda ficou sem nada
  // no horizonte. Os dois casos acabam no mesmo lugar: o Dr. Jesrryel resolve.
  vagaPerdida: () =>
    `Esse horário acabou de ser preenchido, me desculpe. Vou avisar o Dr. Jesrryel pra ele te passar uma opção. Já volto com você 💙`,

  semVagas: () =>
    `Não encontrei horário livre nos próximos dias por aqui. Vou avisar o Dr. Jesrryel pra ele ver uma data com você. Já volto 💙`,

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

  followupD3: (nome) =>
    `Oi${nome ? ', ' + nome : ''}! Passando aqui só pra saber: ficou alguma dúvida sobre o Recomeço ou o Constância? Pode perguntar à vontade, tô por aqui.`,

  followupD5: () =>
    `Queria compartilhar mais uma coisa com você.\n[novo conteúdo]\nMuita gente que chega até a gente se sente exatamente como você descreveu — e dá pra mudar essa história.`,

  followupD7: (nome, horarios) =>
    `${nome ? nome + ', ' : ''}que tal a gente conversar por 15 minutinhos, com calma, pra eu tirar todas as suas dúvidas e te ajudar a decidir o melhor caminho? Tenho estes horários: ${horarios}. Qual funciona melhor pra você?`,
};
