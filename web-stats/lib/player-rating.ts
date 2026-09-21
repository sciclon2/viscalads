export type RatingRange = {
  min: number;
  max: number;
  current: number;
  stale?: boolean;
};

export function ratingRangePosition(rating: RatingRange | null | undefined) {
  if (!rating || rating.max <= rating.min) return 0.5;
  return Math.max(
    0,
    Math.min(1, (rating.current - rating.min) / (rating.max - rating.min)),
  );
}

export function isPrimeMoment(rating: RatingRange | null | undefined) {
  return Boolean(rating) && !rating?.stale && ratingRangePosition(rating) >= 0.8;
}

export function isRockBottom(rating: RatingRange | null | undefined) {
  return Boolean(rating) && !rating?.stale && ratingRangePosition(rating) <= 0.2;
}
