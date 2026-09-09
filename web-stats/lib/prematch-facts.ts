import type { Game, PlayerStat } from '@/lib/stats-context';

export type FactRule = { code: string; title: string; description: string; priority: number; scope?: 'competition' | 'global' };
export type PrematchFact = { code: string; title: string; text: string; scope: 'competition' | 'global' };

const inTeam = (game: Game, name: string) => game.team1.includes(name) ? 1 : game.team2.includes(name) ? 2 : 0;
const resultFor = (game: Game, name: string) => {
  const side = inTeam(game, name);
  if (!side || game.outcome === '?') return '';
  if (game.outcome === 'D') return 'D';
  return String(side) === game.outcome ? 'W' : 'L';
};

export function currentTournamentLeaders(games: Game[]) {
  const verified = games.filter((game) => game.status === 'verified').sort((a, b) => a.date.localeCompare(b.date));
  const tournament = [...verified].reverse().find((game) => game.tournament)?.tournament;
  if (!tournament) return { tournament: '', matchDays: 0, leaders: [] as [string, number][] };
  const tournamentGames = verified.filter((game) => game.tournament === tournament);
  const table = new Map<string, number>();
  tournamentGames.forEach((game) => [...game.team1, ...game.team2].forEach((name) => {
    const result = resultFor(game, name);
    table.set(name, (table.get(name) ?? 0) + (result === 'W' ? 3 : result === 'D' ? 1 : 0));
  }));
  return {
    tournament,
    matchDays: new Set(tournamentGames.map((game) => game.date)).size,
    leaders: [...table].sort((a, b) => b[1] - a[1]) as [string, number][],
  };
}

