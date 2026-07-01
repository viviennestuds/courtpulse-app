import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { getScoreboard, getScoreboardForDate, getRecentGames, getGameDetail, getPlayByPlay, getTeams, getTeamRoster, getPlayers, DataSource, DataState, ScoreboardDataResult, TeamsDataResult, TeamRosterDataResult } from '@/services/dataProvider';
import { getTodayDateString } from '@/services/nbaApi';
import { GameDetailData, CdnPbpAction, fetchGameHustleStats, HustleStats, fetchGameMatchups, GameMatchupRow } from '@/services/nbaGameData';
import { getFallbackTeams } from '@/services/nbaStats';
import { ScoreboardParseResult } from '@/services/nbaScoreboard';
import { FetchDiagnostics } from '@/services/nbaApi';
import { detectScoringRuns, detectDroughts, reconstructLineups, computeCustomMetrics, buildGameTimelines, validateTimelineIntegrity } from '@/services/analyticsEngine';
import { PlayByPlayEvent, ScoringRun, ScoringDrought, LineupSegment, CustomMetric, Team, Player, Game, BoxScorePlayer, CanonicalTimelineSegment, TimelineIntegrityReport } from '@/types';

export interface DebugInfo {
  requestedDate: string;
  sourceType: DataSource;
  todayGameCount: number;
  recentGameCount: number;
  recentFallbackTriggered: boolean;
  todayQueryStatus: string;
  recentQueryStatus: string;
  errorMessage: string;
  lastFetchTime: string;
  rawGameCount: number;
  transformedGameCount: number;
  schemaMatched: boolean;
  parseError: string;
  yesterdayFallbackAttempted: boolean;
  yesterdayFallbackDate: string;
  proxyUsed: string;
  responseSnippet: string;
  nbaGameDate: string;
}

export function useScoreboard() {
  const todayQuery = useQuery({
    queryKey: ['scoreboard', 'date', getTodayDateString()],
    queryFn: getScoreboard,
    refetchInterval: 30000,
    staleTime: 15000,
    gcTime: 1000 * 60 * 30,
    retry: 2,
  });

  const recentQuery = useQuery({
    queryKey: ['scoreboard', 'recent'],
    queryFn: () => getRecentGames(3),
    staleTime: 60000 * 5,
    retry: 1,
  });

  const todayData = todayQuery.data as ScoreboardDataResult | undefined;
  const recentData = recentQuery.data;

  const todayGames = useMemo(() => todayData?.data?.games ?? [], [todayData]);
  const gameDate = todayData?.data?.gameDate ?? '';
  const recentGames = useMemo(() => recentData?.data ?? [], [recentData]);
  const allGames = useMemo(() => [...todayGames, ...recentGames], [todayGames, recentGames]);

  const liveGames = useMemo(() => todayGames.filter(g => g.status === 'live'), [todayGames]);
  const completedGames = useMemo(() => todayGames.filter(g => g.status === 'final'), [todayGames]);

  const featuredGame = useMemo(() => {
    return todayGames.find(g => g.featuredRun?.isDramatic)
      ?? todayGames.find(g => g.status === 'live')
      ?? completedGames[0]
      ?? recentGames[0]
      ?? todayGames[0];
  }, [todayGames, completedGames, recentGames]);

  const dataSource: DataSource = todayData?.source ?? 'live';
  const dataState: DataState = todayData?.state ?? (todayQuery.isError ? 'error' : 'empty');
  const recentFallbackTriggered = todayGames.length === 0 && recentGames.length > 0;

  const parseResult = todayData?.parseResult ?? null;
  const diagnostics = todayData?.diagnostics ?? null;

  const debugInfo = useMemo<DebugInfo>(() => ({
    requestedDate: new Date().toISOString().slice(0, 10),
    sourceType: dataSource,
    todayGameCount: todayGames.length,
    recentGameCount: recentGames.length,
    recentFallbackTriggered,
    todayQueryStatus: todayQuery.status,
    recentQueryStatus: recentQuery.status,
    errorMessage: todayQuery.error?.message ?? recentQuery.error?.message ?? '',
    lastFetchTime: new Date().toLocaleTimeString(),
    rawGameCount: parseResult?.rawGameCount ?? -1,
    transformedGameCount: parseResult?.transformedGameCount ?? -1,
    schemaMatched: parseResult?.schemaMatched ?? false,
    parseError: parseResult?.parseError ?? '',
    yesterdayFallbackAttempted: parseResult?.yesterdayFallbackAttempted ?? false,
    yesterdayFallbackDate: parseResult?.yesterdayFallbackDate ?? '',
    proxyUsed: diagnostics?.proxyUsed ?? 'unknown',
    responseSnippet: diagnostics?.responseSnippet ?? '',
    nbaGameDate: parseResult?.gameDate ?? '',
  }), [dataSource, todayGames.length, recentGames.length, recentFallbackTriggered, todayQuery.status, recentQuery.status, todayQuery.error, recentQuery.error, parseResult, diagnostics]);

  return {
    todayGames,
    recentGames,
    allGames,
    liveGames,
    completedGames,
    featuredGame,
    gameDate,
    dataSource,
    dataState,
    debugInfo,
    isLoading: todayQuery.isLoading,
    isError: todayQuery.isError,
    error: todayQuery.error,
    refetch: () => {
      void todayQuery.refetch();
      void recentQuery.refetch();
    },
    isRefetching: todayQuery.isRefetching || recentQuery.isRefetching,
  };
}

