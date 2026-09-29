const test = require('node:test');
const assert = require('node:assert');
const { linkDaConversa } = require('../src/link-whatsapp');

test('monta o link a partir do wa_id que a Meta manda', () => {
  assert.equal(linkDaConversa('558499687397'), 'https://wa.me/558499687397');
});

test('não inventa nono dígito — o wa_id da Meta já é o número certo', () => {
  // Se algum dia alguém "consertar" o número brasileiro aqui, o link para de
  // abrir a conversa. O teste existe para essa tentação.
  assert.equal(linkDaConversa('558499687397'), 'https://wa.me/558499687397');
});

test('aceita número formatado e joga fora o enfeite', () => {
  assert.equal(linkDaConversa('+55 84 99968-7397'), 'https://wa.me/5584999687397');
});

test('sem número não há link', () => {
  assert.equal(linkDaConversa(undefined), null);
  assert.equal(linkDaConversa(''), null);
  assert.equal(linkDaConversa('55'), null);
});

test('o alerta traz o link clicável junto do telefone', async () => {
  delete require.cache[require.resolve('../src/alert')];
  delete require.cache[require.resolve('../src/telegram')];
  const telegram = require('../src/telegram');
  const enviados = [];
  telegram.enviarAlerta = async (texto) => { enviados.push(texto); return true; };

  const { sendHandoffAlert } = require('../src/alert');
  await sendHandoffAlert({
    priority: 'RISCO/CRISE — URGENTE',
    phone: '558499687397',
    motivo: 'ansiedade',
    classificacao: 'Recomeço',
    ultimaMensagem: 'oi',
  });

  assert.equal(enviados.length, 1);
  assert.match(enviados[0], /https:\/\/wa\.me\/558499687397/);
});
