'use client';

import { useState, type CSSProperties } from 'react';
import { Award, CalendarCheck, CircleDot, Flame, Gem, Handshake, Infinity, Medal, ShieldCheck, Swords, Trophy, type LucideIcon } from 'lucide-react';
import type { Profile } from '@/lib/stats-context';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

type Achievement = Profile['achievements'][number];
const designs: Record<string, { colors: [string, string]; Icon: LucideIcon }> = {
  veteran: { colors: ['#174b73', '#9ed8ee'], Icon: Medal }, centenary: { colors: ['#8f1d35', '#ffc2cf'], Icon: Award },
  champion: { colors: ['#b07808', '#ffe487'], Icon: Trophy }, unbeaten_champion: { colors: ['#075e54', '#9de4cf'], Icon: ShieldCheck },
  winning_streak: { colors: ['#bd3425', '#ffbd6d'], Icon: Flame }, unbeaten: { colors: ['#176b55', '#89e0ba'], Icon: Infinity },
  scorer: { colors: ['#3064a8', '#c8dcff'], Icon: CircleDot }, always_present: { colors: ['#066b70', '#a9e0dd'], Icon: CalendarCheck },
  partnership: { colors: ['#9b3b78', '#f3badc'], Icon: Handshake }, nemesis: { colors: ['#631e27', '#e79486'], Icon: Swords },
  prime_streak: { colors: ['#9a6900', '#fff0a0'], Icon: Gem },
};
const tierColors: Record<string, [string, string]> = {
  Bronce: ['#7a431f', '#e8b37a'],
  Plata: ['#46515d', '#dce3e8'],
  Oro: ['#8a5a00', '#ffe071'],
  Legendario: ['#542571', '#e3b7f5'],
};
const achievementGroups = [
  { title: 'Trayectoria', codes: ['veteran', 'centenary', 'champion', 'unbeaten_champion', 'always_present'] },
  { title: 'Rendimiento', codes: ['winning_streak', 'unbeaten', 'scorer', 'prime_streak'] },
  { title: 'Conexiones', codes: ['partnership', 'nemesis'] },
];

function dateLabel(value: string | null) {
  return value ? new Date(`${value}T00:00:00`).toLocaleDateString('es-ES') : 'Fecha histórica no disponible';
}

function achievementDateLabel(achievement: Achievement) {
  if (!achievement.earnedAt) return 'Fecha histórica no disponible';
  if (achievement.earnedFrom && achievement.earnedFrom !== achievement.earnedAt) {
    return `Del ${dateLabel(achievement.earnedFrom)} al ${dateLabel(achievement.earnedAt)}`;
  }
  return `Conseguido el ${dateLabel(achievement.earnedAt)}`;
}

function achievementContext(achievement: Achievement) {
  const contexts: Record<string, string> = {
    veteran: 'Este recorrido cuenta sus partidos verificados en esta competencia.',
    centenary: 'Una marca reservada para quienes alcanzaron cien partidos en esta competencia.',
    champion: 'El nivel del parche mejora según la cantidad de torneos ganados.',
    unbeaten_champion: 'Reconoce un campeonato completo sin derrotas en esa edición.',
    winning_streak: 'La racha reúne victorias consecutivas, sin empates ni derrotas entre ellas.',
    unbeaten: 'Durante ese período encadenó partidos sin conocer la derrota.',
    scorer: 'El parche reconoce los goles registrados en los partidos de esta competencia.',
    always_present: 'La racha refleja fechas consecutivas en las que estuvo presente.',
    partnership: 'Reconoce las victorias conseguidas compartiendo equipo con esa misma dupla.',
    nemesis: 'Reconoce las victorias obtenidas enfrentando a ese mismo rival.',
    prime_streak: 'Durante toda la racha se mantuvo en el 80% o más de su rango personal.',
  };
  return contexts[achievement.code] ?? 'Este logro resume una marca destacada de su historial.';
}