export function useScoreboardByDate(date: string) {
  const today = getTodayDateString();
  const isToday = date === today;

  const queryKey = useMemo(() => ['scoreboard', 'date', date] as const, [date]);

  const query = useQuery({
    queryKey,
    queryFn: () => {
      if (__DEV__) {
        console.log('[useScoreboardByDate] fetching', { selectedDate: date, queryKey });
      }
      return getScoreboardForDate(date);
    },
    refetchInterval: isToday ? 30000 : false,
    staleTime: isToday ? 15000 : 60000 * 10,
    gcTime: 1000 * 60 * 30,
    retry: 2,
    enabled: !!date,
    placeholderData: keepPreviousData,
  });

  const games = useMemo<Game[]>(() => query.data?.data?.games ?? [], [query.data]);
  const gameDate = query.isPlaceholderData ? date : query.data?.data?.gameDate ?? date;
  const dataSource: DataSource = query.data?.source ?? 'live';
  const dataState: DataState = query.data?.state ?? (query.isError ? 'error' : 'empty');

  if (__DEV__ && query.data) {
    console.log('[useScoreboardByDate] result', {
      selectedDate: date,
      gameDate,
      dataSource,
      gameCount: games.length,
      isFallback: dataSource === 'fallback',
    });
  }

  const liveGames = useMemo(() => games.filter(g => g.status === 'live'), [games]);
  const completedGames = useMemo(() => games.filter(g => g.status === 'final'), [games]);
  const scheduledGames = useMemo(() => games.filter(g => g.status === 'scheduled'), [games]);

  const featuredGame = useMemo(() => {
    return games.find(g => g.featuredRun?.isDramatic)
      ?? games.find(g => g.status === 'live')
      ?? completedGames[0]
      ?? games[0];
  }, [games, completedGames]);

  return {
    games,
    gameDate,
    dataSource,
    dataState,
    liveGames,
    completedGames,
    scheduledGames,
    featuredGame,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    isRefetching: query.isRefetching || query.isPlaceholderData,
    isPlaceholderData: query.isPlaceholderData,
  };
}

function getGameRefreshInterval(status?: Game['status']): number | false {
  if (status === 'final') return false;
  if (status === 'scheduled') return 1000 * 60 * 2;
  return 30000;
}

function getGameStaleTime(status?: Game['status']): number {
  if (status === 'final') return 1000 * 60 * 60;
  if (status === 'scheduled') return 1000 * 60 * 5;
  return 20000;
}

