'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, Pencil, Plus, RotateCcw, Search, ShieldCheck, Trophy, UserMinus } from 'lucide-react';
import { API } from '@/components/site-client';
import { PlayerAvatar } from '@/components/player-avatar';
import { PlayerComparison } from '@/components/player-comparison';
import { PrimeMomentBadge, RockBottomBadge } from '@/components/prime-moment-badge';
import { AchievementPatches } from '@/components/achievement-patches';
import { PlayerRatingHistory } from '@/components/player-rating-history';
import type { CompetitionStats, Game, PlayerStat, Profile } from '@/lib/stats-context';
import { ratingRangePosition } from '@/lib/player-rating';
import { activityCutoff, hasRecentActivity } from '@/lib/player-activity';
import {
  countries,
  countryFlag,
  playerPositions as positions,
  ratingSuggestions,
} from '@/lib/player-options';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type Draft = {
  name: string;
  active: boolean;
  firstName: string;
  lastName: string;
  nickname: string;
  birthDate: string;
  nationality: string;
  preferredFoot: string;
  primary: string;
  alternate: string;
  bio: string;
  notes: string;
  ratingMin: string;
  ratingMax: string;
  photoData: string;
  photoName: string;
};

function draftOf(player: Profile): Draft {
  return {
    name: player.name,
    active: player.active,
    firstName: player.firstName,
    lastName: player.lastName,
    nickname: player.nickname,
    birthDate: player.birthDate,
    nationality: player.nationality,
    preferredFoot: player.preferredFoot,
    primary: player.primary,
    alternate: player.alternate,
    bio: player.bio,
    notes: player.notes,
    ratingMin: player.rating ? String(player.rating.min) : '',
    ratingMax: player.rating ? String(player.rating.max) : '',
    photoData: '', photoName: '',
  };
}
const emptyDraft = (): Draft => ({
  name: '', active: true, firstName: '', lastName: '', nickname: '',
  birthDate: '', nationality: '', preferredFoot: '', primary: '', alternate: '',
  bio: '', notes: '', ratingMin: '', ratingMax: '',
  photoData: '', photoName: '',
});
function pts(row?: PlayerStat) {
  return row ? row.wins * 3 + row.draws : 0;
}
function efficiency(row?: PlayerStat) {
  return row?.played ? pts(row) / (row.played * 3) : 0;
}
function birthLabel(value: string) {
  if (!value) return 'Pendiente';
  const born = new Date(`${value}T00:00:00`),
    today = new Date();
  let age = today.getFullYear() - born.getFullYear();
  if (
    today.getMonth() < born.getMonth() ||
    (today.getMonth() === born.getMonth() && today.getDate() < born.getDate())
  )
    age--;
  return `${born.toLocaleDateString('es-ES')} · ${age} años`;
}

