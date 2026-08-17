export const MATCHUP_EVENTS_V2_CONTRACT_RELEASE = '1.3' as const;
export const MATCHUP_EVENTS_V2_SCHEMA_VERSION = 'courtPulseMatchup2.events.v1.3' as const;
export const MATCHUP_EVENTS_V2_PROXY_TYPE = 'statsGameMatchupEventsV2' as const;

export type MatchupEventsV2Id = string | number;

export interface MatchupEventsV2PlayerIdentity {
  playerId: MatchupEventsV2Id;
  name: string;
  teamId: MatchupEventsV2Id;
  teamTricode: string;
}

export interface MatchupEventsV2Exposure {
  matchupTime: string;
  matchupSeconds: number;
  partialPossessions: number;
  percentageTotalTimeBothOn: number;
}

export interface MatchupEventsV2ActivityMetric {
  count: number;
  eventIds?: MatchupEventsV2Id[];
  provenance: string;
  status: string;
  [key: string]: unknown;
}

export interface MatchupEventsV2NullableActivityMetric {
  count: number | null;
  eventIds?: MatchupEventsV2Id[];
  provenance: string;
  status: string;
  [key: string]: unknown;
}

export interface MatchupEventsV2DefenderActivity {
  steals: MatchupEventsV2ActivityMetric;
  blocks: MatchupEventsV2ActivityMetric;
  shootingFoulsCommitted: MatchupEventsV2ActivityMetric;
  offensiveFoulTurnoversAttributedToPair: MatchupEventsV2ActivityMetric;
  offensiveFoulsDrawn: MatchupEventsV2NullableActivityMetric;
  [key: string]: unknown;
}

export interface MatchupEventsV2EventSummary {
  totalEvidenceEvents: number;
  [key: string]: unknown;
}

export interface MatchupEventsV2Action {
  period: number;
  clock: string;
  description: string;
  actionNumber?: MatchupEventsV2Id | null;
  eventNum?: MatchupEventsV2Id | null;
  actionId?: MatchupEventsV2Id | null;
  personId?: MatchupEventsV2Id | null;
  teamId?: MatchupEventsV2Id | null;
  actionType?: string | null;
  subType?: string | null;
  shotResult?: string | null;
  freeThrowAttemptNumber?: number;
  freeThrowTotalAttempts?: number;
  directEventUrl?: string | null;
  [key: string]: unknown;
}

export interface MatchupEventsV2CreditedDefensiveActors {
  stealer?: MatchupEventsV2PlayerIdentity | null;
  blocker?: MatchupEventsV2PlayerIdentity | null;
  shootingFouler?: MatchupEventsV2PlayerIdentity | null;
  offensiveFoulDrawer?: MatchupEventsV2PlayerIdentity | null;
  [key: string]: unknown;
}

export interface MatchupEventsV2Attribution {
  status: string;
  offensePlayerId: MatchupEventsV2Id;
  defensePlayerId: MatchupEventsV2Id;
  [key: string]: unknown;
}

export interface MatchupEventsV2Provenance {
  eventSet: string;
  eventJoin: string;
  foulDrawer: string;
  [key: string]: unknown;
}

export interface MatchupEventsV2DefensiveActorRelationship {
  overall: string;
  stealer?: string;
  blocker?: string;
  shootingFouler?: string;
  offensiveFoulDrawer?: string;
  [key: string]: unknown;
}

export interface MatchupEventsV2SourceOverlapAssignment {
  offense?: MatchupEventsV2PlayerIdentity;
  defense?: MatchupEventsV2PlayerIdentity;
  playerId?: MatchupEventsV2Id;
  name?: string;
  [key: string]: unknown;
}

export interface MatchupEventsV2SourceOverlap {
  observed: boolean;
  assignments?: MatchupEventsV2SourceOverlapAssignment[];
  otherAssignments?: MatchupEventsV2SourceOverlapAssignment[];
  matchupAssignments?: MatchupEventsV2SourceOverlapAssignment[];
  [key: string]: unknown;
}

export interface MatchupEventsV2FreeThrowTrip {
  expectedAttempts: number;
  observedAttempts: number;
  observedOrdinals: number[];
  complete: boolean;
  stopReason: string;
  [key: string]: unknown;
}

export interface MatchupEventsV2Event {
  gameEventId: MatchupEventsV2Id;
  period: number;
  clock: string;
  descriptions: string[];
  types: string[];
  sourceMeasures: string[];
  primaryAction: MatchupEventsV2Action | null;
  counterpartActions: MatchupEventsV2Action[];
  allEventActions: MatchupEventsV2Action[];
  creditedDefensiveActors: MatchupEventsV2CreditedDefensiveActors;
  matchupAttribution: MatchupEventsV2Attribution;
  provenance: MatchupEventsV2Provenance;
  defensiveActorRelationship: MatchupEventsV2DefensiveActorRelationship;
  sourceOverlap?: MatchupEventsV2SourceOverlap | null;
  freeThrowTrip?: MatchupEventsV2FreeThrowTrip | null;
  [key: string]: unknown;
}

