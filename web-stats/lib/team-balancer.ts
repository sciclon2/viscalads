import { bestFormation, type Formation } from './team-formation.ts';
import { leaderDistributionGap } from './leader-race.ts';

export type BalanceGame = {
  status: string;
  outcome: '1' | '2' | 'D' | '?';
  team1: string[];
  team2: string[];
};

export type BalancePlayer = {
  id: number;
  name: string;
  level: number;
  primary: string;
  alternate?: string;
};

export type ChemistryPair = {
  names: [string, string];
  played: number;
  adjustment: number;
};

export type BalancedTeams<T extends BalancePlayer = BalancePlayer> = {
  a: T[];
  b: T[];
  difference: number;
  rawDifference: number;
  effectiveA: number;
  effectiveB: number;
  formationA: Formation;
  formationB: Formation;
  keeperA: T | null;
  keeperB: T | null;
  keeperBonusA: number;
  keeperBonusB: number;
  chemistryA: number;
  chemistryB: number;
  notablePairsA: ChemistryPair[];
  notablePairsB: ChemistryPair[];
};

const resultValue = (outcome: BalanceGame['outcome'], team: 1 | 2) =>
  outcome === 'D' ? 0.5 : outcome === String(team) ? 1 : 0;

function pairKey(a: string, b: string) {
  return [a, b].sort().join('\u0000');
}

export function chemistryPairs(
  games: BalanceGame[],
): Map<string, ChemistryPair> {
  const individuals = new Map<string, { played: number; earned: number }>();
  const pairs = new Map<
    string,
    { names: [string, string]; played: number; earned: number }
  >();
  games
    .filter((game) => game.status === 'verified' && game.outcome !== '?')
    .forEach((game) => {
      ([game.team1, game.team2] as const).forEach((team, index) => {
        const value = resultValue(game.outcome, (index + 1) as 1 | 2);
        team.forEach((name) => {
          const row = individuals.get(name) ?? { played: 0, earned: 0 };
          row.played++;
          row.earned += value;
          individuals.set(name, row);
        });
        for (let first = 0; first < team.length; first++) {
          for (let second = first + 1; second < team.length; second++) {
            const names = [team[first], team[second]].sort() as [
              string,
              string,
            ];
            const key = pairKey(...names);
            const row = pairs.get(key) ?? { names, played: 0, earned: 0 };
            row.played++;
            row.earned += value;
            pairs.set(key, row);
          }
        }
      });
    });
  const result = new Map<string, ChemistryPair>();
  pairs.forEach((pair, key) => {
    if (pair.played < 5) return;
    const baselines = pair.names.map((name) => {
      const row = individuals.get(name)!;
      return row.earned / row.played;
    });
    const raw = pair.earned / pair.played - (baselines[0] + baselines[1]) / 2;
    const reliability = Math.min(1, pair.played / 10);
    result.set(key, {
      names: pair.names,
      played: pair.played,
      adjustment: Math.max(-0.12, Math.min(0.12, raw * reliability)),
    });
  });
  return result;
}

function teamChemistry<T extends BalancePlayer>(
  team: T[],
  pairs: Map<string, ChemistryPair>,
) {
  const found: ChemistryPair[] = [];
  for (let first = 0; first < team.length; first++) {
    for (let second = first + 1; second < team.length; second++) {
      const pair = pairs.get(pairKey(team[first].name, team[second].name));
      if (pair) found.push(pair);
    }
  }
  const adjustment = found.length
    ? found.reduce((sum, pair) => sum + pair.adjustment, 0) / found.length
    : 0;
  return {
    adjustment: adjustment * 1.5,
    notable: [...found]
      .filter((pair) => Math.abs(pair.adjustment) >= 0.02)
      .sort((a, b) => Math.abs(b.adjustment) - Math.abs(a.adjustment))
      .slice(0, 2),
  };
}

function keeper<T extends BalancePlayer>(team: T[], formation?: Formation) {
  return (
    team.find((player) =>
      formation
        ? formation.roles[player.name] === 'POR'
        : player.primary.toLowerCase().includes('portero'),
    ) ?? null
  );
}

