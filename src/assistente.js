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
const SYSTEM_PROMPT_MOLDE = `Você é a assistente de atendimento do consultório do Dr. Jesrryel Lima, em Mossoró (RN). Atende pelo WhatsApp quem chegou por anúncio ou indicação e quer cuidar da saúde mental.

# Seu trabalho

Conversar com acolhimento e descobrir três coisas, na ordem, sem parecer formulário:
1. O que trouxe a pessoa até aqui (o motivo, nas palavras dela)
2. Se já buscou acompanhamento em saúde mental antes ou se é a primeira vez
3. Se prefere presencial em Mossoró ou online

Quando tiver as três, apresente os dois programas e pergunte qual faz mais sentido pra ela.

# O que você SABE do consultório

Isto é tudo que você pode afirmar. O que não está aqui, você não sabe — e diz que vai confirmar com a equipe.

**Consulta avulsa:** {{VALOR}}, duração de {{DURACAO}}.
**Pagamento:** {{PAGAMENTO}}.
**Horários de atendimento:** {{AGENDA}}.
**Presencial:** {{PRESENCIAL}}
**Online:** {{ONLINE}}
**Lembrete:** {{LEMBRETE}}

# Os dois programas de acompanhamento

São o serviço principal do consultório. Sempre apresente os dois, mesmo para quem só perguntou da consulta avulsa — é o cuidado mais completo que existe aqui.

**Recomeço** — {{RECOMECO}}

**Constância** — {{CONSTANCIA}}

{{EQUIPE}}

Você pode explicar como funcionam, para quem servem e o que incluem. **O que você nunca faz é falar o preço deles** — quem explica o valor do acompanhamento é o Dr. Jesrryel.

# Regras que você NUNCA quebra

- **O valor da consulta avulsa, só quando perguntarem.** Nunca ofereça preço por conta própria, nunca abra uma mensagem com ele. Perguntou, você responde direto e sem rodeio.
- **Nunca diga o preço dos programas**, nem aproximado, nem faixa, nem "a partir de". Quem pergunta isso é passado para o Dr. Jesrryel.
- **Nunca prometa vaga nem horário específico.** Você conhece as FAIXAS em que o consultório atende, não a agenda. Diga "ele atende terça de manhã", nunca "terça às 15h está livre". Quem acerta o horário final é o Dr. Jesrryel.
- **Nunca diga que VOCÊ vai lembrar a pessoa.** O lembrete é do consultório, não seu.
- **Nunca use a palavra "plano".** É sempre "programa de acompanhamento".
- **Nunca use "consulta psiquiátrica".** É sempre "acompanhamento em saúde mental".
- **Nunca dê diagnóstico, nem sugira um.** Você não é médica e não está avaliando ninguém.
- **Nunca indique, ajuste ou comente medicação.**
- **Nunca prometa resultado, cura ou prazo de melhora.**
- Não invente nada sobre o consultório: convênio, outros profissionais, outras unidades. Se não está aqui em cima, você não sabe.

# Como você escreve

Português do Brasil, como uma pessoa acolhedora digitando no WhatsApp. Curto: no máximo 4 linhas, quase sempre menos. Uma pergunta por vez. Sem emoji em excesso (no máximo um, e só quando couber). Sem linguagem de vendedor, sem "não perca", sem urgência artificial. Nunca use bullet point nem markdown — é WhatsApp.

# O que devolver

Sempre um JSON com:

- **intencao**: a leitura da ÚLTIMA mensagem do lead
  - \`risco\` — qualquer sinal de risco à própria vida, automutilação, desespero grave ou crise aguda. Na dúvida entre risco e conversando, escolha risco.
  - \`compra\` — use SÓ quando a pessoa demonstrar interesse real em FECHAR um programa de acompanhamento (quer contratar, pediu o preço do Recomeço ou do Constância, disse que quer começar o acompanhamento), ou quando ela quiser efetivamente marcar uma consulta. Perguntar o valor da avulsa, o endereço, o horário ou a forma de pagamento NÃO é \`compra\` — isso você responde.
  - \`nao_sei\` — a pessoa perguntou algo concreto sobre o consultório que não está na seção "O que você SABE" (convênio, outro profissional, estacionamento, um detalhe do programa que você não tem). Não invente: devolva \`nao_sei\` e o humano assume.
  - \`fora_de_escopo\` — quer laudo, atestado, receita, diagnóstico fechado, ou algo que não é acompanhamento
  - \`conversando\` — todo o resto
- **resposta**: o que mandar pra pessoa. Quando a intenção não for \`conversando\`, o sistema usa um texto próprio e ignora este campo — mas preencha mesmo assim.
- **motivo**, **historico**, **formato**: o que você conseguiu extrair até agora, nas palavras da pessoa. String vazia se ela ainda não contou. Não invente nem deduza: só preencha o que ela realmente disse.
- **classificacao**: \`Recomeço\` se é a primeira vez ou está em momento de crise/instabilidade; \`Constância\` se já faz ou já fez acompanhamento e está estável. String vazia enquanto não der pra saber.
- **qualificacaoCompleta**: true só quando motivo, historico e formato estiverem todos preenchidos.`;

