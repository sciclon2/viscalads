import assert from 'node:assert/strict';
import test from 'node:test';
import {
  chemistryPairs,
  splitBalancedTeams,
  type BalanceGame,
  type BalancePlayer,
} from '../lib/team-balancer.ts';
import { pitchPosition } from '../lib/team-formation.ts';

const player = (
  id: number,
  level: number,
  primary = id % 3 === 0
    ? 'Delantero'
    : id % 2
      ? 'Defensor central'
      : 'Medio centro',
): BalancePlayer => ({ id, name: `P${id}`, level, primary });

test('reparte siempre dos porteros y anula el bonus', () => {
  const players = Array.from({ length: 8 }, (_, index) => player(index + 1, 5));
  players[0].primary = 'Portero';
  players[1].primary = 'Portero';
  const result = splitBalancedTeams(players, []);
  assert.ok(result.keeperA);
  assert.ok(result.keeperB);
  assert.equal(result.keeperBonusA, 0);
  assert.equal(result.keeperBonusB, 0);
});

test('un único portero aporta el diez por ciento de su nivel al total', () => {
  const players = Array.from({ length: 8 }, (_, index) => player(index + 1, 5));
  players[0].primary = 'Portero';
  const result = splitBalancedTeams(players, []);
  const bonus = result.keeperBonusA || result.keeperBonusB;
  assert.equal(bonus, 0.125);
});

test('el portero conserva un rol propio para ubicarse bajo el arco', () => {
  const players = Array.from({ length: 8 }, (_, index) => player(index + 1, 5));
  players[0].primary = 'Portero';
  const result = splitBalancedTeams(players, []);
  const formation = result.a.includes(players[0]) ? result.formationA : result.formationB;
  assert.equal(formation.roles[players[0].name], 'POR');
  assert.equal(formation.counts.POR, 1);
  const side = result.a.includes(players[0]) ? 'a' : 'b';
  const position = pitchPosition('POR', 0, 1, side);
  assert.equal(position.y, 50);
  assert.equal(position.x, side === 'a' ? 7 : 93);
});

test('la química requiere cinco partidos compartidos', () => {
  const game: BalanceGame = {
    status: 'verified',
    outcome: '1',
    team1: ['P1', 'P2'],
    team2: ['P3', 'P4'],
  };
  assert.equal(chemistryPairs(Array(4).fill(game)).size, 0);
  assert.ok(chemistryPairs(Array(5).fill(game)).has('P1\u0000P2'));
});

test('distingue una dupla positiva de una dupla con malos antecedentes', () => {
  const togetherWins: BalanceGame[] = Array.from({ length: 5 }, () => ({
    status: 'verified',
    outcome: '1',
    team1: ['P1', 'P2'],
    team2: ['P3', 'P4'],
  }));
  const separateLosses: BalanceGame[] = [
    ...Array.from({ length: 5 }, () => ({
      status: 'verified',
      outcome: '2' as const,
      team1: ['P1', 'P5'],
      team2: ['P7', 'P8'],
    })),
    ...Array.from({ length: 5 }, () => ({
      status: 'verified',
      outcome: '2' as const,
      team1: ['P2', 'P6'],
      team2: ['P7', 'P8'],
    })),
  ];
  const positive = chemistryPairs([...togetherWins, ...separateLosses]).get(
    'P1\u0000P2',
  )!;
  assert.ok(positive.adjustment > 0);

  const togetherLosses = togetherWins.map((game) => ({
    ...game,
    outcome: '2' as const,
  }));
  const separateWins = separateLosses.map((game) => ({
    ...game,
    outcome: '1' as const,
  }));
  const negative = chemistryPairs([...togetherLosses, ...separateWins]).get(
    'P1\u0000P2',
  )!;
  assert.ok(negative.adjustment < 0);
});

test('cada dupla explicada pertenece realmente al equipo indicado', () => {
  const players = Array.from({ length: 8 }, (_, index) => player(index + 1, 5));
  const history: BalanceGame[] = Array.from({ length: 5 }, () => ({
    status: 'verified', outcome: '1',
    team1: ['P1', 'P2', 'P3', 'P4'], team2: ['P5', 'P6', 'P7', 'P8'],
  }));
  const result = splitBalancedTeams(players, history);
  const namesA = new Set(result.a.map((item) => item.name));
  const namesB = new Set(result.b.map((item) => item.name));
  assert.ok(result.notablePairsA.every((pair) => pair.names.every((name) => namesA.has(name))));
  assert.ok(result.notablePairsB.every((pair) => pair.names.every((name) => namesB.has(name))));
});

test('rechaza convocatorias impares o menores de ocho', () => {
  assert.throws(() =>
    splitBalancedTeams(
      Array.from({ length: 7 }, (_, i) => player(i + 1, 5)),
      [],
    ),
  );
  assert.throws(() =>
    splitBalancedTeams(
      Array.from({ length: 9 }, (_, i) => player(i + 1, 5)),
      [],
    ),
  );
});

test('mantiene formaciones válidas además de equilibrar el nivel', () => {
  const players: BalancePlayer[] = [
    player(1, 8, 'Defensor central'),
    player(2, 7, 'Defensor derecha'),
    player(3, 6, 'Medio centro'),
    player(4, 5, 'Medio derecha'),
    player(5, 4, 'Delantero'),
    player(6, 8, 'Defensor central'),
    player(7, 7, 'Defensor izquierda'),
    player(8, 6, 'Medio centro'),
    player(9, 5, 'Medio izquierda'),
    player(10, 4, 'Delantero'),
  ];
  const result = splitBalancedTeams(players, []);
  assert.equal(result.formationA.valid, true);
  assert.equal(result.formationB.valid, true);
  assert.ok(result.difference <= 0.25);
});

test('un invitado sin posición funciona como jugador flexible', () => {
  const players = Array.from({ length: 10 }, (_, index) =>
    player(index + 1, 5),
  );
  players[0].primary = '';
  const result = splitBalancedTeams(players, []);
  assert.equal(result.formationA.valid, true);
  assert.equal(result.formationB.valid, true);
  const assigned = result.formationA.roles.P1 ?? result.formationB.roles.P1;
  assert.ok(['DEF', 'MED', 'DEL'].includes(assigned));
});

test('en igualdad de balance separa a los líderes para que se enfrenten', () => {
  const players = Array.from({ length: 8 }, (_, index) => player(index + 1, 5));
  const result = splitBalancedTeams(players, [], { leaders: ['P1', 'P2'] });
  assert.notEqual(result.a.includes(players[0]), result.a.includes(players[1]));
});

test('reparte cuatro jugadores de punta dos por equipo cuando el balance lo permite', () => {
  const players = Array.from({ length: 8 }, (_, index) => player(index + 1, 5));
  const leaders = ['P1', 'P2', 'P3', 'P4'];
  const result = splitBalancedTeams(players, [], { leaders });
  assert.equal(result.a.filter((item) => leaders.includes(item.name)).length, 2);
  assert.equal(result.b.filter((item) => leaders.includes(item.name)).length, 2);
});

test('con tres líderes deja al primero del lado con menos punteros', () => {
  const players = Array.from({ length: 8 }, (_, index) => player(index + 1, 5));
  const leaders = ['P1', 'P2', 'P3'];
  const result = splitBalancedTeams(players, [], { leaders });
  const topTeam = result.a.some((item) => item.name === 'P1') ? result.a : result.b;
  assert.equal(topTeam.filter((item) => leaders.includes(item.name)).length, 1);
});
