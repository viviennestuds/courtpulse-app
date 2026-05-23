import { PlayByPlayEvent } from '@/types';

export const PLAY_BY_PLAY: PlayByPlayEvent[] = [
  { id: '1', period: 3, clock: '11:42', eventType: 'score', description: 'J. Tatum 3PT Jump Shot (21 PTS)', teamId: '1', teamAbbr: 'BOS', playerId: '101', playerName: 'J. Tatum', homeScore: 58, awayScore: 54, scoreDelta: 3, isClutch: false },
  { id: '2', period: 3, clock: '11:18', eventType: 'turnover', description: 'J. Brunson Bad Pass Turnover', teamId: '4', teamAbbr: 'NYK', playerId: '201', playerName: 'J. Brunson', homeScore: 58, awayScore: 54, isClutch: false },
  { id: '3', period: 3, clock: '11:02', eventType: 'score', description: 'J. Brown Layup (17 PTS)', teamId: '1', teamAbbr: 'BOS', playerId: '102', playerName: 'J. Brown', homeScore: 60, awayScore: 54, scoreDelta: 2, isClutch: false },
  { id: '4', period: 3, clock: '10:45', eventType: 'foul', description: 'D. White Personal Foul (P2)', teamId: '1', teamAbbr: 'BOS', playerId: '104', playerName: 'D. White', homeScore: 60, awayScore: 54, isClutch: false },
  { id: '5', period: 3, clock: '10:42', eventType: 'score', description: 'J. Brunson FT 1 of 2 (19 PTS)', teamId: '4', teamAbbr: 'NYK', playerId: '201', playerName: 'J. Brunson', homeScore: 60, awayScore: 55, scoreDelta: 1, isClutch: false },
  { id: '6', period: 3, clock: '10:42', eventType: 'score', description: 'J. Brunson FT 2 of 2 (20 PTS)', teamId: '4', teamAbbr: 'NYK', playerId: '201', playerName: 'J. Brunson', homeScore: 60, awayScore: 56, scoreDelta: 1, isClutch: false },
  { id: '7', period: 3, clock: '10:20', eventType: 'rebound', description: 'A. Horford Defensive Rebound', teamId: '1', teamAbbr: 'BOS', playerId: '105', playerName: 'A. Horford', homeScore: 60, awayScore: 56, isClutch: false },
  { id: '8', period: 3, clock: '10:05', eventType: 'score', description: 'K. Porzingis 3PT Jump Shot (12 PTS)', teamId: '1', teamAbbr: 'BOS', playerId: '103', playerName: 'K. Porzingis', homeScore: 63, awayScore: 56, scoreDelta: 3, isClutch: false },
  { id: '9', period: 3, clock: '9:48', eventType: 'timeout', description: 'NYK Full Timeout', teamId: '4', teamAbbr: 'NYK', homeScore: 63, awayScore: 56, isClutch: false },
  { id: '10', period: 3, clock: '9:30', eventType: 'score', description: 'J. Randle Turnaround Jumper (16 PTS)', teamId: '4', teamAbbr: 'NYK', playerId: '203', playerName: 'J. Randle', homeScore: 63, awayScore: 58, scoreDelta: 2, isClutch: false },
  { id: '11', period: 3, clock: '9:12', eventType: 'steal', description: 'D. White Steal', teamId: '1', teamAbbr: 'BOS', playerId: '104', playerName: 'D. White', homeScore: 63, awayScore: 58, isClutch: false },
  { id: '12', period: 3, clock: '9:05', eventType: 'score', description: 'D. White Fast Break Layup (10 PTS)', teamId: '1', teamAbbr: 'BOS', playerId: '104', playerName: 'D. White', homeScore: 65, awayScore: 58, scoreDelta: 2, isClutch: false },
  { id: '13', period: 3, clock: '8:42', eventType: 'block', description: 'K. Porzingis Block on Brunson', teamId: '1', teamAbbr: 'BOS', playerId: '103', playerName: 'K. Porzingis', homeScore: 65, awayScore: 58, isClutch: false },
  { id: '14', period: 3, clock: '8:30', eventType: 'score', description: 'J. Tatum Dunk in Transition (24 PTS)', teamId: '1', teamAbbr: 'BOS', playerId: '101', playerName: 'J. Tatum', homeScore: 67, awayScore: 58, scoreDelta: 2, isClutch: false },
  { id: '15', period: 3, clock: '8:15', eventType: 'substitution', description: 'NYK: D. DiVincenzo in for J. Hart', teamId: '4', teamAbbr: 'NYK', homeScore: 67, awayScore: 58, isClutch: false },
  { id: '16', period: 3, clock: '7:55', eventType: 'miss', description: 'OG Anunoby 3PT Miss', teamId: '4', teamAbbr: 'NYK', playerId: '204', playerName: 'OG Anunoby', homeScore: 67, awayScore: 58, isClutch: false },
  { id: '17', period: 3, clock: '7:40', eventType: 'score', description: 'J. Brown 3PT (22 PTS)', teamId: '1', teamAbbr: 'BOS', playerId: '102', playerName: 'J. Brown', homeScore: 70, awayScore: 58, scoreDelta: 3, isClutch: false },
  { id: '18', period: 3, clock: '7:15', eventType: 'score', description: 'J. Brunson Pull-Up Mid-Range (22 PTS)', teamId: '4', teamAbbr: 'NYK', playerId: '201', playerName: 'J. Brunson', homeScore: 70, awayScore: 60, scoreDelta: 2, isClutch: false },
  { id: '19', period: 3, clock: '6:50', eventType: 'foul', description: 'J. Randle Offensive Foul', teamId: '4', teamAbbr: 'NYK', playerId: '203', playerName: 'J. Randle', homeScore: 70, awayScore: 60, isClutch: false },
  { id: '20', period: 3, clock: '6:30', eventType: 'score', description: 'A. Horford Hook Shot (10 PTS)', teamId: '1', teamAbbr: 'BOS', playerId: '105', playerName: 'A. Horford', homeScore: 72, awayScore: 60, scoreDelta: 2, isClutch: false },
];
