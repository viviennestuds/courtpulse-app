export interface Team {
  id: string;
  name: string;
  abbreviation: string;
  city: string;
  conference: 'East' | 'West';
  division: string;
  wins: number;
  losses: number;
  logo: string;
  primaryColor: string;
  secondaryColor: string;
  offRating: number;
  defRating: number;
  netRating: number;
  pace: number;
  headToHeadRecord?: string;
  last5Record?: string;
  last10Record?: string;
  playoffSeriesScore?: string;
  fastbreakPoints?: number;
  transitionFrequency?: number;
  clutchNetRating?: number;
}

export interface Player {
  id: string;
  name: string;
  teamId: string;
  teamAbbr: string;
  position: string;
  number: string;
  height: string;
  weight: string;
  age: number;
  photo: string;
  ppg: number;
  rpg: number;
  apg: number;
  spg: number;
  bpg: number;
  fgPct: number;
  threePct: number;
  ftPct: number;
  mpg: number;
  usgRate: number;
  per: number;
  tsPct: number;
}

export interface Game {
  id: string;
  date: string;
  status: 'live' | 'final' | 'scheduled';
  period: string;
  clock: string;
  homeTeam: GameTeam;
  awayTeam: GameTeam;
  arena: string;
  attendance?: number;
  isPlayoff: boolean;
  seriesGameNumber?: string;
  seriesText?: string;
  featuredRun?: ScoringRun;
}

export interface GameTeam {
  id: string;
  abbreviation: string;
  name: string;
  score: number;
  primaryColor: string;
}

export interface BoxScorePlayer {
  playerId: string;
  name: string;
  position: string;
  minutes: string;
  points: number;
  rebounds: number;
  offensiveRebounds: number;
  defensiveRebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
  fgm: number;
  fga: number;
  tpm: number;
  tpa: number;
  ftm: number;
  fta: number;
  plusMinus: number;
  isStarter: boolean;
}

export interface PlayByPlayEvent {
  id: string;
  period: number;
  clock: string;
  eventType: 'score' | 'turnover' | 'foul' | 'substitution' | 'rebound' | 'timeout' | 'block' | 'steal' | 'miss';
  description: string;
  teamId: string;
  teamAbbr: string;
  playerId?: string;
  playerName?: string;
  assistPlayerId?: string;
  assistPlayerName?: string;
  involvedPlayerIds?: string[];
  homeScore: number;
  awayScore: number;
  scoreDelta?: number;
  isClutch: boolean;
}

export interface ShotEvent {
  id: string;
  playerId: string;
  playerName: string;
  teamId: string;
  x: number;
  y: number;
  made: boolean;
  shotType: string;
  distance: number;
  period: number;
  clock: string;
  points: number;
}

export interface ScoringRun {
  id: string;
  teamId: string;
  teamAbbr: string;
  teamColor: string;
  startEvent: string;
  endEvent: string;
  startClock: string;
  endClock: string;
  period: number;
  scoreChange: string;
  totalPoints: number;
  opponentPoints: number;
  netPoints: number;
  playCount: number;
  duration: string;
  players: string[];
  keyPlay: string;
  isDramatic: boolean;
  lineupContext?: StretchLineupContext;
  contextStats?: StretchContextStats;
  highlightText?: string;
}

export interface DroughtLineupContext {
  primaryLineup: string[];
  primaryLineupMinuteShare: number;
  substitutionCount: number;
  phases?: DroughtLineupPhase[];
}

export interface DroughtLineupPhase {
  players: string[];
  startClock: string;
  endClock: string;
  durationSeconds: number;
  period?: number;
  events?: StretchPhaseEvent[];
}

export type StretchMode = 'run' | 'drought';

export type StretchPhaseEventKind =
  | 'made_fg'
  | 'missed_fg'
  | 'made_ft'
  | 'missed_ft'
  | 'turnover'
  | 'timeout'
  | 'steal'
  | 'block'
  | 'offensive_rebound'
  | 'assist';

export interface StretchPhaseEvent {
  kind: StretchPhaseEventKind;
  period: number;
  clock: string;
  playerName?: string;
  assisterName?: string;
  points?: number;
  description: string;
}

export interface StretchLineupContext {
  primaryLineup: string[];
  primaryLineupMinuteShare: number;
  substitutionCount: number;
  phases?: DroughtLineupPhase[];
}

