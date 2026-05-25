export interface ClockScoreContext {
  period: number;
  clockSecondsRemaining: number | null | undefined;
  homeScore: number | null | undefined;
  awayScore: number | null | undefined;
}

export interface ExplicitFastBreakContext {
  isOfficialFastBreak?: boolean | null;
  rawActionType?: string | null;
  rawSubType?: string | null;
  rawQualifiers?: Array<string | null | undefined> | null;
}

export function clockToSeconds(clock: string | null | undefined): number | null {
  if (!clock) return null;
  const trimmed = clock.trim();
  const parts = trimmed.split(':');
  if (parts.length < 2) return null;
  const minutes = Number(parts[0]);
  const seconds = Number(parts[1]);
  if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) return null;
  return minutes * 60 + seconds;
}

function isFiniteScore(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function isClutchContext(context: ClockScoreContext): boolean {
  const clockSeconds = context.clockSecondsRemaining;
  if (clockSeconds == null || !Number.isFinite(clockSeconds) || clockSeconds > 300) return false;
  if (!Number.isFinite(context.period) || context.period < 4) return false;
  if (!isFiniteScore(context.homeScore) || !isFiniteScore(context.awayScore)) return false;
  return Math.abs(context.homeScore - context.awayScore) <= 5;
}

function normalizeRawToken(value: string | null | undefined): string {
  return (value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function hasExplicitFastBreakSignal(context: ExplicitFastBreakContext): boolean {
  if (context.isOfficialFastBreak === true) return true;
  const tokens = [
    normalizeRawToken(context.rawActionType),
    normalizeRawToken(context.rawSubType),
    ...(context.rawQualifiers ?? []).map(qualifier => normalizeRawToken(qualifier)),
  ].filter(token => token.length > 0);

  return tokens.some(token => token === 'fastbreak' || token === 'fastbreakpoints' || token === 'fbp' || token === 'fbps');
}
