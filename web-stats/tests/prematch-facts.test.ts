import assert from 'node:assert/strict';
import test from 'node:test';
import { prematchFacts, type FactRule } from '../lib/prematch-facts.ts';
import type { Game, PlayerStat } from '../lib/stats-context.tsx';

const rules: FactRule[] = ['classic_rivalry', 'current_streak', 'standings_overtake', 'long_wait']
  .map((code, priority) => ({ code, title: code, description: '', priority }));
const game = (date: string, outcome: Game['outcome']): Game => ({
  id: Number(date.replaceAll('-', '')), date, outcome, status: 'verified',
  tournament: '', competition: 'sarria', team1: ['Ana'], team2: ['Bea'],
  score1: outcome === '1' ? 2 : 0, score2: outcome === '2' ? 2 : 0,
  quality: 'exact score', evidence: '', notes: '',
});

test('encuentra rivalidad, cuenta pendiente, racha y duelo por la tabla sin IA', () => {
  const games = [game('2026-01-01', '2'), game('2026-01-08', '2'), game('2026-01-15', '2')];
  const stats: PlayerStat[] = [
    { name: 'Ana', played: 3, wins: 1, draws: 0, losses: 2 },
    { name: 'Bea', played: 3, wins: 1, draws: 1, losses: 1 },
  ];
  const facts = prematchFacts(games, ['Ana'], ['Bea'], stats, rules);
  assert.deepEqual(new Set(facts.map((fact) => fact.code)), new Set(rules.map((rule) => rule.code)));
});

test('no inventa datos cuando no hay historial suficiente', () => {
  assert.deepEqual(prematchFacts([], ['Ana'], ['Bea'], [], rules), []);
});

test('el invicto y la victoria pendiente del torneo requieren tres partidos', () => {
  const tournamentRules: FactRule[] = [
    { code: 'tournament_unbeaten', title: 'Invicto', description: '', priority: 1 },
    { code: 'tournament_winless', title: 'Sin ganar', description: '', priority: 2 },
  ];
  const tournamentGame = (date: string, outcome: Game['outcome']) => ({ ...game(date, outcome), tournament: 'Torneo 9' });
  assert.equal(prematchFacts([tournamentGame('2026-01-01', '1'), tournamentGame('2026-01-08', '1')], ['Ana'], ['Bea'], [], tournamentRules).length, 0);
  const facts = prematchFacts([
    tournamentGame('2026-01-01', '1'), tournamentGame('2026-01-08', '1'), tournamentGame('2026-01-15', 'D'),
  ], ['Ana'], ['Bea'], [], tournamentRules);
  assert.deepEqual(facts.map((fact) => fact.code), ['tournament_unbeaten', 'tournament_winless']);
});

test('el récord de racha informa la última secuencia positiva o negativa con fechas', () => {
  const recordRule: FactRule[] = [{ code: 'streak_record', title: 'Récord', description: '', priority: 1 }];
  const games = [
    game('2026-01-01', '1'), game('2026-01-08', '1'), game('2026-01-15', '2'),
    game('2026-01-22', '1'), game('2026-01-29', '1'),
  ];
  const positive = prematchFacts(games, ['Ana'], ['Bea'], [], recordRule)[0];
  assert.match(positive.text, /victorias.*1\/1\/2026.*8\/1\/2026/);
  const negative = prematchFacts(games, ['Bea'], ['Ana'], [], recordRule)[0];
  assert.match(negative.text, /derrotas.*1\/1\/2026.*8\/1\/2026/);
});

test('no repite invicto y racha cuando un récord ganador ya cuenta la historia', () => {
  const overlapRules: FactRule[] = [
    { code: 'unbeaten_run', title: 'Invicto', description: '', priority: 1 },
    { code: 'current_streak', title: 'Racha', description: '', priority: 2 },
    { code: 'streak_record', title: 'Récord', description: '', priority: 3 },
  ];
  const games = [
    game('2026-01-01', '1'), game('2026-01-08', '1'), game('2026-01-15', '2'),
    game('2026-01-22', '1'), game('2026-01-29', '1'),
  ];
  const facts = prematchFacts(games, ['Ana'], ['Bea'], [], overlapRules);
  assert.deepEqual(facts.filter((fact) => fact.text.startsWith('Ana ')).map((fact) => fact.code), ['streak_record']);
});

test('los datos del torneo respetan la edición seleccionada y los equipos propuestos', () => {
  const tournamentRules: FactRule[] = [
    { code: 'leader_clash', title: 'Duelo', description: '', priority: 1 },
  ];
  const tournamentGame = (date: string, tournament: string, outcome: Game['outcome']) => ({
    ...game(date, outcome), tournament,
  });
  const games = [
    tournamentGame('2026-01-01', 'T1', '1'),
    tournamentGame('2026-01-08', 'T1', '1'),
    tournamentGame('2026-01-15', 'T1', '1'),
    tournamentGame('2026-02-01', 'T2', '2'),
  ];
  const facts = prematchFacts(games, ['Ana'], ['Bea'], [], tournamentRules, games, 'T1');
  assert.equal(facts.length, 1);
  assert.match(facts[0].text, /T1/);
  assert.equal(prematchFacts(games, ['Ana', 'Bea'], [], [], tournamentRules, games, 'T1').length, 0);
});
