import { BoxScorePlayer, Game, PlayByPlayEvent, ShotEvent, StatsBoxScoreTraditionalV3Response, StatsGameHydrationResponse, StatsHydratedBoxScore, StatsHydratedGame, StatsHydratedPlayByPlayAction, StatsHydratedPlayerBoxScore, StatsHydratedTeam, StatsHydratedTeamBoxScore, StatsPlayByPlayV3Response } from '@/types';
import { getTeamColor, getTeamInfoById } from '@/constants/nbaTeams';
import {
  formatGameDate,
  getGameStatus,
  getPeriodText,
  getStatusClockText,
  parsePTClock,
  parsePTMinutes,
  parsePTToSeconds,
} from './nbaApi';
import type { CdnPbpAction, GameDetailData } from './nbaGameData';
import { normalizePlayerBoxScoreMiscStats, normalizeTeamBoxScoreMiscStats } from '@/utils/nbaBoxScoreMiscStats';

const NBA_DATA_PROXY_BASE_URL = 'https://gikxqfkzmwcujkndoizr.supabase.co/functions/v1/nba-data-proxy';
const DEFAULT_TIMEOUT_MS = 15000;

export type NbaDataProxyType = 'gamesByDate' | 'boxscore' | 'playbyplay' | 'playoffCatalog' | 'playoffGamesByDate' | 'statsBoxScoreTraditionalV3' | 'statsPlayByPlayV3' | 'statsGameHydration';

export interface NbaDataProxyBaseResponse {
  success: boolean;
  type: NbaDataProxyType | string;
  date?: string | null;
  gameId?: string | null;
  fetchedAt?: string;
  resolvedSource?: string;
  source?: string | null;
  sourceStatus?: string | null;
  errorCategory?: string | null;
  noGamesConfirmed?: boolean;
  sourceCapabilities?: Record<string, string | number | boolean | null | undefined> | null;
  sourceUrl?: string;
  httpStatus?: number;
  statusText?: string;
  contentType?: string;
  gameCount?: number;
  attempts?: unknown;
  parseError?: string | null;
  error?: string;
  message?: string;
  data?: unknown;
}

export interface ProxyTeamShape {
  teamId?: string | number | null;
  teamName?: string | null;
  teamCity?: string | null;
  teamTricode?: string | null;
  score?: string | number | null;
  players?: ProxyBoxScorePlayerShape[];
  statistics?: Record<string, string | number | null | undefined>;
  stats?: Record<string, string | number | null | undefined>;
}

export interface ProxyGameShape {
  source?: string;
  gameId?: string | null;
  gameCode?: string | null;
  primaryDate?: string | null;
  gameCodeDate?: string | null;
  gameStatus?: string | number | null;
  gameStatusText?: string | null;
  period?: string | number | null;
  gameClock?: string | null;
  gameTimeUTC?: string | null;
  gameDateUTC?: string | null;
  gameEt?: string | null;
  gameTimeLocal?: string | null;
  seriesGameNumber?: string | null;
  seriesText?: string | null;
  arena?: {
    arenaName?: string | null;
    arenaCity?: string | null;
    arenaState?: string | null;
  } | null;
  attendance?: string | number | null;
  homeTeam?: ProxyTeamShape | null;
  awayTeam?: ProxyTeamShape | null;
  scheduleGame?: ProxyGameShape | null;
}

export interface NbaGamesByDateProxyResponse extends NbaDataProxyBaseResponse {
  type: 'gamesByDate';
  date: string;
  gameCount: number;
  games?: ProxyGameShape[];
}

export interface NbaBoxscoreProxyResponse extends NbaDataProxyBaseResponse {
  type: 'boxscore';
  gameId: string;
  data?: {
    game?: ProxyGameShape | null;
    meta?: unknown;
  } | null;
}

export interface NbaPlayByPlayProxyResponse extends NbaDataProxyBaseResponse {
  type: 'playbyplay';
  gameId: string;
  data?: {
    game?: {
      gameId?: string;
      actions?: ProxyPbpActionShape[];
    } | null;
    meta?: unknown;
  } | null;
}

export interface NbaPlayoffCatalogProxyResponse extends NbaDataProxyBaseResponse {
  type: 'playoffCatalog';
  source?: string;
  playoffGameCount?: number;
  seriesCount?: number;
  games?: unknown[];
  series?: unknown[];
  data?: unknown;
}

interface ProxyBoxScorePlayerShape {
  status?: string | null;
  order?: string | number | null;
  personId?: string | number | null;
  playerId?: string | number | null;
  jerseyNum?: string | null;
  position?: string | null;
  starter?: string | number | boolean | null;
  isStarter?: boolean | null;
  isActive?: boolean | null;
  oncourt?: string | number | null;
  played?: string | number | boolean | null;
  comment?: string | null;
  statistics?: Record<string, string | number | null | undefined>;
  stats?: Record<string, string | number | null | undefined>;
  name?: string | null;
  displayName?: string | null;
  nameI?: string | null;
  firstName?: string | null;
  familyName?: string | null;
  playerSlug?: string | null;
  teamId?: string | number | null;
  teamTricode?: string | null;
  homeAway?: string | null;
}

interface ProxyPbpActionShape {
  actionNumber?: string | number | null;
  clock?: string | null;
  timeActual?: string | null;
  period?: string | number | null;
  periodType?: string | null;
  teamId?: string | number | null;
  teamTricode?: string | null;
  actionType?: string | null;
  subType?: string | null;
  qualifiers?: unknown;
  personId?: string | number | null;
  x?: string | number | null;
  y?: string | number | null;
  area?: string | null;
  areaDetail?: string | null;
  side?: string | null;
  shotDistance?: string | number | null;
  possession?: string | number | null;
  scoreHome?: string | number | null;
  scoreAway?: string | number | null;
  xLegacy?: string | number | null;
  yLegacy?: string | number | null;
  isFieldGoal?: string | number | boolean | null;
  shotResult?: string | null;
  pointsTotal?: string | number | null;
  playerName?: string | null;
  playerNameI?: string | null;
  description?: string | null;
  personIdsFilter?: unknown;
  assistPersonId?: string | number | null;
  assistPlayerNameInitial?: string | null;
  location?: string | null;
  videoAvailable?: boolean | null;
  actionId?: string | number | null;
  eventNum?: string | number | null;
}

