import { Crown, Skull } from 'lucide-react';
import type { PlayerRating } from '@/lib/stats-context';
import { isPrimeMoment, isRockBottom } from '@/lib/player-rating';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export function PrimeMomentBadge({
  rating,
  compact = false,
  className,
}: {
  rating: PlayerRating | null | undefined;
  compact?: boolean;
  className?: string;
}) {
  if (!isPrimeMoment(rating)) return null;

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            className={cn(
              'prime-moment-badge',
              compact && 'prime-moment-badge-compact',
              className,
            )}
            aria-label="Prime Moment"
          />
        }
      >
        <Crown aria-hidden="true" />
      </TooltipTrigger>
      <TooltipContent sideOffset={7} className="prime-moment-tooltip">
        Prime Moment
      </TooltipContent>
    </Tooltip>
  );
}

export function RockBottomBadge({
  rating,
  compact = false,
  className,
}: {
  rating: PlayerRating | null | undefined;
  compact?: boolean;
  className?: string;
}) {
  if (!isRockBottom(rating)) return null;

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            className={cn(
              'rock-bottom-badge',
              compact && 'rock-bottom-badge-compact',
              className,
            )}
            aria-label="Rock Bottom"
          />
        }
      >
        <Skull aria-hidden="true" />
      </TooltipTrigger>
      <TooltipContent sideOffset={7} className="rock-bottom-tooltip">
        Rock Bottom
      </TooltipContent>
    </Tooltip>
  );
}
