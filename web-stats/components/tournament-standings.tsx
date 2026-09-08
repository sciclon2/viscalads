'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, Trophy } from 'lucide-react';
import type { CompetitionStats } from '@/lib/stats-context';
import { PlayerName } from '@/components/player-avatar';

type Tournament = CompetitionStats['tournamentEditions'][number];

export function TournamentStandings({ tournaments }: { tournaments: Tournament[] }) {
  const ordered = useMemo(() => [...tournaments].sort((a, b) =>
    (b.startsOn ?? '').localeCompare(a.startsOn ?? '') || b.id - a.id,
  ), [tournaments]);
  const [selectedId, setSelectedId] = useState<number>(() => ordered[0]?.id ?? 0);
  const tournament = ordered.find((item) => item.id === selectedId) ?? ordered[0];
  if (!tournament) return <p>No hay torneos disponibles.</p>;
  const closed = Boolean(tournament.endsOn && tournament.endsOn < new Date().toISOString().slice(0, 10));
  return (
    <div className="standings-section">
      <div className="standings-toolbar">
        <label>Elegir torneo
          <select value={tournament.id} onChange={(event) => setSelectedId(Number(event.target.value))}>
            {ordered.map((item) => <option key={item.id} value={item.id}>{item.displayName}</option>)}
          </select>
        </label>
        <div className={tournament.rules.length ? 'standings-rule active' : 'standings-rule'}>
          <AlertTriangle />
          <span><strong>Reglas de esta edición</strong>{tournament.rules.length ? tournament.rules.map((rule) => rule.description).join(' · ') : 'Sin reglas especiales'}</span>
        </div>
      </div>
      <div className="standings-table-wrap">
        <table className="standings-table">
          <thead><tr><th>#</th><th>Jugador</th><th>PJ</th><th>G</th><th>E</th><th>P</th><th>Goles</th><th title="Partidos que generaron puntos extra">Part. +</th><th title="Total de puntos extra">Pts. +</th><th title="Partidos que generaron puntos negativos">Part. −</th><th title="Total de puntos descontados">Pts. −</th><th>Pts. base</th><th>Total</th></tr></thead>
          <tbody>
            {tournament.standings.map((row, index) => (
              <tr key={row.playerId}>
                <td>{closed && tournament.champions.includes(row.name) ? <Trophy className="standings-leader" /> : index + 1}</td>
                <td><PlayerName name={row.name} /></td>
                <td>{row.played}</td><td>{row.wins}</td><td>{row.draws}</td><td>{row.losses}</td><td>{row.goals}</td>
                <td>{row.bonusMatches}</td><td>{row.positivePoints}</td>
                <td className={row.penalizedMatches ? 'negative' : ''}>{row.penalizedMatches}</td>
                <td className={row.negativePoints ? 'negative' : ''}>{row.negativePoints}</td>
                <td>{row.basePoints}</td><td className="standings-total">{row.totalPoints}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!tournament.standings.length && <p className="standings-empty">Este torneo todavía no tiene partidos verificados.</p>}
      </div>
      <p className="standings-note">Los goles corresponden solamente a autores registrados. Los bonus y las penalizaciones requieren marcador exacto y solo afectan esta tabla.</p>
    </div>
  );
}
