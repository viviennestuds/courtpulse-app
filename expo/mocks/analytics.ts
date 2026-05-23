import { ScoringRun, ScoringDrought, LineupSegment, CustomMetric, ThresholdSplit } from '@/types';

export const SCORING_RUNS: ScoringRun[] = [
  {
    id: '1', teamId: '1', teamAbbr: 'BOS', teamColor: '#007A33',
    startEvent: 'J. Tatum 3PT Jump Shot', endEvent: 'D. White Fast Break Layup',
    startClock: '8:42', endClock: '5:18', period: 3,
    scoreChange: '58-54 \u2192 76-58', totalPoints: 18, opponentPoints: 4, netPoints: 14,
    playCount: 9, duration: '3:24',
    players: ['J. Tatum', 'J. Brown', 'K. Porzingis', 'D. White', 'A. Horford'],
    keyPlay: 'Porzingis blocked Brunson at the rim, Tatum pushed for a thunderous dunk to cap an 18-4 run',
    isDramatic: true,
  },
  {
    id: '2', teamId: '4', teamAbbr: 'NYK', teamColor: '#006BB6',
    startEvent: 'OG Anunoby 3PT', endEvent: 'J. Brunson Pull-Up 3PT',
    startClock: '4:55', endClock: '3:12', period: 3,
    scoreChange: '76-60 \u2192 76-69', totalPoints: 9, opponentPoints: 0, netPoints: 9,
    playCount: 4, duration: '1:43',
    players: ['J. Brunson', 'OG Anunoby', 'J. Randle', 'J. Hart', 'M. Robinson'],
    keyPlay: 'Brunson pull-up 3PT cut the lead to 7 and forced a Boston timeout',
    isDramatic: false,
  },
  {
    id: '3', teamId: '1', teamAbbr: 'BOS', teamColor: '#007A33',
    startEvent: 'D. White Steal + Layup', endEvent: 'J. Tatum Mid-Range',
    startClock: '11:12', endClock: '9:30', period: 2,
    scoreChange: '32-30 \u2192 40-30', totalPoints: 8, opponentPoints: 0, netPoints: 8,
    playCount: 4, duration: '1:42',
    players: ['J. Tatum', 'J. Brown', 'K. Porzingis', 'D. White', 'A. Horford'],
    keyPlay: 'D. White steal sparked transition scoring and forced NYK timeout',
    isDramatic: false,
  },
];

export const SCORING_DROUGHTS: ScoringDrought[] = [
  {
    id: 'd1', teamId: '4', teamAbbr: 'NYK',
    startClock: '8:42', endClock: '5:18', period: 3,
    duration: '3:24', opponentPoints: 18,
    players: ['J. Brunson', 'J. Randle', 'OG Anunoby', 'J. Hart', 'M. Robinson'],
  },
  {
    id: 'd2', teamId: '1', teamAbbr: 'BOS',
    startClock: '4:55', endClock: '3:12', period: 3,
    duration: '1:43', opponentPoints: 9,
    players: ['J. Tatum', 'J. Brown', 'D. White', 'A. Horford', 'P. Pritchard'],
  },
];

export const LINEUP_SEGMENTS: LineupSegment[] = [
  { id: '1', teamId: '1', players: ['J. Tatum', 'J. Brown', 'K. Porzingis', 'D. White', 'A. Horford'], minutes: 18.5, plusMinus: 14, offRating: 128.5, defRating: 105.2, netRating: 23.3, points: 42, pointsAllowed: 28, isLowLeverage: false },
  { id: '2', teamId: '1', players: ['J. Tatum', 'J. Brown', 'D. White', 'A. Horford', 'P. Pritchard'], minutes: 8.2, plusMinus: 4, offRating: 118.2, defRating: 112.5, netRating: 5.7, points: 18, pointsAllowed: 14, isLowLeverage: false },
  { id: '3', teamId: '1', players: ['P. Pritchard', 'S. Hauser', 'L. Kornet', 'J. Brown', 'D. White'], minutes: 5.8, plusMinus: -4, offRating: 98.5, defRating: 118.3, netRating: -19.8, points: 8, pointsAllowed: 12, isLowLeverage: false },
  { id: '4', teamId: '4', players: ['J. Brunson', 'J. Hart', 'OG Anunoby', 'J. Randle', 'M. Robinson'], minutes: 16.2, plusMinus: -6, offRating: 108.5, defRating: 115.8, netRating: -7.3, points: 32, pointsAllowed: 38, isLowLeverage: false },
  { id: '5', teamId: '4', players: ['J. Brunson', 'OG Anunoby', 'J. Randle', 'D. DiVincenzo', 'I. Hartenstein'], minutes: 10.5, plusMinus: 2, offRating: 115.2, defRating: 110.8, netRating: 4.4, points: 22, pointsAllowed: 20, isLowLeverage: false },
];

