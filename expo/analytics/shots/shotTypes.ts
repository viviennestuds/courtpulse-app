export type ShotResult = 'make' | 'miss';
export type ShotZone = 'rim' | 'mid' | '3pt' | 'ft';

export interface CanonicalShotEvent {
  id: string;
  gameId: string;
  eventNum?: number;
  gameEventId?: number;

  teamId: string;
  opponentTeamId?: string;

  playerId: string | null;
  playerName?: string | null;

  assisterId?: string | null;
  assisterName?: string | null;

  period: number;
  periodTime?: string | null;
  clockSecondsRemaining?: number | null;
  gameSecondsElapsed?: number | null;

  result: ShotResult;
  shotZone: ShotZone;

  points: 1 | 2 | 3;

  x?: number | null;
  y?: number | null;

  scoreHome?: number | null;
  scoreAway?: number | null;

  runId?: string | null;
  droughtId?: string | null;

  isFastBreak?: boolean;
  isSecondChance?: boolean;
  isOffAssist?: boolean;
  isFreeThrow?: boolean;

  rawDescription?: string;

  season?: string;

  nbaEventUrl?: string;
}

export interface ShotQuery {
  teamId?: string;
  opponentTeamId?: string;

  playerId?: string;
  assisterId?: string;

  period?: number;
  periods?: number[];

  runId?: string;
  droughtId?: string;

  shotZone?: ShotZone;
  result?: ShotResult;
}

export interface ShotQuerySummary {
  attempts: number;
  makes: number;
  misses: number;
  fgPct: number | null;
  points: number;
  twosMade: number;
  twosAttempted: number;
  threesMade: number;
  threesAttempted: number;
  ftMade: number;
  ftAttempted: number;
  ftPct: number | null;
  ppo: number | null;
  tsPct: number | null;
}