export interface StretchContextStats {
  points: number;
  fga: number;
  fgm: number;
  fta: number;
  ftm: number;
  assists: number;
  turnovers: number;
  offensiveRebounds: number;
  ppo: number | null;
  astToRatio: number | null;
  playFinishers: { name: string; points: number; share: number }[];
}

export interface ScoringDrought {
  id: string;
  teamId: string;
  teamAbbr: string;
  startClock: string;
  endClock: string;
  period: number;
  duration: string;
  opponentPoints: number;
  players: string[];
  lineupContext?: DroughtLineupContext;
  endingEvent?: DroughtEndingEvent;
  contextStats?: StretchContextStats;
  highlightText?: string;
}

export interface DroughtEndingEvent {
  description: string;
  playerName: string;
  points: number;
  shotType: string;
}

export interface LineupSegment {
  id: string;
  teamId: string;
  players: string[];
  minutes: number;
  plusMinus: number;
  offRating: number;
  defRating: number;
  netRating: number;
  points: number;
  pointsAllowed: number;
  isLowLeverage: boolean;
  stints?: LineupStint[];
}

export interface LineupStint {
  period: number;
  startClock: string;
  endClock: string;
  minutes: number;
  plusMinus: number;
}

export interface CustomMetric {
  id: string;
  name: string;
  shortName: string;
  value: number;
  unit: string;
  description: string;
  formula: string;
  category: 'offensive' | 'defensive' | 'impact' | 'context';
  trend: 'up' | 'down' | 'neutral';
  percentile: number;
  source: 'derived' | 'direct';
  playerName?: string;
  teamAbbr?: string;
}

export interface ThresholdSplit {
  id: string;
  metric: string;
  operator: 'above' | 'below';
  threshold: number;
  gamesPlayed: number;
  wins: number;
  losses: number;
  avgPoints: number;
  avgRebounds: number;
  avgAssists: number;
  netRating: number;
}

export interface RunTimelineEntry {
  period: number;
  clock: string;
  homeScore: number;
  awayScore: number;
  runId?: string;
  droughtId?: string;
}

export interface MatchupPlayerPair {
  home: MatchupPlayer;
  away: MatchupPlayer;
}

export interface MatchupPlayer {
  playerId: string;
  name: string;
  position: string;
  points: number;
  usage: number;
  tsPct: number;
  assists: number;
  rebounds: number;
  mpg: number;
  runParticipation: number;
  runImpactScore: number;
  runTag: 'High Run Impact' | 'Primary Run Creator' | 'Low Run Involvement';
}

export interface TeamMatchupStats {
  teamId: string;
  abbreviation: string;
  name: string;
  primaryColor: string;
  record: string;
  netRating: number;
  offRating: number;
  defRating: number;
  ppg: number;
  apg: number;
  tov: number;
  tsPct: number;
}

export interface ContextualMatchup {
  offenseTeam: string;
  offenseAbbr: string;
  offenseColor: string;
  offRating: number;
  defenseTeam: string;
  defenseAbbr: string;
  defenseColor: string;
  defRating: number;
  edge: 'offense' | 'defense' | 'even';
  differential: number;
}

export interface MatchupEdgeSummary {
  offensiveEdge: string;
  defensiveEdge: string;
  overallEdge: string;
  overallTeamAbbr: string;
  overallTeamColor: string;
}

export interface PlayerOnCourtInterval {
  startGameTime: number;
  endGameTime: number;
  startPeriod: number;
  endPeriod: number;
  startClockSeconds: number;
  endClockSeconds: number;
  startHomeScore: number;
  startAwayScore: number;
  endHomeScore: number;
  endAwayScore: number;
}

export interface OnCourtDetailedStats {
  minutes: number;
  possessions: number;
  points: number;
  pointsAllowed: number;
  plusMinus: number;
  offRating: number;
  defRating: number;
  netRating: number;
  pointsPerPossession: number;

  fgm: number;
  fga: number;
  fgPct: number;
  tpm: number;
  tpa: number;
  tpPct: number;
  ftm: number;
  fta: number;
  ftPct: number;
  tsPct: number;

  assists: number;
  turnovers: number;
  forcedTurnovers: number;
  assistTurnoverRatio: number | null;
  steals: number;
  blocks: number;
  fastbreakPoints: number;

