/**
 * Possession Audit utilities.
 *
 * Developer-only diagnostic helpers. None of these functions modify or
 * recompute production possession counts. They build audit rows, derive
 * offensive/defensive samples, and classify mismatches against PBPStats.
 */

import type {
  CourtPulsePossessionAuditRow,
  PbpStatsPlayerMatchedBy,
  PbpStatsPossessionBenchmark,
  PlayerPossessionAuditSample,
  PossessionAuditDeltas,
  PossessionAuditIssue,
} from '@/types/possessionAudit';

/**
 * Build CourtPulse possession audit rows from whatever raw data is available.
 *
 * If existing possession segments or lineup intervals are not exposed in a
 * normalized form, return an empty array. Callers should add a note that
 * row-level audit data was unavailable. Do NOT fabricate rows.
 */
export function buildCourtPulsePossessionAuditRows(params: {
  gameId: string;
  events?: unknown[];
  lineups?: unknown[];
  teamIds?: string[];
}): CourtPulsePossessionAuditRow[] {
  const { events, lineups } = params;
  // Defensive: without normalized possession+lineup data we cannot honestly
  // reconstruct row-level offense/defense possessions. Return empty so the
  // caller can surface a "row-level data unavailable" note.
  if (!events || !lineups) return [];
  if (!Array.isArray(events) || events.length === 0) return [];
  if (!Array.isArray(lineups) || lineups.length === 0) return [];
  return [];
}

/**
 * Build a per-player offensive/defensive possession sample from audit rows.
 *
 * If no rows are available, return zeros and let the caller fall back to
 * the existing CourtPulse sample with an appropriate note.
 */
export function buildPlayerPossessionAuditSample(params: {
  playerId: string;
  teamId: string;
  gameId: string;
  auditRows: CourtPulsePossessionAuditRow[];
  fallback?: {
    offensivePossessions?: number;
    defensivePossessions?: number;
    pointsFor?: number;
    pointsAgainst?: number;
    minutes?: number;
  };
}): PlayerPossessionAuditSample {
  const { playerId, teamId, gameId, auditRows, fallback } = params;
  if (!auditRows || auditRows.length === 0) {
    return {
      playerId,
      teamId,
      gameId,
      offensivePossessions: fallback?.offensivePossessions ?? 0,
      defensivePossessions: fallback?.defensivePossessions ?? 0,
      pointsFor: fallback?.pointsFor ?? 0,
      pointsAgainst: fallback?.pointsAgainst ?? 0,
      minutes: fallback?.minutes ?? 0,
    };
  }

  let offensivePossessions = 0;
  let defensivePossessions = 0;
  let pointsFor = 0;
  let pointsAgainst = 0;

  for (const row of auditRows) {
    const isOnOffense =
      row.offenseTeamId === teamId &&
      Array.isArray(row.offensivePlayers) &&
      row.offensivePlayers.includes(playerId);
    const isOnDefense =
      row.defenseTeamId === teamId &&
      Array.isArray(row.defensivePlayers) &&
      row.defensivePlayers.includes(playerId);

    if (isOnOffense) {
      offensivePossessions += 1;
      pointsFor += row.pointsScored;
    }
    if (isOnDefense) {
      defensivePossessions += 1;
      pointsAgainst += row.pointsScored;
    }
  }

  return {
    playerId,
    teamId,
    gameId,
    offensivePossessions,
    defensivePossessions,
    pointsFor,
    pointsAgainst,
    minutes: fallback?.minutes ?? 0,
  };
}

function safeAbs(v: number | null): number | null {
  if (v === null || v === undefined || !Number.isFinite(v)) return null;
  return Math.abs(v);
}

function diff(a: number | null | undefined, b: number | null | undefined): number | null {
  if (a === null || a === undefined || b === null || b === undefined) return null;
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return a - b;
}

export function buildPossessionAuditDeltas(
  cp: PlayerPossessionAuditSample,
  pbp?: PbpStatsPossessionBenchmark,
): PossessionAuditDeltas {
  if (!pbp) {
    return {
      minutesDelta: null,
      offensivePossessionsDelta: null,
      defensivePossessionsDelta: null,
      offRtgDelta: null,
      defRtgDelta: null,
      netRtgDelta: null,
    };
  }
  const cpOffRtg =
    cp.offensivePossessions > 0 ? (cp.pointsFor / cp.offensivePossessions) * 100 : null;
  const cpDefRtg =
    cp.defensivePossessions > 0
      ? (cp.pointsAgainst / cp.defensivePossessions) * 100
      : null;
  const cpNetRtg =
    cpOffRtg !== null && cpDefRtg !== null ? cpOffRtg - cpDefRtg : null;

  return {
    minutesDelta: diff(cp.minutes, pbp.minutes),
    offensivePossessionsDelta: diff(cp.offensivePossessions, pbp.offPoss),
    defensivePossessionsDelta: diff(cp.defensivePossessions, pbp.defPoss),
    offRtgDelta: diff(cpOffRtg, pbp.offRtg),
    defRtgDelta: diff(cpDefRtg, pbp.defRtg),
    netRtgDelta: diff(cpNetRtg, pbp.netRtg),
  };
}

