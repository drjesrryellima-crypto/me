// Descadastro: a pessoa pede para não receber mais nada.
//
// A LGPD dá o direito de revogar o consentimento a qualquer momento (art. 18,
// IX). Até aqui o único caminho era o e-mail da política de privacidade — que
// ninguém lê e ninguém usa. Na prática, não havia como sair.
//
// Isso também destrava a frase de opt-out nos templates de follow-up: hoje
// nenhum deles oferece "responda PARAR", porque prometer um botão que não
// existe é pior que não oferecer.

// Comparação EXATA com a mensagem inteira, nunca "contém".
//
// Esta é a decisão mais importante do arquivo. Buscar "pare" dentro do texto
// descadastraria quem escrevesse "não pare de me ajudar", "a dor não para",
// "pare pra pensar". O custo de um falso positivo aqui é calar para sempre
// alguém que estava pedindo ajuda — não é um erro que dá pra aceitar numa
// linha de saúde mental.
const PALAVRAS = new Set([
  'parar',
  'pare',
  'sair',
  'cancelar',
  'descadastrar',
  'remover',
  'stop',
  'nao quero mais receber',
  'nao quero receber mais',
]);

// "para" sozinho ficou DE FORA de propósito. É a palavra mais comum da lista
// em português e a mais fácil de aparecer solta no meio de uma conversa real
// ("para", "para?", "para."). O ganho de pegá-la não paga o risco de silenciar
// um paciente por engano — e quem quer sair escreve "parar" ou "sair".

const normalizar = (texto) =>
  String(texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[.,!?;:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * @returns {boolean} se a mensagem INTEIRA é um pedido de descadastro
 */
function pediuDescadastro(texto) {
  return PALAVRAS.has(normalizar(texto));
}

/**
 * Campos a gravar. Não apaga nada: o motivo, o histórico e a classificação
 * continuam onde estão.
 *
 * Apagar automaticamente seria destruir registro que o consultório pode ser
 * obrigado a guardar (CFM, prontuário). Quem decide o que vai embora é o
 * médico, caso a caso — a política de privacidade já diz que a exclusão é
 * pedida pelo e-mail e avaliada contra a obrigação legal de guarda.
 */
function camposDeDescadastro(agora = new Date()) {
  return {
    state: 'DESCADASTRADO',
    descadastradoEm: agora.toISOString(),
    // Para o agendador de follow-up não tocar mais nesta pessoa nem por
    // engano, além do filtro por estado.
    followupsAgendados: false,
  };
}

module.exports = { pediuDescadastro, camposDeDescadastro, PALAVRAS };
