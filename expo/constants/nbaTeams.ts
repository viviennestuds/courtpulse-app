export interface NbaTeamInfo {
  nbaId: number;
  abbreviation: string;
  name: string;
  city: string;
  conference: 'East' | 'West';
  division: string;
  primaryColor: string;
  secondaryColor: string;
  logo: string;
}

export const NBA_TEAMS: NbaTeamInfo[] = [
  { nbaId: 1610612737, abbreviation: 'ATL', name: 'Hawks', city: 'Atlanta', conference: 'East', division: 'Southeast', primaryColor: '#E03A3E', secondaryColor: '#C1D32F', logo: '🦅' },
  { nbaId: 1610612738, abbreviation: 'BOS', name: 'Celtics', city: 'Boston', conference: 'East', division: 'Atlantic', primaryColor: '#007A33', secondaryColor: '#BA9653', logo: '☘️' },
  { nbaId: 1610612751, abbreviation: 'BKN', name: 'Nets', city: 'Brooklyn', conference: 'East', division: 'Atlantic', primaryColor: '#000000', secondaryColor: '#FFFFFF', logo: '🏀' },
  { nbaId: 1610612766, abbreviation: 'CHA', name: 'Hornets', city: 'Charlotte', conference: 'East', division: 'Southeast', primaryColor: '#1D1160', secondaryColor: '#00788C', logo: '🐝' },
  { nbaId: 1610612741, abbreviation: 'CHI', name: 'Bulls', city: 'Chicago', conference: 'East', division: 'Central', primaryColor: '#CE1141', secondaryColor: '#000000', logo: '🐂' },
  { nbaId: 1610612739, abbreviation: 'CLE', name: 'Cavaliers', city: 'Cleveland', conference: 'East', division: 'Central', primaryColor: '#860038', secondaryColor: '#FDBB30', logo: '⚔️' },
  { nbaId: 1610612742, abbreviation: 'DAL', name: 'Mavericks', city: 'Dallas', conference: 'West', division: 'Southwest', primaryColor: '#00538C', secondaryColor: '#B8C4CA', logo: '🐴' },
  { nbaId: 1610612743, abbreviation: 'DEN', name: 'Nuggets', city: 'Denver', conference: 'West', division: 'Northwest', primaryColor: '#0E2240', secondaryColor: '#FEC524', logo: '⛏️' },
  { nbaId: 1610612765, abbreviation: 'DET', name: 'Pistons', city: 'Detroit', conference: 'East', division: 'Central', primaryColor: '#C8102E', secondaryColor: '#1D42BA', logo: '🔧' },
  { nbaId: 1610612744, abbreviation: 'GSW', name: 'Warriors', city: 'Golden State', conference: 'West', division: 'Pacific', primaryColor: '#1D428A', secondaryColor: '#FFC72C', logo: '🌉' },
  { nbaId: 1610612745, abbreviation: 'HOU', name: 'Rockets', city: 'Houston', conference: 'West', division: 'Southwest', primaryColor: '#CE1141', secondaryColor: '#000000', logo: '🚀' },
  { nbaId: 1610612754, abbreviation: 'IND', name: 'Pacers', city: 'Indiana', conference: 'East', division: 'Central', primaryColor: '#002D62', secondaryColor: '#FDBB30', logo: '🏎️' },
  { nbaId: 1610612746, abbreviation: 'LAC', name: 'Clippers', city: 'Los Angeles', conference: 'West', division: 'Pacific', primaryColor: '#C8102E', secondaryColor: '#1D428A', logo: '⛵' },
  { nbaId: 1610612747, abbreviation: 'LAL', name: 'Lakers', city: 'Los Angeles', conference: 'West', division: 'Pacific', primaryColor: '#552583', secondaryColor: '#FDB927', logo: '💜' },
  { nbaId: 1610612763, abbreviation: 'MEM', name: 'Grizzlies', city: 'Memphis', conference: 'West', division: 'Southwest', primaryColor: '#5D76A9', secondaryColor: '#12173F', logo: '🐻' },
  { nbaId: 1610612748, abbreviation: 'MIA', name: 'Heat', city: 'Miami', conference: 'East', division: 'Southeast', primaryColor: '#98002E', secondaryColor: '#F9A01B', logo: '🔥' },
  { nbaId: 1610612749, abbreviation: 'MIL', name: 'Bucks', city: 'Milwaukee', conference: 'East', division: 'Central', primaryColor: '#00471B', secondaryColor: '#EEE1C6', logo: '🦌' },
  { nbaId: 1610612750, abbreviation: 'MIN', name: 'Timberwolves', city: 'Minnesota', conference: 'West', division: 'Northwest', primaryColor: '#0C2340', secondaryColor: '#236192', logo: '🐺' },
  { nbaId: 1610612740, abbreviation: 'NOP', name: 'Pelicans', city: 'New Orleans', conference: 'West', division: 'Southwest', primaryColor: '#0C2340', secondaryColor: '#C8102E', logo: '🦅' },
  { nbaId: 1610612752, abbreviation: 'NYK', name: 'Knicks', city: 'New York', conference: 'East', division: 'Atlantic', primaryColor: '#006BB6', secondaryColor: '#F58426', logo: '🏙️' },
  { nbaId: 1610612760, abbreviation: 'OKC', name: 'Thunder', city: 'Oklahoma City', conference: 'West', division: 'Northwest', primaryColor: '#007AC1', secondaryColor: '#EF6100', logo: '⚡' },
  { nbaId: 1610612753, abbreviation: 'ORL', name: 'Magic', city: 'Orlando', conference: 'East', division: 'Southeast', primaryColor: '#0077C0', secondaryColor: '#C4CED4', logo: '✨' },
  { nbaId: 1610612755, abbreviation: 'PHI', name: '76ers', city: 'Philadelphia', conference: 'East', division: 'Atlantic', primaryColor: '#006BB6', secondaryColor: '#ED174C', logo: '🔔' },
  { nbaId: 1610612756, abbreviation: 'PHX', name: 'Suns', city: 'Phoenix', conference: 'West', division: 'Pacific', primaryColor: '#1D1160', secondaryColor: '#E56020', logo: '☀️' },
  { nbaId: 1610612757, abbreviation: 'POR', name: 'Trail Blazers', city: 'Portland', conference: 'West', division: 'Northwest', primaryColor: '#E03A3E', secondaryColor: '#000000', logo: '🌲' },
  { nbaId: 1610612758, abbreviation: 'SAC', name: 'Kings', city: 'Sacramento', conference: 'West', division: 'Pacific', primaryColor: '#5A2D81', secondaryColor: '#63727A', logo: '👑' },
  { nbaId: 1610612759, abbreviation: 'SAS', name: 'Spurs', city: 'San Antonio', conference: 'West', division: 'Southwest', primaryColor: '#C4CED4', secondaryColor: '#000000', logo: '⭐' },
  { nbaId: 1610612761, abbreviation: 'TOR', name: 'Raptors', city: 'Toronto', conference: 'East', division: 'Atlantic', primaryColor: '#CE1141', secondaryColor: '#000000', logo: '🦖' },
  { nbaId: 1610612762, abbreviation: 'UTA', name: 'Jazz', city: 'Utah', conference: 'West', division: 'Northwest', primaryColor: '#002B5C', secondaryColor: '#00471B', logo: '🎵' },
  { nbaId: 1610612764, abbreviation: 'WAS', name: 'Wizards', city: 'Washington', conference: 'East', division: 'Southeast', primaryColor: '#002B5C', secondaryColor: '#E31837', logo: '🧙' },
];