export function prematchFacts(
  games: Game[],
  teamA: string[],
  teamB: string[],
  stats: PlayerStat[],
  rules: FactRule[],
  globalGames: Game[] = games,
  selectedTournament?: string,
  separatedLeaders: string[] = [],
): PrematchFact[] {
  const enabled = new Set(rules.map((rule) => rule.code));
  const title = (code: string) => rules.find((rule) => rule.code === code)?.title ?? code;
  const facts: PrematchFact[] = [];
  const verified = globalGames.filter((game) => game.status === 'verified').sort((a, b) => a.date.localeCompare(b.date));
  const competitionGames = games.filter((game) => game.status === 'verified').sort((a, b) => a.date.localeCompare(b.date));
  const currentTournament = selectedTournament || [...competitionGames].reverse().find((game) => game.tournament)?.tournament;

  if (currentTournament) {
    const tournamentGames = competitionGames.filter((game) => game.tournament === currentTournament);
    const tournamentForm = [...teamA, ...teamB].map((name) => {
      const results = tournamentGames.filter((game) => inTeam(game, name)).map((game) => resultFor(game, name)).filter(Boolean);
      return { name, results, wins: results.filter((result) => result === 'W').length, losses: results.filter((result) => result === 'L').length };
    }).filter((item) => item.results.length >= 3);
    const unbeaten = tournamentForm.filter((item) => item.losses === 0).sort((a, b) => b.results.length - a.results.length)[0];
    if (enabled.has('tournament_unbeaten') && unbeaten)
      facts.push({ code: 'tournament_unbeaten', title: title('tournament_unbeaten'), scope: 'competition', text: `${unbeaten.name} sigue invicto en ${currentTournament} después de ${unbeaten.results.length} partidos.` });
    const winless = tournamentForm.filter((item) => item.wins === 0).sort((a, b) => b.results.length - a.results.length)[0];
    if (enabled.has('tournament_winless') && winless)
      facts.push({ code: 'tournament_winless', title: title('tournament_winless'), scope: 'competition', text: `${winless.name} todavía no ganó en ${currentTournament} tras ${winless.results.length} partidos. Este puede ser el día de cortar la espera.` });
    if (enabled.has('leader_clash')) {
      const tournamentState = currentTournamentLeaders(tournamentGames);
      const leaders = tournamentState.leaders.filter(([name]) => separatedLeaders.includes(name)).slice(0, 2);
      if (leaders.length === 2 && inProposedOppositeTeams(leaders[0][0], leaders[1][0], teamA, teamB))
        facts.push({ code: 'leader_clash', title: title('leader_clash'), scope: 'competition', text: `${leaders[0][0]} (${leaders[0][1]} pts) y ${leaders[1][0]} (${leaders[1][1]} pts), los dos primeros de ${currentTournament}, quedaron enfrentados directamente.` });
    }
  }

  const appearances = new Map<string, number>();
  verified.forEach((game) => [...game.team1, ...game.team2].forEach((name) => appearances.set(name, (appearances.get(name) ?? 0) + 1)));
  const competitionAppearances = new Map<string, number>();
  competitionGames.forEach((game) => [...game.team1, ...game.team2].forEach((name) => competitionAppearances.set(name, (competitionAppearances.get(name) ?? 0) + 1)));
  if (enabled.has('team_experience')) {
    const totalA = teamA.reduce((sum, name) => sum + (appearances.get(name) ?? 0), 0);
    const totalB = teamB.reduce((sum, name) => sum + (appearances.get(name) ?? 0), 0);
    const bigger = Math.max(totalA, totalB), gap = Math.abs(totalA - totalB);
    if (bigger && gap / bigger >= 0.1) {
      const experienced = totalA > totalB ? 'Celeste' : 'Rosa';
      facts.push({ code: 'team_experience', title: title('team_experience'), scope: 'global', text: `${experienced} reúne más experiencia histórica: ${Math.max(totalA, totalB)} participaciones acumuladas contra ${Math.min(totalA, totalB)}.` });
    }
  }

  if (enabled.has('comeback')) {
    const reference = new Date().toISOString().slice(0, 10);
    const returns = [...teamA, ...teamB].map((name) => {
      const dates = verified.filter((game) => inTeam(game, name)).map((game) => game.date);
      const last = dates.at(-1);
      const days = last ? Math.floor((Date.parse(`${reference}T00:00:00Z`) - Date.parse(`${last}T00:00:00Z`)) / 86400000) : Infinity;
      return { name, played: dates.length, last, days };
    }).filter((item) => item.played === 0 || item.days >= 30).sort((a, b) => b.days - a.days)[0];
    if (returns) facts.push({ code: 'comeback', title: title('comeback'), scope: 'global', text: returns.played === 0
      ? `${returns.name} puede hacer su debut en el historial registrado.`
      : `${returns.name} vuelve después de ${returns.days} días sin jugar; su último partido fue el ${new Date(`${returns.last}T00:00:00`).toLocaleDateString('es-ES')}.` });
  }

  if (enabled.has('century_watch')) {
    const century = [...teamA, ...teamB].map((name) => ({ name, played: competitionAppearances.get(name) ?? 0 })).find((item) => item.played === 99);
    if (century) facts.push({ code: 'century_watch', title: title('century_watch'), scope: 'competition', text: `${century.name} disputará su partido número 100 si juega esta propuesta.` });
  }

  if (enabled.has('achievement_watch')) {
    const thresholds = {
      winning: [5, 7, 10], unbeaten: [5, 8, 12, 15], veteran: [60, 100], partnership: [10, 20, 30], nemesis: [5, 7, 10],
    };
    const proposed = [...teamA, ...teamB];
    const opportunities: string[] = [];
    for (const name of proposed) {
      const played = competitionAppearances.get(name) ?? 0;
      if (thresholds.veteran.includes(played + 1)) {
        const patch = played + 1 === 60 ? 'Veterano' : 'Centenario';
        opportunities.push(`${name} desbloqueará ${patch} si juega: alcanzará ${played + 1} partidos en esta competencia.`);
      }
      const results = competitionGames.filter((game) => inTeam(game, name)).map((game) => resultFor(game, name)).filter(Boolean).reverse();
      const currentWins = results.findIndex((result) => result !== 'W');
      const winStreak = currentWins === -1 ? results.length : currentWins;
      if (thresholds.winning.includes(winStreak + 1)) {
        opportunities.push(`${name} puede desbloquear o mejorar Racha ganadora si gana: llegaría a ${winStreak + 1} victorias consecutivas.`);
      }
      const firstLoss = results.findIndex((result) => result === 'L');
      const unbeatenStreak = firstLoss === -1 ? results.length : firstLoss;
      if (thresholds.unbeaten.includes(unbeatenStreak + 1)) {
        opportunities.push(`${name} puede desbloquear o mejorar Invicto si gana o empata: llegaría a ${unbeatenStreak + 1} partidos sin perder. Una derrota cortaría la racha.`);
      }
    }
    for (const team of [teamA, teamB]) {
      for (let index = 0; index < team.length; index++) for (const partner of team.slice(index + 1)) {
        const first = team[index];
        const winsTogether = competitionGames.filter((game) =>
          inTeam(game, first) && inTeam(game, first) === inTeam(game, partner) && resultFor(game, first) === 'W'
        ).length;
        if (thresholds.partnership.includes(winsTogether + 1)) {
          opportunities.push(`${first} y ${partner} pueden desbloquear o mejorar Sociedad si ganan juntos: llegarían a ${winsTogether + 1} victorias como dupla.`);
        }
      }
    }
    for (const first of teamA) for (const rival of teamB) {
      const meetings = competitionGames.filter((game) => inTeam(game, first) && inTeam(game, rival) && inTeam(game, first) !== inTeam(game, rival));
      const firstWins = meetings.filter((game) => resultFor(game, first) === 'W').length;
      const rivalWins = meetings.filter((game) => resultFor(game, rival) === 'W').length;
      if (thresholds.nemesis.includes(firstWins + 1)) opportunities.push(`${first} puede desbloquear o mejorar Bestia negra ante ${rival} si gana: sería su victoria número ${firstWins + 1}.`);
      if (thresholds.nemesis.includes(rivalWins + 1)) opportunities.push(`${rival} puede desbloquear o mejorar Bestia negra ante ${first} si gana: sería su victoria número ${rivalWins + 1}.`);
    }
    if (opportunities.length) facts.push({ code: 'achievement_watch', title: title('achievement_watch'), scope: 'competition', text: opportunities[0] });
  }

  if (enabled.has('hot_pair')) {
    const proposedTeams = [teamA, teamB];
    const hot = proposedTeams.flatMap((team) => team.flatMap((first, index) => team.slice(index + 1).map((second) => {
      const together = verified.filter((game) => inTeam(game, first) && inTeam(game, first) === inTeam(game, second));
      const latest = together.slice(-3);
      return { first, second, games: together.length, hot: latest.length === 3 && latest.every((game) => resultFor(game, first) === 'W') };
    }))).filter((pair) => pair.hot).sort((a, b) => b.games - a.games)[0];
    if (hot) facts.push({ code: 'hot_pair', title: title('hot_pair'), scope: 'global', text: `${hot.first} y ${hot.second} ganaron juntos sus últimos 3 partidos compartidos.` });
  }

  const rivalries = teamA.flatMap((a) => teamB.map((b) => {
    const meetings = verified.filter((game) => inTeam(game, a) && inTeam(game, b) && inTeam(game, a) !== inTeam(game, b));
    const wins = meetings.filter((game) => resultFor(game, a) === 'W').length;
    const losses = meetings.filter((game) => resultFor(game, a) === 'L').length;
    return { a, b, meetings, wins, losses };
  })).sort((a, b) => b.meetings.length - a.meetings.length);

  const rivalry = rivalries[0];
  if (enabled.has('classic_rivalry') && rivalry && rivalry.meetings.length >= 3)
    facts.push({ code: 'classic_rivalry', title: title('classic_rivalry'), scope: 'global', text: `${rivalry.a} y ${rivalry.b} se enfrentaron ${rivalry.meetings.length} veces: ${rivalry.wins} victorias para ${rivalry.a}, ${rivalry.losses} para ${rivalry.b} y ${rivalry.meetings.length - rivalry.wins - rivalry.losses} empates.` });

  if (enabled.has('nemesis')) {
    const dominant = rivalries.find((item) => item.meetings.length >= 5 && Math.max(item.wins, item.losses) / item.meetings.length >= 0.7);
    if (dominant) {
      const beast = dominant.wins > dominant.losses ? dominant.a : dominant.b;
      const victim = dominant.wins > dominant.losses ? dominant.b : dominant.a;
      facts.push({ code: 'nemesis', title: title('nemesis'), scope: 'global', text: `${beast} es la bestia negra de ${victim}: ganó ${Math.max(dominant.wins, dominant.losses)} de sus ${dominant.meetings.length} enfrentamientos registrados.` });
    }
  }

  if (enabled.has('long_wait')) {
    const debt = rivalries.find((item) => item.meetings.length >= 3 && (item.wins === 0 || item.losses === 0));
    if (debt) {
      const waiting = debt.wins === 0 ? debt.a : debt.b, rival = debt.wins === 0 ? debt.b : debt.a;
      facts.push({ code: 'long_wait', title: title('long_wait'), scope: 'global', text: `${waiting} todavía no logró ganarle a ${rival} en ${debt.meetings.length} enfrentamientos registrados.` });
    }
  }

  if (enabled.has('current_streak')) {
    const streaks = [...teamA, ...teamB].map((name) => {
      const results = verified.filter((game) => inTeam(game, name)).map((game) => resultFor(game, name)).filter(Boolean).reverse();
      const result = results[0], count = result ? results.findIndex((value) => value !== result) : 0;
      return { name, result, count: count === -1 ? results.length : count };
    }).filter((item) => (item.result === 'W' || item.result === 'L') && item.count >= 3).sort((a, b) => b.count - a.count)[0];
    if (streaks) facts.push({ code: 'current_streak', title: title('current_streak'), scope: 'global', text: `${streaks.name} llega con ${streaks.count} ${streaks.result === 'W' ? 'victorias' : 'derrotas'} consecutivas. Este partido puede ${streaks.result === 'W' ? 'estirar' : 'cortar'} la racha.` });
  }

  if (enabled.has('unbeaten_run')) {
    const unbeaten = [...teamA, ...teamB].map((name) => {
      const results = verified.filter((game) => inTeam(game, name)).map((game) => resultFor(game, name)).filter(Boolean).reverse();
      const firstLoss = results.findIndex((result) => result === 'L');
      return { name, count: firstLoss === -1 ? results.length : firstLoss };
    }).filter((item) => item.count >= 3).sort((a, b) => b.count - a.count)[0];
    if (unbeaten) facts.push({ code: 'unbeaten_run', title: title('unbeaten_run'), scope: 'global', text: `${unbeaten.name} lleva ${unbeaten.count} partidos invicto entre todas las competiciones registradas.` });
  }

  if (enabled.has('streak_record')) {
    const candidate = [...teamA, ...teamB].map((name) => {
      const results = verified.filter((game) => inTeam(game, name)).map((game) => ({ result: resultFor(game, name), date: game.date })).filter((item) => item.result);
      const currentResult = results.at(-1)?.result;
      const reverseBreak = [...results].reverse().findIndex((item) => item.result !== currentResult);
      const currentCount = reverseBreak === -1 ? results.length : reverseBreak;
      const previous = results.slice(0, Math.max(0, results.length - currentCount));
      const runs: { count: number; start: string; end: string }[] = [];
      let start = '', end = '', count = 0;
      previous.forEach((item) => {
        if (item.result === currentResult) {
          if (!count) start = item.date;
          end = item.date;
          count++;
        } else if (count) {
          runs.push({ count, start, end });
          start = ''; end = ''; count = 0;
        }
      });
      if (count) runs.push({ count, start, end });
      const previousBest = Math.max(0, ...runs.map((run) => run.count));
      const previousOccurrence = [...runs].reverse().find((run) => run.count === previousBest);
      return { name, result: currentResult, current: currentCount, previousBest, previousOccurrence };
    }).filter((item) => (item.result === 'W' || item.result === 'L') && item.previousBest >= 2 && item.current >= item.previousBest);
    const record = candidate.sort((a, b) => b.current - a.current)[0];
    if (record) {
      const occurrence = record.previousOccurrence!;
      const dates = occurrence.start === occurrence.end
        ? new Date(`${occurrence.start}T00:00:00`).toLocaleDateString('es-ES')
        : `el ${new Date(`${occurrence.start}T00:00:00`).toLocaleDateString('es-ES')} y el ${new Date(`${occurrence.end}T00:00:00`).toLocaleDateString('es-ES')}`;
      facts.push({ code: 'streak_record', title: title('streak_record'), scope: 'global', text: record.current > record.previousBest
        ? `${record.name} acaba de romper su récord personal de ${record.result === 'W' ? 'victorias' : 'derrotas'} consecutivas: lleva ${record.current}. Su marca anterior era de ${record.previousBest}, conseguida entre ${dates}.`
        : `${record.name} igualó su récord personal de ${record.current} ${record.result === 'W' ? 'victorias' : 'derrotas'} consecutivas. La última vez lo consiguió entre ${dates}; el próximo resultado puede romper la marca.` });
    }
  }

  if (enabled.has('standings_overtake')) {
    const points = new Map(stats.map((row) => [row.name, row.wins * 3 + row.draws]));
    const duel = teamA.flatMap((a) => teamB.map((b) => ({ a, b, pa: points.get(a) ?? 0, pb: points.get(b) ?? 0 })))
      .filter((item) => item.pa !== item.pb && Math.abs(item.pa - item.pb) <= 3)
      .sort((a, b) => Math.abs(a.pa - a.pb) - Math.abs(b.pa - b.pb))[0];
    if (duel) {
      const chasing = duel.pa < duel.pb ? duel.a : duel.b, leader = duel.pa < duel.pb ? duel.b : duel.a;
      facts.push({ code: 'standings_overtake', title: title('standings_overtake'), scope: 'competition', text: `${chasing} está a ${Math.abs(duel.pa - duel.pb)} punto${Math.abs(duel.pa - duel.pb) === 1 ? '' : 's'} de ${leader}. Una victoria puede cambiar su orden en la tabla de esta competición.` });
    }
  }
  const consolidated = facts.filter((fact) => {
    const player = [...teamA, ...teamB].find((name) => fact.text.startsWith(`${name} `));
    if (!player) return true;
    const samePlayer = (code: string) => facts.some((candidate) =>
      candidate.code === code && candidate.text.startsWith(`${player} `),
    );
    if (fact.code === 'current_streak' && samePlayer('streak_record')) return false;
    if (fact.code === 'unbeaten_run') {
      const strongerWinningFact = facts.some((candidate) =>
        ['current_streak', 'streak_record'].includes(candidate.code) &&
        candidate.text.startsWith(`${player} `) &&
        candidate.text.includes('victoria'),
      );
      if (strongerWinningFact) return false;
    }
    return true;
  });
  return consolidated
    .sort((a, b) => (rules.find((rule) => rule.code === a.code)?.priority ?? 999) - (rules.find((rule) => rule.code === b.code)?.priority ?? 999))
    .slice(0, 8);
}

function inProposedOppositeTeams(a: string, b: string, teamA: string[], teamB: string[]) {
  return (teamA.includes(a) && teamB.includes(b)) || (teamA.includes(b) && teamB.includes(a));
}
