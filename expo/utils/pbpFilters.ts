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
function isFreeThrowDescription(desc: string): boolean {
  return desc.includes('free throw') || desc.includes('freethrow');
}

function isAssistDescription(desc: string): boolean {
  return desc.includes('assist');
}

function isViolationDescription(desc: string): boolean {
  return (
    desc.includes('technical foul') ||
    desc.includes('flagrant foul') ||
    desc.includes('ejection') ||
    desc.includes('ejected') ||
    desc.includes('delay of game') ||
    desc.includes('kicked ball') ||
    desc.includes('kick ball') ||
    desc.includes('defensive 3 second') ||
    desc.includes('defensive three second') ||
    desc.includes('offensive basket interference') ||
    desc.includes('goaltending') ||
    desc.includes('free throw violation')
  );
}

/**
 * Returns every safe filter category an event belongs to. This supports
 * intentional overlap such as made FG + assist and turnover + violation.
 */
export function classifyPbpEventCategories(event: PlayByPlayEvent): PbpEventCategory[] {
  const desc = normalizedDescription(event);
  const type = event.eventType;
  const categories = new Set<PbpEventCategory>();
  const isFreeThrow = isFreeThrowDescription(desc);
  const isViolation = isViolationDescription(desc);

  if (type === 'substitution' || desc.includes('substitution')) categories.add('substitution');
  if (type === 'timeout' || desc.includes('timeout')) categories.add('timeout');
  if (type === 'turnover' || desc.includes('turnover')) categories.add('turnover');
  if (type === 'steal' || desc.includes('steal')) categories.add('steal');
  if (type === 'block' || desc.includes('block')) categories.add('block');
  if (type === 'rebound' || desc.includes('rebound')) categories.add('rebound');
  if (isFreeThrow) categories.add('free_throw');
  if (isViolation) categories.add('violation');

  if ((type === 'foul' || desc.includes('foul')) && !isViolation) categories.add('foul');
  if (type === 'score' && !isFreeThrow) categories.add('made_fg');
  if (type === 'miss' && !isFreeThrow && !isViolation) categories.add('missed_fg');
  if (isAssistDescription(desc)) categories.add('assist');

  return Array.from(categories);
}

export function classifyPbpEvent(event: PlayByPlayEvent): PbpEventCategory {
  const categories = classifyPbpEventCategories(event);
  return categories[0] ?? 'violation';
}

function eventMatchesCategory(event: PbpClassifiedEvent, category: PbpEventCategory): boolean {
  return event.pbpCategories.includes(category);
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
    pbpCategories: classifyPbpEventCategories(event),
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

export function buildPbpPlayerOptions(
  events: PbpClassifiedEvent[],
  teamFilter: 'home' | 'away' | 'both',
  homeTeamId: string,
  awayTeamId: string,
): PbpPlayerOption[] {
  const map = new Map<string, PbpPlayerOption>();
  const targetTeamId = teamFilter === 'home' ? homeTeamId : teamFilter === 'away' ? awayTeamId : null;

  for (const event of events) {
    if (!event.playerId) continue;
    if (targetTeamId != null && event.teamId !== targetTeamId) continue;

    const id = String(event.playerId);
    const current = map.get(id) ?? {
      id,
      name: event.playerName ?? `Player ${id}`,
      eventCount: 0,
      teamId: event.teamId || null,
    };
    current.eventCount += 1;
    if (!current.name && event.playerName) current.name = event.playerName;
    if (!current.teamId && event.teamId) current.teamId = event.teamId;
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
    violation: 'Violation',
  };
  return labels[category];
}
