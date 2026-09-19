const path = require('path');
const crypto = require('crypto');
const express = require('express');
const { readAll } = require('./state');

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

// --- Vocabulário dos estados da máquina de estados do flow.js ---

const ETAPA_QUALIFICACAO = [
  'NOVO',
  'AGUARDANDO_MOTIVO',
  'AGUARDANDO_HISTORICO',
  'AGUARDANDO_FORMATO',
];

const ETAPA_FOLLOWUP = [
  'FOLLOWUP_D2',
  'FOLLOWUP_D3',
  'FOLLOWUP_D5',
  'FOLLOWUP_D7',
  'REENGAJAMENTO_MENSAL',
];

const ROTULO_ESTADO = {
  NOVO: 'Novo',
  AGUARDANDO_MOTIVO: 'Aguardando motivo',
  AGUARDANDO_HISTORICO: 'Aguardando histórico',
  AGUARDANDO_FORMATO: 'Aguardando formato',
  CATALOGO_ENVIADO: 'Catálogo enviado',
  FOLLOWUP_D2: 'Follow-up D+2',
  FOLLOWUP_D3: 'Follow-up D+3',
  FOLLOWUP_D5: 'Follow-up D+5',
  FOLLOWUP_D7: 'Follow-up D+7',
  REENGAJAMENTO_MENSAL: 'Reengajamento mensal',
  HANDOFF: 'Handoff',
  DESQUALIFICADO: 'Desqualificado',
  CLIENTE: 'Cliente',
};

const MARCA_RISCO = 'RISCO/CRISE';

function ehRisco(lead) {
  return typeof lead.notas === 'string' && lead.notas.includes(MARCA_RISCO);
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
