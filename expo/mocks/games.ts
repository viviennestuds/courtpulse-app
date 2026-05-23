import { Game, BoxScorePlayer, ScoringRun } from '@/types';

const FEATURED_RUN: ScoringRun = {
  id: 'featured-1',
  teamId: '1',
  teamAbbr: 'BOS',
  teamColor: '#007A33',
  startEvent: 'J. Tatum 3PT Jump Shot',
  endEvent: 'D. White Fast Break Layup',
  startClock: '8:42',
  endClock: '5:18',
  period: 3,
  scoreChange: '58-54 → 76-58',
  totalPoints: 18,
  opponentPoints: 4,
  netPoints: 14,
  playCount: 9,
  duration: '3:24',
  players: ['J. Tatum', 'J. Brown', 'K. Porzingis', 'D. White', 'A. Horford'],
  keyPlay: 'K. Porzingis blocked Brunson at the rim, Tatum pushed the break for a thunderous dunk to cap an 18-4 run',
  isDramatic: true,
};

export const GAMES: Game[] = [
  {
    id: '1', date: '2026-04-06', status: 'live', period: '3rd', clock: '5:42',
    homeTeam: { id: '1', abbreviation: 'BOS', name: 'Celtics', score: 78, primaryColor: '#007A33' },
    awayTeam: { id: '4', abbreviation: 'NYK', name: 'Knicks', score: 72, primaryColor: '#006BB6' },
    arena: 'TD Garden', isPlayoff: false,
    featuredRun: FEATURED_RUN,
  },
  {
    id: '2', date: '2026-04-06', status: 'live', period: '2nd', clock: '1:18',
    homeTeam: { id: '10', abbreviation: 'LAL', name: 'Lakers', score: 52, primaryColor: '#552583' },
    awayTeam: { id: '11', abbreviation: 'GSW', name: 'Warriors', score: 58, primaryColor: '#1D428A' },
    arena: 'Crypto.com Arena', isPlayoff: false,
  },
  {
    id: '3', date: '2026-04-06', status: 'scheduled', period: '', clock: '7:30 PM ET',
    homeTeam: { id: '2', abbreviation: 'OKC', name: 'Thunder', score: 0, primaryColor: '#007AC1' },
    awayTeam: { id: '5', abbreviation: 'DEN', name: 'Nuggets', score: 0, primaryColor: '#0E2240' },
    arena: 'Paycom Center', isPlayoff: false,
  },
  {
    id: '4', date: '2026-04-06', status: 'scheduled', period: '', clock: '8:00 PM ET',
    homeTeam: { id: '6', abbreviation: 'MIN', name: 'Timberwolves', score: 0, primaryColor: '#0C2340' },
    awayTeam: { id: '8', abbreviation: 'DAL', name: 'Mavericks', score: 0, primaryColor: '#00538C' },
    arena: 'Target Center', isPlayoff: false,
  },
  {
    id: '5', date: '2026-04-05', status: 'final', period: 'Final', clock: '',
    homeTeam: { id: '3', abbreviation: 'CLE', name: 'Cavaliers', score: 112, primaryColor: '#860038' },
    awayTeam: { id: '7', abbreviation: 'MIL', name: 'Bucks', score: 108, primaryColor: '#00471B' },
    arena: 'Rocket Mortgage FieldHouse', isPlayoff: false,
  },
  {
    id: '6', date: '2026-04-05', status: 'final', period: 'Final', clock: '',
    homeTeam: { id: '9', abbreviation: 'IND', name: 'Pacers', score: 128, primaryColor: '#002D62' },
    awayTeam: { id: '12', abbreviation: 'MIA', name: 'Heat', score: 121, primaryColor: '#98002E' },
    arena: 'Gainbridge Fieldhouse', isPlayoff: false,
  },
  {
    id: '7', date: '2026-04-04', status: 'final', period: 'Final/OT', clock: '',
    homeTeam: { id: '8', abbreviation: 'DAL', name: 'Mavericks', score: 135, primaryColor: '#00538C' },
    awayTeam: { id: '2', abbreviation: 'OKC', name: 'Thunder', score: 132, primaryColor: '#007AC1' },
    arena: 'American Airlines Center', isPlayoff: false,
  },
  {
    id: '8', date: '2026-04-04', status: 'final', period: 'Final', clock: '',
    homeTeam: { id: '4', abbreviation: 'NYK', name: 'Knicks', score: 105, primaryColor: '#006BB6' },
    awayTeam: { id: '10', abbreviation: 'LAL', name: 'Lakers', score: 98, primaryColor: '#552583' },
    arena: 'Madison Square Garden', isPlayoff: false,
  },
];