const MIN_DELTA_THRESHOLD = 0.5;
const POSS_DELTA_THRESHOLD = 3;

export function classifyPossessionAuditIssues(params: {
  courtPulse: PlayerPossessionAuditSample;
  pbpStats?: PbpStatsPossessionBenchmark;
  rows: CourtPulsePossessionAuditRow[];
}): { issues: PossessionAuditIssue[]; notes: string[] } {
  const { courtPulse, pbpStats, rows } = params;
  const issues: PossessionAuditIssue[] = [];
  const notes: string[] = [];

  if (pbpStats) {
    const minutesDelta = diff(courtPulse.minutes, pbpStats.minutes);
    const minutesAbs = safeAbs(minutesDelta);
    const offDelta = diff(courtPulse.offensivePossessions, pbpStats.offPoss);
    const defDelta = diff(courtPulse.defensivePossessions, pbpStats.defPoss);
    const offAbs = safeAbs(offDelta);
    const defAbs = safeAbs(defDelta);

    const minutesClose = minutesAbs !== null && minutesAbs <= MIN_DELTA_THRESHOLD;
    const possMismatch =
      (offAbs !== null && offAbs > POSS_DELTA_THRESHOLD) ||
      (defAbs !== null && defAbs > POSS_DELTA_THRESHOLD);

    if (minutesClose && possMismatch) {
      issues.push('off_def_possession_mismatch');
      notes.push(
        'Minutes are close but possessions differ. This usually points to possession detection/delegation rather than substitution tracking.',
      );
    }

    if (minutesAbs !== null && minutesAbs > MIN_DELTA_THRESHOLD) {
      notes.push('Minutes differ. This may point to substitution or lineup tracking drift.');
    }
  }

  if (rows.length > 0) {
    const unknownCount = rows.filter((r) => r.endingReason === 'unknown').length;
    if (unknownCount > 0 && unknownCount / rows.length >= 0.1) {
      issues.push('unknown');
      notes.push(
        `${unknownCount} possession rows have an unknown ending reason. Audit rules may be incomplete.`,
      );
    }

    const periods = new Set(rows.map((r) => r.period));
    const periodStartRows = rows.filter((r) => r.endingReason === 'period_start');
    const periodEndRows = rows.filter((r) => r.endingReason === 'period_end');
    if (periods.size > 0 && periodStartRows.length === 0) {
      issues.push('period_start_not_initialized');
    }
    if (periods.size > 0 && periodEndRows.length === 0) {
      issues.push('period_end_not_closed');
    }

    const teamReboundIssues = rows.some((r) =>
      r.issues.includes('missing_team_rebound_change'),
    );
    if (teamReboundIssues) {
      issues.push('missing_team_rebound_change');
    }

    const jumpBallUnclear = rows.some((r) =>
      r.issues.includes('jump_ball_possession_unclear'),
    );
    if (jumpBallUnclear) {
      issues.push('jump_ball_possession_unclear');
    }

    const subDeadBall = rows.some((r) =>
      r.issues.includes('substitution_during_dead_ball'),
    );
    if (subDeadBall) {
      issues.push('substitution_during_dead_ball');
    }
  } else {
    notes.push(
      'Row-level possession audit data is unavailable in this build. Showing summary comparison only.',
    );
  }

  notes.push(
    'CourtPulse currently uses a generic possession count; audit mode separates offensive and defensive possessions where data permits.',
  );

  // Dedupe issues while preserving order.
  const seen = new Set<PossessionAuditIssue>();
  const dedupedIssues: PossessionAuditIssue[] = [];
  for (const i of issues) {
    if (!seen.has(i)) {
      seen.add(i);
      dedupedIssues.push(i);
    }
  }

  return { issues: dedupedIssues, notes };
}

/**
 * Match a player object inside a multi-player PBPStats response.
 * Tries EntityId, PlayerId, Name, ShortName, then falls back to undefined.
 */
export function matchPbpStatsPlayer(
  raw: unknown,
  params: { playerId: string; playerName?: string },
): Record<string, unknown> | undefined {
  return matchPbpStatsPlayerWithDebug(raw, params).matched ?? undefined;
}

