const Anthropic = require('@anthropic-ai/sdk');

// A assistente NÃO é a rede de segurança para risco de crise. O flow.js roda a
// checagem determinística de triggers.js ANTES de chegar aqui, e essa checagem
// nunca depende de rede, de saldo na API ou de o modelo ter interpretado a
// frase do jeito certo. O que a IA faz aqui é o resto: entender uma resposta
// escrita de qualquer jeito, responder dúvida fora do roteiro, e extrair o que
// o lead contou sem depender de "a mensagem número 2 é sempre o motivo".
//
// A instrução de sinalizar risco também está no system prompt, mas como
// SEGUNDA camada — se a IA perceber um risco que as palavras-chave não pegaram,
// melhor; se não perceber, as palavras-chave já rodaram.

const MODELO = process.env.CLAUDE_MODEL || 'claude-opus-5';
const API_KEY = process.env.ANTHROPIC_API_KEY;
const DESLIGADA = String(process.env.ASSISTENTE_IA || '').toLowerCase() === 'off';
const MAX_TURNOS = 12; // quantas falas do histórico vão junto no contexto

let cliente = null;

function ativa() {
  return Boolean(API_KEY) && !DESLIGADA;
}

function getCliente() {
  if (!cliente) cliente = new Anthropic({ apiKey: API_KEY });
  return cliente;
}

// Fica FIXO entre as mensagens de propósito: o cache de prompt da API é
// casamento de prefixo, então qualquer byte que mude aqui (uma data, o nome do
// lead) jogaria fora o cache e o custo voltaria ao cheio a cada mensagem. O que
// varia por lead vai nas messages, depois do trecho cacheado.
const SYSTEM_PROMPT = `Você é a assistente de atendimento do consultório do Dr. Jesrryel Lima, em Mossoró (RN). Atende pelo WhatsApp quem chegou por anúncio ou indicação e quer cuidar da saúde mental.

# Seu trabalho

Conversar com acolhimento e descobrir três coisas, na ordem, sem parecer formulário:
1. O que trouxe a pessoa até aqui (o motivo, nas palavras dela)
2. Se já buscou acompanhamento em saúde mental antes ou se é a primeira vez
3. Se prefere presencial em Mossoró ou online

Quando tiver as três, apresente os dois programas e pergunte qual faz mais sentido pra ela.

# Os dois programas

**Recomeço** — pra quem está começando agora e precisa de um cuidado mais próximo logo de cara, com psiquiatria e psicologia caminhando juntas até a pessoa se sentir mais estável.

**Constância** — pra quem já encontrou seu equilíbrio e quer manter esse cuidado vivo, com uma frequência mais espaçada, sem perder o acompanhamento.

Os dois contam com equipe para olhar a pessoa por inteiro — psiquiatria, psicologia, nutrição e educação física, quando fizer sentido — presencial ou online.

# Regras que você NUNCA quebra

- **Nunca fale de preço, valor, parcelamento ou forma de pagamento.** Se perguntarem, sinalize intenção de compra e deixe o humano responder.
- **Nunca use a palavra "plano".** É sempre "programa de acompanhamento".
- **Nunca use "consulta psiquiátrica".** É sempre "acompanhamento em saúde mental".
- **Nunca dê diagnóstico, nem sugira um.** Você não é médica e não está avaliando ninguém.
- **Nunca indique, ajuste ou comente medicação.**
- **Nunca prometa resultado, cura ou prazo de melhora.**
- **Nunca marque, confirme ou sugira horário de atendimento.** Isso é do humano.
- Não invente nada sobre o consultório: endereço, horário, equipe, convênio. Se não está aqui em cima, você não sabe — e diz que vai confirmar com a equipe.

# Como você escreve

Português do Brasil, como uma pessoa acolhedora digitando no WhatsApp. Curto: no máximo 4 linhas, quase sempre menos. Uma pergunta por vez. Sem emoji em excesso (no máximo um, e só quando couber). Sem linguagem de vendedor, sem "não perca", sem urgência artificial. Nunca use bullet point nem markdown — é WhatsApp.

# O que devolver

Sempre um JSON com:

- **intencao**: a leitura da ÚLTIMA mensagem do lead
  - \`risco\` — qualquer sinal de risco à própria vida, automutilação, desespero grave ou crise aguda. Na dúvida entre risco e conversando, escolha risco.
  - \`compra\` — perguntou preço, quis agendar, disse que quer começar, ou qualquer coisa de quem já decidiu
  - \`fora_de_escopo\` — quer laudo, atestado, receita, diagnóstico fechado, ou algo que não é acompanhamento
  - \`conversando\` — todo o resto
- **resposta**: o que mandar pra pessoa. Quando a intenção não for \`conversando\`, o sistema usa um texto próprio e ignora este campo — mas preencha mesmo assim.
- **motivo**, **historico**, **formato**: o que você conseguiu extrair até agora, nas palavras da pessoa. String vazia se ela ainda não contou. Não invente nem deduza: só preencha o que ela realmente disse.
- **classificacao**: \`Recomeço\` se é a primeira vez ou está em momento de crise/instabilidade; \`Constância\` se já faz ou já fez acompanhamento e está estável. String vazia enquanto não der pra saber.
- **qualificacaoCompleta**: true só quando motivo, historico e formato estiverem todos preenchidos.`;