export function PlayersSection({
  competition,
  profiles,
  stats,
  games,
  tournaments,
  onSaved,
}: {
  competition: string;
  profiles: Profile[];
  stats: PlayerStat[];
  games: Game[];
  tournaments: CompetitionStats['tournamentEditions'];
  onSaved: () => Promise<void>;
}) {
  const [search, setSearch] = useState(''),
    [selected, setSelected] = useState<Profile | null>(null),
    [creating, setCreating] = useState(false),
    [editing, setEditing] = useState(false),
    [draft, setDraft] = useState<Draft | null>(null),
    [message, setMessage] = useState(''),
    [saving, setSaving] = useState(false);
  const recentCutoff = activityCutoff();
  const scoped = useMemo(
    () =>
      profiles
        .filter((p) => p.competitions.includes(competition))
        .filter((p) =>
          `${p.name} ${p.nickname}`
            .toLowerCase()
            .includes(search.toLowerCase()),
        )
        .sort(
          (a, b) =>
            Number(hasRecentActivity(b.name, games, recentCutoff)) -
              Number(hasRecentActivity(a.name, games, recentCutoff)) ||
            ratingRangePosition(b.rating) - ratingRangePosition(a.rating) ||
            a.name.localeCompare(b.name),
        ),
    [profiles, competition, search, games, recentCutoff],
  );
  const inactive = useMemo(
    () => profiles
      .filter((player) => player.inactiveCompetitions?.includes(competition))
      .sort((a, b) => a.name.localeCompare(b.name)),
    [profiles, competition],
  );
  useEffect(() => {
    const requestedPlayer = new URLSearchParams(window.location.search).get('player');
    if (!requestedPlayer) return;
    const profile = profiles.find(
      (item) => item.id === Number(requestedPlayer) && item.competitions.includes(competition),
    );
    if (profile) {
      setSelected(profile);
      setDraft(draftOf(profile));
      setEditing(false);
      setCreating(false);
      const cleanUrl = new URL(window.location.href);
      cleanUrl.searchParams.delete('player');
      window.history.replaceState(null, '', cleanUrl);
    }
  }, [profiles, competition]);
  const row = selected
    ? stats.find((item) => item.name === selected.name)
    : undefined;
  const recentGames = useMemo(() => {
    if (!selected) return [];
    const cutoff = new Date();
    cutoff.setHours(0, 0, 0, 0);
    cutoff.setDate(cutoff.getDate() - 95);
    const cutoffDate = cutoff.toISOString().slice(0, 10);
    const today = new Date().toISOString().slice(0, 10);
    return games
      .filter(
        (game) =>
          game.status === 'verified' &&
          game.date >= cutoffDate &&
          game.date <= today &&
          (game.team1.includes(selected.name) ||
            game.team2.includes(selected.name)),
      )
      .sort(
        (a, b) => b.date.localeCompare(a.date) || Number(b.id) - Number(a.id),
      )
      .slice(0, 10);
  }, [games, selected]);
  const open = (player: Profile) => {
    setSelected(player);
    setDraft(draftOf(player));
    setEditing(false);
    setMessage('');
  };
  const close = () => {
    setSelected(null);
    setCreating(false);
    setEditing(false);
    setMessage('');
  };
  const field = (key: keyof Draft, value: string | boolean) =>
    setDraft((current) => (current ? { ...current, [key]: value } : current));
  const cancelEditing = () => {
    if (creating) {
      close();
      return;
    }
    if (selected) setDraft(draftOf(selected));
    setEditing(false);
    setMessage('');
  };
  const save = async () => {
    if ((!selected && !creating) || !draft) return;
    setSaving(true);
    setMessage('');
    try {
      const response = await fetch(creating ? `${API}/players` : `${API}/players/${selected!.id}`, {
        method: creating ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...draft, competition }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || 'No se pudo guardar');
      await onSaved();
      close();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  };
  const removeFromCompetition = async () => {
    if (!selected || !window.confirm(
      `¿Quitar a ${selected.name} de ${competition === 'sarria' ? 'Sarrià' : 'Bogatell'}? Sus partidos y estadísticas históricas no se borrarán.`,
    )) return;
    setSaving(true);
    setMessage('');
    try {
      const response = await fetch(`${API}/players/${selected.id}?competition=${competition}`, { method: 'DELETE' });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || 'No se pudo quitar al jugador');
      await onSaved();
      close();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo quitar al jugador');
    } finally {
      setSaving(false);
    }
  };
  const reactivate = async (player: Profile) => {
    setSaving(true);
    setMessage('');
    try {
      const response = await fetch(`${API}/players/${player.id}/reactivate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ competition }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || 'No se pudo reactivar al jugador');
      await onSaved();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo reactivar al jugador');
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="players-section">
      <div className="players-toolbar">
        <label>
          <Search />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por nombre o apodo…"
          />
        </label>
        <div className="players-toolbar-actions">
          <span>{scoped.length} jugadores de {competition === 'sarria' ? 'Sarrià' : 'Bogatell'}</span>
          <PlayerComparison profiles={scoped} stats={stats} games={games} tournaments={tournaments} />
          <button onClick={() => { setCreating(true); setSelected(null); setDraft(emptyDraft()); setEditing(true); setMessage(''); }}>
            <Plus /> Agregar jugador
          </button>
        </div>
      </div>
      <div className="players-grid">
        {scoped.map((player) => {
          const stat = stats.find((item) => item.name === player.name),
            flag = countryFlag(player.nationality);
          return (
            <button
              key={player.id}
              className="player-directory-card"
              onClick={() => open(player)}
            >
              <PlayerAvatar
                name={player.name}
                className="player-directory-avatar"
              />
              <span>
                <strong>
                  {player.name}{' '}
                  <PrimeMomentBadge rating={player.rating} compact />
                  <RockBottomBadge rating={player.rating} compact />
                </strong>
                {player.nickname && <em>“{player.nickname}”</em>}
                <small>
                  {player.primary || 'Posición pendiente'}
                  {player.alternate ? ` · ${player.alternate}` : ''}
                </small>
              </span>
              {flag && (
                <span
                  className="directory-flag"
                  aria-label={player.nationality}
                  title={player.nationality}
                >
                  {flag}
                </span>
              )}
              {player.rating && <RatingRange rating={player.rating} compact />}
              <span className="directory-record">
                {stat?.played ?? 0} PJ · {Math.round(efficiency(stat) * 100)}%
              </span>
            </button>
          );
        })}
      </div>
      <details className="inactive-players">
        <summary>Jugadores inactivos ({inactive.length})</summary>
        <p>No aparecen en convocatorias nuevas, pero conservan todo su historial.</p>
        {inactive.length ? (
          <div>
            {inactive.map((player) => (
              <article key={player.id}>
                <PlayerAvatar name={player.name} className="size-10" />
                <span><strong>{player.name}</strong><small>{player.primary || 'Posición pendiente'}</small></span>
                <button onClick={() => void reactivate(player)} disabled={saving}>
                  <RotateCcw /> Reactivar
                </button>
              </article>
            ))}
          </div>
        ) : <p>No hay jugadores inactivos en esta competición.</p>}
      </details>
      <Dialog
        open={Boolean(selected) || creating}
        onOpenChange={(value) => {
          if (!value) close();
        }}
      >
        <DialogContent className="player-sheet">
          <DialogHeader>
            <DialogTitle className="font-display">
              Ficha del jugador
            </DialogTitle>
            <DialogDescription>
              Datos globales del jugador y estadísticas de la competición
              actual.
            </DialogDescription>
          </DialogHeader>
          {(selected || creating) && draft && (
            <div className="player-sheet-layout">
              <aside>
                {draft.photoData ? (
                  <img src={draft.photoData} alt="Vista previa" className="player-sheet-photo object-cover" />
                ) : (
                  <PlayerAvatar name={selected?.name || draft.name || 'Nuevo jugador'} className="player-sheet-photo" />
                )}
                <strong>{draft.name}</strong>
                {draft.nickname && <em>“{draft.nickname}”</em>}
                {!creating && <button onClick={() => editing ? cancelEditing() : setEditing(true)}>
                  <Pencil /> {editing ? 'Cancelar edición' : 'Editar jugador'}
                </button>}
                {!creating && <button className="remove-player" onClick={() => void removeFromCompetition()} disabled={saving}>
                  <UserMinus /> Quitar de {competition === 'sarria' ? 'Sarrià' : 'Bogatell'}
                </button>}
              </aside>
              <section>
                {editing ? (
                  <PlayerForm draft={draft} field={field} />
                ) : (
                  <PlayerDetails
                    player={selected!}
                    stat={row}
                    recentGames={recentGames}
                    competition={competition}
                    tournaments={tournaments}
                  />
                )}{' '}
                {message && (
                  <p
                    className={
                      message.includes('guardados')
                        ? 'player-save-ok'
                        : 'player-save-error'
                    }
                  >
                    {message}
                  </p>
                )}
                {editing && (
                  <div className="player-form-actions">
                    <button onClick={cancelEditing}>Cancelar</button>
                    <button onClick={() => void save()} disabled={saving}>
                      {saving ? 'Guardando…' : creating ? 'Crear jugador' : 'Guardar cambios'}
                    </button>
                  </div>
                )}
              </section>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PlayerDetails({
  player,
  stat,
  recentGames,
  competition,
  tournaments,
}: {
  player: Profile;
  stat?: PlayerStat;
  recentGames: Game[];
  competition: string;
  tournaments: CompetitionStats['tournamentEditions'];
}) {
  const r = player.rating,
    flag = countryFlag(player.nationality),
    titles = tournaments.filter((tournament) =>
      tournament.champions.includes(player.name),
    );
  return (
    <div className="player-detail-grid">
      <Info
        label="Nombre completo"
        value={`${player.firstName} ${player.lastName}`.trim() || player.name}
      />
      <Info label="Apodo" value={player.nickname || 'Pendiente'} />
      <Info label="Nacimiento" value={birthLabel(player.birthDate)} />
      <Info
        label="Nacionalidad"
        value={`${flag ? `${flag} ` : ''}${player.nationality || 'Pendiente'}`}
      />
      <Info label="Pierna hábil" value={player.preferredFoot || 'Pendiente'} />
      <Info
        label="Posiciones"
        value={
          [player.primary, player.alternate].filter(Boolean).join(' · ') ||
          'Pendiente'
        }
      />
      <Info
        label="Partidos consecutivos"
        value={`${player.consecutiveAppearances ?? 0}`}
      />
      <div className="player-biography">
        <strong>Descripción</strong>
        <p>{player.bio || 'Todavía no hay una descripción cargada.'}</p>
      </div>
      <AchievementPatches achievements={player.achievements ?? []} />
      <div className="player-titles">
        <strong>Torneos ganados</strong>
        {titles.length ? (
          <div>
            {titles.map((tournament) => (
              <button
                type="button"
                key={tournament.id}
                onClick={() =>
                  window.location.assign(
                    `/?competition=${encodeURIComponent(competition)}&view=tournaments&tournament=${tournament.id}&returnPlayer=${player.id}`,
                  )
                }
                title={`Ver detalles de ${tournament.displayName}`}
              >
                <Trophy />
                <span>{tournament.displayName}</span>
              </button>
            ))}
          </div>
        ) : (
          <p>Sin torneos ganados en esta competición.</p>
        )}
      </div>
      <Info
        label="Rango de nivel"
        value={r ? `${r.min.toFixed(1)}–${r.max.toFixed(1)}` : 'Pendiente'}
      />
      <Info
        label="Nivel actual"
        value={r ? r.current.toFixed(2) : 'Sin calcular'}
      />
      <PrimeMomentBadge rating={r} />
      <RockBottomBadge rating={r} />
      {r && <RatingRange rating={r} />}
      {r && <PlayerRatingHistory rating={r} points={player.ratingHistory ?? []} />}
      <div className="player-rating-note">
        <ShieldCheck />
        <span>
          {r
            ? r.dynamic
              ? `${r.recentMatches} partidos válidos en los últimos ${r.windowDays} días.`
              : `Nivel medio: menos de 5 partidos en ${r.windowDays} días.`
            : 'Definí un rango para activar el cálculo dinámico.'}
        </span>
      </div>
      {r?.absencePenalty && (
        <div className="player-absence-penalty">
          <span>−{r.absencePenaltyPercent}%</span>
          <p>
            Lleva <strong>{r.missedMatches} ausencias consecutivas</strong>. La
            penalización se activa desde la tercera ausencia.
          </p>
        </div>
      )}
      {r && <RecentRatingMatches player={player.name} games={recentGames} />}
      <div className="player-stat-strip">
        <b>
          {stat?.played ?? 0}
          <small>PJ</small>
        </b>
        <b>
          {stat?.wins ?? 0}
          <small>G</small>
        </b>
        <b>
          {stat?.draws ?? 0}
          <small>E</small>
        </b>
        <b>
          {stat?.losses ?? 0}
          <small>P</small>
        </b>
        <b>
          {pts(stat)}
          <small>PTS</small>
        </b>
        <b>
          {Math.round(efficiency(stat) * 100)}%<small>EFEC.</small>
        </b>
      </div>
    </div>
  );
}

function RecentRatingMatches({
  player,
  games,
}: {
  player: string;
  games: Game[];
}) {
  return (
    <details className="player-recent-rating">
      <summary className="player-recent-heading">
        <span>
          <strong>Partidos usados para el nivel</strong>
          <small>{games.length}/10 · últimos 95 días</small>
        </span>
        <ChevronDown aria-hidden="true" />
      </summary>
      {games.length ? (
        <div className="player-recent-list">
          {games.map((game) => {
            const team = game.team1.includes(player) ? '1' : '2';
            const result =
              game.outcome === 'D' ? 'E' : game.outcome === team ? 'G' : 'P';
            const score =
              game.score1 === null || game.score2 === null
                ? 'Marcador no disponible'
                : `${game.score1}–${game.score2}`;
            const rival = team === '1' ? game.team2 : game.team1;
            return (
              <article key={game.id}>
                <span
                  className={`recent-result recent-result-${result.toLowerCase()}`}
                >
                  {result}
                </span>
                <span>
                  <strong>
                    {new Date(`${game.date}T00:00:00`).toLocaleDateString(
                      'es-ES',
                    )}
                  </strong>
                  <small>
                    {game.competition === 'sarria' ? 'Sarrià' : 'Bogatell'} ·
                    vs. {rival.join(', ')}
                  </small>
                </span>
                <b>{score}</b>
              </article>
            );
          })}
        </div>
      ) : (
        <p>No hay partidos válidos dentro de la ventana actual.</p>
      )}
    </details>
  );
}
function RatingRange({
  rating,
  compact = false,
}: {
  rating: NonNullable<Profile['rating']>;
  compact?: boolean;
}) {
  const span = rating.max - rating.min,
    position = span
      ? Math.max(0, Math.min(100, ((rating.current - rating.min) / span) * 100))
      : 50,
    status =
      position < 20
        ? 'red'
        : position < 40
          ? 'orange'
          : position < 60
            ? 'yellow'
            : position < 80
              ? 'lime'
              : 'green',
    label =
      status === 'red'
        ? 'Momento muy bajo'
        : status === 'orange'
          ? 'Momento bajo'
          : status === 'yellow'
            ? 'Momento medio'
            : status === 'lime'
              ? 'Momento bueno'
              : 'Momento excelente';
  return (
    <div
      className={`rating-range rating-range-${status} ${compact ? 'rating-range-compact' : ''}`}
    >
      <div className="rating-range-heading">
        <span>
          {compact ? 'Momento personal' : 'Momento dentro de su rango'}
        </span>
        <strong title="Rojo 0–19 · naranja 20–39 · amarillo 40–59 · verde claro 60–79 · verde 80–100">
          {Math.round(position)}%
        </strong>
      </div>
      <div className="rating-range-track" aria-label={`Escala gradual: ${Math.round(position)} por ciento`}>
        <span
          className="rating-range-marker"
          style={{
            left: `${position}%`,
            background: `hsl(${position * 1.2} 72% 40%)`,
          }}
        />
      </div>
      <div className="rating-range-labels">
        <span>{rating.min.toFixed(1)}</span>
        {!compact && (
          <b>
            {rating.current.toFixed(2)} · {label}
          </b>
        )}
        <span>{rating.max.toFixed(1)}</span>
      </div>
    </div>
  );
}
function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="player-info">
      <small>{label}</small>
      <strong>{value}</strong>
    </div>
  );
}
function PlayerForm({
  draft,
  field,
}: {
  draft: Draft;
  field: (key: keyof Draft, value: string | boolean) => void;
}) {
  return (
    <div className="player-edit-form">
      <label className="player-form-wide player-photo-field">
        Foto del jugador
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            if (file.size > 5 * 1024 * 1024) {
              event.target.value = '';
              window.alert('La foto no puede superar los 5 MB.');
              return;
            }
            const reader = new FileReader();
            reader.onload = () => {
              field('photoData', String(reader.result || ''));
              field('photoName', file.name);
            };
            reader.readAsDataURL(file);
          }}
        />
        <small>{draft.photoName ? `Seleccionada: ${draft.photoName}` : 'JPG, PNG o WebP · máximo 5 MB.'}</small>
      </label>
      <label>
        Nombre visible
        <input
          value={draft.name}
          onChange={(e) => field('name', e.target.value)}
          autoComplete="off"
        />
      </label>
      <label>
        Nombre
        <input
          value={draft.firstName}
          onChange={(e) => field('firstName', e.target.value)}
        />
      </label>
      <label>
        Apellido
        <input
          value={draft.lastName}
          onChange={(e) => field('lastName', e.target.value)}
        />
      </label>
      <label>
        Apodo
        <input
          value={draft.nickname}
          onChange={(e) => field('nickname', e.target.value)}
          autoComplete="off"
        />
      </label>
      <label>
        Nacimiento
        <input
          type="date"
          value={draft.birthDate}
          onChange={(e) => field('birthDate', e.target.value)}
        />
        <small>La edad se obtiene automáticamente desde esta fecha.</small>
      </label>
      <label>
        Nacionalidad
        <input
          list="player-country-options"
          value={draft.nationality}
          onChange={(e) => field('nationality', e.target.value)}
          placeholder="Escribí para buscar…"
          autoComplete="country-name"
        />
        <datalist id="player-country-options" aria-label="Países disponibles">
          {countries.map((country) => (
            <option key={country} value={country}>
              {country}
            </option>
          ))}
        </datalist>
        <small>Podés escribir para filtrar la lista.</small>
      </label>
      <label>
        Pierna hábil
        <select
          value={draft.preferredFoot}
          onChange={(e) => field('preferredFoot', e.target.value)}
        >
          <option value="">Pendiente</option>
          <option>Izquierda</option>
          <option>Derecha</option>
          <option>Ambas</option>
        </select>
      </label>
      <label>
        Posición principal
        <select
          value={draft.primary}
          onChange={(e) => field('primary', e.target.value)}
        >
          <option value="" disabled>
            Elegir posición
          </option>
          {positions.map((position) => (
            <option key={position}>{position}</option>
          ))}
        </select>
      </label>
      <label>
        Posición alternativa
        <select
          value={draft.alternate}
          onChange={(e) => field('alternate', e.target.value)}
        >
          <option value="">Sin alternativa</option>
          {positions
            .filter((p) => p !== draft.primary)
            .map((position) => (
              <option key={position}>{position}</option>
            ))}
        </select>
      </label>
      <label>
        Nivel mínimo
        <input
          type="number"
          list="player-rating-options"
          min="1"
          max="10"
          step="0.1"
          value={draft.ratingMin}
          onChange={(e) => field('ratingMin', e.target.value)}
          placeholder="1 a 10"
        />
      </label>
      <label>
        Nivel máximo
        <input
          type="number"
          list="player-rating-options"
          min="1"
          max="10"
          step="0.1"
          value={draft.ratingMax}
          onChange={(e) => field('ratingMax', e.target.value)}
          placeholder="1 a 10"
        />
        <datalist id="player-rating-options" aria-label="Niveles sugeridos">
          {ratingSuggestions.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </datalist>
      </label>
      <label>
        Estado
        <select
          value={draft.active ? 'active' : 'inactive'}
          onChange={(e) => field('active', e.target.value === 'active')}
        >
          <option value="active">Activo</option>
          <option value="inactive">Inactivo</option>
        </select>
      </label>
      <label className="player-form-wide">
        Bio
        <textarea
          value={draft.bio}
          onChange={(e) => field('bio', e.target.value)}
          placeholder="Información adicional del jugador…"
        />
      </label>
    </div>
  );
}
