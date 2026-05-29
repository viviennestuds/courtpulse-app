import { Team, Player } from '@/types';
import { fetchNbaCdnStatic, fetchNbaStats, NBA_SEASON_TYPE } from './nbaApi';
import { getPlayerHeadshotUrl, getTeamInfoById, NBA_TEAMS } from '@/constants/nbaTeams';

export const TEAM_STANDINGS_SEASON = '2025-26';

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
