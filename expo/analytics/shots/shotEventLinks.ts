import type { CanonicalShotEvent } from './shotTypes';

const NBA_STATS_EVENT_BASE = 'https://www.nba.com/stats/events';

function isValidNbaGameId(gameId: string | undefined | null): gameId is string {
  if (!gameId) return false;
  return /^00\d{8}$/.test(gameId);
}

function isValidEventNum(eventNum: number | undefined | null): eventNum is number {
  return eventNum != null && Number.isFinite(eventNum) && eventNum > 0;
}

function isNonEmptyString(value: string | undefined | null): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isFieldGoalShot(shot: CanonicalShotEvent): boolean {
  if (shot.isFreeThrow === true) return false;
  if (shot.shotZone === 'ft') return false;
  return shot.points === 2 || shot.points === 3;
}

export interface BuildNbaEventUrlOptions {
  season?: string | null;
  title?: string | null;
}

export function buildNbaEventUrl(
  gameId: string | undefined | null,
  eventNum: number | undefined | null,
  options?: BuildNbaEventUrlOptions,
): string | undefined {
  if (!isValidNbaGameId(gameId)) return undefined;
  if (!isValidEventNum(eventNum)) return undefined;

  const params = new URLSearchParams();
  params.append('CFID', '');
  params.append('CFPARAMS', '');
  params.append('GameEventID', String(eventNum));
  params.append('GameID', gameId);
  if (isNonEmptyString(options?.season)) {
    params.append('Season', options!.season!.trim());
  }
  params.append('flag', '1');
  if (isNonEmptyString(options?.title)) {
    params.append('title', options!.title!.trim());
  }

  return `${NBA_STATS_EVENT_BASE}?${params.toString()}`;
}

export function getShotEventUrl(shot: CanonicalShotEvent): string | undefined {
  if (!isFieldGoalShot(shot)) {
    return undefined;
  }

  if (isNonEmptyString(shot.nbaEventUrl)) {
    return shot.nbaEventUrl;
  }

  const eventId = shot.gameEventId ?? shot.eventNum;
  const hasGameId = isValidNbaGameId(shot.gameId);
  const hasEventId = isValidEventNum(eventId);

  if (__DEV__ && (!hasGameId || !hasEventId)) {
    console.warn(
      '[ShotEventLinks] Field-goal shot missing required metadata for event URL',
      {
        id: shot.id,
        gameId: shot.gameId,
        gameEventId: shot.gameEventId,
        eventNum: shot.eventNum,
      },
    );
    return undefined;
  }

  return buildNbaEventUrl(shot.gameId, eventId, {
    season: shot.season ?? null,
    title: shot.rawDescription ?? null,
  });
}
