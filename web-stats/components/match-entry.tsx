'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  Eye,
  Plus,
  Save,
  Trash2,
  Trophy,
  UserRoundPlus,
} from 'lucide-react';
import { API } from '@/components/site-client';
import { PlayerAvatar } from '@/components/player-avatar';
import { PitchMarkings } from '@/components/pitch-markings';
import type { CompetitionStats, Game, Profile } from '@/lib/stats-context';
import { activityCutoff, hasRecentActivity } from '@/lib/player-activity';
import { bestFormation, pitchPosition } from '@/lib/team-formation';

type Member = { playerId?: number; name: string; guestName?: string };
type Preset = {
  id: number;
  createdAt: string;
  team1: { player_id: number; canonical_name: string }[];
  team2: { player_id: number; canonical_name: string }[];
  guest1: { guest_label: string }[];
  guest2: { guest_label: string }[];
};
type Tournament = CompetitionStats['tournamentEditions'][number];

export function MatchEntry({
  mode,
  competition,
  profiles,
  games,
  tournaments,
  onSaved,
}: {
  mode: 'create' | 'admin';
  competition: string;
  profiles: Profile[];
  games: Game[];
  tournaments: Tournament[];
  onSaved: () => Promise<void>;
}) {
  const eligible = useMemo(
    () =>
      profiles
        .filter((profile) => profile.competitions.includes(competition))
        .sort(
          (a, b) =>
            Number(hasRecentActivity(b.name, games, activityCutoff())) -
              Number(hasRecentActivity(a.name, games, activityCutoff())) ||
            a.name.localeCompare(b.name),
        ),
    [profiles, competition, games],
  );
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const currentTournament = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const ordered = [...tournaments].sort(
      (a, b) =>
        (b.startsOn ?? '').localeCompare(a.startsOn ?? '') || b.id - a.id,
    );
    return (
      ordered.find(
        (item) =>
          (item.startsOn ?? '') <= today &&
          (!item.endsOn || item.endsOn >= today),
      ) ?? ordered[0]
    );
  }, [tournaments]);
  const [tournamentId, setTournamentId] = useState<number | null>(
    currentTournament?.id ?? null,
  );
  const [teams, setTeams] = useState<[Member[], Member[]]>([[], []]);
  const [goals, setGoals] = useState<Record<string, number>>({});
  const [presets, setPresets] = useState<Preset[]>([]),
    [message, setMessage] = useState(''),
    [messageKind, setMessageKind] = useState<'info' | 'success' | 'error'>(
      'info',
    ),
    [editing, setEditing] = useState<number | null>(null),
    [viewing, setViewing] = useState<Game | null>(null);

  useEffect(() => {
    if (mode === 'admin') {
      setPresets([]);
      return;
    }
    fetch(`${API}/lineups?competition=${competition}`, { cache: 'no-store' })
      .then(async (r) => (await r.json()) as Preset[])
      .then(setPresets)
      .catch(() => setPresets([]));
  }, [competition, mode]);
  const key = (team: number, member: Member) =>
    `${team}:${member.playerId ?? `g:${member.guestName}`}`;
  const score = (team: number) =>
    teams[team - 1].reduce(
      (sum, member) => sum + (goals[key(team, member)] || 0),
      0,
    ) + (goals[`${team}:unknown`] || 0);
  const used = new Set(
    teams
      .flat()
      .flatMap((member) => (member.playerId ? [member.playerId] : [])),
  );
  const setTeam = (index: number, value: Member[]) =>
    setTeams((current) =>
      index === 0 ? [value, current[1]] : [current[0], value],
    );
  const addPlayer = (index: number, value: string) => {
    const profile = eligible.find((item) => item.id === Number(value));
    if (profile && !used.has(profile.id))
      setTeam(index, [
        ...teams[index],
        { playerId: profile.id, name: profile.name },
      ]);
  };
  const addGuest = (index: number) => {
    const count = teams.flat().filter((member) => member.guestName).length + 1;
    const guestName = `Invitado ${count}`;
    setTeam(index, [...teams[index], { name: guestName, guestName }]);
  };
  const remove = (index: number, member: Member) => {
    setTeam(
      index,
      teams[index].filter((item) => item !== member),
    );
    setGoals((current) => {
      const copy = { ...current };
      delete copy[key(index + 1, member)];
      return copy;
    });
  };
  function loadPreset(preset: Preset) {
    setTeams([
      [
        ...preset.team1.map((item) => ({
          playerId: item.player_id,
          name: item.canonical_name,
        })),
        ...(preset.guest1 || []).map((item) => ({
          name: item.guest_label,
          guestName: item.guest_label,
        })),
      ],
      [
        ...preset.team2.map((item) => ({
          playerId: item.player_id,
          name: item.canonical_name,
        })),
        ...(preset.guest2 || []).map((item) => ({
          name: item.guest_label,
          guestName: item.guest_label,
        })),
      ],
    ]);
    setGoals({});
    setEditing(null);
    setMessage(
      'Formación cargada. Podés agregar, quitar o cambiar jugadores libremente.',
    );
    setMessageKind('info');
  }
  const payload = () => ({
    competition,
    playedOn: date,
    tournamentId,
    teams: teams.map((team) =>
      team.map((member) =>
        member.playerId
          ? { playerId: member.playerId }
          : { guestName: member.guestName },
      ),
    ),
    goals: [
      ...teams.flatMap((team, index) =>
        team.map((member) => ({
          teamNo: index + 1,
          playerId: member.playerId,
          guestName: member.guestName,
          count: goals[key(index + 1, member)] || 0,
        })),
      ),
      ...[1, 2].map((team) => ({
        teamNo: team,
        count: goals[`${team}:unknown`] || 0,
      })),
    ].filter((goal) => goal.count > 0),
  });
  const save = async () => {
    setMessage('Guardando…');
    setMessageKind('info');
    const response = await fetch(
      `${API}/matches${editing ? `/${editing}` : ''}`,
      {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload()),
      },
    );
    const body = (await response.json()) as { error?: string };
    if (!response.ok) {
      setMessage(body.error || 'No se pudo guardar');
      setMessageKind('error');
      return;
    }
    await onSaved();
    setEditing(null);
    setMessage(`Partido guardado: ${score(1)}–${score(2)}.`);
    setMessageKind('success');
  };
  const edit = (game: Game) => {
    const members = (names: string[], teamNo: number) => [
      ...names.map((name) => {
        const profile = profiles.find((item) => item.name === name);
        return { playerId: profile?.id, name };
      }),
      ...(game.guests || [])
        .filter((g) => g.team_no === teamNo)
        .map((g) => ({ name: g.guest_label, guestName: g.guest_label })),
    ];
    setDate(game.date);
    setTournamentId(
      tournaments.find((item) => item.displayName === game.tournament)?.id ??
        currentTournament?.id ??
        null,
    );
    setTeams([members(game.team1, 1), members(game.team2, 2)]);
    const next: Record<string, number> = {};
    if (game.goals?.length) {
      game.goals.forEach((goal) => {
        const member = goal.player_name
          ? profiles.find((item) => item.name === goal.player_name)
          : undefined;
        next[`${goal.team_no}:${member?.id ?? `g:${goal.guest_label}`}`] =
          goal.goal_count;
      });
    } else {
      next['1:unknown'] = game.score1 || 0;
      next['2:unknown'] = game.score2 || 0;
    }
    setGoals(next);
    setEditing(game.id);
    setMessage('Editando un partido existente.');
    setMessageKind('info');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const voidGame = async (game: Game) => {
    if (
      !window.confirm(
        `¿Anular el partido del ${game.date}? El historial de auditoría se conservará.`,
      )
    )
      return;
    const response = await fetch(`${API}/matches/${game.id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Corrección desde la interfaz' }),
    });
    if (response.ok) {
      await onSaved();
      setMessage('Partido anulado correctamente.');
      setMessageKind('success');
    }
  };

  if (mode === 'admin' && editing === null && viewing) {
    const members = (names: string[], teamNo: number): Member[] => [
      ...names.map((name) => ({
        playerId: profiles.find((profile) => profile.name === name)?.id,
        name,
      })),
      ...(viewing.guests || [])
        .filter((guest) => guest.team_no === teamNo)
        .map((guest) => ({
          name: guest.guest_label,
          guestName: guest.guest_label,
        })),
    ];
    const detailTeams: [Member[], Member[]] = [
      members(viewing.team1, 1),
      members(viewing.team2, 2),
    ];
    return (
      <div className="match-entry-shell match-readonly-detail">
        <div className="match-detail-header">
          <div>
            <button
              className="match-detail-back"
              onClick={() => setViewing(null)}
            >
              ← Volver a partidos
            </button>
            <h3>Detalle del partido</h3>
            <p>
              {new Date(`${viewing.date}T00:00:00`).toLocaleDateString('es-ES')}{' '}
              · vista de solo lectura
            </p>
          </div>
          <button
            className="match-detail-edit"
            onClick={() => {
              setViewing(null);
              edit(viewing);
            }}
          >
            <Eye /> Editar partido
          </button>
          <button
            className="match-detail-void"
            onClick={() => void voidGame(viewing)}
          >
            <Trash2 /> Anular partido
          </button>
        </div>
        <MatchLineupPitch
          teams={detailTeams}
          profiles={profiles}
          score1={viewing.score1 ?? 0}
          score2={viewing.score2 ?? 0}
        />
        <MatchSummary game={viewing} detailed />
      </div>
    );
  }

  if (mode === 'admin' && editing === null)
    return (
      <div className="match-entry-shell">
        {message && <p className="admin-message">{message}</p>}
        <section className="recent-match-admin">
          <h3>Partidos existentes</h3>
          <p>
            Elegí un partido para corregirlo o anularlo. Esta tarea está
            separada de la carga de partidos nuevos.
          </p>
          {[...games]
            .sort((a, b) => b.date.localeCompare(a.date))
            .map((game) => (
              <div
                className="match-admin-row"
                key={game.id}
                role="button"
                tabIndex={0}
                onClick={() => setViewing(game)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ')
                    setViewing(game);
                }}
              >
                <span>
                  {new Date(`${game.date}T00:00:00`).toLocaleDateString(
                    'es-ES',
                  )}
                </span>
                <strong>
                  {game.score1}–{game.score2}
                </strong>
                <div className="match-quick-preview" role="tooltip">
                  <MatchSummary game={game} />
                </div>
                <span className="match-row-hint">Ver detalles</span>
              </div>
            ))}
        </section>
      </div>
    );

  return (
    <div className="match-entry-shell">
      <div className="match-entry-toolbar">
        <label>
          <CalendarDays /> Fecha real del partido
          <input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </label>
        <label>
          <Trophy /> Torneo
          <select
            value={tournamentId ?? ''}
            onChange={(event) => setTournamentId(Number(event.target.value))}
            required
          >
            {tournaments.map((item) => (
              <option key={item.id} value={item.id}>
                {item.displayName}
                {item.id === currentTournament?.id ? ' · Actual' : ''}
              </option>
            ))}
          </select>
          <small>El torneo actual aparece seleccionado automáticamente.</small>
        </label>
        {mode === 'create' && presets.length > 0 && (
          <label className="quick-load">
            Carga rápida: últimos equipos
            <select
              value=""
              onChange={(event) => {
                const preset = presets.find(
                  (item) => item.id === Number(event.target.value),
                );
                if (preset) loadPreset(preset);
              }}
            >
              <option value="">Seleccionar formación…</option>
              {presets.map((preset, index) => (
                <option key={preset.id} value={preset.id}>
                  {index === 0 ? 'Última formación' : `Formación #${index + 1}`}{' '}
                  ·{' '}
                  {new Date(preset.createdAt).toLocaleString('es-ES', {
                    dateStyle: 'short',
                    timeStyle: 'short',
                  })}
                </option>
              ))}
            </select>
            <small>La más reciente aparece primero.</small>
          </label>
        )}
      </div>
      <MatchLineupPitch
        teams={teams}
        profiles={profiles}
        score1={score(1)}
        score2={score(2)}
      />
      <div className="match-team-controls">
        <TeamEditor
          index={0}
          title="Equipo Celeste"
          team={teams[0]}
          eligible={eligible}
          used={used}
          goals={goals}
          onGoal={(member, value) =>
            setGoals((current) => ({ ...current, [key(1, member)]: value }))
          }
          unknown={goals['1:unknown'] || 0}
          allowUnknown={mode === 'admin' && Boolean(goals['1:unknown'])}
          onUnknown={(value) =>
            setGoals((current) => ({ ...current, '1:unknown': value }))
          }
          onAdd={(value) => addPlayer(0, value)}
          onGuest={() => addGuest(0)}
          onRemove={(member) => remove(0, member)}
        />
        <TeamEditor
          index={1}
          title="Equipo Rosa"
          team={teams[1]}
          eligible={eligible}
          used={used}
          goals={goals}
          onGoal={(member, value) =>
            setGoals((current) => ({ ...current, [key(2, member)]: value }))
          }
          unknown={goals['2:unknown'] || 0}
          allowUnknown={mode === 'admin' && Boolean(goals['2:unknown'])}
          onUnknown={(value) =>
            setGoals((current) => ({ ...current, '2:unknown': value }))
          }
          onAdd={(value) => addPlayer(1, value)}
          onGuest={() => addGuest(1)}
          onRemove={(member) => remove(1, member)}
        />
      </div>
      <div className="match-save">
        {message && (
          <p
            className={`match-save-message match-save-message-${messageKind}`}
            role={messageKind === 'error' ? 'alert' : 'status'}
          >
            {messageKind === 'error' && <AlertCircle aria-hidden="true" />}
            {messageKind === 'success' && <CheckCircle2 aria-hidden="true" />}
            <span>{message}</span>
          </p>
        )}
        {mode === 'admin' && (
          <button
            className="secondary"
            onClick={() => {
              setEditing(null);
              setMessage('');
              setMessageKind('info');
            }}
          >
            Cancelar edición
          </button>
        )}
        <button
          onClick={() => void save()}
          disabled={!date || !teams[0].length || !teams[1].length}
        >
          <Save />
          {editing ? 'Guardar corrección' : 'Guardar partido jugado'}
        </button>
      </div>
    </div>
  );
}

