const path = require('path');
const crypto = require('crypto');
const express = require('express');
const { readAll, getLead, saveLead } = require('./state');
const { planejarReativacao } = require('./reativar');
const { planejarResposta, janela } = require('./responder');
const { webhookProtegido } = require('./assinatura');
const { lerAgenda, salvarAgenda, validarAgenda, descreverAgenda, DIAS } = require('./agenda');
const { sendText } = require('./whatsapp');
const { explicarErroMeta } = require('./erros-meta');
const { ETAPA_QUALIFICACAO, ETAPA_FOLLOWUP, ROTULO_ESTADO, ehRisco } = require('./estados');

const TOKEN = process.env.DASHBOARD_TOKEN;
const PAGE = path.join(__dirname, '..', 'public', 'dashboard.html');

// O dashboard expõe telefone e o motivo que o lead contou — dado sensível de
// saúde. Como o README manda rodar tudo atrás de um ngrok público, servir isso
// sem senha vazaria os leads pra quem descobrisse a URL. Então: sem
// DASHBOARD_TOKEN definido, o dashboard simplesmente não sobe.
// Os dois lados são aparados antes de comparar.
//
// Um espaço ou quebra de linha sobrando no valor colado no painel da Railway
// derrubava o acesso com "token inválido" — e não existe como alguém
// descobrir isso olhando a tela: os dois valores PARECEM idênticos. Aparar não
// enfraquece nada (ninguém escolhe um segredo cuja força está num espaço no
// fim) e remove uma classe inteira de erro indepurável.
const aparar = (valor) => (typeof valor === 'string' ? valor.trim() : '');