export interface NormalizedGamesByDateResult {
  games: Game[];
  gameDate: string;
  rawGameCount: number;
  transformedGameCount: number;
  schemaMatched: boolean;
  parseError: string;
  resolvedSource: string;
}

function buildProxyUrl(type: NbaDataProxyType, params: Record<string, string> = {}): string {
  const url = new URL(NBA_DATA_PROXY_BASE_URL);
  url.searchParams.set('type', type);
  Object.entries(params).forEach(([key, value]) => {
    if (value.trim()) url.searchParams.set(key, value);
  });
  return url.toString();
}

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    return await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function requestProxy<T extends NbaDataProxyBaseResponse>(type: NbaDataProxyType, params: Record<string, string> = {}): Promise<T> {
  const url = buildProxyUrl(type, params);
  try {
    const response = await fetchWithTimeout(url);
    const text = await response.text();
    const parsed = text ? JSON.parse(text) as unknown : null;
    if (!response.ok) {
      return {
        success: false,
        type,
        httpStatus: response.status,
        statusText: response.statusText,
        error: `NBA data proxy returned ${response.status}`,
        message: typeof parsed === 'object' && parsed !== null ? String((parsed as Record<string, unknown>).message ?? '') : '',
      } as T;
    }
    if (!parsed || typeof parsed !== 'object') {
      return {
        success: false,
        type,
        httpStatus: response.status,
        statusText: response.statusText,
        error: 'NBA data proxy returned an empty or invalid JSON response',
      } as T;
    }
    return parsed as T;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[NBADataProxy] ${type} request unavailable: ${message}`);
    return {
      success: false,
      type,
      error: message,
    } as T;
  }
}

function toNumber(value: unknown, fallback: number = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function toOptionalNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function pickNumber(source: Record<string, unknown>, keys: string[], fallback: number = 0): number {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      const parsed = toOptionalNumber(source[key]);
      if (parsed !== undefined) return parsed;
    }
  }
  return fallback;
}

function pickPercentage(source: Record<string, unknown>, keys: string[]): number {
  const raw = pickNumber(source, keys);
  return raw > 0 && raw <= 1 ? raw * 100 : raw;
}

function toStringValue(value: unknown, fallback: string = ''): string {
  if (value === null || value === undefined) return fallback;
  return String(value);
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(item => String(item));
}

function pickGameDate(game: ProxyGameShape, requestedDate: string): string {
  return game.primaryDate
    ?? game.gameCodeDate
    ?? game.scheduleGame?.primaryDate
    ?? game.scheduleGame?.gameCodeDate
    ?? requestedDate;
}

function cleanString(value: unknown): string {
  return toStringValue(value).trim();
}

function teamToGameTeam(team: ProxyTeamShape | null | undefined): Game['homeTeam'] {
  const teamId = cleanString(team?.teamId);
  const rawTricode = cleanString(team?.teamTricode);
  const tricode = rawTricode || 'TBD';
  const info = getTeamInfoById(Number(teamId));
  const rawName = cleanString(team?.teamName);
  const rawCity = cleanString(team?.teamCity);
  const name = rawName || rawCity || (tricode === 'TBD' ? 'Finals Team TBD' : tricode);
  return {
    id: teamId,
    abbreviation: tricode,
    name,
    score: toNumber(team?.score),
    primaryColor: info?.primaryColor ?? getTeamColor(tricode),
  };
}

function normalizeProxyGame(game: ProxyGameShape, requestedDate: string): Game {
  const scheduleGame = game.scheduleGame ?? null;
  const gameStatus = toNumber(game.gameStatus ?? scheduleGame?.gameStatus, 1);
  const period = toNumber(game.period ?? scheduleGame?.period, 0);
  const gameClock = toStringValue(game.gameClock ?? scheduleGame?.gameClock, '');
  const gameStatusText = toStringValue(game.gameStatusText ?? scheduleGame?.gameStatusText, '');
  const arena = game.arena ?? scheduleGame?.arena ?? null;
  const arenaName = toStringValue(arena?.arenaName);
  const arenaCity = toStringValue(arena?.arenaCity);
  const seriesGameNumber = scheduleGame?.seriesGameNumber ?? game.seriesGameNumber ?? undefined;
  const seriesText = scheduleGame?.seriesText ?? game.seriesText ?? undefined;

  return {
    id: toStringValue(game.gameId ?? scheduleGame?.gameId),
    date: pickGameDate(game, requestedDate),
    status: getGameStatus(gameStatus),
    period: getPeriodText(period, gameStatus),
    clock: getStatusClockText(gameStatus, gameStatusText, gameClock),
    homeTeam: teamToGameTeam(game.homeTeam ?? scheduleGame?.homeTeam),
    awayTeam: teamToGameTeam(game.awayTeam ?? scheduleGame?.awayTeam),
    arena: arenaName ? (arenaCity ? `${arenaName}, ${arenaCity}` : arenaName) : '',
    attendance: game.attendance != null ? toNumber(game.attendance) : undefined,
    isPlayoff: toStringValue(game.gameId ?? scheduleGame?.gameId).startsWith('004') || !!seriesGameNumber || !!seriesText,
    seriesGameNumber,
    seriesText,
  };
}

function getCanonicalDisplayName(player: Pick<ProxyBoxScorePlayerShape, 'displayName' | 'nameI' | 'firstName' | 'familyName' | 'name'>): string {
  const firstLastName = `${toStringValue(player.firstName).trim()} ${toStringValue(player.familyName).trim()}`.trim();
  return toStringValue(player.displayName || player.nameI || firstLastName || player.name);
}

function transformBoxScorePlayer(player: ProxyBoxScorePlayerShape): BoxScorePlayer {
  const stats = (player.statistics ?? player.stats ?? {}) as Record<string, unknown>;
  const starterValue = player.isStarter ?? player.starter;
  return {
    playerId: toStringValue(player.personId ?? player.playerId),
    name: getCanonicalDisplayName(player),
    position: toStringValue(player.position),
    minutes: parsePTMinutes(toStringValue(stats.minutes ?? (player as { minutes?: unknown }).minutes)),
    points: pickNumber(stats, ['points']),
    rebounds: pickNumber(stats, ['reboundsTotal', 'rebounds']),
    offensiveRebounds: pickNumber(stats, ['reboundsOffensive', 'offensiveRebounds']),
    defensiveRebounds: pickNumber(stats, ['reboundsDefensive', 'defensiveRebounds']),
    assists: pickNumber(stats, ['assists']),
    steals: pickNumber(stats, ['steals']),
    blocks: pickNumber(stats, ['blocks']),
    turnovers: pickNumber(stats, ['turnovers']),
    fgm: pickNumber(stats, ['fieldGoalsMade', 'fgm']),
    fga: pickNumber(stats, ['fieldGoalsAttempted', 'fga']),
    tpm: pickNumber(stats, ['threePointersMade', 'fg3m']),
    tpa: pickNumber(stats, ['threePointersAttempted', 'fg3a']),
    ftm: pickNumber(stats, ['freeThrowsMade', 'ftm']),
    fta: pickNumber(stats, ['freeThrowsAttempted', 'fta']),
    plusMinus: pickNumber(stats, ['plusMinusPoints', 'plusMinus']),
    isStarter: starterValue === true || String(starterValue ?? '').toLowerCase() === 'true' || String(starterValue ?? '') === '1',
    ...normalizePlayerBoxScoreMiscStats(stats),
  };
}

function isActiveBoxScorePlayer(player: ProxyBoxScorePlayerShape): boolean {
  const status = String(player.status ?? '').toLowerCase();
  const played = String(player.played ?? '').toLowerCase();
  return player.isActive === true || played === '1' || played === 'true' || status === 'active';
}

function activePlayers(team: ProxyTeamShape | null | undefined): BoxScorePlayer[] {
  const players = team?.players ?? [];
  return players
    .filter(isActiveBoxScorePlayer)
    .sort((a, b) => toNumber(a.order) - toNumber(b.order))
    .map(transformBoxScorePlayer)
    .filter(player => player.playerId.length > 0);
}

function extractTeamStats(team: ProxyTeamShape | null | undefined): Record<string, number> {
  const stats = (team?.statistics ?? team?.stats ?? {}) as Record<string, unknown>;
  const oreb = pickNumber(stats, ['reboundsOffensive', 'offensiveRebounds']);
  const dreb = pickNumber(stats, ['reboundsDefensive', 'defensiveRebounds']);
  const apiTotal = pickNumber(stats, ['reboundsTotal', 'rebounds'], oreb + dreb);
  const canonicalTotal = oreb + dreb || apiTotal;
  const mappedStats: Record<string, number> = {
    points: toNumber(team?.score, pickNumber(stats, ['points'])),
    fieldGoalsMade: pickNumber(stats, ['fieldGoalsMade', 'fgm']),
    fieldGoalsAttempted: pickNumber(stats, ['fieldGoalsAttempted', 'fga']),
    fieldGoalsPercentage: pickPercentage(stats, ['fieldGoalsPercentage', 'fgPct']),
    threePointersMade: pickNumber(stats, ['threePointersMade', 'fg3m']),
    threePointersAttempted: pickNumber(stats, ['threePointersAttempted', 'fg3a']),
    threePointersPercentage: pickPercentage(stats, ['threePointersPercentage', 'fg3Pct']),
    freeThrowsMade: pickNumber(stats, ['freeThrowsMade', 'ftm']),
    freeThrowsAttempted: pickNumber(stats, ['freeThrowsAttempted', 'fta']),
    freeThrowsPercentage: pickPercentage(stats, ['freeThrowsPercentage', 'ftPct']),
    reboundsOffensive: oreb,
    reboundsDefensive: dreb,
    reboundsTotal: canonicalTotal,
    reboundsTotalRaw: apiTotal,
    assists: pickNumber(stats, ['assists']),
    steals: pickNumber(stats, ['steals']),
    blocks: pickNumber(stats, ['blocks']),
    turnovers: pickNumber(stats, ['turnovers']),
    foulsPersonal: pickNumber(stats, ['foulsPersonal', 'fouls']),
  };

  return {
    ...mappedStats,
    ...normalizeTeamBoxScoreMiscStats(stats),
  };
}

function normalizePbpAction(action: ProxyPbpActionShape): CdnPbpAction {
  const x = toOptionalNumber(action.x);
  const y = toOptionalNumber(action.y);
  const xLegacy = toOptionalNumber(action.xLegacy);
  const yLegacy = toOptionalNumber(action.yLegacy);
  return {
    source: (action as { source?: string }).source,
    actionNumber: toNumber(action.actionNumber),
    clock: toStringValue(action.clock),
    timeActual: toStringValue(action.timeActual),
    period: toNumber(action.period),
    periodType: toStringValue(action.periodType),
    teamId: toNumber(action.teamId),
    teamTricode: toStringValue(action.teamTricode),
    actionType: toStringValue(action.actionType),
    subType: toStringValue(action.subType),
    qualifiers: toStringArray(action.qualifiers),
    personId: toNumber(action.personId),
    x,
    y,
    area: toStringValue(action.area),
    areaDetail: toStringValue(action.areaDetail),
    side: toStringValue(action.side),
    shotDistance: toNumber(action.shotDistance),
    possession: toNumber(action.possession),
    scoreHome: toStringValue(action.scoreHome, '0'),
    scoreAway: toStringValue(action.scoreAway, '0'),
    xLegacy,
    yLegacy,
    isFieldGoal: action.isFieldGoal === true ? 1 : toNumber(action.isFieldGoal),
    shotResult: toStringValue(action.shotResult),
    pointsTotal: toNumber(action.pointsTotal),
    playerName: toStringValue(action.playerName),
    playerNameI: toStringValue(action.playerNameI),
    description: toStringValue(action.description),
    personIdsFilter: Array.isArray(action.personIdsFilter) ? action.personIdsFilter.map(item => toNumber(item)) : [],
    assistPersonId: action.assistPersonId != null ? toNumber(action.assistPersonId) : undefined,
    assistPlayerNameInitial: action.assistPlayerNameInitial ?? undefined,
    location: action.location ?? undefined,
    videoAvailable: action.videoAvailable ?? undefined,
    actionId: action.actionId ?? undefined,
    eventNum: toOptionalNumber(action.eventNum ?? action.actionNumber),
  };
}

function mapActionTypeToEventType(action: CdnPbpAction): PlayByPlayEvent['eventType'] {
  const actionType = action.actionType.toLowerCase();
  const shotResult = action.shotResult?.toLowerCase();
  if (actionType === '2pt' || actionType === '3pt') return shotResult === 'made' ? 'score' : 'miss';
  if (actionType === 'freethrow') return shotResult === 'made' ? 'score' : 'miss';
  if (actionType === 'turnover') return 'turnover';
  if (actionType === 'foul') return 'foul';
  if (actionType === 'substitution') return 'substitution';
  if (actionType === 'rebound') return 'rebound';
  if (actionType === 'timeout') return 'timeout';
  if (actionType === 'block') return 'block';
  if (actionType === 'steal') return 'steal';
  return 'miss';
}

function transformPbpAction(action: CdnPbpAction, index: number): PlayByPlayEvent {
  const eventType = mapActionTypeToEventType(action);
  const homeScore = parseInt(action.scoreHome, 10) || 0;
  const awayScore = parseInt(action.scoreAway, 10) || 0;
  let scoreDelta: number | undefined;
  if (eventType === 'score') {
    if (action.actionType === '3pt') scoreDelta = 3;
    else if (action.actionType === '2pt') scoreDelta = 2;
    else if (action.actionType === 'freethrow') scoreDelta = 1;
  }
  const playerId = action.personId ? String(action.personId) : undefined;
  const assistPlayerId = action.assistPersonId ? String(action.assistPersonId) : undefined;
  const involvedPlayerIds = Array.from(new Set([playerId, assistPlayerId].filter((id): id is string => !!id)));
  const clockSeconds = parsePTToSeconds(action.clock);
  return {
    id: `${action.period}-${action.actionNumber}-${index}`,
    period: action.period,
    clock: parsePTClock(action.clock),
    eventType,
    description: action.description || `${action.playerNameI || ''} ${action.actionType} ${action.subType}`.trim(),
    teamId: action.teamId ? String(action.teamId) : '',
    teamAbbr: action.teamTricode || '',
    playerId,
    playerName: action.playerNameI || action.playerName || undefined,
    assistPlayerId,
    assistPlayerName: action.assistPlayerNameInitial || undefined,
    involvedPlayerIds: involvedPlayerIds.length > 0 ? involvedPlayerIds : undefined,
    rawActionType: action.actionType || undefined,
    rawSubType: action.subType || undefined,
    rawQualifiers: action.qualifiers,
    possessionTeamId: action.possession ? String(action.possession) : undefined,
    homeScore,
    awayScore,
    scoreDelta,
    isClutch: action.period >= 4 && clockSeconds <= 300 && Math.abs(homeScore - awayScore) <= 5,
  };
}

function transformShotFromAction(action: CdnPbpAction): ShotEvent | null {
  if (!action.isFieldGoal || action.actionType === 'freethrow') return null;
  const hasLegacyCoordinates = Number.isFinite(action.xLegacy) && Number.isFinite(action.yLegacy) && (action.xLegacy !== 0 || action.yLegacy !== 0);
  const hasNormalizedCoordinates = Number.isFinite(action.x) && Number.isFinite(action.y) && (action.x !== 0 || action.y !== 0);
  if (!hasLegacyCoordinates && !hasNormalizedCoordinates) return null;
  const x = hasLegacyCoordinates ? ((action.xLegacy ?? 0) + 250) / 500 : (action.x ?? 0) / 100;
  const y = hasLegacyCoordinates ? (action.yLegacy ?? 0) / 470 : (action.y ?? 0) / 100;
  const shotType = action.actionType === '3pt' ? '3PT' : action.subType || action.actionType || 'Shot';
  return {
    id: `shot-${action.actionNumber}`,
    playerId: String(action.personId),
    playerName: action.playerNameI || action.playerName || '',
    teamId: String(action.teamId),
    x: Math.max(0, Math.min(1, x)),
    y: Math.max(0, Math.min(1, y)),
    made: action.shotResult?.toLowerCase() === 'made',
    shotType,
    distance: action.shotDistance || 0,
    period: action.period,
    clock: parsePTClock(action.clock),
    points: action.actionType === '3pt' ? 3 : 2,
  };
}

function statsTeamToProxyTeam(team: StatsHydratedTeam | StatsHydratedTeamBoxScore | null | undefined): ProxyTeamShape | null {
  if (!team) return null;
  return {
    teamId: team.teamId,
    teamCity: team.teamCity,
    teamName: team.teamName,
    teamTricode: team.teamTricode,
    score: team.score,
    statistics: (team as StatsHydratedTeamBoxScore).statistics,
    stats: (team as StatsHydratedTeamBoxScore).stats,
  };
}

function mergeStatsTeamShell(
  gameTeam: StatsHydratedTeam | null | undefined,
  boxTeam: StatsHydratedTeamBoxScore | null | undefined,
): ProxyTeamShape | null {
  return statsTeamToProxyTeam({
    ...(boxTeam ?? {}),
    ...(gameTeam ?? {}),
    score: gameTeam?.score ?? boxTeam?.score,
  });
}

function normalizeStatsHydratedGame(response: StatsGameHydrationResponse): Game | null {
  const hydratedGame = response.game;
  if (!response.success || !hydratedGame) return null;
  const boxscore = response.boxscore ?? null;
  const proxyGame: ProxyGameShape = {
    gameId: toStringValue(hydratedGame.gameId ?? response.gameId),
    gameStatus: hydratedGame.gameStatus,
    gameStatusText: hydratedGame.gameStatusText,
    period: hydratedGame.period,
    gameClock: hydratedGame.gameClock,
    homeTeam: mergeStatsTeamShell(hydratedGame.homeTeam, boxscore?.homeTeam),
    awayTeam: mergeStatsTeamShell(hydratedGame.awayTeam, boxscore?.awayTeam),
  };
  return normalizeProxyGame(proxyGame, formatGameDate(new Date()));
}

function statsPlayerToProxyPlayer(player: StatsHydratedPlayerBoxScore): ProxyBoxScorePlayerShape {
  return {
    status: player.status,
    personId: player.personId ?? player.playerId,
    playerId: player.playerId ?? player.personId,
    jerseyNum: player.jerseyNum,
    position: player.position,
    starter: player.starter ?? player.isStarter,
    isStarter: player.isStarter,
    isActive: player.isActive,
    played: player.played,
    comment: player.comment,
    statistics: player.statistics,
    stats: {
      ...(player.stats ?? {}),
      minutes: player.stats?.minutes ?? player.statistics?.minutes ?? player.minutes,
    },
    name: player.name,
    displayName: player.displayName,
    nameI: player.nameI,
    firstName: player.firstName,
    familyName: player.familyName,
    playerSlug: player.playerSlug,
    teamId: player.teamId,
    teamTricode: player.teamTricode,
    homeAway: player.homeAway,
  };
}

function statsPlayersForTeam(boxscore: StatsHydratedBoxScore | null | undefined, side: 'home' | 'away', teamId?: string): BoxScorePlayer[] {
  const players = boxscore?.players ?? [];
  return players
    .filter(player => {
      const playerSide = toStringValue(player.homeAway).toLowerCase();
      const playerTeamId = toStringValue(player.teamId);
      return playerSide === side || (!!teamId && playerTeamId === teamId);
    })
    .filter(player => isActiveBoxScorePlayer(statsPlayerToProxyPlayer(player)))
    .map(statsPlayerToProxyPlayer)
    .map(transformBoxScorePlayer)
    .filter(player => player.playerId.length > 0);
}

function extractStatsTeamStats(team: StatsHydratedTeamBoxScore | null | undefined): Record<string, number> {
  return extractTeamStats(statsTeamToProxyTeam(team));
}

function normalizeStatsActionType(action: StatsHydratedPlayByPlayAction): { actionType: string; subType: string; shotResult: string; isFieldGoal: number; pointsTotal: number } {
  const rawActionType = toStringValue(action.actionType);
  const rawSubType = toStringValue(action.subType);
  const lowerActionType = rawActionType.toLowerCase();
  const description = toStringValue(action.description).toLowerCase();
  const shotValue = toNumber(action.shotValue);
  const isMade = lowerActionType.includes('made') || (action.isScoreChange === true && !description.includes('miss'));
  const isMissed = lowerActionType.includes('miss') || description.startsWith('miss ');

  if (lowerActionType === 'period') {
    return { actionType: 'period', subType: rawSubType.toLowerCase(), shotResult: '', isFieldGoal: 0, pointsTotal: 0 };
  }
  if (lowerActionType.includes('free throw')) {
    return { actionType: 'freethrow', subType: rawSubType, shotResult: isMissed ? 'missed' : 'made', isFieldGoal: 0, pointsTotal: isMissed ? 0 : 1 };
  }
  if (lowerActionType.includes('shot')) {
    const isThree = shotValue === 3 || description.includes('3pt') || rawSubType.toLowerCase().includes('3pt') || toNumber(action.shotDistance) >= 22;
    return { actionType: isThree ? '3pt' : '2pt', subType: rawSubType, shotResult: isMade ? 'made' : 'missed', isFieldGoal: 1, pointsTotal: isMade ? (isThree ? 3 : 2) : 0 };
  }
  if (lowerActionType.includes('turnover')) return { actionType: 'turnover', subType: rawSubType, shotResult: '', isFieldGoal: 0, pointsTotal: 0 };
  if (lowerActionType.includes('foul')) return { actionType: 'foul', subType: rawSubType, shotResult: '', isFieldGoal: 0, pointsTotal: 0 };
  if (lowerActionType.includes('substitution')) return { actionType: 'substitution', subType: rawSubType, shotResult: '', isFieldGoal: 0, pointsTotal: 0 };
  if (lowerActionType.includes('rebound')) return { actionType: 'rebound', subType: rawSubType, shotResult: '', isFieldGoal: 0, pointsTotal: 0 };
  if (lowerActionType.includes('timeout')) return { actionType: 'timeout', subType: rawSubType, shotResult: '', isFieldGoal: 0, pointsTotal: 0 };
  if (lowerActionType.includes('block')) return { actionType: 'block', subType: rawSubType, shotResult: '', isFieldGoal: 0, pointsTotal: 0 };
  if (lowerActionType.includes('steal')) return { actionType: 'steal', subType: rawSubType, shotResult: '', isFieldGoal: 0, pointsTotal: 0 };
  if (lowerActionType.includes('jump ball')) return { actionType: 'jumpball', subType: rawSubType, shotResult: '', isFieldGoal: 0, pointsTotal: 0 };
  return { actionType: lowerActionType || rawActionType, subType: rawSubType, shotResult: '', isFieldGoal: 0, pointsTotal: 0 };
}

function playerInitialName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '';
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0][0]}. ${parts.slice(1).join(' ')}`;
}

interface CanonicalStatsPlayerIdentity {
  personId: string;
  playerId: string;
  displayName: string;
  nameI: string;
  rawNames: string[];
  teamId: string;
  teamTricode: string;
  homeAway: string;
}

interface CanonicalStatsPlayerIdentityMap {
  byId: Map<string, CanonicalStatsPlayerIdentity>;
  byName: Map<string, CanonicalStatsPlayerIdentity[]>;
  byTeamName: Map<string, CanonicalStatsPlayerIdentity>;
}

function normalizeNameKey(value: unknown): string {
  return toStringValue(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\b(jr|sr|ii|iii|iv)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildCanonicalStatsPlayerIdentities(boxscore: StatsHydratedBoxScore | null | undefined): CanonicalStatsPlayerIdentityMap {
  const byId = new Map<string, CanonicalStatsPlayerIdentity>();
  const byName = new Map<string, CanonicalStatsPlayerIdentity[]>();
  const byTeamName = new Map<string, CanonicalStatsPlayerIdentity>();

  const addName = (identity: CanonicalStatsPlayerIdentity, value: unknown) => {
    const key = normalizeNameKey(value);
    if (!key) return;
    const existing = byName.get(key) ?? [];
    if (!existing.some(player => player.playerId === identity.playerId)) {
      existing.push(identity);
      byName.set(key, existing);
    }
    if (identity.teamId) byTeamName.set(`${identity.teamId}:${key}`, identity);
  };

  for (const player of boxscore?.players ?? []) {
    const proxyPlayer = statsPlayerToProxyPlayer(player);
    const playerId = toStringValue(player.playerId ?? player.personId);
    const personId = toStringValue(player.personId ?? player.playerId);
    if (!playerId && !personId) continue;
    const displayName = getCanonicalDisplayName(proxyPlayer);
    const nameI = toStringValue(player.nameI) || playerInitialName(displayName);
    const identity: CanonicalStatsPlayerIdentity = {
      personId: personId || playerId,
      playerId: playerId || personId,
      displayName: displayName || nameI,
      nameI: nameI || displayName,
      rawNames: [player.displayName, player.nameI, player.name, `${toStringValue(player.firstName)} ${toStringValue(player.familyName)}`].map(value => toStringValue(value)).filter(Boolean),
      teamId: toStringValue(player.teamId),
      teamTricode: toStringValue(player.teamTricode),
      homeAway: toStringValue(player.homeAway),
    };
    if (identity.personId) byId.set(identity.personId, identity);
    if (identity.playerId) byId.set(identity.playerId, identity);
    addName(identity, player.displayName);
    addName(identity, player.nameI);
    addName(identity, player.name);
    addName(identity, `${toStringValue(player.firstName)} ${toStringValue(player.familyName)}`);
    addName(identity, player.familyName);
  }

  return { byId, byName, byTeamName };
}

function resolveCanonicalStatsPlayer(
  identities: CanonicalStatsPlayerIdentityMap | undefined,
  id: unknown,
  rawName: unknown,
  teamId: unknown,
): CanonicalStatsPlayerIdentity | undefined {
  if (!identities) return undefined;
  const idKey = toStringValue(id);
  if (idKey && idKey !== '0') {
    const byId = identities.byId.get(idKey);
    if (byId) return byId;
  }
  const nameKey = normalizeNameKey(rawName);
  if (!nameKey) return undefined;
  const teamKey = `${toStringValue(teamId)}:${nameKey}`;
  const byTeamName = identities.byTeamName.get(teamKey);
  if (byTeamName) return byTeamName;
  const candidates = identities.byName.get(nameKey) ?? [];
  return candidates.length === 1 ? candidates[0] : undefined;
}

function extractShotDistanceFromDescription(description: string): number | undefined {
  const match = description.match(/(\d+)\s*'/);
  if (!match) return undefined;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function extractAssistNameFromDescription(description: string): string | null {
  const matches = Array.from(description.matchAll(/\(([^()]+?)\s+\d+\s+AST\)/gi));
  const last = matches.at(-1)?.[1]?.trim();
  return last && /^[A-Za-zÀ-ž.'\- ]+$/.test(last) ? last : null;
}

function buildStatsCdnAction(
  action: StatsHydratedPlayByPlayAction,
  actionNumber: number,
  scoreHome: string,
  scoreAway: string,
  overrides: Partial<CdnPbpAction> = {},
  identities?: CanonicalStatsPlayerIdentityMap,
): CdnPbpAction {
  const mapped = normalizeStatsActionType(action);
  const description = toStringValue(action.description ?? action.homeDescription ?? action.awayDescription ?? action.neutralDescription);
  const shooter = resolveCanonicalStatsPlayer(identities, action.personId, action.playerName, action.teamId);
  const rawAssistName = mapped.isFieldGoal === 1 && mapped.shotResult === 'made'
    ? extractAssistNameFromDescription(description)
    : null;
  const assist = rawAssistName ? resolveCanonicalStatsPlayer(identities, null, rawAssistName, action.teamId) : undefined;
  const shotDistance = toOptionalNumber(action.shotDistance) ?? extractShotDistanceFromDescription(description) ?? 0;
  const xLegacy = toOptionalNumber(action.xLegacy);
  const yLegacy = toOptionalNumber(action.yLegacy);
  return {
    source: action.source ?? 'statsGameHydration',
    actionNumber,
    clock: toStringValue(action.clock),
    timeActual: toStringValue(action.timeActual),
    period: toNumber(action.period),
    periodType: '',
    teamId: toNumber(action.teamId),
    teamTricode: toStringValue(action.teamTricode) || shooter?.teamTricode || '',
    actionType: mapped.actionType,
    subType: mapped.subType,
    qualifiers: [],
    personId: toNumber(shooter?.personId ?? action.personId),
    x: undefined,
    y: undefined,
    area: '',
    areaDetail: '',
    side: '',
    shotDistance,
    possession: toNumber(action.possession),
    scoreHome,
    scoreAway,
    xLegacy,
    yLegacy,
    location: action.location ?? undefined,
    videoAvailable: action.videoAvailable ?? undefined,
    actionId: action.actionId ?? undefined,
    eventNum: toOptionalNumber(action.eventNum ?? action.actionNumber),
    isFieldGoal: mapped.isFieldGoal,
    shotResult: mapped.shotResult,
    pointsTotal: mapped.pointsTotal,
    playerName: shooter?.displayName ?? toStringValue(action.playerName),
    playerNameI: shooter?.nameI ?? (toStringValue(action.playerNameI) || playerInitialName(toStringValue(action.playerName))),
    description,
    personIdsFilter: Array.from(new Set([toNumber(shooter?.personId ?? action.personId), toNumber(assist?.personId)].filter(id => id > 0))),
    assistPersonId: assist ? toNumber(assist.personId) : undefined,
    assistPlayerNameInitial: assist?.nameI,
    ...overrides,
  };
}

function expandStatsSubstitutionAction(
  action: StatsHydratedPlayByPlayAction,
  actionNumber: number,
  scoreHome: string,
  scoreAway: string,
  identities?: CanonicalStatsPlayerIdentityMap,
): CdnPbpAction[] | null {
  if (!toStringValue(action.actionType).toLowerCase().includes('substitution')) return null;
  const description = toStringValue(action.description);
  const match = description.match(/SUB:\s*(.+?)\s+FOR\s+(.+)$/i);
  if (!match) return [buildStatsCdnAction(action, actionNumber, scoreHome, scoreAway, { subType: '' }, identities)];
  const incoming = match[1].trim();
  const outgoing = match[2].trim();
  const outgoingIdentity = resolveCanonicalStatsPlayer(identities, action.personId, outgoing || action.playerName, action.teamId);
  const incomingIdentity = resolveCanonicalStatsPlayer(identities, null, incoming, action.teamId);
  return [
    buildStatsCdnAction(action, actionNumber * 10, scoreHome, scoreAway, {
      subType: 'out',
      personId: toNumber(outgoingIdentity?.personId ?? action.personId),
      playerName: outgoingIdentity?.displayName ?? (toStringValue(action.playerName) || outgoing),
      playerNameI: outgoingIdentity?.nameI ?? playerInitialName(outgoing),
      personIdsFilter: [toNumber(outgoingIdentity?.personId ?? action.personId)].filter(id => id > 0),
      description: `SUB OUT: ${outgoingIdentity?.nameI ?? outgoing}`,
    }, identities),
    buildStatsCdnAction(action, actionNumber * 10 + 1, scoreHome, scoreAway, {
      subType: 'in',
      personId: toNumber(incomingIdentity?.personId),
      playerName: incomingIdentity?.displayName ?? incoming,
      playerNameI: incomingIdentity?.nameI ?? playerInitialName(incoming),
      personIdsFilter: [toNumber(incomingIdentity?.personId)].filter(id => id > 0),
      description: `SUB IN: ${incomingIdentity?.nameI ?? incoming}`,
    }, identities),
  ];
}

function normalizeStatsHydratedActions(actions: StatsHydratedPlayByPlayAction[], identities?: CanonicalStatsPlayerIdentityMap): CdnPbpAction[] {
  const normalized: CdnPbpAction[] = [];
  let lastHomeScore = '0';
  let lastAwayScore = '0';
  for (const action of actions) {
    const scoreHome = action.scoreHome != null ? toStringValue(action.scoreHome) : lastHomeScore;
    const scoreAway = action.scoreAway != null ? toStringValue(action.scoreAway) : lastAwayScore;
    if (action.scoreHome != null) lastHomeScore = scoreHome;
    if (action.scoreAway != null) lastAwayScore = scoreAway;
    const actionNumber = toNumber(action.actionNumber ?? action.eventNum ?? action.orderNumber);
    const expandedSubstitution = expandStatsSubstitutionAction(action, actionNumber, scoreHome, scoreAway, identities);
    if (expandedSubstitution) {
      normalized.push(...expandedSubstitution);
    } else {
      normalized.push(buildStatsCdnAction(action, actionNumber, scoreHome, scoreAway, {}, identities));
    }
  }
  if (__DEV__) {
    const statsActions = normalized.filter(action => action.source === 'statsGameHydration');
    const assistedMakes = statsActions.filter(action => action.assistPersonId && action.shotResult === 'made').slice(0, 3);
    const plottableShots = statsActions.filter(action => action.isFieldGoal && Number.isFinite(action.xLegacy) && Number.isFinite(action.yLegacy)).length;
    const substitutions = statsActions.filter(action => action.actionType === 'substitution').length;
    console.log('[StatsHydrationAdapter] normalized actions=%d assistedMakes=%d plottableShots=%d substitutions=%d', statsActions.length, assistedMakes.length, plottableShots, substitutions);
    assistedMakes.forEach(action => {
      console.log('[StatsHydrationAdapter][assist]', {
        shooter: action.playerNameI,
        assister: action.assistPlayerNameInitial,
        assistPersonId: action.assistPersonId,
        description: action.description,
      });
    });
  }
  return normalized;
}

export function normalizeStatsHydrationBoxscore(response: StatsGameHydrationResponse): GameDetailData | null {
  const game = normalizeStatsHydratedGame(response);
  if (!game || !response.boxscore) return null;
  return {
    game,
    homeBoxScore: statsPlayersForTeam(response.boxscore, 'home', game.homeTeam.id),
    awayBoxScore: statsPlayersForTeam(response.boxscore, 'away', game.awayTeam.id),
    homeTeamStats: extractStatsTeamStats(response.boxscore.homeTeam),
    awayTeamStats: extractStatsTeamStats(response.boxscore.awayTeam),
  };
}

export function normalizeStatsHydrationPlayByPlay(response: StatsGameHydrationResponse): { events: PlayByPlayEvent[]; shots: ShotEvent[]; rawActions: CdnPbpAction[] } | null {
  if (!response.success || !response.playbyplay) return null;
  const identities = buildCanonicalStatsPlayerIdentities(response.boxscore);
  const actions = normalizeStatsHydratedActions(response.playbyplay.actions ?? [], identities);
  const filteredActions = actions.filter(action => {
    const actionType = action.actionType?.toLowerCase();
    return actionType !== 'period' && actionType !== 'game' && actionType !== 'jumpball' && actionType !== 'stoppage';
  });
  const events = filteredActions.map((action, index) => transformPbpAction(action, index));
  const shots = actions.map(transformShotFromAction).filter((shot): shot is ShotEvent => shot !== null);
  return { events, shots, rawActions: actions };
}

let statsGameHydrationRequests = new Map<string, Promise<StatsGameHydrationResponse>>();

/** Fetches scoreboard/game discovery data from the Supabase NBA data proxy. */
export function getGamesByDate(date: string): Promise<NbaGamesByDateProxyResponse> {
  return requestProxy<NbaGamesByDateProxyResponse>('gamesByDate', { date });
}

/** Fetches a game boxscore from the Supabase NBA data proxy. */
export function getBoxscore(gameId: string): Promise<NbaBoxscoreProxyResponse> {
  return requestProxy<NbaBoxscoreProxyResponse>('boxscore', { gameId });
}

/** Fetches a game play-by-play feed from the Supabase NBA data proxy. */
export function getPlayByPlay(gameId: string): Promise<NbaPlayByPlayProxyResponse> {
  return requestProxy<NbaPlayByPlayProxyResponse>('playbyplay', { gameId });
}

/** Fetches the Stats BoxScoreTraditionalV3 fallback route. */
export function getStatsBoxScoreTraditionalV3(gameId: string): Promise<StatsBoxScoreTraditionalV3Response> {
  return requestProxy<StatsBoxScoreTraditionalV3Response>('statsBoxScoreTraditionalV3', { gameId });
}

/** Fetches the Stats PlayByPlayV3 fallback route. */
export function getStatsPlayByPlayV3(gameId: string): Promise<StatsPlayByPlayV3Response> {
  return requestProxy<StatsPlayByPlayV3Response>('statsPlayByPlayV3', { gameId });
}

/** Fetches and memoizes the combined stats hydration fallback route per game. */
export function getStatsGameHydration(gameId: string): Promise<StatsGameHydrationResponse> {
  const cached = statsGameHydrationRequests.get(gameId);
  if (cached) return cached;
  const request = requestProxy<StatsGameHydrationResponse>('statsGameHydration', { gameId }).finally(() => {
    setTimeout(() => {
      statsGameHydrationRequests.delete(gameId);
    }, 1000 * 60 * 5);
  });
  statsGameHydrationRequests.set(gameId, request);
  return request;
}

/** Fetches the playoff catalog for future playoff navigation work. */
export function getPlayoffCatalog(): Promise<NbaPlayoffCatalogProxyResponse> {
  return requestProxy<NbaPlayoffCatalogProxyResponse>('playoffCatalog');
}

export function normalizeGamesByDateResponse(response: NbaGamesByDateProxyResponse, requestedDate: string): NormalizedGamesByDateResult {
  const rawGames = Array.isArray(response.games) ? response.games : [];
  const parseError = response.success
    ? ''
    : response.error ?? response.message ?? response.parseError ?? 'NBA data proxy returned success=false';
  const games = response.success ? rawGames.map(game => normalizeProxyGame(game, requestedDate)).filter(game => game.id.length > 0) : [];
  return {
    games,
    gameDate: response.date || requestedDate,
    rawGameCount: response.gameCount ?? rawGames.length,
    transformedGameCount: games.length,
    schemaMatched: response.success && Array.isArray(response.games),
    parseError,
    resolvedSource: response.resolvedSource ?? 'nba-data-proxy',
  };
}

export function normalizeProxyBoxscore(response: NbaBoxscoreProxyResponse): GameDetailData | null {
  if (!response.success || !response.data?.game) return null;
  const gameShape = response.data.game;
  const game = normalizeProxyGame(gameShape, formatGameDate(new Date()));
  return {
    game,
    homeBoxScore: activePlayers(gameShape.homeTeam),
    awayBoxScore: activePlayers(gameShape.awayTeam),
    homeTeamStats: extractTeamStats(gameShape.homeTeam),
    awayTeamStats: extractTeamStats(gameShape.awayTeam),
  };
}

export function normalizeProxyPlayByPlay(response: NbaPlayByPlayProxyResponse): { events: PlayByPlayEvent[]; shots: ShotEvent[]; rawActions: CdnPbpAction[] } | null {
  if (!response.success || !response.data?.game) return null;
  const rawActions = response.data.game.actions ?? [];
  const actions = rawActions.map(normalizePbpAction);
  const filteredActions = actions.filter(action => {
    const actionType = action.actionType?.toLowerCase();
    return actionType !== 'period' && actionType !== 'game' && actionType !== 'jumpball' && actionType !== 'stoppage';
  });
  const events = filteredActions.map((action, index) => transformPbpAction(action, index));
  const shots = actions.map(transformShotFromAction).filter((shot): shot is ShotEvent => shot !== null);
  return { events, shots, rawActions: actions };
}

export function getNbaDataProxyBaseUrl(): string {
  return NBA_DATA_PROXY_BASE_URL;
}
