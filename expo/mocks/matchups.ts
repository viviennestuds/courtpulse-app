import { MatchupPlayerPair, TeamMatchupStats, ContextualMatchup, MatchupEdgeSummary } from '@/types';

export const MATCHUP_HOME_STATS: TeamMatchupStats = {
  teamId: '1',
  abbreviation: 'BOS',
  name: 'Celtics',
  primaryColor: '#007A33',
  record: '58-18',
  netRating: 12.1,
  offRating: 122.2,
  defRating: 110.1,
  ppg: 120.5,
  apg: 27.3,
  tov: 12.8,
  tsPct: 60.2,
};

export const MATCHUP_AWAY_STATS: TeamMatchupStats = {
  teamId: '4',
  abbreviation: 'NYK',
  name: 'Knicks',
  primaryColor: '#006BB6',
  record: '52-24',
  netRating: 8.3,
  offRating: 119.5,
  defRating: 111.2,
  ppg: 115.8,
  apg: 24.1,
  tov: 13.5,
  tsPct: 57.8,
};

export const CONTEXTUAL_MATCHUPS: ContextualMatchup[] = [
  {
    offenseTeam: 'Celtics',
    offenseAbbr: 'BOS',
    offenseColor: '#007A33',
    offRating: 122.2,
    defenseTeam: 'Knicks',
    defenseAbbr: 'NYK',
    defenseColor: '#006BB6',
    defRating: 111.2,
    edge: 'offense',
    differential: 11.0,
  },
  {
    offenseTeam: 'Knicks',
    offenseAbbr: 'NYK',
    offenseColor: '#006BB6',
    offRating: 119.5,
    defenseTeam: 'Celtics',
    defenseAbbr: 'BOS',
    defenseColor: '#007A33',
    defRating: 110.1,
    edge: 'offense',
    differential: 9.4,
  },
];

export const PLAYER_MATCHUPS: MatchupPlayerPair[] = [
  {
    home: {
      playerId: '104', name: 'D. White', position: 'PG',
      points: 12.8, usage: 19.5, tsPct: 58.2, assists: 5.1, rebounds: 3.8, mpg: 33.2,
      runParticipation: 68.0, runImpactScore: 5.4, runTag: 'High Run Impact',
    },
    away: {
      playerId: '201', name: 'J. Brunson', position: 'PG',
      points: 28.7, usage: 31.5, tsPct: 59.5, assists: 6.7, rebounds: 3.5, mpg: 35.4,
      runParticipation: 74.2, runImpactScore: 7.1, runTag: 'Primary Run Creator',
    },
  },
  {
    home: {
      playerId: '102', name: 'J. Brown', position: 'SG',
      points: 23.2, usage: 27.8, tsPct: 57.9, assists: 3.6, rebounds: 5.5, mpg: 34.8,
      runParticipation: 65.3, runImpactScore: 5.8, runTag: 'High Run Impact',
    },
    away: {
      playerId: '202', name: 'J. Hart', position: 'SG',
      points: 9.4, usage: 14.2, tsPct: 55.1, assists: 4.1, rebounds: 8.3, mpg: 34.5,
      runParticipation: 52.1, runImpactScore: 3.2, runTag: 'Low Run Involvement',
    },
  },
  {
    home: {
      playerId: '101', name: 'J. Tatum', position: 'SF',
      points: 27.1, usage: 30.2, tsPct: 60.8, assists: 4.9, rebounds: 8.1, mpg: 35.8,
      runParticipation: 72.5, runImpactScore: 6.8, runTag: 'Primary Run Creator',
    },
    away: {
      playerId: '204', name: 'OG Anunoby', position: 'SF',
      points: 14.7, usage: 17.8, tsPct: 59.2, assists: 1.5, rebounds: 4.8, mpg: 34.1,
      runParticipation: 48.5, runImpactScore: 3.6, runTag: 'Low Run Involvement',
    },
  },
  {
    home: {
      playerId: '105', name: 'A. Horford', position: 'PF',
      points: 9.1, usage: 14.5, tsPct: 61.5, assists: 4.2, rebounds: 6.4, mpg: 29.5,
      runParticipation: 55.0, runImpactScore: 4.1, runTag: 'Low Run Involvement',
    },
    away: {
      playerId: '203', name: 'J. Randle', position: 'PF',
      points: 24.0, usage: 28.1, tsPct: 56.4, assists: 5.0, rebounds: 9.2, mpg: 35.1,
      runParticipation: 58.8, runImpactScore: 4.5, runTag: 'High Run Impact',
    },
  },
  {
    home: {
      playerId: '103', name: 'K. Porzingis', position: 'C',
      points: 20.1, usage: 24.3, tsPct: 65.1, assists: 1.9, rebounds: 7.2, mpg: 30.5,
      runParticipation: 62.8, runImpactScore: 5.9, runTag: 'High Run Impact',
    },
    away: {
      playerId: '205', name: 'M. Robinson', position: 'C',
      points: 8.5, usage: 10.2, tsPct: 68.4, assists: 0.8, rebounds: 8.9, mpg: 28.2,
      runParticipation: 40.2, runImpactScore: 2.8, runTag: 'Low Run Involvement',
    },
  },
];

export const EDGE_SUMMARY: MatchupEdgeSummary = {
  offensiveEdge: 'BOS leads in ORtg (+2.7), TS% (+2.4), and assists (+3.2). Their spacing creates cleaner looks against NYK\'s switching defense.',
  defensiveEdge: 'NYK slightly tighter at the point of attack, but BOS holds the DRtg edge (110.1 vs 111.2). Porzingis anchors rim protection.',
  overallEdge: 'Boston holds edges on both sides of the ball. Offensive firepower and elite defense give them a clear matchup advantage.',
  overallTeamAbbr: 'BOS',
  overallTeamColor: '#007A33',
};
