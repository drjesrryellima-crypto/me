// Manda UMA mensagem de teste pelo WhatsApp e conta o que aconteceu.
//
//   node scripts/testar-whatsapp.js 5584999999999
//
// Prova só uma coisa: o programa consegue falar com a API da Meta e entregar
// mensagem. Sem webhook, sem ngrok, sem servidor no ar — que são justamente as
// partes que costumam esconder qual peça está quebrada.
//
// IMPORTANTE: só funciona pra quem já te mandou mensagem nas últimas 24h, ou
// pra um número cadastrado como destinatário de teste no painel da Meta. É
// regra da Meta, não limitação daqui.

require('dotenv').config();
const { sendText } = require('../src/whatsapp');
const { explicarErroMeta } = require('../src/erros-meta');

const AINDA_EXEMPLO = /^coloque_aqui|^escolha_uma/;

function conferirConfiguracao() {
  const problemas = [];
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || AINDA_EXEMPLO.test(token)) {
    problemas.push('WHATSAPP_TOKEN ainda não foi preenchido no .env.');
  }
  if (!phoneId || AINDA_EXEMPLO.test(phoneId)) {
    problemas.push('WHATSAPP_PHONE_NUMBER_ID ainda não foi preenchido no .env.');
  }
  return problemas;
}

// A Meta devolve o motivo real dentro de error.error.message, não no status
// HTTP. Sem desempacotar isso, o erro que chega é um 400 sem explicação.
async function main() {
  const destino = (process.argv[2] || '').replace(/\D/g, '');

  console.log('\n--- Teste de envio pelo WhatsApp ---\n');

  const problemas = conferirConfiguracao();
  if (problemas.length) {
    console.error('Faltou configurar:\n');
    problemas.forEach((p, i) => console.error(`  ${i + 1}. ${p}`));
    console.error('');
    process.exit(1);
  }

  if (!destino) {
    console.error('Faltou dizer pra quem mandar.\n');
    console.error('  Use assim, com DDI e DDD, só números:\n');
    console.error('    node scripts/testar-whatsapp.js 5584999999999\n');
    process.exit(1);
  }

  console.log(`De:   número ${process.env.WHATSAPP_PHONE_NUMBER_ID}`);
  console.log(`Para: ${destino}\n`);

  const texto =
    'Mensagem de teste do sistema de atendimento. ' +
    'Se você recebeu isto, a conexão com o WhatsApp está funcionando.';

  try {
    const { data } = await sendText(destino, texto);
    console.log('✓ A Meta aceitou a mensagem.\n');
    console.log(`  id: ${data?.messages?.[0]?.id || '(sem id)'}`);
    console.log(`  status: ${data?.messages?.[0]?.message_status || 'enviada'}\n`);
    console.log('Confere o WhatsApp do número de destino.');
    console.log('Se não chegar em 1 minuto, a Meta aceitou mas não entregou —');
    console.log('normalmente é o destino não estar na lista de permitidos.\n');
  } catch (err) {
    console.error('✗ Não deu pra enviar.\n');
    console.error(`  ${explicarErroMeta(err, { multilinha: true })}\n`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('\nErro inesperado:', err.message, '\n');
  process.exit(1);
});
