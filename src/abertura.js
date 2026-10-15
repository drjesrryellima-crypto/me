// Quem escreve para o consultório tem direito de saber com quem está falando
// antes de qualquer outra coisa. Pedido do Dr. Jesrryel em 15/10/2026: a
// primeira fala do bot cumprimenta, se identifica e só então segue o assunto.
//
// Isto não é cortesia, é honestidade: a pessoa está contando coisa íntima no
// WhatsApp de um consultório e precisa saber que do outro lado está uma
// assistente automática, não o médico. Quem acha que está falando com o médico
// escreve coisas diferentes — e espera respostas que este canal não dá.
//
// Mora num módulo próprio, puro, porque é uma regra que não pode depender de
// nada: nem da IA ter lido o prompt, nem do roteiro fixo, nem de qual caminho
// do flow.js respondeu primeiro. O enviar() do flow.js cola isto na primeira
// mensagem de cada conversa, qualquer que seja o caminho.

// Mossoró = America/Fortaleza = UTC-3 o ano inteiro (sem horário de verão
// desde 2019). O servidor roda em UTC, então sem esta conta um "boa noite"
// às 21h de Mossoró sairia como "bom dia" de madrugada.
const FUSO_HORAS = -3;

function horaEmMossoro(agora = new Date()) {
  const deslocado = new Date(agora.getTime() + FUSO_HORAS * 60 * 60 * 1000);
  return deslocado.getUTCHours();
}

function saudacao(agora = new Date()) {
  const hora = horaEmMossoro(agora);
  if (hora >= 5 && hora < 12) return 'Bom dia';
  if (hora >= 12 && hora < 18) return 'Boa tarde';
  return 'Boa noite';
}

// O 💙 fica aqui, e por isso saiu das outras aberturas: um por conversa.
function abertura(agora = new Date()) {
  return (
    `${saudacao(agora)}! Aqui é do consultório do Dr. Jesrryel Lima — ` +
    `eu sou a assistente dele 💙`
  );
}

// A primeira fala é a primeira vez que o BOT fala, não a primeira mensagem da
// pessoa. Olhar o estado do lead não serviria: um lead reativado no painel
// volta para NOVO e receberia a apresentação de novo no meio da conversa.
function ehPrimeiraFala(lead) {
  const historico = (lead && lead.historicoConversa) || [];
  return !historico.some((t) => t && t.role === 'assistant');
}

function comAbertura(texto, lead, agora = new Date()) {
  if (!ehPrimeiraFala(lead)) return texto;
  return `${abertura(agora)}\n\n${texto}`;
}

module.exports = { abertura, saudacao, ehPrimeiraFala, comAbertura, horaEmMossoro };
