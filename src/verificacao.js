// Diz POR QUE a verificação do webhook falhou, sem imprimir o token no log.
//
// A Meta responde sempre a mesma frase genérica ("não foi possível validar a
// URL de callback ou o token de verificação"), e o servidor respondia só 403.
// Com as duas pontas mudas, não dava pra saber se o problema era espaço
// sobrando no valor, variável que ficou sem definir, ou deploy que ainda não
// tinha reiniciado com o valor novo — e cada tentativa custava um ciclo de
// deploy pra descobrir nada.
//
// Compara o que dá pra comparar e conta o resultado. Nunca o valor em si: o
// log da Railway é visível pra qualquer um com acesso ao projeto.

const temEspacoSobrando = (valor) => valor !== valor.trim();

function diagnosticarVerificacao(mode, token, esperado) {
  if (!esperado) {
    return 'WHATSAPP_VERIFY_TOKEN não está definida neste deploy. Defina na Railway e espere o serviço reiniciar.';
  }
  if (mode !== 'subscribe') {
    return `hub.mode veio como "${mode}" em vez de "subscribe" — a chamada não parece ser da verificação da Meta.`;
  }
  if (token == null || token === '') {
    return 'a chamada não trouxe hub.verify_token.';
  }
  if (token.trim() === esperado.trim()) {
    const onde = [];
    if (temEspacoSobrando(token)) onde.push('no que a Meta mandou');
    if (temEspacoSobrando(esperado)) onde.push('na variável da Railway');
    return (
      `os dois valores são iguais depois de tirar espaços — sobrou espaço ${onde.join(' e ')}. ` +
      'Apague o campo e DIGITE o valor em vez de colar.'
    );
  }
  return (
    `os tokens são diferentes (o que a Meta mandou tem ${token.length} caracteres, ` +
    `o da variável tem ${esperado.length}). Confira se a Railway já reiniciou com o valor novo — ` +
    'variável trocada só vale depois que o deploy termina.'
  );
}

module.exports = { diagnosticarVerificacao };
