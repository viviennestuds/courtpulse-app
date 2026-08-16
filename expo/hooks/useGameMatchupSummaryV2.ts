import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { fetchGameMatchupSummaryV2 } from '@/services/matchupSummaryV2';

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
    queryKey: ['gameMatchupSummaryV2', gameId, offensePlayerId ?? 'all'],
    queryFn: () => fetchGameMatchupSummaryV2(gameId, offensePlayerId),
    enabled: enabled && isSupportedStatus && gameId.length > 0 && (offensePlayerId === undefined || offensePlayerId.length > 0),
    staleTime: isLive ? 20000 : 1000 * 60 * 60,
    gcTime: 1000 * 60 * 60,
    refetchInterval: isLive ? 30000 : false,
    retry: 1,
    placeholderData: offensePlayerId ? keepPreviousData : undefined,
  });
}
