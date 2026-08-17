import { useQuery } from '@tanstack/react-query';
import { fetchGameMatchupEventsV2 } from '@/services/matchupEventsV2';
import type { MatchupSummaryV2GameStatus } from '@/hooks/useGameMatchupSummaryV2';

export interface UseGameMatchupEventsV2Options {
  gameId: string;
  offensePlayerId: string;
  defensePlayerId: string;
  enabled: boolean;
  status: MatchupSummaryV2GameStatus;
}

/** Loads canonical v1.3 evidence only while one exact-pair sheet is enabled. */
export function useGameMatchupEventsV2({
  gameId,
  offensePlayerId,
  defensePlayerId,
  enabled,
  status,
}: UseGameMatchupEventsV2Options) {
  const isLive = status === 'live';
  const isSupportedStatus = isLive || status === 'final';
  const hasValidIds = gameId.trim().length > 0
    && offensePlayerId.trim().length > 0
    && defensePlayerId.trim().length > 0;
  const isQueryEnabled = enabled && isSupportedStatus && hasValidIds;

  return useQuery({
    queryKey: ['gameMatchupEventsV2', gameId, offensePlayerId, defensePlayerId],
    queryFn: () => fetchGameMatchupEventsV2(gameId, offensePlayerId, defensePlayerId),
    enabled: isQueryEnabled,
    staleTime: isLive ? 20000 : 1000 * 60 * 60,
    gcTime: 1000 * 60 * 60,
    refetchInterval: isQueryEnabled && isLive ? 30000 : false,
    retry: 1,
  });
}
