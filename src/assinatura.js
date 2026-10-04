const crypto = require('crypto');

// A Meta assina cada POST do webhook com HMAC-SHA256 do corpo CRU, usando o
// App Secret do app, e manda o resultado no header X-Hub-Signature-256.
// Sem conferir essa assinatura, o endpoint aceita POST de qualquer um: dá pra
// inventar lead, forjar mensagem de um telefone que não é seu, ou disparar um
// falso alerta de RISCO/CRISE. Num endereço público (ngrok ou VPS) isso é
// questão de tempo.
const APP_SECRET = process.env.WHATSAPP_APP_SECRET;

// Compara em tempo constante. Comparação com === vaza, pelo tempo de resposta,
// quantos bytes iniciais bateram — o que permite adivinhar a assinatura byte a byte.
function assinaturaConfere(corpoCru, headerRecebido) {
  return diagnosticar(corpoCru, headerRecebido).ok;
}

// Diz POR QUE a assinatura não bateu, e a diferença entre os motivos é tudo.
//
// "Sem header" é um POST que não veio da Meta: scanner varrendo a internet,
// curl de teste, link clicado por engano. Esperado e inofensivo.
//
// "Header não bate" com a Meta mandando direito é quase sempre uma coisa só:
// o App Secret colado está errado. E esse caso é grave e silencioso — o bot
// para de receber TODAS as mensagens e o único sinal é uma linha de log que,
// na redação antiga, era idêntica à do scanner.
//
// O segredo nunca entra na mensagem: o motivo é dito, o valor não.
function diagnosticar(corpoCru, headerRecebido) {
  if (!APP_SECRET) return { ok: false, motivo: 'WHATSAPP_APP_SECRET não definido' };
  if (!corpoCru || !corpoCru.length) return { ok: false, motivo: 'corpo vazio' };
  if (typeof headerRecebido !== 'string' || !headerRecebido) {
    return {
      ok: false,
      motivo: 'sem header x-hub-signature-256 — este POST não veio da Meta (scanner, curl ou link)',
      daMeta: false,
    };
  }
  if (!headerRecebido.startsWith('sha256=')) {
    return { ok: false, motivo: 'header x-hub-signature-256 em formato inesperado', daMeta: false };
  }

  const esperado = 'sha256=' + crypto.createHmac('sha256', APP_SECRET).update(corpoCru).digest('hex');
  const a = Buffer.from(headerRecebido);
  const b = Buffer.from(esperado);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return {
      ok: false,
      motivo:
        'a assinatura não confere com o WHATSAPP_APP_SECRET configurado. ' +
        'Se as mensagens pararam de chegar, é quase certo que o App Secret colado está ' +
        'errado ou é de outro app — confira em developers.facebook.com → seu app → ' +
        'Configurações → Básico',
      daMeta: true,
    };
  }
  return { ok: true, motivo: 'assinatura confere' };
}

// Com WHATSAPP_APP_SECRET definido, exige assinatura válida em todo POST.
// Sem ele definido, deixa passar — senão o curl de teste do README e o
// desenvolvimento local parariam de funcionar. A contrapartida é o aviso
// gritado no startup (ver avisarSeSemAppSecret): rodar exposto sem app
// secret é deixar o webhook aberto.
function exigirAssinatura(req, res, next) {
  if (!APP_SECRET) return next();

  const diagnostico = diagnosticar(req.rawBody, req.get('x-hub-signature-256'));
  if (!diagnostico.ok) {
    // Assinatura que não bate é grito; POST sem header nenhum é ruído da
    // internet e não merece o mesmo destaque — se os dois saem iguais, o
    // importante some no meio do barulho.
    const prefixo = diagnostico.daMeta ? '[webhook] ⚠️  POST REJEITADO' : '[webhook] POST rejeitado';
    console.warn(`${prefixo}: ${diagnostico.motivo}`);
    return res.sendStatus(403);
  }
  return next();
}

function avisarSeSemAppSecret() {
  if (!APP_SECRET) {
    console.warn(
      '[webhook] ⚠️  WHATSAPP_APP_SECRET não definido — o webhook aceita POST de QUALQUER origem. ' +
        'Ok pra teste local; NUNCA suba pra um endereço público assim. ' +
        'Pegue o App Secret em developers.facebook.com → seu app → Configurações → Básico.'
    );
  }
}

// Lido em tempo de chamada, não no boot: o painel mostra o estado ao vivo, e
// uma leitura congelada mentiria depois de um redeploy com a variável nova.
function webhookProtegido() {
  const s = process.env.WHATSAPP_APP_SECRET;
  return Boolean(s && s.trim());
}

module.exports = {
  exigirAssinatura,
  assinaturaConfere,
  diagnosticar,
  avisarSeSemAppSecret,
  webhookProtegido,
};
