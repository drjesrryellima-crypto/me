// Vocabulário dos estados da máquina de estados do flow.js, num lugar só.
// O dashboard e a planilha do Sheets mostram os dois a mesma coisa pro humano
// que está olhando — se cada um tiver a sua cópia da lista, uma hora elas
// divergem e o mesmo lead aparece com dois nomes diferentes em cada tela.

const ETAPA_QUALIFICACAO = ['NOVO', 'AGUARDANDO_MOTIVO', 'AGUARDANDO_HISTORICO', 'AGUARDANDO_FORMATO'];

const ETAPA_FOLLOWUP = [
  'FOLLOWUP_D2',
  'FOLLOWUP_D3',
  'FOLLOWUP_D5',
  'FOLLOWUP_D7',
  'REENGAJAMENTO_MENSAL',
];

const ROTULO_ESTADO = {
  NOVO: 'Novo',
  AGUARDANDO_MOTIVO: 'Aguardando motivo',
  AGUARDANDO_HISTORICO: 'Aguardando histórico',
  AGUARDANDO_FORMATO: 'Aguardando formato',
  CATALOGO_ENVIADO: 'Catálogo enviado',
  FOLLOWUP_D2: 'Follow-up D+2',
  FOLLOWUP_D3: 'Follow-up D+3',
  FOLLOWUP_D5: 'Follow-up D+5',
  FOLLOWUP_D7: 'Follow-up D+7',
  REENGAJAMENTO_MENSAL: 'Reengajamento mensal',
  HANDOFF: 'Handoff',
  DESQUALIFICADO: 'Desqualificado',
  CLIENTE: 'Cliente',
};

// A planilha CRM do consultório usa um vocabulário de funil de vendas próprio,
// escrito antes deste bot existir. A coluna Estágio da aba do bot fala essa
// língua pra dar pra cruzar com a aba FUNIL; o código cru continua indo na
// coluna "Estado (técnico)", que não perde precisão nenhuma.
//
// Três estágios da planilha o bot NUNCA escreve, porque dependem de algo que
// acontece fora do WhatsApp e ele não tem como saber: "Consulta Agendada",
// "Convertido" e "Perdido". Esses continuam sendo preenchidos por pessoa.
const ESTAGIO_CRM = {
  NOVO: 'Novo',
  AGUARDANDO_MOTIVO: 'Qualificação',
  AGUARDANDO_HISTORICO: 'Qualificação',
  AGUARDANDO_FORMATO: 'Qualificação',
  CATALOGO_ENVIADO: 'Nutrição',
  FOLLOWUP_D2: 'Nutrição',
  FOLLOWUP_D3: 'Nutrição',
  FOLLOWUP_D5: 'Nutrição',
  FOLLOWUP_D7: 'Nutrição',
  REENGAJAMENTO_MENSAL: 'Nutrição',
  HANDOFF: 'Consulta Proposta',
  DESQUALIFICADO: 'Desqualificado',
  CLIENTE: 'Convertido',
};

// HANDOFF é o encaixe imperfeito: no vocabulário da planilha, "Consulta
// Proposta" significa que já ofereceram horários. Aqui significa só que a
// automação passou a conversa pra um humano — o que no caso de intenção de
// compra dá no mesmo, mas no caso de RISCO/CRISE não é estágio de venda
// nenhum. Quem desempata é a coluna Risco: "Consulta Proposta" + Risco=SIM
// se lê como "humano precisa agir agora, e não é sobre vender".
function estagioCrm(state) {
  return ESTAGIO_CRM[state] || state || '';
}

const MARCA_RISCO = 'RISCO/CRISE';

function ehRisco(lead) {
  return typeof lead.notas === 'string' && lead.notas.includes(MARCA_RISCO);
}

// Estado desconhecido cai de volta no próprio código em vez de virar vazio:
// melhor o humano ver "FOO_BAR" e perguntar o que é do que ver uma célula em
// branco e achar que o lead não tem estágio.
function rotular(state) {
  return ROTULO_ESTADO[state] || state || '';
}

module.exports = { ETAPA_QUALIFICACAO, ETAPA_FOLLOWUP, ROTULO_ESTADO, ESTAGIO_CRM, MARCA_RISCO, ehRisco, rotular, estagioCrm };
