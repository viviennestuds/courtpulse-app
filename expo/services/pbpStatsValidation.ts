/**
 * PBPStats validation service.
 *
 * Developer-only diagnostic fetcher. All network access is gated by the
 * `enableExternalPbpStatsValidation` feature flag at the call-site (hook).
 */

import { useEffect, useRef, useState } from 'react';
import type { OnCourtValidationSnapshot } from '@/types/metricValidation';
import type {
  ExternalValidationComparison,
  PbpStatsOnOffRequest,
  PbpStatsValidationError,
} from '@/types/pbpStatsValidation';
import {
  buildPbpStatsOnOffUrl,
  compareCourtPulseToPbpStats,
  normalizePbpStatsOnOff,
} from '@/utils/pbpStatsValidation';
import {
  getSeasonFromGameId,
  getSeasonTypeFromGameId,
  type NbaSeasonType,
} from '@/utils/nbaGameSeason';
import { useFeatureFlag } from '@/hooks/useFeatureFlag';

interface CacheEntry {
  comparison: ExternalValidationComparison;
  fetchedAt: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000;

function cacheKey(req: PbpStatsOnOffRequest): string {
  return `${req.gameId}|${req.teamId}|${req.playerId}|${req.season}|${req.seasonType}`;
}

function deriveSeasonType(gameId: string): 'Regular Season' | 'Playoffs' | undefined {
  const t: NbaSeasonType | undefined = getSeasonTypeFromGameId(gameId);
  if (t === 'Regular Season' || t === 'Playoffs') return t;
  return undefined;
}

async function fetchPbpStatsOnOff(
  req: PbpStatsOnOffRequest,
  cp: OnCourtValidationSnapshot,
): Promise<ExternalValidationComparison> {
  const endpoint = buildPbpStatsOnOffUrl(req);
  console.log('[PBPStatsValidation] GET', endpoint);
  try {
    const res = await fetch(endpoint, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    console.log('[PBPStatsValidation] status', res.status);
    if (!res.ok) {
      const error: PbpStatsValidationError = {
        message: `PBPStats request failed (${res.status})`,
        endpoint,
        statusCode: res.status,
      };
      return {
        status: 'error',
        courtPulseSnapshot: cp,
        likelyIssues: [],
        notes: [],
        error,
        endpoint,
      };
    }
    const raw: unknown = await res.json().catch(() => null);
    if (!raw) {
      return {
        status: 'error',
        courtPulseSnapshot: cp,
        likelyIssues: [],
        notes: [],
        error: {
          message: 'PBPStats returned an unparseable response',
          endpoint,
          statusCode: res.status,
        },
        endpoint,
      };
    }
    const snapshot = normalizePbpStatsOnOff({
      gameId: req.gameId,
      teamId: req.teamId,
      playerId: req.playerId,
      raw,
    });
    console.log('[PBPStatsValidation] normalized', JSON.stringify({
      on: snapshot.on,
      off: snapshot.off,
      onOffNet: snapshot.onOffNet,
    }));
    const comparison = compareCourtPulseToPbpStats(cp, snapshot);
    comparison.endpoint = endpoint;
    console.log('[PBPStatsValidation] comparison', JSON.stringify({
      issues: comparison.likelyIssues,
      delta: comparison.delta,
    }));
    return comparison;
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown PBPStats error';
    console.log('[PBPStatsValidation] error', message);
    return {
      status: 'error',
      courtPulseSnapshot: cp,
      likelyIssues: [],
      notes: [],
      error: { message, endpoint },
      endpoint,
    };
  }
}

export interface UsePbpStatsValidationParams {
  enabled: boolean;
  snapshot: OnCourtValidationSnapshot | null;
}

export interface UsePbpStatsValidationResult {
  comparison: ExternalValidationComparison | null;
  endpoint: string | null;
}

/**
 * Hook that fetches a PBPStats on/off comparison for the provided
 * CourtPulse snapshot when both `enabled` and the feature flag are true.
 */
export function usePbpStatsValidation(
  params: UsePbpStatsValidationParams,
): UsePbpStatsValidationResult {
  const flagEnabled = useFeatureFlag('enableExternalPbpStatsValidation');
  const { enabled, snapshot } = params;
  const [comparison, setComparison] = useState<ExternalValidationComparison | null>(null);
  const [endpoint, setEndpoint] = useState<string | null>(null);
  const lastKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!flagEnabled || !enabled || !snapshot) {
      setComparison(null);
      setEndpoint(null);
      lastKeyRef.current = null;
      return;
    }

    const { gameId, teamId, playerId } = snapshot;
    if (!gameId || !teamId || !playerId) {
      setComparison({
        status: 'unavailable',
        courtPulseSnapshot: snapshot,
        likelyIssues: [],
        notes: ['Missing gameId, teamId, or playerId for PBPStats validation.'],
      });
      setEndpoint(null);
      return;
    }

    const season = getSeasonFromGameId(gameId);
    const seasonType = deriveSeasonType(gameId);
    if (!season || !seasonType) {
      setComparison({
        status: 'unavailable',
        courtPulseSnapshot: snapshot,
        likelyIssues: [],
        notes: ['Missing season or season type for PBPStats validation.'],
      });
      setEndpoint(null);
      return;
    }

    const req: PbpStatsOnOffRequest = {
      gameId,
      teamId,
      playerId,
      season,
      seasonType,
    };
    const key = cacheKey(req);
    const url = buildPbpStatsOnOffUrl(req);
    setEndpoint(url);

    const cached = cache.get(key);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      setComparison(cached.comparison);
      lastKeyRef.current = key;
      return;
    }

    if (lastKeyRef.current === key) return;
    lastKeyRef.current = key;

    let cancelled = false;
    setComparison({
      status: 'loading',
      courtPulseSnapshot: snapshot,
      likelyIssues: [],
      notes: [],
      endpoint: url,
    });
    fetchPbpStatsOnOff(req, snapshot).then((result) => {
      if (cancelled) return;
      cache.set(key, { comparison: result, fetchedAt: Date.now() });
      setComparison(result);
    });
    return () => {
      cancelled = true;
    };
  }, [flagEnabled, enabled, snapshot]);

  return { comparison, endpoint };
}
