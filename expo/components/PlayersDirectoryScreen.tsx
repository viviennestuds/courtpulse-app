import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AlertTriangle, Check, ChevronDown, RotateCcw, Search, X } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { BorderRadius, FontSize, FontWeight, Spacing } from '@/constants/theme';
import { usePlayersDirectory } from '@/hooks/usePlayersDirectory';
import PlayerDirectoryRow from '@/components/PlayerDirectoryRow';
import PlayersSelectionSheet, { PlayersSelectionOption } from '@/components/PlayersSelectionSheet';
import type { PlayerDirectoryEntry, PlayersSeasonPhase } from '@/types/playersDirectory';
import {
  derivePlayersTeamOptions,
  getPostseasonControlState,
  PLAYERS_DEFAULT_SEASON,
  PLAYERS_DIRECTORY_SEASONS,
  PLAYERS_SORT_OPTIONS,
  PlayersDirectorySortMetric,
  transformPlayersDirectory,
} from '@/utils/playersDirectoryUi';

type SelectorKind = 'season' | 'team' | 'games' | 'sort' | null;

interface FilterButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  testID: string;
  accessibilityLabel: string;
}

const REGULAR_MINIMUM_GAMES = [5, 10, 20, 40] as const;
const POSTSEASON_MINIMUM_GAMES = [1, 5, 10] as const;

const FilterButton = React.memo(function FilterButton({
  label,
  onPress,
  disabled = false,
  testID,
  accessibilityLabel,
}: FilterButtonProps) {
  return (
    <TouchableOpacity
      style={[styles.filterButton, disabled && styles.controlDisabled]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.72}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      testID={testID}
    >
      <Text style={styles.filterButtonText} numberOfLines={1}>{label}</Text>
      <ChevronDown size={14} color={disabled ? Colors.textMuted : Colors.textSecondary} />
    </TouchableOpacity>
  );
});