export function useGameDetail(gameId: string) {
  const boxScoreQuery = useQuery({
    queryKey: ['boxscore', gameId],
    queryFn: () => getGameDetail(gameId),
    enabled: !!gameId,
    staleTime: (query) => getGameStaleTime((query.state.data as Awaited<ReturnType<typeof getGameDetail>> | undefined)?.data?.game?.status),
    refetchInterval: (query) => getGameRefreshInterval((query.state.data as Awaited<ReturnType<typeof getGameDetail>> | undefined)?.data?.game?.status),
    gcTime: 1000 * 60 * 30,
    retry: 2,
  });

  const gameStatus = boxScoreQuery.data?.data?.game?.status;

  const pbpQuery = useQuery({
    queryKey: ['playbyplay', gameId],
    queryFn: () => getPlayByPlay(gameId),
    enabled: !!gameId,
    staleTime: getGameStaleTime(gameStatus),
    refetchInterval: getGameRefreshInterval(gameStatus),
    gcTime: 1000 * 60 * 30,
    retry: 2,
  });

  const boxData = boxScoreQuery.data?.data;
  const pbpData = pbpQuery.data?.data;
  const hasBoxData = !!boxData?.game;
  const hasPbpData = (pbpData?.events?.length ?? 0) > 0 || (pbpData?.rawActions?.length ?? 0) > 0;

  return {
    game: boxData?.game,
    homeBoxScore: boxData?.homeBoxScore ?? [],
    awayBoxScore: boxData?.awayBoxScore ?? [],
    homeTeamStats: boxData?.homeTeamStats ?? {},
    awayTeamStats: boxData?.awayTeamStats ?? {},
    events: pbpData?.events ?? [],
    shots: pbpData?.shots ?? [],
    rawActions: pbpData?.rawActions ?? [],
    boxScoreSource: boxScoreQuery.data?.source ?? ('live' as DataSource),
    pbpSource: pbpQuery.data?.source ?? ('live' as DataSource),
    boxScoreState: boxScoreQuery.data?.state ?? (boxScoreQuery.isError ? 'error' : 'empty'),
    pbpState: pbpQuery.data?.state ?? (pbpQuery.isError ? 'error' : 'empty'),
    isLoading: (boxScoreQuery.isLoading && !hasBoxData) || (pbpQuery.isLoading && !hasPbpData),
    isRefreshing: boxScoreQuery.isRefetching || pbpQuery.isRefetching,
    isError: boxScoreQuery.isError && !hasBoxData,
    pbpError: pbpQuery.error,
    error: boxScoreQuery.error ?? pbpQuery.error,
    refetch: () => {
      void boxScoreQuery.refetch();
      void pbpQuery.refetch();
    },
  };
}

export function useGameMatchups(gameId: string, enabled: boolean) {
  const query = useQuery({
    queryKey: ['matchups', gameId],
    queryFn: () => fetchGameMatchups(gameId),
    enabled: enabled && !!gameId,
    staleTime: 60000 * 5,
    retry: 1,
  });
  return {
    matchups: (query.data ?? []) as GameMatchupRow[],
    isLoading: query.isLoading,
    isError: query.isError,
  };
}

export function useGameHustle(gameId: string, enabled: boolean) {
  const query = useQuery({
    queryKey: ['hustle', gameId],
    queryFn: () => fetchGameHustleStats(gameId),
    enabled: enabled && !!gameId,
    staleTime: 60000,
    retry: 1,
  });
  return (query.data ?? null) as HustleStats | null;
}

