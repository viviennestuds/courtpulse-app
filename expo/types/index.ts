export * from './playersDirectory';

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
  ratingsAvailable?: boolean;
  recordAvailable?: boolean;
  overview?: TeamOverview;
  headToHeadRecord?: string;
  last5Record?: string;
  last10Record?: string;
  playoffSeriesScore?: string;
  fastbreakPoints?: number;
  transitionFrequency?: number;
  clutchNetRating?: number;
}

export interface TeamOverviewResponse {
  success: boolean;
  schemaVersion: 'teamsOverview.v2';
  type: 'teamsOverview';
  season: string;
  seasonType: string;
  partial: boolean;
  sourceStatus?: TeamOverviewSourceStatus;
  teamCount: number;
  teams: TeamOverview[];
  fetchedAt?: string;
  warnings?: string[];
  cache?: unknown;
  error?: string;
  message?: string;
}

export interface TeamOverviewSourceStatus {
  standings?: string;
  ratings?: string;
  traditionalDiagnostic?: string;
}

export interface TeamOverview {
  teamId: number | string;
  abbreviation: string;
  city: string;
  name: string;
  fullName: string;
  conference: 'East' | 'West' | string | null;
  division: string | null;
  standings: TeamStandingsSnapshot;
  ratings: TeamRatingsSnapshot;
  scoring: TeamScoringSnapshot;
  recordSplits: TeamRecordSplits;
  dataAvailability: TeamDataAvailability;
}

export interface TeamStandingsSnapshot {
  wins: number | null;
  losses: number | null;
  winPct: number | null;
  leagueRank: number | null;
  conferenceRank: number | null;
  divisionRank: number | null;
  gamesBackConference: number | null;
  gamesBackDivision: number | null;
  clinchIndicator: string | null;
  streak: string | null;
  last10: string | null;
  homeRecord: string | null;
  roadRecord: string | null;
}

export interface TeamRatingsSnapshot {
  offRating: number | null;
  defRating: number | null;
  netRating: number | null;
  pace: number | null;
}

export interface TeamScoringSnapshot {
  pointsPerGame: number | null;
  opponentPointsPerGame: number | null;
  plusMinusPerGame: number | null;
  totalPoints: number | null;
  opponentTotalPoints: number | null;
  totalPointDifferential: number | null;
}

export interface TeamRecordSplits {
  aheadAtHalf: string | null;
  behindAtHalf: string | null;
  tiedAtHalf: string | null;
  aheadAtThird: string | null;
  behindAtThird: string | null;
  tiedAtThird: string | null;
  score100Plus: string | null;
  opponentScore100Plus: string | null;
  vsOppOver500: string | null;
  leadInFgPct: string | null;
  leadInRebounds: string | null;
  fewerTurnovers: string | null;
}

export interface TeamDataAvailability {
  standings: boolean;
  ratings: boolean;
  scoring: boolean;
  recordSplits: boolean;
  traditionalSource?: boolean;
  traditionalCoreStats?: boolean;
}

export interface TeamRosterResponse {
  success: boolean;
  schemaVersion: 'teamRoster.v2';
  type: 'teamRoster';
  season: string;
  teamId: number | string | null;
  partial?: boolean;
  players: TeamRosterPlayer[];
  fetchedAt?: string;
  warnings?: string[];
  cache?: unknown;
  error?: string;
  message?: string;
}

export interface TeamRosterPlayer {
  playerId: number | string;
  fullName: string;
  nickname: string | null;
  playerSlug: string | null;
  jersey: string | null;
  position: string | null;
  height: string | null;
  weight: string | null;
  birthDate: string | null;
  age: number | null;
  experience: string | null;
  school: string | null;
  country: string | null;
  howAcquired: string | null;
  acquisition: TeamRosterAcquisition | null;
  teamId: number | string | null;
  teamAbbreviation: string | null;
  season: string | null;
}

export interface TeamRosterAcquisition {
  raw: string | null;
  type: string | null;
  fromTeamAbbreviation: string | null;
  date: string | null;
  draftPick: number | null;
  draftYear: number | null;
}

