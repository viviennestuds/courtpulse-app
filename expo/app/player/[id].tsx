import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { Spacing, BorderRadius, FontSize, FontWeight } from '@/constants/theme';
import SegmentControl from '@/components/SegmentControl';
import ShotChart from '@/components/ShotChart';
import MetricCard from '@/components/MetricCard';
import DataSourceBadge from '@/components/DataSourceBadge';
import { usePlayers, useTeams } from '@/hooks/useNbaData';
import { SHOT_CHART_DATA } from '@/mocks/shots';
import { CUSTOM_METRICS, THRESHOLD_SPLITS } from '@/mocks/analytics';
import type { CanonicalShotEvent } from '@/analytics/shots';
import { safeBack } from '@/utils/navigation';

const PLAYER_TABS = ['Stats', 'Shot Chart', 'Splits', 'Lab'];

export default function PlayerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const [activeTab, setActiveTab] = useState(0);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const { players } = usePlayers();
  const { teams } = useTeams();

  const player = useMemo(() => players.find(p => p.id === id), [players, id]);
  const team = useMemo(() => player ? teams.find(t => t.id === player.teamId) : undefined, [player, teams]);

  const playerShots = useMemo<CanonicalShotEvent[]>(() => {
    return SHOT_CHART_DATA.filter(s => s.playerId === '101').map((shot): CanonicalShotEvent => ({
      id: shot.id,
      gameId: 'demo',
      teamId: shot.teamId,
      playerId: shot.playerId,
      playerName: shot.playerName,
      period: shot.period,
      periodTime: shot.clock,
      result: shot.made ? 'make' : 'miss',
      shotZone: shot.shotType === '3PT' ? '3pt' : shot.shotType.toLowerCase().includes('mid') ? 'mid' : 'rim',
      points: shot.points === 3 ? 3 : 2,
      x: shot.x,
      y: shot.y,
      rawDescription: shot.shotType,
    }));
  }, []);

  const playerMetrics = useMemo(() => {
    return CUSTOM_METRICS.filter(m => m.playerName);
  }, []);

  const handleBack = useCallback(() => {
    safeBack(router, '/(tabs)/players');
  }, [router]);

  if (!player) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <Text style={styles.errorText}>Player not found</Text>
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

      <View style={styles.playerHeader}>
        <View style={styles.avatarLarge}>
          <Text style={styles.avatarLargeText}>{player.number}</Text>
        </View>
        <View style={styles.playerHeaderInfo}>
          <Text style={styles.playerName}>{player.name}</Text>
          <View style={styles.playerMeta}>
            {team && <View style={[styles.teamDot, { backgroundColor: team.primaryColor }]} />}
            <Text style={styles.playerMetaText}>{player.teamAbbr} · {player.position} · #{player.number}</Text>
          </View>
          <Text style={styles.playerBio}>{player.height} · {player.weight} lbs · {player.age} yrs</Text>
        </View>
      </View>

      <View style={styles.heroStats}>
        <View style={styles.heroStat}>
          <Text style={styles.heroStatValue}>{player.ppg}</Text>
          <Text style={styles.heroStatLabel}>PTS</Text>
        </View>
        <View style={styles.heroStat}>
          <Text style={styles.heroStatValue}>{player.rpg}</Text>
          <Text style={styles.heroStatLabel}>REB</Text>
        </View>
        <View style={styles.heroStat}>
          <Text style={styles.heroStatValue}>{player.apg}</Text>
          <Text style={styles.heroStatLabel}>AST</Text>
        </View>
        <View style={styles.heroStat}>
          <Text style={styles.heroStatValue}>{player.spg}</Text>
          <Text style={styles.heroStatLabel}>STL</Text>
        </View>
        <View style={styles.heroStat}>
          <Text style={styles.heroStatValue}>{player.bpg}</Text>
          <Text style={styles.heroStatLabel}>BLK</Text>
        </View>
      </View>

      <View style={styles.tabRow}>
        <SegmentControl segments={PLAYER_TABS} selected={activeTab} onSelect={setActiveTab} />
      </View>

      <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {activeTab === 0 && (
          <View>
            <View style={styles.toggleRow}>
              <TouchableOpacity
                style={[styles.toggleBtn, !showAdvanced && styles.toggleBtnActive]}
                onPress={() => setShowAdvanced(false)}
              >
                <Text style={[styles.toggleText, !showAdvanced && styles.toggleTextActive]}>Basic</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleBtn, showAdvanced && styles.toggleBtnActive]}
                onPress={() => setShowAdvanced(true)}
              >
                <Text style={[styles.toggleText, showAdvanced && styles.toggleTextActive]}>Advanced</Text>
              </TouchableOpacity>
            </View>

            {!showAdvanced ? (
              <View style={styles.statsGrid}>
                <StatCell label="PPG" value={player.ppg.toFixed(1)} />
                <StatCell label="RPG" value={player.rpg.toFixed(1)} />
                <StatCell label="APG" value={player.apg.toFixed(1)} />
                <StatCell label="SPG" value={player.spg.toFixed(1)} />
                <StatCell label="BPG" value={player.bpg.toFixed(1)} />
                <StatCell label="MPG" value={player.mpg.toFixed(1)} />
                <StatCell label="FG%" value={`${player.fgPct}%`} />
                <StatCell label="3P%" value={`${player.threePct}%`} />
                <StatCell label="FT%" value={`${player.ftPct}%`} />
              </View>
            ) : (
              <View style={styles.statsGrid}>
                <StatCell label="PER" value={player.per.toFixed(1)} />
                <StatCell label="TS%" value={`${player.tsPct}%`} />
                <StatCell label="USG%" value={`${player.usgRate}%`} />
                <StatCell label="MPG" value={player.mpg.toFixed(1)} />
                <StatCell label="FG%" value={`${player.fgPct}%`} />
                <StatCell label="3P%" value={`${player.threePct}%`} />
              </View>
            )}
          </View>
        )}

        {activeTab === 1 && (
          <View>
            <DataSourceBadge source="demo" />
            <Text style={styles.sectionLabel}>SHOT CHART</Text>
            <Text style={{ color: Colors.textMuted, fontSize: 12, marginBottom: 8 }}>Sample shot data shown below</Text>
            <ShotChart shots={playerShots} width={screenWidth - 32} />
          </View>
        )}

        {activeTab === 2 && (
          <View>
            <DataSourceBadge source="demo" />
            <Text style={styles.sectionLabel}>THRESHOLD BAND SPLITS</Text>
            {THRESHOLD_SPLITS.slice(0, 4).map(split => (
              <View key={split.id} style={styles.splitCard}>
                <View style={styles.splitHeader}>
                  <Text style={styles.splitMetric}>{split.metric}</Text>
                  <Text style={styles.splitCondition}>
                    {split.operator === 'above' ? '≥' : '≤'} {split.threshold}
                  </Text>
                </View>
                <View style={styles.splitStatsRow}>
                  <View style={styles.splitStat}>
                    <Text style={[styles.splitStatValue, {
                      color: (split.wins / split.gamesPlayed) >= 0.6 ? Colors.positive : Colors.warning,
                    }]}>{split.wins}-{split.losses}</Text>
                    <Text style={styles.splitStatLabel}>Record</Text>
                  </View>
                  <View style={styles.splitStat}>
                    <Text style={styles.splitStatValue}>{split.avgPoints.toFixed(1)}</Text>
                    <Text style={styles.splitStatLabel}>PPG</Text>
                  </View>
                  <View style={styles.splitStat}>
                    <Text style={styles.splitStatValue}>{split.avgAssists.toFixed(1)}</Text>
                    <Text style={styles.splitStatLabel}>APG</Text>
                  </View>
                  <View style={styles.splitStat}>
                    <Text style={[styles.splitStatValue, { color: split.netRating >= 0 ? Colors.positive : Colors.negative }]}>
                      {split.netRating > 0 ? '+' : ''}{split.netRating.toFixed(1)}
                    </Text>
                    <Text style={styles.splitStatLabel}>Net</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        {activeTab === 3 && (
          <View>
            <DataSourceBadge source="demo" />
            <Text style={styles.sectionLabel}>DERIVED ANALYTICS</Text>
            {playerMetrics.map(metric => (
              <MetricCard key={metric.id} metric={metric} />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <View style={cellStyles.container}>
      <Text style={cellStyles.value}>{value}</Text>
      <Text style={cellStyles.label}>{label}</Text>
    </View>
  );
}

const cellStyles = StyleSheet.create({
  container: {
    backgroundColor: Colors.cardBg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
    minWidth: '30%' as unknown as number,
    flex: 1,
  },
  value: {
    color: Colors.textPrimary,
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
  },
  label: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    marginTop: 4,
    letterSpacing: 0.5,
  },
});

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
  playerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    gap: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  avatarLarge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLargeText: {
    color: Colors.textPrimary,
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
  },
  playerHeaderInfo: {
    flex: 1,
  },
  playerName: {
    color: Colors.textPrimary,
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.heavy,
    letterSpacing: -0.3,
  },
  playerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  teamDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  playerMetaText: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
  },
  playerBio: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    marginTop: 2,
  },
  heroStats: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  heroStat: {
    flex: 1,
    backgroundColor: Colors.cardBg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  heroStatValue: {
    color: Colors.textPrimary,
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
  },
  heroStatLabel: {
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
  toggleRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
    marginTop: Spacing.md,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  toggleBtnActive: {
    backgroundColor: Colors.primaryMuted,
    borderColor: Colors.primary,
  },
  toggleText: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
  toggleTextActive: {
    color: Colors.primary,
    fontWeight: FontWeight.bold,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
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
    marginBottom: Spacing.md,
  },
  splitMetric: {
    color: Colors.textSecondary,
    fontSize: FontSize.md,
  },
  splitCondition: {
    color: Colors.textPrimary,
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
  },
  splitStatsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  splitStat: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.sm,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
  },
  splitStatValue: {
    color: Colors.textPrimary,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    fontVariant: ['tabular-nums'],
  },
  splitStatLabel: {
    color: Colors.textMuted,
    fontSize: 9,
    marginTop: 2,
  },
  errorText: {
    color: Colors.textMuted,
    fontSize: FontSize.lg,
    textAlign: 'center',
    marginTop: 100,
  },
});
