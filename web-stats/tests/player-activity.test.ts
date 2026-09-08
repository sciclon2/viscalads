import assert from 'node:assert/strict';
import test from 'node:test';
import { activityCutoff, hasRecentActivity } from '../lib/player-activity.ts';

const games = [
  { date: '2026-08-10', status: 'verified', team1: ['Activo'], team2: ['Otro'] },
  { date: '2026-08-20', status: 'excluded', team1: ['Inactivo'], team2: [] },
];

test('activity cutoff covers the previous sixty calendar days', () => {
  assert.equal(activityCutoff(new Date(2026, 8, 8, 12), 60), '2026-07-10');
});

test('only verified participation inside the cutoff counts as recent activity', () => {
  assert.equal(hasRecentActivity('Activo', games, '2026-07-10'), true);
  assert.equal(hasRecentActivity('Inactivo', games, '2026-07-10'), false);
  assert.equal(hasRecentActivity('Activo', games, '2026-08-11'), false);
});
