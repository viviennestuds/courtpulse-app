import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronDown, Clock3, Search, SlidersHorizontal, X } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { BorderRadius, FontSize, FontWeight, Spacing } from '@/constants/theme';
import DataSourceBadge from '@/components/DataSourceBadge';
import FilterChip from '@/components/FilterChip';
import type { DataSource } from '@/services/dataProvider';
import type { Game, PlayByPlayEvent } from '@/types';
import type { PbpEventCategory, PbpFilterQuery, PbpPlayerOption, PbpSortOrder } from '@/types/pbpFilters';
import {
  buildPbpPlayerOptions,
  classifyPbpEvents,
  filterPbpEvents,
  formatPbpCategoryLabel,
} from '@/utils/pbpFilters';

const EVENT_TYPE_FILTERS: Array<PbpEventCategory | 'all'> = [
  'all',
  'made_fg',
  'missed_fg',
  'free_throw',
  'rebound',
  'assist',
  'turnover',
  'steal',
  'block',
  'foul',
  'substitution',
  'timeout',
  'other',
];

interface GamePlayByPlayV1Props {
  events: PlayByPlayEvent[];
  pbpSource: DataSource;
  gameStatus: Game['status'];
  homeTeamId: string;
  awayTeamId: string;
  homeAbbr: string;
  awayAbbr: string;
}

function periodLabel(period: number): string {
  if (period <= 0) return '—';
  return period <= 4 ? `Q${period}` : `OT${period - 4}`;
}

function eventColor(category: PbpEventCategory): string {
  switch (category) {
    case 'made_fg':
    case 'free_throw':
    case 'assist':
      return Colors.positive;
    case 'missed_fg':
      return Colors.textMuted;
    case 'turnover':
      return Colors.negative;
    case 'steal':
      return Colors.secondary;
    case 'block':
      return Colors.accent;
    case 'foul':
      return Colors.warning;
    case 'rebound':
      return Colors.textSecondary;
    case 'substitution':
    case 'timeout':
    case 'other':
      return Colors.textMuted;
  }
}

function formatScore(event: PlayByPlayEvent): string | null {
  const homeScore = event.homeScore;
  const awayScore = event.awayScore;
  if (!Number.isFinite(homeScore) || !Number.isFinite(awayScore)) return null;
  return `${awayScore}-${homeScore}`;
}