// Os fatos entram por substituição, não por concatenação em tempo de chamada.
//
// O cache de prompt da API é casamento de PREFIXO: qualquer byte diferente
// invalida tudo dali pra frente. Montar o prompt uma vez por processo mantém a
// string idêntica entre mensagens e o cache vivo. Mudar a agenda no painel
// reconstrói na próxima partida do servidor — o custo é um cache frio uma vez,
// não a cada mensagem.
function montarSystemPrompt(agenda) {
  const { CONSULTA_AVULSA, PAGAMENTO, PRESENCIAL, ONLINE, LEMBRETE, PROGRAMAS } = require('./consultorio');
  const { descreverAgenda } = require('./agenda');
  return SYSTEM_PROMPT_MOLDE.replace(/\{\{(\w+)\}\}/g, (todo, chave) => {
    const valores = {
      VALOR: CONSULTA_AVULSA.valorEscrito,
      DURACAO: CONSULTA_AVULSA.duracaoEscrita,
      PAGAMENTO: PAGAMENTO.escrito,
      AGENDA: descreverAgenda(agenda),
      PRESENCIAL: PRESENCIAL.escrito,
      ONLINE: ONLINE.escrito,
      LEMBRETE: LEMBRETE.escrito,
      RECOMECO: PROGRAMAS.recomeco.replace(/^Recomeço — /, ''),
      CONSTANCIA: PROGRAMAS.constancia.replace(/^Constância — /, ''),
      EQUIPE: PROGRAMAS.equipe,
    };
    if (!(chave in valores)) throw new Error(`marcador sem valor no prompt: ${todo}`);
    return valores[chave];
  });
}

let systemPromptMontado = null;
function systemPrompt() {
  if (!systemPromptMontado) systemPromptMontado = montarSystemPrompt();
  return systemPromptMontado;
}

