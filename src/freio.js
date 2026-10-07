const fs = require('fs');
const path = require('path');

// Freio de emergência: teto de mensagens que o bot pode mandar para a MESMA
// pessoa numa janela curta.
//
// Em 07/10/2026 um paciente recebeu 21 mensagens do bot em 5 segundos, no meio
// de uma conversa sobre uma caixa de fotos de família que o tinha feito chorar.
// Várias eram respostas diferentes à mesma fala dele, e uma delas era a
// mensagem de boas-vindas, fora de ordem.
//
// Seja qual for a causa (reenvio da Meta, réplica a mais, deploy no meio da
// conversa), nada disso justifica o resultado do lado de quem recebeu. Este
// arquivo não conserta a causa: ele garante que o pior caso seja constrangedor
// em vez de assustador.
//
// Um freio que atua é SEMPRE um bug em algum lugar — por isso ele grita no log
// em vez de engolir calado.

const JANELA_MS = 60 * 1000;
const TETO = 3;

const DATA_DIR = () => process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const ARQUIVO = () => path.join(DATA_DIR(), 'freio.json');

function ler() {
  try {
    return JSON.parse(fs.readFileSync(ARQUIVO(), 'utf8') || '{}');
  } catch (err) {
    return {};
  }
}

function gravar(dados) {
  try {
    fs.mkdirSync(DATA_DIR(), { recursive: true });
    fs.writeFileSync(ARQUIVO(), JSON.stringify(dados));
  } catch (err) {
    // Disco cheio não pode derrubar o atendimento. Sem o arquivo o freio deixa
    // passar, que é o comportamento de antes — ruim, mas não pior.
    console.warn(`[freio] não deu pra gravar o contador: ${err.message}`);
  }
}

/**
 * Registra uma tentativa de envio e diz se ela pode sair.
 *
 * Síncrono de propósito: ler, decidir e gravar precisam ser uma coisa só. Um
 * await no meio abriria exatamente a janela de concorrência que o freio existe
 * para fechar.
 *
 * @returns {{liberado: boolean, enviadas: number}}
 */
function registrarEnvio(phone, agora = Date.now()) {
  const dados = ler();
  const corte = agora - JANELA_MS;

  // Limpa todo mundo na mesma passada: sem isso o arquivo guardaria uma
  // entrada por telefone para sempre.
  const limpo = {};
  for (const [numero, marcas] of Object.entries(dados)) {
    const vivos = (Array.isArray(marcas) ? marcas : []).filter((t) => t > corte);
    if (vivos.length) limpo[numero] = vivos;
  }

  const minhas = limpo[phone] || [];
  if (minhas.length >= TETO) {
    gravar(limpo);
    return { liberado: false, enviadas: minhas.length };
  }

  limpo[phone] = [...minhas, agora];
  gravar(limpo);
  return { liberado: true, enviadas: limpo[phone].length };
}

module.exports = { registrarEnvio, JANELA_MS, TETO };
