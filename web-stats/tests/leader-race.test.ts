import assert from 'node:assert/strict';
import test from 'node:test';
import { leaderDistributionGap, leaderSeparationWeight, separatedTournamentLeaders } from '../lib/leader-race.ts';

const table = [
  { name: 'A', totalPoints: 18, played: 6 },
  { name: 'B', totalPoints: 17, played: 6 },
  { name: 'C', totalPoints: 12, played: 6 },
  { name: 'D', totalPoints: 11, played: 6 },
  { name: 'E', totalPoints: 10, played: 6 },
];

test('activates leader separation once 40 percent of the tournament was played', () => {
  assert.deepEqual(separatedTournamentLeaders(table, 3, 10), []);
  assert.deepEqual(separatedTournamentLeaders(table, 4, 10), ['A', 'B']);
});

test('increases leader separation weight progressively toward the final matchday', () => {
  assert.equal(leaderSeparationWeight(5, 13), 0);
  const matchdaySix = leaderSeparationWeight(6, 13);
  const matchdaySeven = leaderSeparationWeight(7, 13);
  const matchdayTen = leaderSeparationWeight(10, 13);
  const finalMatchday = leaderSeparationWeight(13, 13);
  assert.ok(matchdaySix > 0.12);
  assert.ok(matchdaySeven > matchdaySix);
  assert.ok(matchdayTen > matchdaySeven);
  assert.equal(finalMatchday, 1);
});

test('uses leader separation for T11 after six of thirteen matchdays', () => {
  const t11 = table.map((row, index) => ({ ...row, totalPoints: [9, 9, 9, 9, 6][index] }));
  assert.deepEqual(separatedTournamentLeaders(t11, 6, 13), ['A', 'B', 'C', 'D']);
  assert.ok(leaderSeparationWeight(6, 13) > 0);
});

test('requires a full-win gap behind the leading pack', () => {
  const close = table.map((row, index) => ({ ...row, totalPoints: 18 - index }));
  assert.deepEqual(separatedTournamentLeaders(close, 6, 10), []);
});

test('identifies four detached leaders and measures their distribution', () => {
  const four = table.map((row, index) => ({ ...row, totalPoints: [20, 19, 18, 17, 10][index] }));
  assert.deepEqual(separatedTournamentLeaders(four, 7, 10), ['A', 'B', 'C', 'D']);
  assert.equal(leaderDistributionGap(['A', 'D'], ['B', 'C'], ['A', 'B', 'C', 'D']), 0);
  assert.ok(
    leaderDistributionGap(['A', 'B'], ['C', 'D'], ['A', 'B', 'C', 'D'])
      > leaderDistributionGap(['A', 'D'], ['B', 'C'], ['A', 'B', 'C', 'D']),
  );
  assert.ok(leaderDistributionGap(['A', 'B', 'C'], ['D'], ['A', 'B', 'C', 'D']) > 2);
});

test('with three leaders prefers the first against the other two', () => {
  const three = table.map((row, index) => ({ ...row, totalPoints: [20, 19, 18, 10, 9][index] }));
  assert.deepEqual(separatedTournamentLeaders(three, 7, 10), ['A', 'B', 'C']);
  assert.equal(leaderDistributionGap(['A'], ['B', 'C'], ['A', 'B', 'C']), 1);
  assert.ok(leaderDistributionGap(['A', 'B'], ['C'], ['A', 'B', 'C']) > 2);
});

test('detects and fairly measures groups of five or more detached leaders', () => {
  const standings = [
    { name: 'A', totalPoints: 20, played: 7 },
    { name: 'B', totalPoints: 19, played: 7 },
    { name: 'C', totalPoints: 18, played: 7 },
    { name: 'D', totalPoints: 17, played: 7 },
    { name: 'E', totalPoints: 16, played: 7 },
    { name: 'F', totalPoints: 10, played: 7 },
    { name: 'G', totalPoints: 9, played: 7 },
  ];
  const five = separatedTournamentLeaders(standings, 7, 10);
  assert.deepEqual(five, ['A', 'B', 'C', 'D', 'E']);
  assert.ok(
    leaderDistributionGap(['A', 'C'], ['B', 'D', 'E'], five)
      < leaderDistributionGap(['A', 'B'], ['C', 'D', 'E'], five),
  );
  assert.ok(leaderDistributionGap(['A', 'B', 'C'], ['D', 'E'], five) > 2);

  const sixStandings = standings.map((row) => (
    row.name === 'F' ? { ...row, totalPoints: 15 } : row
  ));
  const six = separatedTournamentLeaders(sixStandings, 7, 10);
  assert.deepEqual(six, ['A', 'B', 'C', 'D', 'E', 'F']);
  assert.ok(
    leaderDistributionGap(['A', 'D', 'F'], ['B', 'C', 'E'], six)
      < leaderDistributionGap(['A', 'B', 'C'], ['D', 'E', 'F'], six),
  );
});
