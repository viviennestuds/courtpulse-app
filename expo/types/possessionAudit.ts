/**
 * Possession Audit types.
 *
 * Developer-only diagnostic structures used to audit CourtPulse's possession
 * detection by separating offensive vs defensive possessions and comparing
 * against PBPStats benchmarks. These types do NOT replace any production
 * possession counts.
 */

export type PossessionEndingReason =
  | 'made_fg'
  | 'defensive_rebound'
  | 'turnover'
  | 'made_final_free_throw'
  | 'missed_final_free_throw_def_rebound'
  | 'team_rebound'
  | 'period_start'
  | 'period_end'
  | 'jump_ball_start'
  | 'jump_ball_change'
  | 'free_throw_sequence'
  | 'substitution_boundary'
  | 'unknown';

export type PossessionAuditIssue =
  | 'missing_team_rebound_change'
  | 'missed_free_throw_sequence'
  | 'period_start_not_initialized'
  | 'period_end_not_closed'
  | 'jump_ball_possession_unclear'
  | 'turnover_not_counted'
  | 'defensive_rebound_not_counted'
  | 'substitution_during_dead_ball'
  | 'lineup_gap'
  | 'off_def_possession_mismatch'
  | 'unknown';

export interface CourtPulsePossessionAuditRow {
  id: string;
  gameId: string;
  period: number;
  offenseTeamId: string | null;
  defenseTeamId: string | null;
  startEventId: string | number | null;
  endEventId: string | number | null;
  startClock: string | null;
  endClock: string | null;
  pointsScored: number;
  endingReason: PossessionEndingReason;
  offensivePlayers: string[];
  defensivePlayers: string[];
  rawEvents: unknown[];
  issues: PossessionAuditIssue[];
}

export interface PlayerPossessionAuditSample {
  playerId: string;
  teamId: string;
  gameId: string;
  offensivePossessions: number;
  defensivePossessions: number;
  pointsFor: number;
  pointsAgainst: number;
  minutes: number;
}

export interface PbpStatsPossessionBenchmark {
  playerId: string;
  playerName?: string;
  teamId: string;
  gameId: string;
  minutes: number | null;
  offPoss: number | null;
  defPoss: number | null;
  offRtg: number | null;
  defRtg: number | null;
  netRtg: number | null;
  usage?: number | null;
  penaltyOffPoss?: number | null;
  penaltyDefPoss?: number | null;
  secondChanceOffPoss?: number | null;
  rawMinutes?: string | number | null;
  raw?: unknown;
}

export type PbpStatsBenchmarkSource = 'game-stats' | 'on-off-fallback';

export type PbpStatsPlayerMatchedBy =
  | 'EntityId'
  | 'PlayerId'
  | 'Name'
  | 'ShortName'
  | 'NormalizedName'
  | 'none';

export interface PbpStatsBenchmarkDebug {
  source: PbpStatsBenchmarkSource | null;
  endpoint: string | null;
  rawResultKeys: string[];
  candidateRowsCount: number;
  matchedRowsCount: number;
  matchedBy: PbpStatsPlayerMatchedBy;
  selectedRowIndex: number | null;
  selectedRowReason: string | null;
  selectedRowPreview: Record<string, unknown> | null;
  firstCandidatePreview: Record<string, unknown> | null;
  fallbackUsed: boolean;
  primaryError: string | null;
}

export interface PossessionAuditDeltas {
  minutesDelta: number | null;
  offensivePossessionsDelta: number | null;
  defensivePossessionsDelta: number | null;
  offRtgDelta: number | null;
  defRtgDelta: number | null;
  netRtgDelta: number | null;
}

export interface PossessionAuditComparison {
  courtPulse: PlayerPossessionAuditSample;
  pbpStats?: PbpStatsPossessionBenchmark;
  deltas: PossessionAuditDeltas;
  likelyIssues: PossessionAuditIssue[];
  notes: string[];
}
