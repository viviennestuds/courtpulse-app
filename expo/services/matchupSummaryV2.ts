import { getStatsGameMatchupSummaryV2 } from '@/services/nbaDataProxy';
import {
  GameMatchupSummaryV2Response,
  MatchupSummaryV2ValidationCategory,
  validateGameMatchupSummaryV2Response,
} from '@/types/matchupSummaryV2';
import {
  MatchupSummaryV2Error,
  MatchupSummaryV2ErrorMetadata,
  MatchupSummaryV2FailureCategory,
} from '@/services/matchupSummaryV2Error';

export { MatchupSummaryV2Error } from '@/services/matchupSummaryV2Error';

function responseEnvelope(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function optionalString(value: unknown): string | null | undefined {
  return value === null || typeof value === 'string' ? value : undefined;
}

function optionalFiniteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function normalizedCategory(value: unknown): string {
  return typeof value === 'string' ? value.toLowerCase().replace(/[^a-z0-9]/g, '') : '';
}

const EXPLICIT_UNSUPPORTED_CATEGORIES = new Set<string>([
  'unsupported',
  'gameunsupported',
  'sourceunsupported',
  'notavailableforthisgame',
  'gameunavailable',
  'sourceunavailableforgame',
  'matchupunavailable',
  'matchupsunavailable',
  'matchupdataunavailableforthisgame',
  'nomatchupdata',
  'nomatchups',
  'nomatchuptracking',
]);

const EXPLICIT_TRANSIENT_CATEGORIES = new Set<string>([
  'timeout',
  'ratelimited',
  'upstreamtimeout',
  'upstreamunavailable',
  'temporarilyunavailable',
  'nbastatsunavailable',
  'nbastatstimeout',
  'sourcebusy',
  'sourceoverloaded',
]);

function envelopeMetadata(envelope: Record<string, unknown>): Omit<MatchupSummaryV2ErrorMetadata, 'category' | 'retryable'> {
  return {
    httpStatus: optionalFiniteNumber(envelope.httpStatus),
    retryAfterMs: optionalFiniteNumber(envelope.retryAfterMs),
    sourceStatus: optionalString(envelope.sourceStatus),
    errorCategory: optionalString(envelope.errorCategory),
    contractRelease: optionalString(envelope.contractRelease),
    schemaVersion: optionalString(envelope.schemaVersion),
  };
}

function classifiedError(
  message: string,
  envelope: Record<string, unknown>,
  category: MatchupSummaryV2FailureCategory,
  retryable: boolean,
  extra: Partial<MatchupSummaryV2ErrorMetadata> = {},
): MatchupSummaryV2Error {
  return new MatchupSummaryV2Error(message, {
    ...envelopeMetadata(envelope),
    ...extra,
    category,
    retryable,
  });
}

function classifyUnavailableEnvelope(envelope: Record<string, unknown>): MatchupSummaryV2Error | null {
  const httpStatus = optionalFiniteNumber(envelope.httpStatus);
  const sourceStatus = normalizedCategory(envelope.sourceStatus);
  const errorCategory = normalizedCategory(envelope.errorCategory);
  if (httpStatus === 408) return classifiedError('Matchup 2.0 request timed out', envelope, 'http408', true);
  if (httpStatus === 429) return classifiedError('Matchup 2.0 request was rate limited', envelope, 'http429', true);
  if (httpStatus !== undefined && httpStatus >= 500) {
    return classifiedError('Matchup 2.0 upstream service failed', envelope, 'http5xx', true);
  }
  if (
    sourceStatus === 'unsupported'
    || sourceStatus === 'notavailableforthisgame'
    || EXPLICIT_UNSUPPORTED_CATEGORIES.has(errorCategory)
  ) {
    return classifiedError('Detailed matchup tracking is unsupported for this game', envelope, 'unsupported', false);
  }
  if (httpStatus !== undefined && (httpStatus < 200 || httpStatus >= 300)) {
    return classifiedError('Matchup 2.0 request was rejected', envelope, 'httpOther', false);
  }

  if (envelope.clientErrorCategory === 'timeout') {
    return classifiedError('Matchup 2.0 request timed out', envelope, 'timeout', true);
  }
  if (envelope.clientErrorCategory === 'network') {
    return classifiedError('Matchup 2.0 network request failed', envelope, 'network', true);
  }
  if (envelope.clientErrorCategory === 'invalidJson') {
    return classifiedError('Matchup 2.0 returned invalid JSON', envelope, 'invalidJson', false);
  }

  if (
    EXPLICIT_TRANSIENT_CATEGORIES.has(sourceStatus)
    || EXPLICIT_TRANSIENT_CATEGORIES.has(errorCategory)
  ) {
    return classifiedError('Matchup 2.0 source is temporarily unavailable', envelope, 'proxyTransient', true);
  }
  if (envelope.success === false || (sourceStatus.length > 0 && sourceStatus !== 'ok')) {
    return classifiedError('Matchup 2.0 source is unavailable', envelope, 'proxySourceFailure', false);
  }
  return null;
}

function validationCategory(category: MatchupSummaryV2ValidationCategory): MatchupSummaryV2FailureCategory {
  return category;
}

/** Fetches and strictly validates the frozen Matchup Summary v1.1 contract. */
export async function fetchGameMatchupSummaryV2(
  gameId: string,
  offensePlayerId?: string,
): Promise<GameMatchupSummaryV2Response> {
  const response: unknown = await getStatsGameMatchupSummaryV2(gameId, offensePlayerId);
  const envelope = responseEnvelope(response);
  const unavailableError = classifyUnavailableEnvelope(envelope);
  if (unavailableError) {
    if (__DEV__) {
      console.warn('[MatchupSummaryV2] request rejected', {
        gameId,
        offensePlayerId: offensePlayerId ?? null,
        category: unavailableError.category,
        retryable: unavailableError.retryable,
        httpStatus: unavailableError.httpStatus ?? null,
        sourceStatus: unavailableError.sourceStatus ?? null,
        errorCategory: unavailableError.errorCategory ?? null,
      });
    }
    throw unavailableError;
  }

  const validation = validateGameMatchupSummaryV2Response(response, gameId, offensePlayerId);
  if (!validation.ok) {
    const error = classifiedError(
      'Matchup 2.0 response violated the v1.1 contract',
      envelope,
      validationCategory(validation.category),
      false,
      {
        validationPath: validation.path,
        validationReason: validation.reason,
      },
    );
    if (__DEV__) {
      console.warn('[MatchupSummaryV2] contract rejected', {
        gameId,
        offensePlayerId: offensePlayerId ?? null,
        category: error.category,
        sourceStatus: error.sourceStatus ?? null,
        contractRelease: error.contractRelease ?? null,
        schemaVersion: error.schemaVersion ?? null,
        validationPath: error.validationPath ?? null,
        validationReason: error.validationReason ?? null,
      });
    }
    throw error;
  }

  if (__DEV__) {
    console.log('[MatchupSummaryV2] contract accepted', {
      gameId,
      offensePlayerId: offensePlayerId ?? null,
      contractRelease: validation.data.contractRelease,
      schemaVersion: validation.data.schemaVersion,
      keyMatchupCount: validation.data.keyMatchups.length,
      offensePlayerCount: validation.data.offensePlayers.length,
      hasSelectedOffense: validation.data.selectedOffense !== null,
    });
  }

  return validation.data;
}
