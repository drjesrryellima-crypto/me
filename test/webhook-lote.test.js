const test = require('node:test');
const assert = require('node:assert');

// A Meta agrupa mensagens que chegam juntas num único POST. O código lia só
// messages[0]: quem escrevia três linhas seguidas tinha duas descartadas em
// silêncio — fora do histórico, fora do alerta, inexistentes para o sistema.
//
// Teste sobre o próprio arquivo: subir o servidor inteiro aqui exigiria dublê
// de Meta, de disco e de Telegram para provar uma coisa só.
const fs = require('fs');
const path = require('path');
const server = fs.readFileSync(path.join(__dirname, '..', 'src', 'server.js'), 'utf8');

test('o webhook não lê apenas a primeira mensagem do lote', () => {
  const codigo = server
    .split('\n')
    .filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*'))
    .join('\n');
  assert.match(codigo, /value\?\.messages \|\| \[\]/, 'perdeu a leitura do lote inteiro');
  assert.match(codigo, /lote\.slice\(1\)/, 'parou de processar as mensagens seguintes');
});

test('cada mensagem do lote passa pelo dedupe', () => {
  const trecho = server.slice(server.indexOf('lote.slice(1)'));
  assert.match(trecho.slice(0, 400), /jaProcessado\(extra\.id\)/);
});

// Em paralelo embaralharia a máquina de estados, que é sequencial.
test('as mensagens do lote são processadas em sequência', () => {
  const trecho = server.slice(server.indexOf('lote.slice(1)'), server.indexOf('lote.slice(1)') + 500);
  assert.match(trecho, /await handleIncomingMessage/);
  assert.doesNotMatch(trecho, /Promise\.all/);
});
