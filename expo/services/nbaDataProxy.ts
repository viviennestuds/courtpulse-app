import { BoxScorePlayer, Game, PlayByPlayEvent, ShotEvent } from '@/types';
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

export type NbaDataProxyType = 'gamesByDate' | 'boxscore' | 'playbyplay' | 'playoffCatalog';

export interface NbaDataProxyBaseResponse {
  success: boolean;
  type: NbaDataProxyType | string;
  date?: string | null;
  gameId?: string | null;
  fetchedAt?: string;
  resolvedSource?: string;
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
  jerseyNum?: string | null;
  position?: string | null;
  starter?: string | number | null;
  oncourt?: string | number | null;
  played?: string | number | null;
  statistics?: Record<string, string | number | null | undefined>;
  name?: string | null;
  nameI?: string | null;
  firstName?: string | null;
  familyName?: string | null;
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

function transformBoxScorePlayer(player: ProxyBoxScorePlayerShape): BoxScorePlayer {
  const stats = player.statistics ?? {};
  return {
    playerId: toStringValue(player.personId),
    name: toStringValue(player.nameI || player.name),
    position: toStringValue(player.position),
    minutes: parsePTMinutes(toStringValue(stats.minutes)),
    points: toNumber(stats.points),
    rebounds: toNumber(stats.reboundsTotal),
    offensiveRebounds: toNumber(stats.reboundsOffensive),
    defensiveRebounds: toNumber(stats.reboundsDefensive),
    assists: toNumber(stats.assists),
    steals: toNumber(stats.steals),
    blocks: toNumber(stats.blocks),
    turnovers: toNumber(stats.turnovers),
    fgm: toNumber(stats.fieldGoalsMade),
    fga: toNumber(stats.fieldGoalsAttempted),
    tpm: toNumber(stats.threePointersMade),
    tpa: toNumber(stats.threePointersAttempted),
    ftm: toNumber(stats.freeThrowsMade),
    fta: toNumber(stats.freeThrowsAttempted),
    plusMinus: toNumber(stats.plusMinusPoints),
    isStarter: String(player.starter ?? '') === '1',
    ...normalizePlayerBoxScoreMiscStats(stats),
  };
}

function activePlayers(team: ProxyTeamShape | null | undefined): BoxScorePlayer[] {
  const players = team?.players ?? [];
  return players
    .filter(player => String(player.played ?? '') === '1' || String(player.status ?? '').toUpperCase() === 'ACTIVE')
    .sort((a, b) => toNumber(a.order) - toNumber(b.order))
    .map(transformBoxScorePlayer)
    .filter(player => player.playerId.length > 0);
}

function extractTeamStats(team: ProxyTeamShape | null | undefined): Record<string, number> {
  const stats = team?.statistics ?? {};
  const oreb = toNumber(stats.reboundsOffensive);
  const dreb = toNumber(stats.reboundsDefensive);
  const apiTotal = toNumber(stats.reboundsTotal);
  const canonicalTotal = oreb + dreb;
  const mappedStats: Record<string, number> = {
    points: toNumber(team?.score),
    fieldGoalsMade: toNumber(stats.fieldGoalsMade),
    fieldGoalsAttempted: toNumber(stats.fieldGoalsAttempted),
    fieldGoalsPercentage: toNumber(stats.fieldGoalsPercentage) * 100,
    threePointersMade: toNumber(stats.threePointersMade),
    threePointersAttempted: toNumber(stats.threePointersAttempted),
    threePointersPercentage: toNumber(stats.threePointersPercentage) * 100,
    freeThrowsMade: toNumber(stats.freeThrowsMade),
    freeThrowsAttempted: toNumber(stats.freeThrowsAttempted),
    freeThrowsPercentage: toNumber(stats.freeThrowsPercentage) * 100,
    reboundsOffensive: oreb,
    reboundsDefensive: dreb,
    reboundsTotal: canonicalTotal,
    reboundsTotalRaw: apiTotal,
    assists: toNumber(stats.assists),
    steals: toNumber(stats.steals),
    blocks: toNumber(stats.blocks),
    turnovers: toNumber(stats.turnovers),
    foulsPersonal: toNumber(stats.foulsPersonal),
    pointsFastBreak: toNumber(stats.pointsFastBreak),
    pointsInThePaint: toNumber(stats.pointsInThePaint),
  };

  return {
    ...mappedStats,
    ...normalizeTeamBoxScoreMiscStats(stats),
  };
}

function normalizePbpAction(action: ProxyPbpActionShape): CdnPbpAction {
  return {
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
    x: toNumber(action.x),
    y: toNumber(action.y),
    area: toStringValue(action.area),
    areaDetail: toStringValue(action.areaDetail),
    side: toStringValue(action.side),
    shotDistance: toNumber(action.shotDistance),
    possession: toNumber(action.possession),
    scoreHome: toStringValue(action.scoreHome, '0'),
    scoreAway: toStringValue(action.scoreAway, '0'),
    xLegacy: toNumber(action.xLegacy),
    yLegacy: toNumber(action.yLegacy),
    isFieldGoal: action.isFieldGoal === true ? 1 : toNumber(action.isFieldGoal),
    shotResult: toStringValue(action.shotResult),
    pointsTotal: toNumber(action.pointsTotal),
    playerName: toStringValue(action.playerName),
    playerNameI: toStringValue(action.playerNameI),
    description: toStringValue(action.description),
    personIdsFilter: Array.isArray(action.personIdsFilter) ? action.personIdsFilter.map(item => toNumber(item)) : [],
    assistPersonId: action.assistPersonId != null ? toNumber(action.assistPersonId) : undefined,
    assistPlayerNameInitial: action.assistPlayerNameInitial ?? undefined,
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
  const x = action.xLegacy != null ? (action.xLegacy + 250) / 500 : action.x / 100;
  const y = action.yLegacy != null ? action.yLegacy / 470 : action.y / 100;
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
