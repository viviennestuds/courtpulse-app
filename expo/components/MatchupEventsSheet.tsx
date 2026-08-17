import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RotateCcw, X } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { BorderRadius, FontSize, FontWeight, Spacing } from '@/constants/theme';
import { useGameMatchupEventsV2 } from '@/hooks/useGameMatchupEventsV2';
import type { MatchupSummaryV2GameStatus } from '@/hooks/useGameMatchupSummaryV2';
import { parsePTClock } from '@/services/nbaApi';
import type {
  MatchupEventsV2Action,
  MatchupEventsV2Event,
  MatchupEventsV2PlayerIdentity,
  MatchupEventsV2SourceOverlap,
  MatchupEventsV2SourceOverlapAssignment,
} from '@/types/matchupEventsV2';

export interface MatchupEventsPairSnapshot {
  gameId: string;
  offensePlayerId: string;
  offenseName: string;
  offenseTeamId?: string;
  offenseTeamTricode?: string;
  defensePlayerId: string;
  defenseName: string;
  defenseTeamId?: string;
  defenseTeamTricode?: string;
  matchupTime: string;
  partialPossessions: number;
}

type MatchupEventsFilter = 'all' | 'shots' | 'turnovers' | 'fouls';

interface MatchupEventsSheetProps {
  visible: boolean;
  enabled: boolean;
  pair: MatchupEventsPairSnapshot | null;
  status: MatchupSummaryV2GameStatus;
  onClose: () => void;
}

const FILTERS: { key: MatchupEventsFilter; label: string }[] = [
  { key: 'all', label: 'ALL' },
  { key: 'shots', label: 'SHOTS' },
  { key: 'turnovers', label: 'TURNOVERS' },
  { key: 'fouls', label: 'FOULS' },
];

function hasType(event: MatchupEventsV2Event, type: string): boolean {
  return event.types.includes(type);
}

/** Classifies canonical events for local display without making categories exclusive. */
export function matchupEventsV2EventMatchesFilter(
  event: MatchupEventsV2Event,
  filter: MatchupEventsFilter,
): boolean {
  if (filter === 'all') return true;
  if (filter === 'shots') return hasType(event, 'fieldGoalAttempt') || hasType(event, 'blockedAttempt');
  if (filter === 'turnovers') {
    return hasType(event, 'turnover') || hasType(event, 'offensiveFoulTurnover') || hasType(event, 'steal');
  }
  return hasType(event, 'shootingFoul')
    || hasType(event, 'freeThrowSequence')
    || hasType(event, 'offensiveFoulTurnover');
}

/** Formats a canonical event's non-causal evidence badge. */
export function matchupEventsV2EventBadge(event: MatchupEventsV2Event): string {
  if (hasType(event, 'offensiveFoulTurnover')) return 'OFFENSIVE FOUL TURNOVER';
  if (hasType(event, 'shootingFoul') && hasType(event, 'freeThrowSequence')) return 'SHOOTING FOUL · FT TRIP';
  if (hasType(event, 'fieldGoalAttempt') && hasType(event, 'blockedAttempt')) return 'MISSED FGA · BLOCKED';
  if (hasType(event, 'fieldGoalAttempt') && hasType(event, 'madeFieldGoal')) return 'MADE FGA';
  if (hasType(event, 'fieldGoalAttempt') && hasType(event, 'missedFieldGoal')) return 'MISSED FGA';
  if (hasType(event, 'turnover') && hasType(event, 'steal')) return 'TURNOVER · STEAL';
  if (hasType(event, 'turnover')) return 'TURNOVER';
  if (hasType(event, 'shootingFoul')) return 'SHOOTING FOUL';
  if (hasType(event, 'freeThrowSequence')) return 'FT TRIP';
  return event.types[0]?.replace(/([a-z])([A-Z])/g, '$1 $2').toUpperCase() ?? 'OFFICIAL MATCHUP EVENT';
}

function badgeColors(event: MatchupEventsV2Event): { backgroundColor: string; color: string } {
  if (hasType(event, 'madeFieldGoal')) return { backgroundColor: Colors.positiveMuted, color: Colors.positive };
  if (hasType(event, 'turnover') || hasType(event, 'offensiveFoulTurnover')) {
    return { backgroundColor: Colors.warningMuted, color: Colors.warning };
  }
  if (hasType(event, 'shootingFoul') || hasType(event, 'freeThrowSequence')) {
    return { backgroundColor: Colors.accentMuted, color: Colors.accent };
  }
  return { backgroundColor: Colors.secondaryMuted, color: Colors.secondary };
}

