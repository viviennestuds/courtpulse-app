import { ResolvedSummaryPair, SummaryStatKey, summaryStatValue } from './summaryStatResolution';

export interface SummaryDisplayRow {
  key: SummaryStatKey;
  label: string;
  homeValue: number | null;
  awayValue: number | null;
  isPercentage: boolean;
}

const FIELD_ROWS: ReadonlyArray<{ key: SummaryStatKey; label: string; optional?: boolean }> = [
  { key: 'points', label: 'Points' },
  { key: 'fieldGoalsPercentage', label: 'FG%' },
  { key: 'threePointersPercentage', label: '3PT%' },
  { key: 'freeThrowsPercentage', label: 'FT%' },
  { key: 'reboundsTotal', label: 'Rebounds' },
  { key: 'reboundsOffensive', label: 'Off. Reb' },
  { key: 'reboundsDefensive', label: 'Def. Reb' },
  { key: 'assists', label: 'Assists' },
  { key: 'turnovers', label: 'Turnovers' },
  { key: 'pointsOffTurnovers', label: 'PTS OFF TOV', optional: true },
  { key: 'steals', label: 'Steals' },
  { key: 'blocks', label: 'Blocks' },
  { key: 'pointsInThePaint', label: 'Paint PTS' },
  { key: 'pointsSecondChance', label: '2ND CHANCE', optional: true },
  { key: 'pointsFastBreak', label: 'Fast Break' },
  { key: 'benchPoints', label: 'BENCH PTS', optional: true },
];

function sourceBackedValue(
  field: SummaryStatKey,
  side: 'home' | 'away',
  summary: ResolvedSummaryPair | undefined,
  legacyBackend: Record<string, number> | undefined,
): number | null {
  if (summary) return summaryStatValue(summary[side], field);
  if (!legacyBackend) return null;
  const value = legacyBackend[field];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function buildSummaryDisplayRows(
  summary: ResolvedSummaryPair | undefined,
  homeBackendStats?: Record<string, number>,
  awayBackendStats?: Record<string, number>,
): SummaryDisplayRow[] {
  return FIELD_ROWS.flatMap(field => {
    const homeValue = sourceBackedValue(field.key, 'home', summary, homeBackendStats);
    const awayValue = sourceBackedValue(field.key, 'away', summary, awayBackendStats);
    if (field.optional && homeValue === null && awayValue === null) return [];
    return [{
      key: field.key,
      label: field.label,
      homeValue,
      awayValue,
      isPercentage: ['fieldGoalsPercentage', 'threePointersPercentage', 'freeThrowsPercentage'].includes(field.key),
    }];
  });
}
