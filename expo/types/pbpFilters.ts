import type { PlayByPlayEvent } from '@/types';

export type PbpTeamFilter = 'home' | 'away' | 'both';
export type PbpSortOrder = 'newest' | 'oldest';
export type PbpEventCategory =
  | 'made_fg'
  | 'missed_fg'
  | 'free_throw'
  | 'rebound'
  | 'assist'
  | 'turnover'
  | 'steal'
  | 'block'
  | 'foul'
  | 'substitution'
  | 'timeout'
  | 'other';

export interface PbpPlayerOption {
  id: string;
  name: string;
  eventCount: number;
}

export interface PbpFilterQuery {
  team: PbpTeamFilter;
  period: number | null;
  clutchOnly: boolean;
  playerId: string | null;
  eventCategory: PbpEventCategory | 'all';
  sortOrder: PbpSortOrder;
}

export interface PbpClassifiedEvent extends PlayByPlayEvent {
  pbpCategory: PbpEventCategory;
  isClutchContext: boolean;
  sortIndex: number;
  involvedPlayerIds: string[];
}

export interface PbpFilterResult {
  events: PbpClassifiedEvent[];
  activeFilterCount: number;
}
