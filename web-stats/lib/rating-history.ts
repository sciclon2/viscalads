import type { PlayerRatingPoint } from '@/lib/stats-context';

export type RatingHistoryWindow = '20' | 'year' | 'all';
export type RatingHistoryScale = 'personal' | 'global';

export function ratingHistoryDomain(min: number, max: number, scale: RatingHistoryScale) {
  return scale === 'personal' ? { min: 0, max: 10 } : { min: 1, max: 10 };
}

export function ratingHistoryValue(value: number, min: number, max: number, scale: RatingHistoryScale) {
  if (scale === 'global') return value;
  if (max <= min) return 5;
  return Math.max(0, Math.min(10, ((value - min) / (max - min)) * 10));
}

export function ratingHistoryWindow(
  points: PlayerRatingPoint[],
  option: RatingHistoryWindow,
) {
  if (option === '20') return points.slice(-20);
  if (option === 'all' || !points.length) return points;
  const latest = new Date(`${points.at(-1)!.date}T00:00:00`);
  latest.setFullYear(latest.getFullYear() - 1);
  const cutoff = latest.toISOString().slice(0, 10);
  return points.filter((point) => point.date >= cutoff);
}