export default React.memo(function GamePlayByPlayV1({
  events,
  pbpSource,
  gameStatus,
  homeTeamId,
  awayTeamId,
  homeAbbr,
  awayAbbr,
}: GamePlayByPlayV1Props) {
  const defaultSortOrder: PbpSortOrder = gameStatus === 'live' ? 'newest' : 'oldest';
  const [teamFilter, setTeamFilter] = useState<number>(2);
  const [periodFilter, setPeriodFilter] = useState<number>(0);
  const [clutchOnly, setClutchOnly] = useState<boolean>(false);
  const [playerFilter, setPlayerFilter] = useState<string | null>(null);
  const [eventCategory, setEventCategory] = useState<PbpEventCategory | 'all'>('all');
  const [sortOrder, setSortOrder] = useState<PbpSortOrder>(defaultSortOrder);
  const [playerSheetVisible, setPlayerSheetVisible] = useState<boolean>(false);

  useEffect(() => {
    setSortOrder(defaultSortOrder);
  }, [defaultSortOrder]);

  const classifiedEvents = useMemo(() => classifyPbpEvents(events), [events]);

  const maxPeriod = useMemo(() => {
    if (classifiedEvents.length === 0) return 4;
    return Math.max(4, ...classifiedEvents.map(event => Number.isFinite(event.period) ? event.period : 0));
  }, [classifiedEvents]);

  const periodTabs = useMemo(() => {
    const tabs = ['All'];
    for (let i = 1; i <= Math.min(maxPeriod, 4); i += 1) tabs.push(`Q${i}`);
    for (let i = 5; i <= maxPeriod; i += 1) tabs.push(`OT${i - 4}`);
    return tabs;
  }, [maxPeriod]);

  const playerOptions = useMemo<PbpPlayerOption[]>(() => buildPbpPlayerOptions(classifiedEvents), [classifiedEvents]);

  const selectedPlayerName = useMemo(() => {
    if (!playerFilter) return null;
    return playerOptions.find(player => player.id === playerFilter)?.name ?? null;
  }, [playerFilter, playerOptions]);

  const activeQuery = useMemo<PbpFilterQuery>(() => {
    return {
      team: teamFilter === 0 ? 'home' : teamFilter === 1 ? 'away' : 'both',
      period: periodFilter > 0 ? periodFilter : null,
      clutchOnly,
      playerId: playerFilter,
      eventCategory,
      sortOrder,
    };
  }, [teamFilter, periodFilter, clutchOnly, playerFilter, eventCategory, sortOrder]);

  const filteredResult = useMemo(() => {
    return filterPbpEvents(classifiedEvents, activeQuery, homeTeamId, awayTeamId);
  }, [classifiedEvents, activeQuery, homeTeamId, awayTeamId]);

  const teamTabs = useMemo(() => [homeAbbr, awayAbbr, 'Both'], [homeAbbr, awayAbbr]);

  const clearFilters = useCallback(() => {
    setTeamFilter(2);
    setPeriodFilter(0);
    setClutchOnly(false);
    setPlayerFilter(null);
    setEventCategory('all');
  }, []);

  const handlePlayerSelect = useCallback((id: string | null) => {
    setPlayerFilter(previous => previous === id ? null : id);
  }, []);

  if (events.length === 0) {
    return (
      <View>
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Play-by-play not available for this game</Text>
          <Text style={styles.emptySubtext}>Data will appear once the game starts or for completed games</Text>
        </View>
      </View>
    );
  }

  return (
    <View>
      <View style={styles.sourceRow}>
        <DataSourceBadge source={pbpSource} />
        <View style={styles.sortPillGroup}>
          <TouchableOpacity
            style={[styles.sortPill, sortOrder === 'newest' && styles.sortPillActive]}
            onPress={() => setSortOrder('newest')}
            activeOpacity={0.7}
          >
            <Text style={[styles.sortPillText, sortOrder === 'newest' && styles.sortPillTextActive]}>Newest first</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.sortPill, sortOrder === 'oldest' && styles.sortPillActive]}
            onPress={() => setSortOrder('oldest')}
            activeOpacity={0.7}
          >
            <Text style={[styles.sortPillText, sortOrder === 'oldest' && styles.sortPillTextActive]}>Oldest first</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.filterSection}>
        <View style={styles.filterLabelRow}>
          <SlidersHorizontal size={13} color={Colors.textMuted} />
          <Text style={styles.filterLabel}>Team</Text>
        </View>
        <View style={styles.teamTabsWrap}>
          {teamTabs.map((label, index) => (
            <FilterChip key={label} label={label} active={teamFilter === index} onPress={() => setTeamFilter(index)} />
          ))}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {periodTabs.map((label, index) => (
            <FilterChip key={label} label={label} active={periodFilter === index} onPress={() => setPeriodFilter(index)} />
          ))}
          <View style={styles.filterDivider} />
          <FilterChip label="Clutch" active={clutchOnly} onPress={() => setClutchOnly(previous => !previous)} />
        </ScrollView>

        <View style={styles.playerRow}>
          <TouchableOpacity
            style={[styles.playerFilterTrigger, playerFilter != null && styles.playerFilterTriggerActive]}
            onPress={() => setPlayerSheetVisible(true)}
            activeOpacity={0.7}
          >
            <Search size={13} color={playerFilter ? Colors.primary : Colors.textMuted} />
            <Text style={[styles.playerFilterText, playerFilter != null && styles.playerFilterTextActive]} numberOfLines={1}>
              {selectedPlayerName ?? 'All Players'}
            </Text>
            {playerFilter ? (
              <TouchableOpacity onPress={() => setPlayerFilter(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <X size={12} color={Colors.primary} />
              </TouchableOpacity>
            ) : (
              <ChevronDown size={13} color={Colors.textMuted} />
            )}
          </TouchableOpacity>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {EVENT_TYPE_FILTERS.map(category => (
            <FilterChip
              key={category}
              label={formatPbpCategoryLabel(category)}
              active={eventCategory === category}
              onPress={() => setEventCategory(category)}
            />
          ))}
        </ScrollView>
      </View>

      <View style={styles.summaryBar}>
        <View style={styles.summaryTextWrap}>
          <Text style={styles.summaryText}>
            {filteredResult.events.length} event{filteredResult.events.length !== 1 ? 's' : ''} matching {filteredResult.activeFilterCount} filter{filteredResult.activeFilterCount !== 1 ? 's' : ''}
          </Text>
          {clutchOnly && (
            <Text style={styles.clutchHint}>Clutch: final 5:00 of Q4/OT, margin ≤ 5</Text>
          )}
        </View>
        {filteredResult.activeFilterCount > 1 && (
          <TouchableOpacity onPress={clearFilters} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
            <Text style={styles.clearText}>Clear all</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.eventList}>
        {filteredResult.events.map(event => {
          const color = eventColor(event.pbpCategory);
          const score = formatScore(event);
          const isHome = event.teamId === homeTeamId || event.teamAbbr === homeAbbr;
          return (
            <View key={event.id} style={styles.eventCard}>
              <View style={styles.timeRail}>
                <Text style={styles.periodText}>{periodLabel(event.period)}</Text>
                <Text style={styles.clockText}>{event.clock || '—'}</Text>
              </View>
              <View style={[styles.eventDot, { backgroundColor: color }]} />
              <View style={styles.eventBody}>
                <View style={styles.eventMetaRow}>
                  <Text style={[styles.teamText, { color }]}>{event.teamAbbr || (isHome ? homeAbbr : awayAbbr) || '—'}</Text>
                  <Text style={styles.categoryText}>{formatPbpCategoryLabel(event.pbpCategory)}</Text>
                  {event.isClutchContext && <Text style={styles.clutchBadge}>CLUTCH</Text>}
                </View>
                <Text style={styles.eventDescription} numberOfLines={3}>{event.description || 'No event description'}</Text>
              </View>
              <View style={styles.scoreCol}>
                <Clock3 size={10} color={Colors.textMuted} />
                <Text style={styles.scoreText}>{score ?? '—'}</Text>
              </View>
            </View>
          );
        })}
      </View>

      {filteredResult.events.length === 0 && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No events match current filters</Text>
          <Text style={styles.emptySubtext}>Try clearing a player, period, clutch, or event type filter.</Text>
        </View>
      )}

      <PbpPlayerSheet
        visible={playerSheetVisible}
        onClose={() => setPlayerSheetVisible(false)}
        players={playerOptions}
        selectedId={playerFilter}
        onSelect={handlePlayerSelect}
      />
    </View>
  );
});

