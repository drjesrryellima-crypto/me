// Espera a pessoa terminar de escrever antes de responder.
//
// Em 07/10/2026 um paciente mandou uma sequência de mensagens contando que
// tinha aberto uma caixa de fotos da família e chorado. O bot respondeu CADA
// UMA, separadamente: 21 respostas em 5 segundos, várias dizendo quase a mesma
// coisa com palavras diferentes.
//
// Não era duplicação — era ritmo. Quem desabafa escreve em pedaços:
//
//   "abri uma caixa hoje"
//   "tinha foto da minha avó"
//   "chorei que nem criança"
//
// São três linhas de um pensamento só. Nenhuma pessoa responderia as três
// separadamente, e responder assim mostra que do outro lado não tem ninguém
// ouvindo de verdade — tem uma máquina reagindo a estímulo.
//
// Então: junta o que chegou, espera alguns segundos de silêncio, responde uma
// vez só.

// Quanto silêncio conta como "terminei de escrever". Entre linhas de um mesmo
// desabafo a pausa costuma ser de 2 a 5 segundos; 8 cobre isso com folga sem
// deixar um "oi" solto esperando tempo demais.
const ESPERA_MS = Number(process.env.AGRUPADOR_ESPERA_MS || 8000);

// Teto de segurança: alguém escrevendo sem parar nunca receberia resposta, e o
// silêncio para quem está em sofrimento é pior que uma resposta no meio.
const ESPERA_MAXIMA_MS = Number(process.env.AGRUPADOR_ESPERA_MAXIMA_MS || 30000);

// Em memória de propósito: é estado de segundos. Persistir num arquivo não
// ajudaria, porque quem dispara o envio é um timer deste processo — reiniciar
// perderia o timer de qualquer jeito. O que NÃO se perde é a mensagem em si:
// quem chama registra o turno no histórico antes de bufferizar.
const pendentes = new Map();

function limpar(phone) {
  const atual = pendentes.get(phone);
  if (atual && atual.timer) clearTimeout(atual.timer);
  pendentes.delete(phone);
}

/**
 * Guarda a mensagem e agenda o processamento para quando a pessoa parar de
 * escrever. Cada mensagem nova adia o envio — até o teto.
 *
 * @param {string} phone
 * @param {string} texto
 * @param {(textoJunto: string) => Promise<void>} processar
 */
function agrupar(phone, texto, processar) {
  const agora = Date.now();
  const atual = pendentes.get(phone) || { textos: [], primeiraEm: agora, timer: null };

  if (atual.timer) clearTimeout(atual.timer);
  atual.textos.push(texto);

  const desdeAPrimeira = agora - atual.primeiraEm;
  const restanteDoTeto = Math.max(0, ESPERA_MAXIMA_MS - desdeAPrimeira);
  const espera = Math.min(ESPERA_MS, restanteDoTeto);

  atual.timer = setTimeout(() => {
    const juntado = (pendentes.get(phone) || atual).textos.join('\n');
    limpar(phone);
    if (atual.textos.length > 1) {
      console.log(`[agrupador] ${phone}: ${atual.textos.length} mensagens viraram uma resposta só`);
    }
    // Erro aqui não pode derrubar o processo: está num timer, fora de qualquer
    // try do chamador, e exceção solta em callback de setTimeout mata o Node.
    Promise.resolve(processar(juntado)).catch((err) =>
      console.error(`[agrupador] falha ao processar ${phone}: ${err.message}`)
    );
  }, espera);

  // unref: um timer pendente não deve segurar o processo vivo no encerramento.
  if (typeof atual.timer.unref === 'function') atual.timer.unref();
  pendentes.set(phone, atual);
}

/**
 * Esvazia o buffer e devolve o que estava lá, sem processar.
 *
 * Usado quando algo precisa furar a fila — sinal de crise, pedido de
 * descadastro. Nesses casos o que já foi escrito entra junto na mesma
 * chamada, em vez de ficar pendurado num timer que nunca mais vai disparar.
 */
function esvaziar(phone) {
  const atual = pendentes.get(phone);
  limpar(phone);
  return atual ? atual.textos : [];
}

function pendente(phone) {
  return (pendentes.get(phone) || { textos: [] }).textos.length;
}

module.exports = { agrupar, esvaziar, pendente, ESPERA_MS, ESPERA_MAXIMA_MS };
