export interface ParsedRecordSplit {
  wins: number;
  losses: number;
  games: number;
  winRate: number | null;
}

export function safeNumber(value: number | null | undefined): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

export function formatRecord(wins: number | null | undefined, losses: number | null | undefined, unavailable: string = '—'): string {
  const safeWins = safeNumber(wins);
  const safeLosses = safeNumber(losses);
  return safeWins !== undefined && safeLosses !== undefined ? `${safeWins}-${safeLosses}` : unavailable;
}

export function formatWinPct(value: number | null | undefined, style: 'decimal' | 'percent' = 'decimal'): string {
  const pct = safeNumber(value);
  if (pct === undefined) return '—';
  if (style === 'percent') return `${(pct * 100).toFixed(1)}%`;
  return pct.toFixed(3).replace(/^0/, '');
}

export function formatNumber(value: number | null | undefined, decimals: number = 1, includePlus: boolean = false): string {
  const safeValue = safeNumber(value);
  if (safeValue === undefined) return '—';
  return `${includePlus && safeValue > 0 ? '+' : ''}${safeValue.toFixed(decimals)}`;
}

export function formatRating(value: number | null | undefined, includePlus: boolean = false): string {
  return formatNumber(value, 1, includePlus);
}

export function formatGamesBack(value: number | null | undefined): string {
  const safeValue = safeNumber(value);
  if (safeValue === undefined) return '—';
  return safeValue === 0 ? '0.0' : safeValue.toFixed(1);
}

export function formatRank(value: number | null | undefined): string {
  const safeValue = safeNumber(value);
  return safeValue === undefined ? '—' : `#${safeValue}`;
}

export function parseRecordSplit(record: string | null | undefined): ParsedRecordSplit | null {
  if (!record) return null;
  const match = record.trim().match(/^(\d+)\s*-\s*(\d+)$/);
  if (!match) return null;
  const wins = Number(match[1]);
  const losses = Number(match[2]);
  if (!Number.isFinite(wins) || !Number.isFinite(losses)) return null;
  const games = wins + losses;
  return {
    wins,
    losses,
    games,
    winRate: games > 0 ? wins / games : null,
  };
}

export function formatRecordSplit(record: string | null | undefined): string {
  const parsed = parseRecordSplit(record);
  return parsed ? `${parsed.wins}-${parsed.losses}` : record ?? '—';
}
