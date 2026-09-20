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
function explicar(err) {
  const meta = err.response?.data?.error;

  // Nem todo erro vem no formato da Meta: proxy corporativo, rede fora, DNS.
  // Mostrar o corpo cru nesses casos é melhor que engolir e deixar só o
  // status HTTP, que sozinho não diz nada.
  if (!meta) {
    const corpo = err.response?.data;
    const cru = corpo ? `\n\n  Resposta recebida: ${JSON.stringify(corpo).slice(0, 300)}` : '';
    return `${err.message}${cru}` +
      '\n\n  Esse erro não veio no formato da API da Meta — pode ser rede, proxy ou firewall.';
  }

  const dicas = {
    190: 'O token expirou ou é inválido. Os tokens temporários duram 24h — gere outro.',
    100: 'Algum parâmetro está errado. Confira o WHATSAPP_PHONE_NUMBER_ID.',
    131030:
      'O número de destino não está na lista de destinatários permitidos. Enquanto o app está em modo de teste, só dá pra mandar pra números cadastrados no painel da Meta.',
    131047:
      'Passaram mais de 24h desde a última mensagem que essa pessoa te mandou. Fora dessa janela, a Meta só aceita template pré-aprovado.',
    131026: 'O número de destino não tem WhatsApp, ou não consegue receber mensagem.',
    133010: 'O número remetente não está registrado na API.',
    131037:
      'O nome de exibição desse número ainda não foi aprovado pela Meta. Número novo começa assim: dá pra RECEBER mensagem, mas não dá pra ENVIAR até o nome passar pela análise. Veja em business.facebook.com/wa/manage/phone-numbers — a coluna "Nome" mostra o status.',
    131042:
      'Falta forma de pagamento na conta do WhatsApp Business. Sem ela a Meta não deixa iniciar conversa.',
    131031: 'A conta do WhatsApp Business foi bloqueada ou restringida pela Meta.',
    368: 'O número foi temporariamente bloqueado por violação de política.',
  };

  const dica = dicas[meta.code];
  return `${meta.message}${meta.error_data?.details ? ` (${meta.error_data.details})` : ''}` +
    (dica ? `\n\n  O que isso quer dizer: ${dica}` : '') +
    `\n\n  [código ${meta.code}]`;
}

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
    console.error(`  ${explicar(err)}\n`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('\nErro inesperado:', err.message, '\n');
  process.exit(1);
});
