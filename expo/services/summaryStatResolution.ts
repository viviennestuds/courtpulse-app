export const SUMMARY_STAT_KEYS = [
  'points',
  'fieldGoalsPercentage',
  'threePointersPercentage',
  'freeThrowsPercentage',
  'reboundsTotal',
  'reboundsOffensive',
  'reboundsDefensive',
  'assists',
  'turnovers',
  'pointsOffTurnovers',
  'steals',
  'blocks',
  'pointsInThePaint',
  'pointsSecondChance',
  'pointsFastBreak',
  'benchPoints',
] as const;

export type SummaryStatKey = (typeof SUMMARY_STAT_KEYS)[number];
export type SummaryEvidenceSource = 'gameScore' | 'primary' | 'traditional' | 'headline' | 'postgame' | 'misc';

export interface ResolvedSummaryStat {
  value: number | null;
  available: boolean;
  source: SummaryEvidenceSource | null;
  sourceField: string | null;
}

export type ResolvedSummaryTeam = Record<SummaryStatKey, ResolvedSummaryStat>;

export interface ResolvedSummaryPair {
  home: ResolvedSummaryTeam;
  away: ResolvedSummaryTeam;
}

export interface RawSummaryTeam {
  teamId?: unknown;
  homeAway?: unknown;
  score?: unknown;
  statistics?: Record<string, unknown> | null;
  stats?: Record<string, unknown> | null;
}

export interface RawSummaryTeamGroup {
  gameId?: unknown;
  homeTeam?: RawSummaryTeam | null;
  awayTeam?: RawSummaryTeam | null;
  teams?: RawSummaryTeam[] | null;
}

export interface SummaryResolutionEvidence {
  requestedGameId: string;
  responseGameId: unknown;
  homeTeamId: string;
  awayTeamId: string;
  gameScore?: RawSummaryTeamGroup | null;
  primary?: RawSummaryTeamGroup | null;
  traditional?: RawSummaryTeamGroup | null;
  headline?: RawSummaryTeamGroup | null;
  postgame?: RawSummaryTeamGroup | null;
  misc?: RawSummaryTeamGroup | null;
}

type StatDefinition = {
  keys: readonly string[];
};

type PercentageStatKey = 'fieldGoalsPercentage' | 'threePointersPercentage' | 'freeThrowsPercentage';
export type PercentageScale = 'fraction' | 'percentagePoints';

const PERCENTAGE_SOURCE_FIELDS: Record<
  Exclude<SummaryEvidenceSource, 'gameScore'>,
  Partial<Record<PercentageStatKey, Readonly<Record<string, PercentageScale>>>>
> = {
  primary: {
    fieldGoalsPercentage: { fieldGoalsPercentage: 'fraction' },
    threePointersPercentage: { threePointersPercentage: 'fraction' },
    freeThrowsPercentage: { freeThrowsPercentage: 'fraction' },
  },
  // statsGameHydration v33 normalizes Traditional upstream aliases to short output keys.
  traditional: {
    fieldGoalsPercentage: { fgPct: 'fraction' },
    threePointersPercentage: { fg3Pct: 'fraction' },
    freeThrowsPercentage: { ftPct: 'fraction' },
  },
  headline: {
    fieldGoalsPercentage: { fieldGoalsPercentage: 'fraction' },
    threePointersPercentage: { threePointersPercentage: 'fraction' },
    freeThrowsPercentage: { freeThrowsPercentage: 'fraction' },
  },
  postgame: {
    fieldGoalsPercentage: { fieldGoalsPercentage: 'fraction' },
    threePointersPercentage: { threePointersPercentage: 'fraction' },
    freeThrowsPercentage: { freeThrowsPercentage: 'fraction' },
  },
  misc: {},
};

