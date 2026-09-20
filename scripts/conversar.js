// Conversa com a assistente pelo Terminal, como se você fosse um lead.
//
//   node scripts/conversar.js
//
// Serve pra ler o tom dela e revisar o que ela pode dizer ANTES de qualquer
// paciente ver. Não manda nada pro WhatsApp e não escreve na planilha: é só
// a conversa.
//
// A ordem de decisão é a mesma do flow.js de propósito — crise, compra e fora
// de escopo por palavra-chave ANTES da IA. Se aqui fosse diferente, o teste
// não valeria nada.

require('dotenv').config();
const readline = require('readline');
const assistente = require('./../src/assistente');
const messages = require('./../src/messages');
const { isCrisisSignal, isBuyingSignal, isOutOfScope } = require('./../src/triggers');

const cinza = (t) => `\x1b[90m${t}\x1b[0m`;
const azul = (t) => `\x1b[36m${t}\x1b[0m`;
const vermelho = (t) => `\x1b[31m${t}\x1b[0m`;
const verde = (t) => `\x1b[32m${t}\x1b[0m`;

const lead = {
  phone: '5584900000000',
  nome: '',
  motivo: '',
  historico: '',
  formato: '',
  classificacao: '',
  historicoConversa: [],
  state: null,
};

function mostrarResposta(texto, rotulo, cor = azul) {
  console.log(`\n${cor('Assistente')} ${cinza(`[${rotulo}]`)}`);
  console.log(texto.split('\n').map((l) => '  ' + l).join('\n'));
  console.log('');
}

function mostrarFicha() {
  const campos = [
    ['motivo', lead.motivo],
    ['histórico', lead.historico],
    ['formato', lead.formato],
    ['classificação', lead.classificacao],
  ].filter(([, v]) => v);

  if (!campos.length) return;
  console.log(cinza(`  ficha até agora: ${campos.map(([k, v]) => `${k}="${v}"`).join('  ')}`));
  console.log('');
}

// Mesmo desfecho do encaminharParaHumano() no flow.js: mostra o texto fixo,
// registra ele no histórico (senão a próxima chamada à IA vê dois turnos de
// usuário seguidos, sem resposta no meio, e se confunde) e marca o lead como
// entregue ao humano.
function handoff(texto, rotulo, cor, novoState) {
  mostrarResposta(texto, rotulo, cor);
  lead.historicoConversa.push({ role: 'assistant', content: texto });
  lead.state = novoState;
}

async function responder(texto) {
  // Registrado ANTES de qualquer checagem — igual ao registrarTurno('user', ...)
  // no topo do handleIncomingMessage do flow.js.
  lead.historicoConversa.push({ role: 'user', content: texto });

  // Mesma ordem do flow.js — determinístico primeiro, sempre.
  if (isCrisisSignal(texto)) {
    handoff(messages.acolhimentoRisco(), 'RISCO — palavra-chave, sem consultar a IA', vermelho, 'HANDOFF');
    console.log(vermelho('  >> HANDOFF URGENTE: alerta dispararia agora.\n'));
    return;
  }
  if (isBuyingSignal(texto)) {
    handoff(messages.handoffCompra(), 'COMPRA — palavra-chave, sem consultar a IA', verde, 'HANDOFF');
    return;
  }
  if (isOutOfScope(texto)) {
    handoff(messages.desqualificacaoGentil(), 'FORA DE ESCOPO — palavra-chave', cinza, 'DESQUALIFICADO');
    return;
  }

  // Lead já entregue ao humano: a automação fica em silêncio, igual ao
  // flow.js (linha do ['HANDOFF', 'DESQUALIFICADO', 'CLIENTE'].includes(state)).
  if (['HANDOFF', 'DESQUALIFICADO', 'CLIENTE'].includes(lead.state)) {
    console.log(cinza('  >> (silêncio) automação não responde — lead já em atendimento humano.\n'));
    return;
  }

  process.stdout.write(cinza('  pensando...'));
  const ia = await assistente.responder({ lead, texto });
  process.stdout.write('\r' + ' '.repeat(20) + '\r');

  if (!ia) {
    mostrarResposta(
      messages.boasVindas(),
      'IA indisponível — caiu no roteiro fixo (veja o aviso acima)',
      cinza
    );
    return;
  }

  if (ia.intencao === 'risco') {
    handoff(messages.acolhimentoRisco(), 'RISCO — sinalizado pela IA', vermelho, 'HANDOFF');
    console.log(vermelho('  >> HANDOFF URGENTE: alerta dispararia agora.\n'));
    return;
  }
  if (ia.intencao === 'compra') {
    handoff(messages.handoffCompra(), 'COMPRA — sinalizado pela IA', verde, 'HANDOFF');
    return;
  }
  if (ia.intencao === 'fora_de_escopo') {
    handoff(messages.desqualificacaoGentil(), 'FORA DE ESCOPO — sinalizado pela IA', cinza, 'DESQUALIFICADO');
    return;
  }

  mostrarResposta(ia.resposta, 'conversa normal');
  lead.historicoConversa.push({ role: 'assistant', content: ia.resposta });

  for (const campo of ['motivo', 'historico', 'formato', 'classificacao']) {
    if (ia[campo]) lead[campo] = ia[campo];
  }
  mostrarFicha();

  if (ia.qualificacaoCompleta) {
    console.log(verde('  >> Qualificação completa. Os follow-ups D+2/3/5/7 seriam agendados agora.\n'));
  }
}

console.log('\n' + '='.repeat(64));
console.log('  CONVERSA DE TESTE COM A ASSISTENTE');
console.log('='.repeat(64));

if (!assistente.ativa()) {
  console.log(vermelho('\n  A assistente com IA está DESLIGADA.'));
  console.log('  Falta ANTHROPIC_API_KEY no .env (ou ASSISTENTE_IA está como "off").');
  console.log('  Sem ela, o bot responde só pelo roteiro fixo.\n');
} else {
  console.log(cinza(`\n  Modelo: ${process.env.CLAUDE_MODEL || 'claude-opus-5'}`));
  console.log(cinza('  Nada aqui vai pro WhatsApp nem pra planilha. É só conversa.\n'));
}

console.log('  Escreva como se fosse um paciente chegando no WhatsApp.');
console.log(cinza('  Para sair: escreva "sair" ou aperte Ctrl+C.\n'));

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function perguntar() {
  rl.question('Você: ', async (texto) => {
    const limpo = texto.trim();
    if (!limpo) return perguntar();
    if (['sair', 'exit', 'quit'].includes(limpo.toLowerCase())) {
      console.log(cinza('\n  Até mais.\n'));
      rl.close();
      return;
    }
    try {
      await responder(limpo);
    } catch (err) {
      console.log(vermelho(`\n  Erro: ${err.message}\n`));
    }
    perguntar();
  });
}

perguntar();
