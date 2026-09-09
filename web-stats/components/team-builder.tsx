'use client';

import { useMemo, useState } from 'react';
import { ClipboardPaste, Flame, Plus, RefreshCw, Users, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PlayerAvatar } from '@/components/player-avatar';
import { PrimeMomentBadge, RockBottomBadge } from '@/components/prime-moment-badge';
import { PitchMarkings } from '@/components/pitch-markings';
import type { CompetitionStats, Game, PlayerStat, Profile } from '@/lib/stats-context';
import { API } from '@/components/site-client';
import { playerPositions } from '@/lib/player-options';
import {
  pitchPosition,
  positionRole as role,
  type Formation,
} from '@/lib/team-formation';
import { splitBalancedTeams, type BalancedTeams } from '@/lib/team-balancer';
import { currentTournamentLeaders, prematchFacts, type FactRule, type PrematchFact } from '@/lib/prematch-facts';
import { activityCutoff, hasRecentActivity } from '@/lib/player-activity';

type Player = Pick<
  Profile,
  'id' | 'name' | 'primary' | 'alternate' | 'rating'
> & {
  level: number;
  played: number;
  lastDate: string;
  guest?: boolean;
};
type TeamPair = BalancedTeams<Player>;
type ParsedLine = {
  raw: string;
  value: string;
  status: 'matched' | 'ambiguous' | 'unknown' | 'duplicate' | 'reserve' | 'excluded' | 'unconfirmed' | 'rotated_in' | 'rotated_out';
  playerId: number | null;
  player: string | null;
  candidates: Array<{ playerId: number; player: string; score: number }>;
  accepted: boolean;
  confirmed: boolean;
  slot: number | null;
  guestCount: number;
  consecutiveAppearances?: number;
  replacesPlayer?: string;
  replacedByPlayer?: string;
  tieBreakRandom?: boolean;
  rotationReason?: string;
};
type ParsedList = { items: ParsedLine[]; capacity: number | null; acceptedCount: number; waitingCount: number; rotationChanges: number; complete: boolean };