function MatchSummary({
  game,
  detailed = false,
}: {
  game: Game;
  detailed?: boolean;
}) {
  const team = (names: string[], teamNo: number) => [
    ...names,
    ...(game.guests || [])
      .filter((guest) => guest.team_no === teamNo)
      .map((guest) => guest.guest_label),
  ];
  return (
    <div
      className={
        detailed ? 'match-summary match-summary-detailed' : 'match-summary'
      }
    >
      <header>
        <span>
          {new Date(`${game.date}T00:00:00`).toLocaleDateString('es-ES')}
        </span>
        <strong>
          {game.score1 ?? '?'}–{game.score2 ?? '?'}
        </strong>
      </header>
      <div className="match-summary-teams">
        <section>
          <b>Equipo Celeste</b>
          <p>{team(game.team1, 1).join(', ') || 'Sin jugadores registrados'}</p>
        </section>
        <section>
          <b>Equipo Rosa</b>
          <p>{team(game.team2, 2).join(', ') || 'Sin jugadores registrados'}</p>
        </section>
      </div>
      {detailed && game.goals && game.goals.length > 0 && (
        <div className="match-summary-goals">
          <b>Goles registrados</b>
          <p>
            {game.goals
              .map(
                (goal) =>
                  `${goal.player_name || goal.guest_label || 'Sin autor'} (${goal.goal_count})`,
              )
              .join(' · ')}
          </p>
        </div>
      )}
    </div>
  );
}