function PbpPlayerSheet({
  visible,
  onClose,
  players,
  selectedId,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  players: PbpPlayerOption[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const [search, setSearch] = useState<string>('');
  const insets = useSafeAreaInsets();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return players;
    return players.filter(player => player.name.toLowerCase().includes(q));
  }, [players, search]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.sheetOverlay}>
        <Pressable style={styles.sheetDismiss} onPress={onClose} />
        <View style={[styles.sheetContainer, { paddingBottom: insets.bottom + Spacing.md }]}> 
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Filter PBP by Player</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <X size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <View style={styles.sheetSearchBar}>
            <Search size={14} color={Colors.textMuted} />
            <TextInput
              style={styles.sheetSearchInput}
              placeholder="Search players..."
              placeholderTextColor={Colors.textMuted}
              value={search}
              onChangeText={setSearch}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
          {selectedId && (
            <TouchableOpacity
              style={styles.sheetClearRow}
              onPress={() => { onSelect(null); onClose(); }}
              activeOpacity={0.7}
            >
              <Text style={styles.sheetClearText}>Clear player filter</Text>
            </TouchableOpacity>
          )}
          <ScrollView style={styles.sheetList} showsVerticalScrollIndicator={false}>
            {filtered.map(player => {
              const isSelected = selectedId === player.id;
              return (
                <TouchableOpacity
                  key={player.id}
                  style={[styles.sheetPlayerRow, isSelected && styles.sheetPlayerRowSelected]}
                  onPress={() => { onSelect(player.id); onClose(); }}
                  activeOpacity={0.6}
                >
                  <View style={styles.sheetPlayerInfo}>
                    <Text style={[styles.sheetPlayerName, isSelected && styles.sheetPlayerNameSelected]} numberOfLines={1}>
                      {player.name}
                    </Text>
                    <Text style={styles.sheetPlayerMeta}>{player.eventCount} event{player.eventCount !== 1 ? 's' : ''}</Text>
                  </View>
                  {isSelected && (
                    <View style={styles.sheetCheckmark}>
                      <Text style={styles.sheetCheckmarkText}>✓</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
            {filtered.length === 0 && (
              <Text style={styles.sheetEmptyText}>No players match that search.</Text>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  sortPillGroup: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: 2,
  },
  sortPill: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 5,
    borderRadius: BorderRadius.full,
  },
  sortPillActive: {
    backgroundColor: Colors.primaryMuted,
  },
  sortPillText: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
  },
  sortPillTextActive: {
    color: Colors.primary,
  },
  filterSection: {
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  filterLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  filterLabel: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.8,
    textTransform: 'uppercase' as const,
  },
  teamTabsWrap: {
    flexDirection: 'row',
    gap: Spacing.sm,
    flexWrap: 'wrap',
  },
  chipRow: {
    gap: Spacing.sm,
    paddingVertical: 2,
  },
  filterDivider: {
    width: 1,
    height: 20,
    backgroundColor: Colors.divider,
    alignSelf: 'center' as const,
    marginHorizontal: Spacing.xs,
  },
  playerRow: {
    flexDirection: 'row',
  },
  playerFilterTrigger: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  playerFilterTriggerActive: {
    backgroundColor: Colors.primaryMuted,
    borderColor: Colors.primary,
  },
  playerFilterText: {
    flex: 1,
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
  playerFilterTextActive: {
    color: Colors.primary,
    fontWeight: FontWeight.semibold,
  },
  summaryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
    backgroundColor: Colors.cardBg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.md,
  },
  summaryTextWrap: {
    flex: 1,
    gap: 2,
  },
  summaryText: {
    color: Colors.textSecondary,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
  },
  clutchHint: {
    color: Colors.warning,
    fontSize: FontSize.xs,
    lineHeight: 16,
  },
  clearText: {
    color: Colors.primary,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
  },
  eventList: {
    gap: Spacing.sm,
  },
  eventCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.cardBg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: Spacing.md,
  },
  timeRail: {
    width: 48,
    alignItems: 'flex-start',
  },
  periodText: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.5,
  },
  clockText: {
    color: Colors.textPrimary,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    fontVariant: ['tabular-nums'] as const,
    marginTop: 2,
  },
  eventDot: {
    width: 4,
    height: 38,
    borderRadius: 4,
  },
  eventBody: {
    flex: 1,
    gap: 5,
  },
  eventMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  teamText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.5,
    minWidth: 30,
  },
  categoryText: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
  },
  clutchBadge: {
    color: Colors.warning,
    backgroundColor: Colors.warningMuted,
    overflow: 'hidden' as const,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: 5,
    paddingVertical: 1,
    fontSize: 8,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.6,
  },
  eventDescription: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    lineHeight: 18,
  },
  scoreCol: {
    minWidth: 48,
    alignItems: 'flex-end',
    gap: 3,
  },
  scoreText: {
    color: Colors.textPrimary,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    fontVariant: ['tabular-nums'] as const,
  },
  emptyState: {
    padding: Spacing.xxxl,
    alignItems: 'center',
    gap: Spacing.xs,
  },
  emptyText: {
    color: Colors.textMuted,
    fontSize: FontSize.md,
    textAlign: 'center' as const,
  },
  emptySubtext: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    textAlign: 'center' as const,
    lineHeight: 18,
  },
  sheetOverlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'flex-end',
  },
  sheetDismiss: {
    flex: 1,
  },
  sheetContainer: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    maxHeight: '80%',
    paddingHorizontal: Spacing.lg,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.divider,
    alignSelf: 'center',
    marginTop: Spacing.md,
    marginBottom: Spacing.md,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  sheetTitle: {
    color: Colors.textPrimary,
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
  },
  sheetSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.md,
  },
  sheetSearchInput: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: FontSize.sm,
    padding: 0,
  },
  sheetClearRow: {
    backgroundColor: Colors.primaryMuted,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  sheetClearText: {
    color: Colors.primary,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    textAlign: 'center' as const,
  },
  sheetList: {
    maxHeight: 420,
  },
  sheetPlayerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  sheetPlayerRowSelected: {
    backgroundColor: Colors.primaryMuted,
    marginHorizontal: -Spacing.sm,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  sheetPlayerInfo: {
    flex: 1,
  },
  sheetPlayerName: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  sheetPlayerNameSelected: {
    color: Colors.primary,
  },
  sheetPlayerMeta: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    marginTop: 2,
  },
  sheetCheckmark: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetCheckmarkText: {
    color: Colors.background,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
  },
  sheetEmptyText: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    textAlign: 'center' as const,
    paddingVertical: Spacing.xl,
  },
});
