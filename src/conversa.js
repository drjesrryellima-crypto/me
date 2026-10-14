// A conversa que o paciente teve com o número do consultório.
//
// Ela existe desde sempre em lead.historicoConversa — é o contexto que a
// assistente recebe a cada mensagem — mas não havia nenhum lugar onde o médico
// pudesse LER. O número do consultório é da Cloud API: não tem WhatsApp
// instalado (e não pode ter, senão o webhook para), e a Meta não dá caixa de
// entrada para número de API. O log da Railway, de propósito, só guarda o
// tamanho das mensagens. Resultado: o médico recebia o alerta de handoff com a
// última frase e assumia a conversa sem saber o que já foi dito antes.
//
// Este módulo é só a tradução do histórico para algo legível. Fica separado do
// dashboard.js para poder ser testado sem subir o express.

// Quem falou, em português, porque 'assistant' na tela não diz nada. O autor
// 'medico' vem das respostas enviadas pelo painel: aos olhos da IA é o mesmo
// lado da conversa, mas para quem lê a diferença é o ponto inteiro.
function quemFalou(turno) {
  if (turno.role === 'user') return 'paciente';
  if (turno.autor === 'medico') return 'medico';
  return 'assistente';
}

const ROTULO = {
  paciente: 'Paciente',
  medico: 'Você (pelo painel)',
  assistente: 'Assistente',
};

function montarConversa(lead) {
  if (!lead) return null;
  const turnos = (lead.historicoConversa || [])
    .filter((t) => t && t.role && t.content)
    .map((t) => {
      const quem = quemFalou(t);
      return {
        quem,
        rotulo: ROTULO[quem],
        texto: String(t.content),
        // Turnos gravados antes desta versão não têm hora. Devolver null (e não
        // a data de agora) é o que impede a tela de inventar um horário que
        // ninguém registrou.
        em: t.em || null,
      };
    });

  return {
    phone: lead.phone,
    nome: lead.nome || '',
    state: lead.state || 'NOVO',
    // O corte em 40 turnos é do flow.js. Dizer isso na tela evita o médico
    // concluir que a conversa começou onde ela só foi cortada.
    turnos,
    truncada: turnos.length >= 40,
  };
}

module.exports = { montarConversa, quemFalou, ROTULO };
