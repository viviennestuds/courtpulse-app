export const MATCHUP_SUMMARY_V2_CONTRACT_RELEASE = '1.1' as const;
export const MATCHUP_SUMMARY_V2_SCHEMA_VERSION = 'courtPulseMatchup2.summary.v1.1' as const;
export const MATCHUP_SUMMARY_V2_PROXY_TYPE = 'statsGameMatchupSummaryV2' as const;

export type MatchupSummaryV2Id = string | number;
export type MatchupSummaryV2ReasonStrength = 'major' | 'notable' | 'supporting';

export interface MatchupSummaryV2PlayerIdentity {
  playerId: MatchupSummaryV2Id;
  name: string;
  teamId: MatchupSummaryV2Id;
  teamTricode: string;
}

export interface MatchupSummaryV2OffenseBoxScore {
  points: number;
  fgm: number;
  fga: number;
  fg3m: number;
  fg3a: number;
  ftm: number;
  fta: number;
  assists: number;
  turnovers: number;
  efgPct: number | null;
  freeThrowRate: number | null;
}

export interface MatchupSummaryV2DefenseBoxScore {
  blocks: number;
  shootingFouls: number;
}

export interface MatchupSummaryV2BoxScore {
  matchupTime: string;
  matchupSeconds: number;
  partialPossessions: number;
  percentageTotalTimeBothOn: number;
  offense: MatchupSummaryV2OffenseBoxScore;
  defense: MatchupSummaryV2DefenseBoxScore;
}

export interface MatchupSummaryV2NotabilityReason {
  key: string;
  label: string;
  direction: string;
  value: number;
  unit: string;
  strength: MatchupSummaryV2ReasonStrength;
  selectionRole: string;
  explanation: string;
}

export interface MatchupSummaryV2ShootingContextValues {
  fga?: number;
  efgPct?: number | null;
  threePointAttemptRate?: number | null;
}

export interface MatchupSummaryV2ShootingDeltaContext {
  efgPct?: number | null;
  threePointAttemptRate?: number | null;
}

export interface MatchupSummaryV2ShootingFactorContext {
  provenance?: string;
  selected?: MatchupSummaryV2ShootingContextValues;
  restOfGameExclusive?: MatchupSummaryV2ShootingContextValues;
  deltasSelectedMinusRest?: MatchupSummaryV2ShootingDeltaContext;
}

export interface MatchupSummaryV2BallSecurityFactorContext {
  provenance?: string;
  turnovers?: number;
  /** Optional context field; null means the full-game turnover denominator is not meaningful. */
  shareOfFullGameTurnovers?: number | null;
}

export interface MatchupSummaryV2FoulPressureFactorContext {
  provenance?: string;
  freeThrowAttempts?: number;
  freeThrowRate?: number | null;
  restOfGameExclusiveFreeThrowRate?: number | null;
  shootingFoulsByDefender?: number;
}

export interface MatchupSummaryV2CreationFactorContext {
  provenance?: string;
  assists?: number;
  /** Optional context field; null means the full-game assist denominator is not meaningful. */
  shareOfFullGameAssists?: number | null;
}

export interface MatchupSummaryV2DefensiveActivityFactorContext {
  provenance?: string;
  blocks?: number;
  shootingFouls?: number;
}

/** Display-focused subset of canonical factor context; unknown future fields remain pass-through. */
export interface MatchupSummaryV2FactorContext {
  shooting?: MatchupSummaryV2ShootingFactorContext;
  ballSecurity?: MatchupSummaryV2BallSecurityFactorContext;
  foulPressure?: MatchupSummaryV2FoulPressureFactorContext;
  creation?: MatchupSummaryV2CreationFactorContext;
  defensiveActivity?: MatchupSummaryV2DefensiveActivityFactorContext;
  [key: string]: unknown;
}

export interface MatchupSummaryV2SelectionProfile {
  highestStrength: MatchupSummaryV2ReasonStrength;
  majorReasonCount: number;
  notableReasonCount: number;
  supportingReasonCount: number;
  primaryFactorReasonCount: number;
  supportingFactorReasonCount: number;
  exposureReasonCount: number;
  strongestReasonKey: string;
  partialPossessions: number;
}

