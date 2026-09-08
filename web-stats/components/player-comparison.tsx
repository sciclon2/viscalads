'use client';

import { useMemo, useState } from 'react';
import { ArrowLeftRight, Trophy } from 'lucide-react';
import { PlayerAvatar } from '@/components/player-avatar';
import { PrimeMomentBadge, RockBottomBadge } from '@/components/prime-moment-badge';
import { compareSharedHistory } from '@/lib/player-comparison';
import { ratingRangePosition } from '@/lib/player-rating';
import type { CompetitionStats, Game, PlayerStat, Profile } from '@/lib/stats-context';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

type Tournament = CompetitionStats['tournamentEditions'][number];

function points(stat?: PlayerStat) { return stat ? stat.wins * 3 + stat.draws : 0; }
function effectiveness(stat?: PlayerStat) { return stat?.played ? Math.round(points(stat) / (stat.played * 3) * 100) : 0; }
function winRate(stat?: PlayerStat) { return stat?.played ? Math.round(stat.wins / stat.played * 100) : 0; }

export function PlayerComparison({ profiles, stats, games, tournaments }: {
  profiles: Profile[];
  stats: PlayerStat[];
  games: Game[];
  tournaments: Tournament[];
}) {
  const ordered = useMemo(() => [...profiles].sort((a, b) => a.name.localeCompare(b.name)), [profiles]);
  const [open, setOpen] = useState(false);
  const [first, setFirst] = useState('');
  const [second, setSecond] = useState('');
  const a = ordered.find((player) => player.name === first);
  const b = ordered.find((player) => player.name === second);
  const statA = stats.find((row) => row.name === first);
  const statB = stats.find((row) => row.name === second);
  const shared = a && b ? compareSharedHistory(a.name, b.name, games) : null;
  const titles = (name: string) => tournaments.filter((item) => item.champions.includes(name));
  const changeOpen = (value: boolean) => {
    setOpen(value);
    if (!value) {
      setFirst('');
      setSecond('');
    }
  };

  return (
    <>
      <button type="button" onClick={() => changeOpen(true)} className="players-compare-button">
        <ArrowLeftRight /> Comparar jugadores
      </button>
      <Dialog open={open} onOpenChange={changeOpen}>
        <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-3xl">Comparar jugadores</DialogTitle>
            <DialogDescription>Nivel, momento, historial y enfrentamientos en esta competición.</DialogDescription>
          </DialogHeader>
          <div className="comparison-selectors">
            <select value={first} onChange={(event) => setFirst(event.target.value)} aria-label="Primer jugador">
              <option value="">Elegí el primer jugador</option>
              {ordered.filter((player) => player.name !== second).map((player) => <option key={player.id} value={player.name}>{player.name}</option>)}
            </select>
            <ArrowLeftRight />
            <select value={second} onChange={(event) => setSecond(event.target.value)} aria-label="Segundo jugador">
              <option value="">Elegí el segundo jugador</option>
              {ordered.filter((player) => player.name !== first).map((player) => <option key={player.id} value={player.name}>{player.name}</option>)}
            </select>
          </div>
          {a && b ? (
            <div className="comparison-body">
              <div className="comparison-heads">
                {[a, b].map((player) => (
                  <div key={player.id}>
                    <PlayerAvatar name={player.name} className="size-16" />
                    <strong>{player.name}</strong>
                    <span><PrimeMomentBadge rating={player.rating} /><RockBottomBadge rating={player.rating} /></span>
                  </div>
                ))}
              </div>
              <div className="comparison-charts">
                <h3>Comparación visual</h3>
                <ComparisonBar label="Nivel actual" a={a.rating?.current ?? 0} b={b.rating?.current ?? 0} max={10} aText={a.rating?.current.toFixed(2) ?? '—'} bText={b.rating?.current.toFixed(2) ?? '—'} />
                <ComparisonBar label="Momento personal" a={ratingRangePosition(a.rating) * 100} b={ratingRangePosition(b.rating) * 100} max={100} aText={`${Math.round(ratingRangePosition(a.rating) * 100)}%`} bText={`${Math.round(ratingRangePosition(b.rating) * 100)}%`} />
                <ComparisonBar label="Efectividad" a={effectiveness(statA)} b={effectiveness(statB)} max={100} aText={`${effectiveness(statA)}%`} bText={`${effectiveness(statB)}%`} />
                <ComparisonBar label="Victorias" a={winRate(statA)} b={winRate(statB)} max={100} aText={`${winRate(statA)}%`} bText={`${winRate(statB)}%`} />
              </div>
              <div className="comparison-table">
                <CompareRow label="Nivel actual" a={a.rating ? `${a.rating.current.toFixed(2)} (${a.rating.min}–${a.rating.max})` : '—'} b={b.rating ? `${b.rating.current.toFixed(2)} (${b.rating.min}–${b.rating.max})` : '—'} />
                <CompareRow label="Posición principal" a={a.primary || 'Pendiente'} b={b.primary || 'Pendiente'} />
                <CompareRow label="Posición alternativa" a={a.alternate || '—'} b={b.alternate || '—'} />
                <CompareRow label="Partidos" a={statA?.played ?? 0} b={statB?.played ?? 0} />
                <CompareRow label="Victorias" a={statA?.wins ?? 0} b={statB?.wins ?? 0} />
                <CompareRow label="Empates" a={statA?.draws ?? 0} b={statB?.draws ?? 0} />
                <CompareRow label="Derrotas" a={statA?.losses ?? 0} b={statB?.losses ?? 0} />
                <CompareRow label="Puntos" a={points(statA)} b={points(statB)} />
                <CompareRow label="Torneos ganados" a={titles(a.name).length} b={titles(b.name).length} />
              </div>
              <div className="comparison-shared">
                <article><strong>Jugando juntos</strong><b>{shared?.together.played ?? 0} partidos</b><span>{shared?.together.wins ?? 0} G · {shared?.together.draws ?? 0} E · {shared?.together.losses ?? 0} P</span></article>
                <article><strong>Enfrentamientos</strong><b>{shared?.rivals.played ?? 0} partidos</b><span>{a.name}: {shared?.rivals.playerAWins ?? 0} victorias · Empates: {shared?.rivals.draws ?? 0} · {b.name}: {shared?.rivals.playerBWins ?? 0} victorias</span></article>
                <article><strong>Títulos</strong><span>{titles(a.name).map((item) => item.displayName).join(', ') || `${a.name}: ninguno`}</span><span>{titles(b.name).map((item) => item.displayName).join(', ') || `${b.name}: ninguno`}</span><Trophy /></article>
              </div>
            </div>
          ) : <p className="comparison-empty">Elegí dos jugadores para ver la comparación.</p>}
        </DialogContent>
      </Dialog>
    </>
  );
}

function CompareRow({ label, a, b }: { label: string; a: string | number; b: string | number }) {
  return <div><strong>{a}</strong><span>{label}</span><strong>{b}</strong></div>;
}

function ComparisonBar({ label, a, b, max, aText, bText }: { label: string; a: number; b: number; max: number; aText: string; bText: string }) {
  const width = (value: number) => `${Math.max(0, Math.min(100, value / max * 100))}%`;
  return (
    <div className="comparison-chart-row">
      <strong>{label}</strong>
      <div className="comparison-chart-pair">
        <div><span style={{ width: width(a) }} /><b>{aText}</b></div>
        <div><span style={{ width: width(b) }} /><b>{bText}</b></div>
      </div>
    </div>
  );
}
