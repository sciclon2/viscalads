'use client';

import { useMemo, useState } from 'react';
import { CalendarDays, ChevronRight, Plus, Trophy } from 'lucide-react';
import { API } from '@/components/site-client';
import type { CompetitionStats, Game } from '@/lib/stats-context';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type Tournament = CompetitionStats['tournamentEditions'][number];

function dateLabel(value: string | null) {
  if (!value) return 'Sin fecha';
  return new Date(`${value}T00:00:00`).toLocaleDateString('es-ES');
}

export function TournamentsSection({
  competition,
  tournaments,
  games,
  onSaved,
}: {
  competition: string;
  tournaments: Tournament[];
  games: Game[];
  onSaved: () => Promise<void>;
}) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [startsOn, setStartsOn] = useState('');
  const [matchdayCount, setMatchdayCount] = useState('10');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<Tournament | null>(null);
  const today = new Date().toISOString().slice(0, 10);
  const currentId = useMemo(
    () => tournaments.find((item) => !item.endsOn || item.endsOn >= today)?.id,
    [tournaments, today],
  );
  const newestFirst = useMemo(
    () => [...tournaments].sort((a, b) =>
      (b.startsOn ?? '').localeCompare(a.startsOn ?? '') || b.id - a.id,
    ),
    [tournaments],
  );
  const nextTournamentName = useMemo(() => {
    const lastNumber = tournaments.reduce((maximum, item) => {
      const match = item.displayName.match(/^T(?:orneo\s*)?(\d+)/i);
      return Math.max(maximum, match ? Number(match[1]) : 0);
    }, 0);
    return `T${lastNumber + 1}`;
  }, [tournaments]);

  const save = async (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      const response = await fetch(`${API}/tournaments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ competition, displayName: name, startsOn, matchdayCount: Number(matchdayCount) }),
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error || 'No se pudo crear el torneo');
      await onSaved();
      setName('');
      setStartsOn('');
      setMatchdayCount('10');
      setCreating(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo crear el torneo');
    } finally {
      setSaving(false);
    }
  };

  if (creating) {
    return (
      <form onSubmit={save} className="mx-auto max-w-2xl rounded-2xl border border-[#173d2a]/15 bg-white p-5 shadow-sm">
        <h2 className="font-display text-2xl">Nuevo torneo</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Se creará solamente dentro de {competition === 'sarria' ? 'Sarrià' : 'Bogatell'}.
        </p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="sm:col-span-2 text-sm font-bold">Nombre
            <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Torneo 11" className="mt-1 h-11 w-full rounded-md border bg-white px-3 font-normal" />
          </label>
          <label className="text-sm font-bold">Fecha de inicio
            <input required type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} className="mt-1 h-11 w-full rounded-md border bg-white px-3 font-normal" />
          </label>
          <label className="text-sm font-bold">Cantidad de fechas
            <input required type="number" min="1" max="100" value={matchdayCount} onChange={(e) => setMatchdayCount(e.target.value)} className="mt-1 h-11 w-full rounded-md border bg-white px-3 font-normal" />
          </label>
        </div>
        {message && <p role="alert" className="mt-4 text-sm font-bold text-[#c33f2a]">{message}</p>}
        <div className="mt-5 flex justify-end gap-3">
          <button type="button" onClick={() => { setCreating(false); setMessage(''); }} className="h-10 rounded-md border px-4 text-sm font-bold">Cancelar</button>
          <button disabled={saving} className="h-10 rounded-md bg-[#173d2a] px-4 text-sm font-bold text-white disabled:opacity-50">{saving ? 'Creando…' : 'Crear torneo'}</button>
        </div>
      </form>
    );
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-muted-foreground">Cada edición conserva sus partidos y campeones. Las estadísticas siguen separadas por competencia.</p>
        <button type="button" onClick={() => { setName(nextTournamentName); setCreating(true); }} className="inline-flex h-10 items-center gap-2 rounded-md bg-[#173d2a] px-4 text-sm font-bold text-white"><Plus className="size-4" />Crear torneo</button>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {newestFirst.map((item) => {
          const status = item.id === currentId ? 'Actual' : item.startsOn && item.startsOn > today ? 'Próximo' : 'Histórico';
          return (
            <button
              type="button"
              key={item.id}
              onClick={() => setSelected(item)}
              className="rounded-2xl border border-[#173d2a]/15 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#347a52]/50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#347a52]"
              aria-label={`Ver partidos de ${item.displayName}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div><p className="text-xs font-bold uppercase tracking-[.16em] text-[#347a52]">{status}</p><h2 className="mt-1 font-display text-2xl">{item.displayName}</h2></div>
                <Trophy className="size-6 text-[#d19a20]" />
              </div>
              <p className="mt-4 flex items-center gap-2 text-sm"><CalendarDays className="size-4" />{dateLabel(item.startsOn)} — {dateLabel(item.endsOn)}</p>
              <p className="mt-2 text-sm"><strong>{item.matchdayCount}</strong> fechas · <strong>{item.matchCount}</strong> partidos registrados</p>
              <p className="mt-3 border-t pt-3 text-sm"><strong>Campeón:</strong> {item.champions.length ? item.champions.join(', ') : 'Sin campeón registrado'}</p>
              <span className="mt-4 flex items-center justify-end gap-1 text-xs font-bold uppercase tracking-[.12em] text-[#347a52]">Ver partidos <ChevronRight className="size-4" /></span>
            </button>
          );
        })}
      </div>
      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-h-[88vh] max-w-4xl overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display text-3xl">{selected.displayName}</DialogTitle>
                <DialogDescription>
                  {selected.matchCount} partidos · {dateLabel(selected.startsOn)} — {dateLabel(selected.endsOn)}
                </DialogDescription>
              </DialogHeader>
              <div className="mt-3 space-y-3">
                {games
                  .filter((game) => game.tournament === selected.displayName)
                  .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id)
                  .map((game) => {
                    const result = game.score1 !== null && game.score2 !== null
                      ? `${game.score1} – ${game.score2}`
                      : game.outcome === 'D'
                        ? 'Empate'
                        : game.outcome === '1'
                          ? 'Ganó equipo 1'
                          : game.outcome === '2'
                            ? 'Ganó equipo 2'
                            : 'Resultado pendiente';
                    return (
                      <article key={game.id} className="rounded-xl border border-[#173d2a]/15 bg-[#fbfaf5] p-4">
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                          <strong>{dateLabel(game.date)}</strong>
                          <span className="rounded-full bg-[#173d2a] px-3 py-1 text-sm font-bold text-white">{result}</span>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
                          <div><p className="text-xs font-bold uppercase tracking-wider text-[#347a52]">Equipo 1</p><p className="mt-1 text-sm">{game.team1.join(', ')}</p></div>
                          <strong className="text-center text-[#e34f32]">VS</strong>
                          <div className="sm:text-right"><p className="text-xs font-bold uppercase tracking-wider text-[#347a52]">Equipo 2</p><p className="mt-1 text-sm">{game.team2.join(', ')}</p></div>
                        </div>
                      </article>
                    );
                  })}
                {!games.some((game) => game.tournament === selected.displayName) && (
                  <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Este torneo todavía no tiene partidos registrados.</p>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
