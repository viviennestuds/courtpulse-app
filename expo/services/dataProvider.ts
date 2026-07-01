import { Game, Team, Player, BoxScorePlayer, PlayByPlayEvent, ShotEvent, ScoringRun, ScoringDrought, LineupSegment, CustomMetric, TeamOverviewResponse, TeamRosterResponse, PlayersOverviewResponse } from '@/types';
import type { ScoreboardParseResult } from './nbaScoreboard';
import { getTodayDateString, formatGameDate, type FetchDiagnostics } from './nbaApi';
import { GameDetailData, CdnPbpAction } from './nbaGameData';
import { fetchPlayersOverview, fetchTeamRoster, fetchTeamsOverview, teamOverviewToTeam, fetchPlayerStats, getFallbackTeams, TEAM_STANDINGS_SEASON } from './nbaStats';
import { detectScoringRuns, detectDroughts, reconstructLineups, computeCustomMetrics } from './analyticsEngine';
import {
  getGamesByDate as getProxyGamesByDate,
  getBoxscore as getProxyBoxscore,
  getPlayByPlay as getProxyPlayByPlay,
  getNbaDataProxyBaseUrl,
  normalizeGamesByDateResponse,
  normalizeProxyBoxscore,
  normalizeProxyPlayByPlay,
} from './nbaDataProxy';

const BACKEND_URL = process.env.EXPO_PUBLIC_NBA_API_URL ?? '';

function hasBackend(): boolean {
  return BACKEND_URL.length > 0;
}

function backendUrl(path: string): string {
  const base = BACKEND_URL.endsWith('/') ? BACKEND_URL.slice(0, -1) : BACKEND_URL;
  return `${base}${path}`;
}

async function fetchBackend<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(backendUrl(path));
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }
  console.log(`[DataProvider] Backend request: ${url.toString()}`);
  const response = await fetch(url.toString(), {
    headers: { 'Accept': 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`Backend returned ${response.status}: ${response.statusText}`);
  }
  return response.json() as Promise<T>;
}

export type DataSource = 'live' | 'backend' | 'fallback' | 'demo';
export type DataState = 'success' | 'empty' | 'fallback' | 'error' | 'partial';

export interface DataResult<T> {
  data: T;
  source: DataSource;
  state: DataState;
  errorMessage?: string;
}

export interface TeamsDataResult extends DataResult<Team[]> {
  overview?: TeamOverviewResponse;
}

export interface TeamRosterDataResult extends DataResult<{
  roster: TeamRosterResponse;
  playersOverview?: PlayersOverviewResponse;
}> {}

export interface ScoreboardDataResult extends DataResult<{ games: Game[]; gameDate: string }> {
  parseResult: ScoreboardParseResult | null;
  diagnostics: FetchDiagnostics | null;
}

function buildProxyDiagnostics(type: string, params: Record<string, string>, responseSnippet: string, schemaValid: boolean, errorDetail: string = ''): FetchDiagnostics {
  const url = new URL(getNbaDataProxyBaseUrl());
  url.searchParams.set('type', type);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  return {
    url: url.toString(),
    proxyUsed: 'supabase-edge-function',
    httpStatus: schemaValid ? 200 : 0,
    responseSnippet: responseSnippet.substring(0, 200),
    schemaValid,
    errorDetail,
  };
}

function emptyScoreboardParseResult(date: string, parseError: string): ScoreboardParseResult {
  return {
    games: [],
    gameDate: date,
    rawGameCount: 0,
    transformedGameCount: 0,
    schemaMatched: false,
    parseError,
    yesterdayFallbackAttempted: false,
    yesterdayFallbackDate: '',
  };
}

export async function getScoreboard(): Promise<ScoreboardDataResult> {
  console.log('[DataProvider] getScoreboard called via NBA data proxy');
  const today = getTodayDateString();
  return getScoreboardForDateWithDiagnostics(today);
}

