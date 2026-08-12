import { useCallback, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { playersRepository } from '@/services/playersRepository';
import type {
  PlayerDirectorySnapshot,
  PlayersDirectoryCacheSource,
  PlayersDirectoryFreshness,
  PlayersDirectoryRepositoryError,
  PlayersDirectoryRepositoryResult,
  PlayersPhaseAvailabilityResponse,
  PlayersSeasonPhase,
} from '@/types/playersDirectory';

export interface UsePlayersDirectoryParams {
  season: string;
  phase: PlayersSeasonPhase;
  enabled?: boolean;
}

export interface UsePlayersDirectoryResult {
  snapshot: PlayerDirectorySnapshot | null;
  cacheSource: PlayersDirectoryCacheSource;
  freshness: PlayersDirectoryFreshness;
  isLoading: boolean;
  isRefreshing: boolean;
  error: PlayersDirectoryRepositoryError | null;
  refreshError: PlayersDirectoryRepositoryError | null;
  refresh: () => Promise<PlayersDirectoryRepositoryResult>;
}

/**
 * Keyed consumer boundary for the persistent Players repository. Repository
 * subscriptions update only the exact season/phase React Query entry.
 */
export function usePlayersDirectory({
  season,
  phase,
  enabled = true,
}: UsePlayersDirectoryParams): UsePlayersDirectoryResult {
  const queryClient = useQueryClient();
  const queryKey = useMemo(() => ['playersDirectory', season, phase] as const, [season, phase]);
  const query = useQuery({
    queryKey,
    queryFn: async () => {
      const result = await playersRepository.getDirectory({ season, phase });
      return playersRepository.getCurrentResult(season, phase) ?? result;
    },
    enabled: enabled && season.length > 0,
    staleTime: 0,
    gcTime: 1000 * 60 * 30,
    retry: false,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (!enabled || !season) return undefined;
    return playersRepository.subscribe(season, phase, (result) => {
      queryClient.setQueryData<PlayersDirectoryRepositoryResult>(queryKey, result);
    });
  }, [enabled, phase, queryClient, queryKey, season]);

  const refresh = useCallback(async (): Promise<PlayersDirectoryRepositoryResult> => {
    const result = await playersRepository.getDirectory({ season, phase, forceRefresh: true });
    queryClient.setQueryData<PlayersDirectoryRepositoryResult>(queryKey, result);
    return result;
  }, [phase, queryClient, queryKey, season]);

  const result = query.data;
  return {
    snapshot: result?.snapshot ?? null,
    cacheSource: result?.cacheSource ?? null,
    freshness: result?.freshness ?? 'unknown',
    isLoading: query.isPending && !result?.snapshot,
    isRefreshing: result?.isRefreshing ?? (query.isFetching && !!result?.snapshot),
    error: result?.error ?? null,
    refreshError: result?.refreshError ?? null,
    refresh,
  };
}

/** Lightweight standalone phase probe; failures remain query errors, never confirmed empty. */
export function usePlayersPhaseAvailability(season: string, enabled: boolean = true): {
  availability: PlayersPhaseAvailabilityResponse | null;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => Promise<unknown>;
} {
  const query = useQuery({
    queryKey: ['playersPhaseAvailability', season],
    queryFn: () => playersRepository.getPhaseAvailability(season),
    enabled: enabled && season.length > 0,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
    retry: 1,
  });
  return {
    availability: query.data ?? null,
    isLoading: query.isPending,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}
