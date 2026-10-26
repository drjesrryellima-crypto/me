// Conversa com o serviço `whatsapp-leads-disparo` (Python), que mora no mesmo
// projeto da Railway.
//
// Duas coisas, as mesmas que o n8n fazia quando atendia o paciente:
//
// 1. repassar o que a Meta mandou (respostas e status de entrega), para o
//    disparo tirar da fila quem respondeu, honrar o PARAR e registrar a entrega
//    da campanha;
// 2. perguntar se um telefone veio das listas de Meta Ads (coluna Fonte).
//
// Nenhuma das duas pode atrapalhar o paciente: falha aqui vira linha de log, e
// a conversa segue. O texto da mensagem nunca vai para o log.

const axios = require('axios');

const URL_BASE = () =>
  (process.env.DISPARO_URL || 'https://whatsapp-leads-disparo-production.up.railway.app').replace(/\/+$/, '');
const SEGREDO = () => process.env.FORWARD_SECRET || '';

let avisouSemSegredo = false;
function configurado() {
  if (SEGREDO()) return true;
  if (!avisouSemSegredo) {
    avisouSemSegredo = true;
    console.warn(
      '[disparo] ⚠️  FORWARD_SECRET não definido neste serviço — as respostas dos pacientes NÃO estão sendo ' +
        'repassadas ao serviço do disparo (quem responde continua na fila e PARAR não chega lá).'
    );
  }
  return false;
}

/** Repassa o corpo cru da Meta (entry/changes/value). Nunca lança. */
async function repassar(corpo) {
  if (!configurado()) return false;
  try {
    await axios.post(`${URL_BASE()}/webhook`, corpo, {
      headers: { 'X-Forward-Secret': SEGREDO() },
      timeout: 10000,
    });
    return true;
  } catch (err) {
    const status = err.response ? ` HTTP ${err.response.status}` : '';
    console.error(`[disparo] falha ao repassar ao serviço do disparo:${status} ${err.code || err.message}`);
    return false;
  }
}

/** 'Meta Ads' se o telefone veio das listas do disparo, senão 'WhatsApp'. Nunca lança. */
async function fonteDoTelefone(phone) {
  if (!configurado()) return 'WhatsApp';
  try {
    const { data } = await axios.post(
      `${URL_BASE()}/admin/origem`,
      { phone },
      { headers: { 'X-Forward-Secret': SEGREDO() }, timeout: 8000 }
    );
    return data && data.origem ? data.origem : 'WhatsApp';
  } catch (err) {
    console.error(`[disparo] não consegui perguntar a origem de ${phone}: ${err.code || err.message} (fica 'WhatsApp')`);
    return 'WhatsApp';
  }
}

module.exports = { repassar, fonteDoTelefone, configurado };
