import { Game } from '@/types';
import { fetchNbaCdn, fetchNbaCdnStatic, fetchNbaStats, getGameStatus, getPeriodText, getStatusClockText, formatGameDate } from './nbaApi';
import { getTeamColor, getTeamInfoById } from '@/constants/nbaTeams';
import { hasLocalSeasonSchedule, loadLocalSeasonSchedule } from '@/assets/nba/schedules';

/**
 * Schedule data sourcing strategy:
 * - Current season: fetched from the public NBA CDN scheduleLeagueV2.json.
 *   This is reliable from client/proxy environments and is the source of
 *   truth for current-season date browsing.
 * - Prior seasons: stats.nba.com endpoints are unreliable from
 *   client/proxy environments, so we prefer locally bundled per-season
 *   schedule files (see expo/assets/nba/schedules). stats.nba.com is only
 *   used as an optional best-effort final fallback. When neither is
 *   available, we return source='unavailable' so the UI can show a clean
 *   fallback state instead of misleading "Live Data".
 */

interface ScheduleLeagueV2Response {
  leagueSchedule: {
    seasonYear: string;
    gameDates: Array<{
      gameDate: string;
      games: ScheduleLeagueV2Game[];
    }>;
  };
}

interface ScheduleLeagueV2Game {
  gameId: string;
  gameCode: string;
  gameStatus: number;
  gameStatusText: string;
  gameDateEst: string;
  gameDateUTC?: string;
  gameTimeUTC?: string;
  arenaName?: string;
  arenaCity?: string;
  arenaState?: string;
  homeTeam: CdnScoreboardTeam;
  awayTeam: CdnScoreboardTeam;
}

let schedulePromise: Promise<ScheduleLeagueV2Response> | null = null;
let scheduleFetchedAt = 0;
const SCHEDULE_TTL_MS = 60 * 60 * 1000;

const historicalSchedulePromises: Record<string, { promise: Promise<ScheduleLeagueV2Response>; fetchedAt: number }> = {};

function getCachedHistoricalSchedulePromise(season: string): Promise<ScheduleLeagueV2Response> {
  const now = Date.now();
  const cached = historicalSchedulePromises[season];
  if (cached && now - cached.fetchedAt < SCHEDULE_TTL_MS) {
    return cached.promise;
  }
  console.log(`[Scoreboard] Fetching stats.nba.com scheduleleaguev2 for season=${season}`);
  const promise = fetchNbaStats<ScheduleLeagueV2Response>('scheduleleaguev2', {
    LeagueID: '00',
    Season: season,
  }).catch(err => {
    console.warn(`[Scoreboard] stats scheduleleaguev2 fetch failed (season=${season}):`, err instanceof Error ? err.message : String(err));
    delete historicalSchedulePromises[season];
    throw err;
  });
  historicalSchedulePromises[season] = { promise, fetchedAt: now };
  return promise;
}

function getCachedSchedulePromise(): Promise<ScheduleLeagueV2Response> {
  const now = Date.now();
  if (schedulePromise && now - scheduleFetchedAt < SCHEDULE_TTL_MS) {
    return schedulePromise;
  }
  scheduleFetchedAt = now;
  console.log('[Scoreboard] Fetching scheduleLeagueV2.json (schedule CDN)');
  schedulePromise = fetchNbaCdnStatic<ScheduleLeagueV2Response>('scheduleLeagueV2.json').catch(err => {
    console.warn('[Scoreboard] scheduleLeagueV2.json fetch failed:', err instanceof Error ? err.message : String(err));
    schedulePromise = null;
    throw err;
  });
  return schedulePromise;
}

function toScheduleDateKey(date: string): string {
  const [y, m, d] = date.split('-');
  if (!y || !m || !d) return '';
  return `${m}/${d}/${y} 00:00:00`;
}

export function getNbaSeasonForDate(date: string): string {
  const [yStr, mStr] = date.split('-');
  const year = parseInt(yStr ?? '', 10);
  const month = parseInt(mStr ?? '', 10);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return '';
  const startYear = month >= 10 ? year : year - 1;
  const endYY = String((startYear + 1) % 100).padStart(2, '0');
  return `${startYear}-${endYY}`;
}