async function getScoreboardForDateWithDiagnostics(date: string): Promise<ScoreboardDataResult> {
  try {
    const response = await getProxyGamesByDate(date);
    const normalized = normalizeGamesByDateResponse(response, date);
    const parseResult: ScoreboardParseResult = {
      games: normalized.games,
      gameDate: normalized.gameDate,
      rawGameCount: normalized.rawGameCount,
      transformedGameCount: normalized.transformedGameCount,
      schemaMatched: normalized.schemaMatched,
      parseError: normalized.parseError,
      yesterdayFallbackAttempted: false,
      yesterdayFallbackDate: '',
    };
    const responseSnippet = JSON.stringify({
      success: response.success,
      type: response.type,
      date: response.date,
      resolvedSource: response.resolvedSource,
      gameCount: response.gameCount,
      parseError: response.parseError,
      error: response.error,
    });
    const diagnostics = buildProxyDiagnostics('gamesByDate', { date }, responseSnippet, normalized.schemaMatched, normalized.parseError);
    if (!response.success) {
      const reason = normalized.parseError || response.error || response.message || 'NBA data proxy returned success=false';
      throw new Error(reason);
    }
    const state: DataState = normalized.transformedGameCount > 0 ? 'success' : 'empty';
    console.log(`[DataProvider] Proxy scoreboard ${date}: ${normalized.transformedGameCount} games, source=${normalized.resolvedSource}, state=${state}`);
    return {
      data: { games: normalized.games, gameDate: normalized.gameDate },
      source: 'live',
      state,
      parseResult,
      diagnostics,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.warn(`[DataProvider] Proxy scoreboard unavailable for ${date}: ${errorMsg}`);
    const diagnostics = buildProxyDiagnostics('gamesByDate', { date }, '', false, errorMsg);
    throw Object.assign(new Error(errorMsg), {
      diagnostics,
      parseResult: emptyScoreboardParseResult(date, errorMsg),
    });
  }
}

export async function getScoreboardForDate(date: string): Promise<ScoreboardDataResult> {
  console.log(`[DataProvider] getScoreboardForDate called for ${date} via NBA data proxy`);
  return getScoreboardForDateWithDiagnostics(date);
}

export async function getRecentGames(daysBack: number = 3): Promise<DataResult<Game[]>> {
  const allGames: Game[] = [];
  const today = new Date();
  for (let i = 1; i <= daysBack; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = formatGameDate(date);
    const result = await getScoreboardForDate(dateStr);
    allGames.push(...result.data.games);
  }
  console.log(`[DataProvider] Recent proxy games: ${allGames.length}`);
  return { data: allGames, source: 'live', state: allGames.length > 0 ? 'success' : 'empty' };
}

export async function getGameDetail(gameId: string): Promise<DataResult<GameDetailData | null>> {
  if (hasBackend()) {
    try {
      const data = await fetchBackend<GameDetailData>(`/api/games/${gameId}/boxscore`);
      return { data, source: 'backend', state: 'success' };
    } catch (err) {
      console.warn('[DataProvider] Backend boxscore failed, falling back to NBA data proxy', err);
    }
  }

  const response = await getProxyBoxscore(gameId);
  const data = normalizeProxyBoxscore(response);
  if (!data) {
    const reason = response.error ?? response.message ?? response.parseError ?? 'Boxscore unavailable from NBA data proxy';
    console.warn(`[DataProvider] Proxy boxscore unavailable for ${gameId}: ${reason}`);
    throw new Error(reason);
  }
  return { data, source: 'live', state: 'success' };
}

export async function getPlayByPlay(gameId: string): Promise<DataResult<{
  events: PlayByPlayEvent[];
  shots: ShotEvent[];
  rawActions: CdnPbpAction[];
}>> {
  if (hasBackend()) {
    try {
      const data = await fetchBackend<{
        events: PlayByPlayEvent[];
        shots: ShotEvent[];
        rawActions: CdnPbpAction[];
      }>(`/api/games/${gameId}/playbyplay`);
      return { data, source: 'backend', state: 'success' };
    } catch (err) {
      console.warn('[DataProvider] Backend PBP failed, falling back to NBA data proxy', err);
    }
  }

  const response = await getProxyPlayByPlay(gameId);
  const data = normalizeProxyPlayByPlay(response);
  if (!data) {
    const reason = response.error ?? response.message ?? response.parseError ?? 'Play-by-play unavailable from NBA data proxy';
    console.warn(`[DataProvider] Proxy PBP unavailable for ${gameId}: ${reason}`);
    throw new Error(reason);
  }
  return { data, source: 'live', state: data.events.length > 0 || data.rawActions.length > 0 ? 'success' : 'empty' };
}

export async function getTeams(): Promise<TeamsDataResult> {
  try {
    const overview = await fetchTeamsOverview({ season: TEAM_STANDINGS_SEASON, seasonType: 'Regular Season' });
    const teams = overview.teams.map(teamOverviewToTeam);
    if (teams.length > 0) {
      return {
        data: teams,
        source: 'live',
        state: overview.partial ? 'partial' : 'success',
        overview,
      };
    }
  } catch (err) {
    console.warn('[DataProvider] Supabase teamsOverview.v2 failed; using static team fallback', err);
  }

  return { data: getFallbackTeams(), source: 'fallback', state: 'fallback' };
}

export async function getTeamRoster(teamId: string): Promise<TeamRosterDataResult> {
  const roster = await fetchTeamRoster({ teamId, season: TEAM_STANDINGS_SEASON });

  try {
    const playersOverview = await fetchPlayersOverview({ teamId, season: TEAM_STANDINGS_SEASON });
    return {
      data: { roster, playersOverview },
      source: 'live',
      state: roster.partial || playersOverview.partial ? 'partial' : 'success',
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[DataProvider] playersOverview.v2 failed for team ${teamId}; showing roster identity only`, err);
    return {
      data: { roster },
      source: 'live',
      state: 'partial',
      errorMessage: message,
    };
  }
}

export async function getPlayers(): Promise<DataResult<Player[]>> {
  if (hasBackend()) {
    try {
      const data = await fetchBackend<Player[]>('/api/players');
      return { data, source: 'backend', state: 'success' };
    } catch (err) {
      console.warn('[DataProvider] Backend players failed, falling back to stats.nba.com', err);
    }
  }

  try {
    const players = await fetchPlayerStats();
    if (players.length > 0) {
      return { data: players, source: 'live', state: 'success' };
    }
  } catch (err) {
    console.warn('[DataProvider] stats.nba.com players failed', err);
  }

  return { data: [], source: 'fallback', state: 'fallback' };
}

export async function getGameAnalytics(gameId: string): Promise<DataResult<{
  runs: ScoringRun[];
  droughts: ScoringDrought[];
  lineups: LineupSegment[];
  metrics: CustomMetric[];
}>> {
  if (hasBackend()) {
    try {
      const data = await fetchBackend<{
        runs: ScoringRun[];
        droughts: ScoringDrought[];
        lineups: LineupSegment[];
        metrics: CustomMetric[];
      }>(`/api/games/${gameId}/analytics`);
      return { data, source: 'backend', state: 'success' };
    } catch (err) {
      console.warn('[DataProvider] Backend analytics failed, computing client-side', err);
    }
  }

  return { data: { runs: [], droughts: [], lineups: [], metrics: [] }, source: 'fallback', state: 'fallback' };
}

export async function getMatchupIntelligence(gameId: string): Promise<DataResult<unknown>> {
  if (hasBackend()) {
    try {
      const data = await fetchBackend<unknown>(`/api/games/${gameId}/matchup`);
      return { data, source: 'backend', state: 'success' };
    } catch (err) {
      console.warn('[DataProvider] Backend matchup failed', err);
    }
  }

  return { data: null, source: 'demo', state: 'fallback' };
}

export async function getThresholdSplits(params: {
  entityType: 'team' | 'player';
  entityId: string;
  metric: string;
  threshold: number;
  operator: 'above' | 'below';
}): Promise<DataResult<unknown>> {
  if (hasBackend()) {
    try {
      const data = await fetchBackend<unknown>('/api/analytics/threshold-splits', {
        entityType: params.entityType,
        entityId: params.entityId,
        metric: params.metric,
        threshold: String(params.threshold),
        operator: params.operator,
      });
      return { data, source: 'backend', state: 'success' };
    } catch (err) {
      console.warn('[DataProvider] Backend threshold splits failed', err);
    }
  }

  return { data: null, source: 'demo', state: 'fallback' };
}

export function getBackendStatus(): { enabled: boolean; url: string } {
  return {
    enabled: hasBackend(),
    url: BACKEND_URL,
  };
}
