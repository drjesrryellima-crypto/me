// Decide QUAL follow-up mandar, e principalmente qual NÃO mandar.
//
// Até 14/10/2026 o laço mandava toda etapa vencida de uma vez. Enquanto os
// templates não estavam configurados, cada etapa era pulada sem registro — e
// `followupsEnviados` ficava vazio para todo mundo.
//
// O resultado estava armado para o dia em que o pagamento na Meta fosse
// ligado: um lead com o catálogo enviado há 30 dias tem `dias = 30`, que é
// maior que 2, 3, 5 E 7. Na primeira rodada ele receberia os QUATRO
// follow-ups seguidos — mensagens pagas, atrasadas semanas, numa rajada.
//
// É a forma exata do episódio das 21 mensagens, com duas pioras: custa
// dinheiro e vai para quem já tinha esfriado.

// Uma etapa muito atrasada não é uma etapa pendente — é uma etapa perdida.
// Mandar "passando pra saber se ficou dúvida" três semanas depois não retoma
// conversa nenhuma; só lembra a pessoa de que ela é uma linha numa planilha.
const TOLERANCIA_DIAS = 3;

// O D+2 saiu em 18/10/2026: o médico apagou o template na Meta e a sequência
// passou a ser D+3, D+5, D+7. Dois dias é cedo para quem acabou de conversar.
//
// 'D2' continua reconhecido como etapa JÁ RESOLVIDA (ver jaResolvidas abaixo)
// e FOLLOWUP_D2 continua em estados.js: há leads antigos carregando isso no
// disco e na planilha, e some do futuro não é some do passado.
const ETAPAS = [
  { dia: 3, chave: 'D3', variavel: 'WHATSAPP_TEMPLATE_D3' },
  { dia: 5, chave: 'D5', variavel: 'WHATSAPP_TEMPLATE_D5' },
  { dia: 7, chave: 'D7', variavel: 'WHATSAPP_TEMPLATE_D7' },
];

const PARADOS = ['HANDOFF', 'CLIENTE', 'DESQUALIFICADO', 'DESCADASTRADO'];

function diasDesde(iso, agora) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return Math.floor((agora.getTime() - d.getTime()) / 86400000);
}

/**
 * @returns {{acao: 'nada'} |
 *           {acao: 'pular', chaves: string[], motivo: string} |
 *           {acao: 'enviar', etapa: object, dias: number, pular: string[]}}
 */
function planejarFollowup(lead, agora = new Date()) {
  if (!lead || !lead.followupsAgendados) return { acao: 'nada' };
  if (PARADOS.includes(lead.state)) return { acao: 'nada' };
  if (!lead.catalogoEnviadoEm) return { acao: 'nada' };

  const dias = diasDesde(lead.catalogoEnviadoEm, agora);
  if (dias === null) return { acao: 'nada' };

  const jaResolvidas = new Set([...(lead.followupsEnviados || []), ...(lead.followupsPulados || [])]);
  const vencidas = ETAPAS.filter((e) => dias >= e.dia && !jaResolvidas.has(e.chave));
  if (!vencidas.length) return { acao: 'nada' };

  const atrasadas = vencidas.filter((e) => dias - e.dia > TOLERANCIA_DIAS);
  const noPrazo = vencidas.filter((e) => dias - e.dia <= TOLERANCIA_DIAS);

  if (!noPrazo.length) {
    return {
      acao: 'pular',
      chaves: atrasadas.map((e) => e.chave),
      motivo: `${dias} dias desde o catálogo — passou da janela de cada etapa`,
    };
  }

  // UMA por rodada. O agendador roda uma vez por dia; mandar duas de uma vez
  // seria conversa nenhuma, seria disparo.
  //
  // A mais antiga das que estão no prazo: se D3 e D5 venceram juntas, a
  // sequência começa onde devia começar, não no meio.
  return {
    acao: 'enviar',
    etapa: noPrazo[0],
    dias,
    pular: atrasadas.map((e) => e.chave),
  };
}

module.exports = { planejarFollowup, ETAPAS, TOLERANCIA_DIAS, PARADOS };