const SCHEMA = {
  type: 'object',
  properties: {
    intencao: {
      type: 'string',
      enum: ['conversando', 'compra', 'risco', 'fora_de_escopo', 'nao_sei'],
    },
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

// Rede determinística DEPOIS da IA. O system prompt já diz tudo isto, mas
// "o prompt manda" não é garantia: se escapar, é melhor cair no texto fixo de
// messages.js do que mandar pro lead.
//
// Até 04/10/2026 esta rede barrava QUALQUER menção a preço — o que estava
// certo enquanto a assistente não podia falar de valor nenhum. Agora ela pode
// dizer o valor da consulta avulsa, e manter a regra antiga anularia o recurso
// inteiro EM SILÊNCIO: a resposta certa seria barrada e o lead receberia o
// fluxo fixo, como se nada tivesse mudado.
//
// A rede continua existindo, mirando no que de fato não pode sair.

const { CONSULTA_AVULSA } = require('./consultorio');

const PROIBIDO_SEMPRE = [
  /\bplanos?\b/i,
  /consulta psiqui/i,
  // Número de parcelas e "sem juros" o consultório nunca informou (ver
  // consultorio.js: "dá pra parcelar no cartão", e só). Inventar "3x sem
  // juros" vira discussão no balcão no dia do pagamento.
  /\b\d+\s*x\b/i,
  /sem juros/i,
];

// Assuntos cujo preço é do médico, nunca da assistente.
const ASSUNTO_DO_PLANO = /(recome[çc]o|const[âa]ncia|programa|acompanhamento)/i;
const FALA_DE_DINHEIRO = /(r\$|reais|custa|pre[cç]o|valor|investimento|mensalidade)/i;

// Mais largo que o de cima de propósito. O de cima procura preço de PROGRAMA
// escapando numa frase; este procura qualquer menção a dinheiro na resposta,
// para decidir se ela podia falar disso agora. A frase que motivou o teste —
// "dá pra parcelar no cartão, viu?" — não tem nenhuma palavra do primeiro.
const MENCIONA_DINHEIRO =
  /(r\$|reais|custa|pre[cç]o|valor|investimento|mensalidade|parcel|pix|cart[ãa]o|pagamento|pagar|dinheiro|desconto)/i;

// Todo valor em reais que aparece no texto, como número.
function valoresCitados(texto) {
  const achados = [];
  const re = /(?:r\$\s*)(\d{1,3}(?:\.\d{3})*|\d+)(?:,\d{2})?|(\d{1,3}(?:\.\d{3})*|\d+)\s*reais/gi;
  let m;
  while ((m = re.exec(texto)) !== null) {
    const bruto = m[1] || m[2];
    achados.push(Number(String(bruto).replace(/\./g, '')));
  }
  return achados;
}

/**
 * @param {string} texto a resposta que a assistente quer mandar
 * @param {{perguntaDoLead?: string}} [contexto] a última fala do paciente
 * @returns {boolean} se a resposta não pode ser enviada como está
 */
function violaCompliance(texto, contexto = {}) {
  const t = String(texto || '');
  if (PROIBIDO_SEMPRE.some((re) => re.test(t))) return true;

  // Preço só quando perguntam — e agora isso é código, não só instrução no
  // prompt.
  //
  // Em 07/10/2026 a assistente respondeu "A consulta é de 1 hora e dá pra
  // parcelar no cartão, viu?" a alguém que acabara de contar que chorou ao
  // abrir uma caixa de fotos da família. Ninguém tinha perguntado nada sobre
  // dinheiro. O prompt já proibia; o modelo fez assim mesmo.
  //
  // Falar de preço sem ser perguntado, nesse momento, é pior do que não
  // responder: transforma um desabafo em balcão de vendas.
  if ('perguntaDoLead' in contexto) {
    const { perguntouDeDinheiro } = require('./triggers');
    if (MENCIONA_DINHEIRO.test(t) && !perguntouDeDinheiro(contexto.perguntaDoLead || '')) {
      return true;
    }
  }

  // Qualquer valor que não seja o da consulta avulsa é invenção do modelo ou
  // preço de programa. Os dois são motivo de barrar.
  const valores = valoresCitados(t);
  if (valores.some((v) => v !== CONSULTA_AVULSA.valor)) return true;

  // Falar de dinheiro e de acompanhamento na mesma frase é a forma mais
  // provável de o preço do programa escapar sem um número ("o Recomeço sai
  // por bem menos do que parece").
  // O ponto de "Dr." não é fim de frase. Sem tirar, "quem te explica é o
  // Dr. Jesrryel" vira duas frases e a exceção abaixo nunca encontra o nome —
  // barrando justamente a resposta correta.
  const semAbreviacao = t.replace(/\b(dr|dra|sr|sra)\.\s*/gi, '$1 ');
  for (const frase of semAbreviacao.split(/[.!?\n]/)) {
    if (ASSUNTO_DO_PLANO.test(frase) && FALA_DE_DINHEIRO.test(frase)) {
      // A exceção é mandar falar com o médico, que é exatamente o que ela deve
      // fazer: "sobre o valor do acompanhamento, quem te explica é ele".
      if (/(dr\.?\s*jesrryel|com ele|ele te (explica|responde|conta))/i.test(frase)) continue;
      return true;
    }
  }

  return false;
}

// Histórico da conversa no formato que a API espera. Cortado nos últimos
// MAX_TURNOS pra conta não crescer sem fim numa conversa longa.
function montarMensagens(historicoConversa, textoNovo) {
  const anteriores = (historicoConversa || [])
    .slice(-MAX_TURNOS)
    .filter((t) => t && t.role && t.content)
    .map((t) => ({ role: t.role, content: t.content }));

  // Quem chama (flow.js, conversar.js) já registra o turno do usuário no
  // histórico ANTES de consultar a IA — de propósito, pra esse registro não
  // depender da API responder. Sem essa checagem, a última fala do lead ia
  // parar duplicada no fim da lista mandada pro modelo.
  const ultimo = anteriores[anteriores.length - 1];
  if (ultimo && ultimo.role === 'user' && ultimo.content === textoNovo) {
    return anteriores;
  }

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
      system: [{ type: 'text', text: systemPrompt(), cache_control: { type: 'ephemeral' } }],
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

    if (dados.intencao === 'conversando' && violaCompliance(dados.resposta, { perguntaDoLead: texto })) {
      // Sem o texto da resposta: ela parafraseia o que o paciente contou, e o
      // log da Railway é de terceiro. O motivo e o tamanho bastam pra depurar.
      console.warn(
        `[assistente] resposta barrada por compliance (${dados.resposta.length} caracteres) — ` +
          'caindo no fluxo determinístico. Causas: preço sem terem perguntado, preço de ' +
          'programa, valor inventado, parcelas inventadas, "plano", "consulta psiquiátrica".'
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

module.exports = {
  responder,
  ativa,
  avisarSeDesligada,
  violaCompliance,
  montarMensagens,
  montarSystemPrompt,
  systemPrompt,
  SYSTEM_PROMPT_MOLDE,
  MAX_TURNOS,
};
