const cron = require('node-cron');
const { checarHandoffsParados } = require('./handoff-parado');

// De 10 em 10 minutos. A espera mais curta que o handoff-parado usa é de 20
// minutos (crise), então checar a cada 10 garante que o re-alerta saia perto
// da hora em vez de arrastar meia hora a mais — que num caso de crise é a
// diferença que importa.
const EXPRESSAO = '*/10 * * * *';

function iniciarVigiaDeHandoff() {
  const tarefa = () =>
    checarHandoffsParados().catch((err) =>
      console.error('[handoff-parado] erro na checagem:', err.message)
    );

  cron.schedule(EXPRESSAO, tarefa);
  console.log('[handoff-parado] vigia iniciado (checagem a cada 10 minutos)');
}

module.exports = { iniciarVigiaDeHandoff };