export const CUSTOM_METRICS: CustomMetric[] = [
  {
    id: '1', name: 'Run Participation Rate', shortName: 'RPR',
    value: 72.5, unit: '%',
    description: 'Percent of a team\'s positive scoring runs in which a player was on the floor. A high RPR indicates a player who consistently anchors the lineup during momentum swings.',
    formula: '(Positive Runs w/ Player On Floor) / (Total Team Positive Runs) \u00d7 100',
    category: 'impact', trend: 'up', percentile: 88, source: 'derived',
    playerName: 'J. Tatum', teamAbbr: 'BOS',
  },
  {
    id: '2', name: 'Lineup Swing Value', shortName: 'LSV',
    value: 8.4, unit: 'per 100',
    description: 'Change in score margin per 100 possessions during a lineup segment compared with the team\'s baseline in the same game. Positive = outperformed the rest of the team.',
    formula: '(Lineup Net Pts / Lineup Poss \u00d7 100) \u2212 (Team Baseline Net / Baseline Poss \u00d7 100)',
    category: 'impact', trend: 'up', percentile: 92, source: 'derived',
    playerName: 'J. Tatum', teamAbbr: 'BOS',
  },
  {
    id: '3', name: 'Context Shot Diet Shift', shortName: 'CSDS',
    value: 14.6, unit: '\u0394%',
    description: 'How a player\'s shot distribution changes in clutch vs non-clutch. A high CSDS indicates shot selection adapts under pressure \u2014 more mid-range pull-ups, fewer contested threes, etc.',
    formula: '\u03a3|Zone% in Context A \u2212 Zone% in Context B| / Number of Zones',
    category: 'offensive', trend: 'up', percentile: 71, source: 'derived',
    playerName: 'J. Brunson', teamAbbr: 'NYK',
  },
  {
    id: '4', name: 'Threshold Trigger Record', shortName: 'TTR',
    value: 78.3, unit: '% W',
    description: 'Team record when a chosen stat crosses a defined band. Example: win rate when AST% exceeds 60% or TOV% drops below 12%.',
    formula: 'Wins(Stat \u2265 or \u2264 Threshold) / Games(Stat \u2265 or \u2264 Threshold) \u00d7 100',
    category: 'context', trend: 'up', percentile: 85, source: 'derived',
    teamAbbr: 'BOS',
  },
  {
    id: '5', name: 'Run Creation Index', shortName: 'RCI',
    value: 6.8, unit: 'idx',
    description: 'Composite score combining scoring, assists, stops, forced turnovers, and lineup context during runs. Weights each action by run impact. Higher = more responsible for creating and sustaining runs.',
    formula: '(Run PTS \u00d7 1.0 + Run AST \u00d7 1.5 + Run STL \u00d7 2.0 + Run BLK \u00d7 1.5 + Run TOV Forced \u00d7 1.8) / Run Poss \u00d7 LSV Factor',
    category: 'impact', trend: 'up', percentile: 90, source: 'derived',
    playerName: 'J. Tatum', teamAbbr: 'BOS',
  },
  {
    id: '6', name: 'Drought Impact', shortName: 'DI',
    value: -4.2, unit: 'net',
    description: 'Team performance during scoring droughts when this player is on floor. Measures how much the team suffers during cold stretches with the player in the lineup.',
    formula: 'Avg(Opponent Pts During Drought) \u2212 Expected Opp Pts \u00d7 (Player Minutes in Drought / Total Drought Minutes)',
    category: 'defensive', trend: 'down', percentile: 35, source: 'derived',
    playerName: 'J. Randle', teamAbbr: 'NYK',
  },
];

export const THRESHOLD_SPLITS: ThresholdSplit[] = [
  { id: '1', metric: 'Usage Rate', operator: 'above', threshold: 30, gamesPlayed: 28, wins: 22, losses: 6, avgPoints: 31.2, avgRebounds: 8.5, avgAssists: 5.8, netRating: 9.4 },
  { id: '2', metric: 'Usage Rate', operator: 'below', threshold: 25, gamesPlayed: 18, wins: 12, losses: 6, avgPoints: 18.5, avgRebounds: 7.2, avgAssists: 4.1, netRating: 3.2 },
  { id: '3', metric: 'Minutes', operator: 'above', threshold: 35, gamesPlayed: 42, wins: 34, losses: 8, avgPoints: 28.4, avgRebounds: 8.8, avgAssists: 5.5, netRating: 8.8 },
  { id: '4', metric: 'Points', operator: 'above', threshold: 30, gamesPlayed: 22, wins: 18, losses: 4, avgPoints: 34.8, avgRebounds: 8.2, avgAssists: 5.2, netRating: 11.5 },
  { id: '5', metric: 'FG%', operator: 'above', threshold: 50, gamesPlayed: 30, wins: 25, losses: 5, avgPoints: 29.5, avgRebounds: 8.9, avgAssists: 5.6, netRating: 10.2 },
  { id: '6', metric: 'FG%', operator: 'below', threshold: 40, gamesPlayed: 12, wins: 5, losses: 7, avgPoints: 19.8, avgRebounds: 7.1, avgAssists: 4.8, netRating: -3.5 },
];