function normalizedId(value: string | number): string {
  return String(value).trim();
}

function uniqueDescriptions(event: MatchupEventsV2Event, primaryDescription: string): string[] {
  const candidates: string[] = [
    ...event.counterpartActions.map((action: MatchupEventsV2Action) => action.description),
    ...event.descriptions,
  ];
  const seen = new Set<string>([primaryDescription.trim()]);
  return candidates.filter((description: string) => {
    const normalized = description.trim();
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

function relationshipForActor(event: MatchupEventsV2Event, actorKey: string): string | undefined {
  const value = event.defensiveActorRelationship[actorKey];
  return typeof value === 'string' ? value : undefined;
}

function thirdPartyActors(
  event: MatchupEventsV2Event,
  matchupDefenderId: string | number,
): MatchupEventsV2PlayerIdentity[] {
  const actorEntries: [string, MatchupEventsV2PlayerIdentity | null | undefined][] = [
    ['stealer', event.creditedDefensiveActors.stealer],
    ['blocker', event.creditedDefensiveActors.blocker],
    ['shootingFouler', event.creditedDefensiveActors.shootingFouler],
    ['offensiveFoulDrawer', event.creditedDefensiveActors.offensiveFoulDrawer],
  ];
  const seen = new Set<string>();
  return actorEntries.reduce<MatchupEventsV2PlayerIdentity[]>((actors, [key, actor]) => {
    if (!actor) return actors;
    const actorId = normalizedId(actor.playerId);
    const explicitlyThirdParty = relationshipForActor(event, key) === 'thirdParty';
    const overallThirdParty = event.defensiveActorRelationship.overall === 'thirdParty'
      && actorId !== normalizedId(matchupDefenderId);
    if (!(explicitlyThirdParty || overallThirdParty) || seen.has(actorId)) return actors;
    seen.add(actorId);
    actors.push(actor);
    return actors;
  }, []);
}

function recordValue(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function assignmentName(assignment: MatchupEventsV2SourceOverlapAssignment): string | null {
  if (typeof assignment.name === 'string' && assignment.name.trim()) return assignment.name;
  if (assignment.defense?.name) return assignment.defense.name;
  if (assignment.offense?.name) return assignment.offense.name;
  const pairing = recordValue(assignment.pairing);
  const pairingDefense = recordValue(pairing?.defense);
  const pairingOffense = recordValue(pairing?.offense);
  const values: unknown[] = [
    assignment.defenseName,
    assignment.offenseName,
    assignment.playerName,
    pairingDefense?.name,
    pairingOffense?.name,
  ];
  const name = values.find((value: unknown) => typeof value === 'string' && value.trim().length > 0);
  return typeof name === 'string' ? name : null;
}

function overlapNames(overlap: MatchupEventsV2SourceOverlap): string[] {
  const names: string[] = [];
  Object.values(overlap).forEach((value: unknown) => {
    if (!Array.isArray(value)) return;
    value.forEach((entry: unknown) => {
      if (typeof entry === 'string' && entry.trim()) {
        names.push(entry);
        return;
      }
      const assignment = recordValue(entry);
      if (!assignment) return;
      const name = assignmentName(assignment as MatchupEventsV2SourceOverlapAssignment);
      if (name) names.push(name);
    });
  });
  return [...new Set(names)];
}

function EventRow({
  event,
  offense,
  defense,
}: {
  event: MatchupEventsV2Event;
  offense: MatchupEventsV2PlayerIdentity;
  defense: MatchupEventsV2PlayerIdentity;
}) {
  const primaryDescription = event.primaryAction?.description
    ?? event.descriptions[0]
    ?? 'Official matchup event';
  const secondaryDescriptions = uniqueDescriptions(event, primaryDescription);
  const creditedThirdParties = thirdPartyActors(event, defense.playerId);
  const overlap = event.sourceOverlap?.observed === true ? event.sourceOverlap : null;
  const overlappingNames = overlap ? overlapNames(overlap) : [];
  const badge = matchupEventsV2EventBadge(event);
  const colors = badgeColors(event);
  const sourceLabel = event.matchupAttribution.status === 'officialMatchupEvent'
    ? 'Official matchup event'
    : hasType(event, 'shootingFoul')
      ? 'PBP foul/FT sequence'
      : 'NBA matchup attribution';

  return (
    <View style={styles.eventRow} testID={`matchup-v2-event-${normalizedId(event.gameEventId)}`}>
      <View style={styles.eventMetaRow}>
        <Text style={styles.eventClock}>Q{event.period} {parsePTClock(event.clock)}</Text>
        <View style={[styles.eventBadge, { backgroundColor: colors.backgroundColor }]}>
          <Text style={[styles.eventBadgeText, { color: colors.color }]}>{badge}</Text>
        </View>
      </View>

      <Text style={styles.primaryDescription}>{primaryDescription}</Text>
      {secondaryDescriptions.map((description: string) => (
        <Text key={description} style={styles.counterpartDescription}>{description}</Text>
      ))}

      {hasType(event, 'offensiveFoulTurnover') ? (
        <Text style={styles.attributionLine}>
          NBA matchup attribution: {offense.name} → {defense.name}
        </Text>
      ) : null}

      {creditedThirdParties.length > 0 ? (
        <View style={styles.actorDisclosure}>
          <View style={styles.actorDisclosureColumn}>
            <Text style={styles.disclosureLabel}>MATCHUP DEFENDER</Text>
            <Text style={styles.disclosureValue}>{defense.name}</Text>
          </View>
          <View style={styles.actorDisclosureColumn}>
            <Text style={styles.disclosureLabel}>
              {creditedThirdParties.length === 1 ? 'CREDITED DEFENSIVE ACTOR' : 'CREDITED DEFENSIVE ACTORS'}
            </Text>
            {creditedThirdParties.map((actor: MatchupEventsV2PlayerIdentity) => (
              <Text key={normalizedId(actor.playerId)} style={styles.disclosureValue}>{actor.name}</Text>
            ))}
          </View>
        </View>
      ) : null}

      <Text style={styles.sourceLabel}>{sourceLabel}</Text>

      {overlap ? (
        <View style={styles.overlapNote}>
          <Text style={styles.overlapLabel}>NBA MATCHUP ATTRIBUTION</Text>
          <Text style={styles.overlapText}>
            {overlappingNames.length > 0
              ? `This event also appears in matchup assignments for: ${overlappingNames.join(', ')}.`
              : 'This event also appears in another NBA matchup assignment.'}
          </Text>
          <Text style={styles.overlapGuardrail}>
            Shared NBA matchup attribution does not imply equal defensive influence.
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function ActivitySummary({
  steals,
  blocks,
  shootingFouls,
  pairOffensiveFouls,
}: {
  steals: number;
  blocks: number;
  shootingFouls: number;
  pairOffensiveFouls: number;
}) {
  const activity: string[] = [];
  if (steals > 0) activity.push(`${steals} STL`);
  if (blocks > 0) activity.push(`${blocks} BLK`);
  if (shootingFouls > 0) activity.push(`${shootingFouls} shooting foul${shootingFouls === 1 ? '' : 's'}`);

  if (activity.length === 0 && pairOffensiveFouls === 0) return null;
  return (
    <View style={styles.activityCard}>
      {activity.length > 0 ? (
        <View style={styles.activitySection}>
          <Text style={styles.activityLabel}>DEF ACTIVITY</Text>
          <Text style={styles.activityValue}>{activity.join(' · ')}</Text>
        </View>
      ) : null}
      {pairOffensiveFouls > 0 ? (
        <View style={styles.activitySection}>
          <Text style={styles.pairEvidenceLabel}>PAIR EVIDENCE</Text>
          <Text style={styles.activityValue}>
            {pairOffensiveFouls} offensive-foul TOV
          </Text>
        </View>
      ) : null}
    </View>
  );
}

export default React.memo(function MatchupEventsSheet({
  visible,
  enabled,
  pair,
  status,
  onClose,
}: MatchupEventsSheetProps) {
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<MatchupEventsFilter>('all');
  const pairKey = pair ? `${pair.gameId}:${pair.offensePlayerId}:${pair.defensePlayerId}` : '';

  useEffect(() => {
    setFilter('all');
  }, [pairKey]);

  const query = useGameMatchupEventsV2({
    gameId: pair?.gameId ?? '',
    offensePlayerId: pair?.offensePlayerId ?? '',
    defensePlayerId: pair?.defensePlayerId ?? '',
    enabled: enabled && visible && pair !== null,
    status,
  });
  const response = query.data;
  const events = response?.events;
  const visibleEvents = useMemo(
    () => (events ?? []).filter((event: MatchupEventsV2Event) => matchupEventsV2EventMatchesFilter(event, filter)),
    [events, filter],
  );

  const offense: MatchupEventsV2PlayerIdentity = response?.pairing.offense ?? {
    playerId: pair?.offensePlayerId ?? '',
    name: pair?.offenseName ?? 'Offensive player',
    teamId: pair?.offenseTeamId ?? 'unknown',
    teamTricode: pair?.offenseTeamTricode ?? '',
  };
  const defense: MatchupEventsV2PlayerIdentity = response?.pairing.defense ?? {
    playerId: pair?.defensePlayerId ?? '',
    name: pair?.defenseName ?? 'Matchup defender',
    teamId: pair?.defenseTeamId ?? 'unknown',
    teamTricode: pair?.defenseTeamTricode ?? '',
  };
  const matchupTime = response?.matchupExposure.matchupTime ?? pair?.matchupTime ?? '';
  const partialPossessions = response?.matchupExposure.partialPossessions ?? pair?.partialPossessions ?? 0;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay} testID="matchup-v2-events-sheet">
        <Pressable style={styles.backdropDismiss} onPress={onClose} accessibilityLabel="Dismiss matchup events" />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + Spacing.lg }]}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={styles.title}>MATCHUP EVENTS</Text>
              <Text style={styles.pairTitle} numberOfLines={2}>{offense.name} vs {defense.name}</Text>
              <Text style={styles.subtitle}>
                {matchupTime} · {partialPossessions.toFixed(1)} matchup poss.
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              style={({ pressed }: { pressed: boolean }) => [styles.closeButton, pressed && styles.controlPressed]}
              accessibilityRole="button"
              accessibilityLabel="Close matchup events"
              testID="matchup-v2-events-close"
            >
              <X size={20} color={Colors.textSecondary} />
            </Pressable>
          </View>

          <View style={styles.filterRow}>
            {FILTERS.map(({ key, label }: { key: MatchupEventsFilter; label: string }) => {
              const selected = filter === key;
              return (
                <Pressable
                  key={key}
                  onPress={() => setFilter(key)}
                  style={({ pressed }: { pressed: boolean }) => [
                    styles.filterChip,
                    selected && styles.filterChipSelected,
                    pressed && styles.controlPressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`${label.toLowerCase()} matchup events filter`}
                  testID={`matchup-v2-events-filter-${key}`}
                >
                  <Text style={[styles.filterText, selected && styles.filterTextSelected]}>{label}</Text>
                </Pressable>
              );
            })}
          </View>

          {query.isPending ? (
            <View style={styles.stateContainer}>
              <ActivityIndicator size="small" color={Colors.secondary} />
              <Text style={styles.stateText}>Loading matchup evidence…</Text>
            </View>
          ) : query.isError ? (
            <View style={styles.stateContainer}>
              <Text style={styles.stateText}>Matchup event evidence unavailable.</Text>
              <Pressable
                onPress={() => void query.refetch()}
                style={({ pressed }: { pressed: boolean }) => [styles.retryButton, pressed && styles.controlPressed]}
                accessibilityRole="button"
                testID="matchup-v2-events-retry"
              >
                <RotateCcw size={13} color={Colors.secondary} />
                <Text style={styles.retryText}>Retry</Text>
              </Pressable>
            </View>
          ) : response ? (
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              <ActivitySummary
                steals={response.defenderActivity.steals.status === 'verified'
                  ? response.defenderActivity.steals.count
                  : 0}
                blocks={response.defenderActivity.blocks.status === 'verified'
                  ? response.defenderActivity.blocks.count
                  : 0}
                shootingFouls={response.defenderActivity.shootingFoulsCommitted.status === 'verified'
                  ? response.defenderActivity.shootingFoulsCommitted.count
                  : 0}
                pairOffensiveFouls={response.defenderActivity.offensiveFoulTurnoversAttributedToPair.status === 'verifiedPairAttribution'
                  ? response.defenderActivity.offensiveFoulTurnoversAttributedToPair.count
                  : 0}
              />
              {response.events.length === 0 ? (
                <Text style={styles.emptyText}>No attributed matchup events were returned for this pairing.</Text>
              ) : visibleEvents.length === 0 ? (
                <Text style={styles.emptyText}>No {filter} events for this pairing.</Text>
              ) : (
                visibleEvents.map((event: MatchupEventsV2Event) => (
                  <EventRow
                    key={normalizedId(event.gameEventId)}
                    event={event}
                    offense={response.pairing.offense}
                    defense={response.pairing.defense}
                  />
                ))
              )}
            </ScrollView>
          ) : null}
        </View>
      </View>
    </Modal>
  );
});

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: Colors.overlay,
  },
  backdropDismiss: {
    flex: 1,
  },
  sheet: {
    maxHeight: '88%',
    backgroundColor: Colors.cardBg,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.cardBorder,
    alignSelf: 'center',
    marginBottom: Spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
  },
  headerCopy: {
    flex: 1,
  },
  title: {
    color: Colors.secondary,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    letterSpacing: 1.4,
  },
  pairTitle: {
    color: Colors.textPrimary,
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    lineHeight: 24,
    marginTop: 4,
  },
  subtitle: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    marginTop: 4,
    fontVariant: ['tabular-nums'] as const,
  },
  closeButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -8,
    marginRight: -8,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
  },
  filterChip: {
    minHeight: 36,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    backgroundColor: Colors.surface,
    paddingHorizontal: 7,
  },
  filterChipSelected: {
    borderColor: Colors.secondary,
    backgroundColor: Colors.secondaryMuted,
  },
  filterText: {
    color: Colors.textMuted,
    fontSize: 9,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.5,
  },
  filterTextSelected: {
    color: Colors.secondary,
  },
  controlPressed: {
    opacity: 0.58,
  },
  stateContainer: {
    minHeight: 200,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  stateText: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    textAlign: 'center',
  },
  retryButton: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.secondaryMuted,
    paddingHorizontal: Spacing.lg,
  },
  retryText: {
    color: Colors.secondary,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
  },
  scroll: {
    maxHeight: 590,
  },
  scrollContent: {
    paddingBottom: Spacing.md,
  },
  activityCard: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    backgroundColor: Colors.surfaceLight,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  activitySection: {
    minWidth: 130,
    flex: 1,
  },
  activityLabel: {
    color: Colors.secondary,
    fontSize: 9,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.8,
  },
  pairEvidenceLabel: {
    color: Colors.accent,
    fontSize: 9,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.8,
  },
  activityValue: {
    color: Colors.textSecondary,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    marginTop: 4,
    fontVariant: ['tabular-nums'] as const,
  },
  eventRow: {
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  eventMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  eventClock: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    fontVariant: ['tabular-nums'] as const,
  },
  eventBadge: {
    flexShrink: 1,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  eventBadgeText: {
    fontSize: 8,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.6,
  },
  primaryDescription: {
    color: Colors.textPrimary,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    lineHeight: 18,
    marginTop: Spacing.sm,
  },
  counterpartDescription: {
    color: Colors.textSecondary,
    fontSize: FontSize.xs,
    lineHeight: 17,
    marginTop: 3,
  },
  attributionLine: {
    color: Colors.textSecondary,
    fontSize: FontSize.xs,
    lineHeight: 17,
    marginTop: Spacing.sm,
  },
  actorDisclosure: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
    borderLeftWidth: 2,
    borderLeftColor: Colors.secondary,
    backgroundColor: Colors.surfaceLight,
    borderRadius: BorderRadius.sm,
    padding: Spacing.sm,
    marginTop: Spacing.sm,
  },
  actorDisclosureColumn: {
    minWidth: 120,
    flex: 1,
  },
  disclosureLabel: {
    color: Colors.textMuted,
    fontSize: 8,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.7,
  },
  disclosureValue: {
    color: Colors.textPrimary,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    marginTop: 3,
  },
  sourceLabel: {
    color: Colors.textMuted,
    fontSize: 9,
    marginTop: Spacing.sm,
  },
  overlapNote: {
    backgroundColor: Colors.accentMuted,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    marginTop: Spacing.sm,
  },
  overlapLabel: {
    color: Colors.accent,
    fontSize: 8,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.7,
  },
  overlapText: {
    color: Colors.textSecondary,
    fontSize: FontSize.xs,
    lineHeight: 17,
    marginTop: 4,
  },
  overlapGuardrail: {
    color: Colors.textMuted,
    fontSize: 10,
    lineHeight: 15,
    marginTop: 4,
  },
  emptyText: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    lineHeight: 20,
    textAlign: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xxl,
  },
});
