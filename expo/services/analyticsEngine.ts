import { PlayByPlayEvent, ScoringRun, ScoringDrought, LineupSegment, CustomMetric, DroughtLineupContext, DroughtLineupPhase, DroughtEndingEvent, LineupStint, PlayerOnCourtInterval, CanonicalOnCourtSummary, ReconciliationAudit, CanonicalTimelineSegment, TimelineIntegrityReport, BoxScorePlayer, PlusMinusMismatchCause, OnCourtDetailedStats, GameFlowContext, OnOffRatingStats, ConfidenceLevel, OnOffConfidenceLevel, OnCourtConfidence, PlayerPerformanceStats } from '@/types';
import { computeStretchLineupPhasesWithEvents, computeStretchContextStats, generateRunHighlightText, generateDroughtHighlightText } from '@/analytics/stretches/stretchContext';
import { CdnPbpAction } from './nbaGameData';
import { parsePTToSeconds } from './nbaApi';
import { getTeamColor } from '@/constants/nbaTeams';

const RUN_MIN_POINTS = 8;
const RUN_MIN_NET = 6;
const RUN_WINDOW_SECONDS = 180;
const DROUGHT_MIN_SECONDS = 120;
const LOW_LEVERAGE_LEAD_4MIN = 15;
const LOW_LEVERAGE_LEAD_2MIN = 12;
const LOW_LEVERAGE_LEAD_1MIN = 10;

interface ScoringEvent {
  index: number;
  period: number;
  clockSeconds: number;
  teamId: string;
  teamAbbr: string;
  points: number;
  homeScore: number;
  awayScore: number;
  description: string;
  playerName: string;
}

function extractScoringEvents(events: PlayByPlayEvent[]): ScoringEvent[] {
  return events
    .filter(e => e.eventType === 'score' && e.scoreDelta && e.scoreDelta > 0)
    .map((e, i) => ({
      index: i,
      period: e.period,
      clockSeconds: parseClockToSeconds(e.clock),
      teamId: e.teamId,
      teamAbbr: e.teamAbbr,
      points: e.scoreDelta ?? 0,
      homeScore: e.homeScore,
      awayScore: e.awayScore,
      description: e.description,
      playerName: e.playerName ?? '',
    }));
}

function parseClockToSeconds(clock: string): number {
  const parts = clock.split(':');
  if (parts.length === 2) {
    return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
  }
  return 0;
}

