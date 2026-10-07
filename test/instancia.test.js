const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

// Em 07/10/2026 a suspeita de instância duplicada não pôde ser confirmada nem
// descartada: nenhuma linha do log dizia QUAL processo tinha respondido.
// Dois ids na mesma janela provam duplicação; um id só aponta para reenvio.
const server = fs.readFileSync(path.join(__dirname, '..', 'src', 'server.js'), 'utf8');

// Só as linhas POR ENTREGA. As do boot e as da verificação GET da Meta não
// atribuem nada a um processo específico — exigir a marca nelas seria ruído.
test('toda linha de log por entrega carrega a instância que a escreveu', () => {
  // Delimitado no fim do handler: depois dele vêm os avisos de boot, que não
  // atribuem nada a processo nenhum.
  const inicio = server.indexOf("app.post('/webhook'");
  const corpoDoPost = server.slice(inicio, server.indexOf("app.get('/privacidade'", inicio));
  assert.ok(corpoDoPost.length > 100, 'não achou o corpo do handler do webhook');
  const semMarca = corpoDoPost
    .split('\n')
    .filter((l) => !l.trim().startsWith('//'))
    .filter((l) => /\[webhook\]/.test(l));

  assert.deepEqual(
    semMarca.map((l) => l.trim()),
    [],
    'linha de entrega sem a marca da instância'
  );
});

test('o boot anuncia a instância', () => {
  assert.match(server, /instância \$\{INSTANCIA\}/);
});
