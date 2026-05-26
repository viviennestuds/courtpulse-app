import type { ScoringRun } from '@/types';

export interface MatchupDriverTeam {
  id: string;
  abbreviation: string;
  score: number;
}

export interface MatchupDriverNote {
  id: string;
  body: string;
}

interface MatchupDriverInput {
  homeTeam: MatchupDriverTeam;
  awayTeam: MatchupDriverTeam;
  homeTeamStats: Record<string, number>;
  awayTeamStats: Record<string, number>;
  runs?: ScoringRun[];
}

interface DriverCandidate extends MatchupDriverNote {
  priority: number;
  strength: number;
}

type Side = 'home' | 'away';

const DRIVER_LIMIT = 5;

function hasNumber(stats: Record<string, number>, key: string): boolean {
  if (!Object.prototype.hasOwnProperty.call(stats, key)) return false;
  const value = stats[key];
  return typeof value === 'number' && Number.isFinite(value);
}

function readNumber(stats: Record<string, number>, key: string): number | undefined {
  return hasNumber(stats, key) ? stats[key] : undefined;
}

function readPair(homeStats: Record<string, number>, awayStats: Record<string, number>, key: string): { home: number; away: number } | undefined {
  const home = readNumber(homeStats, key);
  const away = readNumber(awayStats, key);
  if (home === undefined || away === undefined) return undefined;
  return { home, away };
}

function efgPct(stats: Record<string, number>): number {
  const fgm = stats.fieldGoalsMade ?? 0;
  const fga = stats.fieldGoalsAttempted ?? 0;
  const tpm = stats.threePointersMade ?? 0;
  if (fga <= 0) return 0;
  return ((fgm + 0.5 * tpm) / fga) * 100;
}

function fmtPct(value: number): string {
  return `${value.toFixed(1)}%`;
}

function fmtNum(value: number): string {
  return Math.round(value).toString();
}

function teamForSide(input: MatchupDriverInput, side: Side): MatchupDriverTeam {
  return side === 'home' ? input.homeTeam : input.awayTeam;
}

function otherSide(side: Side): Side {
  return side === 'home' ? 'away' : 'home';
}

function sideForHigher(home: number, away: number): Side {
  return home >= away ? 'home' : 'away';
}

function statForSide(pair: { home: number; away: number }, side: Side): number {
  return side === 'home' ? pair.home : pair.away;
}

function statDiff(pair: { home: number; away: number }): number {
  return Math.abs(pair.home - pair.away);
}

function buildShootingCounter(input: MatchupDriverInput, losingSide: Side): string | undefined {
  const winningSide = otherSide(losingSide);
  const losingTeam = teamForSide(input, losingSide).abbreviation;
  const counters: { text: string; edge: number }[] = [];

  const fta = readPair(input.homeTeamStats, input.awayTeamStats, 'freeThrowsAttempted');
  if (fta) {
    const losingValue = statForSide(fta, losingSide);
    const winningValue = statForSide(fta, winningSide);
    if (losingValue - winningValue >= 6) counters.push({ text: `${fmtNum(losingValue)} FTA`, edge: losingValue - winningValue });
  }

  const paint = readPair(input.homeTeamStats, input.awayTeamStats, 'pointsInThePaint');
  if (paint) {
    const losingValue = statForSide(paint, losingSide);
    const winningValue = statForSide(paint, winningSide);
    if (losingValue - winningValue >= 10) counters.push({ text: `${fmtNum(losingValue)} paint points`, edge: losingValue - winningValue });
  }

  const secondChance = readPair(input.homeTeamStats, input.awayTeamStats, 'pointsSecondChance');
  if (secondChance) {
    const losingValue = statForSide(secondChance, losingSide);
    const winningValue = statForSide(secondChance, winningSide);
    if (losingValue - winningValue >= 8) counters.push({ text: `${fmtNum(losingValue)} second-chance points`, edge: losingValue - winningValue });
  }

  const fastBreak = readPair(input.homeTeamStats, input.awayTeamStats, 'pointsFastBreak');
  if (fastBreak) {
    const losingValue = statForSide(fastBreak, losingSide);
    const winningValue = statForSide(fastBreak, winningSide);
    if (losingValue - winningValue >= 8) counters.push({ text: `${fmtNum(losingValue)} fast break points`, edge: losingValue - winningValue });
  }

  const bench = readPair(input.homeTeamStats, input.awayTeamStats, 'benchPoints');
  if (bench) {
    const losingValue = statForSide(bench, losingSide);
    const winningValue = statForSide(bench, winningSide);
    if (losingValue - winningValue >= 12) counters.push({ text: `${fmtNum(losingValue)} bench points`, edge: losingValue - winningValue });
  }

  const threesAttempted = readPair(input.homeTeamStats, input.awayTeamStats, 'threePointersAttempted');
  if (threesAttempted) {
    const losingValue = statForSide(threesAttempted, losingSide);
    const winningValue = statForSide(threesAttempted, winningSide);
    if (losingValue - winningValue >= 8) counters.push({ text: `${fmtNum(losingValue)} 3PA`, edge: losingValue - winningValue });
  }

  counters.sort((a, b) => b.edge - a.edge);
  const best = counters[0];
  return best ? ` ${losingTeam} partially offset it with ${best.text}.` : undefined;
}

