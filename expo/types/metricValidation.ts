/**
 * Internal metric validation/audit types.
 *
 * These types are scaffolding for a future PBPStats-backed validation layer.
 * They are NOT used to fetch external data yet. For now, all snapshots are
 * built from CourtPulse-derived values only (`source: 'courtpulse'`), and the
 * `pbpstats_pending` source is reserved for future backend integration.
 */

export type MetricConfidence = 'high' | 'medium' | 'low';

export type MetricAuditIssue =
  | 'possession_count'
  | 'lineup_tracking'
  | 'points_assignment'
  | 'sample_size'
  | 'unknown';

export interface OnCourtMetricAuditResult {
  statKey: string;
  playerId: string;
  teamId: string;
  gameId: string;
  courtPulseValue: number | null;
  benchmarkValue?: number | null;
  delta?: number | null;
  confidence: MetricConfidence;
  likelyIssue?: MetricAuditIssue;
  notes?: string;
}

export interface OnCourtSplitSnapshot {
  minutes: number;
  possessions: number;
  pointsFor: number;
  pointsAgainst: number;
  offRtg: number | null;
  defRtg: number | null;
  netRtg: number | null;
}

export interface OnCourtValidationSnapshot {
  source: 'courtpulse' | 'pbpstats_pending';
  gameId: string;
  teamId: string;
  playerId: string;
  on: OnCourtSplitSnapshot;
  off: OnCourtSplitSnapshot;
  onOffNet: number | null;
  confidence: MetricConfidence;
  likelyIssue?: MetricAuditIssue;
}
