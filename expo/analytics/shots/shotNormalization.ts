import { CdnPbpAction } from '@/services/nbaGameData';
import { parsePTToSeconds, parsePTClock } from '@/services/nbaApi';
import { hasExplicitFastBreakSignal, isClutchContext } from '@/utils/basketballContext';
import { CanonicalShotEvent, ShotContextTag, ShotResult, ShotZone } from './shotTypes';

const RIM_SUBTYPES = new Set([
  'layup', 'dunk', 'tip', 'alleyoop', 'putback', 'hook',
  'driving layup', 'reverse layup', 'finger roll',
  'cutting layup', 'driving dunk', 'alley oop dunk',
  'alley oop layup', 'tip layup', 'putback layup', 'putback dunk',
  'hook shot', 'driving hook', 'turnaround hook',
]);

const RIM_DISTANCE_THRESHOLD = 4;
const THREE_POINT_DISTANCE_THRESHOLD = 22;

function classifyShotZone(action: CdnPbpAction): ShotZone {
  const actionType = action.actionType?.toLowerCase() ?? '';
  if (actionType === '3pt') return '3pt';

  const subType = (action.subType ?? '').toLowerCase();
  const distance = action.shotDistance ?? 0;

  if (RIM_SUBTYPES.has(subType)) return 'rim';

  if (subType.includes('layup') || subType.includes('dunk') || subType.includes('hook') || subType.includes('tip')) {
    return 'rim';
  }

  if (distance > 0 && distance <= RIM_DISTANCE_THRESHOLD) return 'rim';
  if (distance >= THREE_POINT_DISTANCE_THRESHOLD) return '3pt';

  return 'mid';
}

function resolveResult(action: CdnPbpAction): ShotResult {
  return action.shotResult?.toLowerCase() === 'made' ? 'make' : 'miss';
}

function resolvePoints(action: CdnPbpAction): 2 | 3 {
  return action.actionType?.toLowerCase() === '3pt' ? 3 : 2;
}

function gameTimeElapsed(period: number, clockSeconds: number): number {
  const periodLength = period <= 4 ? 720 : 300;
  const periodsCompleted = period - 1;
  const baseTime = periodsCompleted * (periodsCompleted < 4 ? 720 : 300);
  return baseTime + (periodLength - clockSeconds);
}

function normalizeCoordinates(action: CdnPbpAction): { x: number | null; y: number | null } {
  const hasLegacyCoordinates = Number.isFinite(action.xLegacy) && Number.isFinite(action.yLegacy) && (action.xLegacy !== 0 || action.yLegacy !== 0);
  if (hasLegacyCoordinates) {
    const x = ((action.xLegacy ?? 0) + 250) / 500;
    const y = (action.yLegacy ?? 0) / 470;
    return {
      x: Math.max(0, Math.min(1, x)),
      y: Math.max(0, Math.min(1, y)),
    };
  }
  if (action.x != null && action.y != null && (action.x !== 0 || action.y !== 0)) {
    return {
      x: Math.max(0, Math.min(1, action.x / 100)),
      y: Math.max(0, Math.min(1, action.y / 100)),
    };
  }
  return { x: null, y: null };
}

function deriveSeasonFromGameId(gameId: string): string | undefined {
  if (!/^00\d{8}$/.test(gameId)) return undefined;
  const yy = gameId.slice(3, 5);
  const yearNum = parseInt(yy, 10);
  if (!Number.isFinite(yearNum)) return undefined;
  const startYear = yearNum >= 70 ? 1900 + yearNum : 2000 + yearNum;
  const endYear = (startYear + 1) % 100;
  return `${startYear}-${String(endYear).padStart(2, '0')}`;
}

function extractAssister(action: CdnPbpAction): { assisterId: string | null; assisterName: string | null } {
  const assistId = (action as unknown as Record<string, unknown>).assistPersonId;
  const assistName = (action as unknown as Record<string, unknown>).assistPlayerNameInitial;
  if (assistId && typeof assistId === 'number' && assistId > 0) {
    return {
      assisterId: String(assistId),
      assisterName: typeof assistName === 'string' ? assistName : null,
    };
  }
  return { assisterId: null, assisterName: null };
}