  offensiveRebounds: number;
  defensiveRebounds: number;
  totalRebounds: number;
  reboundPct: number;

  playFinishingShare: number | null;
  usageRate: number | null;

  oppFgm: number;
  oppFga: number;
  oppFgPct: number;
  oppTpm: number;
  oppTpa: number;
  oppTpPct: number;
  oppFtm: number;
  oppFta: number;
  oppFtPct: number;
  oppTsPct: number;
  oppPointsPerPossession: number;
  oppTurnovers: number;
  oppForcedTurnovers: number;
  oppSteals: number;
  oppBlocks: number;
  oppFastbreakPoints: number;
  oppOffensiveRebounds: number;
  oppDefensiveRebounds: number;
  oppTotalRebounds: number;
  oppReboundPct: number;
}

export type ConfidenceLevel = 'ultra_low' | 'low' | 'medium' | 'high';
export type OnOffConfidenceLevel = 'none' | 'low' | 'medium' | 'high';

export interface OnOffRatingStats {
  onMinutes: number;
  offMinutes: number;
  onPossessions: number;
  offPossessions: number;
  onPointsFor: number;
  onPointsAllowed: number;
  offPointsFor: number;
  offPointsAllowed: number;
  onOffensiveRating: number | null;
  onDefensiveRating: number | null;
  onNetRating: number | null;
  offOffensiveRating: number | null;
  offDefensiveRating: number | null;
  offNetRating: number | null;
  onOffRating: number | null;
  onOffConfidenceLevel: OnOffConfidenceLevel;
}

export interface OnCourtConfidence {
  confidenceLevel: ConfidenceLevel;
  onOffConfidenceLevel: OnOffConfidenceLevel;
}

export interface GameFlowContext {
  teamRunsCount: number;
  teamDroughtsCount: number;
  opponentRunsCount: number;
  opponentDroughtsCount: number;
}

export interface CanonicalOnCourtSummary {
  minutes: number;
  points: number;
  pointsAllowed: number;
  plusMinus: number;
  offRating: number;
  defRating: number;
  netRating: number;
  possessions: number;
  segmentCount: number;
  intervals: PlayerOnCourtInterval[];
}

export type PlusMinusMismatchCause =
  | 'same_clock_sub_ambiguity'
  | 'free_throw_sequence_ambiguity'
  | 'quarter_start_lineup_uncertainty'
  | 'missing_sub_event'
  | 'score_correction'
  | 'unknown';

export interface ReconciliationAudit {
  computedMinutes: number;
  boxScoreMinutes: number;
  minutesDelta: number;
  computedPlusMinus: number;
  boxScorePlusMinus: number;
  plusMinusDelta: number;
  intervalCount: number;
  hasGaps: boolean;
  hasOverlaps: boolean;
  gapSeconds: number;
  overlapSeconds: number;
  mismatchCauses: PlusMinusMismatchCause[];
  sameClockSubEvents: number;
  ftSequenceSubEvents: number;
  quarterStartAmbiguities: number;
}

export interface CanonicalTimelineSegment {
  period: number;
  startGameTime: number;
  endGameTime: number;
  startClockSeconds: number;
  endClockSeconds: number;
  players: string[];
  startHomeScore: number;
  startAwayScore: number;
  endHomeScore: number;
  endAwayScore: number;
}

export interface PlayerPerformanceStats {
  playerId: string;
  name: string;
  position: string;
  teamAbbr: string;

  minutes: number;
  points: number;
  rebounds: number;
  offensiveRebounds: number;
  defensiveRebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
  fouls: number;
  plusMinus: number;

  fgm: number;
  fga: number;
  fgPct: number;
  tpm: number;
  tpa: number;
  tpPct: number;
  ftm: number;
  fta: number;
  ftPct: number;
  tsPct: number | null;
  efgPct: number | null;

  usageRate: number | null;
  playFinishingShare: number | null;
  assistTurnoverRatio: number | null;
}

export interface TimelineIntegrityReport {
  teamId: string;
  totalSegments: number;
  totalCoveredSeconds: number;
  expectedGameSeconds: number;
  gapCount: number;
  gapTotalSeconds: number;
  overlapCount: number;
  overlapTotalSeconds: number;
  invalidLineupCount: number;
  playerMinutes: Record<string, number>;
  summaryPlusMinus: Record<string, number>;
}
