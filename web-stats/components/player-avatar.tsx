'use client';

import data from '@/lib/stats-data.json';
import { cn } from '@/lib/utils';

const photoByName = new Map(data.profiles.map((profile) => [profile.name, profile.photo]));

export function PlayerAvatar({ name, className }: { name: string; className?: string }) {
  const photo = photoByName.get(name);
  const initials = name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase();
  return (
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
  );
}