export interface PlayersOverviewResponse {
  success: boolean;
  schemaVersion: 'playersOverview.v2';
  type: 'playersOverview';
  season: string;
  teamId: number | string | null;
  teamAbbreviation: string | null;
  rankScope: string | null;
  partial?: boolean;
  playerCount?: number;
  sourceStatus?: Record<string, string>;
  players: PlayerOverview[];
  fetchedAt?: string;
  warnings?: string[];
  cache?: unknown;
  error?: string;
  message?: string;
}

export interface PlayerOverview {
  playerId: number | string;
  fullName: string;
  nickname: string | null;
  teamId: number | string | null;
  teamAbbreviation: string | null;
  teamName: string | null;
  age: number | null;
  base: PlayerOverviewBaseStats;
  advanced: PlayerOverviewAdvancedStats;
  ranks: PlayerOverviewRanks;
  dataAvailability?: Record<string, boolean>;
}

export interface PlayerOverviewBaseStats {
  gamesPlayed: number | null;
  minutesPerGame: number | null;
  pointsPerGame: number | null;
  reboundsPerGame: number | null;
  assistsPerGame: number | null;
}

export interface PlayerOverviewAdvancedStats {
  possessions: number | null;
  trueShootingPct: number | null;
  usagePct: number | null;
  netRating: number | null;
}

