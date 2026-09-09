export type LeaderStanding = { name: string; totalPoints: number; played: number };

export function separatedTournamentLeaders(
  standings: LeaderStanding[],
  playedMatchdays: number,
  scheduledMatchdays: number,
): string[] {
  if (scheduledMatchdays < 1 || playedMatchdays / scheduledMatchdays <= 0.5) return [];
  const ordered = standings
    .filter((row) => row.played > 0)
    .sort((a, b) => b.totalPoints - a.totalPoints || a.name.localeCompare(b.name));
  const boundary = [2, 3, 4]
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
  return Math.abs(countA - countB) + (topLeaderCrowded ? 1 : 0);
}
