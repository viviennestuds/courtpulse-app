import { getStatsGameMatchupEventsV2 } from '@/services/nbaDataProxy';
import {
  GameMatchupEventsV2Response,
  isGameMatchupEventsV2ResponseForPair,
} from '@/types/matchupEventsV2';

export class MatchupEventsV2UnavailableError extends Error {
  constructor() {
    super('Canonical Matchup Events v1.3 evidence is unavailable');
    this.name = 'MatchupEventsV2UnavailableError';
  }
}

function responseEnvelope(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null
    ? value as Record<string, unknown>
    : {};
}

function returnedPairIds(value: unknown): { returnedOffensePlayerId: unknown; returnedDefensePlayerId: unknown } {
  const envelope = responseEnvelope(value);
  const pairing = responseEnvelope(envelope.pairing);
  const offense = responseEnvelope(pairing.offense);
  const defense = responseEnvelope(pairing.defense);
  return {
    returnedOffensePlayerId: offense.playerId ?? null,
    returnedDefensePlayerId: defense.playerId ?? null,
  };
}

/** Fetches and strictly validates one exact-pair frozen Matchup Events v1.3 response. */
export async function fetchGameMatchupEventsV2(
  gameId: string,
  offensePlayerId: string,
  defensePlayerId: string,
): Promise<GameMatchupEventsV2Response> {
  const response: unknown = await getStatsGameMatchupEventsV2(gameId, offensePlayerId, defensePlayerId);
  const isAccepted = isGameMatchupEventsV2ResponseForPair(
    response,
    gameId,
    offensePlayerId,
    defensePlayerId,
  );

  if (!isAccepted) {
    if (__DEV__) {
      const envelope = responseEnvelope(response);
      console.warn('[MatchupEventsV2] contract rejected', {
        gameId,
        offensePlayerId,
        defensePlayerId,
        returnedGameId: envelope.gameId ?? null,
        ...returnedPairIds(response),
        contractRelease: envelope.contractRelease ?? null,
        schemaVersion: envelope.schemaVersion ?? null,
        sourceStatus: envelope.sourceStatus ?? null,
      });
    }
    throw new MatchupEventsV2UnavailableError();
  }

  if (__DEV__) {
    console.log('[MatchupEventsV2] contract accepted', {
      gameId,
      offensePlayerId,
      defensePlayerId,
      eventCount: response.events.length,
      sourceStatus: response.sourceStatus,
    });
  }

  return response;
}