function normalizeSeasonYear(raw: string | undefined): string {
  if (!raw) return '';
  return raw.trim();
}

interface CdnScoreboardResponse {
  scoreboard: {
    gameDate: string;
    games: CdnScoreboardGame[];
  };
}

interface CdnScoreboardGame {
  gameId: string;
  gameCode: string;
  gameStatus: number;
  gameStatusText: string;
  period: number;
  gameClock: string;
  gameTimeUTC: string;
  homeTeam: CdnScoreboardTeam;
  awayTeam: CdnScoreboardTeam;
  gameLeaders?: {
    homeLeaders?: CdnGameLeader;
    awayLeaders?: CdnGameLeader;
  };
}

interface CdnScoreboardTeam {
  teamId: number;
  teamName: string;
  teamCity: string;
  teamTricode: string;
  wins: number;
  losses: number;
  score: number;
}

interface CdnGameLeader {
  personId: number;
  name: string;
  points: number;
  rebounds: number;
  assists: number;
}

interface StatsScoreboardResponse {
  scoreboard: {
    gameDate: string;
    games: CdnScoreboardGame[];
  };
}

export interface ScoreboardParseResult {
  games: Game[];
  gameDate: string;
  rawGameCount: number;
  transformedGameCount: number;
  schemaMatched: boolean;
  parseError: string;
  yesterdayFallbackAttempted: boolean;
  yesterdayFallbackDate: string;
}

function validateScoreboardShape(data: unknown): { valid: boolean; error: string } {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: `Response is not an object: ${typeof data}` };
  }

  const obj = data as Record<string, unknown>;

  if (!obj.scoreboard) {
    const keys = Object.keys(obj).join(', ');
    return { valid: false, error: `Missing "scoreboard" key. Found keys: [${keys}]` };
  }

  const sb = obj.scoreboard as Record<string, unknown>;
  if (!sb.games) {
    const keys = Object.keys(sb).join(', ');
    return { valid: false, error: `Missing "scoreboard.games" key. Found keys: [${keys}]` };
  }

  if (!Array.isArray(sb.games)) {
    return { valid: false, error: `"scoreboard.games" is not an array: ${typeof sb.games}` };
  }

  return { valid: true, error: '' };
}

function transformScoreboardGame(nbaGame: CdnScoreboardGame, gameDate: string): Game {
  const homeInfo = getTeamInfoById(nbaGame.homeTeam.teamId);
  const awayInfo = getTeamInfoById(nbaGame.awayTeam.teamId);
  const status = getGameStatus(nbaGame.gameStatus);

  return {
    id: nbaGame.gameId,
    date: gameDate,
    status,
    period: getPeriodText(nbaGame.period, nbaGame.gameStatus),
    clock: getStatusClockText(nbaGame.gameStatus, nbaGame.gameStatusText, nbaGame.gameClock),
    homeTeam: {
      id: String(nbaGame.homeTeam.teamId),
      abbreviation: nbaGame.homeTeam.teamTricode,
      name: nbaGame.homeTeam.teamName,
      score: nbaGame.homeTeam.score,
      primaryColor: homeInfo?.primaryColor ?? getTeamColor(nbaGame.homeTeam.teamTricode),
    },
    awayTeam: {
      id: String(nbaGame.awayTeam.teamId),
      abbreviation: nbaGame.awayTeam.teamTricode,
      name: nbaGame.awayTeam.teamName,
      score: nbaGame.awayTeam.score,
      primaryColor: awayInfo?.primaryColor ?? getTeamColor(nbaGame.awayTeam.teamTricode),
    },
    arena: '',
    isPlayoff: false,
  };
}