function gameTimeElapsed(period: number, clockSeconds: number): number {
  const periodLength = period <= 4 ? 720 : 300;
  const periodsCompleted = period - 1;
  const baseTime = periodsCompleted * (periodsCompleted < 4 ? 720 : 300);
  return baseTime + (periodLength - clockSeconds);
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${Math.round(secs).toString().padStart(2, '0')}`;
}

export function detectScoringRuns(events: PlayByPlayEvent[], rawActions?: CdnPbpAction[]): ScoringRun[] {
  const scoringEvents = extractScoringEvents(events);
  if (scoringEvents.length === 0) return [];

  const teams = new Set(scoringEvents.map(e => e.teamAbbr));
  const runs: ScoringRun[] = [];
  let runIdCounter = 1;

  for (const team of teams) {
    let i = 0;
    while (i < scoringEvents.length) {
      let bestRun: {
        startIdx: number;
        endIdx: number;
        teamPts: number;
        oppPts: number;
      } | null = null;

      for (let start = i; start < scoringEvents.length; start++) {
        let teamPts = 0;
        let oppPts = 0;

        for (let end = start; end < scoringEvents.length; end++) {
          const se = scoringEvents[end];
          const startEvent = scoringEvents[start];

          const startTime = gameTimeElapsed(startEvent.period, startEvent.clockSeconds);
          const endTime = gameTimeElapsed(se.period, se.clockSeconds);
          const elapsed = endTime - startTime;

          if (elapsed > RUN_WINDOW_SECONDS * 2) break;

          if (se.teamAbbr === team) {
            teamPts += se.points;
          } else {
            oppPts += se.points;
          }

          const net = teamPts - oppPts;
          if (teamPts >= RUN_MIN_POINTS && net >= RUN_MIN_NET) {
            if (!bestRun || net > (bestRun.teamPts - bestRun.oppPts)) {
              bestRun = { startIdx: start, endIdx: end, teamPts, oppPts };
            }
          }
        }

        if (bestRun && bestRun.startIdx === start) break;
      }

      if (bestRun) {
        const startEv = scoringEvents[bestRun.startIdx];
        const endEv = scoringEvents[bestRun.endIdx];
        const teamId = scoringEvents.find(e => e.teamAbbr === team)?.teamId ?? '';

        const playersInRun = new Set<string>();
        for (let j = bestRun.startIdx; j <= bestRun.endIdx; j++) {
          if (scoringEvents[j].teamAbbr === team && scoringEvents[j].playerName) {
            playersInRun.add(scoringEvents[j].playerName);
          }
        }

        const startTime = gameTimeElapsed(startEv.period, startEv.clockSeconds);
        const endTime = gameTimeElapsed(endEv.period, endEv.clockSeconds);
        const durationSecs = Math.abs(endTime - startTime);

        const net = bestRun.teamPts - bestRun.oppPts;

        const lineupCtx = rawActions
          ? computeStretchLineupPhasesWithEvents(rawActions, teamId, startTime, endTime, 'run').context
          : undefined;
        const ctxStats = rawActions
          ? computeStretchContextStats(rawActions, teamId, startTime, endTime)
          : undefined;
        const highlightText = generateRunHighlightText(
          events,
          team,
          startTime,
          endTime,
          bestRun.teamPts,
          bestRun.oppPts,
          endEv.description,
        );

        runs.push({
          id: `run-${runIdCounter++}`,
          teamId,
          teamAbbr: team,
          teamColor: getTeamColor(team),
          startEvent: startEv.description,
          endEvent: endEv.description,
          startClock: `${startEv.clockSeconds >= 60 ? Math.floor(startEv.clockSeconds / 60) : 0}:${(startEv.clockSeconds % 60).toString().padStart(2, '0')}`,
          endClock: `${endEv.clockSeconds >= 60 ? Math.floor(endEv.clockSeconds / 60) : 0}:${(endEv.clockSeconds % 60).toString().padStart(2, '0')}`,
          period: startEv.period,
          scoreChange: `${startEv.homeScore}-${startEv.awayScore} → ${endEv.homeScore}-${endEv.awayScore}`,
          totalPoints: bestRun.teamPts,
          opponentPoints: bestRun.oppPts,
          netPoints: net,
          playCount: bestRun.endIdx - bestRun.startIdx + 1,
          duration: formatDuration(durationSecs),
          players: Array.from(playersInRun),
          keyPlay: endEv.description,
          isDramatic: net >= 10,
          lineupContext: lineupCtx,
          contextStats: ctxStats,
          highlightText,
        });

        i = bestRun.endIdx + 1;
      } else {
        i++;
      }
    }
  }

  runs.sort((a, b) => b.netPoints - a.netPoints);
  return runs;
}

export function detectDroughts(events: PlayByPlayEvent[], rawActions?: CdnPbpAction[]): ScoringDrought[] {
  const teams = new Set(events.filter(e => e.teamAbbr).map(e => e.teamAbbr));
  const droughts: ScoringDrought[] = [];
  let droughtId = 1;

  // Drought is defined as a stretch with no made FIELD GOALS (2pt/3pt).
  // Made free throws soften but do not reset a drought's core signal.
  const isMadeFieldGoal = (e: PlayByPlayEvent): boolean => {
    if (e.eventType !== 'score' || !e.scoreDelta) return false;
    return e.scoreDelta === 2 || e.scoreDelta === 3;
  };

  for (const team of teams) {
    const scoringPlays = events.filter(e => e.teamAbbr === team && isMadeFieldGoal(e));

    for (let i = 0; i < scoringPlays.length - 1; i++) {
      const current = scoringPlays[i];
      const next = scoringPlays[i + 1];

      const currentTime = gameTimeElapsed(current.period, parseClockToSeconds(current.clock));
      const nextTime = gameTimeElapsed(next.period, parseClockToSeconds(next.clock));
      const gap = nextTime - currentTime;

      if (gap >= DROUGHT_MIN_SECONDS) {
        const oppPoints = events
          .filter(e => {
            if (e.eventType !== 'score' || e.teamAbbr === team || !e.scoreDelta) return false;
            const eTime = gameTimeElapsed(e.period, parseClockToSeconds(e.clock));
            return eTime > currentTime && eTime < nextTime;
          })
          .reduce((sum, e) => sum + (e.scoreDelta ?? 0), 0);

        const playersOnFloor = new Set<string>();
        events
          .filter(e => {
            const eTime = gameTimeElapsed(e.period, parseClockToSeconds(e.clock));
            return eTime >= currentTime && eTime <= nextTime && e.teamAbbr === team && e.playerName;
          })
          .forEach(e => { if (e.playerName) playersOnFloor.add(e.playerName); });

        const stretchLineup = rawActions
          ? computeStretchLineupPhasesWithEvents(rawActions, current.teamId, currentTime, nextTime, 'drought')
          : undefined;
        const lineupContext: DroughtLineupContext | undefined = stretchLineup
          ? {
              primaryLineup: stretchLineup.context.primaryLineup,
              primaryLineupMinuteShare: stretchLineup.context.primaryLineupMinuteShare,
              substitutionCount: stretchLineup.context.substitutionCount,
              phases: stretchLineup.phases.length > 0 ? stretchLineup.phases : undefined,
            }
          : rawActions
            ? computeDroughtLineupContext(rawActions, current.teamId, currentTime, nextTime, gap)
            : undefined;

        const endingEvent = computeDroughtEndingEvent(next);

        const contextStats = rawActions
          ? computeStretchContextStats(rawActions, current.teamId, currentTime, nextTime)
          : undefined;

        const durStr = formatDuration(gap);
        const endCaption = endingEvent
          ? (endingEvent.shotType.includes('free throw')
              ? `${endingEvent.shotType} by ${endingEvent.playerName} ends a ${durStr} drought`
              : `${endingEvent.playerName} ${endingEvent.shotType} ends a ${durStr} drought`)
          : null;
        const highlightText = contextStats && rawActions
          ? generateDroughtHighlightText(endCaption, contextStats, durStr, rawActions, current.teamId, currentTime, nextTime)
          : (endCaption ?? undefined);

        droughts.push({
          id: `drought-${droughtId++}`,
          teamId: current.teamId,
          teamAbbr: team,
          startClock: current.clock,
          endClock: next.clock,
          period: current.period,
          duration: durStr,
          opponentPoints: oppPoints,
          players: Array.from(playersOnFloor).slice(0, 5),
          lineupContext,
          endingEvent,
          contextStats,
          highlightText: highlightText ?? undefined,
        });
      }
    }
  }

  droughts.sort((a, b) => {
    const aDur = parseClockToSeconds(a.duration.replace(':', ''));
    const bDur = parseClockToSeconds(b.duration.replace(':', ''));
    return bDur - aDur;
  });

  return droughts;
}

function computeDroughtLineupContext(
  rawActions: CdnPbpAction[],
  teamId: string,
  startGameTime: number,
  endGameTime: number,
  totalDurationSec: number,
): DroughtLineupContext {
  const teamIdNum = parseInt(teamId, 10);
  const lineupPhases: Array<{ players: Set<string>; startTime: number; endTime: number }> = [];
  let currentLineup = new Set<string>();
  let phaseStart = startGameTime;
  let substitutionCount = 0;

  for (const action of rawActions) {
    const actionTeamId = action.teamId;
    const clockSec = parsePTToSeconds(action.clock);
    const actionTime = gameTimeElapsed(action.period, clockSec);

    if (actionTime < startGameTime) {
      if (actionTeamId === teamIdNum && action.playerNameI) {
        if (action.actionType === 'substitution') {
          if (action.subType === 'out') {
            currentLineup.delete(action.playerNameI);
          } else if (action.subType === 'in') {
            currentLineup.add(action.playerNameI);
          }
        } else if (action.personId) {
          currentLineup.add(action.playerNameI);
          if (currentLineup.size > 5) {
            const arr = Array.from(currentLineup);
            currentLineup = new Set(arr.slice(arr.length - 5));
          }
        }
      }
      if (action.actionType === 'period' && action.subType === 'start') {
        currentLineup = new Set();
      }
      continue;
    }

    if (actionTime > endGameTime) break;

    if (action.actionType === 'substitution' && actionTeamId === teamIdNum) {
      substitutionCount++;
      if (currentLineup.size >= 5) {
        lineupPhases.push({
          players: new Set(currentLineup),
          startTime: phaseStart,
          endTime: actionTime,
        });
      }
      if (action.subType === 'out' && action.playerNameI) {
        currentLineup.delete(action.playerNameI);
      } else if (action.subType === 'in' && action.playerNameI) {
        currentLineup.add(action.playerNameI);
      }
      phaseStart = actionTime;
    } else if (actionTeamId === teamIdNum && action.playerNameI && action.personId) {
      currentLineup.add(action.playerNameI);
      if (currentLineup.size > 5) {
        const arr = Array.from(currentLineup);
        currentLineup = new Set(arr.slice(arr.length - 5));
      }
    }
  }

  if (currentLineup.size >= 5) {
    lineupPhases.push({
      players: new Set(currentLineup),
      startTime: phaseStart,
      endTime: endGameTime,
    });
  }

  if (lineupPhases.length === 0) {
    const fallbackPlayers = Array.from(currentLineup).slice(0, 5);
    return {
      primaryLineup: fallbackPlayers.length >= 5 ? fallbackPlayers : [],
      primaryLineupMinuteShare: 0,
      substitutionCount,
    };
  }

  let bestPhase = lineupPhases[0];
  let bestDuration = bestPhase.endTime - bestPhase.startTime;

  for (let i = 1; i < lineupPhases.length; i++) {
    const dur = lineupPhases[i].endTime - lineupPhases[i].startTime;
    if (dur > bestDuration) {
      bestDuration = dur;
      bestPhase = lineupPhases[i];
    }
  }

  const minuteShare = totalDurationSec > 0
    ? Math.round((bestDuration / totalDurationSec) * 100)
    : 0;

  const phases: DroughtLineupPhase[] = lineupPhases.map(phase => {
    const phaseDur = phase.endTime - phase.startTime;
    const periodForPhase = Math.ceil(phase.startTime / 720) || 1;
    const periodLen = periodForPhase <= 4 ? 720 : 300;
    const startInPeriod = periodLen - ((phase.startTime % periodLen) || periodLen);
    const endInPeriod = periodLen - ((phase.endTime % periodLen) || periodLen);
    return {
      players: Array.from(phase.players).slice(0, 5),
      startClock: formatDuration(Math.max(startInPeriod, 0)),
      endClock: formatDuration(Math.max(endInPeriod, 0)),
      durationSeconds: phaseDur,
    };
  });

  return {
    primaryLineup: Array.from(bestPhase.players).slice(0, 5),
    primaryLineupMinuteShare: minuteShare,
    substitutionCount: Math.floor(substitutionCount / 2),
    phases: phases.length > 1 ? phases : undefined,
  };
}

function computeDroughtEndingEvent(endingScoringPlay: PlayByPlayEvent): DroughtEndingEvent | undefined {
  if (!endingScoringPlay || endingScoringPlay.eventType !== 'score') return undefined;

  const playerName = endingScoringPlay.playerName ?? 'Unknown';
  const points = endingScoringPlay.scoreDelta ?? 0;
  let shotType = 'field goal';

  const desc = endingScoringPlay.description.toLowerCase();
  if (desc.includes('free throw')) {
    shotType = points >= 2 ? `${points} made free throws` : 'made free throw';
  } else if (desc.includes('3pt') || desc.includes('three')) {
    shotType = '3-pointer';
  } else if (desc.includes('dunk')) {
    shotType = 'dunk';
  } else if (desc.includes('layup')) {
    shotType = 'layup';
  } else if (desc.includes('hook')) {
    shotType = 'hook shot';
  } else if (desc.includes('mid-range') || desc.includes('midrange')) {
    shotType = 'mid-range jumper';
  } else if (desc.includes('jump shot')) {
    shotType = 'jump shot';
  }

  return {
    description: endingScoringPlay.description,
    playerName,
    points,
    shotType,
  };
}

function resolveScoresAtClockTimes(rawActions: CdnPbpAction[]): Map<string, { homeScore: number; awayScore: number }> {
  const resolved = new Map<string, { homeScore: number; awayScore: number }>();
  for (const action of rawActions) {
    const h = parseInt(action.scoreHome, 10);
    const a = parseInt(action.scoreAway, 10);
    if (isNaN(h) || isNaN(a)) continue;
    const key = `${action.period}-${action.clock}`;
    const existing = resolved.get(key);
    if (!existing) {
      resolved.set(key, { homeScore: h, awayScore: a });
    } else {
      resolved.set(key, {
        homeScore: Math.max(existing.homeScore, h),
        awayScore: Math.max(existing.awayScore, a),
      });
    }
  }
  return resolved;
}

function actionSortPriority(action: CdnPbpAction): number {
  if (action.actionType === 'period' && action.subType === 'start') return 0;
  if (action.actionType === 'period' && action.subType === 'end') return 5;
  const at = action.actionType.toLowerCase();
  if (at === '2pt' || at === '3pt') return 1;
  if (at === 'freethrow') return 1;
  if (at === 'substitution') return 3;
  return 2;
}

function sortActionsForTimeline(rawActions: CdnPbpAction[]): CdnPbpAction[] {
  const groups: Map<string, CdnPbpAction[]> = new Map();
  const groupOrder: string[] = [];

  for (const action of rawActions) {
    const clockSec = parsePTToSeconds(action.clock);
    const key = `${action.period}-${clockSec.toFixed(1)}`;
    let group = groups.get(key);
    if (!group) {
      group = [];
      groups.set(key, group);
      groupOrder.push(key);
    }
    group.push(action);
  }

  const sorted: CdnPbpAction[] = [];
  for (const key of groupOrder) {
    const group = groups.get(key)!;
    group.sort((a, b) => {
      const pa = actionSortPriority(a);
      const pb = actionSortPriority(b);
      if (pa !== pb) return pa - pb;
      return a.actionNumber - b.actionNumber;
    });
    sorted.push(...group);
  }
  return sorted;
}

export function buildTeamTimeline(
  rawActions: CdnPbpAction[],
  teamIdNum: number,
  starters: string[],
): CanonicalTimelineSegment[] {
  const sortedActions = sortActionsForTimeline(rawActions);
  const resolvedScores = resolveScoresAtClockTimes(rawActions);

  const segments: CanonicalTimelineSegment[] = [];
  let currentLineup = new Set<string>(starters);
  let segStart: {
    gameTime: number;
    period: number;
    clockSeconds: number;
    homeScore: number;
    awayScore: number;
  } | null = null;
  let lastHomeScore = 0;
  let lastAwayScore = 0;

  const getResolvedScore = (action: CdnPbpAction, clockSec: number): { homeScore: number; awayScore: number } => {
    const key = `${action.period}-${action.clock}`;
    const resolved = resolvedScores.get(key);
    const rawHome = parseInt(action.scoreHome, 10);
    const rawAway = parseInt(action.scoreAway, 10);
    if (action.actionType === 'substitution' && resolved) {
      return resolved;
    }
    return {
      homeScore: isNaN(rawHome) ? lastHomeScore : rawHome,
      awayScore: isNaN(rawAway) ? lastAwayScore : rawAway,
    };
  };

  const closeSegment = (endGameTime: number, endClockSec: number, endHomeScore: number, endAwayScore: number) => {
    if (!segStart) return;
    const duration = endGameTime - segStart.gameTime;
    if (duration < 0.5) {
      segStart = { ...segStart, homeScore: endHomeScore, awayScore: endAwayScore };
      return;
    }
    if (currentLineup.size >= 5) {
      segments.push({
        period: segStart.period,
        startGameTime: segStart.gameTime,
        endGameTime,
        startClockSeconds: segStart.clockSeconds,
        endClockSeconds: endClockSec,
        players: Array.from(currentLineup).slice(0, 5),
        startHomeScore: segStart.homeScore,
        startAwayScore: segStart.awayScore,
        endHomeScore,
        endAwayScore,
      });
    } else {
      console.warn(`[Timeline] Skipping segment: only ${currentLineup.size} players tracked for team ${teamIdNum} at gameTime ${segStart.gameTime}`);
    }
    segStart = null;
  };

  for (const action of sortedActions) {
    const clockSec = parsePTToSeconds(action.clock);
    const actionGameTime = gameTimeElapsed(action.period, clockSec);
    const scores = getResolvedScore(action, clockSec);
    const homeScore = scores.homeScore;
    const awayScore = scores.awayScore;
    lastHomeScore = homeScore;
    lastAwayScore = awayScore;

    if (action.actionType === 'period' && action.subType === 'start') {
      if (segStart) {
        closeSegment(actionGameTime, clockSec, homeScore, awayScore);
      }
      segStart = {
        gameTime: actionGameTime,
        period: action.period,
        clockSeconds: clockSec,
        homeScore,
        awayScore,
      };
      continue;
    }

    if (action.actionType === 'period' && action.subType === 'end') {
      if (segStart) {
        closeSegment(actionGameTime, clockSec, homeScore, awayScore);
      }
      segStart = null;
      continue;
    }

    if (action.actionType === 'substitution' && action.teamId === teamIdNum) {
      if (segStart && actionGameTime > segStart.gameTime) {
        closeSegment(actionGameTime, clockSec, homeScore, awayScore);
      }

      if (action.subType === 'out' && action.playerNameI) {
        currentLineup.delete(action.playerNameI);
      } else if (action.subType === 'in' && action.playerNameI) {
        currentLineup.add(action.playerNameI);
      }

      if (currentLineup.size > 5) {
        console.warn(`[Timeline] Lineup has ${currentLineup.size} players for team ${teamIdNum} after sub at gameTime ${actionGameTime}: ${Array.from(currentLineup).join(', ')}`);
      }

      if (!segStart) {
        segStart = {
          gameTime: actionGameTime,
          period: action.period,
          clockSeconds: clockSec,
          homeScore,
          awayScore,
        };
      }
      continue;
    }
  }

  if (segStart) {
    const lastAction = sortedActions[sortedActions.length - 1];
    if (lastAction) {
      const lastClock = parsePTToSeconds(lastAction.clock);
      const lastTime = gameTimeElapsed(lastAction.period, lastClock);
      closeSegment(lastTime, lastClock, lastHomeScore, lastAwayScore);
    }
  }

  console.log(`[Timeline] Built ${segments.length} canonical segments for team ${teamIdNum}`);
  return segments;
}

export function buildGameTimelines(
  rawActions: CdnPbpAction[],
  homeTeamId: string,
  awayTeamId: string,
  homeStarters: string[],
  awayStarters: string[],
): { homeTimeline: CanonicalTimelineSegment[]; awayTimeline: CanonicalTimelineSegment[] } {
  const homeIdNum = parseInt(homeTeamId, 10);
  const awayIdNum = parseInt(awayTeamId, 10);

  console.log(`[Timeline] Building canonical timelines. Home starters: [${homeStarters.join(', ')}], Away starters: [${awayStarters.join(', ')}]`);

  const homeTimeline = buildTeamTimeline(rawActions, homeIdNum, homeStarters);
  const awayTimeline = buildTeamTimeline(rawActions, awayIdNum, awayStarters);

  return { homeTimeline, awayTimeline };
}

export function validateTimelineIntegrity(
  timeline: CanonicalTimelineSegment[],
  teamId: string,
  boxScorePlayers?: BoxScorePlayer[],
  isHome?: boolean,
): TimelineIntegrityReport {
  let totalCoveredSeconds = 0;
  let gapCount = 0;
  let gapTotalSeconds = 0;
  let overlapCount = 0;
  let overlapTotalSeconds = 0;
  let invalidLineupCount = 0;
  const playerMinutes: Record<string, number> = {};
  const summaryPlusMinus: Record<string, number> = {};

  const sorted = [...timeline].sort((a, b) => a.startGameTime - b.startGameTime);

  for (let i = 0; i < sorted.length; i++) {
    const seg = sorted[i];
    const duration = seg.endGameTime - seg.startGameTime;
    totalCoveredSeconds += duration;

    if (seg.players.length !== 5) {
      invalidLineupCount++;
    }

    const homeScored = seg.endHomeScore - seg.startHomeScore;
    const awayScored = seg.endAwayScore - seg.startAwayScore;
    const segPM = isHome ? (homeScored - awayScored) : (awayScored - homeScored);

    for (const player of seg.players) {
      playerMinutes[player] = (playerMinutes[player] ?? 0) + duration / 60;
      summaryPlusMinus[player] = (summaryPlusMinus[player] ?? 0) + segPM;
    }

    if (i > 0) {
      const prev = sorted[i - 1];
      const gap = seg.startGameTime - prev.endGameTime;
      if (gap > 1) {
        gapCount++;
        gapTotalSeconds += gap;
      } else if (gap < -1) {
        overlapCount++;
        overlapTotalSeconds += Math.abs(gap);
      }
    }
  }

  const lastSeg = sorted[sorted.length - 1];
  const expectedGameSeconds = lastSeg ? lastSeg.endGameTime : 2880;

  const report: TimelineIntegrityReport = {
    teamId,
    totalSegments: sorted.length,
    totalCoveredSeconds: Math.round(totalCoveredSeconds),
    expectedGameSeconds: Math.round(expectedGameSeconds),
    gapCount,
    gapTotalSeconds: Math.round(gapTotalSeconds),
    overlapCount,
    overlapTotalSeconds: Math.round(overlapTotalSeconds),
    invalidLineupCount,
    playerMinutes: Object.fromEntries(
      Object.entries(playerMinutes).map(([k, v]) => [k, Math.round(v * 10) / 10])
    ),
    summaryPlusMinus,
  };

  console.log(`[Timeline Integrity] Team ${teamId}: ${report.totalSegments} segments, ${report.totalCoveredSeconds}s covered, ${report.gapCount} gaps (${report.gapTotalSeconds}s), ${report.overlapCount} overlaps, ${report.invalidLineupCount} invalid lineups`);

  if (boxScorePlayers && isHome !== undefined) {
    for (const player of boxScorePlayers) {
      const computedMin = playerMinutes[player.name] ?? 0;
      const minParts = player.minutes.split(':');
      const boxMin = (parseInt(minParts[0], 10) || 0) + (parseInt(minParts[1], 10) || 0) / 60;
      const minDelta = computedMin - boxMin;
      const pmDelta = (summaryPlusMinus[player.name] ?? 0) - player.plusMinus;
      if (Math.abs(minDelta) > 1.5 || Math.abs(pmDelta) > 2) {
        console.warn(`[Timeline Integrity] ${player.name}: computed ${computedMin.toFixed(1)} min vs box ${boxMin.toFixed(1)} (Δ${minDelta.toFixed(1)}), computed +/- ${summaryPlusMinus[player.name] ?? 0} vs box ${player.plusMinus} (Δ${pmDelta})`);
      }
    }
  }

  return report;
}

export function reconstructLineups(
  rawActions: CdnPbpAction[],
  homeTeamId: string,
  awayTeamId: string,
  homeStarters?: string[],
  awayStarters?: string[],
  prebuiltHomeTimeline?: CanonicalTimelineSegment[],
  prebuiltAwayTimeline?: CanonicalTimelineSegment[],
): LineupSegment[] {
  let homeTimeline: CanonicalTimelineSegment[];
  let awayTimeline: CanonicalTimelineSegment[];

  if (prebuiltHomeTimeline && prebuiltAwayTimeline) {
    homeTimeline = prebuiltHomeTimeline;
    awayTimeline = prebuiltAwayTimeline;
  } else if (homeStarters && awayStarters && homeStarters.length === 5 && awayStarters.length === 5) {
    const timelines = buildGameTimelines(rawActions, homeTeamId, awayTeamId, homeStarters, awayStarters);
    homeTimeline = timelines.homeTimeline;
    awayTimeline = timelines.awayTimeline;
  } else {
    console.warn('[Lineups] No starters provided, falling back to legacy reconstruction');
    return reconstructLineupsLegacy(rawActions, homeTeamId, awayTeamId);
  }

  const segments: LineupSegment[] = [];
  let segId = 1;

  const processTimeline = (timeline: CanonicalTimelineSegment[], teamId: string, isHome: boolean) => {
    for (const seg of timeline) {
      const elapsed = (seg.endGameTime - seg.startGameTime) / 60;
      if (elapsed < 0.2) continue;

      const ptsFor = isHome
        ? seg.endHomeScore - seg.startHomeScore
        : seg.endAwayScore - seg.startAwayScore;
      const ptsAgainst = isHome
        ? seg.endAwayScore - seg.startAwayScore
        : seg.endHomeScore - seg.startHomeScore;

      const poss = Math.max(elapsed * 1.6, 1);
      const offRtg = (ptsFor / poss) * 100;
      const defRtg = (ptsAgainst / poss) * 100;
      const periodLen = seg.period <= 4 ? 720 : 300;
      const isLow = isLowLeverage(
        seg.period,
        seg.endClockSeconds,
        Math.abs(seg.endHomeScore - seg.endAwayScore),
      );

      segments.push({
        id: `seg-${segId++}`,
        teamId,
        players: seg.players,
        minutes: Math.round(elapsed * 10) / 10,
        plusMinus: ptsFor - ptsAgainst,
        offRating: Math.round(offRtg * 10) / 10,
        defRating: Math.round(defRtg * 10) / 10,
        netRating: Math.round((offRtg - defRtg) * 10) / 10,
        points: ptsFor,
        pointsAllowed: ptsAgainst,
        isLowLeverage: isLow,
      });
    }
  };

  processTimeline(homeTimeline, homeTeamId, true);
  processTimeline(awayTimeline, awayTeamId, false);

  const merged = mergeLineupSegments(segments);
  return merged.sort((a, b) => {
    if (a.isLowLeverage !== b.isLowLeverage) return a.isLowLeverage ? 1 : -1;
    return b.netRating - a.netRating;
  });
}

function reconstructLineupsLegacy(
  rawActions: CdnPbpAction[],
  homeTeamId: string,
  awayTeamId: string
): LineupSegment[] {
  const segments: LineupSegment[] = [];
  let segId = 1;

  const currentLineups: Record<string, Set<string>> = {
    [homeTeamId]: new Set(),
    [awayTeamId]: new Set(),
  };

  const segmentStart: Record<string, { time: number; period: number; homeScore: number; awayScore: number }> = {};

  for (const action of rawActions) {
    const teamId = String(action.teamId);
    const clockSec = parsePTToSeconds(action.clock);
    const gameTime = gameTimeElapsed(action.period, clockSec);
    const homeScore = parseInt(action.scoreHome, 10) || 0;
    const awayScore = parseInt(action.scoreAway, 10) || 0;

    if (action.actionType === 'period' && action.subType === 'start') {
      [homeTeamId, awayTeamId].forEach(tid => {
        currentLineups[tid] = new Set();
        segmentStart[tid] = { time: gameTime, period: action.period, homeScore, awayScore };
      });
      continue;
    }

    if (action.actionType === 'substitution') {
      if (!currentLineups[teamId]) continue;

      if (segmentStart[teamId] && currentLineups[teamId].size >= 5) {
        const start = segmentStart[teamId];
        const elapsed = (gameTime - start.time) / 60;

        if (elapsed > 0.2) {
          const isHome = teamId === homeTeamId;
          const ptsFor = isHome
            ? homeScore - start.homeScore
            : awayScore - start.awayScore;
          const ptsAgainst = isHome
            ? awayScore - start.awayScore
            : homeScore - start.homeScore;

          const poss = Math.max(elapsed * 1.6, 1);
          const offRtg = (ptsFor / poss) * 100;
          const defRtg = (ptsAgainst / poss) * 100;

          const isLow = isLowLeverage(action.period, clockSec, Math.abs(homeScore - awayScore));

          segments.push({
            id: `seg-${segId++}`,
            teamId,
            players: Array.from(currentLineups[teamId]),
            minutes: Math.round(elapsed * 10) / 10,
            plusMinus: ptsFor - ptsAgainst,
            offRating: Math.round(offRtg * 10) / 10,
            defRating: Math.round(defRtg * 10) / 10,
            netRating: Math.round((offRtg - defRtg) * 10) / 10,
            points: ptsFor,
            pointsAllowed: ptsAgainst,
            isLowLeverage: isLow,
          });
        }
      }

      if (action.subType === 'out' && action.playerNameI) {
        currentLineups[teamId].delete(action.playerNameI);
      } else if (action.subType === 'in' && action.playerNameI) {
        currentLineups[teamId].add(action.playerNameI);
      }

      segmentStart[teamId] = { time: gameTime, period: action.period, homeScore, awayScore };
      continue;
    }

    if (action.personId && action.teamId && action.playerNameI) {
      if (currentLineups[teamId]) {
        currentLineups[teamId].add(action.playerNameI);
        if (currentLineups[teamId].size > 5) {
          const arr = Array.from(currentLineups[teamId]);
          currentLineups[teamId] = new Set(arr.slice(arr.length - 5));
        }
      }
    }
  }

  const merged = mergeLineupSegments(segments);
  return merged.sort((a, b) => {
    if (a.isLowLeverage !== b.isLowLeverage) return a.isLowLeverage ? 1 : -1;
    return b.netRating - a.netRating;
  });
}

function mergeLineupSegments(segments: LineupSegment[]): LineupSegment[] {
  const merged: Map<string, LineupSegment & { _stints: LineupStint[] }> = new Map();

  for (const seg of segments) {
    const key = `${seg.teamId}-${[...seg.players].sort().join(',')}`;
    const existing = merged.get(key);

    const stint: LineupStint = {
      period: 0,
      startClock: '',
      endClock: '',
      minutes: seg.minutes,
      plusMinus: seg.plusMinus,
    };

    if (existing) {
      existing.minutes += seg.minutes;
      existing.plusMinus += seg.plusMinus;
      existing.points += seg.points;
      existing.pointsAllowed += seg.pointsAllowed;
      const totalPoss = Math.max(existing.minutes * 1.6, 1);
      existing.offRating = Math.round(((existing.points / totalPoss) * 100) * 10) / 10;
      existing.defRating = Math.round(((existing.pointsAllowed / totalPoss) * 100) * 10) / 10;
      existing.netRating = Math.round((existing.offRating - existing.defRating) * 10) / 10;
      existing.isLowLeverage = existing.isLowLeverage && seg.isLowLeverage;
      existing._stints.push(stint);
    } else {
      merged.set(key, { ...seg, _stints: [stint] });
    }
  }

  return Array.from(merged.values())
    .filter(s => s.minutes >= 1 && s.players.length >= 3)
    .map(s => {
      const { _stints, ...rest } = s;
      return { ...rest, stints: _stints.length > 1 ? _stints : undefined };
    });
}

function isLowLeverage(period: number, clockSeconds: number, leadSize: number): boolean {
  if (period < 4) return false;
  if (clockSeconds <= 60 && leadSize >= LOW_LEVERAGE_LEAD_1MIN) return true;
  if (clockSeconds <= 120 && leadSize >= LOW_LEVERAGE_LEAD_2MIN) return true;
  if (clockSeconds <= 240 && leadSize >= LOW_LEVERAGE_LEAD_4MIN) return true;
  return false;
}

export function reconstructPlayerIntervals(
  rawActions: CdnPbpAction[],
  playerNames: string[],
  teamId: string,
  isHome: boolean,
  starters?: string[],
  prebuiltTimeline?: CanonicalTimelineSegment[],
): PlayerOnCourtInterval[] {
  let timeline: CanonicalTimelineSegment[];

  if (prebuiltTimeline) {
    timeline = prebuiltTimeline;
  } else if (starters && starters.length === 5) {
    const teamIdNum = parseInt(teamId, 10);
    timeline = buildTeamTimeline(rawActions, teamIdNum, starters);
  } else {
    console.warn('[Intervals] No starters or timeline provided, falling back to legacy reconstruction');
    return reconstructPlayerIntervalsLegacy(rawActions, playerNames, teamId, isHome);
  }

  const intervals: PlayerOnCourtInterval[] = [];

  for (const seg of timeline) {
    const allPresent = playerNames.every(p => seg.players.includes(p));
    if (allPresent) {
      intervals.push({
        startGameTime: seg.startGameTime,
        endGameTime: seg.endGameTime,
        startPeriod: seg.period,
        endPeriod: seg.period,
        startClockSeconds: seg.startClockSeconds,
        endClockSeconds: seg.endClockSeconds,
        startHomeScore: seg.startHomeScore,
        startAwayScore: seg.startAwayScore,
        endHomeScore: seg.endHomeScore,
        endAwayScore: seg.endAwayScore,
      });
    }
  }

  const merged = mergeConsecutiveIntervals(intervals);
  console.log(`[Intervals] Reconstructed ${merged.length} canonical intervals for [${playerNames.join(', ')}] from ${timeline.length} timeline segments`);
  return merged;
}

function mergeConsecutiveIntervals(intervals: PlayerOnCourtInterval[]): PlayerOnCourtInterval[] {
  if (intervals.length <= 1) return intervals;
  const sorted = [...intervals].sort((a, b) => a.startGameTime - b.startGameTime);
  const merged: PlayerOnCourtInterval[] = [{ ...sorted[0] }];

  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1];
    const curr = sorted[i];
    if (curr.startGameTime - last.endGameTime <= 1) {
      last.endGameTime = curr.endGameTime;
      last.endPeriod = curr.endPeriod;
      last.endClockSeconds = curr.endClockSeconds;
      last.endHomeScore = curr.endHomeScore;
      last.endAwayScore = curr.endAwayScore;
    } else {
      merged.push({ ...curr });
    }
  }
  return merged;
}

function reconstructPlayerIntervalsLegacy(
  rawActions: CdnPbpAction[],
  playerNames: string[],
  teamId: string,
  isHome: boolean,
): PlayerOnCourtInterval[] {
  const teamIdNum = parseInt(teamId, 10);
  const playerNamesSet = new Set(playerNames);
  const intervals: PlayerOnCourtInterval[] = [];

  const onCourt = new Set<string>();
  let intervalStart: {
    gameTime: number;
    period: number;
    clockSeconds: number;
    homeScore: number;
    awayScore: number;
  } | null = null;

  const allPlayersOnCourt = new Set<string>();

  for (const action of rawActions) {
    const clockSec = parsePTToSeconds(action.clock);
    const actionGameTime = gameTimeElapsed(action.period, clockSec);
    const homeScore = parseInt(action.scoreHome, 10) || 0;
    const awayScore = parseInt(action.scoreAway, 10) || 0;
    const actionTeamId = action.teamId;

    if (action.actionType === 'period' && action.subType === 'start') {
      if (intervalStart && onCourt.size > 0) {
        const selectedOnCourt = playerNames.every(p => onCourt.has(p));
        if (selectedOnCourt) {
          intervals.push({
            startGameTime: intervalStart.gameTime,
            endGameTime: actionGameTime,
            startPeriod: intervalStart.period,
            endPeriod: action.period,
            startClockSeconds: intervalStart.clockSeconds,
            endClockSeconds: clockSec,
            startHomeScore: intervalStart.homeScore,
            startAwayScore: intervalStart.awayScore,
            endHomeScore: homeScore,
            endAwayScore: awayScore,
          });
        }
      }
      onCourt.clear();
      allPlayersOnCourt.clear();
      intervalStart = null;
      continue;
    }

    if (action.actionType === 'period' && action.subType === 'end') {
      if (intervalStart) {
        const selectedOnCourt = playerNames.every(p => onCourt.has(p));
        if (selectedOnCourt) {
          intervals.push({
            startGameTime: intervalStart.gameTime,
            endGameTime: actionGameTime,
            startPeriod: intervalStart.period,
            endPeriod: action.period,
            startClockSeconds: intervalStart.clockSeconds,
            endClockSeconds: clockSec,
            startHomeScore: intervalStart.homeScore,
            startAwayScore: intervalStart.awayScore,
            endHomeScore: homeScore,
            endAwayScore: awayScore,
          });
        }
        intervalStart = null;
      }
      continue;
    }

    if (action.actionType === 'substitution' && actionTeamId === teamIdNum) {
      const playerName = action.playerNameI;
      if (!playerName) continue;

      const wasAllSelected = playerNames.every(p => onCourt.has(p));

      if (action.subType === 'out') {
        onCourt.delete(playerName);
        allPlayersOnCourt.delete(playerName);
      } else if (action.subType === 'in') {
        onCourt.add(playerName);
        allPlayersOnCourt.add(playerName);
      }

      const isAllSelected = playerNames.every(p => onCourt.has(p));

      if (wasAllSelected && !isAllSelected && intervalStart) {
        intervals.push({
          startGameTime: intervalStart.gameTime,
          endGameTime: actionGameTime,
          startPeriod: intervalStart.period,
          endPeriod: action.period,
          startClockSeconds: intervalStart.clockSeconds,
          endClockSeconds: clockSec,
          startHomeScore: intervalStart.homeScore,
          startAwayScore: intervalStart.awayScore,
          endHomeScore: homeScore,
          endAwayScore: awayScore,
        });
        intervalStart = null;
      } else if (!wasAllSelected && isAllSelected) {
        intervalStart = {
          gameTime: actionGameTime,
          period: action.period,
          clockSeconds: clockSec,
          homeScore,
          awayScore,
        };
      }
      continue;
    }

    if (actionTeamId === teamIdNum && action.playerNameI && action.personId) {
      if (!allPlayersOnCourt.has(action.playerNameI)) {
        const wasAllSelected = playerNames.every(p => onCourt.has(p));
        onCourt.add(action.playerNameI);
        allPlayersOnCourt.add(action.playerNameI);

        if (onCourt.size > 5) {
          const arr = Array.from(onCourt);
          const toRemove = arr.filter(p => !playerNamesSet.has(p));
          while (onCourt.size > 5 && toRemove.length > 0) {
            const remove = toRemove.shift()!;
            onCourt.delete(remove);
          }
        }

        const isAllSelected = playerNames.every(p => onCourt.has(p));
        if (!wasAllSelected && isAllSelected && !intervalStart) {
          intervalStart = {
            gameTime: actionGameTime,
            period: action.period,
            clockSeconds: clockSec,
            homeScore,
            awayScore,
          };
        }
      }
    }
  }

  if (intervalStart && playerNames.every(p => onCourt.has(p))) {
    const lastAction = rawActions[rawActions.length - 1];
    if (lastAction) {
      const lastClock = parsePTToSeconds(lastAction.clock);
      const lastTime = gameTimeElapsed(lastAction.period, lastClock);
      intervals.push({
        startGameTime: intervalStart.gameTime,
        endGameTime: lastTime,
        startPeriod: intervalStart.period,
        endPeriod: lastAction.period,
        startClockSeconds: intervalStart.clockSeconds,
        endClockSeconds: lastClock,
        startHomeScore: intervalStart.homeScore,
        startAwayScore: intervalStart.awayScore,
        endHomeScore: parseInt(lastAction.scoreHome, 10) || 0,
        endAwayScore: parseInt(lastAction.scoreAway, 10) || 0,
      });
    }
  }

  const merged = mergeConsecutiveIntervals(intervals);
  console.log(`[Intervals] Legacy reconstructed ${merged.length} intervals for [${playerNames.join(', ')}]`);
  return merged;
}

export function computeCanonicalOnCourtSummary(
  intervals: PlayerOnCourtInterval[],
  isHome: boolean,
): CanonicalOnCourtSummary | null {
  if (intervals.length === 0) return null;

  let totalSeconds = 0;
  let totalPoints = 0;
  let totalAllowed = 0;

  for (const iv of intervals) {
    const duration = iv.endGameTime - iv.startGameTime;
    totalSeconds += duration;

    const homeScored = iv.endHomeScore - iv.startHomeScore;
    const awayScored = iv.endAwayScore - iv.startAwayScore;

    if (isHome) {
      totalPoints += homeScored;
      totalAllowed += awayScored;
    } else {
      totalPoints += awayScored;
      totalAllowed += homeScored;
    }
  }

  const totalMinutes = totalSeconds / 60;
  const plusMinus = totalPoints - totalAllowed;
  const poss = Math.max(totalMinutes * 1.6, 1);
  const offRtg = (totalPoints / poss) * 100;
  const defRtg = (totalAllowed / poss) * 100;
  const netRtg = offRtg - defRtg;

  return {
    minutes: Math.round(totalMinutes * 10) / 10,
    points: totalPoints,
    pointsAllowed: totalAllowed,
    plusMinus,
    offRating: Math.round(offRtg * 10) / 10,
    defRating: Math.round(defRtg * 10) / 10,
    netRating: Math.round(netRtg * 10) / 10,
    possessions: Math.round(poss),
    segmentCount: intervals.length,
    intervals,
  };
}

function detectMismatchCauses(
  rawActions: CdnPbpAction[] | undefined,
  playerName: string,
  teamId: string,
  intervals: PlayerOnCourtInterval[],
  plusMinusDelta: number,
): { causes: PlusMinusMismatchCause[]; sameClockSubEvents: number; ftSequenceSubEvents: number; quarterStartAmbiguities: number } {
  const causes: PlusMinusMismatchCause[] = [];
  let sameClockSubEvents = 0;
  let ftSequenceSubEvents = 0;
  let quarterStartAmbiguities = 0;

  if (plusMinusDelta === 0 || !rawActions || rawActions.length === 0) {
    return { causes, sameClockSubEvents, ftSequenceSubEvents, quarterStartAmbiguities };
  }

  const teamIdNum = parseInt(teamId, 10);

  const actionsByClockKey = new Map<string, CdnPbpAction[]>();
  for (const action of rawActions) {
    const key = `${action.period}-${action.clock}`;
    let group = actionsByClockKey.get(key);
    if (!group) {
      group = [];
      actionsByClockKey.set(key, group);
    }
    group.push(action);
  }

  for (const [, group] of actionsByClockKey) {
    const hasPlayerSub = group.some(
      a => a.actionType === 'substitution' && a.teamId === teamIdNum && a.playerNameI === playerName
    );
    if (!hasPlayerSub) continue;

    const hasScoring = group.some(
      a => (a.actionType === '2pt' || a.actionType === '3pt' || a.actionType === 'freethrow') && a.shotResult?.toLowerCase() === 'made'
    );
    if (hasScoring) {
      sameClockSubEvents++;
    }

    const hasFt = group.some(a => a.actionType === 'freethrow');
    if (hasFt && hasPlayerSub) {
      ftSequenceSubEvents++;
    }
  }

  let lastPeriodEnd = 0;
  for (const action of rawActions) {
    if (action.actionType === 'period' && action.subType === 'start') {
      const periodStartTime = gameTimeElapsed(action.period, parsePTToSeconds(action.clock));
      const key = `${action.period}-${action.clock}`;
      const group = actionsByClockKey.get(key) ?? [];
      const hasPlayerInStarterSlot = group.some(
        a => a.actionType !== 'substitution' && a.teamId === teamIdNum && a.playerNameI === playerName && a.personId
      );
      const hasExplicitSubIn = group.some(
        a => a.actionType === 'substitution' && a.subType === 'in' && a.teamId === teamIdNum && a.playerNameI === playerName
      );
      if (action.period > 1 && !hasExplicitSubIn) {
        const isOnCourt = intervals.some(
          iv => iv.startGameTime <= periodStartTime + 1 && iv.endGameTime >= periodStartTime - 1
        );
        if (isOnCourt) {
          quarterStartAmbiguities++;
        }
      }
      lastPeriodEnd = periodStartTime;
    }
  }

  if (sameClockSubEvents > 0) causes.push('same_clock_sub_ambiguity');
  if (ftSequenceSubEvents > 0) causes.push('free_throw_sequence_ambiguity');
  if (quarterStartAmbiguities > 0) causes.push('quarter_start_lineup_uncertainty');

  if (intervals.length > 0) {
    const sorted = [...intervals].sort((a, b) => a.startGameTime - b.startGameTime);
    let totalGap = 0;
    for (let i = 1; i < sorted.length; i++) {
      const gap = sorted[i].startGameTime - sorted[i - 1].endGameTime;
      if (gap > 5) totalGap += gap;
    }
    if (totalGap > 30) causes.push('missing_sub_event');
  }

  if (causes.length === 0 && plusMinusDelta !== 0) {
    causes.push('unknown');
  }

  return { causes, sameClockSubEvents, ftSequenceSubEvents, quarterStartAmbiguities };
}

export function computeReconciliationAudit(
  intervals: PlayerOnCourtInterval[],
  boxScoreMinutesStr: string,
  boxScorePlusMinus: number,
  isHome: boolean,
  rawActions?: CdnPbpAction[],
  playerName?: string,
  teamId?: string,
): ReconciliationAudit {
  let totalSeconds = 0;
  let totalPlusMinus = 0;

  for (const iv of intervals) {
    totalSeconds += iv.endGameTime - iv.startGameTime;
    const homeScored = iv.endHomeScore - iv.startHomeScore;
    const awayScored = iv.endAwayScore - iv.startAwayScore;
    totalPlusMinus += isHome ? (homeScored - awayScored) : (awayScored - homeScored);
  }

  const computedMinutes = Math.round((totalSeconds / 60) * 10) / 10;

  const minParts = boxScoreMinutesStr.split(':');
  const boxMins = parseInt(minParts[0], 10) || 0;
  const boxSecs = parseInt(minParts[1], 10) || 0;
  const boxScoreMinutes = Math.round((boxMins + boxSecs / 60) * 10) / 10;

  let hasGaps = false;
  let hasOverlaps = false;
  let gapSeconds = 0;
  let overlapSeconds = 0;

  const sorted = [...intervals].sort((a, b) => a.startGameTime - b.startGameTime);
  for (let i = 1; i < sorted.length; i++) {
    const prevEnd = sorted[i - 1].endGameTime;
    const currStart = sorted[i].startGameTime;
    const diff = currStart - prevEnd;
    if (diff > 1) {
      hasGaps = true;
      gapSeconds += diff;
    } else if (diff < -1) {
      hasOverlaps = true;
      overlapSeconds += Math.abs(diff);
    }
  }

  const plusMinusDelta = totalPlusMinus - boxScorePlusMinus;

  const mismatchInfo = (playerName && teamId)
    ? detectMismatchCauses(rawActions, playerName, teamId, intervals, plusMinusDelta)
    : { causes: [] as PlusMinusMismatchCause[], sameClockSubEvents: 0, ftSequenceSubEvents: 0, quarterStartAmbiguities: 0 };

  const audit: ReconciliationAudit = {
    computedMinutes,
    boxScoreMinutes,
    minutesDelta: Math.round((computedMinutes - boxScoreMinutes) * 10) / 10,
    computedPlusMinus: totalPlusMinus,
    boxScorePlusMinus,
    plusMinusDelta,
    intervalCount: intervals.length,
    hasGaps,
    hasOverlaps,
    gapSeconds: Math.round(gapSeconds),
    overlapSeconds: Math.round(overlapSeconds),
    mismatchCauses: mismatchInfo.causes,
    sameClockSubEvents: mismatchInfo.sameClockSubEvents,
    ftSequenceSubEvents: mismatchInfo.ftSequenceSubEvents,
    quarterStartAmbiguities: mismatchInfo.quarterStartAmbiguities,
  };

  console.log('[Reconciliation] Audit:', JSON.stringify(audit, null, 2));
  if (Math.abs(audit.minutesDelta) > 1) {
    console.warn(`[Reconciliation] Minutes delta exceeds 1 min: ${audit.minutesDelta} min`);
  }
  if (Math.abs(audit.plusMinusDelta) > 0) {
    const causeStr = audit.mismatchCauses.length > 0 ? ` [likely: ${audit.mismatchCauses.join(', ')}]` : '';
    console.warn(`[Reconciliation] +/- delta: ${audit.plusMinusDelta}${causeStr}`);
  }

  return audit;
}

export function computeCustomMetrics(
  runs: ScoringRun[],
  droughts: ScoringDrought[],
  lineups: LineupSegment[],
  events: PlayByPlayEvent[],
  homeAbbr: string,
  awayAbbr: string
): CustomMetric[] {
  const metrics: CustomMetric[] = [];
  let metricId = 1;

  for (const team of [homeAbbr, awayAbbr]) {
    const teamRuns = runs.filter(r => r.teamAbbr === team);
    const teamDroughts = droughts.filter(d => d.teamAbbr === team);
    if (teamRuns.length > 0) {
      const allRunPlayers = new Map<string, number>();
      teamRuns.forEach(run => {
        run.players.forEach(p => {
          allRunPlayers.set(p, (allRunPlayers.get(p) || 0) + 1);
        });
      });

      const topPlayer = Array.from(allRunPlayers.entries()).sort((a, b) => b[1] - a[1])[0];
      if (topPlayer) {
        const rpr = (topPlayer[1] / teamRuns.length) * 100;
        metrics.push({
          id: `metric-${metricId++}`,
          name: 'Run Participation Rate',
          shortName: 'RPR',
          value: Math.round(rpr * 10) / 10,
          unit: '%',
          description: `Percent of ${team}'s scoring runs where this player was on the floor.`,
          formula: '(Runs w/ Player) / (Total Team Runs) × 100',
          category: 'impact',
          trend: rpr >= 60 ? 'up' : 'neutral',
          percentile: Math.min(99, Math.round(rpr)),
          source: 'derived',
          playerName: topPlayer[0],
          teamAbbr: team,
        });
      }

      const rci = teamRuns.reduce((s, r) => s + (r.totalPoints * 1.0 + r.playCount * 0.5), 0) / Math.max(teamRuns.length, 1);

      metrics.push({
        id: `metric-${metricId++}`,
        name: 'Run Creation Index',
        shortName: 'RCI',
        value: Math.round(rci * 10) / 10,
        unit: 'idx',
        description: `Composite score of scoring activity during ${team}'s runs. Higher = more productive runs.`,
        formula: '(Run PTS × 1.0 + Plays × 0.5) / Num Runs',
        category: 'impact',
        trend: rci >= 10 ? 'up' : rci >= 5 ? 'neutral' : 'down',
        percentile: Math.min(99, Math.round(rci * 5)),
        source: 'derived',
        teamAbbr: team,
      });
    }

    if (teamDroughts.length > 0) {
      const avgOppPts = teamDroughts.reduce((s, d) => s + d.opponentPoints, 0) / teamDroughts.length;
      metrics.push({
        id: `metric-${metricId++}`,
        name: 'Drought Impact',
        shortName: 'DI',
        value: Math.round(-avgOppPts * 10) / 10,
        unit: 'net',
        description: `Avg opponent points scored during ${team}'s scoring droughts.`,
        formula: '-Avg(Opp Pts During Drought)',
        category: 'defensive',
        trend: avgOppPts <= 4 ? 'up' : 'down',
        percentile: Math.max(1, 100 - Math.round(avgOppPts * 8)),
        source: 'derived',
        teamAbbr: team,
      });
    }

    const nonLowLevLineups = lineups.filter(l => !l.isLowLeverage && l.players.length >= 4);
    if (nonLowLevLineups.length > 0) {
      const best = nonLowLevLineups[0];
      if (best) {
        const teamBaselineNet = nonLowLevLineups.reduce((s, l) => s + l.netRating * l.minutes, 0)
          / Math.max(nonLowLevLineups.reduce((s, l) => s + l.minutes, 0), 1);
        const lsv = best.netRating - teamBaselineNet;

        metrics.push({
          id: `metric-${metricId++}`,
          name: 'Lineup Swing Value',
          shortName: 'LSV',
          value: Math.round(lsv * 10) / 10,
          unit: 'per 100',
          description: `Best lineup's net rating vs team baseline in non-garbage time.`,
          formula: 'Lineup NetRtg − Team Baseline NetRtg',
          category: 'impact',
          trend: lsv > 0 ? 'up' : lsv < -5 ? 'down' : 'neutral',
          percentile: Math.min(99, Math.max(1, 50 + Math.round(lsv * 3))),
          source: 'derived',
          teamAbbr: team,
        });
      }
    }
  }

  return metrics;
}