export interface PlayerOverviewRanks {
  base?: {
    points?: number | null;
    rebounds?: number | null;
    assists?: number | null;
    minutes?: number | null;
  };
  advanced?: {
    trueShootingPct?: number | null;
    usagePct?: number | null;
    netRating?: number | null;
  };
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
  gameCode?: string;
  gameTimeUTC?: string;
  gameEt?: string;
  duration?: string;
  sellout?: boolean;
  seriesGameNumber?: string;
  gameLabel?: string;
  gameSubLabel?: string;
  seriesText?: string;
  ifNecessary?: boolean;
  officials?: StatsHydratedOfficial[];
  broadcasters?: StatsHydratedBroadcasters;
  availability?: StatsHydratedAvailability;
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
  pointsFastBreak?: number;
  pointsInThePaint?: number;
  pointsSecondChance?: number;
  personalFoulsDrawn?: number;
  blockedAttempts?: number;
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
  rawActionType?: string;
  rawSubType?: string;
  rawQualifiers?: string[];
  possessionTeamId?: string;
  isOfficialFastBreak?: boolean;
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

export interface NbaProxySourceCapabilities {
  source?: string | null;
  schemaVersion?: string | null;
  hasGameShell?: boolean;
  hasSummary?: boolean;
  hasScores?: boolean;
  hasTeamBoxScore?: boolean;
  hasPlayerBoxScore?: boolean;
  hasMisc?: boolean;
  hasAdvanced?: boolean;
  advancedTeamEstimatedFieldsQuarantined?: boolean;
  hasPlayByPlay?: boolean;
  hasShotFields?: boolean;
  hasShotCoordinates?: boolean;
  hasShotChart?: boolean;
  shotTelemetryVersion?: string | null;
  shotFieldCoverage?: unknown;
  optionalEnrichments?: Record<string, string | null | undefined> | null;
  usesStatsFallback?: boolean;
  usesCdn?: boolean;
  [key: string]: unknown;
}

export interface StatsHydrationCoreSources {
  summary?: string | null;
  traditional?: string | null;
  misc?: string | null;
  advanced?: string | null;
  playbyplay?: string | null;
  [key: string]: string | null | undefined;
}

export interface StatsGameHydrationResponse {
  success: boolean;
  type: 'statsGameHydration';
  gameId: string;
  schemaVersion?: string | null;
  source?: string | null;
  sourceStatus?: string | null;
  errorCategory?: string | null;
  noGamesConfirmed?: boolean;
  coreSources?: StatsHydrationCoreSources | null;
  sourceCapabilities?: NbaProxySourceCapabilities | null;
  game?: StatsHydratedGame | null;
  summary?: StatsHydratedSummary | null;
  boxscore?: StatsHydratedBoxScore | null;
  misc?: StatsHydratedMisc | null;
  advanced?: StatsHydratedAdvanced | null;
  playbyplay?: StatsHydratedPlayByPlay | null;
  attempts?: unknown;
  fetchedAt?: string;
  error?: string;
  message?: string;
}

export interface StatsRouteResponseBase {
  success: boolean;
  type: 'statsBoxScoreTraditionalV3' | 'statsPlayByPlayV3';
  gameId: string;
  source?: string | null;
  sourceStatus?: string | null;
  errorCategory?: string | null;
  noGamesConfirmed?: boolean;
  sourceCapabilities?: NbaProxySourceCapabilities | null;
  attempts?: unknown;
  fetchedAt?: string;
  error?: string;
  message?: string;
}

export interface StatsBoxScoreTraditionalV3Response extends StatsRouteResponseBase {
  type: 'statsBoxScoreTraditionalV3';
  boxscore?: StatsHydratedBoxScore | null;
}

export interface StatsPlayByPlayV3Response extends StatsRouteResponseBase {
  type: 'statsPlayByPlayV3';
  playbyplay?: StatsHydratedPlayByPlay | null;
}

export interface StatsHydratedGame {
  source?: string | null;
  gameId?: string | number | null;
  gameCode?: string | null;
  gameStatus?: string | number | null;
  gameStatusText?: string | null;
  period?: string | number | null;
  gameClock?: string | null;
  gameTimeUTC?: string | null;
  gameEt?: string | null;
  duration?: string | null;
  attendance?: string | number | null;
  sellout?: string | number | boolean | null;
  arena?: StatsHydratedArena | null;
  officials?: StatsHydratedOfficial[];
  broadcasters?: StatsHydratedBroadcasters | null;
  playoffContext?: StatsHydratedPlayoffContext | null;
  availability?: StatsHydratedAvailability | null;
  headlineStats?: StatsHydratedTeamPair | null;
  inferredFrom?: string | null;
  homeTeam?: StatsHydratedTeam | null;
  awayTeam?: StatsHydratedTeam | null;
}

export interface StatsHydratedArena {
  arenaId?: string | number | null;
  arenaName?: string | null;
  arenaCity?: string | null;
  arenaState?: string | null;
  arenaCountry?: string | null;
  arenaTimezone?: string | null;
}

export interface StatsHydratedOfficial {
  personId?: string | number | null;
  name?: string | null;
  nameI?: string | null;
  firstName?: string | null;
  familyName?: string | null;
  jerseyNum?: string | null;
  assignment?: string | null;
}

export interface StatsHydratedBroadcaster {
  broadcasterId?: string | number | null;
  broadcasterTeamId?: string | number | null;
  broadcasterDisplay?: string | null;
  broadcasterDescription?: string | null;
  broadcasterVideoLink?: string | null;
  regionId?: string | number | null;
}

export interface StatsHydratedBroadcasters {
  national?: StatsHydratedBroadcaster[];
  homeTv?: StatsHydratedBroadcaster[];
  awayTv?: StatsHydratedBroadcaster[];
  homeRadio?: StatsHydratedBroadcaster[];
  awayRadio?: StatsHydratedBroadcaster[];
  homeOtt?: StatsHydratedBroadcaster[];
  awayOtt?: StatsHydratedBroadcaster[];
  international?: StatsHydratedBroadcaster[];
  internationalOtt?: StatsHydratedBroadcaster[];
  internationalRadio?: StatsHydratedBroadcaster[];
}

export interface StatsHydratedPlayoffContext {
  seriesGameNumber?: string | null;
  gameLabel?: string | null;
  gameSubLabel?: string | null;
  seriesText?: string | null;
  ifNecessary?: boolean | null;
}

export interface StatsHydratedAvailability {
  videoAvailable?: boolean | null;
  playerTrackingAvailable?: boolean | null;
  playerTrackingXyzAvailable?: boolean | null;
  hustleAvailable?: boolean | null;
  [key: string]: string | number | boolean | null | undefined;
}

export interface StatsHydratedTeam {
  teamId?: string | number | null;
  teamCity?: string | null;
  teamName?: string | null;
  teamTricode?: string | null;
  teamSlug?: string | null;
  homeAway?: 'home' | 'away' | string | null;
  score?: string | number | null;
  teamWins?: string | number | null;
  teamLosses?: string | number | null;
  seed?: string | number | null;
  periods?: Array<{ period?: string | number | null; periodType?: string | null; score?: string | number | null }>;
}

export interface StatsHydratedTeamStats extends StatsHydratedTeam {
  stats?: Record<string, string | number | null | undefined>;
}

export interface StatsHydratedTeamPair {
  homeTeam?: StatsHydratedTeamStats | null;
  awayTeam?: StatsHydratedTeamStats | null;
  teams?: StatsHydratedTeamStats[];
}

export interface StatsHydratedSummary extends StatsHydratedPlayoffContext {
  source?: string | null;
  gameId?: string | number | null;
  gameCode?: string | null;
  gameStatus?: string | number | null;
  gameStatusText?: string | null;
  period?: string | number | null;
  gameClock?: string | null;
  gameTimeUTC?: string | null;
  gameEt?: string | null;
  duration?: string | null;
  attendance?: string | number | null;
  sellout?: string | number | boolean | null;
  arena?: StatsHydratedArena | null;
  officials?: StatsHydratedOfficial[];
  broadcasters?: StatsHydratedBroadcasters | null;
  availability?: StatsHydratedAvailability | null;
  homeTeam?: StatsHydratedTeam | null;
  awayTeam?: StatsHydratedTeam | null;
  postgameCharts?: StatsHydratedTeamPair | null;
  pregameCharts?: StatsHydratedTeamPair | null;
}

export interface StatsHydratedBoxScore {
  source?: string | null;
  gameId?: string | number | null;
  teamCount?: number | null;
  playerCount?: number | null;
  activePlayerCount?: number | null;
  dnpPlayerCount?: number | null;
  homeTeam?: StatsHydratedTeamBoxScore | null;
  awayTeam?: StatsHydratedTeamBoxScore | null;
  teams?: StatsHydratedTeamBoxScore[];
  players?: StatsHydratedPlayerBoxScore[];
}

export interface StatsHydratedTeamBoxScore extends StatsHydratedTeam {
  homeAway?: 'home' | 'away' | string | null;
  statistics?: Record<string, string | number | null | undefined>;
  stats?: Record<string, string | number | null | undefined>;
  starters?: unknown[];
  bench?: unknown[];
  minutes?: string | number | null;
}

export interface StatsHydratedPlayerBoxScore {
  personId?: string | number | null;
  playerId?: string | number | null;
  firstName?: string | null;
  familyName?: string | null;
  displayName?: string | null;
  name?: string | null;
  nameI?: string | null;
  playerSlug?: string | null;
  teamId?: string | number | null;
  teamCity?: string | null;
  teamName?: string | null;
  teamTricode?: string | null;
  homeAway?: 'home' | 'away' | string | null;
  position?: string | null;
  jerseyNum?: string | null;
  comment?: string | null;
  starter?: string | number | boolean | null;
  isStarter?: boolean | null;
  isActive?: boolean | null;
  status?: string | null;
  played?: string | number | boolean | null;
  minutes?: string | number | null;
  statistics?: Record<string, string | number | null | undefined>;
  stats?: Record<string, string | number | null | undefined>;
}

export interface StatsHydratedMisc {
  source?: string | null;
  gameId?: string | number | null;
  teamCount?: number | null;
  playerCount?: number | null;
  teams?: StatsHydratedTeamStats[];
  players?: StatsHydratedPlayerContextStats[];
}

export interface StatsHydratedPlayerContextStats extends StatsHydratedPlayerBoxScore {
  stats?: Record<string, string | number | null | undefined>;
}

export interface StatsHydratedAdvancedTeamStats {
  minutes?: string | number | null;
  offensiveRating?: number | null;
  defensiveRating?: number | null;
  netRating?: number | null;
  assistPercentage?: number | null;
  assistToTurnover?: number | null;
  assistRatio?: number | null;
  offensiveReboundPercentage?: number | null;
  defensiveReboundPercentage?: number | null;
  reboundPercentage?: number | null;
  turnoverRatio?: number | null;
  effectiveFieldGoalPercentage?: number | null;
  trueShootingPercentage?: number | null;
  usagePercentage?: number | null;
  pace?: number | null;
  pacePer40?: number | null;
  possessions?: number | null;
  pie?: number | null;
}

export interface StatsHydratedAdvancedPlayerStats extends StatsHydratedAdvancedTeamStats {
  estimatedOffensiveRating?: number | null;
  estimatedDefensiveRating?: number | null;
  estimatedNetRating?: number | null;
  estimatedTeamTurnoverPercentage?: number | null;
  estimatedUsagePercentage?: number | null;
  estimatedPace?: number | null;
  [key: string]: string | number | null | undefined;
}

export interface StatsHydratedAdvancedTeam extends StatsHydratedTeam {
  stats?: StatsHydratedAdvancedTeamStats;
  sourceRawEstimatedFields?: Record<string, number | null | undefined>;
}

export interface StatsHydratedAdvancedPlayer extends StatsHydratedPlayerBoxScore {
  stats?: StatsHydratedAdvancedPlayerStats;
}

export interface StatsHydratedAdvanced {
  source?: string | null;
  gameId?: string | number | null;
  teamCount?: number | null;
  playerCount?: number | null;
  teams?: StatsHydratedAdvancedTeam[];
  players?: StatsHydratedAdvancedPlayer[];
}

export interface OfficialAdvancedTeam {
  teamId: string;
  teamTricode: string;
  homeAway: string;
  stats: StatsHydratedAdvancedTeamStats;
}

export interface OfficialAdvancedPlayer {
  playerId: string;
  teamId: string;
  name: string;
  nameI: string;
  stats: StatsHydratedAdvancedPlayerStats;
}

export interface OfficialGameAdvancedStats {
  source: string;
  gameId: string;
  homeTeam: OfficialAdvancedTeam | null;
  awayTeam: OfficialAdvancedTeam | null;
  players: OfficialAdvancedPlayer[];
}

export interface GameDetailHydrationMetadata {
  schemaVersion: string | null;
  source: string;
  sourceStatus: string | null;
  coreSources: StatsHydrationCoreSources;
  sourceCapabilities: NbaProxySourceCapabilities;
}

export interface StatsHydratedPlayByPlay {
  source?: string | null;
  actionCount?: number | null;
  actions?: StatsHydratedPlayByPlayAction[];
}

export interface StatsHydratedPlayByPlayAction {
  source?: string | null;
  actionNumber?: string | number | null;
  eventNum?: string | number | null;
  period?: string | number | null;
  clock?: string | null;
  timeActual?: string | null;
  teamId?: string | number | null;
  teamTricode?: string | null;
  personId?: string | number | null;
  playerName?: string | null;
  playerNameI?: string | null;
  actionType?: string | null;
  subType?: string | null;
  description?: string | null;
  homeDescription?: string | null;
  awayDescription?: string | null;
  neutralDescription?: string | null;
  score?: string | null;
  scoreHome?: string | number | null;
  scoreAway?: string | number | null;
  isScoreChange?: boolean | null;
  orderNumber?: string | number | null;
  possession?: string | number | null;
  xLegacy?: string | number | null;
  yLegacy?: string | number | null;
  shotDistance?: string | number | null;
  shotResult?: string | null;
  isFieldGoal?: string | number | boolean | null;
  shotValue?: string | number | null;
  location?: string | null;
  videoAvailable?: string | number | boolean | null;
  actionId?: string | number | null;
  pointsTotal?: string | number | null;
  isShotEvent?: boolean | null;
  shotCoordinatesAvailable?: boolean | null;
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
