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

module.exports = { ETAPA_QUALIFICACAO, ETAPA_FOLLOWUP, ROTULO_ESTADO, MARCA_RISCO, ehRisco, rotular };