function isShotAction(action: CdnPbpAction): boolean {
  const actionType = action.actionType?.toLowerCase() ?? '';
  const isFG = actionType === '2pt' || actionType === '3pt';
  const isFT = actionType === 'freethrow';
  if (!isFG && !isFT) return false;
  if (isFG && !action.isFieldGoal && action.shotResult == null) return false;
  return action.shotResult != null;
}

function isMadeShotAction(action: CdnPbpAction): boolean {
  return isShotAction(action) && action.shotResult?.toLowerCase() === 'made';
}

function isFreeThrowAction(action: CdnPbpAction): boolean {
  return action.actionType?.toLowerCase() === 'freethrow';
}

function buildExplicitFastBreakContext(action: CdnPbpAction) {
  return {
    rawActionType: action.actionType || undefined,
    rawSubType: action.subType || undefined,
    rawQualifiers: action.qualifiers ?? [],
  };
}

function deriveOffTurnoverActionNumbers(rawActions: CdnPbpAction[]): Set<number> {
  const tagged = new Set<number>();
  let pendingTurnoverTeamId: string | null = null;
  let activeFreeThrowTeamId: string | null = null;

  for (const action of rawActions) {
    const actionType = action.actionType?.toLowerCase() ?? '';
    const teamId = action.teamId ? String(action.teamId) : '';

    if (activeFreeThrowTeamId && isMadeShotAction(action) && isFreeThrowAction(action) && teamId === activeFreeThrowTeamId) {
      tagged.add(action.actionNumber);
      continue;
    }

    if (actionType === 'turnover') {
      pendingTurnoverTeamId = teamId || null;
      activeFreeThrowTeamId = null;
      continue;
    }

    if (actionType === 'timeout') {
      pendingTurnoverTeamId = null;
      activeFreeThrowTeamId = null;
      continue;
    }

    if (pendingTurnoverTeamId && isMadeShotAction(action) && teamId && teamId !== pendingTurnoverTeamId) {
      tagged.add(action.actionNumber);
      activeFreeThrowTeamId = isFreeThrowAction(action) ? teamId : null;
      if (!activeFreeThrowTeamId) pendingTurnoverTeamId = null;
      continue;
    }

    if (activeFreeThrowTeamId && (!isFreeThrowAction(action) || teamId !== activeFreeThrowTeamId)) {
      pendingTurnoverTeamId = null;
      activeFreeThrowTeamId = null;
    }

    if (pendingTurnoverTeamId && (action.shotResult?.toLowerCase() === 'missed' || actionType === 'rebound')) {
      pendingTurnoverTeamId = null;
      activeFreeThrowTeamId = null;
    }
  }

  return tagged;
}