function parseRunScoreChange(scoreChange: string): { startHome: number; startAway: number; endHome: number; endAway: number } | undefined {
  const match = scoreChange.match(/(\d+)\s*-\s*(\d+)\s*(?:→|->)\s*(\d+)\s*-\s*(\d+)/);
  if (!match) return undefined;
  const startHome = Number(match[1]);
  const startAway = Number(match[2]);
  const endHome = Number(match[3]);
  const endAway = Number(match[4]);
  if (![startHome, startAway, endHome, endAway].every(Number.isFinite)) return undefined;
  return { startHome, startAway, endHome, endAway };
}

function runTeamSide(input: MatchupDriverInput, run: ScoringRun): Side | undefined {
  if (run.teamId && run.teamId === input.homeTeam.id) return 'home';
  if (run.teamId && run.teamId === input.awayTeam.id) return 'away';
  if (run.teamAbbr === input.homeTeam.abbreviation) return 'home';
  if (run.teamAbbr === input.awayTeam.abbreviation) return 'away';
  return undefined;
}

function marginForSide(scores: { home: number; away: number }, side: Side): number {
  return side === 'home' ? scores.home - scores.away : scores.away - scores.home;
}

function buildRunDriver(input: MatchupDriverInput): DriverCandidate | undefined {
  if (!input.runs || input.runs.length === 0) return undefined;
  const finalMargin = Math.abs(input.homeTeam.score - input.awayTeam.score);

  for (const run of input.runs) {
    const side = runTeamSide(input, run);
    if (!side) continue;

    const parsed = parseRunScoreChange(run.scoreChange);
    const startMargin = parsed ? marginForSide({ home: parsed.startHome, away: parsed.startAway }, side) : undefined;
    const endMargin = parsed ? marginForSide({ home: parsed.endHome, away: parsed.endAway }, side) : undefined;
    const fromCloseToSeparation = startMargin !== undefined && endMargin !== undefined && Math.abs(startMargin) <= 5 && endMargin >= 10;
    const massive = run.netPoints >= 20;
    const lateMassive = run.period >= 4 && run.netPoints >= 15;
    const majorShare = finalMargin > 0 && run.netPoints >= Math.max(12, finalMargin * 0.8);

    if (!massive && !lateMassive && !fromCloseToSeparation && !majorShare) continue;

    const timeLabel = `Q${run.period} ${run.startClock}→${run.endClock}`;
    const runLabel = `${run.totalPoints}-${run.opponentPoints}`;
    let body: string;
    if (fromCloseToSeparation && startMargin !== undefined) {
      const startText = startMargin === 0 ? 'tied' : `within ${Math.abs(startMargin)}`;
      body = `After the game was ${startText} in ${timeLabel}, ${run.teamAbbr} created separation with a ${runLabel} run.`;
    } else {
      body = `${run.teamAbbr}'s ${runLabel} run (${timeLabel}) was the game’s clearest separation point.`;
    }

    return {
      id: `run-${run.id}`,
      body,
      priority: 1,
      strength: run.netPoints,
    };
  }

  return undefined;
}