const ORDINARY_DEFINITIONS: Record<SummaryStatKey, StatDefinition> = {
  points: { keys: ['points'] },
  fieldGoalsPercentage: { keys: [] },
  threePointersPercentage: { keys: [] },
  freeThrowsPercentage: { keys: [] },
  reboundsTotal: { keys: ['reboundsTotal', 'rebounds'] },
  reboundsOffensive: { keys: ['reboundsOffensive', 'offensiveRebounds'] },
  reboundsDefensive: { keys: ['reboundsDefensive', 'defensiveRebounds'] },
  assists: { keys: ['assists'] },
  turnovers: { keys: [] },
  pointsOffTurnovers: { keys: ['pointsOffTurnovers', 'ptsOffTurnovers', 'pointsOffTov', 'ptsOffTov', 'pointsFromTurnovers', 'ptsFromTurnovers', 'pointsOffTO', 'ptsOffTO', 'turnoversPoints', 'pointsOffOpponentTurnovers', 'pointsFromOpponentTurnovers', 'opponentTurnoverPoints', 'pointsOffTOV', 'ptsOffTOV'] },
  steals: { keys: ['steals'] },
  blocks: { keys: ['blocks'] },
  pointsInThePaint: { keys: ['pointsPaint', 'pointsInThePaint', 'PITP', 'pitp'] },
  pointsSecondChance: { keys: ['pointsSecondChance', 'secondChancePoints', 'ptsSecondChance'] },
  pointsFastBreak: { keys: ['pointsFastBreak', 'fastBreakPoints', 'FBPS', 'fbps'] },
  benchPoints: { keys: ['benchPoints', 'ptsBench', 'pointsBench'] },
};

const MISC_FIELDS = new Set<SummaryStatKey>([
  'pointsOffTurnovers',
  'pointsInThePaint',
  'pointsSecondChance',
  'pointsFastBreak',
  'benchPoints',
]);

