import type {
  PlayerDirectorySnapshot,
  PlayersPhaseAvailability,
  PlayersPhaseAvailabilityResponse,
  PlayersSeasonPhase,
} from '@/types/playersDirectory';

export const PLAYERS_DIRECTORY_SCHEMA_VERSION = 'playersDirectory.v1' as const;
export const PLAYERS_PHASE_AVAILABILITY_SCHEMA_VERSION = 'playersPhaseAvailability.v1' as const;

/** Returns the canonical backend cache identity for one league-wide directory snapshot. */
export function getPlayersDirectoryCacheKey(season: string, phase: PlayersSeasonPhase): string {
  return `players-directory:${season}:${phase}:v1`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isPhaseAvailability(value: unknown): value is PlayersPhaseAvailability {
  if (!isRecord(value)) return false;
  const availableIsValid = typeof value.available === 'boolean' || value.available === null;
  const phaseIsValid = value.phase === 'regular' || value.phase === 'postseason' || value.phase === 'playIn';
  const statusIsValid = value.status === 'ok' || value.status === 'empty' || value.status === 'failed' || value.status === 'unsupported';
  if (!phaseIsValid || !statusIsValid || typeof value.supported !== 'boolean' || !availableIsValid) return false;
  if (value.status === 'failed') return value.available === null;
  if (value.status === 'unsupported') return value.supported === false && value.available === false;
  if (value.status === 'empty') return value.available === false && value.noDataConfirmed === true;
  return value.supported === true && value.available === true;
}

function hasValidPhaseMap(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return isPhaseAvailability(value.regular)
    && isPhaseAvailability(value.playIn)
    && isPhaseAvailability(value.postseason);
}

function hasValidPlayerStructure(value: unknown, season: string, phase: PlayersSeasonPhase): boolean {
  if (!isRecord(value)) return false;
  if (!(typeof value.playerId === 'number' || typeof value.playerId === 'string')) return false;
  if (!isRecord(value.identity) || typeof value.identity.fullName !== 'string' || !isRecord(value.identity.team)) return false;
  if (!isRecord(value.seasonContext)) return false;
  if (value.seasonContext.season !== season || value.seasonContext.phase !== phase) return false;
  if (!isFiniteNumber(value.seasonContext.teamCount) || typeof value.seasonContext.isMultiTeam !== 'boolean') return false;
  return isRecord(value.base)
    && isRecord(value.advanced)
    && isRecord(value.usage)
    && isRecord(value.scoringProfile)
    && isRecord(value.ranks)
    && isRecord(value.dataAvailability);
}

/**
 * Defensively validates identity and key structural invariants before a directory
 * response can enter either device cache. Scalar stats remain backend-owned.
 */
export function isValidPlayerDirectorySnapshot(
  value: unknown,
  requestedSeason: string,
  requestedPhase: PlayersSeasonPhase,
): value is PlayerDirectorySnapshot {
  if (!isRecord(value)) return false;
  if (value.success !== true || value.schemaVersion !== PLAYERS_DIRECTORY_SCHEMA_VERSION || value.type !== 'playersDirectory') return false;
  if (value.season !== requestedSeason || value.phase !== requestedPhase || value.requestedPhase !== requestedPhase) return false;
  if (!Array.isArray(value.players)) return false;
  if (typeof value.dataAvailable !== 'boolean' || typeof value.noDataConfirmed !== 'boolean') return false;
  if (!isRecord(value.cachePolicy) || value.cachePolicy.key !== getPlayersDirectoryCacheKey(requestedSeason, requestedPhase)) return false;
  if (value.cachePolicy.schemaKey !== PLAYERS_DIRECTORY_SCHEMA_VERSION || !isRecord(value.cachePolicy.freshness)) return false;
  const staleAfterSeconds = value.cachePolicy.freshness.staleAfterSeconds;
  if (!(staleAfterSeconds === null || (isFiniteNumber(staleAfterSeconds) && staleAfterSeconds >= 0))) return false;
  if (typeof value.cachePolicy.freshness.refreshStrategy !== 'string') return false;
  if (!isRecord(value.population) || !isFiniteNumber(value.population.playerCount)) return false;
  if (value.population.playerCount !== value.players.length) return false;
  if (!isRecord(value.sourceStatus) || !hasValidPhaseMap(value.phaseAvailability)) return false;
  if (!value.players.every((player) => hasValidPlayerStructure(player, requestedSeason, requestedPhase))) return false;

  if (value.dataAvailable) {
    return value.players.length > 0 && value.noDataConfirmed === false;
  }
  return value.players.length === 0 && value.noDataConfirmed === true;
}

/** Validates the lightweight phase-availability response without converting failures to empty phases. */
export function isValidPlayersPhaseAvailabilityResponse(
  value: unknown,
  requestedSeason: string,
): value is PlayersPhaseAvailabilityResponse {
  if (!isRecord(value)) return false;
  return value.success === true
    && value.schemaVersion === PLAYERS_PHASE_AVAILABILITY_SCHEMA_VERSION
    && value.type === 'playersPhaseAvailability'
    && value.season === requestedSeason
    && typeof value.partial === 'boolean'
    && hasValidPhaseMap(value.phases);
}
