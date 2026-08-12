import { Team, Player, PlayerOverview, PlayersOverviewResponse, TeamOverview, TeamOverviewResponse, TeamRosterPlayer, TeamRosterResponse } from '@/types';
import { fetchNbaCdnStatic, fetchNbaStats, NBA_SEASON_TYPE } from './nbaApi';
import { getPlayerHeadshotUrl, getTeamInfoById, NBA_TEAMS } from '@/constants/nbaTeams';
import type { PlayerDirectorySnapshot, PlayersPhaseAvailabilityResponse, PlayersSeasonPhase } from '@/types/playersDirectory';
import { isValidPlayerDirectorySnapshot, isValidPlayersPhaseAvailabilityResponse } from './playersDirectoryValidation';

export const TEAM_STANDINGS_SEASON = '2025-26';
const NBA_STATS_PROXY_BASE_URL = 'https://gikxqfkzmwcujkndoizr.supabase.co/functions/v1/nba-stats-proxy';

interface StatsResultSet {
  name: string;
  headers: string[];
  rowSet: (string | number | null)[][];
}

interface StatsResponse {
  resultSets: StatsResultSet[];
}

interface ScheduleLeagueV2Response {
  leagueSchedule?: {
    seasonYear?: string;
    gameDates?: Array<{
      gameDate?: string;
      games?: ScheduleLeagueV2Game[];
    }>;
  };
}

interface ScheduleLeagueV2Game {
  gameStatus?: number | string | null;
  gameLabel?: string | null;
  gameSubLabel?: string | null;
  gameSubtype?: string | null;
  gameDateEst?: string | null;
  gameDateUTC?: string | null;
  homeTeam?: ScheduleTeamShape | null;
  awayTeam?: ScheduleTeamShape | null;
}

interface ScheduleTeamShape {
  teamId?: number | string | null;
  teamName?: string | null;
  teamCity?: string | null;
  teamTricode?: string | null;
  wins?: number | string | null;
  losses?: number | string | null;
}

interface ScheduleRecordSnapshot {
  wins: number;
  losses: number;
  gameDate: string;
}

function getColumnIndex(headers: string[], name: string): number {
  return headers.indexOf(name);
}

function getVal<T>(row: (string | number | null)[], headers: string[], col: string, fallback: T): T {
  const idx = getColumnIndex(headers, col);
  if (idx === -1) return fallback;
  const val = row[idx];
  if (val == null) return fallback;
  return val as unknown as T;
}