export interface MatchupSummaryV2Capabilities {
  personalBoxScore: {
    available: boolean;
  };
  shotProfile: {
    queryEligible: boolean;
    availabilityConfirmed: boolean;
  };
  film: {
    queryEligible: boolean;
    availabilityConfirmed: boolean;
  };
}

export interface MatchupSummaryV2KeyMatchup {
  pairing: {
    offense: MatchupSummaryV2PlayerIdentity;
    defense: MatchupSummaryV2PlayerIdentity;
  };
  boxScore: MatchupSummaryV2BoxScore;
  factorContext: MatchupSummaryV2FactorContext;
  notabilityReasons: MatchupSummaryV2NotabilityReason[];
  selectionProfile: MatchupSummaryV2SelectionProfile;
  capabilities: MatchupSummaryV2Capabilities;
}

export interface MatchupSummaryV2OffensePlayer extends MatchupSummaryV2PlayerIdentity {
  matchupCount: number;
  maxPartialPossessions: number;
}

export interface MatchupSummaryV2DefenderDistributionRow {
  defense: MatchupSummaryV2PlayerIdentity;
  matchupTime: string;
  matchupSeconds: number;
  partialPossessions: number;
  percentageTotalTimeBothOn: number;
  points: number;
  fgm: number;
  fga: number;
  assists: number;
  turnovers: number;
  defenderBlocks: number;
  defenderShootingFouls: number;
}

export interface MatchupSummaryV2SelectedOffense {
  offense: MatchupSummaryV2PlayerIdentity;
  defenderDistribution: MatchupSummaryV2DefenderDistributionRow[];
}