export async function fetchTodayScoreboard(): Promise<ScoreboardParseResult> {
  const requestedAt = new Date().toISOString();
  const localDate = formatGameDate(new Date());
  console.log(`[Scoreboard] Fetching today's scoreboard at ${requestedAt}, local date: ${localDate}`);

  const result: ScoreboardParseResult = {
    games: [],
    gameDate: localDate,
    rawGameCount: 0,
    transformedGameCount: 0,
    schemaMatched: false,
    parseError: '',
    yesterdayFallbackAttempted: false,
    yesterdayFallbackDate: '',
  };

  let data: unknown;
  try {
    data = await fetchNbaCdn<unknown>('scoreboard/todaysScoreboard_00.json');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.parseError = `CDN fetch failed: ${msg}`;
    console.error(`[Scoreboard] ${result.parseError}`);
    return result;
  }

  console.log('[Scoreboard] Raw response type:', typeof data);
  console.log('[Scoreboard] Raw response keys:', data && typeof data === 'object' ? Object.keys(data as Record<string, unknown>) : 'N/A');

  const validation = validateScoreboardShape(data);
  if (!validation.valid) {
    result.parseError = `Schema mismatch: ${validation.error}`;
    console.error(`[Scoreboard] ${result.parseError}`);
    console.error('[Scoreboard] Raw payload snippet:', JSON.stringify(data).substring(0, 500));

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = formatGameDate(yesterday);
    result.yesterdayFallbackAttempted = true;
    result.yesterdayFallbackDate = yesterdayStr;
    console.log(`[Scoreboard] Attempting yesterday fallback: ${yesterdayStr}`);

    try {
      const yesterdayResult = await fetchScoreboardByDate(yesterdayStr);
      if (yesterdayResult.games.length > 0) {
        result.games = yesterdayResult.games;
        result.gameDate = yesterdayStr;
        result.transformedGameCount = yesterdayResult.games.length;
        result.schemaMatched = true;
        result.parseError = `Today schema failed, using yesterday (${yesterdayStr}): ${validation.error}`;
        console.log(`[Scoreboard] Yesterday fallback succeeded: ${yesterdayResult.games.length} games`);
      }
    } catch (fallbackErr) {
      console.error('[Scoreboard] Yesterday fallback also failed:', fallbackErr);
    }
    return result;
  }

  result.schemaMatched = true;
  const typedData = data as CdnScoreboardResponse;
  const gameDate = typedData.scoreboard.gameDate;
  const rawGames = typedData.scoreboard.games;

  result.gameDate = gameDate;
  result.rawGameCount = rawGames?.length ?? 0;

  console.log(`[Scoreboard] CDN gameDate: ${gameDate}, raw game count: ${result.rawGameCount}`);

  if (rawGames && rawGames.length > 0) {
    console.log('[Scoreboard] First game sample:', JSON.stringify({
      gameId: rawGames[0].gameId,
      status: rawGames[0].gameStatus,
      statusText: rawGames[0].gameStatusText,
      home: rawGames[0].homeTeam?.teamTricode,
      away: rawGames[0].awayTeam?.teamTricode,
      homeScore: rawGames[0].homeTeam?.score,
      awayScore: rawGames[0].awayTeam?.score,
    }));
  }

  try {
    const games = rawGames.map(g => transformScoreboardGame(g, gameDate));
    result.games = games;
    result.transformedGameCount = games.length;
    console.log(`[Scoreboard] Transformed ${games.length} games for ${gameDate}`);
  } catch (transformErr) {
    const msg = transformErr instanceof Error ? transformErr.message : String(transformErr);
    result.parseError = `Transform failed: ${msg}`;
    console.error(`[Scoreboard] ${result.parseError}`);
  }

  if (result.games.length === 0 && result.rawGameCount === 0) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = formatGameDate(yesterday);
    result.yesterdayFallbackAttempted = true;
    result.yesterdayFallbackDate = yesterdayStr;
    console.log(`[Scoreboard] 0 games today, attempting yesterday fallback: ${yesterdayStr}`);

    try {
      const yesterdayResult = await fetchScoreboardByDate(yesterdayStr);
      if (yesterdayResult.games.length > 0) {
        result.games = yesterdayResult.games;
        result.gameDate = yesterdayStr;
        result.transformedGameCount = yesterdayResult.games.length;
        result.parseError = `No games today, showing yesterday (${yesterdayStr})`;
        console.log(`[Scoreboard] Yesterday fallback succeeded: ${yesterdayResult.games.length} games`);
      }
    } catch (fallbackErr) {
      console.error('[Scoreboard] Yesterday fallback also failed:', fallbackErr);
    }
  }

  return result;
}

