'use client';

import { useMemo, useState } from 'react';
import { Flame, Plus, RefreshCw, Users, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PlayerAvatar } from '@/components/player-avatar';
import { PitchMarkings } from '@/components/pitch-markings';
import type { Game, PlayerStat, Profile } from '@/lib/stats-context';
import { API } from '@/components/site-client';
import { playerPositions } from '@/lib/player-options';
import {
  pitchPosition,
  positionRole as role,
  type Formation,
} from '@/lib/team-formation';
import { splitBalancedTeams, type BalancedTeams } from '@/lib/team-balancer';
import { currentTournamentLeaders, prematchFacts, type FactRule, type PrematchFact } from '@/lib/prematch-facts';

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

export function TeamBuilder({
  games,
  globalGames,
  competition,
  profiles,
  stats,
  funnyFactRules,
}: {
  games: Game[];
  globalGames: Game[];
  competition: string;
  profiles: Profile[];
  stats: PlayerStat[];
  funnyFactRules: FactRule[];
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
        .filter((p) => p.primary && p.competitions.includes(competition))
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
        .sort((a, b) => a.name.localeCompare(b.name)),
    [validGames, profiles, competition],
  );
  const tournamentState = useMemo(() => currentTournamentLeaders(validGames), [validGames]);
  const [guests, setGuests] = useState<Player[]>([]),
    [guestLevel, setGuestLevel] = useState('5'),
    [guestPosition, setGuestPosition] = useState(''),
    [selected, setSelected] = useState<string[]>([]),
    [search, setSearch] = useState(''),
    [teams, setTeams] = useState<TeamPair | null>(null),
    [facts, setFacts] = useState<PrematchFact[] | null>(null),
    [message, setMessage] = useState('');
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
  const create = () => {
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
    void fetch(`${API}/lineups`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
                <strong>{player.name}</strong>
                <small>
                  {player.primary || 'Flexible / sin posición'}
                  {player.alternate ? ` · alt. ${player.alternate}` : ''}
                </small>
              </span>
              <b
                title={
                  player.rating?.dynamic
                    ? `${player.rating.recentMatches} partidos válidos en ${player.rating.windowDays} días`
                    : `Nivel base: menos de 5 partidos en ${player.rating?.windowDays ?? 90} días`
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
        <div className="builder-actions">
          <p>
            {selected.length > 0
              ? `${selected.length / 2} vs ${selected.length / 2}`
              : 'Seleccioná una cantidad par'}
          </p>
          <Button size="lg" onClick={create} disabled={selected.length < 8}>
            Crear equipos
          </Button>
        </div>
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
              tournament={tournamentState.tournament}
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
          <span>{player.name}</span>
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
                <strong>{player.name}</strong>
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
  const chemistryNotes = [
    teams.notablePairsA[0]
      ? pairExplanation(teams.notablePairsA[0], 'Celeste')
      : '',
    teams.notablePairsB[0]
      ? pairExplanation(teams.notablePairsB[0], 'Rosa')
      : '',
  ].filter(Boolean);
  const rule =
    teams.a.length === 6
      ? `Cada equipo tiene exactamente 2 defensores y entre 1 y 2 delanteros.${teams.keeperA || teams.keeperB ? ' Los porteros se muestran bajo el arco y no se cuentan como defensores.' : ''}`
      : teams.a.length === 8
        ? `Cada equipo tiene 3 defensores, al menos 3 medios y entre 1 y 2 delanteros.${teams.keeperA || teams.keeperB ? ' El portero aparece separado, bajo el arco.' : ' Como no hay portero natural, el arco seguirá rotando.'}`
        : teams.a.length === 5
          ? 'Cada equipo tiene como máximo 2 defensores y entre 1 y 2 delanteros.'
          : 'Las líneas se distribuyeron proporcionalmente.';
  return (
    <div className="balance-explanation">
      <div>
        <strong>
          {teams.difference <= 0.1
            ? 'Dos equipos muy parejos'
            : teams.difference <= 0.25
              ? 'Un equilibrio sólido'
              : 'La convocatoria permite un equilibrio limitado'}
        </strong>
        <span>
          Se repartió el nivel actual para que ninguno de los dos lados
          concentre claramente a los jugadores más fuertes de esta convocatoria.
        </span>
      </div>
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
      <div>
        <strong>Portería</strong>
        <span>
          {teams.keeperA && teams.keeperB
            ? `${teams.keeperA.name} y ${teams.keeperB.name} quedaron separados, uno por equipo; por eso la portería no da ventaja adicional a ningún lado.`
            : teams.keeperA || teams.keeperB
              ? `${(teams.keeperA ?? teams.keeperB)!.name} es el único portero disponible. Su ventaja fue compensada repartiendo el nivel de campo.`
              : 'No hay un portero natural en la convocatoria, así que este factor no inclinó el armado.'}
        </span>
      </div>
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
          {teams.notablePairsA.length || teams.notablePairsB.length
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
                  <strong>{player.name}</strong>
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
