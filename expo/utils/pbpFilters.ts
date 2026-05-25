import type { PlayByPlayEvent } from '@/types';
import { clockToSeconds, hasExplicitFastBreakSignal, isClutchContext } from '@/utils/basketballContext';
import type {
  PbpClassifiedEvent,
  PbpDerivedContextTag,
  PbpEventCategory,
  PbpFilterQuery,
  PbpFilterResult,
  PbpPlayerOption,
  PbpSortOrder,
} from '@/types/pbpFilters';

function normalizedDescription(event: PlayByPlayEvent): string {
  return (event.description ?? '').toLowerCase();
}

/**
 * Tags clutch context from current event state only.
 * Clutch = Q4/OT, final 5:00 or less, score margin <= 5.
 */
export function isPbpClutchEvent(event: PlayByPlayEvent): boolean {
  return isClutchContext({
    period: event.period,
    clockSecondsRemaining: clockToSeconds(event.clock),
    homeScore: event.homeScore,
    awayScore: event.awayScore,
  });
}

/**
 * First-pass event classifier for filter chips. It intentionally favors safe,
 * readable categories over exact NBA action taxonomy until raw action metadata
 * is threaded into this screen.
 */
function isFreeThrowDescription(desc: string): boolean {
  return desc.includes('free throw') || desc.includes('freethrow');
}

function parseAssistNameFromDescription(description: string | null | undefined): string | null {
  const text = description?.trim() ?? '';
  if (!text) return null;
  const match = text.match(/\(([^()]+?)\s+\d+\s+AST\)$/i);
  return match?.[1]?.trim() ?? null;
}

function hasAssistAttribution(event: PlayByPlayEvent): boolean {
  if (event.assistPlayerId || event.assistPlayerName) return true;
  return parseAssistNameFromDescription(event.description) != null;
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

  if (type === 'foul' || desc.includes('foul')) categories.add('foul');
  if (type === 'score' && !isFreeThrow) categories.add('made_fg');
  if (type === 'miss' && !isFreeThrow && !isViolation) categories.add('missed_fg');
  if (type === 'score' && !isFreeThrow && hasAssistAttribution(event)) categories.add('assist');

  return Array.from(categories);
}

export function classifyPbpEvent(event: PlayByPlayEvent): PbpEventCategory {
  const categories = classifyPbpEventCategories(event);
  if (categories.includes('made_fg')) return 'made_fg';
  if (categories.includes('foul')) return 'foul';
  return categories[0] ?? 'violation';
}

function eventMatchesCategory(event: PbpClassifiedEvent, category: PbpEventCategory): boolean {
  return event.pbpCategories.includes(category);
}

function idMatches(value: string | null | undefined, playerId: string): boolean {
  return value != null && String(value) === playerId;
}

function eventHasBroadPlayerInvolvement(event: PbpClassifiedEvent, playerId: string): boolean {
  return event.involvedPlayerIds.includes(playerId) || idMatches(event.playerId, playerId) || idMatches(event.assistPlayerId, playerId);
}

function eventMatchesPlayerRole(event: PbpClassifiedEvent, playerId: string, category: PbpEventCategory | 'all'): boolean {
  if (category === 'all') return eventHasBroadPlayerInvolvement(event, playerId);

  switch (category) {
    case 'made_fg':
    case 'missed_fg':
    case 'free_throw':
    case 'turnover':
    case 'steal':
    case 'foul':
    case 'violation':
    case 'rebound':
    case 'substitution':
    case 'timeout':
      return idMatches(event.playerId, playerId);
    case 'assist':
      return idMatches(event.assistPlayerId, playerId);
    case 'block':
      return idMatches(event.playerId, playerId) || eventHasBroadPlayerInvolvement(event, playerId);
  }
}

interface ClassifyPbpEventsOptions {
  enableDerivedTags?: boolean;
}

function isMadeScoringEvent(event: PbpClassifiedEvent): boolean {
  return event.eventType === 'score' && (event.scoreDelta ?? 0) > 0;
}

function isFreeThrowEvent(event: PbpClassifiedEvent): boolean {
  return event.pbpCategories.includes('free_throw');
}

function isPossessionEndingMissOrRebound(event: PbpClassifiedEvent): boolean {
  return event.pbpCategories.includes('missed_fg') || event.pbpCategories.includes('rebound');
}

function appendDerivedTag(event: PbpClassifiedEvent, tag: PbpDerivedContextTag): PbpClassifiedEvent {
  if (event.derivedTags.includes(tag)) return event;
  return { ...event, derivedTags: [...event.derivedTags, tag] };
}