export type ScoreboardSource =
  | 'schedule-cdn-current'
  | 'schedule-local-historical'
  | 'stats-historical'
  | 'stats-nba'
  | 'unavailable'
  | 'failed';

export interface FetchScoreboardByDateResult {
  games: Game[];
  gameDate: string;
  fetchSucceeded: boolean;
  source: ScoreboardSource;
}

async function fetchFromScheduleCdn(date: string): Promise<FetchScoreboardByDateResult | null> {
  try {
    const schedule = await getCachedSchedulePromise();
    const key = toScheduleDateKey(date);
    const totalDates = schedule.leagueSchedule?.gameDates?.length ?? 0;
    if (__DEV__) {
      const sample = schedule.leagueSchedule?.gameDates?.slice(0, 2).map(gd => gd.gameDate) ?? [];
      console.log(`[Scoreboard] schedule CDN loaded: ${totalDates} dates. lookup key='${key}' for selectedDate=${date}. sample dates=${JSON.stringify(sample)}`);
    }
    const entry = schedule.leagueSchedule.gameDates.find(gd => gd.gameDate === key);
    if (!entry) {
      console.log(`[Scoreboard] CDN schedule has no entry for ${date} (key=${key}); source=schedule-cdn-current (success, 0 games)`);
      return { games: [], gameDate: date, fetchSucceeded: true, source: 'schedule-cdn-current' };
    }
    if (__DEV__) {
      const firstGame = entry.games[0];
      console.log(`[Scoreboard] schedule CDN matched ${entry.games.length} games for ${date}; first game date fields:`, firstGame ? { gameDateEst: firstGame.gameDateEst, gameDateUTC: firstGame.gameDateUTC, gameTimeUTC: firstGame.gameTimeUTC } : 'none');
    }
    const games: Game[] = entry.games.map(sg => {
      const cdnLike: CdnScoreboardGame = {
        gameId: sg.gameId,
        gameCode: sg.gameCode,
        gameStatus: sg.gameStatus,
        gameStatusText: sg.gameStatusText,
        period: 0,
        gameClock: '',
        gameTimeUTC: sg.gameTimeUTC ?? sg.gameDateUTC ?? '',
        homeTeam: sg.homeTeam,
        awayTeam: sg.awayTeam,
      };
      const game = transformScoreboardGame(cdnLike, date);
      if (sg.arenaName) {
        game.arena = sg.arenaCity ? `${sg.arenaName}, ${sg.arenaCity}` : sg.arenaName;
      }
      return game;
    });
    console.log(`[Scoreboard] CDN schedule: ${games.length} games for ${date}`);
    return { games, gameDate: date, fetchSucceeded: true, source: 'schedule-cdn-current' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[Scoreboard] CDN schedule fetch failed for ${date}: ${msg}`);
    return null;
  }
}

function validateScheduleShape(data: unknown): { valid: boolean; error: string } {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: `Response is not an object: ${typeof data}` };
  }
  const obj = data as Record<string, unknown>;
  if (!obj.leagueSchedule) {
    return { valid: false, error: `Missing 'leagueSchedule'. Found keys: [${Object.keys(obj).join(', ')}]` };
  }
  const ls = obj.leagueSchedule as Record<string, unknown>;
  if (!Array.isArray(ls.gameDates)) {
    return { valid: false, error: `'leagueSchedule.gameDates' is not an array` };
  }
  return { valid: true, error: '' };
}

function parseScheduleResponseForDate(
  schedule: ScheduleLeagueV2Response,
  date: string,
  source: 'schedule-cdn-current' | 'schedule-local-historical' | 'stats-historical',
): FetchScoreboardByDateResult {
  const key = toScheduleDateKey(date);
  const totalDates = schedule.leagueSchedule?.gameDates?.length ?? 0;
  if (__DEV__) {
    const sample = schedule.leagueSchedule?.gameDates?.slice(0, 2).map(gd => gd.gameDate) ?? [];
    console.log(`[Scoreboard] ${source}: ${totalDates} dates loaded. lookup key='${key}' for selectedDate=${date}. sample dates=${JSON.stringify(sample)}. seasonYear=${schedule.leagueSchedule?.seasonYear}`);
  }
  const entry = schedule.leagueSchedule.gameDates.find(gd => gd.gameDate === key);
  if (!entry) {
    if (__DEV__) {
      console.log(`[Scoreboard] ${source}: no entry for ${date} (key=${key}). 0 games matched.`);
    }
    return { games: [], gameDate: date, fetchSucceeded: true, source };
  }
  if (__DEV__) {
    const firstGame = entry.games[0];
    console.log(`[Scoreboard] ${source} matched ${entry.games.length} games for ${date}; first game date fields:`, firstGame ? { gameDateEst: firstGame.gameDateEst, gameDateUTC: firstGame.gameDateUTC, gameTimeUTC: firstGame.gameTimeUTC } : 'none');
  }
  const games: Game[] = entry.games.map(sg => {
    const cdnLike: CdnScoreboardGame = {
      gameId: sg.gameId,
      gameCode: sg.gameCode,
      gameStatus: sg.gameStatus,
      gameStatusText: sg.gameStatusText,
      period: 0,
      gameClock: '',
      gameTimeUTC: sg.gameTimeUTC ?? sg.gameDateUTC ?? '',
      homeTeam: sg.homeTeam,
      awayTeam: sg.awayTeam,
    };
    const game = transformScoreboardGame(cdnLike, date);
    if (sg.arenaName) {
      game.arena = sg.arenaCity ? `${sg.arenaName}, ${sg.arenaCity}` : sg.arenaName;
    }
    return game;
  });
  return { games, gameDate: date, fetchSucceeded: true, source };
}

async function fetchFromStatsScheduleLeagueV2(date: string, season: string): Promise<FetchScoreboardByDateResult | null> {
  try {
    const data = await getCachedHistoricalSchedulePromise(season);
    const validation = validateScheduleShape(data);
    if (!validation.valid) {
      console.warn(`[Scoreboard] stats scheduleleaguev2 invalid shape for season=${season}: ${validation.error}`);
      return null;
    }
    return parseScheduleResponseForDate(data, date, 'stats-historical');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[Scoreboard] stats scheduleleaguev2 failed (season=${season}, date=${date}): ${msg}`);
    return null;
  }
}