export function splitBalancedTeams<T extends BalancePlayer>(
  players: T[],
  games: BalanceGame[],
  options: { leaders?: string[] } = {},
): BalancedTeams<T> {
  if (players.length < 8 || players.length % 2) {
    throw new Error('Se necesita una cantidad par de al menos 8 jugadores.');
  }
  const size = players.length / 2;
  const chemistry = chemistryPairs(games);
  const totalKeepers = players.filter((player) => keeper([player])).length;
  let best: BalancedTeams<T> | null = null;
  let bestScore = Infinity;

  const evaluate = (a: T[]) => {
    const names = new Set(a.map((player) => player.name));
    const b = players.filter((player) => !names.has(player.name));
    const formationA = bestFormation(a);
    const formationB = bestFormation(b);
    const keeperA = keeper(a, formationA);
    const keeperB = keeper(b, formationB);
    if (totalKeepers >= 2 && (!keeperA || !keeperB)) return;
    const rawA = a.reduce((sum, player) => sum + player.level, 0) / a.length;
    const rawB = b.reduce((sum, player) => sum + player.level, 0) / b.length;
    const onlyOneTeamHasKeeper = Boolean(keeperA) !== Boolean(keeperB);
    const keeperBonusA =
      onlyOneTeamHasKeeper && keeperA ? (keeperA.level * 0.1) / a.length : 0;
    const keeperBonusB =
      onlyOneTeamHasKeeper && keeperB ? (keeperB.level * 0.1) / b.length : 0;
    const chemistryA = teamChemistry(a, chemistry);
    const chemistryB = teamChemistry(b, chemistry);
    const effectiveA = rawA + keeperBonusA + chemistryA.adjustment;
    const effectiveB = rawB + keeperBonusB + chemistryB.adjustment;
    const countsA = formationA.counts;
    const countsB = formationB.counts;
    const positionGap =
      Math.abs(countsA.DEF - countsB.DEF) +
      Math.abs(countsA.MED - countsB.MED) +
      Math.abs(countsA.DEL - countsB.DEL);
    const invalidPenalty = formationA.valid && formationB.valid ? 0 : 1000;
    const leaderNames = options.leaders ?? [];
    const leaderPenalty = leaderNames.length >= 2
      ? leaderDistributionGap(
          a.map((player) => player.name),
          b.map((player) => player.name),
          leaderNames,
        ) * 0.12
      : 0;
    const score =
      Math.abs(effectiveA - effectiveB) * 13 +
      positionGap * 0.75 +
      (formationA.alternateUses + formationB.alternateUses) * 0.15 +
      leaderPenalty +
      invalidPenalty;
    if (score >= bestScore) return;
    bestScore = score;
    best = {
      a,
      b,
      difference: Math.abs(effectiveA - effectiveB),
      rawDifference: Math.abs(rawA - rawB),
      effectiveA,
      effectiveB,
      formationA,
      formationB,
      keeperA,
      keeperB,
      keeperBonusA,
      keeperBonusB,
      chemistryA: chemistryA.adjustment,
      chemistryB: chemistryB.adjustment,
      notablePairsA: chemistryA.notable,
      notablePairsB: chemistryB.notable,
    };
  };

  if (players.length <= 16) {
    const chosen: T[] = [players[0]];
    const walk = (start: number) => {
      if (chosen.length === size) return evaluate([...chosen]);
      for (let index = start; index < players.length; index++) {
        chosen.push(players[index]);
        walk(index + 1);
        chosen.pop();
      }
    };
    walk(1);
  } else {
    const sorted = [...players].sort((a, b) => b.level - a.level);
    const a: T[] = [],
      b: T[] = [];
    sorted.forEach((player) => {
      const target =
        a.length >= size
          ? b
          : b.length >= size
            ? a
            : a.reduce((sum, item) => sum + item.level, 0) <=
                b.reduce((sum, item) => sum + item.level, 0)
              ? a
              : b;
      target.push(player);
    });
    evaluate(a);
  }
  if (!best)
    throw new Error(
      'No se encontró una formación válida con los jugadores elegidos.',
    );
  return best;
}
