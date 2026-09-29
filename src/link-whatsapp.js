// Transforma o número que a Meta manda no webhook num link que abre a conversa.
//
// O alerta chegava com o telefone escrito. Para responder, o médico tinha que
// selecionar, copiar, abrir o WhatsApp, colar na busca — quatro passos, com o
// celular na mão, às vezes de madrugada, às vezes num alerta de crise. Cada um
// deles é um lugar onde dá para desistir.
//
// O wa_id da Meta já é o identificador canônico da conversa no WhatsApp (é
// dele que vem, inclusive, a ausência do nono dígito nos celulares brasileiros:
// 5584 9968-7397 chega como 558499687397). Então ele entra direto no wa.me
// sem nenhuma normalização de DDD — mexer nisso quebraria o link.

/**
 * @param {string} phone número como veio do webhook da Meta
 * @returns {string|null} link wa.me, ou null se não der para montar um
 */
function linkDaConversa(phone) {
  const digitos = String(phone || '').replace(/\D/g, '');
  // Um número internacional tem, no mínimo, código de país + assinante. Abaixo
  // disso é lixo (ou o '55' dos testes) e um link quebrado é pior que nenhum:
  // o médico toca, não abre nada, e perde a confiança no alerta inteiro.
  if (digitos.length < 10) return null;
  return `https://wa.me/${digitos}`;
}

module.exports = { linkDaConversa };
