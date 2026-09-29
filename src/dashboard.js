const path = require('path');
const crypto = require('crypto');
const express = require('express');
const { readAll, getLead, saveLead } = require('./state');
const { planejarReativacao } = require('./reativar');
const { planejarResposta, janela } = require('./responder');
const { sendText } = require('./whatsapp');
const { explicarErroMeta } = require('./erros-meta');
const { ETAPA_QUALIFICACAO, ETAPA_FOLLOWUP, ROTULO_ESTADO, ehRisco } = require('./estados');

const TOKEN = process.env.DASHBOARD_TOKEN;
const PAGE = path.join(__dirname, '..', 'public', 'dashboard.html');

// O dashboard expõe telefone e o motivo que o lead contou — dado sensível de
// saúde. Como o README manda rodar tudo atrás de um ngrok público, servir isso
// sem senha vazaria os leads pra quem descobrisse a URL. Então: sem
// DASHBOARD_TOKEN definido, o dashboard simplesmente não sobe.
function tokenValido(recebido) {
  if (!recebido || typeof recebido !== 'string') return false;
  const a = Buffer.from(recebido);
  const b = Buffer.from(TOKEN);
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
  if (!tokenValido(recebido)) {
    return res.status(401).json({ erro: 'token inválido ou ausente' });
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
    const salvo = saveLead(phone, { historicoConversa: historicoConversa.slice(-40) });
    console.log(`[dashboard] resposta do médico enviada para ${phone} (${plano.texto.length} caracteres)`);
    return res.json({ ok: true, lead: montarLinhas([salvo])[0] });
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
