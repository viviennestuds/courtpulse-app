import type { OnOffRatingStats, OnCourtDetailedStats } from '@/types';
import type {
  MetricConfidence,
  MetricAuditIssue,
  OnCourtValidationSnapshot,
  OnCourtSplitSnapshot,
} from '@/types/metricValidation';

const HIGH_ON_POSS_THRESHOLD = 40;
const HIGH_OFF_POSS_THRESHOLD = 20;
const MEDIUM_ON_POSS_THRESHOLD = 25;
const MEDIUM_OFF_POSS_THRESHOLD = 10;

export interface SampleConfidenceResult {
  confidence: MetricConfidence;
  likelyIssue?: MetricAuditIssue;
}

/**
 * Sample-size confidence using CourtPulse-derived ON/OFF possessions only.
 *
 * This does NOT validate values against PBPStats or any external benchmark.
 * It is a heuristic label that warns when the off-court sample is small.
 */
export function evaluateSampleConfidence(
  onPossessions: number,
  offPossessions: number,
): SampleConfidenceResult {
  if (onPossessions >= HIGH_ON_POSS_THRESHOLD && offPossessions >= HIGH_OFF_POSS_THRESHOLD) {
    return { confidence: 'high' };
  }
  if (onPossessions >= MEDIUM_ON_POSS_THRESHOLD && offPossessions >= MEDIUM_OFF_POSS_THRESHOLD) {
    const result: SampleConfidenceResult = { confidence: 'medium' };
    if (offPossessions < HIGH_OFF_POSS_THRESHOLD) {
      result.likelyIssue = 'sample_size';
    }
    return result;
  }
  return { confidence: 'low', likelyIssue: 'sample_size' };
}

/**
 * Build an on/off validation snapshot from CourtPulse-derived values only.
 *
 * Returns null when required inputs are missing. Future PBPStats validation
 * can populate the same shape with `source: 'pbpstats_pending'` then
 * `source: 'courtpulse'` deltas can be compared client-side.
 */
export function buildOnCourtValidationSnapshot(params: {
  gameId: string;
  teamId: string;
  playerId: string;
  detailedStats: OnCourtDetailedStats | null;
  onOffStats: OnOffRatingStats | null;
}): OnCourtValidationSnapshot | null {
  const { gameId, teamId, playerId, detailedStats, onOffStats } = params;
  if (!onOffStats) return null;

  const on: OnCourtSplitSnapshot = {
    minutes: onOffStats.onMinutes,
    possessions: onOffStats.onPossessions,
    pointsFor: onOffStats.onPointsFor,
    pointsAgainst: onOffStats.onPointsAllowed,
    offRtg: onOffStats.onOffensiveRating,
    defRtg: onOffStats.onDefensiveRating,
    netRtg: onOffStats.onNetRating,
  };

  const off: OnCourtSplitSnapshot = {
    minutes: onOffStats.offMinutes,
    possessions: onOffStats.offPossessions,
    pointsFor: onOffStats.offPointsFor,
    pointsAgainst: onOffStats.offPointsAllowed,
    offRtg: onOffStats.offOffensiveRating,
    defRtg: onOffStats.offDefensiveRating,
    netRtg: onOffStats.offNetRating,
  };

  const { confidence, likelyIssue } = evaluateSampleConfidence(
    on.possessions,
    off.possessions,
  );

  // Touch detailedStats so future audits can cross-check ON-side aggregates.
  void detailedStats;

  const snapshot: OnCourtValidationSnapshot = {
    source: 'courtpulse',
    gameId,
    teamId,
    playerId,
    on,
    off,
    onOffNet: onOffStats.onOffRating,
    confidence,
  };
  if (likelyIssue) snapshot.likelyIssue = likelyIssue;
  return snapshot;
}

export function formatPossessionSample(
  onPossessions: number,
  offPossessions: number,
): string {
  return `${onPossessions} ON possessions \u00b7 ${offPossessions} OFF possessions`;
}