function loadFromLocalHistoricalSchedule(date: string, season: string): FetchScoreboardByDateResult | null {
  const raw = loadLocalSeasonSchedule(season);
  if (!raw) {
    if (__DEV__) {
      console.log(`[Scoreboard] No local bundled schedule for season=${season}`);
    }
    return null;
  }
  const validation = validateScheduleShape(raw);
  if (!validation.valid) {
    console.warn(`[Scoreboard] Local schedule for season=${season} invalid shape: ${validation.error}`);
    return null;
  }
  if (__DEV__) {
    console.log(`[Scoreboard] Using local bundled schedule for season=${season}, date=${date}`);
  }
  return parseScheduleResponseForDate(raw as ScheduleLeagueV2Response, date, 'schedule-local-historical');
}

async function fetchFromStatsNba(date: string): Promise<FetchScoreboardByDateResult> {
  console.log(`[Scoreboard] Fetching stats.nba.com scoreboardv3 for ${date}`);
  try {
    const data = await fetchNbaStats<unknown>('scoreboardv3', {
      LeagueID: '00',
      GameDate: date,
    });

    const validation = validateScoreboardShape(data);
    if (!validation.valid) {
      console.warn(`[Scoreboard] Stats response for ${date} failed validation: ${validation.error}`);
      console.warn('[Scoreboard] Stats payload snippet:', JSON.stringify(data).substring(0, 300));
      return { games: [], gameDate: date, fetchSucceeded: false, source: 'failed' };
    }

    const typedData = data as StatsScoreboardResponse;
    const games = typedData.scoreboard.games.map(g => transformScoreboardGame(g, date));
    console.log(`[Scoreboard] stats.nba.com returned ${games.length} games for ${date}`);
    return { games, gameDate: date, fetchSucceeded: true, source: 'stats-nba' };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.warn(`[Scoreboard] stats.nba.com failed for ${date}: ${msg}`);
    return { games: [], gameDate: date, fetchSucceeded: false, source: 'failed' };
  }
}

