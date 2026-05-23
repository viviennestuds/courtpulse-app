import { CdnPbpAction } from '@/services/nbaGameData';
import { parsePTToSeconds, parsePTClock } from '@/services/nbaApi';
import {
  StretchLineupContext,
  StretchContextStats,
  StretchPhaseEvent,
  StretchPhaseEventKind,
  StretchMode,
  DroughtLineupPhase,
  PlayByPlayEvent,
} from '@/types';

function parseClockToSec(clock: string): number {
  const parts = clock.split(':');
  if (parts.length === 2) return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
  return 0;
}

function gameTime(period: number, clockSec: number): number {
  const periodLen = period <= 4 ? 720 : 300;
  const prior = period - 1;
  return prior * (prior < 4 ? 720 : 300) + (periodLen - clockSec);
}

function fmt(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${Math.round(s).toString().padStart(2, '0')}`;
}

function periodFromGameTime(gt: number): number {
  if (gt <= 720) return 1;
  if (gt <= 1440) return 2;
  if (gt <= 2160) return 3;
  if (gt <= 2880) return 4;
  return 5 + Math.floor((gt - 2880) / 300);
}

function clockInPeriod(gt: number): string {
  const period = periodFromGameTime(gt);
  const periodLen = period <= 4 ? 720 : 300;
  const priorElapsed = period <= 4 ? (period - 1) * 720 : 2880 + (period - 5) * 300;
  const elapsedInPeriod = gt - priorElapsed;
  const remaining = Math.max(0, periodLen - elapsedInPeriod);
  return fmt(remaining);
}

export function computeStretchLineupPhasesWithEvents(
  rawActions: CdnPbpAction[],
  teamId: string,
  startGameTime: number,
  endGameTime: number,
  mode: StretchMode,
): { context: StretchLineupContext; phases: DroughtLineupPhase[] } {
  const teamIdNum = parseInt(teamId, 10);
  const phasesRaw: { players: Set<string>; startTime: number; endTime: number; events: StretchPhaseEvent[] }[] = [];
  let currentLineup = new Set<string>();
  let phaseStart = startGameTime;
  let phaseEvents: StretchPhaseEvent[] = [];
  let substitutionCount = 0;

  const totalDuration = Math.max(1, endGameTime - startGameTime);

  // Assist lookup (assist actions follow made shots; link by adjacency)
  const assistsByActionNumber = new Map<number, string>();
  for (let i = 0; i < rawActions.length; i++) {
    const a = rawActions[i];
    if (a.actionType === 'assist' && a.playerNameI) {
      // pair with preceding made shot by same team
      for (let j = i - 1; j >= Math.max(0, i - 4); j--) {
        const prev = rawActions[j];
        if ((prev.actionType === '2pt' || prev.actionType === '3pt') && prev.shotResult?.toLowerCase() === 'made' && prev.teamId === a.teamId) {
          assistsByActionNumber.set(prev.actionNumber, a.playerNameI);
          break;
        }
      }
    }
  }

  for (const action of rawActions) {
    const at = action.actionType?.toLowerCase() ?? '';
    const clockSec = parsePTToSeconds(action.clock);
    const actionTime = gameTime(action.period, clockSec);

    if (actionTime < startGameTime) {
      if (action.teamId === teamIdNum) {
        if (at === 'substitution') {
          if (action.subType === 'out') currentLineup.delete(action.playerNameI);
          else if (action.subType === 'in') currentLineup.add(action.playerNameI);
        } else if (action.playerNameI && action.personId) {
          currentLineup.add(action.playerNameI);
          if (currentLineup.size > 5) {
            const arr = Array.from(currentLineup);
            currentLineup = new Set(arr.slice(arr.length - 5));
          }
        }
      }
      if (at === 'period' && action.subType === 'start') currentLineup = new Set();
      continue;
    }
    if (actionTime > endGameTime) break;

    // Curated event capture for team
    if (action.teamId === teamIdNum) {
      const ev = toStretchPhaseEvent(action, assistsByActionNumber.get(action.actionNumber), mode);
      if (ev) phaseEvents.push(ev);
    } else if (at === 'timeout' && mode === 'drought') {
      phaseEvents.push({
        kind: 'timeout',
        period: action.period,
        clock: parsePTClock(action.clock),
        description: action.description || 'Timeout',
      });
    }

    if (at === 'substitution' && action.teamId === teamIdNum) {
      substitutionCount++;
      if (currentLineup.size >= 5) {
        phasesRaw.push({
          players: new Set(currentLineup),
          startTime: phaseStart,
          endTime: actionTime,
          events: phaseEvents,
        });
      }
      phaseEvents = [];
      if (action.subType === 'out' && action.playerNameI) currentLineup.delete(action.playerNameI);
      else if (action.subType === 'in' && action.playerNameI) currentLineup.add(action.playerNameI);
      phaseStart = actionTime;
    } else if (action.teamId === teamIdNum && action.playerNameI && action.personId) {
      currentLineup.add(action.playerNameI);
      if (currentLineup.size > 5) {
        const arr = Array.from(currentLineup);
        currentLineup = new Set(arr.slice(arr.length - 5));
      }
    }
  }

  if (currentLineup.size >= 5) {
    phasesRaw.push({ players: new Set(currentLineup), startTime: phaseStart, endTime: endGameTime, events: phaseEvents });
  }

  if (phasesRaw.length === 0) {
    return {
      context: { primaryLineup: [], primaryLineupMinuteShare: 0, substitutionCount: Math.floor(substitutionCount / 2) },
      phases: [],
    };
  }

  let best = phasesRaw[0];
  let bestDur = best.endTime - best.startTime;
  for (let i = 1; i < phasesRaw.length; i++) {
    const d = phasesRaw[i].endTime - phasesRaw[i].startTime;
    if (d > bestDur) { bestDur = d; best = phasesRaw[i]; }
  }

  const share = Math.round((bestDur / totalDuration) * 100);

  const phases: DroughtLineupPhase[] = phasesRaw.map(p => ({
    players: Array.from(p.players).slice(0, 5),
    startClock: clockInPeriod(p.startTime),
    endClock: clockInPeriod(p.endTime),
    durationSeconds: p.endTime - p.startTime,
    period: periodFromGameTime(p.startTime),
    events: p.events,
  }));

  return {
    context: {
      primaryLineup: Array.from(best.players).slice(0, 5),
      primaryLineupMinuteShare: share,
      substitutionCount: Math.floor(substitutionCount / 2),
      phases: phases.length > 1 ? phases : phases,
    },
    phases,
  };
}

function toStretchPhaseEvent(
  action: CdnPbpAction,
  assister: string | undefined,
  mode: StretchMode,
): StretchPhaseEvent | null {
  const at = action.actionType?.toLowerCase() ?? '';
  const sr = action.shotResult?.toLowerCase() ?? '';
  const base = {
    period: action.period,
    clock: parsePTClock(action.clock),
    playerName: action.playerNameI || undefined,
    description: action.description || '',
  };

  if ((at === '2pt' || at === '3pt') && sr === 'made') {
    if (mode !== 'run') return null;
    return {
      ...base,
      kind: 'made_fg',
      points: at === '3pt' ? 3 : 2,
      assisterName: assister,
    };
  }
  if ((at === '2pt' || at === '3pt') && sr === 'missed') {
    if (mode !== 'drought') return null;
    return { ...base, kind: 'missed_fg' };
  }
  if (at === 'freethrow' && sr === 'made') {
    if (mode !== 'run') return null;
    return { ...base, kind: 'made_ft', points: 1 };
  }
  if (at === 'freethrow' && sr === 'missed') {
    if (mode !== 'drought') return null;
    return { ...base, kind: 'missed_ft' };
  }
  if (at === 'turnover') {
    if (mode !== 'drought') return null;
    return { ...base, kind: 'turnover' };
  }
  if (at === 'steal' && mode === 'run') {
    return { ...base, kind: 'steal' };
  }
  if (at === 'block' && mode === 'run') {
    return { ...base, kind: 'block' };
  }
  if (at === 'rebound' && action.subType === 'offensive' && mode === 'run') {
    return { ...base, kind: 'offensive_rebound' };
  }
  if (at === 'timeout' && mode === 'drought') {
    return { ...base, kind: 'timeout' };
  }
  return null;
}

export function computeStretchContextStats(
  rawActions: CdnPbpAction[],
  teamId: string,
  startGameTime: number,
  endGameTime: number,
): StretchContextStats {
  const teamIdNum = parseInt(teamId, 10);
  let fga = 0, fgm = 0, fta = 0, ftm = 0, points = 0, assists = 0, turnovers = 0, offReb = 0;
  const finisherPoints = new Map<string, number>();

  for (const action of rawActions) {
    const clockSec = parsePTToSeconds(action.clock);
    const t = gameTime(action.period, clockSec);
    if (t < startGameTime || t > endGameTime) continue;
    if (action.teamId !== teamIdNum) continue;
    const at = action.actionType?.toLowerCase() ?? '';
    const sr = action.shotResult?.toLowerCase() ?? '';
    const assistPersonId = (action as unknown as Record<string, unknown>).assistPersonId;
    if (at === '2pt' || at === '3pt') {
      fga++;
      if (sr === 'made') {
        fgm++;
        const p = at === '3pt' ? 3 : 2;
        points += p;
        const name = action.playerNameI || 'Unknown';
        finisherPoints.set(name, (finisherPoints.get(name) ?? 0) + p);
        if (assistPersonId) assists++;
      }
    } else if (at === 'freethrow') {
      fta++;
      if (sr === 'made') {
        ftm++;
        points += 1;
        const name = action.playerNameI || 'Unknown';
        finisherPoints.set(name, (finisherPoints.get(name) ?? 0) + 1);
      }
    } else if (at === 'assist') {
      assists++;
    } else if (at === 'turnover') {
      turnovers++;
    } else if (at === 'rebound' && action.subType === 'offensive') {
      offReb++;
    }
  }

  const possessions = fga + 0.44 * fta;
  const ppo = possessions > 0 ? points / possessions : null;
  const astToRatio = turnovers > 0 ? assists / turnovers : (assists > 0 ? assists : null);
  const totalFinisherPoints = Array.from(finisherPoints.values()).reduce((s, v) => s + v, 0);
  const playFinishers = Array.from(finisherPoints.entries())
    .map(([name, pts]) => ({
      name,
      points: pts,
      share: totalFinisherPoints > 0 ? Math.round((pts / totalFinisherPoints) * 100) : 0,
    }))
    .sort((a, b) => b.points - a.points)
    .slice(0, 4);

  return {
    points,
    fga,
    fgm,
    fta,
    ftm,
    assists,
    turnovers,
    offensiveRebounds: offReb,
    ppo,
    astToRatio,
    playFinishers,
  };
}

export function generateRunHighlightText(
  events: PlayByPlayEvent[],
  teamAbbr: string,
  startGameTime: number,
  endGameTime: number,
  totalPoints: number,
  opponentPoints: number,
  fallback: string,
): string {
  const within = events.filter(e => {
    const t = gameTime(e.period, parseClockToSec(e.clock));
    return t >= startGameTime && t <= endGameTime;
  });

  // Unanswered streak
  let unanswered = 0;
  let maxUnanswered = 0;
  for (const e of within) {
    if (e.eventType === 'score' && e.scoreDelta) {
      if (e.teamAbbr === teamAbbr) {
        unanswered += e.scoreDelta;
        if (unanswered > maxUnanswered) maxUnanswered = unanswered;
      } else {
        unanswered = 0;
      }
    }
  }

  if (maxUnanswered >= 8) {
    return `${maxUnanswered} unanswered points sparked a ${totalPoints}-${opponentPoints} run`;
  }

  // 3PT streak
  let threeStreak = 0;
  let maxThreeStreak = 0;
  for (const e of within) {
    if (e.teamAbbr === teamAbbr && e.eventType === 'score' && e.scoreDelta === 3) {
      threeStreak++;
      if (threeStreak > maxThreeStreak) maxThreeStreak = threeStreak;
    } else if (e.teamAbbr === teamAbbr && e.eventType === 'score') {
      threeStreak = 0;
    }
  }
  if (maxThreeStreak >= 3) {
    return `${maxThreeStreak} straight made threes fueled a ${totalPoints}-${opponentPoints} run`;
  }

  // Player-driven
  const playerPoints = new Map<string, number>();
  for (const e of within) {
    if (e.teamAbbr === teamAbbr && e.eventType === 'score' && e.scoreDelta && e.playerName) {
      playerPoints.set(e.playerName, (playerPoints.get(e.playerName) ?? 0) + e.scoreDelta);
    }
  }
  let topPlayer = '';
  let topPts = 0;
  for (const [name, pts] of playerPoints.entries()) {
    if (pts > topPts) { topPts = pts; topPlayer = name; }
  }
  if (topPlayer && topPts >= Math.max(8, Math.floor(totalPoints * 0.5))) {
    return `${topPlayer} scored ${topPts} points during a ${totalPoints}-${opponentPoints} run`;
  }

  return fallback;
}

export function generateDroughtHighlightText(
  endingEventCaption: string | null,
  contextStats: StretchContextStats,
  durationStr: string,
  rawActions: CdnPbpAction[],
  teamId: string,
  startGameTime: number,
  endGameTime: number,
): string {
  // Prefer an explanatory pattern if we can detect one
  const teamIdNum = parseInt(teamId, 10);
  let onlyFtScored = contextStats.points > 0 && contextStats.fgm === 0 && contextStats.ftm > 0;
  if (onlyFtScored) {
    return `Only free throws during a ${durationStr} field-goal drought`;
  }
  if (contextStats.turnovers >= 3) {
    return `${contextStats.turnovers} turnovers stalled a ${durationStr} stretch`;
  }
  if (contextStats.fga >= 5 && contextStats.fgm === 0) {
    return `${contextStats.fga} missed shots defined a ${durationStr} drought`;
  }
  return endingEventCaption ?? `${durationStr} scoring drought`;
}

export { gameTime as stretchGameTime, parseClockToSec as stretchParseClockToSec };