export interface GameMatchupSummaryV2Response {
  success: true;
  type: typeof MATCHUP_SUMMARY_V2_PROXY_TYPE;
  gameId: string;
  contractRelease: typeof MATCHUP_SUMMARY_V2_CONTRACT_RELEASE;
  schemaVersion: typeof MATCHUP_SUMMARY_V2_SCHEMA_VERSION;
  sourceStatus: 'ok';
  errorCategory: string | null;
  orientation: Record<string, unknown>;
  selectionPolicy: Record<string, unknown>;
  keyMatchups: MatchupSummaryV2KeyMatchup[];
  offensePlayers: MatchupSummaryV2OffensePlayer[];
  selectedOffense: MatchupSummaryV2SelectedOffense | null;
  sources: Record<string, unknown>;
  dataQuality: Record<string, unknown>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isNullableFiniteNumber(value: unknown): value is number | null {
  return value === null || isFiniteNumber(value);
}

function hasOptionalString(value: Record<string, unknown>, key: string): boolean {
  return !(key in value) || typeof value[key] === 'string';
}

function hasOptionalFiniteNumber(value: Record<string, unknown>, key: string): boolean {
  return !(key in value) || isFiniteNumber(value[key]);
}

function hasOptionalNullableFiniteNumber(value: Record<string, unknown>, key: string): boolean {
  return !(key in value) || isNullableFiniteNumber(value[key]);
}

function isId(value: unknown): value is MatchupSummaryV2Id {
  return (typeof value === 'string' && value.trim().length > 0) || isFiniteNumber(value);
}

function isPlayerIdentity(value: unknown): value is MatchupSummaryV2PlayerIdentity {
  if (!isRecord(value)) return false;
  return isId(value.playerId)
    && typeof value.name === 'string'
    && value.name.trim().length > 0
    && isId(value.teamId)
    && typeof value.teamTricode === 'string';
}

function hasFiniteNumbers(value: Record<string, unknown>, keys: string[]): boolean {
  return keys.every((key: string) => isFiniteNumber(value[key]));
}

function isOffenseBoxScore(value: unknown): value is MatchupSummaryV2OffenseBoxScore {
  return isRecord(value)
    && hasFiniteNumbers(value, [
      'points', 'fgm', 'fga', 'fg3m', 'fg3a', 'ftm', 'fta', 'assists', 'turnovers',
    ])
    && isNullableFiniteNumber(value.efgPct)
    && isNullableFiniteNumber(value.freeThrowRate);
}

function isDefenseBoxScore(value: unknown): value is MatchupSummaryV2DefenseBoxScore {
  return isRecord(value) && hasFiniteNumbers(value, ['blocks', 'shootingFouls']);
}

function isBoxScore(value: unknown): value is MatchupSummaryV2BoxScore {
  if (!isRecord(value)) return false;
  return typeof value.matchupTime === 'string'
    && hasFiniteNumbers(value, ['matchupSeconds', 'partialPossessions', 'percentageTotalTimeBothOn'])
    && isOffenseBoxScore(value.offense)
    && isDefenseBoxScore(value.defense);
}

function isShootingContextValues(value: unknown): value is MatchupSummaryV2ShootingContextValues {
  return isRecord(value)
    && hasOptionalFiniteNumber(value, 'fga')
    && hasOptionalNullableFiniteNumber(value, 'efgPct')
    && hasOptionalNullableFiniteNumber(value, 'threePointAttemptRate');
}

function isShootingDeltaContext(value: unknown): value is MatchupSummaryV2ShootingDeltaContext {
  return isRecord(value)
    && hasOptionalNullableFiniteNumber(value, 'efgPct')
    && hasOptionalNullableFiniteNumber(value, 'threePointAttemptRate');
}

function isShootingFactorContext(value: unknown): value is MatchupSummaryV2ShootingFactorContext {
  return isRecord(value)
    && hasOptionalString(value, 'provenance')
    && (value.selected === undefined || isShootingContextValues(value.selected))
    && (value.restOfGameExclusive === undefined || isShootingContextValues(value.restOfGameExclusive))
    && (value.deltasSelectedMinusRest === undefined || isShootingDeltaContext(value.deltasSelectedMinusRest));
}

function isBallSecurityFactorContext(value: unknown): value is MatchupSummaryV2BallSecurityFactorContext {
  return isRecord(value)
    && hasOptionalString(value, 'provenance')
    && hasOptionalFiniteNumber(value, 'turnovers')
    && hasOptionalNullableFiniteNumber(value, 'shareOfFullGameTurnovers');
}

function isFoulPressureFactorContext(value: unknown): value is MatchupSummaryV2FoulPressureFactorContext {
  return isRecord(value)
    && hasOptionalString(value, 'provenance')
    && hasOptionalFiniteNumber(value, 'freeThrowAttempts')
    && hasOptionalNullableFiniteNumber(value, 'freeThrowRate')
    && hasOptionalNullableFiniteNumber(value, 'restOfGameExclusiveFreeThrowRate')
    && hasOptionalFiniteNumber(value, 'shootingFoulsByDefender');
}

function isCreationFactorContext(value: unknown): value is MatchupSummaryV2CreationFactorContext {
  return isRecord(value)
    && hasOptionalString(value, 'provenance')
    && hasOptionalFiniteNumber(value, 'assists')
    && hasOptionalNullableFiniteNumber(value, 'shareOfFullGameAssists');
}

function isDefensiveActivityFactorContext(value: unknown): value is MatchupSummaryV2DefensiveActivityFactorContext {
  return isRecord(value)
    && hasOptionalString(value, 'provenance')
    && hasOptionalFiniteNumber(value, 'blocks')
    && hasOptionalFiniteNumber(value, 'shootingFouls');
}

function isFactorContext(value: unknown): value is MatchupSummaryV2FactorContext {
  return isRecord(value)
    && (value.shooting === undefined || isShootingFactorContext(value.shooting))
    && (value.ballSecurity === undefined || isBallSecurityFactorContext(value.ballSecurity))
    && (value.foulPressure === undefined || isFoulPressureFactorContext(value.foulPressure))
    && (value.creation === undefined || isCreationFactorContext(value.creation))
    && (value.defensiveActivity === undefined || isDefensiveActivityFactorContext(value.defensiveActivity));
}

function isReasonStrength(value: unknown): value is MatchupSummaryV2ReasonStrength {
  return value === 'major' || value === 'notable' || value === 'supporting';
}

function isNotabilityReason(value: unknown): value is MatchupSummaryV2NotabilityReason {
  if (!isRecord(value)) return false;
  return typeof value.key === 'string'
    && typeof value.label === 'string'
    && typeof value.direction === 'string'
    && isFiniteNumber(value.value)
    && typeof value.unit === 'string'
    && isReasonStrength(value.strength)
    && typeof value.selectionRole === 'string'
    && typeof value.explanation === 'string';
}

function isSelectionProfile(value: unknown): value is MatchupSummaryV2SelectionProfile {
  if (!isRecord(value)) return false;
  return isReasonStrength(value.highestStrength)
    && hasFiniteNumbers(value, [
      'majorReasonCount', 'notableReasonCount', 'supportingReasonCount', 'primaryFactorReasonCount',
      'supportingFactorReasonCount', 'exposureReasonCount', 'partialPossessions',
    ])
    && typeof value.strongestReasonKey === 'string';
}

function isCapabilities(value: unknown): value is MatchupSummaryV2Capabilities {
  if (!isRecord(value) || !isRecord(value.personalBoxScore) || !isRecord(value.shotProfile) || !isRecord(value.film)) return false;
  return typeof value.personalBoxScore.available === 'boolean'
    && typeof value.shotProfile.queryEligible === 'boolean'
    && typeof value.shotProfile.availabilityConfirmed === 'boolean'
    && typeof value.film.queryEligible === 'boolean'
    && typeof value.film.availabilityConfirmed === 'boolean';
}

function isKeyMatchup(value: unknown): value is MatchupSummaryV2KeyMatchup {
  if (!isRecord(value) || !isRecord(value.pairing) || !Array.isArray(value.notabilityReasons)) return false;
  return isPlayerIdentity(value.pairing.offense)
    && isPlayerIdentity(value.pairing.defense)
    && isBoxScore(value.boxScore)
    && isFactorContext(value.factorContext)
    && value.notabilityReasons.every(isNotabilityReason)
    && isSelectionProfile(value.selectionProfile)
    && isCapabilities(value.capabilities);
}

function isOffensePlayer(value: unknown): value is MatchupSummaryV2OffensePlayer {
  return isPlayerIdentity(value)
    && isRecord(value)
    && hasFiniteNumbers(value, ['matchupCount', 'maxPartialPossessions']);
}

function isDefenderDistributionRow(value: unknown): value is MatchupSummaryV2DefenderDistributionRow {
  if (!isRecord(value)) return false;
  return isPlayerIdentity(value.defense)
    && typeof value.matchupTime === 'string'
    && hasFiniteNumbers(value, [
      'matchupSeconds', 'partialPossessions', 'percentageTotalTimeBothOn', 'points', 'fgm', 'fga',
      'assists', 'turnovers', 'defenderBlocks', 'defenderShootingFouls',
    ]);
}

function isSelectedOffense(value: unknown): value is MatchupSummaryV2SelectedOffense {
  if (!isRecord(value) || !Array.isArray(value.defenderDistribution)) return false;
  return isPlayerIdentity(value.offense) && value.defenderDistribution.every(isDefenderDistributionRow);
}

export type MatchupSummaryV2ValidationCategory =
  | 'contractReleaseMismatch'
  | 'schemaMismatch'
  | 'gameIdMismatch'
  | 'pairIdentityMismatch'
  | 'structuralValidation';

export type MatchupSummaryV2ValidationResult =
  | { ok: true; data: GameMatchupSummaryV2Response }
  | {
    ok: false;
    category: MatchupSummaryV2ValidationCategory;
    path: string;
    reason: string;
  };

function validationFailure(
  category: MatchupSummaryV2ValidationCategory,
  path: string,
  reason: string,
): MatchupSummaryV2ValidationResult {
  return { ok: false, category, path, reason };
}

function requiredFiniteFieldsFailure(
  value: Record<string, unknown>,
  keys: string[],
  path: string,
): MatchupSummaryV2ValidationResult | null {
  const key = keys.find((candidate: string) => !isFiniteNumber(value[candidate]));
  return key
    ? validationFailure('structuralValidation', `${path}.${key}`, 'expected a finite number')
    : null;
}

function playerIdentityFailure(value: unknown, path: string): MatchupSummaryV2ValidationResult | null {
  if (!isRecord(value)) return validationFailure('pairIdentityMismatch', path, 'expected a player identity object');
  if (!isId(value.playerId)) return validationFailure('pairIdentityMismatch', `${path}.playerId`, 'expected a non-empty string or finite number');
  if (typeof value.name !== 'string' || value.name.trim().length === 0) {
    return validationFailure('pairIdentityMismatch', `${path}.name`, 'expected a non-empty player name');
  }
  if (!isId(value.teamId)) return validationFailure('pairIdentityMismatch', `${path}.teamId`, 'expected a non-empty string or finite number');
  if (typeof value.teamTricode !== 'string') {
    return validationFailure('pairIdentityMismatch', `${path}.teamTricode`, 'expected a team tricode string');
  }
  return null;
}

function optionalFieldFailure(
  value: Record<string, unknown>,
  key: string,
  path: string,
  accepts: (candidate: unknown) => boolean,
  expectation: string,
): MatchupSummaryV2ValidationResult | null {
  if (!(key in value) || accepts(value[key])) return null;
  return validationFailure('structuralValidation', `${path}.${key}`, expectation);
}

function boxScoreFailure(value: unknown, path: string): MatchupSummaryV2ValidationResult | null {
  if (!isRecord(value)) return validationFailure('structuralValidation', path, 'expected a box score object');
  if (typeof value.matchupTime !== 'string') {
    return validationFailure('structuralValidation', `${path}.matchupTime`, 'expected a matchup time string');
  }
  const exposureFailure = requiredFiniteFieldsFailure(
    value,
    ['matchupSeconds', 'partialPossessions', 'percentageTotalTimeBothOn'],
    path,
  );
  if (exposureFailure) return exposureFailure;
  if (!isRecord(value.offense)) {
    return validationFailure('structuralValidation', `${path}.offense`, 'expected an offense box score object');
  }
  const offenseFailure = requiredFiniteFieldsFailure(
    value.offense,
    ['points', 'fgm', 'fga', 'fg3m', 'fg3a', 'ftm', 'fta', 'assists', 'turnovers'],
    `${path}.offense`,
  );
  if (offenseFailure) return offenseFailure;
  if (!isNullableFiniteNumber(value.offense.efgPct)) {
    return validationFailure('structuralValidation', `${path}.offense.efgPct`, 'expected a finite number or null');
  }
  if (!isNullableFiniteNumber(value.offense.freeThrowRate)) {
    return validationFailure('structuralValidation', `${path}.offense.freeThrowRate`, 'expected a finite number or null');
  }
  if (!isRecord(value.defense)) {
    return validationFailure('structuralValidation', `${path}.defense`, 'expected a defense box score object');
  }
  return requiredFiniteFieldsFailure(value.defense, ['blocks', 'shootingFouls'], `${path}.defense`);
}

function factorContextFailure(value: unknown, path: string): MatchupSummaryV2ValidationResult | null {
  if (!isRecord(value)) return validationFailure('structuralValidation', path, 'expected a factor context object');
  const blocks: {
    key: string;
    finite: string[];
    nullable: string[];
  }[] = [
    { key: 'ballSecurity', finite: ['turnovers'], nullable: ['shareOfFullGameTurnovers'] },
    {
      key: 'foulPressure',
      finite: ['freeThrowAttempts', 'shootingFoulsByDefender'],
      nullable: ['freeThrowRate', 'restOfGameExclusiveFreeThrowRate'],
    },
    { key: 'creation', finite: ['assists'], nullable: ['shareOfFullGameAssists'] },
    { key: 'defensiveActivity', finite: ['blocks', 'shootingFouls'], nullable: [] },
  ];
  for (const block of blocks) {
    const blockValue = value[block.key];
    if (blockValue === undefined) continue;
    const blockPath = `${path}.${block.key}`;
    if (!isRecord(blockValue)) return validationFailure('structuralValidation', blockPath, 'expected an object');
    const provenanceFailure = optionalFieldFailure(
      blockValue,
      'provenance',
      blockPath,
      (candidate: unknown) => typeof candidate === 'string',
      'expected a string when supplied',
    );
    if (provenanceFailure) return provenanceFailure;
    for (const key of block.finite) {
      const failure = optionalFieldFailure(
        blockValue,
        key,
        blockPath,
        isFiniteNumber,
        'expected a finite number when supplied',
      );
      if (failure) return failure;
    }
    for (const key of block.nullable) {
      const failure = optionalFieldFailure(
        blockValue,
        key,
        blockPath,
        isNullableFiniteNumber,
        'expected a finite number or null when supplied',
      );
      if (failure) return failure;
    }
  }
  if (value.shooting !== undefined && !isShootingFactorContext(value.shooting)) {
    return validationFailure('structuralValidation', `${path}.shooting`, 'malformed shooting factor context');
  }
  return null;
}

function keyMatchupFailure(value: unknown, path: string): MatchupSummaryV2ValidationResult | null {
  if (!isRecord(value)) return validationFailure('structuralValidation', path, 'expected a key matchup object');
  if (!isRecord(value.pairing)) return validationFailure('pairIdentityMismatch', `${path}.pairing`, 'expected a pairing object');
  const offenseFailure = playerIdentityFailure(value.pairing.offense, `${path}.pairing.offense`);
  if (offenseFailure) return offenseFailure;
  const defenseFailure = playerIdentityFailure(value.pairing.defense, `${path}.pairing.defense`);
  if (defenseFailure) return defenseFailure;
  const boxFailure = boxScoreFailure(value.boxScore, `${path}.boxScore`);
  if (boxFailure) return boxFailure;
  const factorFailure = factorContextFailure(value.factorContext, `${path}.factorContext`);
  if (factorFailure) return factorFailure;
  if (!Array.isArray(value.notabilityReasons)) {
    return validationFailure('structuralValidation', `${path}.notabilityReasons`, 'expected an array');
  }
  const malformedReasonIndex = value.notabilityReasons.findIndex((reason: unknown) => !isNotabilityReason(reason));
  if (malformedReasonIndex >= 0) {
    return validationFailure('structuralValidation', `${path}.notabilityReasons[${malformedReasonIndex}]`, 'malformed notability reason');
  }
  if (!isSelectionProfile(value.selectionProfile)) {
    return validationFailure('structuralValidation', `${path}.selectionProfile`, 'malformed selection profile');
  }
  if (!isCapabilities(value.capabilities)) {
    return validationFailure('structuralValidation', `${path}.capabilities`, 'malformed capabilities');
  }
  if (!isKeyMatchup(value)) return validationFailure('structuralValidation', path, 'malformed key matchup');
  return null;
}

function offensePlayerFailure(value: unknown, path: string): MatchupSummaryV2ValidationResult | null {
  const identityFailure = playerIdentityFailure(value, path);
  if (identityFailure) return identityFailure;
  if (!isRecord(value)) return validationFailure('structuralValidation', path, 'expected an offense player object');
  const numericFailure = requiredFiniteFieldsFailure(value, ['matchupCount', 'maxPartialPossessions'], path);
  if (numericFailure) return numericFailure;
  return isOffensePlayer(value)
    ? null
    : validationFailure('structuralValidation', path, 'malformed offense player');
}

function selectedOffenseFailure(value: unknown, path: string): MatchupSummaryV2ValidationResult | null {
  if (!isRecord(value)) return validationFailure('structuralValidation', path, 'expected a selected offense object');
  const identityFailure = playerIdentityFailure(value.offense, `${path}.offense`);
  if (identityFailure) return identityFailure;
  if (!Array.isArray(value.defenderDistribution)) {
    return validationFailure('structuralValidation', `${path}.defenderDistribution`, 'expected an array');
  }
  for (let index = 0; index < value.defenderDistribution.length; index += 1) {
    const row = value.defenderDistribution[index];
    const rowPath = `${path}.defenderDistribution[${index}]`;
    if (!isRecord(row)) return validationFailure('structuralValidation', rowPath, 'expected a defender distribution row');
    const defenseFailure = playerIdentityFailure(row.defense, `${rowPath}.defense`);
    if (defenseFailure) return defenseFailure;
    if (typeof row.matchupTime !== 'string') {
      return validationFailure('structuralValidation', `${rowPath}.matchupTime`, 'expected a matchup time string');
    }
    const numericFailure = requiredFiniteFieldsFailure(row, [
      'matchupSeconds', 'partialPossessions', 'percentageTotalTimeBothOn', 'points', 'fgm', 'fga',
      'assists', 'turnovers', 'defenderBlocks', 'defenderShootingFouls',
    ], rowPath);
    if (numericFailure) return numericFailure;
  }
  return isSelectedOffense(value)
    ? null
    : validationFailure('structuralValidation', path, 'malformed selected offense');
}

function normalizeId(value: MatchupSummaryV2Id | string): string {
  return String(value).trim();
}

/** Validates v1.1 strictly and preserves the first useful contract failure path. */
export function validateGameMatchupSummaryV2Response(
  value: unknown,
  expectedGameId?: string,
  expectedOffensePlayerId?: string,
): MatchupSummaryV2ValidationResult {
  if (!isRecord(value)) return validationFailure('structuralValidation', '$', 'expected a response object');
  if (value.success !== true) return validationFailure('structuralValidation', '$.success', 'expected true');
  if (value.type !== MATCHUP_SUMMARY_V2_PROXY_TYPE) {
    return validationFailure('structuralValidation', '$.type', `expected ${MATCHUP_SUMMARY_V2_PROXY_TYPE}`);
  }
  if (typeof value.gameId !== 'string') {
    return validationFailure('structuralValidation', '$.gameId', 'expected a game ID string');
  }
  if (expectedGameId !== undefined && normalizeId(value.gameId) !== normalizeId(expectedGameId)) {
    return validationFailure('gameIdMismatch', '$.gameId', 'returned game ID does not match the request');
  }
  if (value.contractRelease !== MATCHUP_SUMMARY_V2_CONTRACT_RELEASE) {
    return validationFailure('contractReleaseMismatch', '$.contractRelease', `expected ${MATCHUP_SUMMARY_V2_CONTRACT_RELEASE}`);
  }
  if (value.schemaVersion !== MATCHUP_SUMMARY_V2_SCHEMA_VERSION) {
    return validationFailure('schemaMismatch', '$.schemaVersion', `expected ${MATCHUP_SUMMARY_V2_SCHEMA_VERSION}`);
  }
  if (value.sourceStatus !== 'ok') {
    return validationFailure('structuralValidation', '$.sourceStatus', 'expected ok');
  }
  if (value.errorCategory !== null) {
    return validationFailure('structuralValidation', '$.errorCategory', 'expected null for a successful response');
  }
  for (const key of ['orientation', 'selectionPolicy', 'sources', 'dataQuality']) {
    if (!isRecord(value[key])) return validationFailure('structuralValidation', `$.${key}`, 'expected an object');
  }
  if (!Array.isArray(value.keyMatchups)) {
    return validationFailure('structuralValidation', '$.keyMatchups', 'expected an array');
  }
  for (let index = 0; index < value.keyMatchups.length; index += 1) {
    const failure = keyMatchupFailure(value.keyMatchups[index], `$.keyMatchups[${index}]`);
    if (failure) return failure;
  }
  if (!Array.isArray(value.offensePlayers)) {
    return validationFailure('structuralValidation', '$.offensePlayers', 'expected an array');
  }
  for (let index = 0; index < value.offensePlayers.length; index += 1) {
    const failure = offensePlayerFailure(value.offensePlayers[index], `$.offensePlayers[${index}]`);
    if (failure) return failure;
  }
  if (value.selectedOffense !== null) {
    const failure = selectedOffenseFailure(value.selectedOffense, '$.selectedOffense');
    if (failure) return failure;
    if (
      expectedOffensePlayerId !== undefined
      && isRecord(value.selectedOffense)
      && isRecord(value.selectedOffense.offense)
      && isId(value.selectedOffense.offense.playerId)
      && normalizeId(value.selectedOffense.offense.playerId) !== normalizeId(expectedOffensePlayerId)
    ) {
      return validationFailure(
        'pairIdentityMismatch',
        '$.selectedOffense.offense.playerId',
        'returned offense player does not match the request',
      );
    }
  }
  return { ok: true, data: value as unknown as GameMatchupSummaryV2Response };
}

/** Strictly accepts only the frozen Matchup Summary v1.1 canonical contract. */
export function isGameMatchupSummaryV2Response(value: unknown): value is GameMatchupSummaryV2Response {
  return validateGameMatchupSummaryV2Response(value).ok;
}
