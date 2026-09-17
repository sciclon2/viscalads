import assert from 'node:assert/strict';
import test from 'node:test';
import { leaderDistributionGap, separatedTournamentLeaders } from '../lib/leader-race.ts';

const table = [
  { name: 'A', totalPoints: 18, played: 6 },
  { name: 'B', totalPoints: 17, played: 6 },
  { name: 'C', totalPoints: 12, played: 6 },
  { name: 'D', totalPoints: 11, played: 6 },
  { name: 'E', totalPoints: 10, played: 6 },
];

test('does not activate until more than half the tournament was played', () => {
  assert.deepEqual(separatedTournamentLeaders(table, 5, 10), []);
  assert.deepEqual(separatedTournamentLeaders(table, 6, 10), ['A', 'B']);
});

test('requires a full-win gap behind the leading pack', () => {
  const close = table.map((row, index) => ({ ...row, totalPoints: 18 - index }));
  assert.deepEqual(separatedTournamentLeaders(close, 6, 10), []);
});

test('identifies four detached leaders and measures their distribution', () => {
  const four = table.map((row, index) => ({ ...row, totalPoints: [20, 19, 18, 17, 10][index] }));
  assert.deepEqual(separatedTournamentLeaders(four, 7, 10), ['A', 'B', 'C', 'D']);
  assert.equal(leaderDistributionGap(['A', 'B'], ['C', 'D'], ['A', 'B', 'C', 'D']), 0);
  assert.equal(leaderDistributionGap(['A', 'B', 'C'], ['D'], ['A', 'B', 'C', 'D']), 2);
});

test('with three leaders prefers the first against the other two', () => {
  const three = table.map((row, index) => ({ ...row, totalPoints: [20, 19, 18, 10, 9][index] }));
  assert.deepEqual(separatedTournamentLeaders(three, 7, 10), ['A', 'B', 'C']);
  assert.equal(leaderDistributionGap(['A'], ['B', 'C'], ['A', 'B', 'C']), 1);
  assert.equal(leaderDistributionGap(['A', 'B'], ['C'], ['A', 'B', 'C']), 2);
});
