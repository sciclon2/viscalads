import assert from 'node:assert/strict';
import test from 'node:test';
import { estimatedTournamentEnd } from '../lib/tournament-dates.ts';

test('estimates the last weekly matchday including the start date', () => {
  assert.equal(estimatedTournamentEnd('2026-09-09', 10), '2026-11-11');
});

test('a one-matchday tournament ends on its start date', () => {
  assert.equal(estimatedTournamentEnd('2026-09-09', 1), '2026-09-09');
});

test('rejects invalid dates and matchday counts', () => {
  assert.equal(estimatedTournamentEnd('2026-02-30', 10), null);
  assert.equal(estimatedTournamentEnd('', 10), null);
  assert.equal(estimatedTournamentEnd('2026-09-09', 0), null);
  assert.equal(estimatedTournamentEnd('2026-09-09', 1.5), null);
});
