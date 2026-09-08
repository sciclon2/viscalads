type ComparisonGame = {
  status: string;
  outcome: string;
  team1: string[];
  team2: string[];
};

function side(game: ComparisonGame, player: string) {
  if (game.team1.includes(player)) return '1';
  if (game.team2.includes(player)) return '2';
  return null;
}

function result(game: ComparisonGame, playerSide: string) {
  if (game.outcome === 'D') return 'draw';
  return game.outcome === playerSide ? 'win' : 'loss';
}

export function compareSharedHistory(
  playerA: string,
  playerB: string,
  games: ComparisonGame[],
) {
  const summary = {
    together: { played: 0, wins: 0, draws: 0, losses: 0 },
    rivals: { played: 0, playerAWins: 0, playerBWins: 0, draws: 0 },
  };
  games.filter((game) => game.status === 'verified').forEach((game) => {
    const sideA = side(game, playerA), sideB = side(game, playerB);
    if (!sideA || !sideB) return;
    if (sideA === sideB) {
      summary.together.played++;
      const outcome = result(game, sideA);
      if (outcome === 'win') summary.together.wins++;
      else if (outcome === 'draw') summary.together.draws++;
      else summary.together.losses++;
      return;
    }
    summary.rivals.played++;
    if (game.outcome === 'D') summary.rivals.draws++;
    else if (game.outcome === sideA) summary.rivals.playerAWins++;
    else if (game.outcome === sideB) summary.rivals.playerBWins++;
  });
  return summary;
}