/** Builds concise Matchup Game Drivers from official box-score stats and existing run analytics. */
export function buildMatchupGameDrivers(input: MatchupDriverInput): MatchupDriverNote[] {
  const candidates: DriverCandidate[] = [];
  const runDriver = buildRunDriver(input);
  if (runDriver) candidates.push(runDriver);

  const homeEfg = efgPct(input.homeTeamStats);
  const awayEfg = efgPct(input.awayTeamStats);
  const efgGap = Math.abs(homeEfg - awayEfg);
  if (efgGap >= 5) {
    const winningSide = homeEfg > awayEfg ? 'home' : 'away';
    const losingSide = otherSide(winningSide);
    const winner = teamForSide(input, winningSide).abbreviation;
    const counter = buildShootingCounter(input, losingSide) ?? '';
    candidates.push({
      id: 'efg',
      body: `${winner} won the shooting battle (eFG% ${fmtPct(Math.max(homeEfg, awayEfg))} vs ${fmtPct(Math.min(homeEfg, awayEfg))}), creating enough efficiency separation to control the scoring margin.${counter}`,
      priority: 2,
      strength: efgGap,
    });
  }

  const pointsOffTurnovers = readPair(input.homeTeamStats, input.awayTeamStats, 'pointsOffTurnovers');
  if (pointsOffTurnovers && statDiff(pointsOffTurnovers) >= 6) {
    const winningSide = sideForHigher(pointsOffTurnovers.home, pointsOffTurnovers.away);
    const losingSide = otherSide(winningSide);
    const winner = teamForSide(input, winningSide).abbreviation;
    const loser = teamForSide(input, losingSide).abbreviation;
    const tov = readPair(input.homeTeamStats, input.awayTeamStats, 'turnovers');
    const winnerValue = statForSide(pointsOffTurnovers, winningSide);
    const loserValue = statForSide(pointsOffTurnovers, losingSide);
    const loserTov = tov ? statForSide(tov, losingSide) : undefined;
    const winnerTov = tov ? statForSide(tov, winningSide) : undefined;
    const body = loserTov !== undefined && winnerTov !== undefined && loserTov - winnerTov >= 3
      ? `${loser} committed ${fmtNum(loserTov)} turnovers, and ${winner} converted those mistakes into a ${fmtNum(winnerValue)}–${fmtNum(loserValue)} points-off-turnovers edge.`
      : `${winner} turned ${loser}'s mistakes into offense, winning points off turnovers ${fmtNum(winnerValue)}–${fmtNum(loserValue)}.`;
    candidates.push({ id: 'points-off-turnovers', body, priority: 3, strength: statDiff(pointsOffTurnovers) });
  }

  const secondChance = readPair(input.homeTeamStats, input.awayTeamStats, 'pointsSecondChance');
  const oreb = readPair(input.homeTeamStats, input.awayTeamStats, 'reboundsOffensive');
  if (secondChance && oreb && (statDiff(secondChance) >= 6 || statDiff(oreb) >= 4)) {
    const winningSide = sideForHigher(secondChance.home, secondChance.away);
    const losingSide = otherSide(winningSide);
    const winner = teamForSide(input, winningSide).abbreviation;
    const winningScp = statForSide(secondChance, winningSide);
    const losingScp = statForSide(secondChance, losingSide);
    const winningOreb = statForSide(oreb, winningSide);
    const losingOreb = statForSide(oreb, losingSide);
    const orebEdge = winningOreb - losingOreb;
    const scpEdge = winningScp - losingScp;
    const body = orebEdge >= 3 && scpEdge >= 6
      ? `${winner}'s offensive rebounding translated directly into production: ${fmtNum(winningOreb)} OREB and a ${fmtNum(winningScp)}–${fmtNum(losingScp)} second-chance points edge.`
      : `${winner} created more extra possessions on the glass (${fmtNum(winningOreb)}–${fmtNum(losingOreb)} OREB), but the scoring return was limited (${fmtNum(winningScp)}–${fmtNum(losingScp)} second-chance points).`;
    candidates.push({ id: 'second-chance', body, priority: 4, strength: Math.max(statDiff(secondChance), statDiff(oreb)) });
  }

  const fastBreak = readPair(input.homeTeamStats, input.awayTeamStats, 'pointsFastBreak');
  if (fastBreak && statDiff(fastBreak) >= 8) {
    const winningSide = sideForHigher(fastBreak.home, fastBreak.away);
    const losingSide = otherSide(winningSide);
    const winner = teamForSide(input, winningSide).abbreviation;
    candidates.push({
      id: 'fast-break',
      body: `${winner} controlled the open floor, winning fast break points ${fmtNum(statForSide(fastBreak, winningSide))}–${fmtNum(statForSide(fastBreak, losingSide))}.`,
      priority: 5,
      strength: statDiff(fastBreak),
    });
  } else if (pointsOffTurnovers && fastBreak && statDiff(pointsOffTurnovers) >= 10 && statDiff(fastBreak) < 6 && Math.max(fastBreak.home, fastBreak.away) <= 14) {
    const winningSide = sideForHigher(pointsOffTurnovers.home, pointsOffTurnovers.away);
    const losingSide = otherSide(winningSide);
    const winner = teamForSide(input, winningSide).abbreviation;
    candidates.push({
      id: 'turnovers-not-transition',
      body: `${winner} punished turnovers mostly outside of transition, winning points off turnovers ${fmtNum(statForSide(pointsOffTurnovers, winningSide))}–${fmtNum(statForSide(pointsOffTurnovers, losingSide))} while fast break scoring stayed modest.`,
      priority: 5,
      strength: statDiff(pointsOffTurnovers),
    });
  }

  const bench = readPair(input.homeTeamStats, input.awayTeamStats, 'benchPoints');
  if (bench && statDiff(bench) >= 12) {
    const winningSide = sideForHigher(bench.home, bench.away);
    const losingSide = otherSide(winningSide);
    const winner = teamForSide(input, winningSide).abbreviation;
    candidates.push({
      id: 'bench',
      body: `${winner}'s bench created separation, outscoring the opposing reserves ${fmtNum(statForSide(bench, winningSide))}–${fmtNum(statForSide(bench, losingSide))}.`,
      priority: 6,
      strength: statDiff(bench),
    });
  }

  const paint = readPair(input.homeTeamStats, input.awayTeamStats, 'pointsInThePaint');
  if (paint && statDiff(paint) >= 10) {
    const winningSide = sideForHigher(paint.home, paint.away);
    const losingSide = otherSide(winningSide);
    const winner = teamForSide(input, winningSide).abbreviation;
    candidates.push({
      id: 'paint',
      body: `${winner} consistently got inside, winning paint points ${fmtNum(statForSide(paint, winningSide))}–${fmtNum(statForSide(paint, losingSide))}.`,
      priority: 7,
      strength: statDiff(paint),
    });
  }

  const fta = readPair(input.homeTeamStats, input.awayTeamStats, 'freeThrowsAttempted');
  const foulsDrawn = readPair(input.homeTeamStats, input.awayTeamStats, 'personalFoulsDrawn');
  if (fta) {
    const ftaWinningSide = sideForHigher(fta.home, fta.away);
    const losingSide = otherSide(ftaWinningSide);
    const ftaEdge = statDiff(fta);
    const pfdEdge = foulsDrawn ? statForSide(foulsDrawn, ftaWinningSide) - statForSide(foulsDrawn, losingSide) : 0;
    if (ftaEdge >= 6 || (foulsDrawn && pfdEdge >= 5 && ftaEdge >= 4)) {
      const winner = teamForSide(input, ftaWinningSide).abbreviation;
      const drawnText = foulsDrawn ? `, drawing ${fmtNum(statForSide(foulsDrawn, ftaWinningSide))} fouls` : '';
      candidates.push({
        id: 'free-throw-pressure',
        body: `${winner} generated more foul pressure${drawnText} and earning ${fmtNum(statForSide(fta, ftaWinningSide))} FTA.`,
        priority: 8,
        strength: ftaEdge + Math.max(0, pfdEdge),
      });
    }
  }

  const blockedAttempts = readPair(input.homeTeamStats, input.awayTeamStats, 'blockedAttempts');
  const blocks = readPair(input.homeTeamStats, input.awayTeamStats, 'blocks');
  if (blockedAttempts && blocks) {
    const moreBlockedSide = sideForHigher(blockedAttempts.home, blockedAttempts.away);
    const rimProtectionSide = otherSide(moreBlockedSide);
    const blkaEdge = statDiff(blockedAttempts);
    const blockEdge = statDiff(blocks);
    const blockedTeam = teamForSide(input, moreBlockedSide).abbreviation;
    const protector = teamForSide(input, rimProtectionSide).abbreviation;
    if (blkaEdge >= 2 && statForSide(blockedAttempts, moreBlockedSide) >= 4) {
      candidates.push({
        id: 'rim-protection',
        body: `${protector} protected the rim better, recording ${fmtNum(statForSide(blocks, rimProtectionSide))} blocks while ${blockedTeam} had ${fmtNum(statForSide(blockedAttempts, moreBlockedSide))} attempts blocked.`,
        priority: 9,
        strength: blkaEdge + blockEdge,
      });
    }
  }

  const assists = readPair(input.homeTeamStats, input.awayTeamStats, 'assists');
  if (assists && statDiff(assists) >= 6) {
    const winningSide = sideForHigher(assists.home, assists.away);
    const losingSide = otherSide(winningSide);
    const winner = teamForSide(input, winningSide).abbreviation;
    candidates.push({
      id: 'assists',
      body: `${winner} created more assisted offense, finishing with an assists edge of ${fmtNum(statForSide(assists, winningSide))}–${fmtNum(statForSide(assists, losingSide))}.`,
      priority: 10,
      strength: statDiff(assists),
    });
  }

  const seen = new Set<string>();
  return candidates
    .sort((a, b) => a.priority - b.priority || b.strength - a.strength)
    .filter(candidate => {
      const key = candidate.id === 'turnovers-not-transition' ? 'points-off-turnovers' : candidate.id;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, DRIVER_LIMIT)
    .map(({ id, body }) => ({ id, body }));
}
