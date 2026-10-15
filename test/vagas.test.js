const test = require('node:test');
const assert = require('node:assert');
const { livres, sugerir, descrever, emMossoro, conflita, fatiarFaixa } = require('../src/vagas');

const AGENDA = {
  seg: { manha: ['08:00', '12:00'], tarde: ['14:00', '18:00'] },
  ter: { manha: ['08:00', '12:00'], tarde: ['14:00', '18:00'] },
  qua: { manha: ['08:00', '12:00'], tarde: ['14:00', '18:00'] },
  qui: { manha: ['08:00', '12:00'], tarde: ['14:00', '18:00'] },
  sex: { manha: ['08:00', '12:00'], tarde: ['14:00', '18:00'] },
  sab: { manha: ['08:00', '12:00'], tarde: null },
  dom: { manha: null, tarde: null },
};

// 2026-10-20 é uma terça-feira.
const terca13h = new Date('2026-10-20T13:00:00-03:00');

test('não oferece horário fora das faixas do consultório', () => {
  for (const vaga of livres(AGENDA, terca13h, [], 7)) {
    const { hora, diaDaSemana } = emMossoro(vaga);
    assert.notEqual(diaDaSemana, 0, `ofereceu domingo: ${descrever(vaga)}`);
    const dentro = (hora >= 8 && hora < 12) || (hora >= 14 && hora < 18);
    assert.ok(dentro, `ofereceu fora da faixa: ${descrever(vaga)}`);
  }
});

test('sábado só tem manhã, porque a agenda diz isso', () => {
  for (const vaga of livres(AGENDA, terca13h, [], 14)) {
    const { diaDaSemana, hora } = emMossoro(vaga);
    if (diaDaSemana === 6) assert.ok(hora < 12, `ofereceu sábado à tarde: ${descrever(vaga)}`);
  }
});

// A última vaga da manhã é 11h, não 12h: a consulta dura uma hora e 12h já é
// o fim da faixa. Oferecer 12h marca meia consulta em cima do almoço.
test('a vaga precisa CABER na faixa, não só começar dentro dela', () => {
  const manha = fatiarFaixa({ ano: 2026, mes: 9, dia: 21 }, ['08:00', '12:00']);
  const horas = manha.map((d) => emMossoro(d).hora);
  assert.deepEqual(horas, [8, 9, 10, 11]);
});

test('respeita a antecedência mínima — não oferece daqui a 20 minutos', () => {
  const primeira = livres(AGENDA, terca13h, [], 2)[0];
  assert.ok(primeira - terca13h >= 3 * 60 * 60 * 1000, `ofereceu cedo demais: ${descrever(primeira)}`);
  assert.equal(emMossoro(primeira).hora, 16, 'deveria pular 14h e 15h');
});

// O bug que custa caro: marcar em cima de paciente que já está lá.
test('não oferece horário que já está ocupado na agenda', () => {
  const ocupados = [{
    inicio: '2026-10-21T09:00:00-03:00',
    fim: '2026-10-21T10:00:00-03:00',
  }];
  const vagas = livres(AGENDA, terca13h, ocupados, 2);
  const noveDaQuarta = vagas.find((v) => {
    const m = emMossoro(v);
    return m.dia === 21 && m.hora === 9;
  });
  assert.equal(noveDaQuarta, undefined, 'marcou em cima de quem já estava lá');
  assert.ok(vagas.some((v) => emMossoro(v).dia === 21 && emMossoro(v).hora === 10), 'comeu a vaga das 10h junto');
});

test('evento que atravessa duas vagas bloqueia as duas', () => {
  const ocupados = [{ inicio: '2026-10-21T09:30:00-03:00', fim: '2026-10-21T10:30:00-03:00' }];
  const vagas = livres(AGENDA, terca13h, ocupados, 2)
    .filter((v) => emMossoro(v).dia === 21)
    .map((v) => emMossoro(v).hora);
  assert.ok(!vagas.includes(9) && !vagas.includes(10), `deixou passar: ${vagas}`);
  assert.ok(vagas.includes(8) && vagas.includes(11), `comeu vaga demais: ${vagas}`);
});

// Encostar não é sobrepor. Sem isto, o compromisso que termina 14h comeria a
// primeira consulta da tarde, todo dia.
test('evento que termina na hora que a vaga começa NÃO bloqueia', () => {
  const inicio = new Date('2026-10-21T14:00:00-03:00');
  const fim = new Date('2026-10-21T15:00:00-03:00');
  assert.equal(conflita(inicio, fim, { inicio: '2026-10-21T13:00:00-03:00', fim: '2026-10-21T14:00:00-03:00' }), false);
  assert.equal(conflita(inicio, fim, { inicio: '2026-10-21T15:00:00-03:00', fim: '2026-10-21T16:00:00-03:00' }), false);
  assert.equal(conflita(inicio, fim, { inicio: '2026-10-21T14:30:00-03:00', fim: '2026-10-21T15:30:00-03:00' }), true);
});

// O servidor roda em UTC. Uma consulta às 22h de Mossoró já é o dia seguinte
// em UTC — se o texto usar a data do servidor, o paciente recebe o dia errado.
test('a data falada é a de Mossoró, não a do servidor em UTC', () => {
  const vinteEDuasHoras = new Date('2026-10-21T22:00:00-03:00'); // 01h de 22/10 em UTC
  assert.equal(vinteEDuasHoras.getUTCDate(), 22, 'premissa do teste errada');
  assert.match(descrever(vinteEDuasHoras), /21 de outubro/);
  assert.match(descrever(vinteEDuasHoras), /quarta/);
});

test('descreve como gente fala', () => {
  assert.equal(descrever(new Date('2026-10-21T14:00:00-03:00')), 'quarta, 21 de outubro, às 14h');
  assert.equal(descrever(new Date('2026-10-21T14:30:00-03:00')), 'quarta, 21 de outubro, às 14h30');
});

// Oferecer 8h, 9h e 10h da mesma terça parece escolha e não é: quem não pode
// terça de manhã não pode nenhuma das três.
test('as três sugestões são de dias diferentes quando dá', () => {
  const escolhidas = sugerir(livres(AGENDA, terca13h, [], 7));
  const dias = new Set(escolhidas.map((d) => emMossoro(d).dia));
  assert.equal(escolhidas.length, 3);
  assert.equal(dias.size, 3, 'empilhou tudo no mesmo dia');
});

test('com um único dia livre, oferece horários daquele dia em vez de só um', () => {
  const soQuarta = { ...AGENDA, qui: {}, sex: {}, sab: {}, dom: {}, seg: {}, ter: {} };
  const escolhidas = sugerir(livres(soQuarta, terca13h, [], 1));
  assert.equal(escolhidas.length, 3);
  assert.ok(escolhidas.every((d) => emMossoro(d).dia === 21));
});

test('agenda vazia não quebra — devolve lista vazia', () => {
  assert.deepEqual(livres({}, terca13h, [], 7), []);
  assert.deepEqual(sugerir([]), []);
});
