// Qual das opções o paciente escolheu.
//
// Função pura, separada do fluxo, porque errar aqui marca a consulta no
// horário errado — e a pessoa só descobre quando aparecer no dia errado.
//
// A régua é: na dúvida, NÃO escolhe. Devolver null faz a assistente perguntar
// de novo, o que custa uma mensagem. Chutar custa uma consulta perdida e a
// confiança de quem confiou no sistema.

// A forma em dígito EXIGE a marca de ordinal (1º, 2o). Sem isso, "1" cru
// casava aqui e passava na frente da checagem de ambiguidade lá embaixo — e
// "1 ou 2?" virava escolha da opção 1, "dia 2 pode?" virava a opção 2, e
// "2 horas da tarde" também. Dígito solto é problema do outro caminho, que
// sabe recusar quando há mais de um número.
const ORDINAIS = [
  [/\b(primeir[ao]|1[ºo°a])/i, 0],
  [/\b(segund[ao]|2[ºo°a])/i, 1],
  [/\b(terceir[ao]|3[ºo°a])/i, 2],
];

// "2a feira" é segunda-feira, não a opção 2. "3a feira" é terça. Sem esta
// exceção, quem responde "pode ser 2a feira" marca o horário errado — e só
// descobre no dia.
const DIA_DA_SEMANA = /\b[1-7][ºo°a]?\s*-?\s*feira/i;

const normalizar = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * Devolve o índice (0, 1, 2) da opção escolhida, ou null.
 * @param {string} texto a mensagem do paciente
 * @param {number} quantas quantas opções foram oferecidas
 */
function escolhida(texto, quantas) {
  const t = normalizar(texto);
  if (!t || !quantas) return null;

  if (!DIA_DA_SEMANA.test(t)) {
    for (const [regex, indice] of ORDINAIS) {
      if (indice < quantas && regex.test(t)) return indice;
    }
  }

  // Números soltos. "pode ser 2" conta; "dia 2" e "2 horas" não, porque ali o
  // número é de outra coisa — é o tipo de engano que marca o dia errado.
  const semRuido = t
    .replace(/\bdia\s+\d+/g, ' ')
    .replace(/\b\d+\s*(h|hr|hrs|hora|horas|min|minutos)\b/g, ' ')
    .replace(/\b\d{1,2}[:h]\d{2}\b/g, ' ');
  const numeros = (semRuido.match(/\b[1-9]\b/g) || []).map(Number);
  const validos = [...new Set(numeros)].filter((n) => n >= 1 && n <= quantas);

  // Dois números diferentes na mesma mensagem ("1 ou 2?") não é escolha.
  if (validos.length !== 1) return null;
  return validos[0] - 1;
}

module.exports = { escolhida };
