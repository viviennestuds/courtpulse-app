import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronRight } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { Spacing, BorderRadius, FontSize, FontWeight } from '@/constants/theme';
import SegmentControl from '@/components/SegmentControl';
import DataSourceBadge from '@/components/DataSourceBadge';
import { useTeams } from '@/hooks/useNbaData';
import { Team } from '@/types';
import { NBA_SEASON } from '@/services/nbaApi';

const CONF_SEGMENTS = ['All', 'East', 'West'];

export default function TeamsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [conf, setConf] = useState(0);
  const [sortBy, setSortBy] = useState<'record' | 'netRtg' | 'offRtg' | 'defRtg'>('record');

  const { teams: rawTeams, dataSource, isLoading, isRefetching, refetch } = useTeams();

  const teams = useMemo(() => {
    let filtered = rawTeams;
    if (conf === 1) filtered = rawTeams.filter(t => t.conference === 'East');
    if (conf === 2) filtered = rawTeams.filter(t => t.conference === 'West');

    return [...filtered].sort((a, b) => {
      if (sortBy === 'record') return (b.wins - b.losses) - (a.wins - a.losses);
      if (sortBy === 'netRtg') return b.netRating - a.netRating;
      if (sortBy === 'offRtg') return b.offRating - a.offRating;
      return a.defRating - b.defRating;
    });
  }, [conf, sortBy, rawTeams]);

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
          <View>
            <Text style={styles.title}>Teams</Text>
            <Text style={styles.subtitle}>{NBA_SEASON} Season Standings</Text>
          </View>
          <DataSourceBadge source={dataSource} />
        </View>

        <View style={styles.segmentRow}>
          <SegmentControl segments={CONF_SEGMENTS} selected={conf} onSelect={setConf} />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.sortRow} contentContainerStyle={styles.sortRowContent}>
          {(['record', 'netRtg', 'offRtg', 'defRtg'] as const).map(s => (
            <TouchableOpacity
              key={s}
              style={[styles.sortChip, sortBy === s && styles.sortChipActive]}
              onPress={() => setSortBy(s)}
            >
              <Text style={[styles.sortChipText, sortBy === s && styles.sortChipTextActive]}>
                {s === 'record' ? 'Record' : s === 'netRtg' ? 'Net Rtg' : s === 'offRtg' ? 'Off Rtg' : 'Def Rtg'}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {isLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>Loading teams...</Text>
          </View>
        )}

        {!isLoading && teams.map((team, index) => (
          <TeamRow key={team.id} team={team} rank={index + 1} onPress={() => handleTeamPress(team.id)} />
        ))}
      </ScrollView>
    </View>
  );
}

const TeamRow = React.memo(function TeamRow({ team, rank, onPress }: { team: Team; rank: number; onPress: () => void }) {
  const hasRealStats = team.offRating > 0;

  return (
    <TouchableOpacity style={styles.teamRow} onPress={onPress} activeOpacity={0.7}>
      <Text style={styles.rank}>{rank}</Text>
      <View style={[styles.teamColorDot, { backgroundColor: team.primaryColor }]} />
      <View style={styles.teamInfo}>
        <Text style={styles.teamName}>{team.city} {team.name}</Text>
        <Text style={styles.teamRecord}>{team.wins}-{team.losses}</Text>
      </View>
      {hasRealStats ? (
        <View style={styles.teamStats}>
          <View style={styles.miniStat}>
            <Text style={styles.miniStatValue}>{team.netRating > 0 ? '+' : ''}{team.netRating.toFixed(1)}</Text>
            <Text style={styles.miniStatLabel}>NET</Text>
          </View>
          <View style={styles.miniStat}>
            <Text style={styles.miniStatValue}>{team.offRating.toFixed(1)}</Text>
            <Text style={styles.miniStatLabel}>OFF</Text>
          </View>
          <View style={styles.miniStat}>
            <Text style={styles.miniStatValue}>{team.defRating.toFixed(1)}</Text>
            <Text style={styles.miniStatLabel}>DEF</Text>
          </View>
        </View>
      ) : (
        <Text style={styles.noStatsText}>Stats loading...</Text>
      )}
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
    marginBottom: Spacing.lg,
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
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.xxxl,
    gap: Spacing.md,
  },
  loadingText: {
    color: Colors.textMuted,
    fontSize: FontSize.md,
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
  },
  teamName: {
    color: Colors.textPrimary,
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
  },
  teamRecord: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
  },
  teamStats: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  miniStat: {
    alignItems: 'center',
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
  },
  noStatsText: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
  },
});