export interface GameMatchupEventsV2Response {
  success: true;
  type: typeof MATCHUP_EVENTS_V2_PROXY_TYPE;
  gameId: string;
  contractRelease: typeof MATCHUP_EVENTS_V2_CONTRACT_RELEASE;
  schemaVersion: typeof MATCHUP_EVENTS_V2_SCHEMA_VERSION;
  sourceStatus: 'ok';
  errorCategory: string | null;
  pairing: {
    offense: MatchupEventsV2PlayerIdentity;
    defense: MatchupEventsV2PlayerIdentity;
  };
  matchupExposure: MatchupEventsV2Exposure;
  defenderActivity: MatchupEventsV2DefenderActivity;
  eventSummary: MatchupEventsV2EventSummary;
  events: MatchupEventsV2Event[];
  [key: string]: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isId(value: unknown): value is MatchupEventsV2Id {
  return (typeof value === 'string' && value.trim().length > 0) || isFiniteNumber(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item: unknown) => typeof item === 'string');
}

function hasOptionalString(value: Record<string, unknown>, key: string): boolean {
  return !(key in value) || value[key] === null || typeof value[key] === 'string';
}

function hasOptionalId(value: Record<string, unknown>, key: string): boolean {
  return !(key in value) || value[key] === null || isId(value[key]);
}

function hasOptionalFiniteNumber(value: Record<string, unknown>, key: string): boolean {
  return !(key in value) || isFiniteNumber(value[key]);
}

function isPlayerIdentity(value: unknown): value is MatchupEventsV2PlayerIdentity {
  return isRecord(value)
    && isId(value.playerId)
    && typeof value.name === 'string'
    && value.name.trim().length > 0
    && isId(value.teamId)
    && typeof value.teamTricode === 'string';
}

function isExposure(value: unknown): value is MatchupEventsV2Exposure {
  return isRecord(value)
    && typeof value.matchupTime === 'string'
    && isFiniteNumber(value.matchupSeconds)
    && isFiniteNumber(value.partialPossessions)
    && isFiniteNumber(value.percentageTotalTimeBothOn);
}

function isActivityMetric(value: unknown, allowsNullCount: boolean): boolean {
  return isRecord(value)
    && (isFiniteNumber(value.count) || (allowsNullCount && value.count === null))
    && (value.eventIds === undefined || (Array.isArray(value.eventIds) && value.eventIds.every(isId)))
    && typeof value.provenance === 'string'
    && typeof value.status === 'string';
}

function isDefenderActivity(value: unknown): value is MatchupEventsV2DefenderActivity {
  return isRecord(value)
    && isActivityMetric(value.steals, false)
    && isActivityMetric(value.blocks, false)
    && isActivityMetric(value.shootingFoulsCommitted, false)
    && isActivityMetric(value.offensiveFoulTurnoversAttributedToPair, false)
    && isActivityMetric(value.offensiveFoulsDrawn, true);
}

function isEventSummary(value: unknown): value is MatchupEventsV2EventSummary {
  if (!isRecord(value) || !isFiniteNumber(value.totalEvidenceEvents)) return false;
  return Object.entries(value).every(([, entryValue]: [string, unknown]) => (
    typeof entryValue !== 'number' || Number.isFinite(entryValue)
  ));
}

function isAction(value: unknown): value is MatchupEventsV2Action {
  if (!isRecord(value)) return false;
  return isFiniteNumber(value.period)
    && typeof value.clock === 'string'
    && typeof value.description === 'string'
    && hasOptionalId(value, 'actionNumber')
    && hasOptionalId(value, 'eventNum')
    && hasOptionalId(value, 'actionId')
    && hasOptionalId(value, 'personId')
    && hasOptionalId(value, 'teamId')
    && hasOptionalString(value, 'actionType')
    && hasOptionalString(value, 'subType')
    && hasOptionalString(value, 'shotResult')
    && hasOptionalString(value, 'directEventUrl')
    && hasOptionalFiniteNumber(value, 'freeThrowAttemptNumber')
    && hasOptionalFiniteNumber(value, 'freeThrowTotalAttempts');
}

function isOptionalPlayerIdentity(value: unknown): boolean {
  return value === undefined || value === null || isPlayerIdentity(value);
}

function isCreditedDefensiveActors(value: unknown): value is MatchupEventsV2CreditedDefensiveActors {
  return isRecord(value)
    && isOptionalPlayerIdentity(value.stealer)
    && isOptionalPlayerIdentity(value.blocker)
    && isOptionalPlayerIdentity(value.shootingFouler)
    && isOptionalPlayerIdentity(value.offensiveFoulDrawer);
}

