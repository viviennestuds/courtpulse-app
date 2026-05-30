import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronRight, AlertCircle } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { Spacing, BorderRadius, FontSize, FontWeight } from '@/constants/theme';
import SegmentControl from '@/components/SegmentControl';
import DataSourceBadge from '@/components/DataSourceBadge';
import { useTeams } from '@/hooks/useNbaData';
import { Team } from '@/types';
import { TEAM_STANDINGS_SEASON } from '@/services/nbaStats';

const CONF_SEGMENTS = ['All', 'East', 'West'];
type TeamSortKey = 'record' | 'netRtg' | 'offRtg' | 'defRtg';

function safeNumber(value: number | null | undefined): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function winPct(team: Team): number | undefined {
  const overviewPct = safeNumber(team.overview?.standings.winPct);
  if (overviewPct !== undefined) return overviewPct;
  const games = team.wins + team.losses;
  if (!team.recordAvailable || games <= 0) return undefined;
  return team.wins / games;
}

function sortMetric(team: Team, key: TeamSortKey): number | undefined {
  if (key === 'record') return winPct(team);
  if (!team.ratingsAvailable) return undefined;
  if (key === 'netRtg') return safeNumber(team.overview?.ratings.netRating) ?? safeNumber(team.netRating);
  if (key === 'offRtg') return safeNumber(team.overview?.ratings.offRating) ?? safeNumber(team.offRating);
  return safeNumber(team.overview?.ratings.defRating) ?? safeNumber(team.defRating);
}

function isRatingAvailable(team: Team, key: TeamSortKey): boolean {
  return sortMetric(team, key) !== undefined;
}

function compareNullable(aAvailable: boolean, bAvailable: boolean): number {
  if (aAvailable && !bAvailable) return -1;
  if (!aAvailable && bAvailable) return 1;
  return 0;
}

function sortTeams(a: Team, b: Team, sortBy: TeamSortKey): number {
  const availability = compareNullable(isRatingAvailable(a, sortBy), isRatingAvailable(b, sortBy));
  if (availability !== 0) return availability;

  if (sortBy === 'record') {
    const aPct = winPct(a) ?? -1;
    const bPct = winPct(b) ?? -1;
    if (bPct !== aPct) return bPct - aPct;
    if (b.wins !== a.wins) return b.wins - a.wins;
    const aConfRank = safeNumber(a.overview?.standings.conferenceRank) ?? 999;
    const bConfRank = safeNumber(b.overview?.standings.conferenceRank) ?? 999;
    if (aConfRank !== bConfRank) return aConfRank - bConfRank;
    return (sortMetric(b, 'netRtg') ?? -999) - (sortMetric(a, 'netRtg') ?? -999);
  }
  const aValue = sortMetric(a, sortBy) ?? (sortBy === 'defRtg' ? 999 : -999);
  const bValue = sortMetric(b, sortBy) ?? (sortBy === 'defRtg' ? 999 : -999);
  if (sortBy === 'defRtg') return aValue - bValue;
  return bValue - aValue;
}

function formatRecord(team: Team): string {
  const wins = safeNumber(team.overview?.standings.wins) ?? (team.recordAvailable ? team.wins : undefined);
  const losses = safeNumber(team.overview?.standings.losses) ?? (team.recordAvailable ? team.losses : undefined);
  return wins !== undefined && losses !== undefined ? `${wins}-${losses}` : 'Record unavailable';
}

function formatWinPct(team: Team): string {
  const pct = winPct(team);
  return pct === undefined ? '—' : pct.toFixed(3).replace(/^0/, '');
}

function formatRatingValue(value: number | undefined, signed: boolean = false): string {
  if (value === undefined) return '—';
  return `${signed && value > 0 ? '+' : ''}${value.toFixed(1)}`;
}

function getSortLabel(sortBy: TeamSortKey): string {
  if (sortBy === 'record') return 'PCT';
  if (sortBy === 'netRtg') return 'NET';
  if (sortBy === 'offRtg') return 'OFF';
  return 'DEF';
}

function getSortValue(team: Team, sortBy: TeamSortKey): string {
  if (sortBy === 'record') return formatWinPct(team);
  if (sortBy === 'netRtg') return formatRatingValue(sortMetric(team, sortBy), true);
  if (sortBy === 'offRtg') return formatRatingValue(sortMetric(team, sortBy));
  return formatRatingValue(sortMetric(team, sortBy));
}

