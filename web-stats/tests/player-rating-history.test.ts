import assert from 'node:assert/strict';
import test from 'node:test';
import { ratingHistoryDomain, ratingHistoryValue, ratingHistoryWindow } from '../lib/rating-history.ts';
import type { PlayerRatingPoint } from '../lib/stats-context.tsx';

const point = (date: string): PlayerRatingPoint => ({
  date, tournament: 'T1', current: 5, formScore: 0.5, recentMatches: 5,
  dynamic: true, missedMatches: 0, absencePenalty: false,
  participated: true, result: 'W', score1: 2, score2: 1,
});

test('default history window keeps the latest twenty matchdays', () => {
  const values = Array.from({ length: 25 }, (_, index) => point(`2026-01-${String(index + 1).padStart(2, '0')}`));
  assert.deepEqual(ratingHistoryWindow(values, '20'), values.slice(5));
});

test('year window is relative to the latest recorded matchday', () => {
  const values = [point('2024-12-01'), point('2025-06-01'), point('2026-01-01')];
  assert.deepEqual(ratingHistoryWindow(values, 'year').map((item) => item.date), ['2025-06-01', '2026-01-01']);
});

test('all history keeps every point', () => {
  const values = [point('2024-01-01'), point('2026-01-01')];
  assert.equal(ratingHistoryWindow(values, 'all').length, 2);
});

test('personal scale uses the full zero-to-ten range', () => {
  assert.deepEqual(ratingHistoryDomain(4, 6.5, 'personal'), { min: 0, max: 10 });
});

test('personal values map the player minimum, midpoint and maximum to zero, five and ten', () => {
  assert.equal(ratingHistoryValue(4, 4, 6.5, 'personal'), 0);
  assert.equal(ratingHistoryValue(5.25, 4, 6.5, 'personal'), 5);
  assert.equal(ratingHistoryValue(6.5, 4, 6.5, 'personal'), 10);
});

test('global scale always uses the full one-to-ten range', () => {
  assert.deepEqual(ratingHistoryDomain(4, 6.5, 'global'), { min: 1, max: 10 });
});
