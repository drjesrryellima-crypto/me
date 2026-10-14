const fs = require('fs');

// A credencial do Google chega de dois jeitos, e os dois precisam funcionar:
//
// - No Mac, é um ARQUIVO (credentials/service-account.json) e a variável
//   GOOGLE_SERVICE_ACCOUNT_JSON guarda o caminho dele.
// - Num servidor (Railway/Render), não existe "colocar um arquivo lá dentro":
//   só dá pra definir variável de ambiente. Por isso
//   GOOGLE_SERVICE_ACCOUNT_CREDENTIALS aceita o CONTEÚDO do JSON direto —
//   colado cru ou em base64, que é o formato que sobrevive a painel web que
//   engasga com quebra de linha.
//
// Sem isto, subir o projeto exigia escrever o arquivo no disco no boot na mão:
// passo manual, fácil de esquecer, e o sintoma seria o bot rodando normal e
// simplesmente não gravando nada na planilha.

const VAR_CONTEUDO = 'GOOGLE_SERVICE_ACCOUNT_CREDENTIALS';
const VAR_CAMINHO = 'GOOGLE_SERVICE_ACCOUNT_JSON';

function parseConteudo(bruto) {
  const texto = bruto.trim();
  // base64 não tem chave nem aspas; JSON cru começa com "{".
  const json = texto.startsWith('{')
    ? texto
    : Buffer.from(texto, 'base64').toString('utf8');
  const creds = JSON.parse(json);
  if (!creds.client_email || !creds.private_key) {
    throw new Error('faltam client_email/private_key — não parece a chave da service account');
  }
  return creds;
}

/**
 * Devolve { credentials } ou { keyFile } pronto pra passar ao GoogleAuth,
 * ou null quando não há credencial configurada.
 */
function carregarCredenciais() {
  const conteudo = process.env[VAR_CONTEUDO];
  if (conteudo && conteudo.trim()) {
    try {
      return { credentials: parseConteudo(conteudo), origem: VAR_CONTEUDO };
    } catch (err) {
      console.warn(`[google] ${VAR_CONTEUDO} está definida mas não deu pra ler: ${err.message}`);
      return null;
    }
  }

  const caminho = process.env[VAR_CAMINHO];
  if (caminho && fs.existsSync(caminho)) {
    return { keyFile: caminho, origem: caminho };
  }

  return null;
}

/** Só o que o GoogleAuth aceita — sem o campo `origem`. */
function opcoesDeAuth(scopes) {
  const cred = carregarCredenciais();
  if (!cred) return null;
  const { origem, ...resto } = cred;
  return { ...resto, scopes };
}

/**
 * O e-mail da conta de serviço em uso, ou null.
 *
 * Serve para o log dizer QUEM tentou escrever quando o Google recusa. "The
 * caller does not have permission" sem nome do caller manda procurar no lugar
 * errado: a conta compartilhada na planilha pode não ser a mesma que está na
 * variável de ambiente, e olhando só o erro ninguém descobre isso.
 *
 * É identificador, não segredo — a chave privada nunca sai daqui.
 */
function contaEmUso() {
  const cred = carregarCredenciais();
  if (!cred) return null;
  if (cred.credentials) return cred.credentials.client_email || null;
  try {
    return JSON.parse(fs.readFileSync(cred.keyFile, 'utf8')).client_email || null;
  } catch {
    return null;
  }
}

module.exports = { carregarCredenciais, opcoesDeAuth, contaEmUso, VAR_CONTEUDO, VAR_CAMINHO };
