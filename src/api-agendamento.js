// A ponte entre o n8n e o agendamento deste repositório.
//
// Desde 18/10/2026 quem conversa com o paciente é o fluxo do n8n. O cálculo de
// horário livre, porém, continua aqui: ler a agenda do consultório, descontar o
// que o Google já tem ocupado, entender qual opção o paciente escolheu e marcar
// reconferindo a vaga. Isso é conta de data e leitura de texto — as duas coisas
// que um fluxograma faz pior.
//
// Então o n8n PERGUNTA e este serviço RESPONDE COM TEXTO. Quem manda a mensagem
// para o paciente continua sendo o n8n, sempre. Este arquivo nunca fala com o
// WhatsApp: é calculadora, não atendente.
//
// Isso é deliberado. Dois sistemas mandando mensagem no mesmo número foi
// exatamente o que produziu o episódio das 21 mensagens (ver ESTADO-DO-PROJETO).

const crypto = require('crypto');
const express = require('express');
const { getLead, saveLead, createLeadIfMissing } = require('./state');
const agendamento = require('./agendamento');

const SEGREDO = process.env.AGENDAMENTO_TOKEN;

const aparar = (v) => String(v ?? '').trim();

function segredoValido(recebido) {
  const a = Buffer.from(aparar(recebido));
  const b = Buffer.from(aparar(SEGREDO));
  if (!a.length || !b.length) return false;
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function exigirSegredo(req, res, next) {
  if (!SEGREDO) {
    return res.status(503).json({
      erro: 'AGENDAMENTO_TOKEN não configurado',
      comoResolver:
        'Defina AGENDAMENTO_TOKEN nas variáveis do serviço e use o mesmo valor no ' +
        'cabeçalho X-Agendamento-Token dos nós HTTP Request do n8n.',
    });
  }
  if (!segredoValido(req.get('x-agendamento-token'))) {
    return res.status(401).json({ erro: 'token não confere' });
  }
  return next();
}

const soDigitos = (v) => String(v ?? '').replace(/\D/g, '');

function lerTelefone(req, res) {
  const phone = soDigitos(req.body && req.body.phone);
  // 12 dígitos = 55 + DDD + 8. Abaixo disso é erro de montagem no n8n, e marcar
  // consulta para um telefone torto é pior do que recusar.
  if (phone.length < 12) {
    res.status(400).json({ erro: 'phone ausente ou curto demais', recebido: phone.length });
    return null;
  }
  return phone;
}

function criarRouterDeAgendamento() {
  const router = express.Router();

  // O n8n chama quando o paciente pede para marcar. Devolve o texto com as três
  // opções, já numerado — o n8n só repassa.
  router.post('/api/agendamento/oferecer', exigirSegredo, async (req, res) => {
    const phone = lerTelefone(req, res);
    if (!phone) return undefined;

    if (!agendamento.disponivel()) {
      return res.status(503).json({ erro: 'agendamento desligado', comoResolver: 'defina GOOGLE_CALENDAR_ID' });
    }

    try {
      createLeadIfMissing(phone);
      if (req.body.nome) saveLead(phone, { nome: aparar(req.body.nome) });
      if (req.body.formato) saveLead(phone, { formato: aparar(req.body.formato) });

      const oferta = await agendamento.oferecer(getLead(phone));
      if (oferta.campos) saveLead(phone, oferta.campos);

      // Sem o texto nem o nome: o log da Railway é de terceiro e isto é
      // paciente de saúde mental. Quantas vagas saíram basta para depurar.
      console.log(
        `[api-agendamento] ${phone}: ${oferta.semVagas ? `sem vagas (${oferta.motivo})` : 'três horários oferecidos'}`
      );
      return res.json({
        texto: oferta.texto,
        temVagas: !oferta.semVagas,
        ...(oferta.semVagas ? { motivo: oferta.motivo } : {}),
      });
    } catch (err) {
      console.error(`[api-agendamento] falha ao oferecer para ${phone}: ${err.message}`);
      return res.status(500).json({ erro: 'falha ao consultar a agenda' });
    }
  });

  // O n8n chama com a resposta crua do paciente ("a 2", "pode ser quinta").
  // Quem entende qual opção foi escolhida é o escolha-vaga.js daqui.
  router.post('/api/agendamento/confirmar', exigirSegredo, async (req, res) => {
    const phone = lerTelefone(req, res);
    if (!phone) return undefined;

    const resposta = aparar(req.body && req.body.resposta);
    const lead = getLead(phone);

    // Sem oferta válida não há o que confirmar: o n8n segue o fluxo normal
    // dele. Não é erro, é "esta mensagem não era sobre agendamento".
    if (!lead) return res.json({ semOferta: true });

    try {
      const r = await agendamento.confirmar(lead, resposta);
      if (!r) return res.json({ semOferta: true });
      if (r.campos) saveLead(phone, r.campos);

      const estado = r.marcada ? `marcada (${r.quando})` : r.naoEntendi ? 'não entendeu a escolha' : `falhou — ${r.motivo}`;
      console.log(`[api-agendamento] ${phone}: ${estado}`);

      return res.json({
        texto: r.texto,
        marcada: Boolean(r.marcada),
        naoEntendi: Boolean(r.naoEntendi),
        falhou: Boolean(r.falhou),
        ...(r.quando ? { quando: r.quando } : {}),
      });
    } catch (err) {
      console.error(`[api-agendamento] falha ao confirmar para ${phone}: ${err.message}`);
      return res.status(500).json({ erro: 'falha ao marcar na agenda' });
    }
  });

  return router;
}

function avisarSeSemSegredo() {
  if (!SEGREDO) {
    console.warn(
      '[api-agendamento] ⚠️  AGENDAMENTO_TOKEN não definido — os endpoints de agendamento ' +
        'respondem 503. O n8n não vai conseguir oferecer horário.'
    );
  } else {
    console.log('[api-agendamento] pronto (POST /api/agendamento/oferecer e /confirmar)');
  }
}

module.exports = { criarRouterDeAgendamento, avisarSeSemSegredo, exigirSegredo };
