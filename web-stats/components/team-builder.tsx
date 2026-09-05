'use client';

import { useMemo, useState } from 'react';
import { GripVertical, RefreshCw, Users, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PlayerAvatar } from '@/components/player-avatar';
import { useStatsData, type Game, type Profile } from '@/lib/stats-context';
import { API } from '@/components/site-client';

type Player = Profile & { form: number; played: number; lastDate: string };
type Role = 'DEF' | 'MED' | 'DEL';
type Formation = {
  roles: Record<string, Role>;
  counts: Record<Role, number>;
  valid: boolean;
  alternateUses: number;
};
type TeamPair = {
  a: Player[];
  b: Player[];
  difference: number;
  formationA: Formation;
  formationB: Formation;
};

function resultPoints(game: Game, name: string) {
  const side = game.team1.includes(name) ? '1' : '2';
  if (game.outcome === 'D') return 1;
  return game.outcome === side ? 3 : 0;
}

function role(position: string): Role {
  const text = position.toLowerCase();
  if (text.includes('defen')) return 'DEF';
  if (text.includes('medio')) return 'MED';
  return 'DEL';
}

function bestFormation(team: Player[]): Formation {
  let best: Formation | null = null,
    bestPenalty = Infinity;
  const roles: Record<string, Role> = {};
  const walk = (index: number, alternateUses: number) => {
    if (index < team.length) {
      const player = team[index],
        primary = role(player.primary),
        options = [
          primary,
          ...(player.alternate ? [role(player.alternate)] : []),
        ].filter((v, i, a) => a.indexOf(v) === i);
      options.forEach((choice) => {
        roles[player.name] = choice;
        walk(index + 1, alternateUses + (choice === primary ? 0 : 1));
      });
      return;
    }
    const counts = Object.values(roles).reduce(
      (acc, value) => {
        acc[value]++;
        return acc;
      },
      { DEF: 0, MED: 0, DEL: 0 },
    );
    const valid =
      team.length === 5
        ? counts.DEF >= 1 &&
          counts.DEF <= 2 &&
          counts.DEL >= 1 &&
          counts.DEL <= 2 &&
          counts.MED >= 1
        : team.length === 6
          ? counts.DEF === 2 &&
            counts.DEL >= 1 &&
            counts.DEL <= 2 &&
            counts.MED >= 2
          : team.length === 8
            ? counts.DEF === 3 &&
              counts.MED >= 3 &&
              counts.DEL >= 1 &&
              counts.DEL <= 2
          : true;
    const target = {
      DEF:
        team.length === 8
          ? 3
          : team.length >= 5
            ? 2
            : Math.max(1, Math.round(team.length * 0.3)),
      DEL:
        team.length === 8
          ? 1
          : Math.min(2, Math.max(1, Math.round(team.length * 0.25))),
    };
    const penalty =
      (valid ? 0 : 1000) +
      alternateUses * 0.2 +
      Math.abs(counts.DEF - target.DEF) +
      Math.abs(counts.DEL - target.DEL);
    if (penalty < bestPenalty) {
      bestPenalty = penalty;
      best = { roles: { ...roles }, counts, valid, alternateUses };
    }
  };
  walk(0, 0);
  return best!;
}

function splitTeams(players: Player[]): TeamPair {
  const size = players.length / 2;
  let best: TeamPair | null = null,
    bestScore = Infinity;
  const evaluate = (a: Player[]) => {
    const names = new Set(a.map((p) => p.name)),
      b = players.filter((p) => !names.has(p.name));
    const formA = a.reduce((n, p) => n + p.form, 0) / a.length,
      formB = b.reduce((n, p) => n + p.form, 0) / b.length;
    const formationA = bestFormation(a),
      formationB = bestFormation(b),
      pa = formationA.counts,
      pb = formationB.counts;
    const positionGap =
      Math.abs(pa.DEF - pb.DEF) +
      Math.abs(pa.MED - pb.MED) +
      Math.abs(pa.DEL - pb.DEL);
    const score =
      Math.abs(formA - formB) * 12 +
      positionGap * 0.75 +
      (formationA.valid && formationB.valid ? 0 : 1000) +
      formationA.alternateUses * 0.15 +
      formationB.alternateUses * 0.15;
    if (score < bestScore) {
      bestScore = score;
      best = {
        a,
        b,
        difference: Math.abs(formA - formB),
        formationA,
        formationB,
      };
    }
  };
  if (players.length <= 16) {
    const chosen: Player[] = [players[0]];
    const walk = (start: number) => {
      if (chosen.length === size) {
        evaluate([...chosen]);
        return;
      }
      for (let i = start; i < players.length; i++) {
        chosen.push(players[i]);
        walk(i + 1);
        chosen.pop();
      }
    };
    walk(1);
  } else {
    const sorted = [...players].sort((a, b) => b.form - a.form),
      a: Player[] = [],
      b: Player[] = [];
    sorted.forEach((player) => {
      const target =
        a.length >= size
          ? b
          : b.length >= size
            ? a
            : a.reduce((n, p) => n + p.form, 0) <=
                b.reduce((n, p) => n + p.form, 0)
              ? a
              : b;
      target.push(player);
    });
    evaluate(a);
  }
  return best!;
}