async function getScheduleSeasonYear(): Promise<string | null> {
  try {
    const schedule = await getCachedSchedulePromise();
    return normalizeSeasonYear(schedule.leagueSchedule?.seasonYear) || null;
  } catch {
    return null;
  }
}

export async function fetchScoreboardByDate(date: string): Promise<FetchScoreboardByDateResult> {
  const targetSeason = getNbaSeasonForDate(date);
  const scheduleSeason = await getScheduleSeasonYear();
  const isCurrentSeason = !!scheduleSeason && !!targetSeason && scheduleSeason === targetSeason;

  if (__DEV__) {
    console.log(`[Scoreboard] fetchScoreboardByDate(${date}) targetSeason=${targetSeason} scheduleSeason=${scheduleSeason ?? 'unknown'} isCurrentSeason=${isCurrentSeason}`);
  }

  if (isCurrentSeason || !scheduleSeason) {
    const cdnResult = await fetchFromScheduleCdn(date);
    if (cdnResult) {
      if (cdnResult.games.length > 0) {
        return cdnResult;
      }
      if (isCurrentSeason) {
        if (__DEV__) {
          console.log(`[Scoreboard] Current-season date ${date} not present in schedule CDN -> trying stats.nba.com scoreboardv3 as secondary`);
        }
        const statsResult = await fetchFromStatsNba(date);
        if (statsResult.fetchSucceeded && statsResult.games.length > 0) {
          return statsResult;
        }
        return cdnResult;
      }
    }
  }

  if (targetSeason) {
    const localResult = loadFromLocalHistoricalSchedule(date, targetSeason);
    if (localResult) {
      if (__DEV__) {
        console.log(`[Scoreboard] Local historical schedule for ${date} (season=${targetSeason}): ${localResult.games.length} games. source=${localResult.source}`);
      }
      return localResult;
    }

    if (__DEV__) {
      console.log(`[Scoreboard] No local schedule bundled for season=${targetSeason}; attempting best-effort stats scheduleleaguev2`);
    }
    const historicalResult = await fetchFromStatsScheduleLeagueV2(date, targetSeason);
    if (historicalResult && historicalResult.games.length > 0) {
      return historicalResult;
    }

    if (__DEV__) {
      console.log(`[Scoreboard] stats scheduleleaguev2 unavailable/empty for ${date}; trying scoreboardv3 as best-effort`);
    }
    const statsResult = await fetchFromStatsNba(date);
    if (statsResult.fetchSucceeded && statsResult.games.length > 0) {
      return statsResult;
    }

    if (__DEV__) {
      console.log(`[Scoreboard] Historical lookup unavailable for ${date} (season=${targetSeason}). hasLocal=${hasLocalSeasonSchedule(targetSeason)}`);
    }
    return { games: [], gameDate: date, fetchSucceeded: false, source: 'unavailable' };
  }

  if (__DEV__) {
    console.log(`[Scoreboard] No target season computed for ${date}; final fallback to scoreboardv3`);
  }
  const statsResult = await fetchFromStatsNba(date);
  if (statsResult.fetchSucceeded) {
    return statsResult;
  }
  return { games: [], gameDate: date, fetchSucceeded: false, source: 'unavailable' };
}

export async function fetchRecentScoreboards(daysBack: number = 3): Promise<Game[]> {
  const allGames: Game[] = [];
  const today = new Date();

  for (let i = 1; i <= daysBack; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = formatGameDate(date);

    try {
      const result = await fetchScoreboardByDate(dateStr);
      allGames.push(...result.games);
    } catch (error) {
      console.warn(`[Scoreboard] Failed to fetch games for ${dateStr}`, error);
    }
  }

  return allGames;
}
