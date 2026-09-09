'use client';

import { createContext, useContext } from 'react';

export type PlayerRating = {
  min: number;
  max: number;
  current: number;
  midpoint: number;
  recentMatches: number;
  formScore: number;
  dynamic: boolean;
  windowDays: number;
  missedMatches: number;
  absencePenalty: boolean;
  absencePenaltyPercent: number;
};
export type Profile = {
  id: number;
  name: string;
  active: boolean;
  notes: string;
  photo: string;
  primary: string;
  alternate: string;
  competitions: string[];
  inactiveCompetitions: string[];
  firstName: string;
  lastName: string;
  nickname: string;
  birthDate: string;
  nationality: string;
  preferredFoot: string;
  bio: string;
  rating: PlayerRating | null;
  consecutiveAppearances?: number;
  achievements: {
    code: string;
    title: string;
    description: string;
    earnedFrom: string | null;
    earnedAt: string | null;
    level: string | null;
    progress: number | null;
  }[];
};
export type StatRow = {
  name: string | string[];
  played: number;
  wins: number;
  draws: number;
  losses: number;
};
export type PlayerStat = StatRow & { name: string };
export type GroupStat = StatRow & { name: string[] };
export type Game = {
  id: number;
  date: string;
  tournament: string;
  competition: string;
  team1: string[];
  team2: string[];
  score1: number | null;
  score2: number | null;
  outcome: '1' | '2' | 'D' | '?';
  quality: string;
  status: string;
  evidence: string;
  notes: string;
  guests?: { guest_label: string; team_no: number }[];
  goals?: {
    team_no: number;
    goal_count: number;
    player_name: string | null;
    guest_label: string | null;
  }[];
};
export type Venue = {
  slug: string;
  display_name: string;
  image_url: string;
  role: string;
  group_schedule: string;
  description: string;
  address: string;
  public_hours: string;
  phone: string;
  maps_url: string;
  image_source_url: string;
  facts: { category: string; fact_text: string }[];
  photos: {
    taken_on: string | null;
    image_url: string;
    caption: string;
    photo_type: string;
    source_url: string;
  }[];
};
export type CompetitionStats = {
  players: PlayerStat[];
  pairs: GroupStat[];
  trios: GroupStat[];
  tournaments: Record<string, PlayerStat[]>;
  games: Game[];
  champions: { tournament: string; winner: string }[];
  tournamentEditions: {
    id: number;
    code: string;
    displayName: string;
    startsOn: string | null;
    endsOn: string | null;
    matchdayCount: number;
    matchCount: number;
    champions: string[];
    rules: {
      code: string;
      threshold: number;
      pointsDelta: number;
      description: string;
    }[];
    standings: {
      playerId: number;
      name: string;
      played: number;
      wins: number;
      draws: number;
      losses: number;
      goals: number;
      bonusMatches: number;
      positivePoints: number;
      penalizedMatches: number;
      negativePoints: number;
      basePoints: number;
      totalPoints: number;
    }[];
  }[];
  venues: Venue[];
  ratings: Record<string, PlayerRating>;
  appearanceStreaks: Record<string, number>;
  achievements: Record<string, Profile['achievements']>;
};
export type StatsData = {
  competitions: { slug: string; display_name: string; match_count: number }[];
  competitionStats: Record<string, CompetitionStats>;
  games: Game[];
  profiles: Profile[];
  venues: Venue[];
  players: PlayerStat[];
  pairs: GroupStat[];
  trios: GroupStat[];
  tournaments: Record<string, PlayerStat[]>;
  champions: { tournament: string; winner: string }[];
  funnyFactRules: { code: string; title: string; description: string; priority: number; scope: 'competition' | 'global' }[];
};

const StatsContext = createContext<StatsData | null>(null);
export function StatsDataProvider({
  data,
  children,
}: {
  data: StatsData;
  children: React.ReactNode;
}) {
  return <StatsContext.Provider value={data}>{children}</StatsContext.Provider>;
}
export function useStatsData() {
  const value = useContext(StatsContext);
  if (!value) throw new Error('StatsDataProvider ausente');
  return value;
}