/**
 * CourtPulse-derived context tags live separately from official PBP categories.
 * This pass keeps inference conservative: Fast Break requires explicit NBA/raw
 * metadata, and Off Turnover only tags immediate post-turnover scores before a
 * missed shot, rebound, timeout, or new turnover resets the sequence.
 */
export function derivePbpContextTags(events: PbpClassifiedEvent[]): PbpClassifiedEvent[] {
  let pendingTurnoverTeamId: string | null = null;
  let activeFreeThrowTeamId: string | null = null;

  return events.map(event => {
    let nextEvent = event;

    if (isMadeScoringEvent(nextEvent) && hasExplicitFastBreakSignal(nextEvent)) {
      nextEvent = appendDerivedTag(nextEvent, 'official_fast_break');
    }

    if (activeFreeThrowTeamId && isMadeScoringEvent(nextEvent) && isFreeThrowEvent(nextEvent) && nextEvent.teamId === activeFreeThrowTeamId) {
      nextEvent = appendDerivedTag(nextEvent, 'off_turnover');
      return nextEvent;
    }

    if (nextEvent.pbpCategories.includes('turnover')) {
      pendingTurnoverTeamId = nextEvent.teamId || null;
      activeFreeThrowTeamId = null;
      return nextEvent;
    }

    if (nextEvent.pbpCategories.includes('timeout')) {
      pendingTurnoverTeamId = null;
      activeFreeThrowTeamId = null;
      return nextEvent;
    }

    if (pendingTurnoverTeamId && isMadeScoringEvent(nextEvent) && nextEvent.teamId && nextEvent.teamId !== pendingTurnoverTeamId) {
      nextEvent = appendDerivedTag(nextEvent, 'off_turnover');
      activeFreeThrowTeamId = isFreeThrowEvent(nextEvent) ? nextEvent.teamId : null;
      if (!activeFreeThrowTeamId) pendingTurnoverTeamId = null;
      return nextEvent;
    }

    if (activeFreeThrowTeamId && (!isFreeThrowEvent(nextEvent) || nextEvent.teamId !== activeFreeThrowTeamId)) {
      pendingTurnoverTeamId = null;
      activeFreeThrowTeamId = null;
    }

    if (pendingTurnoverTeamId && isPossessionEndingMissOrRebound(nextEvent)) {
      pendingTurnoverTeamId = null;
      activeFreeThrowTeamId = null;
    }

    return nextEvent;
  });
}

function getEventInvolvedPlayerIds(event: PlayByPlayEvent): string[] {
  const ids = new Set<string>();
  for (const id of event.involvedPlayerIds ?? []) {
    if (id) ids.add(String(id));
  }
  if (event.playerId) ids.add(String(event.playerId));
  if (event.assistPlayerId) ids.add(String(event.assistPlayerId));
  return Array.from(ids);
}

function findPlayerNameForId(event: PbpClassifiedEvent, playerId: string): string | null {
  if (event.playerId && String(event.playerId) === playerId && event.playerName) return event.playerName;
  if (event.assistPlayerId && String(event.assistPlayerId) === playerId && event.assistPlayerName) return event.assistPlayerName;
  return null;
}

export function classifyPbpEvents(events: PlayByPlayEvent[], options: ClassifyPbpEventsOptions = {}): PbpClassifiedEvent[] {
  const classified = events.map((event, index) => ({
    ...event,
    pbpCategory: classifyPbpEvent(event),
    pbpCategories: classifyPbpEventCategories(event),
    derivedTags: [] as PbpDerivedContextTag[],
    isClutchContext: isPbpClutchEvent(event),
    sortIndex: index,
    involvedPlayerIds: getEventInvolvedPlayerIds(event),
  }));

  return options.enableDerivedTags ? derivePbpContextTags(classified) : classified;
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
  if (query.eventCategory !== 'all' && !eventMatchesCategory(event, query.eventCategory)) return false;
  if (query.playerId != null && !eventMatchesPlayerRole(event, query.playerId, query.eventCategory)) return false;
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
    if (targetTeamId != null && event.teamId !== targetTeamId) continue;

    for (const id of event.involvedPlayerIds) {
      const playerName = findPlayerNameForId(event, id);
      const current = map.get(id) ?? {
        id,
        name: playerName ?? `Player ${id}`,
        eventCount: 0,
        teamId: event.teamId || null,
      };
      current.eventCount += 1;
      if (current.name === `Player ${id}` && playerName) current.name = playerName;
      if (!current.teamId && event.teamId) current.teamId = event.teamId;
      map.set(id, current);
    }
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

export function formatPbpDerivedTagLabel(tag: PbpDerivedContextTag): string {
  const labels: Record<PbpDerivedContextTag, string> = {
    off_turnover: 'Off Turnover',
    early_offense: 'Early Offense',
    official_fast_break: 'Fast Break',
  };
  return labels[tag];
}
