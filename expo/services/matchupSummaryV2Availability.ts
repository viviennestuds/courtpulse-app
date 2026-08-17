import type { GameMatchupSummaryV2Response } from '@/types/matchupSummaryV2';
import { MatchupSummaryV2Error } from '@/services/matchupSummaryV2Error';

export type MatchupSummaryV2Availability =
  | { state: 'disabled' }
  | { state: 'loading' }
  | {
    state: 'ready';
    summary: GameMatchupSummaryV2Response;
    isRefreshing: boolean;
    isRetainingCachedDataAfterError: boolean;
  }
  | {
    state: 'empty';
    summary: GameMatchupSummaryV2Response;
    isRefreshing: boolean;
    isRetainingCachedDataAfterError: boolean;
  }
  | { state: 'transientError'; error: MatchupSummaryV2Error | null }
  | { state: 'unsupported'; error: MatchupSummaryV2Error }
  | { state: 'contractError'; error: MatchupSummaryV2Error | null; reason?: string };

export interface ResolveMatchupSummaryV2AvailabilityOptions {
  featureEnabled: boolean;
  gameId: string;
  isPending: boolean;
  isFetching: boolean;
  isError: boolean;
  data?: GameMatchupSummaryV2Response;
  error: unknown;
}

function normalizedId(value: string): string {
  return value.trim();
}

/** Resolves one authoritative Matchup 2.0 product state for a live/final game. */
export function resolveMatchupSummaryV2Availability({
  featureEnabled,
  gameId,
  isPending,
  isFetching,
  isError,
  data,
  error,
}: ResolveMatchupSummaryV2AvailabilityOptions): MatchupSummaryV2Availability {
  if (!featureEnabled) return { state: 'disabled' };
  if (!normalizedId(gameId)) {
    return { state: 'contractError', error: null, reason: 'Missing requested game identity' };
  }

  if (data !== undefined) {
    if (normalizedId(data.gameId) !== normalizedId(gameId)) {
      return { state: 'contractError', error: null, reason: 'Cached response game identity mismatch' };
    }
    const shared = {
      summary: data,
      isRefreshing: isFetching,
      isRetainingCachedDataAfterError: isError,
    };
    return data.keyMatchups.length === 0
      ? { state: 'empty', ...shared }
      : { state: 'ready', ...shared };
  }

  if (isPending) return { state: 'loading' };
  if (!(error instanceof MatchupSummaryV2Error)) {
    return error
      ? { state: 'contractError', error: null, reason: 'Unclassified SummaryV2 failure' }
      : { state: 'loading' };
  }
  if (error.category === 'unsupported') return { state: 'unsupported', error };
  if (
    error.category === 'network'
    || error.category === 'timeout'
    || error.category === 'http408'
    || error.category === 'http429'
    || error.category === 'http5xx'
    || error.category === 'proxyTransient'
  ) {
    return { state: 'transientError', error };
  }
  return { state: 'contractError', error };
}