function tokenValido(recebido) {
  const a = Buffer.from(aparar(recebido));
  const b = Buffer.from(aparar(TOKEN));
  if (!a.length || !b.length) return false;
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function exigirToken(req, res, next) {
  if (!TOKEN) {
    return res.status(503).json({
      erro: 'DASHBOARD_TOKEN não configurado',
      comoResolver:
        'Defina DASHBOARD_TOKEN no .env com uma senha longa e reinicie o servidor. ' +
        'Depois acesse /dashboard?token=SUA_SENHA',
    });
  }
  const recebido = req.get('x-dashboard-token') || req.query.token;
  if (!recebido) {
    return res.status(401).json({
      erro: 'token ausente',
      comoResolver: 'Abra /dashboard?token=SUA_SENHA, com a senha de DASHBOARD_TOKEN.',
    });
  }
  if (!tokenValido(recebido)) {
    // "inválido" sozinho não ajuda ninguém: os dois valores parecem iguais na
    // tela. As duas causas reais são sempre as mesmas, e dizê-las aqui evita
    // uma hora de caça.
    return res.status(401).json({
      erro: 'token não confere com DASHBOARD_TOKEN',
      comoResolver:
        'Duas causas quase sempre: (1) a senha tem caractere que o navegador corta ' +
        'ou transforma — #, &, +, %, espaço. Use só letras, números e hífen. ' +
        '(2) sobrou espaço no começo ou no fim do valor salvo na Railway. ' +
        'Na dúvida, defina uma senha nova só com letras, números e hífen.',
    });
  }
  return next();
}

function diaIso(valor) {
  if (!valor) return null;
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

// Série diária contínua (dias sem lead viram zero) — senão o gráfico de linha
// mente sobre o espaçamento entre os pontos.
function serieDiaria(leads, dias) {
  const contagem = new Map();
  for (const lead of leads) {
    const dia = diaIso(lead.createdAt || lead.updatedAt);
    if (dia) contagem.set(dia, (contagem.get(dia) || 0) + 1);
  }
  const hoje = new Date();
  hoje.setUTCHours(0, 0, 0, 0);
  const serie = [];
  for (let i = dias - 1; i >= 0; i--) {
    const d = new Date(hoje.getTime() - i * 24 * 60 * 60 * 1000);
    const chave = d.toISOString().slice(0, 10);
    serie.push({ data: chave, valor: contagem.get(chave) || 0 });
  }
  return serie;
}

function montarResumo(leads) {
  const total = leads.length;
  const porEstado = {};
  const porClassificacao = {};

  for (const lead of leads) {
    const estado = lead.state || 'NOVO';
    porEstado[estado] = (porEstado[estado] || 0) + 1;
    const classe = lead.classificacao || 'Não classificado';
    porClassificacao[classe] = (porClassificacao[classe] || 0) + 1;
  }

  const contar = (fn) => leads.filter(fn).length;

  const emQualificacao = contar((l) => ETAPA_QUALIFICACAO.includes(l.state));
  const emFollowup = contar((l) => ETAPA_FOLLOWUP.includes(l.state));
  const catalogoEnviado = contar((l) => Boolean(l.catalogoEnviadoEm));
  const handoff = contar((l) => l.state === 'HANDOFF');
  const clientes = contar((l) => l.state === 'CLIENTE');
  const desqualificados = contar((l) => l.state === 'DESQUALIFICADO');
  const risco = leads.filter(ehRisco);

  // Funil só das etapas de qualificação: handoff e desqualificação podem
  // acontecer em QUALQUER ponto (crise, intenção de compra), então misturá-los
  // aqui daria um funil não-monotônico e enganoso. Vão em "Desfechos".
  const funil = [
    { etapa: 'Leads recebidos', valor: total },
    { etapa: 'Contaram o motivo', valor: contar((l) => Boolean(l.motivo)) },
    { etapa: 'Contaram o histórico', valor: contar((l) => Boolean(l.historico)) },
    { etapa: 'Qualificação completa', valor: contar((l) => Boolean(l.formato)) },
    { etapa: 'Catálogo enviado', valor: catalogoEnviado },
  ];

  return {
    geradoEm: new Date().toISOString(),
    totais: {
      total,
      emQualificacao,
      catalogoEnviado,
      emFollowup,
      handoff,
      clientes,
      desqualificados,
      risco: risco.length,
    },
    // Handoff é o desfecho que a automação realmente persegue: é o momento em
    // que um humano assume. Por isso a taxa é sobre ele, não sobre "cliente"
    // (o estado CLIENTE hoje só é setado manualmente).
    taxaHandoff: total ? (handoff + clientes) / total : 0,
    funil,
    desfechos: [
      { rotulo: 'Em qualificação', valor: emQualificacao },
      { rotulo: 'Em follow-up', valor: emFollowup },
      { rotulo: 'Handoff pendente', valor: handoff },
      { rotulo: 'Cliente', valor: clientes },
      { rotulo: 'Desqualificado', valor: desqualificados },
    ],
    // Até aqui, saber se o webhook estava protegido exigia caçar uma linha no
    // log da Railway — que só aparece no boot e some na rolagem. Estado de
    // segurança que ninguém consegue ver é estado de segurança que ninguém
    // corrige.
    seguranca: { webhookProtegido: webhookProtegido() },
    porDia: serieDiaria(leads, 14),
    porClassificacao,
    porEstado,
    rotulosEstado: ROTULO_ESTADO,
    risco: risco.map((l) => ({
      phone: l.phone,
      nome: l.nome || '',
      notas: l.notas || '',
      updatedAt: l.updatedAt || null,
    })),
  };
}

function montarLinhas(leads) {
  return leads.map((lead) => ({
    phone: lead.phone,
    nome: lead.nome || '',
    motivo: lead.motivo || '',
    classificacao: lead.classificacao || '',
    formato: lead.formato || '',
    state: lead.state || 'NOVO',
    notas: lead.notas || '',
    risco: ehRisco(lead),
    followupsEnviados: lead.followupsEnviados || [],
    catalogoEnviadoEm: lead.catalogoEnviadoEm || null,
    createdAt: lead.createdAt || null,
    updatedAt: lead.updatedAt || null,
    // O painel precisa saber se ainda dá para responder em texto livre, senão
    // oferece um campo que só vai falhar depois de o médico escrever.
    janelaAberta: janela(lead).aberta,
    // Para o painel mostrar quem ainda está esperando por um humano.
    handoffEm: lead.handoffEm || null,
    atendidoEm: lead.atendidoEm || null,
  }));
}

function criarRouter() {
  const router = express.Router();

  router.get('/dashboard', exigirToken, (req, res) => {
    res.sendFile(PAGE);
  });

  router.get('/api/leads', exigirToken, (req, res) => {
    try {
      const leads = Object.values(readAll());
      leads.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
      res.json({ resumo: montarResumo(leads), leads: montarLinhas(leads) });
    } catch (err) {
      console.error('[dashboard] erro ao montar dados:', err.message);
      res.status(500).json({ erro: 'falha ao ler os leads' });
    }
  });

  // Devolve um lead parado (HANDOFF/DESQUALIFICADO/CLIENTE) para a automação.
  // É POST porque muda estado, e fica atrás do mesmo token do painel: quem pode
  // ver os leads pode reativá-los, ninguém mais.
  router.post('/api/leads/:phone/reativar', exigirToken, (req, res) => {
    try {
      const phone = String(req.params.phone || '');
      const plano = planejarReativacao(getLead(phone));
      if (!plano.ok) {
        return res.status(409).json({ erro: plano.motivo });
      }
      const lead = saveLead(phone, plano.campos);
      console.log(
        `[dashboard] lead ${phone} reativado (estava em ${plano.campos.estadoAntesDaReativacao})`
      );
      return res.json({ ok: true, lead: montarLinhas([lead])[0] });
    } catch (err) {
      console.error('[dashboard] erro ao reativar:', err.message);
      return res.status(500).json({ erro: 'falha ao reativar o lead' });
    }
  });

  // Responde ao paciente PELO NÚMERO DO CONSULTÓRIO.
  //
  // Antes disto a única saída era o WhatsApp do celular do médico — outro
  // número. A pessoa escrevia para o consultório e era procurada por um
  // desconhecido. Aqui a resposta sai pelo mesmo número que ela procurou.
  //
  // O estado do lead NÃO muda: quem está em HANDOFF continua em HANDOFF, e a
  // automação continua calada. Responder não é devolver a conversa para o bot
  // — para isso existe o botão Reativar.
  router.post('/api/leads/:phone/responder', exigirToken, async (req, res) => {
    const phone = String(req.params.phone || '');
    const plano = planejarResposta(getLead(phone), req.body && req.body.texto);
    if (!plano.ok) {
      return res.status(409).json({ erro: plano.motivo });
    }

    try {
      await sendText(phone, plano.texto);
    } catch (err) {
      const explicado = explicarErroMeta(err);
      console.error(`[dashboard] falha ao responder ${phone}: ${explicado}`);
      return res.status(502).json({ erro: explicado });
    }

    // Só grava depois que a Meta aceitou: histórico com mensagem que não saiu
    // faz o médico achar que respondeu.
    //
    // Entra como 'assistant' porque é o mesmo lado da conversa aos olhos da
    // IA, com autor 'medico' para não se confundir com fala do bot. O texto
    // em si não vai para o log — é conversa clínica.
    const lead = getLead(phone) || {};
    const historicoConversa = [
      ...(lead.historicoConversa || []),
      { role: 'assistant', content: plano.texto, autor: 'medico' },
    ];
    const salvo = saveLead(phone, {
      historicoConversa: historicoConversa.slice(-40),
      // Responder é atender: para os re-alertas de handoff parado.
      atendidoEm: new Date().toISOString(),
    });
    console.log(`[dashboard] resposta do médico enviada para ${phone} (${plano.texto.length} caracteres)`);
    return res.json({ ok: true, lead: montarLinhas([salvo])[0] });
  });

  // As faixas de atendimento que a assistente informa ao paciente.
  //
  // Fica no painel, não no .env, porque é a única configuração que o médico
  // muda de verdade — férias, um sábado a menos — e exigir deploy para isso
  // garantiria que o bot anunciasse horário errado por semanas.
  router.get('/api/agenda', exigirToken, (req, res) => {
    const agenda = lerAgenda();
    res.json({ agenda, dias: DIAS, descricao: descreverAgenda(agenda) });
  });

  router.post('/api/agenda', exigirToken, (req, res) => {
    const validada = validarAgenda(req.body && req.body.agenda);
    if (!validada.ok) {
      return res.status(400).json({ erro: validada.erro });
    }
    salvarAgenda(validada.agenda);
    // O prompt da assistente é montado uma vez por processo (cache de prompt
    // da API). A agenda nova só entra na próxima partida — dizer isso aqui
    // evita o médico salvar, testar, e achar que não funcionou.
    console.log('[agenda] faixas atualizadas pelo painel — valem no próximo deploy');
    return res.json({
      ok: true,
      agenda: validada.agenda,
      descricao: descreverAgenda(validada.agenda),
      aviso: 'Salvo. A assistente passa a usar estas faixas no próximo deploy do serviço.',
    });
  });

  // Marca o handoff como atendido sem mandar mensagem.
  //
  // Existe porque o médico também responde pelo WhatsApp do celular dele, e o
  // sistema não tem como ver isso. Sem este botão, os re-alertas continuariam
  // chegando sobre uma conversa que ele já atendeu — e alerta que mente é
  // alerta que a gente aprende a ignorar, o que estraga justamente o de crise.
  router.post('/api/leads/:phone/atendido', exigirToken, (req, res) => {
    try {
      const phone = String(req.params.phone || '');
      const lead = getLead(phone);
      if (!lead) {
        return res.status(404).json({ erro: 'lead não encontrado' });
      }
      const salvo = saveLead(phone, { atendidoEm: new Date().toISOString() });
      console.log(`[dashboard] handoff de ${phone} marcado como atendido`);
      return res.json({ ok: true, lead: montarLinhas([salvo])[0] });
    } catch (err) {
      console.error('[dashboard] erro ao marcar como atendido:', err.message);
      return res.status(500).json({ erro: 'falha ao marcar como atendido' });
    }
  });

  return router;
}

function avisarSeDesprotegido() {
  if (!TOKEN) {
    console.warn(
      '[dashboard] ⚠️  DASHBOARD_TOKEN não definido no .env — /dashboard está desativado. ' +
        'Defina uma senha longa e reinicie para liberar o painel.'
    );
  }
}

module.exports = { criarRouter, avisarSeDesprotegido, montarResumo, montarLinhas };
