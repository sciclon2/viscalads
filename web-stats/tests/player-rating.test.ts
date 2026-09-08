import assert from 'node:assert/strict';
import test from 'node:test';
import { isPrimeMoment, isRockBottom, ratingRangePosition } from '../lib/player-rating.ts';

test('prime moment starts at exactly 80% of the personal range', () => {
  assert.equal(isPrimeMoment({ min: 4, max: 6.5, current: 6 }), true);
  assert.equal(isPrimeMoment({ min: 4, max: 6.5, current: 5.99 }), false);
});

test('range position is bounded and safely handles an invalid range', () => {
  assert.equal(ratingRangePosition({ min: 4, max: 6, current: 7 }), 1);
  assert.equal(ratingRangePosition({ min: 4, max: 4, current: 4 }), 0.5);
  assert.equal(isPrimeMoment(null), false);
});

test('rock bottom includes exactly the lowest 20% of the personal range', () => {
  assert.equal(isRockBottom({ min: 4, max: 6.5, current: 4.5 }), true);
  assert.equal(isRockBottom({ min: 4, max: 6.5, current: 4.51 }), false);
  assert.equal(isRockBottom(null), false);
});