function progressLabel(achievement: Achievement) {
  const labels: Record<string, string> = {
    veteran: 'Partidos actuales', centenary: 'Partidos actuales', champion: 'Torneos ganados', unbeaten_champion: 'Torneos ganados invicto',
    winning_streak: 'Mejor racha ganadora', unbeaten: 'Mejor racha invicta', scorer: 'Goles registrados',
    always_present: 'Mejor asistencia consecutiva', partnership: 'Victorias como dupla',
    nemesis: 'Victorias ante ese rival', prime_streak: 'Mejor racha en Prime',
  };
  return labels[achievement.code] ?? 'Mejor marca';
}

function tierDescription(achievement: Achievement) {
  const tiers: Record<string, string> = {
    champion: 'Bronce: 1 torneo · Plata: 2 · Oro: 3 o más',
    winning_streak: 'Bronce: 5 victorias seguidas · Plata: 7 · Oro: 10',
    unbeaten: 'Bronce: 5 partidos · Plata: 8 · Oro: 12 · Legendario: 15',
    scorer: 'Bronce: 10 goles · Plata: 25 · Oro: 50 · Legendario: 100',
    partnership: 'Bronce: 10 victorias juntos · Plata: 20 · Oro: 30',
    nemesis: 'Bronce: 5 victorias ante el rival · Plata: 7 · Oro: 10',
    prime_streak: 'Bronce: 5 partidos en Prime · Plata: 7 · Oro: 10',
  };
  return tiers[achievement.code] ?? null;
}

function Patch({ achievement, onClick }: { achievement: Achievement; onClick: () => void }) {
  const design = designs[achievement.code] ?? { colors: ['#173d2a', '#b8d5c3'] as [string, string], Icon: ShieldCheck };
  const [dark, light] = achievement.level ? tierColors[achievement.level] ?? design.colors : design.colors;
  const Icon = design.Icon;
  return (
    <button type="button" className="achievement-patch" onClick={onClick} aria-label={`Ver logro ${achievement.title}`}>
      <span className="achievement-icon" style={{ '--patch-dark': dark, '--patch-light': light } as CSSProperties}>
        <Icon aria-hidden="true" />
      </span>
      <strong>{achievement.title}</strong>
      {achievement.level && <span className="achievement-level">{achievement.level}</span>}
    </button>
  );
}

export function AchievementPatches({ achievements }: { achievements: Achievement[] }) {
  const [selected, setSelected] = useState<Achievement | null>(null);
  if (!achievements.length) return null;
  const knownCodes = new Set(achievementGroups.flatMap((group) => group.codes));
  const grouped = achievementGroups
    .map((group) => ({ ...group, achievements: achievements.filter((item) => group.codes.includes(item.code)) }))
    .filter((group) => group.achievements.length);
  const uncategorized = achievements.filter((item) => !knownCodes.has(item.code));
  if (uncategorized.length) grouped.push({ title: 'Otros', codes: [], achievements: uncategorized });
  return (
    <section className="achievement-showcase">
      <div><strong>Parches desbloqueados</strong><span>{achievements.length}</span></div>
      <div className="achievement-groups">
        {grouped.map((group) => (
          <div className="achievement-group" key={group.title}>
            <h4>{group.title}</h4>
            <div className="achievement-grid">{group.achievements.map((achievement) => <Patch key={achievement.code} achievement={achievement} onClick={() => setSelected(achievement)} />)}</div>
          </div>
        ))}
      </div>
      <small>Hacé clic en un parche para conocer su historia.</small>
      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="achievement-dialog">
          {selected && <>
            <DialogHeader><DialogTitle className="font-display text-3xl">{selected.title}</DialogTitle><DialogDescription>{selected.level ? `Nivel ${selected.level}` : 'Logro especial'} · {achievementDateLabel(selected)}</DialogDescription></DialogHeader>
            <div className="achievement-dialog-body">
              <Patch achievement={selected} onClick={() => undefined} />
              <div>
                <strong>Cómo se consiguió</strong>
                <p>{selected.description}</p>
                {selected.progress !== null && <p className="achievement-progress">{progressLabel(selected)}: <b>{selected.progress}</b></p>}
                {tierDescription(selected) && <p className="achievement-tiers"><b>Niveles:</b> {tierDescription(selected)}</p>}
                <small>{achievementContext(selected)}</small>
              </div>
            </div>
          </>}
        </DialogContent>
      </Dialog>
    </section>
  );
}
