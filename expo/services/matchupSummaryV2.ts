import { getStatsGameMatchupSummaryV2 } from '@/services/nbaDataProxy';
import {
  GameMatchupSummaryV2Response,
  isGameMatchupSummaryV2Response,
} from '@/types/matchupSummaryV2';

export class MatchupSummaryV2UnavailableError extends Error {
  constructor() {
    super('Canonical Matchup Summary v1.1 is unavailable');
    this.name = 'MatchupSummaryV2UnavailableError';
  }
}

/** Fetches and strictly validates the frozen Matchup Summary v1.1 contract. */
export async function fetchGameMatchupSummaryV2(
  gameId: string,
  offensePlayerId?: string,
): Promise<GameMatchupSummaryV2Response> {
  const response: unknown = await getStatsGameMatchupSummaryV2(gameId, offensePlayerId);
  const isAccepted = isGameMatchupSummaryV2Response(response)
    && response.gameId === gameId;

  if (!isAccepted) {
    if (__DEV__) {
      const envelope = typeof response === 'object' && response !== null
        ? response as Record<string, unknown>
        : {};
      console.warn('[MatchupSummaryV2] contract rejected', {
        gameId,
        offensePlayerId: offensePlayerId ?? null,
        success: envelope.success ?? null,
        sourceStatus: envelope.sourceStatus ?? null,
        contractRelease: envelope.contractRelease ?? null,
        schemaVersion: envelope.schemaVersion ?? null,
      });
    }
    throw new MatchupSummaryV2UnavailableError();
  }

  if (__DEV__) {
    console.log('[MatchupSummaryV2] contract accepted', {
      gameId,
      offensePlayerId: offensePlayerId ?? null,
      keyMatchupCount: response.keyMatchups.length,
      offensePlayerCount: response.offensePlayers.length,
      hasSelectedOffense: response.selectedOffense !== null,
    });
  }

  return response;
}