function getOptionalNumber(row: (string | number | null)[], headers: string[], col: string): number | undefined {
  const idx = getColumnIndex(headers, col);
  if (idx === -1) return undefined;
  const val = row[idx];
  if (typeof val === 'number' && Number.isFinite(val)) return val;
  if (typeof val === 'string' && val.trim()) {
    const parsed = Number(val);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function toNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function toNullableNumber(value: unknown): number | null {
  const parsed = toNumber(value);
  return parsed ?? null;
}

function toNullableString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function normalizeConference(value: unknown, fallback?: 'East' | 'West'): 'East' | 'West' {
  if (value === 'East' || value === 'West') return value;
  return fallback ?? 'East';
}

function toNullableBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function normalizeTeamOverview(raw: unknown): TeamOverview | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const teamId = toNumber(obj.teamId);
  if (teamId === undefined) return null;

  const info = getTeamInfoById(teamId);
  const standings = (obj.standings && typeof obj.standings === 'object' ? obj.standings : {}) as Record<string, unknown>;
  const ratings = (obj.ratings && typeof obj.ratings === 'object' ? obj.ratings : {}) as Record<string, unknown>;
  const scoring = (obj.scoring && typeof obj.scoring === 'object' ? obj.scoring : {}) as Record<string, unknown>;
  const recordSplits = (obj.recordSplits && typeof obj.recordSplits === 'object' ? obj.recordSplits : {}) as Record<string, unknown>;
  const dataAvailability = (obj.dataAvailability && typeof obj.dataAvailability === 'object' ? obj.dataAvailability : {}) as Record<string, unknown>;

  const abbreviation = typeof obj.abbreviation === 'string' && obj.abbreviation.trim() ? obj.abbreviation : info?.abbreviation ?? '???';
  const city = typeof obj.city === 'string' && obj.city.trim() ? obj.city : info?.city ?? '';
  const name = typeof obj.name === 'string' && obj.name.trim() ? obj.name : info?.name ?? 'Unknown';

  return {
    teamId,
    abbreviation,
    city,
    name,
    fullName: typeof obj.fullName === 'string' && obj.fullName.trim() ? obj.fullName : `${city} ${name}`.trim(),
    conference: normalizeConference(obj.conference, info?.conference),
    division: toNullableString(obj.division) ?? info?.division ?? null,
    standings: {
      wins: toNullableNumber(standings.wins),
      losses: toNullableNumber(standings.losses),
      winPct: toNullableNumber(standings.winPct),
      leagueRank: toNullableNumber(standings.leagueRank),
      conferenceRank: toNullableNumber(standings.conferenceRank),
      divisionRank: toNullableNumber(standings.divisionRank),
      gamesBackConference: toNullableNumber(standings.gamesBackConference),
      gamesBackDivision: toNullableNumber(standings.gamesBackDivision),
      clinchIndicator: toNullableString(standings.clinchIndicator),
      streak: toNullableString(standings.streak),
      last10: toNullableString(standings.last10),
      homeRecord: toNullableString(standings.homeRecord),
      roadRecord: toNullableString(standings.roadRecord),
    },
    ratings: {
      offRating: toNullableNumber(ratings.offRating),
      defRating: toNullableNumber(ratings.defRating),
      netRating: toNullableNumber(ratings.netRating),
      pace: toNullableNumber(ratings.pace),
    },
    scoring: {
      pointsPerGame: toNullableNumber(scoring.pointsPerGame),
      opponentPointsPerGame: toNullableNumber(scoring.opponentPointsPerGame),
      plusMinusPerGame: toNullableNumber(scoring.plusMinusPerGame),
      totalPoints: toNullableNumber(scoring.totalPoints),
      opponentTotalPoints: toNullableNumber(scoring.opponentTotalPoints),
      totalPointDifferential: toNullableNumber(scoring.totalPointDifferential),
    },
    recordSplits: {
      aheadAtHalf: toNullableString(recordSplits.aheadAtHalf),
      behindAtHalf: toNullableString(recordSplits.behindAtHalf),
      tiedAtHalf: toNullableString(recordSplits.tiedAtHalf),
      aheadAtThird: toNullableString(recordSplits.aheadAtThird),
      behindAtThird: toNullableString(recordSplits.behindAtThird),
      tiedAtThird: toNullableString(recordSplits.tiedAtThird),
      score100Plus: toNullableString(recordSplits.score100Plus),
      opponentScore100Plus: toNullableString(recordSplits.opponentScore100Plus),
      vsOppOver500: toNullableString(recordSplits.vsOppOver500),
      leadInFgPct: toNullableString(recordSplits.leadInFgPct),
      leadInRebounds: toNullableString(recordSplits.leadInRebounds),
      fewerTurnovers: toNullableString(recordSplits.fewerTurnovers),
    },
    dataAvailability: {
      standings: dataAvailability.standings === true,
      ratings: dataAvailability.ratings === true,
      scoring: dataAvailability.scoring === true,
      recordSplits: dataAvailability.recordSplits === true,
      traditionalSource: dataAvailability.traditionalSource === true,
      traditionalCoreStats: dataAvailability.traditionalCoreStats === true,
    },
  };
}

export function teamOverviewToTeam(overview: TeamOverview): Team {
  const teamId = toNumber(overview.teamId) ?? 0;
  const info = getTeamInfoById(teamId);
  const wins = overview.standings.wins ?? 0;
  const losses = overview.standings.losses ?? 0;
  const offRating = overview.ratings.offRating ?? 0;
  const defRating = overview.ratings.defRating ?? 0;
  const netRating = overview.ratings.netRating ?? 0;
  const pace = overview.ratings.pace ?? 0;

  return {
    id: String(teamId),
    name: overview.name || info?.name || 'Unknown',
    abbreviation: overview.abbreviation || info?.abbreviation || '???',
    city: overview.city || info?.city || '',
    conference: normalizeConference(overview.conference, info?.conference),
    division: overview.division ?? info?.division ?? '',
    wins,
    losses,
    logo: info?.logo ?? '🏀',
    primaryColor: info?.primaryColor ?? '#64748B',
    secondaryColor: info?.secondaryColor ?? '#94A3B8',
    offRating,
    defRating,
    netRating,
    pace,
    ratingsAvailable: overview.ratings.offRating !== null && overview.ratings.defRating !== null && overview.ratings.netRating !== null && overview.ratings.pace !== null,
    recordAvailable: overview.standings.wins !== null && overview.standings.losses !== null,
    overview,
  };
}

export async function fetchTeamsOverview({
  season = TEAM_STANDINGS_SEASON,
}: {
  season?: string;
  seasonType?: 'Regular Season';
} = {}): Promise<TeamOverviewResponse> {
  const url = new URL(NBA_STATS_PROXY_BASE_URL);
  url.searchParams.set('type', 'teamsOverview');
  url.searchParams.set('season', season);

  console.log(`[TeamStats] Fetching teamsOverview.v2 for ${season} from Supabase proxy...`);
  const response = await fetch(url.toString(), { headers: { Accept: 'application/json' } });
  const text = await response.text();

  if (!response.ok) {
    throw new Error(`Teams overview proxy returned ${response.status}: ${text.substring(0, 160)}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`Teams overview proxy returned invalid JSON: ${text.substring(0, 160)}`);
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Teams overview proxy returned a non-object payload');
  }

  const payload = parsed as Record<string, unknown>;
  if (payload.success !== true) {
    const reason = typeof payload.error === 'string' ? payload.error : typeof payload.message === 'string' ? payload.message : 'success=false';
    throw new Error(`Teams overview proxy failed: ${reason}`);
  }
  if (payload.schemaVersion !== 'teamsOverview.v2' || payload.type !== 'teamsOverview') {
    throw new Error(`Unexpected teams overview schema: ${String(payload.schemaVersion ?? 'unknown')}`);
  }
  if (!Array.isArray(payload.teams)) {
    throw new Error('Teams overview payload is missing teams array');
  }

  const teams = payload.teams.map(normalizeTeamOverview).filter((team): team is TeamOverview => team !== null);
  if (teams.length === 0) {
    throw new Error('Teams overview payload did not contain valid teams');
  }

  return {
    success: true,
    schemaVersion: 'teamsOverview.v2',
    type: 'teamsOverview',
    season: typeof payload.season === 'string' ? payload.season : season,
    seasonType: typeof payload.seasonType === 'string' ? payload.seasonType : 'Regular Season',
    partial: payload.partial === true,
    sourceStatus: payload.sourceStatus && typeof payload.sourceStatus === 'object' ? payload.sourceStatus as TeamOverviewResponse['sourceStatus'] : undefined,
    teamCount: typeof payload.teamCount === 'number' ? payload.teamCount : teams.length,
    teams,
    fetchedAt: typeof payload.fetchedAt === 'string' ? payload.fetchedAt : undefined,
    warnings: Array.isArray(payload.warnings) ? payload.warnings.filter((warning): warning is string => typeof warning === 'string') : undefined,
    cache: payload.cache,
  };
}

export async function fetchTeamsOverviewTeams(): Promise<Team[]> {
  const overview = await fetchTeamsOverview({ season: TEAM_STANDINGS_SEASON, seasonType: 'Regular Season' });
  return overview.teams.map(teamOverviewToTeam);
}

function validateStatsProxyPayload(parsed: unknown, expectedType: string, expectedSchema: string): Record<string, unknown> {
  if (!parsed || typeof parsed !== 'object') {
    throw new Error(`${expectedType} proxy returned a non-object payload`);
  }

  const payload = parsed as Record<string, unknown>;
  if (payload.success !== true) {
    const reason = typeof payload.error === 'string' ? payload.error : typeof payload.message === 'string' ? payload.message : 'success=false';
    throw new Error(`${expectedType} proxy failed: ${reason}`);
  }
  if (payload.schemaVersion !== expectedSchema || payload.type !== expectedType) {
    throw new Error(`Unexpected ${expectedType} schema: ${String(payload.schemaVersion ?? 'unknown')}`);
  }

  return payload;
}

export interface NbaStatsProxyFetchOptions {
  signal?: AbortSignal;
}

async function fetchNbaStatsProxyPayload(
  params: Record<string, string>,
  options: NbaStatsProxyFetchOptions = {},
): Promise<Record<string, unknown>> {
  const url = new URL(NBA_STATS_PROXY_BASE_URL);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  const response = await fetch(url.toString(), {
    headers: { Accept: 'application/json' },
    signal: options.signal,
  });
  const text = await response.text();

  if (!response.ok) {
    throw new Error(`NBA stats proxy returned ${response.status}: ${text.substring(0, 160)}`);
  }

  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(`NBA stats proxy returned invalid JSON: ${text.substring(0, 160)}`);
  }
}

function normalizeTeamRosterAcquisition(raw: unknown): TeamRosterPlayer['acquisition'] {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  return {
    raw: toNullableString(obj.raw),
    type: toNullableString(obj.type),
    fromTeamAbbreviation: toNullableString(obj.fromTeamAbbreviation),
    date: toNullableString(obj.date),
    draftPick: toNullableNumber(obj.draftPick),
    draftYear: toNullableNumber(obj.draftYear),
  };
}

function normalizeTeamRosterPlayer(raw: unknown): TeamRosterPlayer | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const playerId = toNumber(obj.playerId);
  if (playerId === undefined) return null;

  return {
    playerId,
    fullName: toNullableString(obj.fullName) ?? 'Unknown Player',
    nickname: toNullableString(obj.nickname),
    playerSlug: toNullableString(obj.playerSlug),
    jersey: toNullableString(obj.jersey),
    position: toNullableString(obj.position),
    height: toNullableString(obj.height),
    weight: toNullableString(obj.weight),
    birthDate: toNullableString(obj.birthDate),
    age: toNullableNumber(obj.age),
    experience: toNullableString(obj.experience),
    school: toNullableString(obj.school),
    country: toNullableString(obj.country),
    howAcquired: toNullableString(obj.howAcquired),
    acquisition: normalizeTeamRosterAcquisition(obj.acquisition),
    teamId: toNumber(obj.teamId) ?? toNullableString(obj.teamId),
    teamAbbreviation: toNullableString(obj.teamAbbreviation),
    season: toNullableString(obj.season),
  };
}

function normalizePlayerOverviewRanks(raw: unknown): PlayerOverview['ranks'] {
  const obj = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  const base = obj.base && typeof obj.base === 'object' ? obj.base as Record<string, unknown> : {};
  const advanced = obj.advanced && typeof obj.advanced === 'object' ? obj.advanced as Record<string, unknown> : {};

  return {
    base: {
      points: toNullableNumber(base.points),
      rebounds: toNullableNumber(base.rebounds),
      assists: toNullableNumber(base.assists),
      minutes: toNullableNumber(base.minutes),
    },
    advanced: {
      trueShootingPct: toNullableNumber(advanced.trueShootingPct),
      usagePct: toNullableNumber(advanced.usagePct),
      netRating: toNullableNumber(advanced.netRating),
    },
  };
}

function normalizePlayerOverview(raw: unknown): PlayerOverview | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const playerId = toNumber(obj.playerId);
  if (playerId === undefined) return null;

  const base = obj.base && typeof obj.base === 'object' ? obj.base as Record<string, unknown> : {};
  const advanced = obj.advanced && typeof obj.advanced === 'object' ? obj.advanced as Record<string, unknown> : {};
  const dataAvailability = obj.dataAvailability && typeof obj.dataAvailability === 'object' ? obj.dataAvailability as Record<string, unknown> : {};

  return {
    playerId,
    fullName: toNullableString(obj.fullName) ?? 'Unknown Player',
    nickname: toNullableString(obj.nickname),
    teamId: toNumber(obj.teamId) ?? toNullableString(obj.teamId),
    teamAbbreviation: toNullableString(obj.teamAbbreviation),
    teamName: toNullableString(obj.teamName),
    age: toNullableNumber(obj.age),
    base: {
      gamesPlayed: toNullableNumber(base.gamesPlayed),
      minutesPerGame: toNullableNumber(base.minutesPerGame),
      pointsPerGame: toNullableNumber(base.pointsPerGame),
      reboundsPerGame: toNullableNumber(base.reboundsPerGame),
      assistsPerGame: toNullableNumber(base.assistsPerGame),
    },
    advanced: {
      possessions: toNullableNumber(advanced.possessions),
      trueShootingPct: toNullableNumber(advanced.trueShootingPct),
      usagePct: toNullableNumber(advanced.usagePct),
      netRating: toNullableNumber(advanced.netRating),
    },
    ranks: normalizePlayerOverviewRanks(obj.ranks),
    dataAvailability: Object.fromEntries(
      Object.entries(dataAvailability)
        .map(([key, value]) => [key, toNullableBoolean(value)])
        .filter((entry): entry is [string, boolean] => typeof entry[1] === 'boolean')
    ),
  };
}

export async function fetchTeamRoster({
  teamId,
  season = TEAM_STANDINGS_SEASON,
}: {
  teamId: string | number;
  season?: string;
}): Promise<TeamRosterResponse> {
  const parsed = await fetchNbaStatsProxyPayload({ type: 'teamRoster', teamId: String(teamId), season });
  const payload = validateStatsProxyPayload(parsed, 'teamRoster', 'teamRoster.v2');
  if (!Array.isArray(payload.players)) {
    throw new Error('teamRoster payload is missing players array');
  }

  const players = payload.players.map(normalizeTeamRosterPlayer).filter((player): player is TeamRosterPlayer => player !== null);
  return {
    success: true,
    schemaVersion: 'teamRoster.v2',
    type: 'teamRoster',
    season: typeof payload.season === 'string' ? payload.season : season,
    teamId: toNumber(payload.teamId) ?? toNullableString(payload.teamId),
    partial: payload.partial === true,
    players,
    fetchedAt: typeof payload.fetchedAt === 'string' ? payload.fetchedAt : undefined,
    warnings: Array.isArray(payload.warnings) ? payload.warnings.filter((warning): warning is string => typeof warning === 'string') : undefined,
    cache: payload.cache,
  };
}

export async function fetchPlayersOverview({
  teamId,
  season = TEAM_STANDINGS_SEASON,
}: {
  teamId: string | number;
  season?: string;
}): Promise<PlayersOverviewResponse> {
  const parsed = await fetchNbaStatsProxyPayload({ type: 'playersOverview', teamId: String(teamId), season });
  const payload = validateStatsProxyPayload(parsed, 'playersOverview', 'playersOverview.v2');
  if (!Array.isArray(payload.players)) {
    throw new Error('playersOverview payload is missing players array');
  }

  const players = payload.players.map(normalizePlayerOverview).filter((player): player is PlayerOverview => player !== null);
  return {
    success: true,
    schemaVersion: 'playersOverview.v2',
    type: 'playersOverview',
    season: typeof payload.season === 'string' ? payload.season : season,
    teamId: toNumber(payload.teamId) ?? toNullableString(payload.teamId),
    teamAbbreviation: toNullableString(payload.teamAbbreviation),
    rankScope: toNullableString(payload.rankScope),
    partial: payload.partial === true,
    playerCount: toNullableNumber(payload.playerCount) ?? undefined,
    sourceStatus: payload.sourceStatus && typeof payload.sourceStatus === 'object' ? payload.sourceStatus as Record<string, string> : undefined,
    players,
    fetchedAt: typeof payload.fetchedAt === 'string' ? payload.fetchedAt : undefined,
    warnings: Array.isArray(payload.warnings) ? payload.warnings.filter((warning): warning is string => typeof warning === 'string') : undefined,
    cache: payload.cache,
  };
}

/** Fetches and defensively validates one canonical league-wide Players directory snapshot. */
export async function fetchPlayersDirectory(
  season: string,
  phase: PlayersSeasonPhase,
  options: NbaStatsProxyFetchOptions = {},
): Promise<PlayerDirectorySnapshot> {
  const payload = await fetchNbaStatsProxyPayload({ type: 'playersDirectory', season, phase }, options);
  if (!isValidPlayerDirectorySnapshot(payload, season, phase)) {
    throw new Error(`Invalid playersDirectory.v1 payload for ${season} ${phase}`);
  }
  return payload;
}

/** Fetches phase availability without loading or persisting another full directory snapshot. */
export async function fetchPlayersPhaseAvailability(
  season: string,
  options: NbaStatsProxyFetchOptions = {},
): Promise<PlayersPhaseAvailabilityResponse> {
  const payload = await fetchNbaStatsProxyPayload({ type: 'playersPhaseAvailability', season }, options);
  if (!isValidPlayersPhaseAvailabilityResponse(payload, season)) {
    throw new Error(`Invalid playersPhaseAvailability.v1 payload for ${season}`);
  }
  return payload;
}

export async function fetchTeamStats(): Promise<Team[]> {
  console.log('[TeamStats] Fetching advanced team ratings from stats.nba.com...');

  const data = await fetchNbaStats<StatsResponse>('leaguedashteamstats', {
    LeagueID: '00',
    Season: TEAM_STANDINGS_SEASON,
    SeasonType: NBA_SEASON_TYPE,
    MeasureType: 'Advanced',
    PerMode: 'PerGame',
    PlusMinus: 'N',
    PaceAdjust: 'N',
    Rank: 'N',
    Outcome: '',
    Location: '',
    Month: '0',
    SeasonSegment: '',
    DateFrom: '',
    DateTo: '',
    OpponentTeamID: '0',
    VsConference: '',
    VsDivision: '',
    GameSegment: '',
    Period: '0',
    LastNGames: '0',
  });

  const resultSet = data.resultSets?.[0];
  if (!resultSet) {
    console.warn('[TeamStats] No result set returned');
    return [];
  }

  const h = resultSet.headers;
  const teams: Team[] = resultSet.rowSet.map(row => {
    const teamId = getVal<number>(row, h, 'TEAM_ID', 0);
    const info = getTeamInfoById(teamId);
    const wins = getVal<number>(row, h, 'W', 0);
    const losses = getVal<number>(row, h, 'L', 0);
    const offRating = getOptionalNumber(row, h, 'OFF_RATING');
    const defRating = getOptionalNumber(row, h, 'DEF_RATING');
    const netRating = getOptionalNumber(row, h, 'NET_RATING');
    const pace = getOptionalNumber(row, h, 'PACE');
    const ratingsAvailable = offRating !== undefined && defRating !== undefined && netRating !== undefined;

    return {
      id: String(teamId),
      name: info?.name ?? getVal<string>(row, h, 'TEAM_NAME', 'Unknown'),
      abbreviation: info?.abbreviation ?? getVal<string>(row, h, 'TEAM_ABBREVIATION', '???'),
      city: info?.city ?? '',
      conference: info?.conference ?? 'East',
      division: info?.division ?? '',
      wins,
      losses,
      logo: info?.logo ?? '🏀',
      primaryColor: info?.primaryColor ?? '#64748B',
      secondaryColor: info?.secondaryColor ?? '#94A3B8',
      offRating: offRating ?? 0,
      defRating: defRating ?? 0,
      netRating: netRating ?? 0,
      pace: pace ?? 0,
      ratingsAvailable,
      recordAvailable: wins + losses > 0,
    };
  });

  console.log(`[TeamStats] Fetched ${teams.length} teams from advanced ratings endpoint`);
  return teams;
}

function isRealNbaTeam(team: ScheduleTeamShape | null | undefined): team is ScheduleTeamShape {
  const id = toNumber(team?.teamId);
  return id !== undefined && getTeamInfoById(id) !== undefined;
}

function isRegularSeasonRecordGame(game: ScheduleLeagueV2Game): boolean {
  const status = toNumber(game.gameStatus);
  if (status !== 3) return false;
  if (!isRealNbaTeam(game.homeTeam) || !isRealNbaTeam(game.awayTeam)) return false;

  const label = `${game.gameLabel ?? ''} ${game.gameSubLabel ?? ''}`.toLowerCase();
  const excludedLabels = ['preseason', 'first round', 'semifinal', 'finals', 'play-in', 'all-star', 'rising stars'];
  return !excludedLabels.some(excluded => label.includes(excluded));
}

function shouldReplaceRecord(existing: ScheduleRecordSnapshot | undefined, candidate: ScheduleRecordSnapshot): boolean {
  if (!existing) return true;
  const existingGames = existing.wins + existing.losses;
  const candidateGames = candidate.wins + candidate.losses;
  if (candidateGames !== existingGames) return candidateGames > existingGames;
  return candidate.gameDate > existing.gameDate;
}

function collectScheduleRecord(records: Map<string, ScheduleRecordSnapshot>, team: ScheduleTeamShape, gameDate: string): void {
  const teamId = toNumber(team.teamId);
  if (teamId === undefined) return;
  const info = getTeamInfoById(teamId);
  if (!info) return;
  const wins = toNumber(team.wins);
  const losses = toNumber(team.losses);
  if (wins === undefined || losses === undefined) return;
  const candidate: ScheduleRecordSnapshot = { wins, losses, gameDate };
  const existing = records.get(info.abbreviation);
  if (shouldReplaceRecord(existing, candidate)) {
    records.set(info.abbreviation, candidate);
  }
}

export async function fetchTeamRecordsFromSchedule(): Promise<Team[]> {
  console.log('[TeamStats] Fetching team records from NBA schedule metadata...');
  const schedule = await fetchNbaCdnStatic<ScheduleLeagueV2Response>('scheduleLeagueV2.json');
  const gameDates = schedule.leagueSchedule?.gameDates ?? [];
  const records = new Map<string, ScheduleRecordSnapshot>();

  gameDates.forEach(dateEntry => {
    const games = dateEntry.games ?? [];
    games.forEach(game => {
      if (!isRegularSeasonRecordGame(game)) return;
      const gameDate = game.gameDateEst ?? game.gameDateUTC ?? dateEntry.gameDate ?? '';
      if (game.homeTeam) collectScheduleRecord(records, game.homeTeam, gameDate);
      if (game.awayTeam) collectScheduleRecord(records, game.awayTeam, gameDate);
    });
  });

  if (records.size === 0) {
    console.warn('[TeamStats] NBA schedule metadata did not produce any team records');
    return [];
  }

  const teams = NBA_TEAMS.map((t) => {
    const record = records.get(t.abbreviation);
    return {
      id: String(t.nbaId),
      name: t.name,
      abbreviation: t.abbreviation,
      city: t.city,
      conference: t.conference,
      division: t.division,
      wins: record?.wins ?? 0,
      losses: record?.losses ?? 0,
      logo: t.logo,
      primaryColor: t.primaryColor,
      secondaryColor: t.secondaryColor,
      offRating: 0,
      defRating: 0,
      netRating: 0,
      pace: 0,
      ratingsAvailable: false,
      recordAvailable: record !== undefined,
    } satisfies Team;
  });

  console.log(`[TeamStats] Hydrated ${records.size}/30 team records from NBA schedule metadata`);
  return teams;
}

export async function fetchPlayerStats(): Promise<Player[]> {
  console.log('[PlayerStats] Fetching player stats from stats.nba.com...');

  const data = await fetchNbaStats<StatsResponse>('leaguedashplayerstats', {
    LeagueID: '00',
    Season: TEAM_STANDINGS_SEASON,
    SeasonType: NBA_SEASON_TYPE,
    MeasureType: 'Base',
    PerMode: 'PerGame',
    PlusMinus: 'N',
    PaceAdjust: 'N',
    Rank: 'N',
    Outcome: '',
    Location: '',
    Month: '0',
    SeasonSegment: '',
    DateFrom: '',
    DateTo: '',
    OpponentTeamID: '0',
    VsConference: '',
    VsDivision: '',
    GameSegment: '',
    Period: '0',
    LastNGames: '0',
  });

  const resultSet = data.resultSets?.[0];
  if (!resultSet) {
    console.warn('[PlayerStats] No result set returned');
    return [];
  }

  const h = resultSet.headers;
  const players: Player[] = resultSet.rowSet
    .filter(row => getVal<number>(row, h, 'GP', 0) >= 10)
    .map(row => {
      const personId = getVal<number>(row, h, 'PLAYER_ID', 0);
      const teamId = getVal<number>(row, h, 'TEAM_ID', 0);
      const teamInfo = getTeamInfoById(teamId);

      const fga = getVal<number>(row, h, 'FGA', 0);
      const fgm = getVal<number>(row, h, 'FGM', 0);
      const tpa = getVal<number>(row, h, 'FG3A', 0);
      const tpm = getVal<number>(row, h, 'FG3M', 0);
      const fta = getVal<number>(row, h, 'FTA', 0);
      const pts = getVal<number>(row, h, 'PTS', 0);

      const fgPct = fga > 0 ? (fgm / fga) * 100 : 0;
      const threePct = tpa > 0 ? (tpm / tpa) * 100 : 0;
      const tsPct = fga > 0 ? (pts / (2 * (fga + 0.44 * fta))) * 100 : 0;

      return {
        id: String(personId),
        name: getVal<string>(row, h, 'PLAYER_NAME', 'Unknown'),
        teamId: String(teamId),
        teamAbbr: teamInfo?.abbreviation ?? getVal<string>(row, h, 'TEAM_ABBREVIATION', '???'),
        position: '',
        number: '',
        height: '',
        weight: '',
        age: getVal<number>(row, h, 'AGE', 0),
        photo: getPlayerHeadshotUrl(personId),
        ppg: pts,
        rpg: getVal<number>(row, h, 'REB', 0),
        apg: getVal<number>(row, h, 'AST', 0),
        spg: getVal<number>(row, h, 'STL', 0),
        bpg: getVal<number>(row, h, 'BLK', 0),
        fgPct: Math.round(fgPct * 10) / 10,
        threePct: Math.round(threePct * 10) / 10,
        ftPct: getVal<number>(row, h, 'FT_PCT', 0) * 100,
        mpg: getVal<number>(row, h, 'MIN', 0),
        usgRate: 0,
        per: 0,
        tsPct: Math.round(tsPct * 10) / 10,
      };
    });

  console.log(`[PlayerStats] Fetched ${players.length} players`);
  return players;
}

export function getFallbackTeams(): Team[] {
  return NBA_TEAMS.map((t) => ({
    id: String(t.nbaId),
    name: t.name,
    abbreviation: t.abbreviation,
    city: t.city,
    conference: t.conference,
    division: t.division,
    wins: 0,
    losses: 0,
    logo: t.logo,
    primaryColor: t.primaryColor,
    secondaryColor: t.secondaryColor,
    offRating: 0,
    defRating: 0,
    netRating: 0,
    pace: 0,
    ratingsAvailable: false,
    recordAvailable: false,
  }));
}
