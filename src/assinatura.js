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
  if (!APP_SECRET || !corpoCru || typeof headerRecebido !== 'string') return false;
  if (!headerRecebido.startsWith('sha256=')) return false;

  const esperado = 'sha256=' + crypto.createHmac('sha256', APP_SECRET).update(corpoCru).digest('hex');
  const a = Buffer.from(headerRecebido);
  const b = Buffer.from(esperado);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// Com WHATSAPP_APP_SECRET definido, exige assinatura válida em todo POST.
// Sem ele definido, deixa passar — senão o curl de teste do README e o
// desenvolvimento local parariam de funcionar. A contrapartida é o aviso
// gritado no startup (ver avisarSeSemAppSecret): rodar exposto sem app
// secret é deixar o webhook aberto.
function exigirAssinatura(req, res, next) {
  if (!APP_SECRET) return next();

  if (!assinaturaConfere(req.rawBody, req.get('x-hub-signature-256'))) {
    console.warn('[webhook] POST rejeitado: assinatura ausente ou inválida');
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

module.exports = { exigirAssinatura, assinaturaConfere, avisarSeSemAppSecret };
