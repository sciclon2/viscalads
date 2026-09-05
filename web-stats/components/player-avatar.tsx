'use client';

import { cn } from '@/lib/utils';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { useStatsData } from '@/lib/stats-context';

function displayDate(value: string) {
  if (!value) return 'Pendiente';
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}

function ProfileDetails({ name }: { name: string }) {
  const { profiles } = useStatsData();
  const profileByName = new Map(profiles.map((profile) => [profile.name, profile]));
  const profile = profileByName.get(name);
  return (
    <>
      <strong>
        {profile?.firstName || name} {profile?.lastName || ''}
        {profile?.nationality === 'Argentina' && (
          <span className="profile-flag" aria-label="Argentina">🇦🇷</span>
        )}
      </strong>
      {profile?.nickname && <em>“{profile.nickname}”</em>}
      <span><b>Nacimiento</b>{displayDate(profile?.birthDate || '')}</span>
      <span><b>Nacionalidad</b>{profile?.nationality || 'Pendiente'}</span>
      <span><b>Pierna hábil</b>{profile?.preferredFoot || 'Pendiente'}</span>
      <span><b>Principal</b>{profile?.primary || 'Pendiente'}</span>
      <span><b>Alternativa</b>{profile?.alternate || '—'}</span>
    </>
  );
}

export function PlayerName({ name, className }: { name: string; className?: string }) {
  const { profiles } = useStatsData();
  const profileByName = new Map(profiles.map((profile) => [profile.name, profile]));
  if (!profileByName.has(name)) return <span className={className}>{name}</span>;
  return (
    <HoverCard>
      <HoverCardTrigger
        render={<span className={cn('player-name-hover', className)} />}
        delay={150}
        closeDelay={80}
      >
        {name}
      </HoverCardTrigger>
      <HoverCardContent side="top" sideOffset={8} className="player-profile-card">
        <ProfileDetails name={name} />
      </HoverCardContent>
    </HoverCard>
  );
}

export function PlayerAvatar({ name, className }: { name: string; className?: string }) {
  const { profiles } = useStatsData();
  const photoByName = new Map(profiles.map((profile) => [profile.name, profile.photo]));
  const photo = photoByName.get(name);
  const initials = name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase();
  return (
    <HoverCard>
      <HoverCardTrigger
        render={<span className="player-profile-hover" />}
        delay={150}
        closeDelay={80}
      >
        <span
          className={cn(
            'relative flex size-10 shrink-0 overflow-hidden rounded-full bg-[#dce7dc]',
            className,
          )}
        >
          {photo ? (
            <img className="size-full object-cover" src={photo} alt={name} />
          ) : (
            <span className="flex size-full items-center justify-center font-bold text-[#347a52]">
              {initials}
            </span>
          )}
        </span>
      </HoverCardTrigger>
      <HoverCardContent side="top" sideOffset={10} className="player-profile-card">
        <ProfileDetails name={name} />
      </HoverCardContent>
    </HoverCard>
  );
}
