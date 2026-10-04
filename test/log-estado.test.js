const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

// A linha de log do flow.js dizia "entrou em estado HANDOFF" a cada mensagem
// de alguém que já estava em HANDOFF há dias. Lendo o log da Railway, isso se
// parece exatamente com um bug de entrega — e custou uma investigação inteira
// num dia em que o sistema estava correto.
//
// Log que mente é pior que log que falta: manda procurar no lugar errado.
test('o log não anuncia transição de estado que não houve', () => {
  const flow = fs.readFileSync(path.join(__dirname, '..', 'src', 'flow.js'), 'utf8');
  const linhasDeLog = flow
    .split('\n')
    .filter((l) => !l.trim().startsWith('//'))
    .filter((l) => l.includes('console.log') || l.includes('console.error'));

  for (const linha of linhasDeLog) {
    assert.doesNotMatch(
      linha,
      /entrou em estado/,
      `"entrou em estado" descreve transição; esta linha roda a cada mensagem: ${linha.trim()}`
    );
  }
});
