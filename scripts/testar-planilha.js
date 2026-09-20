// Escreve um lead de teste na planilha e conta o que aconteceu.
//
// Serve pra responder uma pergunta só: "a conexão com o Google Sheets está
// funcionando?". Sem depender da Meta, do WhatsApp, do ngrok ou de deploy —
// que são as quatro coisas que costumam esconder o problema real.
//
//   node scripts/testar-planilha.js
//
// Depois de rodar, olhe a aba: deve ter uma linha com o telefone 5500000000000.
// Rodar de novo ATUALIZA a mesma linha em vez de criar outra — é assim que dá
// pra saber que o upsert está funcionando.

require('dotenv').config();
const fs = require('fs');
const { appendLeadRow, COLUNAS } = require('../src/sheets');
const { getLead } = require('../src/state');

const TELEFONE_TESTE = '5500000000000';

function conferirConfiguracao() {
  const problemas = [];
  const creds = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;

  if (!fs.existsSync('.env')) {
    problemas.push('Não existe arquivo .env nesta pasta. Rode: cp .env.example .env');
  }
  if (!creds) {
    problemas.push('GOOGLE_SERVICE_ACCOUNT_JSON não está definido no .env.');
  } else if (!fs.existsSync(creds)) {
    problemas.push(
      `O arquivo de credencial não existe em "${creds}".\n` +
        '     Baixe a chave JSON da service account no Google Cloud Console e salve nesse caminho.'
    );
  }
  if (!process.env.GOOGLE_SHEET_ID) {
    problemas.push('GOOGLE_SHEET_ID não está definido no .env.');
  }
  if (!process.env.GOOGLE_SHEET_TAB) {
    problemas.push('GOOGLE_SHEET_TAB não está definido no .env (o nome exato da aba).');
  }
  return problemas;
}

async function main() {
  console.log('\n--- Teste de gravação no Google Sheets ---\n');

  const problemas = conferirConfiguracao();
  if (problemas.length) {
    console.error('Faltou configurar:\n');
    problemas.forEach((p, i) => console.error(`  ${i + 1}. ${p}`));
    console.error('\nVeja a seção 3 do README.\n');
    process.exit(1);
  }

  console.log(`Planilha: ${process.env.GOOGLE_SHEET_ID}`);
  console.log(`Aba:      "${process.env.GOOGLE_SHEET_TAB}"`);
  console.log(`Colunas:  ${COLUNAS.length} (A até ${String.fromCharCode(64 + COLUNAS.length)})\n`);

  const agora = new Date().toISOString();
  const leadFalso = {
    phone: TELEFONE_TESTE,
    nome: 'LEAD DE TESTE (pode apagar)',
    state: 'CATALOGO_ENVIADO',
    classificacao: 'Recomeço',
    motivo: 'teste de conexão com a planilha',
    historico: 'primeira vez',
    formato: 'online',
    followupsEnviados: [],
    notas: `Escrito por scripts/testar-planilha.js em ${agora}`,
    createdAt: agora,
    updatedAt: agora,
  };

  try {
    await appendLeadRow(leadFalso);
  } catch (err) {
    console.error('\n✗ A gravação falhou.\n');
    console.error(`  ${err.message}\n`);

    // Os três erros que acontecem de verdade, com a saída certa pra cada um.
    if (/Unable to parse range|not found/i.test(err.message)) {
      console.error(
        `  Causa provável: a aba "${process.env.GOOGLE_SHEET_TAB}" não existe com esse nome exato.\n` +
          '  Confira maiúscula, acento e espaço — tem que bater caractere por caractere.\n'
      );
    } else if (/permission|403|forbidden/i.test(err.message)) {
      const email = JSON.parse(
        fs.readFileSync(process.env.GOOGLE_SERVICE_ACCOUNT_JSON, 'utf8')
      ).client_email;
      console.error(
        '  Causa provável: a planilha não foi compartilhada com a service account.\n' +
          `  Compartilhe com ${email} como EDITOR.\n`
      );
    } else if (/DECODER|unsupported|invalid.*key|PEM/i.test(err.message)) {
      console.error(
        '  Causa provável: o arquivo JSON da credencial está corrompido ou não é o certo.\n' +
          '  Baixe de novo no Google Cloud Console (Service Accounts → sua conta → Chaves →\n' +
          '  Adicionar chave → Criar nova chave → JSON) e salve por cima, sem editar o conteúdo.\n'
      );
    } else if (/API has not been used|disabled/i.test(err.message)) {
      console.error(
        '  Causa provável: a Google Sheets API não está ativada nesse projeto do Google Cloud.\n' +
          '  Ative em console.cloud.google.com → APIs e Serviços → Google Sheets API.\n'
      );
    }
    process.exit(1);
  }

  console.log('✓ Gravou.\n');
  console.log(`Abra a aba "${process.env.GOOGLE_SHEET_TAB}" e procure o telefone ${TELEFONE_TESTE}.`);
  console.log('A coluna Estágio deve estar como "Nutrição".\n');
  console.log('Rode este comando de novo: a MESMA linha deve ser atualizada, não duplicada.');
  console.log('Se duplicar, o upsert não está achando o telefone na coluna A.\n');
}

main().catch((err) => {
  console.error('\nErro inesperado:', err);
  process.exit(1);
});
