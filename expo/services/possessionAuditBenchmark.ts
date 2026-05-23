/**
 * Possession Audit benchmark fetcher.
 *
 * Developer-only. Fetches a true single-game possession benchmark from
 * PBPStats /get-game-stats?GameId=...&Type=Player and falls back to the
 * season/playoff /get-on-off/nba/player endpoint when the primary endpoint
 * is unavailable. Network access is gated by the `enablePossessionAuditDebug`
 * feature flag at the call-site (hook).
 */

import { useEffect, useRef, useState } from 'react';
import type {
  PbpStatsBenchmarkDebug,
  PbpStatsBenchmarkSource,
  PbpStatsPossessionBenchmark,
} from '@/types/possessionAudit';
import type { PbpStatsOnOffRequest } from '@/types/pbpStatsValidation';
import {
  buildPbpStatsGameStatsUrl,
  buildPbpStatsOnOffUrl,
  parseMinutesToDecimal,
  safeNumber,
  deriveNetRating,
} from '@/utils/pbpStatsValidation';
import { matchPbpStatsPlayerWithDebug } from '@/utils/possessionAudit';
import {
  getSeasonFromGameId,
  getSeasonTypeFromGameId,
  type NbaSeasonType,
} from '@/utils/nbaGameSeason';
import { useFeatureFlag } from '@/hooks/useFeatureFlag';

export type PossessionAuditBenchmarkStatus =
  | 'idle'
  | 'loading'
  | 'success'
  | 'error'
  | 'unavailable';

export interface PossessionAuditBenchmarkState {
  status: PossessionAuditBenchmarkStatus;
  benchmark?: PbpStatsPossessionBenchmark;
  endpoint?: string;
  errorMessage?: string;
  notes: string[];
  debug?: PbpStatsBenchmarkDebug;
}

interface CacheEntry {
  state: PossessionAuditBenchmarkState;
  fetchedAt: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000;

function deriveSeasonType(
  gameId: string,
): 'Regular Season' | 'Playoffs' | undefined {
  const t: NbaSeasonType | undefined = getSeasonTypeFromGameId(gameId);
  if (t === 'Regular Season' || t === 'Playoffs') return t;
  return undefined;
}

function cacheKey(params: {
  gameId: string;
  teamId: string;
  playerId: string;
  playerName?: string;
}): string {
  return `${params.gameId}|${params.teamId}|${params.playerId}|${params.playerName ?? ''}`;
}

function previewRow(row: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!row) return null;
  const keys = [
    'EntityId',
    'PlayerId',
    'Name',
    'ShortName',
    'TeamAbbreviation',
    'Minutes',
    'OffPoss',
    'DefPoss',
    'OffRtg',
    'DefRtg',
    'NetRtg',
    'Usage',
  ];
  const out: Record<string, unknown> = {};
  for (const k of keys) {
    if (k in row) out[k] = row[k];
  }
  return out;
}

function emptyDebug(): PbpStatsBenchmarkDebug {
  return {
    source: null,
    endpoint: null,
    rawResultKeys: [],
    candidateRowsCount: 0,
    matchedRowsCount: 0,
    matchedBy: 'none',
    selectedRowIndex: null,
    selectedRowReason: null,
    selectedRowPreview: null,
    firstCandidatePreview: null,
    fallbackUsed: false,
    primaryError: null,
  };
}

interface NormalizationInput {
  gameId: string;
  teamId: string;
  playerId: string;
  playerName?: string;
  raw: unknown;
  endpoint: string;
  source: PbpStatsBenchmarkSource;
  fallbackUsed: boolean;
  primaryError: string | null;
}

interface NormalizationOutput {
  benchmark: PbpStatsPossessionBenchmark | null;
  debug: PbpStatsBenchmarkDebug;
}

