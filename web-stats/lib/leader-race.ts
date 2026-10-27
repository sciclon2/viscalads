export type LeaderStanding = { name: string; totalPoints: number; played: number };

const LEADER_SEPARATION_START = 0.4;

export function leaderSeparationWeight(
  playedMatchdays: number,
  scheduledMatchdays: number,
): number {
  if (scheduledMatchdays < 1) return 0;
  const ratio = playedMatchdays / scheduledMatchdays;
  if (ratio < LEADER_SEPARATION_START) return 0;
  const closingProgress = Math.min(
    1,
    (ratio - LEADER_SEPARATION_START) / (1 - LEADER_SEPARATION_START),
  );
  return 0.12 + closingProgress * 0.88;
}

export function separatedTournamentLeaders(
  standings: LeaderStanding[],
  playedMatchdays: number,
  scheduledMatchdays: number,
): string[] {
  if (
    scheduledMatchdays < 1 ||
    playedMatchdays / scheduledMatchdays < LEADER_SEPARATION_START
  ) return [];
  const ordered = standings
    .filter((row) => row.played > 0)
    .sort((a, b) => b.totalPoints - a.totalPoints || a.name.localeCompare(b.name));
  const possibleGroupSizes = Array.from(
    { length: Math.max(0, ordered.length - 2) },
    (_, index) => index + 2,
  );
  const boundary = possibleGroupSizes
    .filter((size) => ordered.length > size)
    .map((size) => ({ size, gap: ordered[size - 1].totalPoints - ordered[size].totalPoints }))
    .filter((candidate) => candidate.gap >= 3)
    .sort((a, b) => b.gap - a.gap || a.size - b.size)[0];
  return boundary ? ordered.slice(0, boundary.size).map((row) => row.name) : [];
}

export function leaderDistributionGap(teamA: string[], teamB: string[], leaders: string[]): number {
  const selected = new Set(leaders);
  const countA = teamA.filter((name) => selected.has(name)).length;
  const countB = teamB.filter((name) => selected.has(name)).length;
  const topLeaderCrowded = leaders.length % 2 === 1 && (
    (teamA.includes(leaders[0]) && countA > countB) ||
    (teamB.includes(leaders[0]) && countB > countA)
  );
  const totalRankWeight = leaders.reduce((sum, _name, index) => sum + leaders.length - index, 0);
  const rankWeightA = leaders.reduce(
    (sum, name, index) => sum + (teamA.includes(name) ? leaders.length - index : 0),
    0,
  );
  const rankWeightB = totalRankWeight - rankWeightA;
  const normalizedRankGap = totalRankWeight > 0
    ? Math.abs(rankWeightA - rankWeightB) / totalRankWeight
    : 0;
  return Math.abs(countA - countB) + (topLeaderCrowded ? 1 : 0) + normalizedRankGap;
}