const SCHEMA = {
  type: 'object',
  properties: {
    intencao: { type: 'string', enum: ['conversando', 'compra', 'risco', 'fora_de_escopo'] },
    resposta: { type: 'string' },
    motivo: { type: 'string' },
    historico: { type: 'string' },
    formato: { type: 'string' },
    classificacao: { type: 'string', enum: ['Recomeço', 'Constância', ''] },
    qualificacaoCompleta: { type: 'boolean' },
  },
  required: ['intencao', 'resposta', 'motivo', 'historico', 'formato', 'classificacao', 'qualificacaoCompleta'],
  additionalProperties: false,
};

// Rede determinística DEPOIS da IA. O system prompt já proíbe tudo isso, mas
// "o prompt manda" não é garantia: se escapar preço ou "plano" numa resposta,
// é melhor cair no texto fixo de messages.js do que mandar pro lead.
const PROIBIDO = [
  /\bR\$/i,
  /\bplanos?\b/i,
  /consulta psiqui/i,
  /\bpre[cç]o\b/i,
  /\bvalor(es)?\b/i,
  /\bparcel/i,
];

function violaCompliance(texto) {
  return PROIBIDO.some((regex) => regex.test(texto || ''));
}

// Histórico da conversa no formato que a API espera. Cortado nos últimos
// MAX_TURNOS pra conta não crescer sem fim numa conversa longa.
function montarMensagens(historicoConversa, textoNovo) {
  const anteriores = (historicoConversa || [])
    .slice(-MAX_TURNOS)
    .filter((t) => t && t.role && t.content)
    .map((t) => ({ role: t.role, content: t.content }));

  return [...anteriores, { role: 'user', content: textoNovo }];
}

// Devolve o objeto estruturado, ou null se a IA não puder ser usada por
// qualquer motivo — chave ausente, rede fora, resposta inválida, compliance
// violado. null é o sinal pro flow.js seguir pelo fluxo determinístico: a
// automação nunca pode ficar muda porque a API falhou.
async function responder({ lead, texto }) {
  if (!ativa()) return null;

  try {
    const resposta = await getCliente().messages.create({
      model: MODELO,
      max_tokens: 16000,
      system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      thinking: { type: 'adaptive' },
      output_config: {
        effort: 'medium',
        format: { type: 'json_schema', schema: SCHEMA },
      },
      messages: montarMensagens(lead.historicoConversa, texto),
    });

    if (resposta.stop_reason === 'refusal') {
      console.warn('[assistente] modelo recusou a requisição — caindo no fluxo determinístico');
      return null;
    }

    const bloco = resposta.content.find((b) => b.type === 'text');
    if (!bloco) {
      console.warn('[assistente] resposta sem bloco de texto — caindo no fluxo determinístico');
      return null;
    }

    const dados = JSON.parse(bloco.text);

    if (!dados.resposta || !dados.resposta.trim()) {
      console.warn('[assistente] resposta vazia — caindo no fluxo determinístico');
      return null;
    }

    if (dados.intencao === 'conversando' && violaCompliance(dados.resposta)) {
      console.warn(
        `[assistente] resposta barrada por compliance (preço/"plano"/"consulta psiquiátrica") — caindo no fluxo determinístico. Texto: "${dados.resposta}"`
      );
      return null;
    }

    return dados;
  } catch (err) {
    console.error(`[assistente] falha ao consultar a API (${err.message}) — caindo no fluxo determinístico`);
    return null;
  }
}

function avisarSeDesligada() {
  if (DESLIGADA) {
    console.log('[assistente] desligada por ASSISTENTE_IA=off — rodando só o fluxo determinístico.');
  } else if (!API_KEY) {
    console.warn(
      '[assistente] ⚠️  ANTHROPIC_API_KEY não definida — a assistente com IA está desligada e o bot ' +
        'responde só pelo roteiro fixo. Pegue a chave em console.anthropic.com.'
    );
  } else {
    console.log(`[assistente] ligada (modelo: ${MODELO})`);
  }
}

module.exports = { responder, ativa, avisarSeDesligada, violaCompliance, montarMensagens, SYSTEM_PROMPT, MAX_TURNOS };