function isAttribution(value: unknown): value is MatchupEventsV2Attribution {
  return isRecord(value)
    && typeof value.status === 'string'
    && isId(value.offensePlayerId)
    && isId(value.defensePlayerId);
}

function isProvenance(value: unknown): value is MatchupEventsV2Provenance {
  return isRecord(value)
    && typeof value.eventSet === 'string'
    && typeof value.eventJoin === 'string'
    && typeof value.foulDrawer === 'string';
}

function isRelationship(value: unknown): value is MatchupEventsV2DefensiveActorRelationship {
  return isRecord(value)
    && typeof value.overall === 'string'
    && hasOptionalString(value, 'stealer')
    && hasOptionalString(value, 'blocker')
    && hasOptionalString(value, 'shootingFouler')
    && hasOptionalString(value, 'offensiveFoulDrawer');
}

function isSourceOverlapAssignment(value: unknown): value is MatchupEventsV2SourceOverlapAssignment {
  if (!isRecord(value)) return false;
  return (value.offense === undefined || isPlayerIdentity(value.offense))
    && (value.defense === undefined || isPlayerIdentity(value.defense))
    && (value.playerId === undefined || isId(value.playerId))
    && (value.name === undefined || typeof value.name === 'string');
}

function isSourceOverlap(value: unknown): value is MatchupEventsV2SourceOverlap {
  if (!isRecord(value) || typeof value.observed !== 'boolean') return false;
  const assignmentKeys = ['assignments', 'otherAssignments', 'matchupAssignments'];
  return assignmentKeys.every((key: string) => {
    const assignments = value[key];
    return assignments === undefined || (
      Array.isArray(assignments)
      && assignments.every(isSourceOverlapAssignment)
    );
  });
}

function isFreeThrowTrip(value: unknown): value is MatchupEventsV2FreeThrowTrip {
  return isRecord(value)
    && isFiniteNumber(value.expectedAttempts)
    && isFiniteNumber(value.observedAttempts)
    && Array.isArray(value.observedOrdinals)
    && value.observedOrdinals.every(isFiniteNumber)
    && typeof value.complete === 'boolean'
    && typeof value.stopReason === 'string';
}

function isEvent(value: unknown): value is MatchupEventsV2Event {
  if (!isRecord(value)) return false;
  return isId(value.gameEventId)
    && isFiniteNumber(value.period)
    && typeof value.clock === 'string'
    && isStringArray(value.descriptions)
    && isStringArray(value.types)
    && isStringArray(value.sourceMeasures)
    && (value.primaryAction === null || isAction(value.primaryAction))
    && Array.isArray(value.counterpartActions)
    && value.counterpartActions.every(isAction)
    && Array.isArray(value.allEventActions)
    && value.allEventActions.every(isAction)
    && isCreditedDefensiveActors(value.creditedDefensiveActors)
    && isAttribution(value.matchupAttribution)
    && isProvenance(value.provenance)
    && isRelationship(value.defensiveActorRelationship)
    && (value.sourceOverlap === undefined || value.sourceOverlap === null || isSourceOverlap(value.sourceOverlap))
    && (value.freeThrowTrip === undefined || value.freeThrowTrip === null || isFreeThrowTrip(value.freeThrowTrip));
}

function normalizeId(value: MatchupEventsV2Id): string {
  return String(value).trim();
}

/** Strictly accepts only the frozen canonical Matchup Events v1.3 contract. */
export function isGameMatchupEventsV2Response(value: unknown): value is GameMatchupEventsV2Response {
  if (!isRecord(value) || !isRecord(value.pairing)) return false;
  return value.success === true
    && value.type === MATCHUP_EVENTS_V2_PROXY_TYPE
    && typeof value.gameId === 'string'
    && value.contractRelease === MATCHUP_EVENTS_V2_CONTRACT_RELEASE
    && value.schemaVersion === MATCHUP_EVENTS_V2_SCHEMA_VERSION
    && value.sourceStatus === 'ok'
    && (value.errorCategory === null || typeof value.errorCategory === 'string')
    && isPlayerIdentity(value.pairing.offense)
    && isPlayerIdentity(value.pairing.defense)
    && isExposure(value.matchupExposure)
    && isDefenderActivity(value.defenderActivity)
    && isEventSummary(value.eventSummary)
    && Array.isArray(value.events)
    && value.events.every(isEvent);
}

/** Accepts a v1.3 response only when its normalized game and pair IDs match the request. */
export function isGameMatchupEventsV2ResponseForPair(
  value: unknown,
  gameId: string,
  offensePlayerId: string,
  defensePlayerId: string,
): value is GameMatchupEventsV2Response {
  return isGameMatchupEventsV2Response(value)
    && normalizeId(value.gameId) === normalizeId(gameId)
    && normalizeId(value.pairing.offense.playerId) === normalizeId(offensePlayerId)
    && normalizeId(value.pairing.defense.playerId) === normalizeId(defensePlayerId);
}