function normalizeBenchmark(input: NormalizationInput): NormalizationOutput {
  const match = matchPbpStatsPlayerWithDebug(input.raw, {
    playerId: input.playerId,
    playerName: input.playerName,
  });

  const debug: PbpStatsBenchmarkDebug = {
    source: input.source,
    endpoint: input.endpoint,
    rawResultKeys: match.rawResultKeys,
    candidateRowsCount: match.candidates.length,
    matchedRowsCount: match.matchedRows.length,
    matchedBy: match.matchedBy,
    selectedRowIndex: match.selectedIndex,
    selectedRowReason: match.selectedReason,
    selectedRowPreview: previewRow(match.matched),
    firstCandidatePreview: previewRow(match.candidates[0] ?? null),
    fallbackUsed: input.fallbackUsed,
    primaryError: input.primaryError,
  };

  if (!match.matched) {
    return { benchmark: null, debug };
  }

  const row = match.matched;
  const rawMinutes = (row['Minutes'] ?? row['MIN'] ?? null) as
    | string
    | number
    | null;
  const minutes = parseMinutesToDecimal(rawMinutes);
  const offPoss = safeNumber(
    row['OffPoss'] ??
      row['OffensivePossessions'] ??
      row['OffPossessions'] ??
      null,
  );
  const defPoss = safeNumber(
    row['DefPoss'] ??
      row['DefensivePossessions'] ??
      row['DefPossessions'] ??
      null,
  );
  const offRtg = safeNumber(
    row['OffRtg'] ?? row['OffRating'] ?? row['OffensiveRating'] ?? null,
  );
  const defRtg = safeNumber(
    row['DefRtg'] ?? row['DefRating'] ?? row['DefensiveRating'] ?? null,
  );
  const netRtgRaw = safeNumber(
    row['NetRtg'] ?? row['NetRating'] ?? row['Net'] ?? null,
  );
  const netRtg = netRtgRaw ?? deriveNetRating(offRtg, defRtg);
  const usage = safeNumber(row['Usage'] ?? row['UsagePct'] ?? null);
  const penaltyOffPoss = safeNumber(row['PenaltyOffPoss'] ?? null);
  const penaltyDefPoss = safeNumber(row['PenaltyDefPoss'] ?? null);
  const secondChanceOffPoss = safeNumber(row['SecondChanceOffPoss'] ?? null);
  const name =
    typeof row['Name'] === 'string' ? (row['Name'] as string) : undefined;

  const benchmark: PbpStatsPossessionBenchmark = {
    playerId: input.playerId,
    playerName: name ?? input.playerName,
    teamId: input.teamId,
    gameId: input.gameId,
    minutes,
    offPoss,
    defPoss,
    offRtg,
    defRtg,
    netRtg,
    usage,
    penaltyOffPoss,
    penaltyDefPoss,
    secondChanceOffPoss,
    rawMinutes,
    raw: row,
  };

  return { benchmark, debug };
}

interface FetchSuccess {
  raw: unknown;
  endpoint: string;
}

interface FetchFailure {
  endpoint: string;
  errorMessage: string;
  statusCode?: number;
}

async function tryFetchJson(endpoint: string): Promise<FetchSuccess | FetchFailure> {
  try {
    const res = await fetch(endpoint, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      return {
        endpoint,
        errorMessage: `PBPStats request failed (${res.status})`,
        statusCode: res.status,
      };
    }
    const raw: unknown = await res.json().catch(() => null);
    if (!raw) {
      return {
        endpoint,
        errorMessage: 'PBPStats returned an unparseable response',
        statusCode: res.status,
      };
    }
    return { raw, endpoint };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown PBPStats error';
    return { endpoint, errorMessage: message };
  }
}

interface FetchBenchmarkParams {
  gameId: string;
  teamId: string;
  playerId: string;
  playerName?: string;
  season?: string;
  seasonType?: 'Regular Season' | 'Playoffs';
}

async function fetchBenchmark(
  params: FetchBenchmarkParams,
): Promise<PossessionAuditBenchmarkState> {
  const primaryUrl = buildPbpStatsGameStatsUrl({
    gameId: params.gameId,
    type: 'Player',
  });
  console.log('[PossessionAuditBenchmark] PRIMARY GET', primaryUrl);
  const primary = await tryFetchJson(primaryUrl);

  if ('raw' in primary) {
    console.log('[PossessionAuditBenchmark] primary status: ok');
    const { benchmark, debug } = normalizeBenchmark({
      gameId: params.gameId,
      teamId: params.teamId,
      playerId: params.playerId,
      playerName: params.playerName,
      raw: primary.raw,
      endpoint: primary.endpoint,
      source: 'game-stats',
      fallbackUsed: false,
      primaryError: null,
    });
    if (benchmark) {
      console.log('[PossessionAuditBenchmark] matched', JSON.stringify({
        matchedBy: debug.matchedBy,
        selectedRowIndex: debug.selectedRowIndex,
        minutes: benchmark.minutes,
        offPoss: benchmark.offPoss,
        defPoss: benchmark.defPoss,
        netRtg: benchmark.netRtg,
      }));
      return {
        status: 'success',
        benchmark,
        endpoint: primary.endpoint,
        notes: [],
        debug,
      };
    }
    // Primary returned but no matching player row \u2014 still return debug so the
    // panel can explain why no row was matched. Try fallback if season info is
    // available so we can surface season-scoped values.
    if (params.season && params.seasonType) {
      const fallback = await runOnOffFallback({
        ...params,
        season: params.season,
        seasonType: params.seasonType,
        primaryError:
          'PBPStats response received, but no matching player row was found.',
      });
      if (fallback) return fallback;
    }
    return {
      status: 'unavailable',
      endpoint: primary.endpoint,
      notes: [
        'PBPStats response received, but no matching player row was found.',
      ],
      debug,
    };
  }

  // Primary failed \u2014 try fallback if we have season info.
  console.log('[PossessionAuditBenchmark] primary failed', primary.errorMessage);
  if (params.season && params.seasonType) {
    const fallback = await runOnOffFallback({
      ...params,
      season: params.season,
      seasonType: params.seasonType,
      primaryError: primary.errorMessage,
    });
    if (fallback) return fallback;
  }
  return {
    status: 'error',
    endpoint: primary.endpoint,
    errorMessage: primary.errorMessage,
    notes: [],
    debug: {
      ...emptyDebug(),
      source: 'game-stats',
      endpoint: primary.endpoint,
      primaryError: primary.errorMessage,
    },
  };
}