const TEAM_BY_ID_MAP = new Map<number, NbaTeamInfo>();
const TEAM_BY_ABBR_MAP = new Map<string, NbaTeamInfo>();

NBA_TEAMS.forEach(t => {
  TEAM_BY_ID_MAP.set(t.nbaId, t);
  TEAM_BY_ABBR_MAP.set(t.abbreviation, t);
});

export function getTeamInfoById(nbaId: number): NbaTeamInfo | undefined {
  return TEAM_BY_ID_MAP.get(nbaId);
}

export function getTeamInfoByAbbr(abbr: string): NbaTeamInfo | undefined {
  return TEAM_BY_ABBR_MAP.get(abbr);
}

export function getTeamColor(tricode: string): string {
  return TEAM_BY_ABBR_MAP.get(tricode)?.primaryColor ?? '#64748B';
}

export function getTeamSecondaryColor(tricode: string): string {
  return TEAM_BY_ABBR_MAP.get(tricode)?.secondaryColor ?? '#94A3B8';
}

export function getTeamLogo(tricode: string): string {
  return TEAM_BY_ABBR_MAP.get(tricode)?.logo ?? '🏀';
}

export function getPlayerHeadshotUrl(personId: number): string {
  return `https://cdn.nba.com/headshots/nba/latest/260x190/${personId}.png`;
}