export function TeamBuilder({
  games,
  globalGames,
  competition,
  profiles,
  stats,
  funnyFactRules,
  tournaments,
}: {
  games: Game[];
  globalGames: Game[];
  competition: string;
  profiles: Profile[];
  stats: PlayerStat[];
  funnyFactRules: FactRule[];
  tournaments: CompetitionStats['tournamentEditions'];
}) {
  const validGames = useMemo(
    () =>
      games
        .filter((game) => game.status === 'verified')
        .sort((a, b) => a.date.localeCompare(b.date)),
    [games],
  );
  const profilePlayers = useMemo<Player[]>(
    () =>
      profiles
        .filter((p) => p.competitions.includes(competition))
        .map((profile) => {
          const history = validGames.filter(
            (game) =>
              game.team1.includes(profile.name) ||
              game.team2.includes(profile.name),
          );
          return {
            ...profile,
            level: profile.rating?.current ?? 5,
            played: history.length,
            lastDate: history.at(-1)?.date ?? '—',
          };
        })
        .sort((a, b) =>
          Number(hasRecentActivity(b.name, validGames, activityCutoff())) -
            Number(hasRecentActivity(a.name, validGames, activityCutoff())) ||
          a.name.localeCompare(b.name),
        ),
    [validGames, profiles, competition],
  );
  const currentTournament = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const ordered = [...tournaments].sort((a, b) =>
      (b.startsOn ?? '').localeCompare(a.startsOn ?? '') || b.id - a.id,
    );
    return ordered.find((item) =>
      (item.startsOn ?? '') <= today && (!item.endsOn || item.endsOn >= today),
    ) ?? ordered[0];
  }, [tournaments]);
  const [selectedTournament, setSelectedTournament] = useState(currentTournament?.displayName ?? '');
  const tournamentState = useMemo(
    () => currentTournamentLeaders(validGames.filter((game) => game.tournament === selectedTournament)),
    [validGames, selectedTournament],
  );
  const [guests, setGuests] = useState<Player[]>([]),
    [guestLevel, setGuestLevel] = useState('5'),
    [guestPosition, setGuestPosition] = useState(''),
    [selected, setSelected] = useState<string[]>([]),
    [search, setSearch] = useState(''),
    [teams, setTeams] = useState<TeamPair | null>(null),
    [facts, setFacts] = useState<PrematchFact[] | null>(null),
    [message, setMessage] = useState(''),
    [pasteOpen, setPasteOpen] = useState(false),
    [pastedList, setPastedList] = useState(''),
    [parsedList, setParsedList] = useState<ParsedList | null>(null),
    [capacityAnswer, setCapacityAnswer] = useState(''),
    [resolutions, setResolutions] = useState<Record<number, string>>({}),
    [parsing, setParsing] = useState(false),
    [savingLineup, setSavingLineup] = useState(false),
    [lineupSaved, setLineupSaved] = useState(false);
  const players = useMemo(
    () => [...profilePlayers, ...guests],
    [profilePlayers, guests],
  );
  const selectedPlayers = selected
    .map((name) => players.find((p) => p.name === name)!)
    .filter(Boolean);
  const visible = players.filter(
    (p) =>
      !selected.includes(p.name) &&
      p.name.toLowerCase().includes(search.toLowerCase()),
  );
  const toggle = (name: string) => {
    setSelected((current) =>
      current.includes(name)
        ? current.filter((p) => p !== name)
        : [...current, name],
    );
    setTeams(null);
    setFacts(null);
    setLineupSaved(false);
    setMessage('');
  };
  const addGuest = () => {
    const level = Number(guestLevel.replace(',', '.'));
    if (!Number.isFinite(level) || level < 1 || level > 10) {
      setMessage('El nivel del invitado debe estar entre 1 y 10.');
      return;
    }
    const used = new Set(guests.map((guest) => guest.name));
    let number = 1;
    while (used.has(`Invitado ${number}`)) number++;
    const guest: Player = {
      id: -Date.now() - number,
      name: `Invitado ${number}`,
      primary: guestPosition,
      alternate: '',
      rating: null,
      achievements: [],
      level,
      played: 0,
      lastDate: '—',
      guest: true,
    };
    setGuests((current) => [...current, guest]);
    setSelected((current) => [...current, guest.name]);
    setGuestPosition('');
    setMessage('');
    setTeams(null);
    setFacts(null);
  };
  const parseList = async (declaredCapacity?: number) => {
    setParsing(true);
    setMessage('');
    try {
      const response = await fetch(`${API}/lineups/parse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          competition,
          text: declaredCapacity ? `Cupo ${declaredCapacity} jugadores\n${pastedList}` : pastedList,
        }),
      });
      const body = await response.json() as Partial<ParsedList> & { error?: string };
      if (!response.ok) throw new Error(body.error || 'No se pudo interpretar la lista');
      setParsedList({ items: body.items ?? [], capacity: body.capacity ?? null, acceptedCount: body.acceptedCount ?? 0, waitingCount: body.waitingCount ?? 0, rotationChanges: body.rotationChanges ?? 0, complete: body.complete ?? false });
      if (body.capacity) setCapacityAnswer('');
      setResolutions({});
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo interpretar la lista');
    } finally {
      setParsing(false);
    }
  };
  const useParsedList = () => {
    const names = parsedList?.items.flatMap((line, index) => {
      if (!line.accepted) return [];
      if ((line.status === 'matched' || line.status === 'rotated_in') && line.player) return [line.player];
      const choice = resolutions[index];
      return choice ? [choice] : [];
    }) ?? [];
    setSelected([...new Set(names)]);
    setTeams(null);
    setFacts(null);
    setMessage('');
    setPasteOpen(false);
  };
  const create = async () => {
    if (selected.length < 8) {
      setMessage('Seleccioná al menos 8 jugadores.');
      return;
    }
    if (selected.length % 2) {
      setMessage('La cantidad debe ser par para formar equipos iguales.');
      return;
    }
    const leaders = tournamentState.matchDays >= 3
      ? tournamentState.leaders.slice(0, 4).map(([name]) => name)
      : [];
    const result = splitBalancedTeams(selectedPlayers, validGames, { leaders });
    setTeams(result);
    setFacts(null);
    setMessage('');
    setLineupSaved(false);
    setSavingLineup(true);
    try {
      const response = await fetch(`${API}/lineups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({
          competition,
          teams: [
            result.a.map((item) => item.guest
              ? { guestName: item.name, level: item.level, position: item.primary }
              : { playerId: item.id }),
            result.b.map((item) => item.guest
              ? { guestName: item.name, level: item.level, position: item.primary }
              : { playerId: item.id }),
          ],
        }),
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error || 'No se pudo guardar la formación');
      setLineupSaved(true);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo guardar la formación');
    } finally {
      setSavingLineup(false);
    }
  };
  const average = (team: Player[]) =>
    team.reduce((n, p) => n + p.level, 0) / team.length;
  return (
    <div className="builder-shell">
      <section className="player-bank">
        <div className="builder-heading">
          <div>
            <span>Paso 1</span>
            <h3>Elegí la convocatoria</h3>
          </div>
          <strong>{selected.length} seleccionados</strong>
        </div>
        <button
          type="button"
          onClick={() => { setPasteOpen((open) => !open); setParsedList(null); setCapacityAnswer(''); setMessage(''); }}
          className="mb-3 flex w-full items-center justify-center gap-2 rounded-lg border border-[#173d2a]/20 bg-[#edf3e8] px-3 py-2 text-sm font-bold text-[#173d2a]"
        >
          <ClipboardPaste className="size-4" /> Pegar lista de WhatsApp
        </button>
        {pasteOpen && (
          <div className="mb-4 rounded-xl border border-[#173d2a]/15 bg-white p-3 shadow-sm">
            <label className="text-sm font-bold text-[#173d2a]">Lista de convocados
              <textarea value={pastedList} onChange={(event) => { setPastedList(event.target.value); setParsedList(null); }} placeholder={'6 a side\n1. Facu IN\n2. Mati IN\n…\nSuplentes\n13. Sergio IN'} className="mt-2 min-h-36 w-full rounded-lg border p-3 font-mono text-sm font-normal" />
            </label>
            <button type="button" disabled={parsing || !pastedList.trim()} onClick={() => void parseList()} className="mt-2 rounded-lg bg-[#173d2a] px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{parsing ? 'Analizando…' : 'Revisar lista'}</button>
            {parsedList && (
              <div className="mt-4 space-y-2">
                <p className="text-xs font-bold uppercase tracking-wider text-[#347a52]">Esto entendimos</p>
                <div className="rounded-lg bg-[#edf3e8] p-3 text-sm">
                  <strong>{parsedList.capacity ? `${parsedList.acceptedCount}/${parsedList.capacity} lugares confirmados` : `${parsedList.acceptedCount} confirmados · cupo no detectado`}</strong>
                  <span className="ml-2 text-muted-foreground">{parsedList.waitingCount ? `· ${parsedList.waitingCount} esperando como suplente` : ''}</span>
                  {parsedList.capacity && !parsedList.complete && <small className="mt-1 block text-[#a05722]">La convocatoria todavía no completa el cupo detectado.</small>}
                  {parsedList.rotationChanges > 0 && <small className="mt-1 block font-bold text-[#347a52]">Se aplicaron {parsedList.rotationChanges} cambio{parsedList.rotationChanges === 1 ? '' : 's'} por rotación.</small>}
                </div>
                {parsedList.capacity === null && (
                  <div className="rounded-lg border border-[#c47a16]/30 bg-[#fff7e8] p-3">
                    <label className="text-sm font-bold text-[#805014]">
                      No pudimos detectar el cupo. ¿Cuántos van a jugar?
                      <input
                        type="number"
                        min="2"
                        max="40"
                        inputMode="numeric"
                        value={capacityAnswer}
                        onChange={(event) => setCapacityAnswer(event.target.value)}
                        className="mt-2 h-10 w-full rounded-md border bg-white px-3 text-[#173d2a]"
                        placeholder="Ejemplo: 12"
                      />
                    </label>
                    <button
                      type="button"
                      disabled={!Number.isInteger(Number(capacityAnswer)) || Number(capacityAnswer) < 2 || Number(capacityAnswer) > 40 || parsing}
                      onClick={() => void parseList(Number(capacityAnswer))}
                      className="mt-2 rounded-lg bg-[#173d2a] px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                    >
                      Confirmar cupo y revisar
                    </button>
                  </div>
                )}
                {parsedList.items.map((line, index) => ({ line, index })).filter(({ line }) => line.confirmed).map(({ line, index }) => (
                  <div key={`${line.raw}-${index}`} className="grid gap-2 rounded-lg border p-2 text-sm sm:grid-cols-[1fr_1fr] sm:items-center">
                    <span><strong>{line.value}</strong><small className="block text-muted-foreground">{line.raw}</small></span>
                    {line.status === 'matched' ? <span className="font-bold text-[#347a52]">✓ {line.player} · {line.consecutiveAppearances ?? 0} PJ seguidos</span>
                      : line.status === 'rotated_in' ? <span className="font-bold text-[#347a52]">↥ Entra {line.player} ({line.consecutiveAppearances ?? 0} PJ) por {line.replacesPlayer}</span>
                        : line.status === 'rotated_out' ? <span className="font-bold text-[#b64936]">↧ Cede su lugar a {line.replacedByPlayer} · {line.consecutiveAppearances ?? 0} PJ seguidos</span>
                      : line.status === 'duplicate' ? <span className="font-bold text-[#c47a16]">Repetido: {line.player}</span>
                        : line.status === 'reserve' ? <span className="font-bold text-[#7c6a43]">Suplente: espera fuera del cupo{line.player ? ` · ${line.player}` : ''}</span>
                          : line.status === 'unconfirmed' ? <span className="font-bold text-muted-foreground">Sin IN: no quiere o no puede jugar; se descarta</span>
                          : line.status === 'excluded' ? <span className="font-bold text-[#b64936]">Marcado fuera: no se incluye</span>
                        : <select aria-label={`Resolver ${line.value}`} value={resolutions[index] ?? ''} onChange={(event) => setResolutions((current) => ({ ...current, [index]: event.target.value }))} className="h-10 rounded-md border bg-white px-2">
                            <option value="">{line.status === 'unknown' ? 'No incluir / elegir jugador…' : '¿Quién es?'}</option>
                            {(line.candidates.length ? line.candidates.map((candidate) => candidate.player) : profilePlayers.map((player) => player.name)).map((name) => <option key={name} value={name}>{name}</option>)}
                          </select>}
                  </div>
                ))}
                {parsedList.items.some((line) => line.guestCount > 0 && line.accepted) && <p className="rounded-lg border border-[#c47a16]/30 bg-[#fff7e8] p-2 text-xs text-[#805014]">La lista contiene “+1”. Esos lugares cuentan para el cupo, pero tendrás que agregar los invitados con nivel y posición antes de crear los equipos.</p>}
                {parsedList.items.filter((line) => line.status === 'rotated_in').map((line) => (
                  <p key={`rotation-${line.playerId}`} className="rounded-lg border border-[#347a52]/25 bg-[#edf3e8] p-2 text-xs text-[#173d2a]">
                    <strong>Por qué se hizo el cambio:</strong> {line.rotationReason}
                  </p>
                ))}
                <button type="button" disabled={parsedList.capacity === null} onClick={useParsedList} className="mt-2 w-full rounded-lg bg-[#e34f32] px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">Usar convocatoria propuesta</button>
              </div>
            )}
          </div>
        )}
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar jugador…"
          aria-label="Buscar jugador"
          className="mb-3 bg-white"
        />
        <div className="player-list">
          {visible.map((player) => (
            <button
              key={player.name}
              draggable
              onDragStart={(e) =>
                e.dataTransfer.setData('text/plain', player.name)
              }
              onClick={() => toggle(player.name)}
              className="player-card"
            >
              <PlayerAvatar name={player.name} className="size-10" />
              <span>
                <strong>{player.name} <PrimeMomentBadge rating={player.rating} compact /><RockBottomBadge rating={player.rating} compact /></strong>
                <small>
                  {player.primary || 'Flexible / sin posición'}
                  {player.alternate ? ` · alt. ${player.alternate}` : ''}
                </small>
              </span>
              <b
                title={
                  player.rating?.dynamic
                    ? `${player.rating.recentMatches} partidos válidos en ${player.rating.windowDays} días`
                    : `Nivel base: menos de 5 partidos en ${player.rating?.windowDays ?? 95} días`
                }
              >
                {player.level.toFixed(2)}
              </b>
            </button>
          ))}
        </div>
        <div className="guest-builder">
          <div>
            <strong>Agregar invitado</strong>
            <span>No guarda estadísticas</span>
          </div>
          <label>
            Nivel (obligatorio)
            <input
              inputMode="decimal"
              value={guestLevel}
              onChange={(event) => setGuestLevel(event.target.value)}
              placeholder="1–10"
            />
          </label>
          <label>
            Posición (opcional)
            <select
              value={guestPosition}
              onChange={(event) => setGuestPosition(event.target.value)}
            >
              <option value="">Flexible / sin definir</option>
              {playerPositions.map((position) => (
                <option key={position} value={position}>
                  {position}
                </option>
              ))}
            </select>
          </label>
          <button type="button" onClick={addGuest}>
            <Plus /> Agregar a la convocatoria
          </button>
        </div>
      </section>
      <section className="builder-work">
        <div className="builder-heading">
          <div>
            <span>Paso 2</span>
            <h3>{teams ? 'Equipos en cancha' : 'Lleválos a la cancha'}</h3>
          </div>
          {selected.length > 0 && (
            <button
              className="clear-selection"
              onClick={() => {
                setSelected([]);
                setTeams(null);
                setFacts(null);
                setGuests([]);
              }}
            >
              <RefreshCw className="size-4" />
              Limpiar
            </button>
          )}
        </div>
        <TeamPitch
          selected={selectedPlayers}
          teams={teams}
          onAdd={(name) => {
            if (!selected.includes(name)) toggle(name);
          }}
          onRemove={toggle}
        />
        <label className="mb-3 block rounded-xl border border-[#173d2a]/15 bg-white p-3 text-sm font-bold text-[#173d2a]">
          Torneo del partido que se va a jugar
          <select
            value={selectedTournament}
            onChange={(event) => { setSelectedTournament(event.target.value); setTeams(null); setFacts(null); setLineupSaved(false); }}
            className="mt-2 h-10 w-full rounded-md border bg-white px-3 font-normal"
          >
            {tournaments.map((item) => (
              <option key={item.id} value={item.displayName}>
                {item.displayName}{item.id === currentTournament?.id ? ' · Actual' : ''}
              </option>
            ))}
          </select>
        </label>
        <div className="builder-actions">
          <p>
            {selected.length > 0
              ? `${selected.length / 2} vs ${selected.length / 2}`
              : 'Seleccioná una cantidad par'}
          </p>
          <Button size="lg" onClick={() => void create()} disabled={selected.length < 8 || savingLineup}>
            {savingLineup ? 'Guardando…' : 'Crear equipos'}
          </Button>
        </div>
        {lineupSaved && <p className="rounded-lg bg-[#edf3e8] px-3 py-2 text-sm font-bold text-[#347a52]">✓ Formación guardada. Ya está disponible en “Guardar partido jugado”.</p>}
        {message && <p className="builder-error">{message}</p>}
        {teams && (
          <div className="team-results">
            <div className="result-heading">
              <div>
                <span>Resultado</span>
                <h3>Por qué elegimos estos equipos</h3>
              </div>
              <div className="balance-mark">
                <strong>
                  {teams.difference <= 0.1
                    ? 'Excelente'
                    : teams.difference <= 0.25
                      ? 'Muy parejo'
                      : teams.difference <= 0.5
                        ? 'Aceptable'
                        : 'Ajustado'}
                </strong>
                <span>calidad del balance</span>
              </div>
            </div>
            <BalanceExplanation
              teams={teams}
              tournament={selectedTournament}
              leaders={tournamentState.matchDays >= 3 ? tournamentState.leaders.slice(0, 4).map(([name]) => name) : []}
            />
            <div className="prematch-facts-action">
              <button
                type="button"
                onClick={() => setFacts(prematchFacts(
                  validGames,
                  teams.a.filter((player) => !player.guest).map((player) => player.name),
                  teams.b.filter((player) => !player.guest).map((player) => player.name),
                  stats,
                  funnyFactRules,
                  globalGames,
                  selectedTournament,
                ))}
              >
                <Flame /> Datos para la previa
              </button>
              <span>Se calculan localmente con el historial de {competition}.</span>
            </div>
            {facts && (
              <section className="prematch-facts">
                <header>
                  <span>Sin IA · datos del historial</span>
                  <h3>La previa del partido</h3>
                </header>
                {facts.length ? facts.map((fact) => (
                  <article key={fact.code}>
                    <strong>{fact.title} <small>{fact.scope === 'global' ? 'Historial global' : competition}</small></strong>
                    <p>{fact.text}</p>
                  </article>
                )) : (
                  <p className="prematch-facts-empty">Todavía no hay suficiente historial entre estos jugadores para encontrar un dato sólido.</p>
                )}
              </section>
            )}
            <div className="team-summaries">
              <Team
                title="Equipo Celeste"
                tone="sky"
                players={teams.a}
                form={average(teams.a)}
                formation={teams.formationA}
              />
              <Team
                title="Equipo Rosa"
                tone="pink"
                players={teams.b}
                form={average(teams.b)}
                formation={teams.formationB}
              />
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function TeamPitch({
  selected,
  teams,
  onAdd,
  onRemove,
}: {
  selected: Player[];
  teams: TeamPair | null;
  onAdd: (name: string) => void;
  onRemove: (name: string) => void;
}) {
  const placed = (team: Player[], formation: Formation, side: 'a' | 'b') =>
    team.map((player) => {
      const playerRole = formation.roles[player.name],
        peers = team.filter((p) => formation.roles[p.name] === playerRole),
        index = peers.findIndex((p) => p.name === player.name);
      const { x, y } = pitchPosition(playerRole, index, peers.length, side);
      return (
        <div
          key={`${side}-${player.name}`}
          className={`pitch-player pitch-player-${side}`}
          style={{ left: `${x}%`, top: `${y}%` }}
        >
          <PlayerAvatar
            name={player.name}
            className="mb-1 size-9 border-2 border-white"
          />
          <span>{player.name} <PrimeMomentBadge rating={player.rating} compact /><RockBottomBadge rating={player.rating} compact /></span>
          <small>{playerRole}</small>
        </div>
      );
    });
  return (
    <div
      className="match-pitch builder-main-pitch"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const name = e.dataTransfer.getData('text/plain');
        if (name) onAdd(name);
      }}
    >
      {teams && (
        <>
          <div className="pitch-team-label label-a">Equipo Celeste</div>
          <div className="pitch-team-label label-b">Equipo Rosa</div>
        </>
      )}
      <PitchMarkings />
      {teams && (
        <div
          key={`${teams.a.map((player) => player.name).join('-')}:${teams.b.map((player) => player.name).join('-')}`}
          className="pitch-versus pitch-versus-safe"
          aria-hidden="true"
        >
          <span className="versus-text">VS</span>
          <span className="blood-drip blood-drip-one" />
          <span className="blood-drip blood-drip-two" />
          <span className="blood-drip blood-drip-three" />
        </div>
      )}
      {teams ? (
        <>
          {placed(teams.a, teams.formationA, 'a')}
          {placed(teams.b, teams.formationB, 'b')}
        </>
      ) : selected.length === 0 ? (
        <div className="pitch-empty">
          <Users className="size-8" />
          <strong>Arrastrá jugadores aquí</strong>
          <span>También podés seleccionarlos con un clic</span>
        </div>
      ) : (
        <div className="selected-squad selected-on-main-pitch">
          {selected.map((player) => (
            <button
              key={player.name}
              onClick={() => onRemove(player.name)}
              className="selected-player"
            >
              <PlayerAvatar
                name={player.name}
                className="selected-player-avatar size-10"
              />
              <span className="selected-player-copy">
                <strong>{player.name} <PrimeMomentBadge rating={player.rating} compact /><RockBottomBadge rating={player.rating} compact /></strong>
                <small>
                  {player.primary ? role(player.primary) : 'Flexible'} · nivel{' '}
                  {player.level.toFixed(2)}
                </small>
              </span>
              <X className="size-3.5" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function BalanceExplanation({ teams, tournament, leaders }: { teams: TeamPair; tournament: string; leaders: string[] }) {
  const a = teams.formationA.counts,
    b = teams.formationB.counts,
    valid = teams.formationA.valid && teams.formationB.valid,
    strongA = teams.a.filter(
      (player) => (player.rating?.formScore ?? 0.5) >= 0.7,
    ),
    strongB = teams.b.filter(
      (player) => (player.rating?.formScore ?? 0.5) >= 0.7,
    ),
    quietA = teams.a.filter(
      (player) => (player.rating?.formScore ?? 0.5) <= 0.3,
    ),
    quietB = teams.b.filter(
      (player) => (player.rating?.formScore ?? 0.5) <= 0.3,
    );
  const notablePairsA = teams.notablePairsA.filter((pair) => pair.names.every((name) => teams.a.some((player) => player.name === name))),
    notablePairsB = teams.notablePairsB.filter((pair) => pair.names.every((name) => teams.b.some((player) => player.name === name)));
  const chemistryNotes = [
    notablePairsA[0]
      ? pairExplanation(notablePairsA[0], 'Celeste')
      : '',
    notablePairsB[0]
      ? pairExplanation(notablePairsB[0], 'Rosa')
      : '',
  ].filter(Boolean);
  const rule =
    teams.a.length === 6
      ? `Cada equipo tiene exactamente 2 defensores y entre 1 y 2 delanteros.${teams.keeperA || teams.keeperB ? ' Los porteros se muestran bajo el arco y no se cuentan como defensores.' : ''}`
      : teams.a.length === 8
        ? `Cada equipo tiene 3 defensores, al menos 3 medios y entre 1 y 2 delanteros.${teams.keeperA || teams.keeperB ? ' El portero aparece separado, bajo el arco.' : ''}`
        : teams.a.length === 5
          ? 'Cada equipo tiene como máximo 2 defensores y entre 1 y 2 delanteros.'
          : 'Las líneas se distribuyeron proporcionalmente.';
  return (
    <div className="balance-explanation">
      <div><strong>Partido del torneo</strong><span>Esta propuesta corresponde a <b>{tournament || 'la edición actual'}</b>. La pelea por la tabla y los líderes se evalúan dentro de esa edición.</span></div>
      <div>
        <strong>
          {valid ? 'Formaciones válidas' : 'Convocatoria limitada'}
        </strong>
        <span>
          Ambos lados tienen una estructura comparable: Celeste juega con{' '}
          {a.DEF} defensores, {a.MED} medios y {a.DEL} delanteros; Rosa con{' '}
          {b.DEF}, {b.MED} y {b.DEL}.{' '}
          {valid
            ? rule
            : 'No hay suficientes posiciones compatibles para cumplir todos los límites.'}
        </span>
      </div>
      {(teams.keeperA || teams.keeperB) && <div>
        <strong>Portería</strong>
        <span>
          {teams.keeperA && teams.keeperB
            ? `${teams.keeperA.name} y ${teams.keeperB.name} quedaron separados, uno por equipo; por eso la portería no da ventaja adicional a ningún lado.`
            : `${(teams.keeperA ?? teams.keeperB)!.name} es el único portero disponible. Su ventaja fue compensada repartiendo el nivel de campo.`}
        </span>
      </div>}
      <div>
        <strong>Momento de los jugadores</strong>
        <span>
          {strongA.length || strongB.length
            ? `Los jugadores que llegan en mejor momento también fueron distribuidos entre los equipos: ${[strongA.length ? `${strongA.map((player) => player.name).join(', ')} en Celeste` : '', strongB.length ? `${strongB.map((player) => player.name).join(', ')} en Rosa` : ''].filter(Boolean).join('; ')}.`
            : 'No hay grandes diferencias de momento reciente, por lo que pesaron más el nivel y las posiciones.'}{' '}
          {quietA.length || quietB.length
            ? 'Quienes están recuperando ritmo quedaron acompañados por compañeros de momento más estable.'
            : ''}
        </span>
      </div>
      <div>
        <strong>Química y flexibilidad</strong>
        <span>
          {notablePairsA.length || notablePairsB.length
            ? `${chemistryNotes.join(' ')} Las duplas positivas y negativas sólo se usan para afinar el equilibrio: no impiden que todos jueguen con todos y nunca pesan más que el nivel o la formación.`
            : 'No había duplas con suficiente historial como para alterar la propuesta.'}{' '}
          Se recurrió a{' '}
          {teams.formationA.alternateUses + teams.formationB.alternateUses}{' '}
          posiciones alternativas para completar las líneas.
        </span>
      </div>
      {leaders.length >= 2 && teams.a.some((player) => leaders.includes(player.name)) && teams.b.some((player) => leaders.includes(player.name)) && (
        <div>
          <strong>Duelo por la punta</strong>
          <span>Los jugadores de arriba de {tournament} quedaron repartidos: {teams.a.filter((player) => leaders.includes(player.name)).map((player) => player.name).join(', ')} en Celeste y {teams.b.filter((player) => leaders.includes(player.name)).map((player) => player.name).join(', ')} en Rosa. Se usó como preferencia secundaria porque la formación y el balance seguían siendo compatibles.</span>
        </div>
      )}
    </div>
  );
}

function pairExplanation(
  pair: TeamPair['notablePairsA'][number],
  team: string,
) {
  const names = pair.names.join(' y ');
  if (pair.adjustment > 0)
    return `${names}, en ${team}, muestran buenos antecedentes cuando juegan juntos.`;
  return `${names}, en ${team}, han rendido por debajo de su nivel habitual como dupla; el armado contempla esa desventaja.`;
}

function Team({
  title,
  tone,
  players,
  form,
  formation,
}: {
  title: string;
  tone: 'sky' | 'pink';
  players: Player[];
  form: number;
  formation: Formation;
}) {
  return (
    <article className={`generated-team generated-team-${tone}`}>
      <header>
        <div>
          <span>PROPUESTA</span>
          <h3>{title}</h3>
        </div>
        <strong>{form.toFixed(2)}</strong>
      </header>
      <div>
        {[...players]
          .sort((a, b) =>
            formation.roles[a.name].localeCompare(formation.roles[b.name]),
          )
          .map((player) => {
            const assigned = formation.roles[player.name],
              isFlexible = !player.primary,
              isAlternate = !isFlexible && assigned !== role(player.primary);
            return (
              <div className="team-player" key={player.name}>
                <PlayerAvatar name={player.name} className="size-9" />
                <span>
                  <strong>{player.name} <PrimeMomentBadge rating={player.rating} compact /><RockBottomBadge rating={player.rating} compact /></strong>
                  <small>
                    {assigned} ·{' '}
                    {isFlexible
                      ? 'Invitado flexible'
                      : isAlternate
                        ? `Alternativa: ${player.alternate}`
                        : player.primary}
                  </small>
                </span>
                <em>{player.level.toFixed(2)}</em>
              </div>
            );
          })}
      </div>
    </article>
  );
}
