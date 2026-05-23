/**
 * PBPStats external validation types.
 *
 * These types describe an app-side, developer-only diagnostic comparison
 * between CourtPulse-derived on/off snapshots and PBPStats. They are NOT
 * used to replace any user-facing values.
 */

import type { OnCourtValidationSnapshot } from '@/types/metricValidation';

export type PbpStatsValidationStatus =
  | 'idle'
  | 'loading'
  | 'success'
  | 'error'
  | 'unavailable';

export interface PbpStatsValidationError {
  message: string;
  endpoint?: string;
  statusCode?: number;
}

export interface PbpStatsOnOffSplit {
  minutes: number | null;
  possessions: number | null;
  pointsFor: number | null;
  pointsAgainst: number | null;
  offRtg: number | null;
  defRtg: number | null;
  netRtg: number | null;
}

export interface PbpStatsOnOffSnapshot {
  source: 'pbpstats';
  gameId: string;
  teamId: string;
  playerId: string;
  on: PbpStatsOnOffSplit;
  off: PbpStatsOnOffSplit;
  onOffNet: number | null;
  raw?: unknown;
}

export interface ExternalValidationDelta {
  minutesOnDelta: number | null;
  minutesOffDelta: number | null;
  possessionsOnDelta: number | null;
  possessionsOffDelta: number | null;
  pointsForOnDelta: number | null;
  pointsAgainstOnDelta: number | null;
  pointsForOffDelta: number | null;
  pointsAgainstOffDelta: number | null;
  offRtgOnDelta: number | null;
  defRtgOnDelta: number | null;
  netRtgOnDelta: number | null;
  offRtgOffDelta: number | null;
  defRtgOffDelta: number | null;
  netRtgOffDelta: number | null;
  onOffNetDelta: number | null;
}

export type ExternalValidationIssue =
  | 'lineup_or_substitution_tracking'
  | 'possession_detection'
  | 'points_assignment'
  | 'formula_or_rounding'
  | 'sample_size'
  | 'unknown';

export interface ExternalValidationComparison {
  status: PbpStatsValidationStatus;
  courtPulseSnapshot: OnCourtValidationSnapshot;
  pbpStatsSnapshot?: PbpStatsOnOffSnapshot;
  delta?: ExternalValidationDelta;
  likelyIssues: ExternalValidationIssue[];
  notes: string[];
  error?: PbpStatsValidationError;
  endpoint?: string;
}

export interface PbpStatsOnOffRequest {
  gameId: string;
  season: string;
  seasonType: 'Regular Season' | 'Playoffs';
  teamId: string;
  playerId: string;
  stat?: string;
}
