import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, TrendingUp, TrendingDown } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { Spacing, BorderRadius, FontSize, FontWeight } from '@/constants/theme';
import SegmentControl from '@/components/SegmentControl';
import PlayerCard from '@/components/PlayerCard';
import DataSourceBadge from '@/components/DataSourceBadge';
import { useTeams, usePlayers } from '@/hooks/useNbaData';
import { THRESHOLD_SPLITS } from '@/mocks/analytics';
import { safeBack } from '@/utils/navigation';

const TEAM_TABS = ['Overview', 'Roster', 'Games', 'Splits'];

export default function TeamDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState(0);

  const { teams, dataSource: teamSource } = useTeams();
  const { players: allPlayers, dataSource: playerSource } = usePlayers();

  const team = useMemo(() => teams.find(t => t.id === id), [teams, id]);
  const players = useMemo(() => allPlayers.filter(p => p.teamId === id), [allPlayers, id]);

  const handleBack = useCallback(() => {
    safeBack(router, '/(tabs)/teams');
  }, [router]);

  if (!team) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <Text style={styles.errorText}>Team not found</Text>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
          <ChevronLeft size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <View style={styles.teamHeader}>
        <View style={[styles.teamColorAccent, { backgroundColor: team.primaryColor }]} />
        <View style={styles.teamHeaderInfo}>
          <Text style={styles.teamCity}>{team.city}</Text>
          <Text style={styles.teamName}>{team.name}</Text>
          <Text style={styles.teamRecord}>{team.wins}-{team.losses} · {team.conference} · {team.division}</Text>
        </View>
      </View>

      <View style={styles.quickStats}>
        <View style={styles.qStat}>
          <Text style={styles.qStatValue}>{team.offRating.toFixed(1)}</Text>
          <Text style={styles.qStatLabel}>OFF RTG</Text>
        </View>
        <View style={styles.qStat}>
          <Text style={styles.qStatValue}>{team.defRating.toFixed(1)}</Text>
          <Text style={styles.qStatLabel}>DEF RTG</Text>
        </View>
        <View style={styles.qStat}>
          <Text style={[styles.qStatValue, { color: team.netRating >= 0 ? Colors.positive : Colors.negative }]}>
            {team.netRating > 0 ? '+' : ''}{team.netRating.toFixed(1)}
          </Text>
          <Text style={styles.qStatLabel}>NET RTG</Text>
        </View>
        <View style={styles.qStat}>
          <Text style={styles.qStatValue}>{team.pace.toFixed(1)}</Text>
          <Text style={styles.qStatLabel}>PACE</Text>
        </View>
      </View>

      <View style={styles.tabRow}>
        <SegmentControl segments={TEAM_TABS} selected={activeTab} onSelect={setActiveTab} />
      </View>

      <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {activeTab === 0 && (
          <View>
            <Text style={styles.sectionLabel}>SEASON OVERVIEW</Text>
            <View style={styles.card}>
              <View style={styles.overviewRow}>
                <Text style={styles.overviewLabel}>Win Percentage</Text>
                <Text style={styles.overviewValue}>{((team.wins / (team.wins + team.losses)) * 100).toFixed(1)}%</Text>
              </View>
              <View style={styles.overviewRow}>
                <Text style={styles.overviewLabel}>Games Back</Text>
                <Text style={styles.overviewValue}>{team.conference === 'East' ? ((58 - team.wins + team.losses - 18) / 2).toFixed(1) : ((57 - team.wins + team.losses - 19) / 2).toFixed(1)}</Text>
              </View>
              <View style={styles.overviewRow}>
                <Text style={styles.overviewLabel}>Conference Rank</Text>
                <Text style={styles.overviewValue}>#{Math.max(1, Math.floor((58 - team.wins) / 2) + 1)}</Text>
              </View>
            </View>

            <Text style={styles.sectionLabel}>RATINGS SNAPSHOT</Text>
            <View style={styles.ratingsRow}>
              <View style={[styles.ratingCard, { borderLeftColor: Colors.positive }]}>
                <Text style={styles.ratingTitle}>Offense</Text>
                <Text style={styles.ratingValue}>{team.offRating.toFixed(1)}</Text>
                <View style={styles.ratingTrend}>
                  <TrendingUp size={12} color={Colors.positive} />
                  <Text style={[styles.ratingTrendText, { color: Colors.positive }]}>Top 5</Text>
                </View>
              </View>
              <View style={[styles.ratingCard, { borderLeftColor: Colors.secondary }]}>
                <Text style={styles.ratingTitle}>Defense</Text>
                <Text style={styles.ratingValue}>{team.defRating.toFixed(1)}</Text>
                <View style={styles.ratingTrend}>
                  <TrendingDown size={12} color={Colors.secondary} />
                  <Text style={[styles.ratingTrendText, { color: Colors.secondary }]}>Top 10</Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {activeTab === 1 && (
          <View>
            <Text style={styles.sectionLabel}>ROSTER</Text>
            {players.length > 0 ? (
              players.map(p => (
                <PlayerCard key={p.id} player={p} onPress={() => router.push(`/player/${p.id}`)} />
              ))
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No players found for this team</Text>
              </View>
            )}
          </View>
        )}

        {activeTab === 2 && (
          <View>
            <DataSourceBadge source="demo" />
            <Text style={styles.sectionLabel}>RECENT GAMES</Text>
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>Game log requires the Python backend</Text>
              <Text style={[styles.emptyText, { fontSize: 12 }]}>Connect EXPO_PUBLIC_NBA_API_URL to enable</Text>
            </View>
          </View>
        )}

        {activeTab === 3 && (
          <View>
            <DataSourceBadge source="demo" />
            <Text style={styles.sectionLabel}>THRESHOLD BAND SPLITS</Text>
            <Text style={styles.sectionDescription}>
              Team performance when key stats cross defined thresholds. Showing sample data.
            </Text>
            {THRESHOLD_SPLITS.map(split => (
              <View key={split.id} style={styles.splitCard}>
                <View style={styles.splitHeader}>
                  <Text style={styles.splitMetric}>{split.metric}</Text>
                  <Text style={styles.splitCondition}>
                    {split.operator === 'above' ? '≥' : '≤'} {split.threshold}
                  </Text>
                </View>
                <View style={styles.splitRecord}>
                  <Text style={[styles.splitRecordText, {
                    color: (split.wins / split.gamesPlayed) >= 0.6 ? Colors.positive : Colors.warning,
                  }]}>
                    {split.wins}-{split.losses}
                  </Text>
                  <Text style={styles.splitWinPct}>
                    ({((split.wins / split.gamesPlayed) * 100).toFixed(0)}%)
                  </Text>
                </View>
                <View style={styles.splitStats}>
                  <Text style={styles.splitStatText}>Net: {split.netRating > 0 ? '+' : ''}{split.netRating.toFixed(1)}</Text>
                  <Text style={styles.splitStatText}>{split.avgPoints.toFixed(1)} PPG</Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  headerBar: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  teamHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.lg,
    gap: Spacing.lg,
  },
  teamColorAccent: {
    width: 4,
    height: 60,
    borderRadius: 2,
  },
  teamHeaderInfo: {},
  teamCity: {
    color: Colors.textMuted,
    fontSize: FontSize.md,
    fontWeight: FontWeight.medium,
  },
  teamName: {
    color: Colors.textPrimary,
    fontSize: FontSize.xxxl,
    fontWeight: FontWeight.heavy,
    letterSpacing: -0.5,
  },
  teamRecord: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    marginTop: 2,
  },
  quickStats: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  qStat: {
    flex: 1,
    backgroundColor: Colors.cardBg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  qStatValue: {
    color: Colors.textPrimary,
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
  },
  qStatLabel: {
    color: Colors.textMuted,
    fontSize: 9,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.5,
    marginTop: 2,
  },
  tabRow: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxxl,
  },
  sectionLabel: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    letterSpacing: 1.5,
    marginBottom: Spacing.md,
    marginTop: Spacing.lg,
  },
  sectionDescription: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    lineHeight: 20,
    marginBottom: Spacing.md,
  },
  card: {
    backgroundColor: Colors.cardBg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  overviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  overviewLabel: {
    color: Colors.textSecondary,
    fontSize: FontSize.md,
  },
  overviewValue: {
    color: Colors.textPrimary,
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
  },
  ratingsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  ratingCard: {
    flex: 1,
    backgroundColor: Colors.cardBg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderLeftWidth: 3,
    padding: Spacing.lg,
  },
  ratingTitle: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
  },
  ratingValue: {
    color: Colors.textPrimary,
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.heavy,
    marginBottom: Spacing.xs,
  },
  ratingTrend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingTrendText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
  },
  emptyState: {
    padding: Spacing.xxxl,
    alignItems: 'center',
  },
  emptyText: {
    color: Colors.textMuted,
    fontSize: FontSize.md,
  },
  errorText: {
    color: Colors.textMuted,
    fontSize: FontSize.lg,
    textAlign: 'center',
    marginTop: 100,
  },
  gameLogRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    gap: Spacing.md,
  },
  gameLogDate: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    width: 42,
  },
  gameLogOpp: {
    color: Colors.textPrimary,
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    flex: 1,
  },
  resultBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  resultText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
  },
  gameLogScore: {
    color: Colors.textSecondary,
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    minWidth: 56,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  splitCard: {
    backgroundColor: Colors.cardBg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  splitHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  splitMetric: {
    color: Colors.textSecondary,
    fontSize: FontSize.md,
    fontWeight: FontWeight.medium,
  },
  splitCondition: {
    color: Colors.textPrimary,
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
  },
  splitRecord: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  splitRecordText: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.heavy,
  },
  splitWinPct: {
    color: Colors.textMuted,
    fontSize: FontSize.md,
  },
  splitStats: {
    flexDirection: 'row',
    gap: Spacing.lg,
  },
  splitStatText: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
  },
});