export function computeOnCourtDetailedStats(
  intervals: PlayerOnCourtInterval[],
  rawActions: CdnPbpAction[],
  teamId: string,
  isHome: boolean,
  selectedPlayerNames?: string[],
  teamBoxScore?: BoxScorePlayer[],
): OnCourtDetailedStats | null {
  if (intervals.length === 0 || rawActions.length === 0) return null;

  const teamIdNum = parseInt(teamId, 10);

  let totalSeconds = 0;
  let totalPoints = 0;
  let totalAllowed = 0;

  for (const iv of intervals) {
    totalSeconds += iv.endGameTime - iv.startGameTime;
    const hs = iv.endHomeScore - iv.startHomeScore;
    const as = iv.endAwayScore - iv.startAwayScore;
    if (isHome) {
      totalPoints += hs;
      totalAllowed += as;
    } else {
      totalPoints += as;
      totalAllowed += hs;
    }
  }

  const totalMinutes = totalSeconds / 60;
  const poss = Math.max(totalMinutes * 1.6, 1);

  let fgm = 0, fga = 0, tpm = 0, tpa = 0, ftm = 0, fta = 0;
  let oppFgm = 0, oppFga = 0, oppTpm = 0, oppTpa = 0, oppFtm = 0, oppFta = 0;
  let assists = 0, steals = 0, blocks = 0, turnovers = 0, forcedTurnovers = 0;
  let oppSteals = 0, oppBlocks = 0, oppTurnovers = 0, oppForcedTurnovers = 0;
  let offReb = 0, defReb = 0, oppOffReb = 0, oppDefReb = 0;
  let fastbreakPts = 0, oppFastbreakPts = 0;
  let playerFga = 0, playerFta = 0, playerTov = 0;

  const isActionInInterval = (action: CdnPbpAction): boolean => {
    const clockSec = parsePTToSeconds(action.clock);
    const actionTime = gameTimeElapsed(action.period, clockSec);
    for (const iv of intervals) {
      if (actionTime >= iv.startGameTime - 0.5 && actionTime <= iv.endGameTime + 0.5) {
        return true;
      }
    }
    return false;
  };

  const isTeamAction = (action: CdnPbpAction): boolean => action.teamId === teamIdNum;
  const isOppAction = (action: CdnPbpAction): boolean => action.teamId !== 0 && action.teamId !== teamIdNum;
  const isFastbreak = (action: CdnPbpAction): boolean =>
    action.qualifiers?.includes('fastbreak') || action.qualifiers?.includes('fromturnover') || false;

  for (const action of rawActions) {
    if (!isActionInInterval(action)) continue;

    const at = action.actionType?.toLowerCase();
    const sub = action.subType?.toLowerCase() ?? '';
    const made = action.shotResult?.toLowerCase() === 'made';
    const team = isTeamAction(action);
    const opp = isOppAction(action);

    if (at === '2pt' || at === '3pt') {
      const is3 = at === '3pt';
      if (team) {
        fga++;
        if (is3) tpa++;
        if (made) {
          fgm++;
          if (is3) tpm++;
          if (isFastbreak(action)) fastbreakPts += is3 ? 3 : 2;
        }
      } else if (opp) {
        oppFga++;
        if (is3) oppTpa++;
        if (made) {
          oppFgm++;
          if (is3) oppTpm++;
          if (isFastbreak(action)) oppFastbreakPts += is3 ? 3 : 2;
        }
      }
    }

    if (at === 'freethrow') {
      if (team) {
        fta++;
        if (made) {
          ftm++;
          if (isFastbreak(action)) fastbreakPts += 1;
        }
      } else if (opp) {
        oppFta++;
        if (made) {
          oppFtm++;
          if (isFastbreak(action)) oppFastbreakPts += 1;
        }
      }
    }

    if (at === 'steal') {
      if (team) steals++;
      else if (opp) oppSteals++;
    }

    if (at === 'assist' || (action.assistPersonId && (at === '2pt' || at === '3pt') && made)) {
      if (team) assists++;
    }

    if (at === 'block') {
      if (team) blocks++;
      else if (opp) oppBlocks++;
    }

    if (at === 'turnover') {
      if (team) {
        turnovers++;
      } else if (opp) {
        oppTurnovers++;
      }
    }

    if (at === 'rebound') {
      if (team) {
        if (sub === 'offensive') offReb++;
        else defReb++;
      } else if (opp) {
        if (sub === 'offensive') oppOffReb++;
        else oppDefReb++;
      }
    }

    if (selectedPlayerNames && selectedPlayerNames.length === 1) {
      const pName = action.playerNameI ?? '';
      if (pName === selectedPlayerNames[0]) {
        if (at === '2pt' || at === '3pt') playerFga++;
        if (at === 'freethrow') playerFta++;
        if (at === 'turnover') playerTov++;
      }
    }
  }

  forcedTurnovers = oppSteals;
  oppForcedTurnovers = steals;

  const safePct = (made: number, att: number): number => att > 0 ? Math.round((made / att) * 1000) / 10 : 0;
  const safeTs = (pts: number, fgAtt: number, ftAtt: number): number => {
    const denom = 2 * (fgAtt + 0.44 * ftAtt);
    return denom > 0 ? Math.round((pts / denom) * 1000) / 10 : 0;
  };

  const teamTotalReb = offReb + defReb;
  const oppTotalReb = oppOffReb + oppDefReb;
  const totalReb = teamTotalReb + oppTotalReb;
  const rebPct = totalReb > 0 ? Math.round((teamTotalReb / totalReb) * 1000) / 10 : 0;
  const oppRebPct = totalReb > 0 ? Math.round((oppTotalReb / totalReb) * 1000) / 10 : 0;

  const offRtg = (totalPoints / poss) * 100;
  const defRtg = (totalAllowed / poss) * 100;
  const ppp = poss > 0 ? Math.round((totalPoints / poss) * 1000) / 1000 : 0;
  const oppPpp = poss > 0 ? Math.round((totalAllowed / poss) * 1000) / 1000 : 0;

  const teamPts = fgm * 2 + tpm + ftm;
  const oppPts = oppFgm * 2 + oppTpm + oppFtm;

  const assistTurnoverRatio = turnovers > 0 ? Math.round((assists / turnovers) * 100) / 100 : null;

  let playFinishingShare: number | null = null;
  if (selectedPlayerNames && selectedPlayerNames.length === 1 && poss > 0) {
    const pfs = ((playerFga + 0.44 * playerFta + playerTov) / poss) * 100;
    playFinishingShare = Math.round(pfs * 10) / 10;
    if (!isFinite(playFinishingShare)) playFinishingShare = null;
  }

  let usageRate: number | null = null;
  if (selectedPlayerNames && selectedPlayerNames.length === 1 && teamBoxScore && teamBoxScore.length > 0) {
    const playerBox = teamBoxScore.find(p => p.name === selectedPlayerNames[0]);
    if (playerBox) {
      const playerMinParts = playerBox.minutes.split(':');
      const playerMin = (parseInt(playerMinParts[0], 10) || 0) + (parseInt(playerMinParts[1], 10) || 0) / 60;

      let teamFgaTotal = 0;
      let teamFtaTotal = 0;
      let teamTovTotal = 0;
      let teamMinTotal = 0;
      for (const p of teamBoxScore) {
        teamFgaTotal += p.fga;
        teamFtaTotal += p.fta;
        teamTovTotal += p.turnovers;
        const mParts = p.minutes.split(':');
        teamMinTotal += (parseInt(mParts[0], 10) || 0) + (parseInt(mParts[1], 10) || 0) / 60;
      }

      const teamDenom = teamFgaTotal + 0.44 * teamFtaTotal + teamTovTotal;
      if (playerMin > 0 && teamDenom > 0 && teamMinTotal > 0) {
        const usg = 100 * ((playerBox.fga + 0.44 * playerBox.fta + playerBox.turnovers) * (teamMinTotal / 5)) / (playerMin * teamDenom);
        usageRate = Math.round(usg * 10) / 10;
        if (!isFinite(usageRate)) usageRate = null;
        console.log(`[UsageRate] player=${selectedPlayerNames[0]} playerFGA=${playerBox.fga} playerFTA=${playerBox.fta} playerTOV=${playerBox.turnovers} playerMin=${playerMin.toFixed(1)} teamFGA=${teamFgaTotal} teamFTA=${teamFtaTotal} teamTOV=${teamTovTotal} teamMin=${teamMinTotal.toFixed(1)} USG=${usageRate}`);
      }
    }
  }

  console.log(`[DetailedStats] team=${teamId} isHome=${isHome} minutes=${totalMinutes.toFixed(1)} poss=${poss.toFixed(0)} FG=${fgm}/${fga} 3PT=${tpm}/${tpa} FT=${ftm}/${fta} AST=${assists} TOV=${turnovers} A/TO=${assistTurnoverRatio} STL=${steals} BLK=${blocks} REB=${teamTotalReb} PFS=${playFinishingShare} USG=${usageRate}`);

  return {
    minutes: Math.round(totalMinutes * 10) / 10,
    possessions: Math.round(poss),
    points: totalPoints,
    pointsAllowed: totalAllowed,
    plusMinus: totalPoints - totalAllowed,
    offRating: Math.round(offRtg * 10) / 10,
    defRating: Math.round(defRtg * 10) / 10,
    netRating: Math.round((offRtg - defRtg) * 10) / 10,
    pointsPerPossession: ppp,

    fgm, fga, fgPct: safePct(fgm, fga),
    tpm, tpa, tpPct: safePct(tpm, tpa),
    ftm, fta, ftPct: safePct(ftm, fta),
    tsPct: safeTs(totalPoints, fga, fta),

    assists, turnovers, forcedTurnovers,
    assistTurnoverRatio,
    steals, blocks, fastbreakPoints: fastbreakPts,

    offensiveRebounds: offReb,
    defensiveRebounds: defReb,
    totalRebounds: teamTotalReb,
    reboundPct: rebPct,

    playFinishingShare,
    usageRate,

    oppFgm, oppFga, oppFgPct: safePct(oppFgm, oppFga),
    oppTpm, oppTpa, oppTpPct: safePct(oppTpm, oppTpa),
    oppFtm, oppFta, oppFtPct: safePct(oppFtm, oppFta),
    oppTsPct: safeTs(totalAllowed, oppFga, oppFta),
    oppPointsPerPossession: oppPpp,
    oppTurnovers, oppForcedTurnovers,
    oppSteals, oppBlocks, oppFastbreakPoints: oppFastbreakPts,
    oppOffensiveRebounds: oppOffReb,
    oppDefensiveRebounds: oppDefReb,
    oppTotalRebounds: oppTotalReb,
    oppReboundPct: oppRebPct,
  };
}

