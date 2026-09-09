import assert from 'node:assert/strict';
import test from 'node:test';
import {
  FRIENDLY_MODE,
  isBuilderSelectionAvailable,
  isFriendlyMode,
  persistsCompetitiveData,
} from '../lib/match-mode.ts';

test('friendly mode remains available without an open tournament', () => {
  assert.equal(isBuilderSelectionAvailable(FRIENDLY_MODE, []), true);
});

test('closed or unknown tournament selections are rejected', () => {
  assert.equal(isBuilderSelectionAvailable('T10 Jun-Sep26', []), false);
  assert.equal(isBuilderSelectionAvailable('T11 Sep-Nov26', ['T11 Sep-Nov26']), true);
});

test('friendly mode never persists competitive data or enables tournament features', () => {
  assert.equal(isFriendlyMode(FRIENDLY_MODE), true);
  assert.equal(persistsCompetitiveData(FRIENDLY_MODE), false);
  assert.equal(persistsCompetitiveData('T11 Sep-Nov26'), true);
});