export default function TeamsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [conf, setConf] = useState<number>(0);
  const [sortBy, setSortBy] = useState<TeamSortKey>('record');

  const { teams: rawTeams, teamsOverview, dataSource, dataState, isLoading, isRefetching, refetch, error } = useTeams();

  const teams = useMemo<Team[]>(() => {
    let filtered = rawTeams;
    if (conf === 1) filtered = rawTeams.filter(t => t.conference === 'East');
    if (conf === 2) filtered = rawTeams.filter(t => t.conference === 'West');

    return [...filtered].sort((a, b) => sortTeams(a, b, sortBy));
  }, [conf, sortBy, rawTeams]);

  const hasRatings = useMemo<boolean>(() => rawTeams.some(team => team.ratingsAvailable), [rawTeams]);
  const hasRecords = useMemo<boolean>(() => rawTeams.some(team => team.recordAvailable), [rawTeams]);
  const showFallbackBadge = dataSource === 'fallback' || dataState === 'fallback';
  const showLiveBadge = dataSource !== 'fallback' && (dataState === 'success' || dataState === 'partial');
  const showErrorState = !isLoading && dataState === 'error' && rawTeams.length === 0;

  const helperText = useMemo<string>(() => {
    if (showErrorState) return 'Team standings could not be loaded.';
    if (showFallbackBadge) return 'Static team list shown because source data is unavailable.';
    if (dataState === 'partial') return 'Source-backed team data loaded with partial availability.';
    if (hasRecords && hasRatings) return 'Standings, ratings, scoring, and win conditions are source-backed.';
    if (hasRecords && !hasRatings) return 'Standings are source-backed. Ratings are unavailable.';
    return 'Team metadata loaded. Standings are unavailable.';
  }, [showErrorState, showFallbackBadge, dataState, hasRecords, hasRatings]);

  const handleRefresh = useCallback(() => {
    void refetch();
  }, [refetch]);

  const handleTeamPress = useCallback((teamId: string) => {
    router.push(`/team/${teamId}`);
  }, [router]);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}> 
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={handleRefresh} tintColor={Colors.primary} />}
      >
        <View style={styles.headerRow}>
          <View style={styles.headerCopy}>
            <Text style={styles.title}>Teams</Text>
            <Text style={styles.subtitle}>{teamsOverview?.season ?? TEAM_STANDINGS_SEASON} Regular Season Standings</Text>
          </View>
          {(showFallbackBadge || showLiveBadge) && <DataSourceBadge source={dataSource} />}
        </View>

        <View style={styles.statusCard}>
          <View style={[styles.statusDot, { backgroundColor: showFallbackBadge || dataState === 'partial' ? Colors.warning : showErrorState ? Colors.negative : Colors.primary }]} />
          <Text style={styles.statusText}>{helperText}</Text>
        </View>

        <View style={styles.segmentRow}>
          <SegmentControl segments={CONF_SEGMENTS} selected={conf} onSelect={setConf} />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.sortRow} contentContainerStyle={styles.sortRowContent}>
          {(['record', 'netRtg', 'offRtg', 'defRtg'] as const).map(s => {
            const disabled = (s === 'record' && !hasRecords) || (s !== 'record' && !hasRatings);
            return (
              <TouchableOpacity
                key={s}
                style={[styles.sortChip, sortBy === s && styles.sortChipActive, disabled && styles.sortChipDisabled]}
                onPress={() => !disabled && setSortBy(s)}
                disabled={disabled}
              >
                <Text style={[styles.sortChipText, sortBy === s && styles.sortChipTextActive, disabled && styles.sortChipTextDisabled]}>
                  {s === 'record' ? 'Record' : s === 'netRtg' ? 'Net Rtg' : s === 'offRtg' ? 'Off Rtg' : 'Def Rtg'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {isLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>Loading teams...</Text>
          </View>
        )}

        {showErrorState && (
          <View style={styles.emptyState}>
            <AlertCircle size={22} color={Colors.warning} />
            <Text style={styles.emptyTitle}>Teams unavailable</Text>
            <Text style={styles.emptyText}>{error instanceof Error ? error.message : 'Please pull to refresh and try again.'}</Text>
          </View>
        )}

        {!isLoading && !showErrorState && teams.map((team, index) => (
          <TeamRow key={team.id} team={team} rank={index + 1} sortBy={sortBy} onPress={() => handleTeamPress(team.id)} />
        ))}
      </ScrollView>
    </View>
  );
}

const TeamRow = React.memo(function TeamRow({ team, rank, sortBy, onPress }: { team: Team; rank: number; sortBy: TeamSortKey; onPress: () => void }) {
  const sortValue = getSortValue(team, sortBy);
  const sortLabel = getSortLabel(sortBy);
  const netRatingValue = sortMetric(team, 'netRtg');

  return (
    <TouchableOpacity style={styles.teamRow} onPress={onPress} activeOpacity={0.7}>
      <Text style={styles.rank}>{rank}</Text>
      <View style={[styles.teamColorDot, { backgroundColor: team.primaryColor }]} />
      <View style={styles.teamInfo}>
        <View style={styles.teamNameLine}>
          <Text style={styles.teamName}>{team.city} {team.name}</Text>
          <Text style={styles.teamAbbr}>{team.abbreviation}</Text>
        </View>
        <Text style={styles.teamRecord}>{formatRecord(team)}</Text>
      </View>
      <View style={styles.teamStats}>
        <View style={styles.focusStat}>
          <Text style={[styles.focusStatValue, sortValue === '—' && styles.unavailableValue]}>{sortValue}</Text>
          <Text style={styles.miniStatLabel}>{sortLabel}</Text>
        </View>
        <View style={styles.miniStat}>
          <Text style={[styles.miniStatValue, netRatingValue === undefined && styles.unavailableValue]}>{formatRatingValue(netRatingValue, true)}</Text>
          <Text style={styles.miniStatLabel}>NET</Text>
        </View>
      </View>
      <ChevronRight size={16} color={Colors.textMuted} />
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxxl,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingTop: Spacing.lg,
    marginBottom: Spacing.md,
    gap: Spacing.md,
  },
  headerCopy: {
    flex: 1,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: FontSize.hero,
    fontWeight: FontWeight.heavy,
    letterSpacing: -0.5,
  },
  subtitle: {
    color: Colors.textMuted,
    fontSize: FontSize.md,
    marginTop: 2,
  },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statusText: {
    flex: 1,
    color: Colors.textSecondary,
    fontSize: FontSize.xs,
    lineHeight: 16,
  },
  segmentRow: {
    marginBottom: Spacing.md,
  },
  sortRow: {
    marginBottom: Spacing.lg,
  },
  sortRowContent: {
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  sortChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  sortChipActive: {
    backgroundColor: Colors.primaryMuted,
    borderColor: Colors.primary,
  },
  sortChipText: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
  sortChipTextActive: {
    color: Colors.primary,
    fontWeight: FontWeight.semibold,
  },
  sortChipDisabled: {
    opacity: 0.45,
  },
  sortChipTextDisabled: {
    color: Colors.textMuted,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.xxxl,
    gap: Spacing.md,
  },
  loadingText: {
    color: Colors.textMuted,
    fontSize: FontSize.md,
  },
  emptyState: {
    alignItems: 'center',
    backgroundColor: Colors.cardBg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    gap: Spacing.sm,
  },
  emptyTitle: {
    color: Colors.textPrimary,
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
  },
  emptyText: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    textAlign: 'center',
  },
  teamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  rank: {
    color: Colors.textMuted,
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    width: 22,
    textAlign: 'center',
  },
  teamColorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  teamInfo: {
    flex: 1,
    minWidth: 0,
  },
  teamNameLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  teamName: {
    color: Colors.textPrimary,
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    flexShrink: 1,
  },
  teamAbbr: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.8,
  },
  teamRecord: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    marginTop: 2,
  },
  teamStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  focusStat: {
    alignItems: 'center',
    minWidth: 44,
  },
  focusStatValue: {
    color: Colors.textPrimary,
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    fontVariant: ['tabular-nums'],
  },
  miniStat: {
    alignItems: 'center',
    minWidth: 34,
  },
  miniStatValue: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    fontVariant: ['tabular-nums'],
  },
  miniStatLabel: {
    color: Colors.textMuted,
    fontSize: 9,
    fontWeight: FontWeight.medium,
    letterSpacing: 0.6,
  },
  unavailableValue: {
    color: Colors.textMuted,
  },
});