export function normalizeShotEvents(
  rawActions: CdnPbpAction[],
  gameId: string,
  homeTeamId?: string,
  awayTeamId?: string,
): CanonicalShotEvent[] {
  const shots: CanonicalShotEvent[] = [];
  const offTurnoverActionNumbers = deriveOffTurnoverActionNumbers(rawActions);

  for (const action of rawActions) {
    const actionType = action.actionType?.toLowerCase() ?? '';
    const isFG = actionType === '2pt' || actionType === '3pt';
    const isFT = actionType === 'freethrow';
    if (!isFG && !isFT) continue;
    if (isFG && !action.isFieldGoal && action.shotResult == null) continue;
    if (isFT && action.shotResult == null) continue;

    const clockSeconds = parsePTToSeconds(action.clock);
    const clockSecondsForContext = action.clock ? clockSeconds : null;
    const { x, y } = isFT ? { x: null, y: null } : normalizeCoordinates(action);
    const { assisterId, assisterName } = extractAssister(action);
    const result = resolveResult(action);
    const qualifiers = action.qualifiers ?? [];
    const normalizedQualifiers = qualifiers.map(qualifier => qualifier.toLowerCase());
    const contextTags: ShotContextTag[] = offTurnoverActionNumbers.has(action.actionNumber) ? ['off_turnover'] : [];

    const teamIdStr = String(action.teamId);
    let opponentTeamId: string | undefined;
    if (homeTeamId && awayTeamId) {
      opponentTeamId = teamIdStr === homeTeamId ? awayTeamId : homeTeamId;
    }

    const scoreHomeNum = action.scoreHome != null ? parseInt(action.scoreHome, 10) : NaN;
    const scoreAwayNum = action.scoreAway != null ? parseInt(action.scoreAway, 10) : NaN;

    const shot: CanonicalShotEvent = {
      id: `shot-${gameId}-${action.actionNumber}`,
      gameId,
      eventNum: action.eventNum ?? action.actionNumber,
      gameEventId: action.eventNum ?? action.actionNumber,
      season: deriveSeasonFromGameId(gameId),

      teamId: teamIdStr,
      opponentTeamId,

      playerId: action.personId ? String(action.personId) : null,
      playerName: action.playerNameI || action.playerName || null,

      assisterId: isFT ? null : assisterId,
      assisterName: isFT ? null : assisterName,

      period: action.period,
      periodTime: parsePTClock(action.clock) || null,
      clockSecondsRemaining: clockSecondsForContext,
      gameSecondsElapsed: gameTimeElapsed(action.period, clockSeconds),

      result,
      shotZone: isFT ? 'ft' : classifyShotZone(action),
      points: isFT ? 1 : resolvePoints(action),

      x,
      y,

      scoreHome: Number.isFinite(scoreHomeNum) ? scoreHomeNum : null,
      scoreAway: Number.isFinite(scoreAwayNum) ? scoreAwayNum : null,

      runId: null,
      droughtId: null,

      isFastBreak: result === 'make' && hasExplicitFastBreakSignal(buildExplicitFastBreakContext(action)),
      isSecondChance: normalizedQualifiers.includes('2ndchance'),
      isOffAssist: !isFT && result === 'make' && assisterId != null,
      isFreeThrow: isFT,
      isClutch: isClutchContext({
        period: action.period,
        clockSecondsRemaining: clockSecondsForContext,
        homeScore: Number.isFinite(scoreHomeNum) ? scoreHomeNum : null,
        awayScore: Number.isFinite(scoreAwayNum) ? scoreAwayNum : null,
      }),
      contextTags,

      rawActionType: action.actionType || undefined,
      rawSubType: action.subType || undefined,
      rawQualifiers: qualifiers,
      rawDescription: action.description || undefined,
    };

    shots.push(shot);
  }

  console.log(`[ShotNormalization] Normalized ${shots.length} shot events from ${rawActions.length} raw actions for game ${gameId}`);

  const rimCount = shots.filter(s => s.shotZone === 'rim').length;
  const midCount = shots.filter(s => s.shotZone === 'mid').length;
  const threeCount = shots.filter(s => s.shotZone === '3pt').length;
  const ftCount = shots.filter(s => s.shotZone === 'ft').length;
  const makeCount = shots.filter(s => s.result === 'make').length;
  console.log(`[ShotNormalization] Zone breakdown: rim=${rimCount} mid=${midCount} 3pt=${threeCount} ft=${ftCount} | makes=${makeCount} misses=${shots.length - makeCount}`);

  return shots;
}

export function tagShotsWithContext(
  shots: CanonicalShotEvent[],
  runRanges: Array<{ id: string; startGameTime: number; endGameTime: number }>,
  droughtRanges: Array<{ id: string; startGameTime: number; endGameTime: number }>,
): CanonicalShotEvent[] {
  return shots.map(shot => {
    const elapsed = shot.gameSecondsElapsed ?? 0;
    if (elapsed === 0) return shot;

    let runId: string | null = null;
    let droughtId: string | null = null;

    for (const run of runRanges) {
      if (elapsed >= run.startGameTime && elapsed <= run.endGameTime) {
        runId = run.id;
        break;
      }
    }

    for (const drought of droughtRanges) {
      if (elapsed >= drought.startGameTime && elapsed <= drought.endGameTime) {
        droughtId = drought.id;
        break;
      }
    }

    if (runId === shot.runId && droughtId === shot.droughtId) return shot;

    return { ...shot, runId, droughtId };
  });
}
