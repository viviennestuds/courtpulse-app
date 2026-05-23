import { Team, Player } from '@/types';
import { fetchNbaStats, NBA_SEASON, NBA_SEASON_TYPE } from './nbaApi';
import { getTeamInfoById, getPlayerHeadshotUrl, NBA_TEAMS } from '@/constants/nbaTeams';

interface StatsResultSet {
  name: string;
  headers: string[];
  rowSet: (string | number | null)[][];
}

interface StatsResponse {
  resultSets: StatsResultSet[];
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

export async function fetchTeamStats(): Promise<Team[]> {
  console.log('[TeamStats] Fetching team stats from stats.nba.com...');

  const data = await fetchNbaStats<StatsResponse>('leaguedashteamstats', {
    LeagueID: '00',
    Season: NBA_SEASON,
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
    console.warn('[TeamStats] No result set returned');
    return [];
  }

  const h = resultSet.headers;
  const teams: Team[] = resultSet.rowSet.map(row => {
    const teamId = getVal<number>(row, h, 'TEAM_ID', 0);
    const info = getTeamInfoById(teamId);

    const wins = getVal<number>(row, h, 'W', 0);
    const losses = getVal<number>(row, h, 'L', 0);

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
      offRating: getVal<number>(row, h, 'OFF_RATING', 0),
      defRating: getVal<number>(row, h, 'DEF_RATING', 0),
      netRating: getVal<number>(row, h, 'NET_RATING', 0),
      pace: getVal<number>(row, h, 'PACE', 0),
    };
  });

  console.log(`[TeamStats] Fetched ${teams.length} teams`);
  return teams;
}

export async function fetchPlayerStats(): Promise<Player[]> {
  console.log('[PlayerStats] Fetching player stats from stats.nba.com...');

  const data = await fetchNbaStats<StatsResponse>('leaguedashplayerstats', {
    LeagueID: '00',
    Season: NBA_SEASON,
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
      const ftm = getVal<number>(row, h, 'FTM', 0);
      const pts = getVal<number>(row, h, 'PTS', 0);

      const fgPct = fga > 0 ? (fgm / fga) * 100 : 0;
      const threePct = tpa > 0 ? (tpm / tpa) * 100 : 0;
      const ftPct = fta > 0 ? (ftm / fta) * 100 : 0;
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
        ftPct: Math.round(ftPct * 10) / 10,
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
  }));
}
