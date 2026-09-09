import assert from 'node:assert/strict';
import test from 'node:test';
import { playerMomentExplanation } from '../lib/team-explanation.ts';

const player = (name: string) => ({ name });

test('names a strong player and a player recovering form naturally', () => {
  const text = playerMomentExplanation([player('Andy S')], [], [], [player('Sergio')]);
  assert.match(text, /Andy S.*mejores momentos.*Celeste/);
  assert.match(text, /Sergio.*recuperando ritmo.*Rosa/);
});

test('lists several players with their actual proposed teams', () => {
  const text = playerMomentExplanation(
    [player('Andy S')], [player('Facu')],
    [player('Sergio')], [player('Mati')],
  );
  assert.match(text, /Andy S y Facu.*Andy S en Celeste; Facu en Rosa/);
  assert.match(text, /Sergio y Mati.*Sergio en Celeste; Mati en Rosa/);
});

test('uses a neutral explanation when nobody stands out', () => {
  assert.match(playerMomentExplanation([], [], [], []), /No hay grandes diferencias/);
});
