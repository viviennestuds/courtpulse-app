import {
  isRetryableMatchupSummaryV2Error,
  MatchupSummaryV2Error,
} from '@/services/matchupSummaryV2Error';

export const MATCHUP_SUMMARY_V2_MAX_AUTOMATIC_RETRIES = 1;

/** Returns the isolated cache key for one game/player SummaryV2 request. */
export function gameMatchupSummaryV2QueryKey(gameId: string, offensePlayerId?: string) {
  return ['gameMatchupSummaryV2', gameId, offensePlayerId ?? 'all'] as const;
}

/** Retries only explicitly recoverable transport or upstream failures. */
export function shouldRetryGameMatchupSummaryV2(failureCount: number, error: unknown): boolean {
  const shouldRetry = failureCount < MATCHUP_SUMMARY_V2_MAX_AUTOMATIC_RETRIES
    && isRetryableMatchupSummaryV2Error(error);
  if (typeof __DEV__ !== 'undefined' && __DEV__ && error instanceof MatchupSummaryV2Error) {
    console.log('[MatchupSummaryV2] retry decision', {
      failureCount,
      category: error.category,
      httpStatus: error.httpStatus ?? null,
      retryable: error.retryable,
      willRetry: shouldRetry,
    });
  }
  return shouldRetry;
}

/** Uses bounded backoff and a usable server Retry-After hint when supplied. */
export function gameMatchupSummaryV2RetryDelay(attemptIndex: number, error: unknown): number {
  const boundedDefault = Math.min(1000 * 2 ** attemptIndex, 5000);
  if (!(error instanceof MatchupSummaryV2Error) || error.retryAfterMs === undefined) {
    return boundedDefault;
  }
  return Math.min(Math.max(0, error.retryAfterMs), 5000);
}