export function TeamBuilder({ games, competition }: { games: Game[]; competition: string }) {
  const data = useStatsData();
  const validGames = useMemo(
    () =>
      games
        .filter((game) => game.status === 'verified')
        .sort((a, b) => a.date.localeCompare(b.date)),
    [games],
  );
  const players = useMemo<Player[]>(
    () =>
      data.profiles
        .filter((p) => p.primary)
        .map((profile) => {
          const history = validGames.filter(
            (game) =>
              game.team1.includes(profile.name) ||
              game.team2.includes(profile.name),
          );
          const recent = history.slice(-10),
            earned = recent.reduce(
              (sum, game) => sum + resultPoints(game, profile.name),
              0,
            );
          return {
            ...profile,
            form: recent.length ? earned / (recent.length * 3) : 0,
            played: history.length,
            lastDate: history.at(-1)?.date ?? '—',
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name)),
    [validGames],
  );
  const [selected, setSelected] = useState<string[]>([]),
    [search, setSearch] = useState(''),
    [teams, setTeams] = useState<TeamPair | null>(null),
    [message, setMessage] = useState('');
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
    setMessage('');
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
    const result = splitTeams(selectedPlayers);
    setTeams(result);
    setMessage('');
    void fetch(`${API}/lineups`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        competition,
        teams: [result.a.map((item) => item.id), result.b.map((item) => item.id)],
      }),
    });
  };
  const average = (team: Player[]) =>
    team.reduce((n, p) => n + p.form, 0) / team.length;
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
                  {player.primary}
                  {player.alternate ? ` · alt. ${player.alternate}` : ''}
                </small>
              </span>
              <b>{Math.round(player.form * 100)}%</b>
            </button>
          ))}
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
                <strong>{Math.round(teams.difference * 100)} pp</strong>
                <span>diferencia de forma</span>
              </div>
            </div>
            <BalanceExplanation teams={teams} />
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
      const x =
        side === 'a'
          ? { DEF: 13, MED: 29, DEL: 43 }[playerRole]
          : { DEF: 87, MED: 71, DEL: 57 }[playerRole];
      const y = ((index + 1) / (peers.length + 1)) * 100;
      return (
        <div
          key={`${side}-${player.name}`}
          className={`pitch-player pitch-player-${side}`}
          style={{ left: `${x}%`, top: `${y}%` }}
        >
          <PlayerAvatar name={player.name} className="mb-1 size-9 border-2 border-white" />
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
      <div className="center-circle" />
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
      <div className="penalty-box box-a" />
      <div className="penalty-box box-b" />
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
              <PlayerAvatar name={player.name} className="selected-player-avatar size-10" />
              <span className="selected-player-copy"><strong>{player.name}</strong><small>{role(player.primary)} · {Math.round(player.form * 100)}%</small></span>
              <X className="size-3.5" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function BalanceExplanation({ teams }: { teams: TeamPair }) {
  const a = teams.formationA.counts,
    b = teams.formationB.counts,
    avg = (team: Player[]) =>
      Math.round((team.reduce((n, p) => n + p.form, 0) / team.length) * 100),
    valid = teams.formationA.valid && teams.formationB.valid;
  const rule =
    teams.a.length === 6
      ? 'Cada equipo tiene exactamente 2 defensores y entre 1 y 2 delanteros.'
      : teams.a.length === 8
        ? 'Cada equipo tiene 3 defensores, al menos 3 medios y entre 1 y 2 delanteros. El arquero rota y no se muestra como posición fija.'
      : teams.a.length === 5
        ? 'Cada equipo tiene como máximo 2 defensores y entre 1 y 2 delanteros.'
        : 'Las líneas se distribuyeron proporcionalmente.';
  return (
    <div className="balance-explanation">
      <div>
        <strong>Forma reciente casi pareja</strong>
        <span>
          Equipo Celeste {avg(teams.a)}% · Equipo Rosa {avg(teams.b)}% ·
          diferencia {Math.round(teams.difference * 100)} pp.
        </span>
      </div>
      <div>
        <strong>
          {valid ? 'Formaciones válidas' : 'Convocatoria limitada'}
        </strong>
        <span>
          Celeste: {a.DEF} DEF, {a.MED} MED, {a.DEL} DEL · Rosa: {b.DEF} DEF,{' '}
          {b.MED} MED, {b.DEL} DEL.{' '}
          {valid
            ? rule
            : 'No hay suficientes posiciones compatibles para cumplir todos los límites.'}
        </span>
      </div>
      <div>
        <strong>Posiciones alternativas</strong>
        <span>
          Se usaron{' '}
          {teams.formationA.alternateUses + teams.formationB.alternateUses}{' '}
          posiciones alternativas para completar las líneas sin romper el
          balance.
        </span>
      </div>
    </div>
  );
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
        <strong>{Math.round(form * 100)}%</strong>
      </header>
      <div>
        {[...players]
          .sort((a, b) =>
            formation.roles[a.name].localeCompare(formation.roles[b.name]),
          )
          .map((player) => {
            const assigned = formation.roles[player.name],
              isAlternate = assigned !== role(player.primary);
            return (
              <div className="team-player" key={player.name}>
                <PlayerAvatar name={player.name} className="size-9" />
                <span>
                  <strong>{player.name}</strong>
                  <small>
                    {assigned} · {isAlternate
                      ? `Alternativa: ${player.alternate}`
                      : player.primary}
                  </small>
                </span>
                <em>{Math.round(player.form * 100)}%</em>
              </div>
            );
          })}
      </div>
    </article>
  );
}
