import { Team } from '@/types';

export const TEAMS: Team[] = [
  { id: '1', name: 'Celtics', abbreviation: 'BOS', city: 'Boston', conference: 'East', division: 'Atlantic', wins: 58, losses: 18, logo: '☘️', primaryColor: '#007A33', secondaryColor: '#BA9653', offRating: 122.2, defRating: 110.1, netRating: 12.1, pace: 100.3 },
  { id: '2', name: 'Thunder', abbreviation: 'OKC', city: 'Oklahoma City', conference: 'West', division: 'Northwest', wins: 57, losses: 19, logo: '⚡', primaryColor: '#007AC1', secondaryColor: '#EF6100', offRating: 121.5, defRating: 109.8, netRating: 11.7, pace: 99.8 },
  { id: '3', name: 'Cavaliers', abbreviation: 'CLE', city: 'Cleveland', conference: 'East', division: 'Central', wins: 55, losses: 21, logo: '⚔️', primaryColor: '#860038', secondaryColor: '#FDBB30', offRating: 120.8, defRating: 110.5, netRating: 10.3, pace: 98.5 },
  { id: '4', name: 'Knicks', abbreviation: 'NYK', city: 'New York', conference: 'East', division: 'Atlantic', wins: 52, losses: 24, logo: '🏙️', primaryColor: '#006BB6', secondaryColor: '#F58426', offRating: 119.5, defRating: 111.2, netRating: 8.3, pace: 99.1 },
  { id: '5', name: 'Nuggets', abbreviation: 'DEN', city: 'Denver', conference: 'West', division: 'Northwest', wins: 50, losses: 26, logo: '⛏️', primaryColor: '#0E2240', secondaryColor: '#FEC524', offRating: 118.9, defRating: 112.0, netRating: 6.9, pace: 97.8 },
  { id: '6', name: 'Timberwolves', abbreviation: 'MIN', city: 'Minnesota', conference: 'West', division: 'Northwest', wins: 49, losses: 27, logo: '🐺', primaryColor: '#0C2340', secondaryColor: '#236192', offRating: 115.8, defRating: 108.2, netRating: 7.6, pace: 97.2 },
  { id: '7', name: 'Bucks', abbreviation: 'MIL', city: 'Milwaukee', conference: 'East', division: 'Central', wins: 48, losses: 28, logo: '🦌', primaryColor: '#00471B', secondaryColor: '#EEE1C6', offRating: 118.2, defRating: 112.8, netRating: 5.4, pace: 101.2 },
  { id: '8', name: 'Mavericks', abbreviation: 'DAL', city: 'Dallas', conference: 'West', division: 'Southwest', wins: 47, losses: 29, logo: '🐴', primaryColor: '#00538C', secondaryColor: '#B8C4CA', offRating: 117.5, defRating: 112.5, netRating: 5.0, pace: 98.9 },
  { id: '9', name: 'Pacers', abbreviation: 'IND', city: 'Indiana', conference: 'East', division: 'Central', wins: 46, losses: 30, logo: '🏎️', primaryColor: '#002D62', secondaryColor: '#FDBB30', offRating: 122.0, defRating: 117.5, netRating: 4.5, pace: 103.5 },
  { id: '10', name: 'Lakers', abbreviation: 'LAL', city: 'Los Angeles', conference: 'West', division: 'Pacific', wins: 44, losses: 32, logo: '💜', primaryColor: '#552583', secondaryColor: '#FDB927', offRating: 116.8, defRating: 113.2, netRating: 3.6, pace: 99.5 },
  { id: '11', name: 'Warriors', abbreviation: 'GSW', city: 'Golden State', conference: 'West', division: 'Pacific', wins: 43, losses: 33, logo: '🌉', primaryColor: '#1D428A', secondaryColor: '#FFC72C', offRating: 117.2, defRating: 114.0, netRating: 3.2, pace: 100.8 },
  { id: '12', name: 'Heat', abbreviation: 'MIA', city: 'Miami', conference: 'East', division: 'Southeast', wins: 42, losses: 34, logo: '🔥', primaryColor: '#98002E', secondaryColor: '#F9A01B', offRating: 114.5, defRating: 112.0, netRating: 2.5, pace: 96.8 },
];

export function getTeamById(id: string): Team | undefined {
  return TEAMS.find(t => t.id === id);
}

export function getTeamByAbbr(abbr: string): Team | undefined {
  return TEAMS.find(t => t.abbreviation === abbr);
}