function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export interface PbpStatsPlayerMatchDebug {
  matched: Record<string, unknown> | null;
  matchedBy: PbpStatsPlayerMatchedBy;
  candidates: Record<string, unknown>[];
  matchedRows: Record<string, unknown>[];
  selectedIndex: number | null;
  selectedReason: string | null;
  rawResultKeys: string[];
}

/**
 * Richer player matcher that exposes match diagnostics so the audit panel
 * can explain why a row was selected. When multiple rows match by EntityId
 * the LAST row is used as the aggregate.
 */
export function matchPbpStatsPlayerWithDebug(
  raw: unknown,
  params: { playerId: string; playerName?: string },
): PbpStatsPlayerMatchDebug {
  const rawResultKeys = collectRawKeys(raw);
  const candidates = collectPlayerCandidates(raw);
  if (candidates.length === 0) {
    return {
      matched: null,
      matchedBy: 'none',
      candidates,
      matchedRows: [],
      selectedIndex: null,
      selectedReason: null,
      rawResultKeys,
    };
  }
  const targetId = String(params.playerId);
  const targetName = params.playerName?.trim();
  const targetNameNorm = targetName ? normalizeName(targetName) : '';

  // EntityId (preferred) – collect ALL matches; use the last as aggregate.
  const entityIdMatches: { row: Record<string, unknown>; index: number }[] = [];
  candidates.forEach((c, i) => {
    const v = c['EntityId'];
    if (v !== undefined && v !== null && String(v) === targetId) {
      entityIdMatches.push({ row: c, index: i });
    }
  });
  if (entityIdMatches.length > 0) {
    const last = entityIdMatches[entityIdMatches.length - 1];
    return {
      matched: last.row,
      matchedBy: 'EntityId',
      candidates,
      matchedRows: entityIdMatches.map((m) => m.row),
      selectedIndex: last.index,
      selectedReason:
        entityIdMatches.length > 1
          ? 'last EntityId match used as aggregate row'
          : 'single EntityId match',
      rawResultKeys,
    };
  }

  // PlayerId fallback.
  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    const pid = c['PlayerId'];
    if (pid !== undefined && pid !== null && String(pid) === targetId) {
      return {
        matched: c,
        matchedBy: 'PlayerId',
        candidates,
        matchedRows: [c],
        selectedIndex: i,
        selectedReason: 'PlayerId fallback match',
        rawResultKeys,
      };
    }
  }

  // Name fallback.
  if (targetName) {
    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i];
      const name = c['Name'];
      if (typeof name === 'string' && name.trim() === targetName) {
        return {
          matched: c,
          matchedBy: 'Name',
          candidates,
          matchedRows: [c],
          selectedIndex: i,
          selectedReason: 'exact Name match',
          rawResultKeys,
        };
      }
    }
    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i];
      const sn = c['ShortName'];
      if (typeof sn === 'string' && sn.trim() === targetName) {
        return {
          matched: c,
          matchedBy: 'ShortName',
          candidates,
          matchedRows: [c],
          selectedIndex: i,
          selectedReason: 'exact ShortName match',
          rawResultKeys,
        };
      }
    }
    if (targetNameNorm.length > 0) {
      for (let i = 0; i < candidates.length; i++) {
        const c = candidates[i];
        const name = c['Name'];
        const sn = c['ShortName'];
        const candidateName =
          typeof name === 'string' ? name : typeof sn === 'string' ? sn : '';
        if (candidateName && normalizeName(candidateName) === targetNameNorm) {
          return {
            matched: c,
            matchedBy: 'NormalizedName',
            candidates,
            matchedRows: [c],
            selectedIndex: i,
            selectedReason: 'normalized name match',
            rawResultKeys,
          };
        }
      }
    }
  }

  return {
    matched: null,
    matchedBy: 'none',
    candidates,
    matchedRows: [],
    selectedIndex: null,
    selectedReason: null,
    rawResultKeys,
  };
}

function collectRawKeys(raw: unknown): string[] {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return [];
  return Object.keys(raw as Record<string, unknown>);
}

function collectPlayerCandidates(raw: unknown): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  if (!raw) return out;
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (item && typeof item === 'object') out.push(item as Record<string, unknown>);
    }
    return out;
  }
  if (typeof raw === 'object') {
    const r = raw as Record<string, unknown>;
    for (const k of ['results', 'multi_row_table_data', 'data', 'players', 'rows']) {
      const v = r[k];
      if (Array.isArray(v)) {
        for (const item of v) {
          if (item && typeof item === 'object') out.push(item as Record<string, unknown>);
        }
      }
    }
    if (out.length === 0) {
      // Single object response.
      out.push(r);
    }
  }
  return out;
}
