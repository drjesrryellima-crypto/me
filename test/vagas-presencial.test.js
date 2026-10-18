const test = require('node:test');
const assert = require('node:assert');

// Regra do Dr. Jesrryel em 18/10/2026: consulta presencial SOMENTE segunda
// pela manhã; todo o resto da agenda é telemedicina.
//
// Não é preferência: nos outros turnos ele não está no consultório. Oferecer
// presencial numa quinta à tarde marcaria alguém para uma sala vazia — e esse
// erro só aparece com a pessoa parada na porta.

function comRegra(regra, fn) {
  const antes = process.env.VAGAS_PRESENCIAL_EM;
  if (regra === undefined) delete process.env.VAGAS_PRESENCIAL_EM;
  else process.env.VAGAS_PRESENCIAL_EM = regra;
  delete require.cache[require.resolve('../src/vagas')];
  try {
    return fn(require('../src/vagas'));
  } finally {
    if (antes === undefined) delete process.env.VAGAS_PRESENCIAL_EM;
    else process.env.VAGAS_PRESENCIAL_EM = antes;
    delete require.cache[require.resolve('../src/vagas')];
  }
}

const AGENDA = {
  seg: { manha: ['08:00', '12:00'], tarde: ['14:00', '18:00'] },
  ter: { manha: ['08:00', '12:00'], tarde: ['14:00', '18:00'] },
  qua: { manha: ['08:00', '12:00'], tarde: ['14:00', '18:00'] },
  qui: { manha: ['08:00', '12:00'], tarde: ['14:00', '18:00'] },
  sex: { manha: ['08:00', '12:00'], tarde: ['14:00', '18:00'] },
  sab: { manha: ['08:00', '12:00'], tarde: ['14:00', '18:00'] },
  dom: { manha: null, tarde: null },
};

// Domingo 18/10/2026, 20h de Mossoró. A próxima segunda é 19/10.
const AGORA = new Date('2026-10-18T23:00:00Z');

const DIA_E_TURNO = (vagas, d) => {
  const { diaDaSemana, hora } = vagas.emMossoro(d);
  return `${['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'][diaDaSemana]}:${hora < 12 ? 'manha' : 'tarde'}`;
};

test('o padrão é presencial só na segunda de manhã', () => {
  comRegra(undefined, (vagas) => {
    assert.strictEqual(vagas.modalidadeDo(1, 'manha'), 'Presencial');
    assert.strictEqual(vagas.modalidadeDo(1, 'tarde'), 'Online');
    for (const dia of [2, 3, 4, 5, 6]) {
      assert.strictEqual(vagas.modalidadeDo(dia, 'manha'), 'Online', `dia ${dia} manhã`);
      assert.strictEqual(vagas.modalidadeDo(dia, 'tarde'), 'Online', `dia ${dia} tarde`);
    }
  });
});

test('quem pediu presencial só recebe segunda de manhã', () => {
  comRegra(undefined, (vagas) => {
    const lista = vagas.candidatos(AGENDA, AGORA, 14, 'Presencial');
    assert.ok(lista.length, 'não ofereceu nenhum horário presencial');
    for (const v of lista) {
      assert.strictEqual(DIA_E_TURNO(vagas, v), 'seg:manha', `ofereceu ${v.toISOString()}`);
    }
  });
});

// A outra metade da regra, e a que protege o recurso escasso: a segunda de
// manhã é o único presencial que existe. Se um paciente online pudesse pegar
// aquele horário, ele tiraria a vaga de quem só pode ir pessoalmente.
test('quem pediu online nunca recebe a segunda de manhã', () => {
  comRegra(undefined, (vagas) => {
    const lista = vagas.candidatos(AGENDA, AGORA, 14, 'Online');
    assert.ok(lista.length);
    for (const v of lista) {
      assert.notStrictEqual(DIA_E_TURNO(vagas, v), 'seg:manha', `ofereceu ${v.toISOString()}`);
    }
  });
});

// Célula de formato em branco acontece: áudio que a planilha não classificou,
// lead importado. Oferecer ZERO horário por causa disso seria pior do que
// oferecer um que talvez não sirva — o paciente diria, e aí dá para corrigir.
test('formato em branco não filtra nada', () => {
  comRegra(undefined, (vagas) => {
    const todos = vagas.candidatos(AGENDA, AGORA, 14);
    const presencial = vagas.candidatos(AGENDA, AGORA, 14, 'Presencial');
    const online = vagas.candidatos(AGENDA, AGORA, 14, 'Online');

    assert.strictEqual(todos.length, presencial.length + online.length);
    for (const vazio of ['', null, undefined, 'não sei', 'telemedicina']) {
      assert.strictEqual(vagas.candidatos(AGENDA, AGORA, 14, vazio).length, todos.length, String(vazio));
    }
  });
});

test('a regra é configurável sem mexer no código', () => {
  comRegra('qua:tarde,sex:manha', (vagas) => {
    assert.strictEqual(vagas.modalidadeDo(3, 'tarde'), 'Presencial');
    assert.strictEqual(vagas.modalidadeDo(5, 'manha'), 'Presencial');
    assert.strictEqual(vagas.modalidadeDo(1, 'manha'), 'Online', 'segunda continuou presencial');

    const lista = vagas.candidatos(AGENDA, AGORA, 14, 'Presencial');
    assert.ok(lista.length);
    for (const v of lista) {
      assert.ok(['qua:tarde', 'sex:manha'].includes(DIA_E_TURNO(vagas, v)), v.toISOString());
    }
  });
});

test('livres respeita o formato e o que já está ocupado', () => {
  comRegra(undefined, (vagas) => {
    const segundaDeManha = vagas.candidatos(AGENDA, AGORA, 14, 'Presencial');
    const primeira = segundaDeManha[0];
    const ocupado = {
      inicio: primeira.toISOString(),
      fim: new Date(primeira.getTime() + vagas.DURACAO_MIN * 60000).toISOString(),
    };

    const livres = vagas.livres(AGENDA, AGORA, [ocupado], 14, 'Presencial');
    assert.ok(!livres.some((v) => v.getTime() === primeira.getTime()), 'ofereceu horário ocupado');
    for (const v of livres) {
      assert.strictEqual(DIA_E_TURNO(vagas, v), 'seg:manha');
    }
  });
});