async function runOnOffFallback(params: {
  gameId: string;
  teamId: string;
  playerId: string;
  playerName?: string;
  season: string;
  seasonType: 'Regular Season' | 'Playoffs';
  primaryError: string;
}): Promise<PossessionAuditBenchmarkState | null> {
  const req: PbpStatsOnOffRequest = {
    gameId: params.gameId,
    teamId: params.teamId,
    playerId: params.playerId,
    season: params.season,
    seasonType: params.seasonType,
    stat: 'NetRtg',
  };
  const url = buildPbpStatsOnOffUrl(req);
  console.log('[PossessionAuditBenchmark] FALLBACK GET', url);
  const result = await tryFetchJson(url);
  if (!('raw' in result)) {
    console.log('[PossessionAuditBenchmark] fallback failed', result.errorMessage);
    return {
      status: 'error',
      endpoint: url,
      errorMessage: result.errorMessage,
      notes: [
        'Using season/playoff on-off endpoint as fallback. Values may not be game-specific.',
      ],
      debug: {
        ...emptyDebug(),
        source: 'on-off-fallback',
        endpoint: url,
        fallbackUsed: true,
        primaryError: params.primaryError,
      },
    };
  }
  const { benchmark, debug } = normalizeBenchmark({
    gameId: params.gameId,
    teamId: params.teamId,
    playerId: params.playerId,
    playerName: params.playerName,
    raw: result.raw,
    endpoint: result.endpoint,
    source: 'on-off-fallback',
    fallbackUsed: true,
    primaryError: params.primaryError,
  });
  const notes = [
    'Using season/playoff on-off endpoint as fallback. Values may not be game-specific.',
  ];
  if (!benchmark) {
    return {
      status: 'unavailable',
      endpoint: result.endpoint,
      notes: [
        ...notes,
        'PBPStats response received, but no matching player row was found.',
      ],
      debug,
    };
  }
  return {
    status: 'success',
    benchmark,
    endpoint: result.endpoint,
    notes,
    debug,
  };
}

export interface UsePossessionAuditBenchmarkParams {
  enabled: boolean;
  gameId: string | null;
  teamId: string | null;
  playerId: string | null;
  playerName?: string;
}

export interface UsePossessionAuditBenchmarkResult {
  state: PossessionAuditBenchmarkState;
}

/**
 * Hook that fetches a PBPStats single-game benchmark for the selected
 * player when both `enabled` and the feature flag are true. Falls back to
 * the season/playoff on-off endpoint when the primary endpoint fails.
 */
export function usePossessionAuditBenchmark(
  params: UsePossessionAuditBenchmarkParams,
): UsePossessionAuditBenchmarkResult {
  const flagEnabled = useFeatureFlag('enablePossessionAuditDebug');
  const { enabled, gameId, teamId, playerId, playerName } = params;
  const [state, setState] = useState<PossessionAuditBenchmarkState>({
    status: 'idle',
    notes: [],
  });
  const lastKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!flagEnabled || !enabled) {
      setState({ status: 'idle', notes: [] });
      lastKeyRef.current = null;
      return;
    }
    if (!gameId || !teamId || !playerId) {
      setState({
        status: 'unavailable',
        notes: ['Missing gameId, teamId, or playerId for PBPStats benchmark.'],
      });
      return;
    }
    const season = getSeasonFromGameId(gameId);
    const seasonType = deriveSeasonType(gameId);

    const key = cacheKey({ gameId, teamId, playerId, playerName });
    const cached = cache.get(key);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      setState(cached.state);
      lastKeyRef.current = key;
      return;
    }
    if (lastKeyRef.current === key) return;
    lastKeyRef.current = key;

    let cancelled = false;
    const primaryUrl = buildPbpStatsGameStatsUrl({ gameId, type: 'Player' });
    setState({ status: 'loading', endpoint: primaryUrl, notes: [] });
    fetchBenchmark({
      gameId,
      teamId,
      playerId,
      playerName,
      season: season ?? undefined,
      seasonType: seasonType ?? undefined,
    }).then((result) => {
      if (cancelled) return;
      cache.set(key, { state: result, fetchedAt: Date.now() });
      setState(result);
    });
    return () => {
      cancelled = true;
    };
  }, [flagEnabled, enabled, gameId, teamId, playerId, playerName]);

  return { state };
}