export function computeOnOffRating(
  onIntervals: PlayerOnCourtInterval[],
  teamTimeline: CanonicalTimelineSegment[],
  playerNames: string[],
  isHome: boolean,
): OnOffRatingStats | null {
  if (teamTimeline.length === 0) {
    console.log('[OnOff] No team timeline available, returning null');
    return null;
  }

  let onSeconds = 0;
  let onPtsFor = 0;
  let onPtsAllowed = 0;

  for (const iv of onIntervals) {
    onSeconds += iv.endGameTime - iv.startGameTime;
    const hs = iv.endHomeScore - iv.startHomeScore;
    const as = iv.endAwayScore - iv.startAwayScore;
    if (isHome) {
      onPtsFor += hs;
      onPtsAllowed += as;
    } else {
      onPtsFor += as;
      onPtsAllowed += hs;
    }
  }

  let offSeconds = 0;
  let offPtsFor = 0;
  let offPtsAllowed = 0;

  for (const seg of teamTimeline) {
    const allPresent = playerNames.every(p => seg.players.includes(p));
    if (!allPresent) {
      const duration = seg.endGameTime - seg.startGameTime;
      offSeconds += duration;
      const hs = seg.endHomeScore - seg.startHomeScore;
      const as = seg.endAwayScore - seg.startAwayScore;
      if (isHome) {
        offPtsFor += hs;
        offPtsAllowed += as;
      } else {
        offPtsFor += as;
        offPtsAllowed += hs;
      }
    }
  }

  const onMinutes = onSeconds / 60;
  const offMinutes = offSeconds / 60;
  const onPoss = Math.max(onMinutes * 1.6, 0);
  const offPoss = Math.max(offMinutes * 1.6, 0);

  const MIN_POSS_THRESHOLD = 1;

  const onORtg = onPoss >= MIN_POSS_THRESHOLD ? (onPtsFor / onPoss) * 100 : null;
  const onDRtg = onPoss >= MIN_POSS_THRESHOLD ? (onPtsAllowed / onPoss) * 100 : null;
  const onNet = (onORtg !== null && onDRtg !== null) ? onORtg - onDRtg : null;

  const offORtg = offPoss >= MIN_POSS_THRESHOLD ? (offPtsFor / offPoss) * 100 : null;
  const offDRtg = offPoss >= MIN_POSS_THRESHOLD ? (offPtsAllowed / offPoss) * 100 : null;
  const offNet = (offORtg !== null && offDRtg !== null) ? offORtg - offDRtg : null;

  const onOffRating = (onNet !== null && offNet !== null) ? onNet - offNet : null;

  const result: OnOffRatingStats = {
    onMinutes: Math.round(onMinutes * 10) / 10,
    offMinutes: Math.round(offMinutes * 10) / 10,
    onPossessions: Math.round(onPoss),
    offPossessions: Math.round(offPoss),
    onPointsFor: onPtsFor,
    onPointsAllowed: onPtsAllowed,
    offPointsFor: offPtsFor,
    offPointsAllowed: offPtsAllowed,
    onOffensiveRating: onORtg !== null ? Math.round(onORtg * 10) / 10 : null,
    onDefensiveRating: onDRtg !== null ? Math.round(onDRtg * 10) / 10 : null,
    onNetRating: onNet !== null ? Math.round(onNet * 10) / 10 : null,
    offOffensiveRating: offORtg !== null ? Math.round(offORtg * 10) / 10 : null,
    offDefensiveRating: offDRtg !== null ? Math.round(offDRtg * 10) / 10 : null,
    offNetRating: offNet !== null ? Math.round(offNet * 10) / 10 : null,
    onOffRating: onOffRating !== null ? Math.round(onOffRating * 10) / 10 : null,
    onOffConfidenceLevel: 'none',
  };

  const minSample = Math.min(result.onPossessions, result.offPossessions);
  let onOffConf: OnOffConfidenceLevel = 'none';
  if (minSample >= 20) onOffConf = 'high';
  else if (minSample >= 10) onOffConf = 'low';
  else onOffConf = 'none';

  result.onOffConfidenceLevel = onOffConf;

  console.log(`[OnOff] playerNames=[${playerNames.join(', ')}] isHome=${isHome} onMin=${result.onMinutes} offMin=${result.offMinutes} onNet=${result.onNetRating} offNet=${result.offNetRating} onOff=${result.onOffRating} onOffConf=${onOffConf}`);

  return result;
}