function identity(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function usableTeamId(value: unknown): string {
  const result = identity(value);
  return result && result !== '0' && result.toLowerCase() !== 'null' ? result : '';
}

function readFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function emptyStat(): ResolvedSummaryStat {
  return { value: null, source: null, sourceField: null, available: false };
}

function resolvedStat(value: number, source: SummaryEvidenceSource, sourceField: string): ResolvedSummaryStat {
  return { value, available: true, source, sourceField };
}

function groupMatchesGame(group: RawSummaryTeamGroup | null | undefined, gameId: string): boolean {
  return !!group && (!identity(group.gameId) || identity(group.gameId) === gameId);
}

function sourceTeam(
  group: RawSummaryTeamGroup | null | undefined,
  expectedId: string,
  otherId: string,
  side: 'home' | 'away',
  gameId: string,
): RawSummaryTeam | null {
  if (!groupMatchesGame(group, gameId) || !expectedId || !otherId || expectedId === otherId) return null;
  const own = side === 'home' ? group?.homeTeam : group?.awayTeam;
  const opposite = side === 'home' ? group?.awayTeam : group?.homeTeam;
  const ownId = usableTeamId(own?.teamId);
  const oppositeId = usableTeamId(opposite?.teamId);
  if (ownId && ownId !== expectedId) return null;
  // A duplicate claim of this canonical ID makes both named slots ambiguous.
  if (oppositeId === expectedId) return null;
  if (own && (own.homeAway == null || identity(own.homeAway).toLowerCase() === side)) {
    if (ownId === expectedId) return own;
    // A named placeholder still needs compatible pairing, unlike an array
    // record that can independently prove identity with a unique real ID.
    if (!ownId && (!oppositeId || oppositeId === otherId)) return own;
  }
  // Array records never gain identity from position or side. Count ALL claims
  // for the canonical ID, including records with a contradictory side label.
  const candidates = (group?.teams ?? []).filter(team => usableTeamId(team.teamId) === expectedId);
  if (candidates.length !== 1) return null;
  const declaredSide = identity(candidates[0].homeAway).toLowerCase();
  return !declaredSide || declaredSide === side ? candidates[0] : null;
}

function rawStats(team: RawSummaryTeam | null): Record<string, unknown> {
  return team?.statistics ?? team?.stats ?? {};
}

export function normalizeSourcePercentage(value: unknown, scale: PercentageScale): number | null {
  const parsed = readFiniteNumber(value);
  if (parsed === null || parsed < 0) return null;
  if (scale === 'fraction') return parsed <= 1 ? parsed * 100 : null;
  if (scale === 'percentagePoints') return parsed <= 100 ? parsed : null;
  return null;
}

function resolveFromRecord(
  team: RawSummaryTeam | null,
  field: SummaryStatKey,
  source: Exclude<SummaryEvidenceSource, 'gameScore'>,
): ResolvedSummaryStat {
  if (!team) return emptyStat();
  const stats = rawStats(team);
  if (field === 'fieldGoalsPercentage' || field === 'threePointersPercentage' || field === 'freeThrowsPercentage') {
    const admittedFields = PERCENTAGE_SOURCE_FIELDS[source][field];
    if (!admittedFields) return emptyStat();
    for (const [key, scale] of Object.entries(admittedFields)) {
      if (!Object.prototype.hasOwnProperty.call(stats, key)) continue;
      const value = normalizeSourcePercentage(stats[key], scale);
      if (value !== null) return resolvedStat(value, source, key);
    }
    return emptyStat();
  }
  for (const key of ORDINARY_DEFINITIONS[field].keys) {
    if (!Object.prototype.hasOwnProperty.call(stats, key)) continue;
    const raw = readFiniteNumber(stats[key]);
    if (raw === null || raw < 0 || !Number.isInteger(raw)) continue;
    return resolvedStat(raw, source, key);
  }
  return emptyStat();
}

function resolveTeam(
  input: SummaryResolutionEvidence,
  side: 'home' | 'away',
): ResolvedSummaryTeam {
  const ownId = side === 'home' ? input.homeTeamId : input.awayTeamId;
  const otherId = side === 'home' ? input.awayTeamId : input.homeTeamId;
  const sources: Record<Exclude<SummaryEvidenceSource, 'gameScore'>, RawSummaryTeam | null> = {
    primary: sourceTeam(input.primary, ownId, otherId, side, input.requestedGameId),
    traditional: sourceTeam(input.traditional, ownId, otherId, side, input.requestedGameId),
    headline: sourceTeam(input.headline, ownId, otherId, side, input.requestedGameId),
    postgame: sourceTeam(input.postgame, ownId, otherId, side, input.requestedGameId),
    misc: sourceTeam(input.misc, ownId, otherId, side, input.requestedGameId),
  };
  const scoreTeam = sourceTeam(input.gameScore, ownId, otherId, side, input.requestedGameId);
  const hasPrimary = !!input.primary;
  const result = {} as ResolvedSummaryTeam;

  for (const field of SUMMARY_STAT_KEYS) {
    if (field === 'turnovers') {
      result[field] = emptyStat();
      continue;
    }
    if (field === 'points') {
      const rawScore = readFiniteNumber(scoreTeam?.score);
      if (rawScore !== null && Number.isInteger(rawScore) && rawScore >= 0) {
        result[field] = resolvedStat(rawScore, 'gameScore', 'score');
        continue;
      }
    }
    const sourceOrder: Array<Exclude<SummaryEvidenceSource, 'gameScore'>> = MISC_FIELDS.has(field)
      ? ['primary', 'headline', 'postgame', 'misc', 'traditional']
      : ['primary', 'traditional', 'headline', 'postgame'];
    let resolved = emptyStat();
    for (const source of sourceOrder) {
      if (source === 'primary' && !hasPrimary) continue;
      if ((field === 'reboundsOffensive' || field === 'reboundsDefensive') && source !== 'traditional' && source !== 'primary') continue;
      const candidate = resolveFromRecord(sources[source], field, source);
      if (candidate.available) {
        resolved = candidate;
        break;
      }
    }
    result[field] = resolved;
  }
  return result;
}

export function resolveSummaryEvidence(input: SummaryResolutionEvidence): ResolvedSummaryPair | null {
  if (!input.requestedGameId || identity(input.responseGameId) !== input.requestedGameId) return null;
  if (!usableTeamId(input.homeTeamId) || !usableTeamId(input.awayTeamId) || input.homeTeamId === input.awayTeamId) return null;
  return {
    home: resolveTeam(input, 'home'),
    away: resolveTeam(input, 'away'),
  };
}

export function summaryStatValue(team: ResolvedSummaryTeam | null | undefined, field: SummaryStatKey): number | null {
  return team?.[field]?.value ?? null;
}

export function summaryComparisonWidths(homeValue: number | null, awayValue: number | null): { home: number; away: number; available: boolean } {
  if (homeValue === null || awayValue === null || !Number.isFinite(homeValue) || !Number.isFinite(awayValue)) {
    return { home: 0, away: 0, available: false };
  }
  const total = homeValue + awayValue;
  return { home: total > 0 ? (homeValue / total) * 100 : 50, away: total > 0 ? (awayValue / total) * 100 : 50, available: true };
}
