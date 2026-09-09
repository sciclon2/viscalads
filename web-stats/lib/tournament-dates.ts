export function estimatedTournamentEnd(startsOn: string, matchdayCount: number): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startsOn) || !Number.isInteger(matchdayCount) || matchdayCount < 1) {
    return null;
  }

  const start = new Date(`${startsOn}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || start.toISOString().slice(0, 10) !== startsOn) {
    return null;
  }

  start.setUTCDate(start.getUTCDate() + (matchdayCount - 1) * 7);
  return start.toISOString().slice(0, 10);
}

export function isTournamentClosedOn(endsOn: string | null, date: string): boolean {
  return Boolean(endsOn && endsOn < date);
}
