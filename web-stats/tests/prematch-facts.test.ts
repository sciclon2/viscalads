import assert from 'node:assert/strict';
import test from 'node:test';
import { prematchFacts, type FactRule } from '../lib/prematch-facts.ts';
import type { Game, PlayerRating, PlayerRatingPoint, PlayerStat, Profile } from '../lib/stats-context.tsx';

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
  const facts = prematchFacts(games, ['Ana'], ['Bea'], [], tournamentRules, games, 'T1', ['Ana', 'Bea']);
  assert.equal(facts.length, 1);
  assert.match(facts[0].text, /T1/);
  assert.equal(prematchFacts(games, ['Ana', 'Bea'], [], [], tournamentRules, games, 'T1', ['Ana', 'Bea']).length, 0);
  assert.equal(prematchFacts(games, ['Ana'], ['Bea'], [], tournamentRules, games, 'T1').length, 0);
});

test('avisa cuando el próximo resultado puede desbloquear un parche sin mezclar competiciones', () => {
  const achievementRule: FactRule[] = [{ code: 'achievement_watch', title: 'Parche en juego', description: '', priority: 1 }];
  const games = [
    game('2026-01-01', '1'), game('2026-01-08', '1'), game('2026-01-15', '1'), game('2026-01-22', '1'),
  ];
  const fact = prematchFacts(games, ['Ana'], ['Bea'], [], achievementRule)[0];
  assert.equal(fact.code, 'achievement_watch');
  assert.match(fact.text, /Ana.*Racha ganadora.*5 victorias/);
});

test('nombra explícitamente el torneo al comparar posiciones', () => {
  const standingsRule: FactRule[] = [{ code: 'standings_overtake', title: 'Duelo por la tabla', description: '', priority: 1 }];
  const games = [{ ...game('2026-01-01', '1'), tournament: 'T11' }];
  const standings = [
    { name: 'Ana', totalPoints: 9 },
    { name: 'Bea', totalPoints: 8 },
  ];
  const fact = prematchFacts(games, ['Bea'], ['Ana'], [], standingsRule, games, 'T11', [], standings)[0];
  assert.match(fact.text, /tabla de T11/);
  assert.doesNotMatch(fact.text, /esta competición/);
});

const rating = (formScore: number): PlayerRating => ({
  min: 3, max: 8, current: 5.5, matchmakingCurrent: 5.5, midpoint: 5.5,
  recentMatches: 10, formScore, dynamic: true, stale: false, inactivityDays: 95,
  lastPlayedOn: '2026-03-04', missedMatches: 0, absencePenalty: false, absencePenaltyPercent: 0,
});

const ratingPoint = (date: string, formScore: number): PlayerRatingPoint => ({
  date, tournament: 'T1', current: 5.5, formScore, recentMatches: 10,
  dynamic: true, stale: false, missedMatches: 0, absencePenalty: false,
  participated: true, result: 'W', score1: 2, score2: 0,
});

const momentProfile = (name: string, formScore: number, ratingHistory: PlayerRatingPoint[] = []) => ({
  name, rating: rating(formScore), ratingHistory,
}) as Pick<Profile, 'name' | 'rating' | 'ratingHistory'>;

test('anticipa si el próximo resultado entrega una corona o una calavera', () => {
  const momentRule: FactRule[] = [{ code: 'moment_status_watch', title: 'Momento en juego', description: '', priority: 1 }];
  const outcomes: Game['outcome'][] = ['1', '1', '1', '1', '1', '1', 'D', '2', '2'];
  const games = outcomes.map((outcome, index) => game(`2026-0${Math.floor(index / 4) + 1}-${String(index % 4 + 1).padStart(2, '0')}`, outcome));
  const facts = prematchFacts(
    games, ['Ana'], ['Bea'], [], momentRule, games, 'T1', [], [],
    [momentProfile('Ana', 0.78), momentProfile('Bea', 0.22)],
  );
  assert.equal(facts.length, 1);
  assert.match(facts[0].text, /victoria puede coronar a Ana/);
  assert.match(facts[0].text, /Bea está al borde del pozo/);
});

test('detecta un récord vigente de permanencia en prime por partidos jugados', () => {
  const recordRule: FactRule[] = [{ code: 'moment_status_record', title: 'Racha de momento', description: '', priority: 1 }];
  const history = [
    ratingPoint('2026-01-01', 0.82), ratingPoint('2026-01-08', 0.85),
    ratingPoint('2026-01-15', 0.5),
    ratingPoint('2026-02-01', 0.81), ratingPoint('2026-02-08', 0.84), ratingPoint('2026-02-15', 0.88),
  ];
  const facts = prematchFacts(
    [game('2026-02-15', '1')], ['Ana'], ['Bea'], [], recordRule, undefined, 'T1', [], [],
    [momentProfile('Ana', 0.88, history)],
  );
  assert.equal(facts.length, 1);
  assert.match(facts[0].text, /Ana estableció un nuevo récord personal/);
  assert.match(facts[0].text, /3 partidos consecutivos en Prime Moment/);
});

test('una victoria puede sacar la calavera y el récord rock bottom usa participaciones', () => {
  const rules: FactRule[] = [
    { code: 'moment_status_watch', title: 'Momento en juego', description: '', priority: 1 },
    { code: 'moment_status_record', title: 'Racha de momento', description: '', priority: 2 },
  ];
  const outcomes: Game['outcome'][] = ['1', '1', '2', '2', '2', '2', '2', '2', '2'];
  const games = outcomes.map((outcome, index) => game(`2026-03-${String(index + 1).padStart(2, '0')}`, outcome));
  const history = [
    ratingPoint('2026-01-01', 0.18), ratingPoint('2026-01-08', 0.15),
    ratingPoint('2026-01-15', 0.5),
    ratingPoint('2026-02-01', 0.19), ratingPoint('2026-02-08', 0.16), ratingPoint('2026-02-15', 0.12),
  ];
  const facts = prematchFacts(
    games, ['Ana'], ['Bea'], [], rules, games, 'T1', [], [],
    [momentProfile('Ana', 0.12, history)],
  );
  assert.match(facts.find((fact) => fact.code === 'moment_status_watch')!.text, /victoria puede quitarle la calavera/);
  assert.match(facts.find((fact) => fact.code === 'moment_status_record')!.text, /3 partidos consecutivos en Rock Bottom/);
});
