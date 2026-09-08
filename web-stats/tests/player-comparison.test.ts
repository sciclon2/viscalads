import assert from 'node:assert/strict';
import test from 'node:test';
import { compareSharedHistory } from '../lib/player-comparison.ts';

test('separates matches together from direct confrontations', () => {
  const result = compareSharedHistory('A', 'B', [
    { status: 'verified', outcome: '1', team1: ['A', 'B'], team2: ['C'] },
    { status: 'verified', outcome: 'D', team1: ['A'], team2: ['B'] },
    { status: 'verified', outcome: '2', team1: ['A'], team2: ['B'] },
    { status: 'excluded', outcome: '1', team1: ['A', 'B'], team2: [] },
  ]);
  assert.deepEqual(result.together, { played: 1, wins: 1, draws: 0, losses: 0 });
  assert.deepEqual(result.rivals, { played: 2, playerAWins: 0, playerBWins: 1, draws: 1 });
});