function TeamEditor({
  index,
  title,
  team,
  eligible,
  used,
  goals,
  onGoal,
  unknown,
  allowUnknown,
  onUnknown,
  onAdd,
  onGuest,
  onRemove,
}: {
  index: number;
  title: string;
  team: Member[];
  eligible: Profile[];
  used: Set<number>;
  goals: Record<string, number>;
  onGoal: (member: Member, value: number) => void;
  unknown: number;
  allowUnknown: boolean;
  onUnknown: (value: number) => void;
  onAdd: (value: string) => void;
  onGuest: () => void;
  onRemove: (member: Member) => void;
}) {
  return (
    <section className={`match-half ${index ? 'pink' : 'sky'}`}>
      <h3>{title}</h3>
      <div className="match-add">
        <select value="" onChange={(event) => onAdd(event.target.value)}>
          <option value="">Agregar jugador…</option>
          {eligible
            .filter((item) => !used.has(item.id))
            .map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
        </select>
        <button onClick={onGuest}>
          <UserRoundPlus /> Invitado
        </button>
      </div>
      <small className="guest-goal-hint">
        Si un invitado hizo goles, agregalo al equipo y cargalos junto a su
        nombre.
      </small>
      <div className="match-members">
        {team.map((member) => (
          <div
            className="match-member"
            key={member.playerId ?? member.guestName}
          >
            {member.playerId ? (
              <PlayerAvatar name={member.name} />
            ) : (
              <span className="guest-avatar">I</span>
            )}
            <span>{member.name}</span>
            <label>
              {member.guestName ? 'Goles invitado' : 'Goles'}
              <input
                type="number"
                min="0"
                value={
                  goals[
                    `${index + 1}:${member.playerId ?? `g:${member.guestName}`}`
                  ] || ''
                }
                onChange={(event) =>
                  onGoal(member, Math.max(0, Number(event.target.value)))
                }
              />
            </label>
            <button
              aria-label={`Quitar ${member.name}`}
              onClick={() => onRemove(member)}
            >
              ×
            </button>
          </div>
        ))}
      </div>
      {allowUnknown && (
        <label className="unknown-goals">
          <Plus /> Goles históricos sin identificar
          <input
            type="number"
            min="0"
            value={unknown || ''}
            onChange={(event) =>
              onUnknown(Math.max(0, Number(event.target.value)))
            }
          />
        </label>
      )}
    </section>
  );
}

function MatchLineupPitch({
  teams,
  profiles,
  score1,
  score2,
}: {
  teams: [Member[], Member[]];
  profiles: Profile[];
  score1: number;
  score2: number;
}) {
  const formationPlayers = (team: Member[]) =>
    team.map((member) => {
      const profile = profiles.find((item) => item.id === member.playerId);
      return {
        name: member.name,
        primary: profile?.primary || 'Mediocampo centro',
        alternate: profile?.alternate || '',
      };
    });
  const formations = teams.map(formationPlayers).map(bestFormation);
  const placed = (team: Member[], side: 'a' | 'b', formationIndex: number) =>
    team.map((member) => {
      const formation = formations[formationIndex],
        memberRole = formation.roles[member.name],
        peers = team.filter(
          (item) => formation.roles[item.name] === memberRole,
        ),
        index = peers.indexOf(member),
        { x, y } = pitchPosition(memberRole, index, peers.length, side);
      return (
        <div
          key={`${side}-${member.playerId ?? member.guestName}`}
          className={`pitch-player pitch-player-${side}`}
          style={{ left: `${x}%`, top: `${y}%` }}
        >
          {member.playerId ? (
            <PlayerAvatar
              name={member.name}
              className="mb-1 size-9 border-2 border-white"
            />
          ) : (
            <span className="guest-avatar entry-guest-avatar">I</span>
          )}
          <span>{member.name}</span>
          <small>{memberRole}</small>
        </div>
      );
    });
  const ready = teams[0].length > 0 && teams[1].length > 0;
  return (
    <div className="match-pitch match-entry-visual">
      <div className="pitch-team-label label-a">Equipo Celeste</div>
      <div className="pitch-team-label label-b">Equipo Rosa</div>
      <PitchMarkings />
      {ready && (
        <div className="pitch-versus pitch-versus-safe" aria-hidden="true">
          <span className="versus-text">VS</span>
          <span className="blood-drip blood-drip-one" />
          <span className="blood-drip blood-drip-two" />
          <span className="blood-drip blood-drip-three" />
        </div>
      )}
      {placed(teams[0], 'a', 0)}
      {placed(teams[1], 'b', 1)}{' '}
      {!teams[0].length && !teams[1].length && (
        <div className="pitch-empty">
          <strong>Elegí o cargá los equipos</strong>
          <span>Los jugadores aparecerán en esta misma cancha</span>
        </div>
      )}
      <div className="entry-scoreboard">
        <strong>
          {score1}–{score2}
        </strong>
        <small>
          {score1 === score2
            ? 'Empate'
            : score1 > score2
              ? 'Gana Celeste'
              : 'Gana Rosa'}
        </small>
      </div>
    </div>
  );
}