export function computeConfidence(
  possessions: number,
  onOffStats: OnOffRatingStats | null,
): OnCourtConfidence {
  let confidenceLevel: ConfidenceLevel = 'high';
  if (possessions < 10) confidenceLevel = 'ultra_low';
  else if (possessions < 25) confidenceLevel = 'medium';

  const onOffConfidenceLevel: OnOffConfidenceLevel = onOffStats?.onOffConfidenceLevel ?? 'none';

  console.log(`[Confidence] poss=${possessions} confidence=${confidenceLevel} onOffConf=${onOffConfidenceLevel}`);

  return { confidenceLevel, onOffConfidenceLevel };
}

function runToGameTimeRange(run: ScoringRun): { start: number; end: number } {
  const startClock = parseClockToSeconds(run.startClock);
  const endClock = parseClockToSeconds(run.endClock);
  const start = gameTimeElapsed(run.period, startClock);
  const end = gameTimeElapsed(run.period, endClock);
  return { start: Math.min(start, end), end: Math.max(start, end) };
}

function droughtToGameTimeRange(drought: ScoringDrought): { start: number; end: number } {
  const startClock = parseClockToSeconds(drought.startClock);
  const endClock = parseClockToSeconds(drought.endClock);
  const start = gameTimeElapsed(drought.period, startClock);
  const endPeriod = drought.period;
  const end = gameTimeElapsed(endPeriod, endClock);
  return { start: Math.min(start, end), end: Math.max(start, end) };
}

