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
  shareOfFullGameTurnovers?: number;
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
  shareOfFullGameAssists?: number;
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
    && hasOptionalFiniteNumber(value, 'shareOfFullGameTurnovers');
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
    && hasOptionalFiniteNumber(value, 'shareOfFullGameAssists');
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

/** Strictly accepts only the frozen Matchup Summary v1.1 canonical contract. */
export function isGameMatchupSummaryV2Response(value: unknown): value is GameMatchupSummaryV2Response {
  if (!isRecord(value)) return false;
  return value.success === true
    && value.type === MATCHUP_SUMMARY_V2_PROXY_TYPE
    && typeof value.gameId === 'string'
    && value.contractRelease === MATCHUP_SUMMARY_V2_CONTRACT_RELEASE
    && value.schemaVersion === MATCHUP_SUMMARY_V2_SCHEMA_VERSION
    && value.sourceStatus === 'ok'
    && (value.errorCategory === null || typeof value.errorCategory === 'string')
    && isRecord(value.orientation)
    && isRecord(value.selectionPolicy)
    && Array.isArray(value.keyMatchups)
    && value.keyMatchups.every(isKeyMatchup)
    && Array.isArray(value.offensePlayers)
    && value.offensePlayers.every(isOffensePlayer)
    && (value.selectedOffense === null || isSelectedOffense(value.selectedOffense))
    && isRecord(value.sources)
    && isRecord(value.dataQuality);
}
