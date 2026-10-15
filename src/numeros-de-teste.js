// Os números do próprio médico, usados para testar o bot, chegam no webhook
// exatamente como o de um paciente — e por isso viravam lead: contavam no
// painel, iam para a planilha de CRM, entravam na fila de follow-up PAGO e
// geravam alerta no celular dele. Teste dele mesmo cobrando dele mesmo.
//
// NUMEROS_DE_TESTE lista esses números. O bot continua RESPONDENDO (é disso
// que o teste serve); o que ele deixa de fazer é tratar o teste como paciente.
//
// O 9º dígito é a parte que mais engana. O mesmo celular aparece em duas
// formas: +55 84 99709-6643 (13 dígitos, como está na agenda) e
// 558497096643 (12 dígitos, como a Meta entrega no wa_id). Comparar texto com
// texto deixaria a lista silenciosamente sem efeito — o pior tipo de falha,
// porque nada quebra e nada avisa. Por isso tudo passa por canonizar() antes
// de comparar.

function soDigitos(valor) {
  return String(valor || '').replace(/\D/g, '');
}

// Reduz as duas formas de um celular brasileiro à mesma: 55 + DDD + 8 dígitos.
// Número de outro país (ou que não tem a cara de um celular BR) volta só com
// os dígitos, sem invenção.
function canonizar(valor) {
  const d = soDigitos(valor);
  if (!d.startsWith('55')) return d;

  const resto = d.slice(2);
  // DDD (2) + assinante (8 ou 9). Fora disso não dá para afirmar nada.
  if (resto.length !== 10 && resto.length !== 11) return d;

  const ddd = resto.slice(0, 2);
  let assinante = resto.slice(2);
  if (assinante.length === 9 && assinante.startsWith('9')) assinante = assinante.slice(1);

  return `55${ddd}${assinante}`;
}

function lista(bruto = process.env.NUMEROS_DE_TESTE) {
  return String(bruto || '')
    .split(/[,;\s]+/)
    .map(canonizar)
    .filter((n) => n.length >= 10);
}

// Recebe o telefone em qualquer formato. Lê a variável na hora da chamada em
// vez de no carregamento do módulo: assim mudar a variável na Railway vale no
// deploy seguinte sem depender da ordem em que os arquivos são importados.
function ehTeste(phone, bruto = process.env.NUMEROS_DE_TESTE) {
  const alvo = canonizar(phone);
  if (!alvo) return false;
  return lista(bruto).includes(alvo);
}

function configurados(bruto = process.env.NUMEROS_DE_TESTE) {
  return lista(bruto).length;
}

module.exports = { ehTeste, canonizar, lista, configurados, soDigitos };
