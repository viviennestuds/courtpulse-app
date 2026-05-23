import { CanonicalShotEvent, ShotQuery } from './shotTypes';

export function shotMatchesQuery(shot: CanonicalShotEvent, query: ShotQuery): boolean {
  if (query.teamId != null && shot.teamId !== query.teamId) return false;
  if (query.opponentTeamId != null && shot.opponentTeamId !== query.opponentTeamId) return false;
  if (query.playerId != null && shot.playerId !== query.playerId) return false;
  if (query.assisterId != null && shot.assisterId !== query.assisterId) return false;

  if (query.period != null && shot.period !== query.period) return false;
  if (query.periods != null && query.periods.length > 0 && !query.periods.includes(shot.period)) return false;

  if (query.runId != null && shot.runId !== query.runId) return false;
  if (query.droughtId != null && shot.droughtId !== query.droughtId) return false;

  if (query.shotZone != null && shot.shotZone !== query.shotZone) return false;
  if (query.result != null && shot.result !== query.result) return false;

  return true;
}

export function filterShots(shots: CanonicalShotEvent[], query: ShotQuery): CanonicalShotEvent[] {
  if (Object.keys(query).length === 0) return shots;
  return shots.filter(shot => shotMatchesQuery(shot, query));
}