export function useGameAnalytics(
  events: PlayByPlayEvent[],
  rawActions: CdnPbpAction[],
  homeTeamId: string,
  awayTeamId: string,
  homeAbbr: string,
  awayAbbr: string,
  homeBoxScore?: BoxScorePlayer[],
  awayBoxScore?: BoxScorePlayer[],
) {
  const homeStarters = useMemo<string[]>(() => {
    if (!homeBoxScore) return [];
    return homeBoxScore.filter(p => p.isStarter).map(p => p.name);
  }, [homeBoxScore]);

  const awayStarters = useMemo<string[]>(() => {
    if (!awayBoxScore) return [];
    return awayBoxScore.filter(p => p.isStarter).map(p => p.name);
  }, [awayBoxScore]);

  const timelines = useMemo<{ homeTimeline: CanonicalTimelineSegment[]; awayTimeline: CanonicalTimelineSegment[] } | null>(() => {
    if (rawActions.length === 0 || homeStarters.length !== 5 || awayStarters.length !== 5) return null;
    console.log('[Analytics] Building canonical timelines from starters + substitutions...');
    return buildGameTimelines(rawActions, homeTeamId, awayTeamId, homeStarters, awayStarters);
  }, [rawActions, homeTeamId, awayTeamId, homeStarters, awayStarters]);

  const integrityReports = useMemo<{ home: TimelineIntegrityReport; away: TimelineIntegrityReport } | null>(() => {
    if (!timelines) return null;
    const home = validateTimelineIntegrity(timelines.homeTimeline, homeTeamId, homeBoxScore, true);
    const away = validateTimelineIntegrity(timelines.awayTimeline, awayTeamId, awayBoxScore, false);
    return { home, away };
  }, [timelines, homeTeamId, awayTeamId, homeBoxScore, awayBoxScore]);

  const runs = useMemo<ScoringRun[]>(() => {
    if (events.length === 0) return [];
    console.log('[Analytics] Computing scoring runs...');
    return detectScoringRuns(events, rawActions.length > 0 ? rawActions : undefined);
  }, [events, rawActions]);

  const droughts = useMemo<ScoringDrought[]>(() => {
    if (events.length === 0) return [];
    console.log('[Analytics] Computing scoring droughts...');
    return detectDroughts(events, rawActions.length > 0 ? rawActions : undefined);
  }, [events, rawActions]);

  const lineups = useMemo<LineupSegment[]>(() => {
    if (rawActions.length === 0) return [];
    console.log('[Analytics] Reconstructing lineups...');
    return reconstructLineups(
      rawActions,
      homeTeamId,
      awayTeamId,
      homeStarters.length === 5 ? homeStarters : undefined,
      awayStarters.length === 5 ? awayStarters : undefined,
      timelines?.homeTimeline,
      timelines?.awayTimeline,
    );
  }, [rawActions, homeTeamId, awayTeamId, homeStarters, awayStarters, timelines]);

  const metrics = useMemo<CustomMetric[]>(() => {
    if (events.length === 0) return [];
    console.log('[Analytics] Computing custom metrics...');
    return computeCustomMetrics(runs, droughts, lineups, events, homeAbbr, awayAbbr);
  }, [runs, droughts, lineups, events, homeAbbr, awayAbbr]);

  return { runs, droughts, lineups, metrics, timelines, integrityReports, homeStarters, awayStarters };
}

export function useTeams() {
  const query = useQuery({
    queryKey: ['teams', 'stats'],
    queryFn: getTeams,
    staleTime: 1000 * 60 * 60,
    gcTime: 1000 * 60 * 60 * 6,
    retry: 1,
  });

  const teamsResult = query.data as TeamsDataResult | undefined;
  const teams = teamsResult?.data ?? getFallbackTeams();
  const dataSource: DataSource = teamsResult?.source ?? 'fallback';
  const dataState: DataState = teamsResult?.state ?? (query.isError ? 'error' : 'fallback');

  return {
    teams,
    teamsOverview: teamsResult?.overview,
    dataSource,
    dataState,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    isRefetching: query.isRefetching,
  };
}

export function useTeamRoster(teamId: string | undefined, enabled: boolean = true) {
  const query = useQuery({
    queryKey: ['teamRoster', teamId],
    queryFn: () => getTeamRoster(teamId ?? ''),
    enabled: enabled && !!teamId,
    staleTime: 1000 * 60 * 60,
    gcTime: 1000 * 60 * 60 * 6,
    retry: 1,
  });

  const rosterResult = query.data as TeamRosterDataResult | undefined;

  return {
    roster: rosterResult?.data.roster,
    playersOverview: rosterResult?.data.playersOverview,
    dataSource: rosterResult?.source ?? ('live' as DataSource),
    dataState: rosterResult?.state ?? (query.isError ? 'error' : 'empty'),
    statsErrorMessage: rosterResult?.errorMessage,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    isRefetching: query.isRefetching,
  };
}

export function usePlayers() {
  const query = useQuery({
    queryKey: ['players', 'stats'],
    queryFn: getPlayers,
    staleTime: 60000 * 30,
    retry: 1,
  });

  const players = query.data?.data ?? [];
  const dataSource: DataSource = query.data?.source ?? 'fallback';

  return {
    players,
    dataSource,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    isRefetching: query.isRefetching,
  };
}