function intervalsOverlap(
  aStart: number, aEnd: number,
  bStart: number, bEnd: number,
): boolean {
  return aStart < bEnd && bStart < aEnd;
}

export function computeGameFlowContext(
  intervals: PlayerOnCourtInterval[],
  runs: ScoringRun[],
  droughts: ScoringDrought[],
  teamId: string,
): GameFlowContext {
  let teamRunsCount = 0;
  let teamDroughtsCount = 0;
  let opponentRunsCount = 0;
  let opponentDroughtsCount = 0;

  for (const run of runs) {
    const range = runToGameTimeRange(run);
    const overlaps = intervals.some(iv =>
      intervalsOverlap(iv.startGameTime, iv.endGameTime, range.start, range.end)
    );
    if (overlaps) {
      if (run.teamId === teamId) {
        teamRunsCount++;
      } else {
        opponentRunsCount++;
      }
    }
  }

  for (const drought of droughts) {
    const range = droughtToGameTimeRange(drought);
    const overlaps = intervals.some(iv =>
      intervalsOverlap(iv.startGameTime, iv.endGameTime, range.start, range.end)
    );
    if (overlaps) {
      if (drought.teamId === teamId) {
        teamDroughtsCount++;
      } else {
        opponentDroughtsCount++;
      }
    }
  }

  console.log(`[GameFlowContext] team=${teamId} teamRuns=${teamRunsCount} teamDroughts=${teamDroughtsCount} oppRuns=${opponentRunsCount} oppDroughts=${opponentDroughtsCount}`);

  return {
    teamRunsCount,
    teamDroughtsCount,
    opponentRunsCount,
    opponentDroughtsCount,
  };
}