export const BOX_SCORE_HOME: BoxScorePlayer[] = [
  { playerId: '101', name: 'J. Tatum', position: 'SF', minutes: '28:15', points: 24, rebounds: 7, offensiveRebounds: 1, defensiveRebounds: 6, assists: 5, steals: 1, blocks: 1, turnovers: 2, fgm: 9, fga: 18, tpm: 3, tpa: 7, ftm: 3, fta: 4, plusMinus: 8, isStarter: true },
  { playerId: '102', name: 'J. Brown', position: 'SG', minutes: '26:40', points: 19, rebounds: 4, offensiveRebounds: 0, defensiveRebounds: 4, assists: 3, steals: 2, blocks: 0, turnovers: 1, fgm: 7, fga: 14, tpm: 2, tpa: 5, ftm: 3, fta: 3, plusMinus: 6, isStarter: true },
  { playerId: '103', name: 'K. Porzingis', position: 'C', minutes: '24:30', points: 15, rebounds: 8, offensiveRebounds: 3, defensiveRebounds: 5, assists: 1, steals: 0, blocks: 3, turnovers: 1, fgm: 6, fga: 11, tpm: 2, tpa: 4, ftm: 1, fta: 2, plusMinus: 10, isStarter: true },
  { playerId: '104', name: 'D. White', position: 'PG', minutes: '25:18', points: 12, rebounds: 3, offensiveRebounds: 0, defensiveRebounds: 3, assists: 6, steals: 2, blocks: 1, turnovers: 2, fgm: 5, fga: 10, tpm: 2, tpa: 5, ftm: 0, fta: 0, plusMinus: 4, isStarter: true },
  { playerId: '105', name: 'A. Horford', position: 'PF', minutes: '22:05', points: 8, rebounds: 6, offensiveRebounds: 2, defensiveRebounds: 4, assists: 3, steals: 1, blocks: 1, turnovers: 0, fgm: 3, fga: 7, tpm: 1, tpa: 3, ftm: 1, fta: 2, plusMinus: 5, isStarter: true },
];

export const BOX_SCORE_AWAY: BoxScorePlayer[] = [
  { playerId: '201', name: 'J. Brunson', position: 'PG', minutes: '29:10', points: 22, rebounds: 3, offensiveRebounds: 0, defensiveRebounds: 3, assists: 7, steals: 1, blocks: 0, turnovers: 3, fgm: 8, fga: 17, tpm: 3, tpa: 6, ftm: 3, fta: 4, plusMinus: -4, isStarter: true },
  { playerId: '202', name: 'J. Hart', position: 'SG', minutes: '27:45', points: 14, rebounds: 8, offensiveRebounds: 2, defensiveRebounds: 6, assists: 4, steals: 1, blocks: 1, turnovers: 1, fgm: 5, fga: 11, tpm: 2, tpa: 5, ftm: 2, fta: 2, plusMinus: -2, isStarter: true },
  { playerId: '203', name: 'J. Randle', position: 'PF', minutes: '26:00', points: 18, rebounds: 6, offensiveRebounds: 1, defensiveRebounds: 5, assists: 2, steals: 0, blocks: 0, turnovers: 2, fgm: 7, fga: 15, tpm: 1, tpa: 4, ftm: 3, fta: 4, plusMinus: -6, isStarter: true },
  { playerId: '204', name: 'OG Anunoby', position: 'SF', minutes: '25:20', points: 11, rebounds: 4, offensiveRebounds: 1, defensiveRebounds: 3, assists: 1, steals: 2, blocks: 1, turnovers: 1, fgm: 4, fga: 9, tpm: 2, tpa: 4, ftm: 1, fta: 2, plusMinus: -3, isStarter: true },
  { playerId: '205', name: 'M. Robinson', position: 'C', minutes: '18:30', points: 7, rebounds: 9, offensiveRebounds: 4, defensiveRebounds: 5, assists: 0, steals: 0, blocks: 2, turnovers: 1, fgm: 3, fga: 5, tpm: 0, tpa: 0, ftm: 1, fta: 2, plusMinus: -8, isStarter: true },
];

export function getGameById(id: string): Game | undefined {
  return GAMES.find(g => g.id === id);
}

export function getTodayGames(): Game[] {
  return GAMES.filter(g => g.date === '2026-04-06');
}

export function getRecentGames(): Game[] {
  return GAMES.filter(g => g.status === 'final');
}

export function getFeaturedGame(): Game | undefined {
  return GAMES.find(g => g.featuredRun?.isDramatic);
}