/** Production Home → Players directory consumer backed exclusively by PlayersRepository. */
export default function PlayersDirectoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [season, setSeason] = useState<string>(PLAYERS_DEFAULT_SEASON);
  const [phase, setPhase] = useState<PlayersSeasonPhase>('regular');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [teamKey, setTeamKey] = useState<string | null>(null);
  const [minimumGames, setMinimumGames] = useState<number | null>(null);
  const [sortMetric, setSortMetric] = useState<PlayersDirectorySortMetric>('PTS');
  const [selector, setSelector] = useState<SelectorKind>(null);
  const [isRetrying, setIsRetrying] = useState<boolean>(false);

  const {
    snapshot,
    cacheSource,
    freshness,
    isLoading,
    isRefreshing,
    error,
    refreshError,
    refresh,
  } = usePlayersDirectory({ season, phase });

  const teamOptions = useMemo(
    () => derivePlayersTeamOptions(snapshot?.players ?? []),
    [snapshot],
  );

  const selectedTeam = useMemo(
    () => teamOptions.find((option) => option.key === teamKey) ?? null,
    [teamKey, teamOptions],
  );

  const displayedPlayers = useMemo(
    () => transformPlayersDirectory(snapshot?.players ?? [], {
      searchQuery,
      teamKey,
      minimumGames,
      sortMetric,
    }),
    [minimumGames, searchQuery, snapshot, sortMetric, teamKey],
  );

  const postseasonControl = useMemo(
    () => getPostseasonControlState(snapshot?.phaseAvailability.postseason ?? null),
    [snapshot],
  );

  const minimumGamesOptions = phase === 'regular' ? REGULAR_MINIMUM_GAMES : POSTSEASON_MINIMUM_GAMES;
  const hasLocalFilters = searchQuery.trim().length > 0 || teamKey !== null || minimumGames !== null;
  const hasPartialData = snapshot?.partial === true || (snapshot?.population.partialPlayerCount ?? 0) > 0;
  const hasValidEmptyPhase = snapshot?.dataAvailable === false && snapshot.noDataConfirmed === true;

  const handleSeasonSelect = useCallback((nextSeason: string) => {
    if (!PLAYERS_DIRECTORY_SEASONS.some((option) => option === nextSeason)) return;
    setSeason(nextSeason);
    setPhase('regular');
    setTeamKey(null);
    setMinimumGames(null);
  }, []);

  const handlePhaseSelect = useCallback((nextPhase: PlayersSeasonPhase) => {
    if (nextPhase === phase) return;
    setPhase(nextPhase);
    setTeamKey(null);
    setMinimumGames(null);
  }, [phase]);

  const handleRefresh = useCallback(async () => {
    await refresh();
  }, [refresh]);

  const handleRetry = useCallback(async () => {
    setIsRetrying(true);
    try {
      await refresh();
    } finally {
      setIsRetrying(false);
    }
  }, [refresh]);

  const handlePlayerPress = useCallback((playerId: string) => {
    router.push(`/player/${playerId}`);
  }, [router]);

  const clearLocalFilters = useCallback(() => {
    setSearchQuery('');
    setTeamKey(null);
    setMinimumGames(null);
  }, []);

  const selectorConfiguration = useMemo<{
    title: string;
    options: PlayersSelectionOption[];
    selectedValue: string;
  }>(() => {
    if (selector === 'season') {
      return {
        title: 'Season',
        options: PLAYERS_DIRECTORY_SEASONS.map((option) => ({ value: option, label: option })),
        selectedValue: season,
      };
    }
    if (selector === 'team') {
      return {
        title: 'Team',
        options: [
          { value: 'all', label: 'All Teams', detail: 'League-wide directory' },
          ...teamOptions.map((option) => ({
            value: option.key,
            label: option.abbreviation,
            detail: option.name,
          })),
        ],
        selectedValue: teamKey ?? 'all',
      };
    }
    if (selector === 'games') {
      return {
        title: 'Minimum Games',
        options: [
          { value: 'any', label: 'Any', detail: 'Include every player' },
          ...minimumGamesOptions.map((games) => ({ value: String(games), label: `${games}+ games` })),
        ],
        selectedValue: minimumGames === null ? 'any' : String(minimumGames),
      };
    }
    return {
      title: 'Sort Players',
      options: PLAYERS_SORT_OPTIONS.map((metric) => ({
        value: metric,
        label: metric,
        detail: metric === 'PTS' ? 'Points per game'
          : metric === 'REB' ? 'Rebounds per game'
            : metric === 'AST' ? 'Assists per game'
              : metric === 'TS%' ? 'True shooting percentage'
                : metric === 'MIN' ? 'Minutes per game'
                  : 'Net rating',
      })),
      selectedValue: sortMetric,
    };
  }, [minimumGames, minimumGamesOptions, season, selector, sortMetric, teamKey, teamOptions]);

  const handleSelectorValue = useCallback((value: string) => {
    if (selector === 'season') {
      handleSeasonSelect(value);
      return;
    }
    if (selector === 'team') {
      setTeamKey(value === 'all' ? null : value);
      return;
    }
    if (selector === 'games') {
      setMinimumGames(value === 'any' ? null : Number(value));
      return;
    }
    if (selector === 'sort' && PLAYERS_SORT_OPTIONS.some((metric) => metric === value)) {
      setSortMetric(value as PlayersDirectorySortMetric);
    }
  }, [handleSeasonSelect, selector]);

  const renderPlayer = useCallback(({ item }: { item: PlayerDirectoryEntry }) => (
    <PlayerDirectoryRow player={item} onPress={handlePlayerPress} />
  ), [handlePlayerPress]);

  const keyExtractor = useCallback((player: PlayerDirectoryEntry) => String(player.playerId), []);

  const listHeader = (
    <View style={styles.header}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>Players</Text>
        <TouchableOpacity
          style={styles.seasonButton}
          onPress={() => setSelector('season')}
          activeOpacity={0.72}
          accessibilityRole="button"
          accessibilityLabel={`Season ${season}. Select season.`}
          testID="players-season-selector"
        >
          <Text style={styles.seasonButtonText}>{season}</Text>
          <ChevronDown size={17} color={Colors.primary} />
        </TouchableOpacity>
      </View>
      <Text style={styles.eyebrow}>LEAGUE DIRECTORY</Text>

      <View style={styles.phaseControl} accessibilityRole="tablist">
        <TouchableOpacity
          style={[styles.phaseButton, phase === 'regular' && styles.phaseButtonActive]}
          onPress={() => handlePhaseSelect('regular')}
          activeOpacity={0.75}
          accessibilityRole="tab"
          accessibilityState={{ selected: phase === 'regular' }}
          testID="players-phase-regular"
        >
          <Text style={[styles.phaseText, phase === 'regular' && styles.phaseTextActive]}>Regular</Text>
        </TouchableOpacity>
        {postseasonControl.isVisible ? (
          <TouchableOpacity
            style={[
              styles.phaseButton,
              phase === 'postseason' && styles.phaseButtonActive,
              postseasonControl.isDisabled && styles.phaseButtonDisabled,
            ]}
            onPress={() => handlePhaseSelect('postseason')}
            activeOpacity={0.75}
            disabled={postseasonControl.isDisabled}
            accessibilityRole="tab"
            accessibilityHint={postseasonControl.accessibilityHint}
            accessibilityState={{ selected: phase === 'postseason', disabled: postseasonControl.isDisabled }}
            testID="players-phase-postseason"
          >
            <Text style={[
              styles.phaseText,
              phase === 'postseason' && styles.phaseTextActive,
              postseasonControl.isDisabled && styles.phaseTextDisabled,
            ]}>Postseason</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.searchContainer}>
        <Search size={17} color={Colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search players..."
          placeholderTextColor={Colors.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          clearButtonMode="never"
          accessibilityLabel="Search players"
          testID="players-search-input"
        />
        {searchQuery.length > 0 ? (
          <TouchableOpacity
            style={styles.clearSearchButton}
            onPress={() => setSearchQuery('')}
            accessibilityRole="button"
            accessibilityLabel="Clear player search"
            testID="players-search-clear"
          >
            <X size={16} color={Colors.textSecondary} />
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.filterRow}>
        <FilterButton
          label={selectedTeam?.abbreviation ?? 'All Teams'}
          onPress={() => setSelector('team')}
          disabled={!snapshot?.dataAvailable}
          accessibilityLabel={`Team filter, ${selectedTeam?.name ?? 'All Teams'}`}
          testID="players-team-filter"
        />
        <FilterButton
          label={minimumGames === null ? 'Any GP' : `GP ${minimumGames}+`}
          onPress={() => setSelector('games')}
          disabled={!snapshot?.dataAvailable}
          accessibilityLabel={`Minimum games, ${minimumGames === null ? 'Any' : `${minimumGames} or more`}`}
          testID="players-games-filter"
        />
        <FilterButton
          label={`Sort: ${sortMetric}`}
          onPress={() => setSelector('sort')}
          accessibilityLabel={`Sort players by ${sortMetric}`}
          testID="players-sort-selector"
        />
      </View>

      {snapshot?.dataAvailable ? (
        <View
          style={styles.resultStatusRow}
          testID={`players-directory-status-${cacheSource ?? 'none'}-${freshness}`}
        >
          <Text style={styles.resultCount} testID="players-result-count">
            {displayedPlayers.length} {displayedPlayers.length === 1 ? 'player' : 'players'}
          </Text>
          {isRefreshing ? (
            <View style={styles.refreshingStatus}>
              <ActivityIndicator size="small" color={Colors.primary} />
              <Text style={styles.refreshingText}>Refreshing…</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {refreshError && snapshot ? (
        <View style={styles.warningBanner} testID="players-refresh-error">
          <AlertTriangle size={16} color={Colors.warning} />
          <Text style={styles.warningText}>Showing cached data · Refresh failed</Text>
          <TouchableOpacity onPress={() => void handleRetry()} disabled={isRetrying} testID="players-refresh-retry">
            <Text style={styles.warningAction}>{isRetrying ? 'Retrying…' : 'Retry'}</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {hasPartialData && snapshot ? (
        <View style={styles.partialBanner} testID="players-partial-data">
          <Check size={15} color={Colors.secondary} />
          <Text style={styles.partialText}>Partial data · Available stats are shown</Text>
        </View>
      ) : null}
    </View>
  );

  const listEmpty = isLoading && !snapshot ? (
    <View style={styles.centerState} testID="players-initial-loading">
      <ActivityIndicator size="large" color={Colors.primary} />
      <Text style={styles.stateTitle}>Loading players</Text>
      <Text style={styles.stateBody}>Restoring the {season} directory…</Text>
    </View>
  ) : error && !snapshot ? (
    <View style={styles.centerState} testID="players-initial-error">
      <AlertTriangle size={25} color={Colors.warning} />
      <Text style={styles.stateTitle}>Unable to load players</Text>
      <Text style={styles.stateBody}>Check your connection and try again.</Text>
      <TouchableOpacity style={styles.primaryAction} onPress={() => void handleRetry()} disabled={isRetrying} testID="players-initial-retry">
        {isRetrying ? <ActivityIndicator size="small" color={Colors.white} /> : <RotateCcw size={16} color={Colors.white} />}
        <Text style={styles.primaryActionText}>{isRetrying ? 'Retrying…' : 'Retry'}</Text>
      </TouchableOpacity>
    </View>
  ) : hasValidEmptyPhase ? (
    <View style={styles.centerState} testID="players-valid-empty">
      <Text style={styles.stateTitle}>No {phase === 'postseason' ? 'postseason' : 'regular season'} player data yet</Text>
      <Text style={styles.stateBody}>Player data is not available for this season and phase yet.</Text>
    </View>
  ) : snapshot?.dataAvailable && displayedPlayers.length === 0 ? (
    <View style={styles.centerState} testID="players-filtered-empty">
      <Search size={24} color={Colors.textMuted} />
      <Text style={styles.stateTitle}>No players match these filters</Text>
      <Text style={styles.stateBody}>Try another search, team, or minimum-games setting.</Text>
      {hasLocalFilters ? (
        <TouchableOpacity style={styles.secondaryAction} onPress={clearLocalFilters} testID="players-clear-filters">
          <RotateCcw size={15} color={Colors.primary} />
          <Text style={styles.secondaryActionText}>Clear filters</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  ) : null;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]} testID="players-directory-screen">
      <FlatList
        data={displayedPlayers}
        renderItem={renderPlayer}
        keyExtractor={keyExtractor}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={listEmpty}
        contentContainerStyle={[styles.listContent, { paddingBottom: Math.max(insets.bottom, Spacing.lg) + Spacing.xxxl }]}
        showsVerticalScrollIndicator={false}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        refreshControl={(
          <RefreshControl
            refreshing={Boolean(snapshot) && isRefreshing}
            onRefresh={() => void handleRefresh()}
            tintColor={Colors.primary}
            colors={[Colors.primary]}
          />
        )}
        initialNumToRender={8}
        maxToRenderPerBatch={10}
        updateCellsBatchingPeriod={50}
      />

      <PlayersSelectionSheet
        visible={selector !== null}
        title={selectorConfiguration.title}
        options={selectorConfiguration.options}
        selectedValue={selectorConfiguration.selectedValue}
        onSelect={handleSelectorValue}
        onClose={() => setSelector(null)}
        testID={`players-${selector ?? 'closed'}-sheet`}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  listContent: { paddingHorizontal: Spacing.lg, flexGrow: 1 },
  header: { paddingTop: Spacing.lg, paddingBottom: Spacing.sm },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  title: {
    color: Colors.textPrimary,
    fontSize: FontSize.hero,
    fontWeight: FontWeight.heavy,
    letterSpacing: -0.8,
  },
  seasonButton: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primaryMuted,
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.24)',
  },
  seasonButtonText: { color: Colors.primary, fontSize: FontSize.md, fontWeight: FontWeight.bold },
  eyebrow: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    letterSpacing: 1.4,
    marginTop: 1,
    marginBottom: Spacing.lg,
  },
  phaseControl: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: 3,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  phaseButton: {
    flex: 1,
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.sm,
  },
  phaseButtonActive: { backgroundColor: Colors.primaryMuted },
  phaseButtonDisabled: { opacity: 0.4 },
  phaseText: { color: Colors.textMuted, fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  phaseTextActive: { color: Colors.primary, fontWeight: FontWeight.bold },
  phaseTextDisabled: { color: Colors.textMuted },
  searchContainer: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    marginBottom: Spacing.sm,
  },
  searchInput: { flex: 1, color: Colors.textPrimary, fontSize: FontSize.md, paddingVertical: Spacing.sm },
  clearSearchButton: { width: 36, height: 44, alignItems: 'center', justifyContent: 'center' },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.md },
  filterButton: {
    flexGrow: 1,
    flexBasis: 98,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: Spacing.sm,
    backgroundColor: Colors.surfaceLight,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  controlDisabled: { opacity: 0.45 },
  filterButtonText: { color: Colors.textSecondary, fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  resultStatusRow: {
    minHeight: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  resultCount: { color: Colors.textMuted, fontSize: FontSize.sm, fontWeight: FontWeight.medium },
  refreshingStatus: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  refreshingText: { color: Colors.textMuted, fontSize: FontSize.xs },
  warningBanner: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.warningMuted,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.24)',
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
  },
  warningText: { flex: 1, color: Colors.textSecondary, fontSize: FontSize.xs },
  warningAction: { color: Colors.warning, fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  partialBanner: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.secondaryMuted,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
  },
  partialText: { color: Colors.textSecondary, fontSize: FontSize.xs },
  centerState: { alignItems: 'center', paddingHorizontal: Spacing.xl, paddingVertical: 52, gap: Spacing.sm },
  stateTitle: { color: Colors.textPrimary, fontSize: FontSize.lg, fontWeight: FontWeight.bold, textAlign: 'center' },
  stateBody: { color: Colors.textMuted, fontSize: FontSize.sm, lineHeight: 19, textAlign: 'center' },
  primaryAction: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.sm,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
  },
  primaryActionText: { color: Colors.white, fontSize: FontSize.md, fontWeight: FontWeight.bold },
  secondaryAction: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.sm,
    backgroundColor: Colors.primaryMuted,
    borderRadius: BorderRadius.md,
  },
  secondaryActionText: { color: Colors.primary, fontSize: FontSize.md, fontWeight: FontWeight.bold },
});
