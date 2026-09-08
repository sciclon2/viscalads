type PlayerGame = {
  date: string;
  status: string;
  team1: string[];
  team2: string[];
};

export function activityCutoff(reference = new Date(), days = 60) {
  const cutoff = new Date(reference);
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setDate(cutoff.getDate() - days);
  const year = cutoff.getFullYear();
  const month = String(cutoff.getMonth() + 1).padStart(2, '0');
  const day = String(cutoff.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function hasRecentActivity(
  player: string,
  games: PlayerGame[],
  cutoff: string,
) {
  return games.some(
    (game) =>
      game.status === 'verified' &&
      game.date >= cutoff &&
      (game.team1.includes(player) || game.team2.includes(player)),
  );
}
