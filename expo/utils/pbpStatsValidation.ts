/**
 * PBPStats validation utilities: URL building, defensive normalization,
 * comparison and mismatch classification. No network calls live here.
 */

import type { OnCourtValidationSnapshot } from '@/types/metricValidation';
import type {
  ExternalValidationComparison,
  ExternalValidationDelta,
  ExternalValidationIssue,
  PbpStatsOnOffRequest,
  PbpStatsOnOffSnapshot,
  PbpStatsOnOffSplit,
} from '@/types/pbpStatsValidation';

const PBPSTATS_BASE_URL = 'https://api.pbpstats.com/get-on-off/nba/player';
const PBPSTATS_GAME_STATS_URL = 'https://api.pbpstats.com/get-game-stats';

/**
 * Primary single-game stats endpoint.
 * Example:
 *   https://api.pbpstats.com/get-game-stats?GameId=0042400201&Type=Player
 */
export function buildPbpStatsGameStatsUrl(params: {
  gameId: string;
  type?: 'Player' | 'Team' | 'Lineup';
}): string {
  const qp = new URLSearchParams();
  qp.append('GameId', params.gameId);
  qp.append('Type', params.type ?? 'Player');
  return `${PBPSTATS_GAME_STATS_URL}?${qp.toString()}`;
}

/**
 * Convert PBPStats minutes string ("MM:SS") or numeric value to a decimal
 * minutes value. Returns null if the input cannot be parsed.
 * Example: "11:19" -> 11.316666...
 */
export function parseMinutesToDecimal(
  value: unknown,
): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.length === 0) return null;
    if (trimmed.includes(':')) {
      const parts = trimmed.split(':');
      if (parts.length === 2) {
        const m = parseInt(parts[0], 10);
        const s = parseInt(parts[1], 10);
        if (Number.isFinite(m) && Number.isFinite(s)) {
          return m + s / 60;
        }
      }
      return null;
    }
    const n = parseFloat(trimmed);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * Centralized URL builder. Keep PBPStats query-param shape changes contained
 * to this function so the rest of the app does not need updating.
 */
export function buildPbpStatsOnOffUrl(req: PbpStatsOnOffRequest): string {
  const qp = new URLSearchParams();
  qp.append('Season', req.season);
  qp.append('SeasonType', req.seasonType);
  qp.append('TeamId', req.teamId);
  qp.append('PlayerId', req.playerId);
  if (req.stat) {
    qp.append('Stat', req.stat);
  }
  // Note: GameId is intentionally excluded from this endpoint's query string.
  // Swagger does not list GameId as a supported param for /get-on-off/nba/player.
  // GameId is preserved on the request object for future endpoints that support it.
  return `${PBPSTATS_BASE_URL}?${qp.toString()}`;
}

