// Traduz o erro que a API da Meta devolve.
//
// Sozinho, o erro do axios é "Request failed with status code 400" — que não
// diz nada sobre a causa. O motivo real vem em err.response.data.error, com um
// código numérico que só faz sentido pra quem já conhece a tabela da Meta.
//
// Isto nasceu no scripts/testar-whatsapp.js, que roda no Mac. Mas quem mais
// precisa da tradução é o SERVIDOR: quando o envio falha em produção, ninguém
// está olhando um terminal — só sobra a linha do log, e ela precisa se explicar
// sozinha.

const DICAS = {
  190: 'O token expirou ou é inválido. Os tokens temporários duram 24h — gere outro.',
  100: 'Algum parâmetro está errado. Confira o WHATSAPP_PHONE_NUMBER_ID.',
  131030:
    'O número de destino não está na lista de destinatários permitidos. Enquanto o app está em modo de teste, só dá pra mandar pra números cadastrados no painel da Meta.',
  131047:
    'Passaram mais de 24h desde a última mensagem que essa pessoa te mandou. Fora dessa janela, a Meta só aceita template pré-aprovado.',
  131026: 'O número de destino não tem WhatsApp, ou não consegue receber mensagem.',
  133010: 'O número remetente não está registrado na API.',
  131037:
    'O nome de exibição desse número ainda não foi aprovado pela Meta. Número novo começa assim: dá pra RECEBER mensagem, mas não dá pra ENVIAR até o nome passar pela análise. Veja em business.facebook.com/wa/manage/phone-numbers — a coluna "Nome" mostra o status.',
  131042:
    'Falta forma de pagamento na conta do WhatsApp Business. Sem ela a Meta não deixa iniciar conversa.',
  131031: 'A conta do WhatsApp Business foi bloqueada ou restringida pela Meta.',
  368: 'O número foi temporariamente bloqueado por violação de política.',
};

/**
 * @param {Error} err erro do axios
 * @param {{multilinha?: boolean}} opcoes multilinha formata pra terminal;
 *        o padrão é uma linha só, que é o que serve num log.
 */
function explicarErroMeta(err, { multilinha = false } = {}) {
  const meta = err && err.response && err.response.data && err.response.data.error;
  const quebra = multilinha ? '\n\n  ' : ' — ';

  // Nem todo erro vem no formato da Meta: proxy corporativo, rede fora, DNS.
  // Mostrar o corpo cru nesses casos é melhor que engolir e deixar só o status
  // HTTP, que sozinho não diz nada.
  if (!meta) {
    const corpo = err && err.response && err.response.data;
    const cru = corpo ? `${quebra}Resposta recebida: ${JSON.stringify(corpo).slice(0, 300)}` : '';
    return (
      `${(err && err.message) || 'erro desconhecido'}${cru}` +
      `${quebra}Esse erro não veio no formato da API da Meta — pode ser rede, proxy ou firewall.`
    );
  }

  const detalhe = meta.error_data && meta.error_data.details ? ` (${meta.error_data.details})` : '';
  const dica = DICAS[meta.code];

  return (
    `${meta.message}${detalhe}` +
    (dica ? `${quebra}O que isso quer dizer: ${dica}` : '') +
    `${quebra}[código ${meta.code}]`
  );
}

module.exports = { explicarErroMeta, DICAS };
