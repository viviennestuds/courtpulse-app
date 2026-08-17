import { useQuery } from '@tanstack/react-query';
import { fetchGameMatchupSummaryV2 } from '@/services/matchupSummaryV2';
import {
  gameMatchupSummaryV2QueryKey,
  gameMatchupSummaryV2RetryDelay,
  shouldRetryGameMatchupSummaryV2,
} from '@/services/matchupSummaryV2QueryPolicy';

export type MatchupSummaryV2GameStatus = 'live' | 'final' | 'scheduled';

export interface UseGameMatchupSummaryV2Options {
  gameId: string;
  offensePlayerId?: string;
  enabled: boolean;
  status: MatchupSummaryV2GameStatus;
}

/** Loads one isolated canonical Matchup Summary v1.1 cache entry. */
export function useGameMatchupSummaryV2({
  gameId,
  offensePlayerId,
  enabled,
  status,
}: UseGameMatchupSummaryV2Options) {
  const isLive = status === 'live';
  const isSupportedStatus = isLive || status === 'final';

  return useQuery({
    queryKey: gameMatchupSummaryV2QueryKey(gameId, offensePlayerId),
    queryFn: () => fetchGameMatchupSummaryV2(gameId, offensePlayerId),
    enabled: enabled && isSupportedStatus && gameId.length > 0 && (offensePlayerId === undefined || offensePlayerId.length > 0),
    staleTime: isLive ? 20000 : 1000 * 60 * 60,
    gcTime: 1000 * 60 * 60,
    refetchInterval: isLive ? 30000 : false,
    retry: shouldRetryGameMatchupSummaryV2,
    retryDelay: gameMatchupSummaryV2RetryDelay,
  });
}
