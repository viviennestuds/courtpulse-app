import type { PlayByPlayEvent } from '@/types';
import type {
  PbpClassifiedEvent,
  PbpEventCategory,
  PbpFilterQuery,
  PbpFilterResult,
  PbpPlayerOption,
  PbpSortOrder,
} from '@/types/pbpFilters';

function clockToSeconds(clock: string | null | undefined): number | null {
  if (!clock) return null;
  const trimmed = clock.trim();
  const parts = trimmed.split(':');
  if (parts.length < 2) return null;
  const minutes = Number(parts[0]);
  const seconds = Number(parts[1]);
  if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) return null;
  return minutes * 60 + seconds;
}

function normalizedDescription(event: PlayByPlayEvent): string {
  return (event.description ?? '').toLowerCase();
}

function isFiniteScore(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * Tags clutch context from current event state only.
 * Clutch = Q4/OT, final 5:00 or less, score margin <= 5.
 */
export function isPbpClutchEvent(event: PlayByPlayEvent): boolean {
  const clockSeconds = clockToSeconds(event.clock);
  if (clockSeconds == null || clockSeconds > 300) return false;
  if (!Number.isFinite(event.period) || event.period < 4) return false;
  if (!isFiniteScore(event.homeScore) || !isFiniteScore(event.awayScore)) return false;
  return Math.abs(event.homeScore - event.awayScore) <= 5;
}

/**
 * First-pass event classifier for filter chips. It intentionally favors safe,
 * readable categories over exact NBA action taxonomy until raw action metadata
 * is threaded into this screen.
 */
export function classifyPbpEvent(event: PlayByPlayEvent): PbpEventCategory {
  const desc = normalizedDescription(event);
  const type = event.eventType;

  if (type === 'substitution' || desc.includes('substitution')) return 'substitution';
  if (type === 'timeout' || desc.includes('timeout')) return 'timeout';
  if (type === 'turnover' || desc.includes('turnover')) return 'turnover';
  if (type === 'steal' || desc.includes('steal')) return 'steal';
  if (type === 'block' || desc.includes('block')) return 'block';
  if (type === 'foul' || desc.includes('foul')) return 'foul';
  if (type === 'rebound' || desc.includes('rebound')) return 'rebound';
  if (desc.includes('free throw') || desc.includes('freethrow')) return 'free_throw';
  if (type === 'score') return 'made_fg';
  if (type === 'miss') return 'missed_fg';
  if (desc.includes('assist')) return 'assist';

  return 'other';
}

function eventMatchesCategory(event: PbpClassifiedEvent, category: PbpEventCategory): boolean {
  const desc = normalizedDescription(event);
  if (category === 'assist') return desc.includes('assist');
  if (category === 'free_throw') return desc.includes('free throw') || desc.includes('freethrow');
  if (category === 'made_fg') return event.eventType === 'score' && !eventMatchesCategory(event, 'free_throw');
  if (category === 'missed_fg') return event.eventType === 'miss' && !eventMatchesCategory(event, 'free_throw');
  return event.pbpCategory === category;
}

function getEventInvolvedPlayerIds(event: PlayByPlayEvent): string[] {
  const ids = new Set<string>();
  if (event.playerId) ids.add(String(event.playerId));
  return Array.from(ids);
}

export function classifyPbpEvents(events: PlayByPlayEvent[]): PbpClassifiedEvent[] {
  return events.map((event, index) => ({
    ...event,
    pbpCategory: classifyPbpEvent(event),
    isClutchContext: isPbpClutchEvent(event),
    sortIndex: index,
    involvedPlayerIds: getEventInvolvedPlayerIds(event),
  }));
}

function sortedEvents(events: PbpClassifiedEvent[], sortOrder: PbpSortOrder): PbpClassifiedEvent[] {
  const copy = [...events];
  return copy.sort((a, b) => {
    if (sortOrder === 'newest') return b.sortIndex - a.sortIndex;
    return a.sortIndex - b.sortIndex;
  });
}

export function pbpEventMatchesQuery(
  event: PbpClassifiedEvent,
  query: PbpFilterQuery,
  homeTeamId: string,
  awayTeamId: string,
): boolean {
  if (query.team === 'home' && event.teamId !== homeTeamId) return false;
  if (query.team === 'away' && event.teamId !== awayTeamId) return false;
  if (query.period != null && event.period !== query.period) return false;
  if (query.clutchOnly && !event.isClutchContext) return false;
  if (query.playerId != null && !event.involvedPlayerIds.includes(query.playerId)) return false;
  if (query.eventCategory !== 'all' && !eventMatchesCategory(event, query.eventCategory)) return false;
  return true;
}

export function countActivePbpFilters(query: PbpFilterQuery): number {
  let count = 0;
  if (query.team !== 'both') count += 1;
  if (query.period != null) count += 1;
  if (query.clutchOnly) count += 1;
  if (query.playerId != null) count += 1;
  if (query.eventCategory !== 'all') count += 1;
  return count;
}

export function filterPbpEvents(
  events: PbpClassifiedEvent[],
  query: PbpFilterQuery,
  homeTeamId: string,
  awayTeamId: string,
): PbpFilterResult {
  const activeFilterCount = countActivePbpFilters(query);
  const filtered = activeFilterCount === 0
    ? events
    : events.filter(event => pbpEventMatchesQuery(event, query, homeTeamId, awayTeamId));

  return {
    events: sortedEvents(filtered, query.sortOrder),
    activeFilterCount,
  };
}

export function buildPbpPlayerOptions(events: PbpClassifiedEvent[]): PbpPlayerOption[] {
  const map = new Map<string, PbpPlayerOption>();
  for (const event of events) {
    if (!event.playerId) continue;
    const id = String(event.playerId);
    const current = map.get(id) ?? {
      id,
      name: event.playerName ?? `Player ${id}`,
      eventCount: 0,
    };
    current.eventCount += 1;
    if (!current.name && event.playerName) current.name = event.playerName;
    map.set(id, current);
  }
  return Array.from(map.values()).sort((a, b) => b.eventCount - a.eventCount || a.name.localeCompare(b.name));
}

export function formatPbpCategoryLabel(category: PbpEventCategory | 'all'): string {
  const labels: Record<PbpEventCategory | 'all', string> = {
    all: 'All Types',
    made_fg: 'Made FG',
    missed_fg: 'Missed FG',
    free_throw: 'Free Throw',
    rebound: 'Rebound',
    assist: 'Assist',
    turnover: 'Turnover',
    steal: 'Steal',
    block: 'Block',
    foul: 'Foul',
    substitution: 'Substitution',
    timeout: 'Timeout',
    other: 'Other',
  };
  return labels[category];
}
