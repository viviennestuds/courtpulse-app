export type PlayersSeasonPhase = 'regular' | 'postseason';

export type PlayersPhaseKey = PlayersSeasonPhase | 'playIn';

export type PlayersPhaseAvailabilityStatus = 'ok' | 'empty' | 'failed' | 'unsupported';

export type PlayersDirectoryCacheSource = 'memory' | 'persistent' | 'network' | null;

export type PlayersDirectoryFreshness = 'fresh' | 'stale' | 'unknown';

export interface PlayerDirectoryIdentity {
  fullName: string;
  nickname: string | null;
  age: number | null;
  team: {
    teamId: number | string | null;
    abbreviation: string | null;
    name: string | null;
    semantics: string | null;
  };
}

export interface PlayerDirectorySeasonContext {
  season: string;
  phase: PlayersSeasonPhase;
  seasonType: string;
  teamCount: number;
  isMultiTeam: boolean;
  statsScope: string;
}

export interface PlayerDirectoryBaseStats {
  gamesPlayed: number | null;
  wins: number | null;
  losses: number | null;
  winPct: number | null;
  minutesPerGame: number | null;
  pointsPerGame: number | null;
  reboundsPerGame: number | null;
  assistsPerGame: number | null;
  offensiveReboundsPerGame: number | null;
  defensiveReboundsPerGame: number | null;
  stealsPerGame: number | null;
  blocksPerGame: number | null;
  turnoversPerGame: number | null;
  foulsPerGame: number | null;
  foulsDrawnPerGame: number | null;
  fgMadePerGame: number | null;
  fgAttemptsPerGame: number | null;
  fgPct: number | null;
  threeMadePerGame: number | null;
  threeAttemptsPerGame: number | null;
  threePct: number | null;
  ftMadePerGame: number | null;
  ftAttemptsPerGame: number | null;
  ftPct: number | null;
  plusMinusPerGame: number | null;
  doubleDoubles: number | null;
  tripleDoubles: number | null;
  nbaFantasyPoints: number | null;
}

export interface PlayerDirectoryAdvancedStats {
  possessions: number | null;
  offRating: number | null;
  defRating: number | null;
  netRating: number | null;
  assistPct: number | null;
  assistToTurnover: number | null;
  assistRatio: number | null;
  offensiveReboundPct: number | null;
  defensiveReboundPct: number | null;
  reboundPct: number | null;
  turnoverPct: number | null;
  effectiveFgPct: number | null;
  trueShootingPct: number | null;
  usagePct: number | null;
  pace: number | null;
  pacePer40: number | null;
  pie: number | null;
}

export interface PlayerDirectoryUsageStats {
  usagePct: number | null;
  possessions: number | null;
  percentFieldGoalsMade: number | null;
  percentFgAttempts: number | null;
  percentThreePointMakes: number | null;
  percentThreePointAttempts: number | null;
  percentFreeThrowsMade: number | null;
  percentFtAttempts: number | null;
  percentPoints: number | null;
  percentOffensiveRebounds: number | null;
  percentDefensiveRebounds: number | null;
  percentRebounds: number | null;
  percentAssists: number | null;
  percentTurnovers: number | null;
  percentSteals: number | null;
  percentBlocks: number | null;
  percentBlockedAttempts: number | null;
  percentPersonalFouls: number | null;
  percentFoulsDrawn: number | null;
}

export interface PlayerDirectoryScoringProfile {
  percentFgaTwoPoint: number | null;
  percentFgaThreePoint: number | null;
  percentPointsTwoPoint: number | null;
  percentPointsMidrange: number | null;
  percentPointsThreePoint: number | null;
  percentPointsFastBreak: number | null;
  percentPointsFreeThrow: number | null;
  percentPointsOffTurnovers: number | null;
  percentPointsPaint: number | null;
  percentAssistedTwoPoint: number | null;
  percentUnassistedTwoPoint: number | null;
  percentAssistedThreePoint: number | null;
  percentUnassistedThreePoint: number | null;
  percentAssistedFieldGoals: number | null;
  percentUnassistedFieldGoals: number | null;
  estimatedPointsPerGame: {
    twoPoint: number | null;
    midrange: number | null;
    threePoint: number | null;
    fastBreak: number | null;
    freeThrow: number | null;
    offTurnovers: number | null;
    paint: number | null;
  };
  calculationNotes: {
    estimatedPointsPerGame: string | null;
  };
}

export interface PlayerDirectoryRanks {
  scope: 'league' | string;
  population: number;
  base: {
    gamesPlayed: number | null;
    minutes: number | null;
    points: number | null;
    rebounds: number | null;
    assists: number | null;
    steals: number | null;
    blocks: number | null;
    fgPct: number | null;
    threePct: number | null;
    ftPct: number | null;
  };
  advanced: {
    offRating: number | null;
    defRating: number | null;
    netRating: number | null;
    effectiveFgPct: number | null;
    trueShootingPct: number | null;
    usagePct: number | null;
    pace: number | null;
  };
}