export function computePlayerPerformanceStats(
  player: BoxScorePlayer,
  teamBoxScore: BoxScorePlayer[],
  teamAbbr: string,
): PlayerPerformanceStats {
  const minParts = player.minutes.split(':');
  const playerMin = (parseInt(minParts[0], 10) || 0) + (parseInt(minParts[1], 10) || 0) / 60;

  const safePct = (made: number, att: number): number =>
    att > 0 ? Math.round((made / att) * 1000) / 10 : 0;

  const fgPct = safePct(player.fgm, player.fga);
  const tpPct = safePct(player.tpm, player.tpa);
  const ftPct = safePct(player.ftm, player.fta);

  let tsPct: number | null = null;
  const tsDenom = 2 * (player.fga + 0.44 * player.fta);
  if (tsDenom > 0) {
    tsPct = Math.round((player.points / tsDenom) * 1000) / 10;
  }

  let efgPct: number | null = null;
  if (player.fga > 0) {
    efgPct = Math.round(((player.fgm + 0.5 * player.tpm) / player.fga) * 1000) / 10;
  }

  let usageRate: number | null = null;
  let teamFgaTotal = 0;
  let teamFtaTotal = 0;
  let teamTovTotal = 0;
  let teamMinTotal = 0;
  for (const p of teamBoxScore) {
    teamFgaTotal += p.fga;
    teamFtaTotal += p.fta;
    teamTovTotal += p.turnovers;
    const mParts = p.minutes.split(':');
    teamMinTotal += (parseInt(mParts[0], 10) || 0) + (parseInt(mParts[1], 10) || 0) / 60;
  }
  const teamDenom = teamFgaTotal + 0.44 * teamFtaTotal + teamTovTotal;
  if (playerMin > 0 && teamDenom > 0 && teamMinTotal > 0) {
    const usg = 100 * ((player.fga + 0.44 * player.fta + player.turnovers) * (teamMinTotal / 5)) / (playerMin * teamDenom);
    usageRate = Math.round(usg * 10) / 10;
    if (!isFinite(usageRate)) usageRate = null;
  }

  let playFinishingShare: number | null = null;
  const poss = Math.max(playerMin * 1.6, 0);
  if (poss > 0) {
    const pfs = ((player.fga + 0.44 * player.fta + player.turnovers) / poss) * 100;
    playFinishingShare = Math.round(pfs * 10) / 10;
    if (!isFinite(playFinishingShare)) playFinishingShare = null;
  }

  const assistTurnoverRatio = player.turnovers > 0
    ? Math.round((player.assists / player.turnovers) * 100) / 100
    : null;

  const fouls = teamBoxScore.find(p => p.playerId === player.playerId);
  const foulCount = 0;

  console.log(`[PlayerPerf] ${player.name}: MIN=${playerMin.toFixed(1)} PTS=${player.points} USG=${usageRate} PFS=${playFinishingShare} TS=${tsPct} eFG=${efgPct}`);

  return {
    playerId: player.playerId,
    name: player.name,
    position: player.position,
    teamAbbr,
    minutes: Math.round(playerMin * 10) / 10,
    points: player.points,
    rebounds: player.rebounds,
    offensiveRebounds: player.offensiveRebounds ?? 0,
    defensiveRebounds: player.defensiveRebounds ?? 0,
    assists: player.assists,
    steals: player.steals,
    blocks: player.blocks,
    turnovers: player.turnovers,
    fouls: foulCount,
    plusMinus: player.plusMinus,
    fgm: player.fgm,
    fga: player.fga,
    fgPct,
    tpm: player.tpm,
    tpa: player.tpa,
    tpPct,
    ftm: player.ftm,
    fta: player.fta,
    ftPct,
    tsPct,
    efgPct,
    usageRate,
    playFinishingShare,
    assistTurnoverRatio,
  };
}
