export type PlayoffCatalogUnavailableReason =
  | 'requestFailure'
  | 'incompatiblePayload'
  | 'zeroResult';

export type PlayoffCatalogAcquisition =
  | {
      state: 'usable';
      catalog: Record<string, unknown>;
    }
  | {
      state: 'unavailable';
      reason: PlayoffCatalogUnavailableReason;
      message: string;
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isPlayoffGame(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value)) return false;
  const gameId = value.gameId;
  return typeof gameId === 'string' && gameId.startsWith('004');
}

function isPlayoffSeries(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value)) return false;

  const seriesKey = value.seriesKey;
  const gameCount = value.gameCount;
  const games = value.games;

  return (
    typeof seriesKey === 'string'
    && seriesKey.trim().length > 0
    && isNonNegativeInteger(gameCount)
    && Array.isArray(games)
    && games.length > 0
    && gameCount === games.length
    && games.every(isPlayoffGame)
  );
}

export function classifyPlayoffCatalogAcquisition(payload: unknown): PlayoffCatalogAcquisition {
  if (!isRecord(payload)) {
    return {
      state: 'unavailable',
      reason: 'incompatiblePayload',
      message: 'Playoff catalog response is not an object',
    };
  }

  if (payload.success !== true) {
    return {
      state: 'unavailable',
      reason: 'requestFailure',
      message: 'Playoff catalog acquisition failed',
    };
  }

  if (
    payload.type !== 'playoffCatalog'
    || payload.sourceStatus !== 'ok'
    || typeof payload.source !== 'string'
    || payload.source.trim().length === 0
  ) {
    return {
      state: 'unavailable',
      reason: 'incompatiblePayload',
      message: 'Playoff catalog response metadata is incompatible',
    };
  }

  const games = payload.games;
  const series = payload.series;
  const playoffGameCount = payload.playoffGameCount;
  const seriesCount = payload.seriesCount;

  if (
    !Array.isArray(games)
    || !Array.isArray(series)
    || !isNonNegativeInteger(playoffGameCount)
    || !isNonNegativeInteger(seriesCount)
    || playoffGameCount !== games.length
    || seriesCount !== series.length
  ) {
    return {
      state: 'unavailable',
      reason: 'incompatiblePayload',
      message: 'Playoff catalog counts or collections are incompatible',
    };
  }

  if (games.length === 0 || series.length === 0) {
    return {
      state: 'unavailable',
      reason: 'zeroResult',
      message: 'Playoff catalog does not establish a usable populated domain',
    };
  }

  if (!games.every(isPlayoffGame) || !series.every(isPlayoffSeries)) {
    return {
      state: 'unavailable',
      reason: 'incompatiblePayload',
      message: 'Playoff catalog contains incompatible playoff data',
    };
  }

  const gameIds = new Set(games.map(game => String((game as Record<string, unknown>).gameId)));

  for (const rawSeries of series) {
    const seriesGames = (rawSeries as Record<string, unknown>).games as unknown[];
    if (!seriesGames.every(game => gameIds.has(String((game as Record<string, unknown>).gameId)))) {
      return {
        state: 'unavailable',
        reason: 'incompatiblePayload',
        message: 'Playoff series references games outside the catalog',
      };
    }
  }

  return {
    state: 'usable',
    catalog: payload,
  };
}

export class PlayoffCatalogUnavailableError extends Error {
  reason: PlayoffCatalogUnavailableReason;

  constructor(reason: PlayoffCatalogUnavailableReason, message: string) {
    super(message);
    this.name = 'PlayoffCatalogUnavailableError';
    this.reason = reason;
  }
}

export function requireUsablePlayoffCatalog(payload: unknown): Record<string, unknown> {
  const result = classifyPlayoffCatalogAcquisition(payload);
  if (result.state === 'unavailable') {
    throw new PlayoffCatalogUnavailableError(result.reason, result.message);
  }
  return result.catalog;
}