export interface PlayerDirectoryDataAvailability {
  base: boolean;
  advanced: boolean;
  usage: boolean;
  scoring: boolean;
}

export interface PlayerDirectoryEntry {
  playerId: number | string;
  identity: PlayerDirectoryIdentity;
  seasonContext: PlayerDirectorySeasonContext;
  base: PlayerDirectoryBaseStats;
  advanced: PlayerDirectoryAdvancedStats;
  usage: PlayerDirectoryUsageStats;
  scoringProfile: PlayerDirectoryScoringProfile;
  ranks: PlayerDirectoryRanks;
  dataAvailability: PlayerDirectoryDataAvailability;
}

export interface PlayersDirectoryCachePolicy {
  key: string;
  schemaKey: 'playersDirectory.v1' | string;
  unit: 'season+phase' | string;
  temporalState: string;
  retention: string;
  freshness: {
    staleAfterSeconds: number | null;
    refreshStrategy: string;
  };
  implementation?: {
    serverPersistentCache?: boolean;
    devicePersistentCache?: boolean;
    note?: string;
  };
}

export interface PlayersPhaseAvailability {
  phase: PlayersPhaseKey;
  supported: boolean;
  available: boolean | null;
  status: PlayersPhaseAvailabilityStatus;
  noDataConfirmed?: boolean;
  rowCount?: number;
  reason?: string;
  source?: {
    endpoint: string;
    measureType: string;
    seasonType: string;
  };
}

export interface PlayersPhaseAvailabilityMap {
  regular: PlayersPhaseAvailability;
  playIn: PlayersPhaseAvailability;
  postseason: PlayersPhaseAvailability;
}

export interface PlayersPhaseAvailabilityResponse {
  success: true;
  schemaVersion: 'playersPhaseAvailability.v1';
  type: 'playersPhaseAvailability';
  season: string;
  fetchedAt: string | null;
  partial: boolean;
  phases: PlayersPhaseAvailabilityMap;
  sourcePolicy?: {
    availabilityAuthority?: string;
    emptySemantics?: string;
  };
  warnings?: string[];
}

export interface PlayerDirectorySnapshot {
  success: true;
  schemaVersion: 'playersDirectory.v1';
  type: 'playersDirectory';
  season: string;
  requestedPhase: PlayersSeasonPhase;
  phase: PlayersSeasonPhase;
  phaseAliasMatched: string;
  seasonType: string;
  fetchedAt: string | null;
  partial: boolean;
  dataAvailable: boolean;
  noDataConfirmed: boolean;
  sourceStatus: {
    base: string;
    advanced: string;
    usage: string;
    scoring: string;
  };
  population: {
    playerCount: number;
    multiTeamPlayerCount: number;
    allFourDatasetPlayerCount: number;
    partialPlayerCount: number;
    sourceRows: {
      base: number;
      advanced: number;
      usage: number;
      scoring: number;
    };
  };
  rankScope: {
    scope: 'league' | string;
    population: number;
    provenance: string;
  };
  directorySemantics: {
    sourceScope: string;
    playerRowAuthority: string;
    joinKey: string;
    oneRowPerPlayer: boolean;
    statsScope: string;
    teamIdentitySemantics: string;
    rankSemantics: string;
    teamFilterSemantics: string;
  };
  source: {
    provider: string;
    endpoint: string;
    perMode: string;
    leagueId: string;
    teamId: number;
    measures: string[];
  };
  phaseAvailability: PlayersPhaseAvailabilityMap;
  cachePolicy: PlayersDirectoryCachePolicy;
  players: PlayerDirectoryEntry[];
  warnings: string[];
}

export interface PlayersDirectoryCacheManifestEntry {
  key: string;
  schemaVersion: string;
  season: string;
  phase: PlayersSeasonPhase;
  fetchedAt: string | null;
  storedAt: string;
  lastAccessedAt: string;
  dataAvailable: boolean;
  playerCount: number;
}

export type PlayersDirectoryRepositoryErrorCode =
  | 'network'
  | 'invalidResponse'
  | 'persistence'
  | 'unknown';

export interface PlayersDirectoryRepositoryError {
  code: PlayersDirectoryRepositoryErrorCode;
  message: string;
  retryable: boolean;
  occurredAt: string;
}

export interface PlayersDirectoryRepositoryResult {
  snapshot: PlayerDirectorySnapshot | null;
  cacheSource: PlayersDirectoryCacheSource;
  freshness: PlayersDirectoryFreshness;
  isLoading: boolean;
  isRefreshing: boolean;
  error: PlayersDirectoryRepositoryError | null;
  refreshError: PlayersDirectoryRepositoryError | null;
}

export interface PlayersDirectoryCacheDiagnostic extends PlayersDirectoryCacheManifestEntry {
  cacheSource: Exclude<PlayersDirectoryCacheSource, null> | 'manifest';
  freshness: PlayersDirectoryFreshness;
  isRefreshing: boolean;
  lastRefreshError: PlayersDirectoryRepositoryError | null;
}