export function safeNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const n = parseFloat(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function deriveNetRating(
  offRtg: number | null,
  defRtg: number | null,
): number | null {
  if (offRtg === null || defRtg === null) return null;
  return offRtg - defRtg;
}

export function deriveOnOffNet(
  onNet: number | null,
  offNet: number | null,
): number | null {
  if (onNet === null || offNet === null) return null;
  return onNet - offNet;
}

function pickField(obj: Record<string, unknown> | null, keys: string[]): unknown {
  if (!obj) return null;
  for (const k of keys) {
    if (k in obj) return obj[k];
    const lower = k.toLowerCase();
    for (const ok of Object.keys(obj)) {
      if (ok.toLowerCase() === lower) return obj[ok];
    }
  }
  return null;
}

function extractSplit(node: unknown): PbpStatsOnOffSplit {
  const empty: PbpStatsOnOffSplit = {
    minutes: null,
    possessions: null,
    pointsFor: null,
    pointsAgainst: null,
    offRtg: null,
    defRtg: null,
    netRtg: null,
  };
  if (!node || typeof node !== 'object') return empty;
  const o = node as Record<string, unknown>;

  const minutes = safeNumber(pickField(o, ['Minutes', 'MIN', 'minutes']));
  const possessionsOff = safeNumber(
    pickField(o, ['OffPossessions', 'OffensivePossessions', 'PossessionsOff']),
  );
  const possessionsDef = safeNumber(
    pickField(o, ['DefPossessions', 'DefensivePossessions', 'PossessionsDef']),
  );
  const possessions =
    safeNumber(pickField(o, ['Possessions', 'POSS', 'possessions'])) ??
    possessionsOff ??
    possessionsDef;

  const pointsFor = safeNumber(
    pickField(o, ['Points', 'PointsFor', 'OffPoints', 'PtsFor']),
  );
  const pointsAgainst = safeNumber(
    pickField(o, ['OppPoints', 'PointsAgainst', 'DefPoints', 'PtsAgainst']),
  );

  const offRtg = safeNumber(pickField(o, ['OffRating', 'OffensiveRating', 'ORtg']));
  const defRtg = safeNumber(pickField(o, ['DefRating', 'DefensiveRating', 'DRtg']));
  const netRtgRaw = safeNumber(pickField(o, ['NetRating', 'Net', 'NetRtg']));
  const netRtg = netRtgRaw ?? deriveNetRating(offRtg, defRtg);

  return {
    minutes,
    possessions,
    pointsFor,
    pointsAgainst,
    offRtg,
    defRtg,
    netRtg,
  };
}

/**
 * Normalize a raw PBPStats on/off response to PbpStatsOnOffSnapshot.
 * Tolerant of missing fields and varied response shapes.
 */
export function normalizePbpStatsOnOff(params: {
  gameId: string;
  teamId: string;
  playerId: string;
  raw: unknown;
}): PbpStatsOnOffSnapshot {
  const { gameId, teamId, playerId, raw } = params;
  let onNode: unknown = null;
  let offNode: unknown = null;

  if (raw && typeof raw === 'object') {
    const r = raw as Record<string, unknown>;
    onNode =
      pickField(r, ['On', 'OnCourt', 'on', 'on_court']) ??
      (r.results && typeof r.results === 'object'
        ? pickField(r.results as Record<string, unknown>, ['On', 'OnCourt'])
        : null);
    offNode =
      pickField(r, ['Off', 'OffCourt', 'off', 'off_court']) ??
      (r.results && typeof r.results === 'object'
        ? pickField(r.results as Record<string, unknown>, ['Off', 'OffCourt'])
        : null);
  }

  const on = extractSplit(onNode);
  const off = extractSplit(offNode);
  const onOffNet = deriveOnOffNet(on.netRtg, off.netRtg);

  return {
    source: 'pbpstats',
    gameId,
    teamId,
    playerId,
    on,
    off,
    onOffNet,
    raw,
  };
}

function diff(a: number | null | undefined, b: number | null | undefined): number | null {
  if (a === null || a === undefined || b === null || b === undefined) return null;
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return a - b;
}

export function buildDelta(
  cp: OnCourtValidationSnapshot,
  pbp: PbpStatsOnOffSnapshot,
): ExternalValidationDelta {
  return {
    minutesOnDelta: diff(cp.on.minutes, pbp.on.minutes),
    minutesOffDelta: diff(cp.off.minutes, pbp.off.minutes),
    possessionsOnDelta: diff(cp.on.possessions, pbp.on.possessions),
    possessionsOffDelta: diff(cp.off.possessions, pbp.off.possessions),
    pointsForOnDelta: diff(cp.on.pointsFor, pbp.on.pointsFor),
    pointsAgainstOnDelta: diff(cp.on.pointsAgainst, pbp.on.pointsAgainst),
    pointsForOffDelta: diff(cp.off.pointsFor, pbp.off.pointsFor),
    pointsAgainstOffDelta: diff(cp.off.pointsAgainst, pbp.off.pointsAgainst),
    offRtgOnDelta: diff(cp.on.offRtg, pbp.on.offRtg),
    defRtgOnDelta: diff(cp.on.defRtg, pbp.on.defRtg),
    netRtgOnDelta: diff(cp.on.netRtg, pbp.on.netRtg),
    offRtgOffDelta: diff(cp.off.offRtg, pbp.off.offRtg),
    defRtgOffDelta: diff(cp.off.defRtg, pbp.off.defRtg),
    netRtgOffDelta: diff(cp.off.netRtg, pbp.off.netRtg),
    onOffNetDelta: diff(cp.onOffNet, pbp.onOffNet),
  };
}

const MIN_DELTA_THRESHOLD = 0.5;
const POSS_DELTA_THRESHOLD = 3;
const PTS_DELTA_THRESHOLD = 3;
const RTG_DELTA_THRESHOLD = 1.0;
const SMALL_OFF_POSS = 20;

function abs(v: number | null): number | null {
  return v === null ? null : Math.abs(v);
}

export function classifyMismatch(params: {
  cp: OnCourtValidationSnapshot;
  pbp: PbpStatsOnOffSnapshot;
  delta: ExternalValidationDelta;
}): { issues: ExternalValidationIssue[]; notes: string[] } {
  const { cp, pbp, delta } = params;
  const issues: ExternalValidationIssue[] = [];
  const notes: string[] = [];

  const minOn = abs(delta.minutesOnDelta);
  const minOff = abs(delta.minutesOffDelta);
  const minutesDiffer =
    (minOn !== null && minOn > MIN_DELTA_THRESHOLD) ||
    (minOff !== null && minOff > MIN_DELTA_THRESHOLD);
  const minutesClose =
    (minOn === null || minOn <= MIN_DELTA_THRESHOLD) &&
    (minOff === null || minOff <= MIN_DELTA_THRESHOLD);

  const possOn = abs(delta.possessionsOnDelta);
  const possOff = abs(delta.possessionsOffDelta);
  const possessionsDiffer =
    (possOn !== null && possOn > POSS_DELTA_THRESHOLD) ||
    (possOff !== null && possOff > POSS_DELTA_THRESHOLD);
  const possessionsClose =
    (possOn === null || possOn <= POSS_DELTA_THRESHOLD) &&
    (possOff === null || possOff <= POSS_DELTA_THRESHOLD);

  const pfOn = abs(delta.pointsForOnDelta);
  const paOn = abs(delta.pointsAgainstOnDelta);
  const pfOff = abs(delta.pointsForOffDelta);
  const paOff = abs(delta.pointsAgainstOffDelta);
  const pointsDiffer =
    (pfOn !== null && pfOn > PTS_DELTA_THRESHOLD) ||
    (paOn !== null && paOn > PTS_DELTA_THRESHOLD) ||
    (pfOff !== null && pfOff > PTS_DELTA_THRESHOLD) ||
    (paOff !== null && paOff > PTS_DELTA_THRESHOLD);

  const rtgDeltas = [
    delta.offRtgOnDelta,
    delta.defRtgOnDelta,
    delta.netRtgOnDelta,
    delta.offRtgOffDelta,
    delta.defRtgOffDelta,
    delta.netRtgOffDelta,
    delta.onOffNetDelta,
  ];
  const rtgDiffer = rtgDeltas.some((d) => {
    const a = abs(d);
    return a !== null && a > RTG_DELTA_THRESHOLD;
  });

  if (minutesDiffer) {
    issues.push('lineup_or_substitution_tracking');
    notes.push(
      'CourtPulse and PBPStats minutes differ. This usually points to substitution or lineup tracking drift.',
    );
  }

  if (!minutesDiffer && possessionsDiffer) {
    issues.push('possession_detection');
    notes.push(
      'Possession counts differ while minutes are close. This usually points to possession detection rules.',
    );
  }

  if (minutesClose && possessionsClose && pointsDiffer) {
    issues.push('points_assignment');
    notes.push(
      'Points For/Against differ while possessions are close. This usually points to scoring assignment inside lineup windows.',
    );
  }

  if (minutesClose && possessionsClose && !pointsDiffer && rtgDiffer) {
    issues.push('formula_or_rounding');
    notes.push(
      'Inputs are close but ratings diverge. This usually points to formula or rounding differences.',
    );
  }

  const offPossSample =
    pbp.off.possessions !== null ? pbp.off.possessions : cp.off.possessions;
  if (offPossSample !== null && offPossSample < SMALL_OFF_POSS) {
    issues.push('sample_size');
    notes.push('OFF sample is small, so On/Off swings may be noisy.');
  }

  if (issues.length === 0) {
    issues.push('unknown');
  }

  return { issues, notes };
}

export function compareCourtPulseToPbpStats(
  cp: OnCourtValidationSnapshot,
  pbp: PbpStatsOnOffSnapshot,
): ExternalValidationComparison {
  const delta = buildDelta(cp, pbp);
  const { issues, notes } = classifyMismatch({ cp, pbp, delta });
  return {
    status: 'success',
    courtPulseSnapshot: cp,
    pbpStatsSnapshot: pbp,
    delta,
    likelyIssues: issues,
    notes,
  };
}
