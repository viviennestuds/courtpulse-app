import React, { useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, WifiOff, Crosshair, TrendingUp, Target, BarChart3, Layers } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { Spacing, BorderRadius, FontSize, FontWeight } from '@/constants/theme';
import { useGameDetail } from '@/hooks/useNbaData';
import { computePlayerPerformanceStats } from '@/services/analyticsEngine';
import { PlayerPerformanceStats } from '@/types';
import { safeBack } from '@/utils/navigation';
import { useResponsiveLayout } from '@/components/ResponsiveLayout';

function StatCell({ label, value, color, large }: {
  label: string;
  value: string | number;
  color?: string;
  large?: boolean;
}) {
  return (
    <View style={styles.statCell}>
      <Text style={[
        large ? styles.statCellValueLarge : styles.statCellValue,
        color ? { color } : undefined,
      ]}>
        {value}
      </Text>
      <Text style={styles.statCellLabel}>{label}</Text>
    </View>
  );
}

function StatRow({ label, value, color, suffix }: {
  label: string;
  value: string | number;
  color?: string;
  suffix?: string;
}) {
  return (
    <View style={styles.statRow}>
      <Text style={styles.statRowLabel}>{label}</Text>
      <Text style={[styles.statRowValue, color ? { color } : undefined]}>
        {value}{suffix ?? ''}
      </Text>
    </View>
  );
}

function SectionHeader({ title, icon }: { title: string; icon: React.ReactNode }) {
  return (
    <View style={styles.sectionHeader}>
      {icon}
      <Text style={styles.sectionHeaderText}>{title}</Text>
    </View>
  );
}

function BoxScoreSection({ stats }: { stats: PlayerPerformanceStats }) {
  const pmColor = stats.plusMinus >= 0 ? Colors.positive : Colors.negative;
  const pmPrefix = stats.plusMinus > 0 ? '+' : '';

  return (
    <View style={styles.cardSection}>
      <View style={styles.boxGrid}>
        <View style={styles.boxGridRow}>
          <StatCell label="MIN" value={stats.minutes} />
          <StatCell label="PTS" value={stats.points} large />
          <StatCell label="AST" value={stats.assists} />
          <StatCell label="+/-" value={`${pmPrefix}${stats.plusMinus}`} color={pmColor} />
        </View>
        <View style={styles.boxGridRow}>
          <StatCell label="REB" value={stats.rebounds} />
          <StatCell label="OREB" value={stats.offensiveRebounds} />
          <StatCell label="DREB" value={stats.defensiveRebounds} />
          <StatCell label="STL" value={stats.steals} />
        </View>
        <View style={styles.boxGridRow}>
          <StatCell label="BLK" value={stats.blocks} />
          <StatCell label="TOV" value={stats.turnovers} />
        </View>
      </View>
    </View>
  );
}

function ScoringEfficiencySection({ stats }: { stats: PlayerPerformanceStats }) {
  return (
    <View style={styles.cardSection}>
      <StatRow
        label="FG"
        value={`${stats.fgm}/${stats.fga}`}
        suffix={stats.fga > 0 ? ` (${stats.fgPct}%)` : ''}
      />
      <StatRow
        label="3PT"
        value={`${stats.tpm}/${stats.tpa}`}
        suffix={stats.tpa > 0 ? ` (${stats.tpPct}%)` : ''}
      />
      <StatRow
        label="FT"
        value={`${stats.ftm}/${stats.fta}`}
        suffix={stats.fta > 0 ? ` (${stats.ftPct}%)` : ''}
      />
      <StatRow
        label="TS%"
        value={stats.tsPct !== null ? `${stats.tsPct}%` : '\u2014'}
      />
      <StatRow
        label="eFG%"
        value={stats.efgPct !== null ? `${stats.efgPct}%` : '\u2014'}
      />
    </View>
  );
}

function PlayStyleSection({ stats }: { stats: PlayerPerformanceStats }) {
  return (
    <View style={styles.cardSection}>
      <StatRow
        label="Usage Rate"
        value={stats.usageRate !== null ? `${stats.usageRate}%` : '\u2014'}
      />
      <StatRow
        label="Play-Finishing Share"
        value={stats.playFinishingShare !== null ? `${stats.playFinishingShare}%` : '\u2014'}
      />
      <StatRow
        label="A/TO"
        value={stats.assistTurnoverRatio !== null ? stats.assistTurnoverRatio.toFixed(2) : '\u2014'}
      />
    </View>
  );
}

function ShotProfilePlaceholder() {
  return (
    <View style={styles.placeholderCard}>
      <View style={styles.placeholderInner}>
        <Layers size={24} color={Colors.textMuted} />
        <Text style={styles.placeholderTitle}>Shot Profile</Text>
        <Text style={styles.placeholderSubtext}>Coming soon</Text>
      </View>
    </View>
  );
}

export default function PlayerPerformanceScreen() {
  const { id, playerId } = useLocalSearchParams<{ id: string; playerId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { frameStyle } = useResponsiveLayout();

  const {
    game,
    homeBoxScore,
    awayBoxScore,
    isLoading,
    isError,
    refetch,
  } = useGameDetail(id ?? '');

  const handleBack = useCallback(() => {
    safeBack(router, id ? `/game/${id}` : '/(tabs)/(games)');
  }, [router, id]);

  const playerStats = useMemo<PlayerPerformanceStats | null>(() => {
    if (!game || !playerId) return null;

    const homePlayer = homeBoxScore.find(p => p.playerId === playerId);
    if (homePlayer) {
      return computePlayerPerformanceStats(homePlayer, homeBoxScore, game.homeTeam.abbreviation);
    }

    const awayPlayer = awayBoxScore.find(p => p.playerId === playerId);
    if (awayPlayer) {
      return computePlayerPerformanceStats(awayPlayer, awayBoxScore, game.awayTeam.abbreviation);
    }

    console.warn(`[PlayerPerf] Player ${playerId} not found in either box score`);
    return null;
  }, [game, playerId, homeBoxScore, awayBoxScore]);

  const matchupLabel = useMemo(() => {
    if (!game) return '';
    return `${game.awayTeam.abbreviation} @ ${game.homeTeam.abbreviation}`;
  }, [game]);

  const playerTeamColor = useMemo(() => {
    if (!game || !playerId) return Colors.primary;
    const isHome = homeBoxScore.some(p => p.playerId === playerId);
    return isHome ? game.homeTeam.primaryColor : game.awayTeam.primaryColor;
  }, [game, playerId, homeBoxScore]);

  if (isLoading) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <View style={[styles.headerBar, frameStyle]}>
          <TouchableOpacity onPress={handleBack} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <ChevronLeft size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Loading...</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </View>
    );
  }

  if (isError || !game || !playerStats) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <View style={[styles.headerBar, frameStyle]}>
          <TouchableOpacity onPress={handleBack} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <ChevronLeft size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Player</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.centerContainer}>
          <WifiOff size={32} color={Colors.textMuted} />
          <Text style={styles.errorText}>Unable to load player data</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={refetch}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={[styles.headerBar, frameStyle]}>
        <TouchableOpacity onPress={handleBack} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <ChevronLeft size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Player Performance</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={[styles.scrollContent, frameStyle]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.playerHeader}>
          <View style={[styles.teamAccent, { backgroundColor: playerTeamColor }]} />
          <View style={styles.playerInfo}>
            <Text style={styles.playerName}>{playerStats.name}</Text>
            <View style={styles.playerMeta}>
              <View style={styles.playerBadge}>
                <Text style={styles.playerBadgeText}>{playerStats.teamAbbr}</Text>
              </View>
              {playerStats.position ? (
                <View style={[styles.playerBadge, styles.playerPosBadge]}>
                  <Text style={styles.playerPosText}>{playerStats.position}</Text>
                </View>
              ) : null}
              <Text style={styles.matchupText}>{matchupLabel}</Text>
            </View>
          </View>
        </View>

        <SectionHeader
          title="BOX SCORE"
          icon={<Crosshair size={12} color={Colors.secondary} />}
        />
        <BoxScoreSection stats={playerStats} />

        <View style={styles.divider} />
        <SectionHeader
          title="SCORING EFFICIENCY"
          icon={<Target size={12} color={Colors.primary} />}
        />
        <ScoringEfficiencySection stats={playerStats} />

        <View style={styles.divider} />
        <SectionHeader
          title="PLAY STYLE / CONTEXT"
          icon={<BarChart3 size={12} color={Colors.warning} />}
        />
        <PlayStyleSection stats={playerStats} />

        <View style={styles.divider} />
        <SectionHeader
          title="SHOT PROFILE"
          icon={<TrendingUp size={12} color={Colors.accent} />}
        />
        <ShotProfilePlaceholder />

        <View style={{ height: Spacing.xxxl }} />
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  headerCenter: {
    alignItems: 'center',
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: Colors.textPrimary,
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  errorText: {
    color: Colors.textMuted,
    fontSize: FontSize.md,
  },
  retryBtn: {
    backgroundColor: Colors.primaryMuted,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  retryText: {
    color: Colors.primary,
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxxl,
  },
  playerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.xl,
    marginTop: Spacing.sm,
  },
  teamAccent: {
    width: 4,
    height: 48,
    borderRadius: 2,
  },
  playerInfo: {
    flex: 1,
    gap: Spacing.xs,
  },
  playerName: {
    color: Colors.textPrimary,
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.heavy,
    letterSpacing: -0.5,
  },
  playerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  playerBadge: {
    backgroundColor: Colors.primaryMuted,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  playerBadgeText: {
    color: Colors.primary,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.5,
  },
  playerPosBadge: {
    backgroundColor: Colors.surfaceLight,
  },
  playerPosText: {
    color: Colors.textSecondary,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
  },
  matchupText: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.md,
    marginTop: Spacing.sm,
  },
  sectionHeaderText: {
    color: Colors.textMuted,
    fontSize: 9,
    fontWeight: FontWeight.bold,
    letterSpacing: 1.2,
  },
  cardSection: {
    backgroundColor: Colors.cardBg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xs,
    marginBottom: Spacing.md,
  },
  boxGrid: {
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
  },
  boxGridRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  statCell: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.sm,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
  },
  statCellValue: {
    color: Colors.textPrimary,
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    fontVariant: ['tabular-nums'] as const,
  },
  statCellValueLarge: {
    color: Colors.textPrimary,
    fontSize: FontSize.xl,
    fontWeight: FontWeight.heavy,
    fontVariant: ['tabular-nums'] as const,
  },
  statCellLabel: {
    color: Colors.textMuted,
    fontSize: 9,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.5,
    marginTop: 2,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  statRowLabel: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
  statRowValue: {
    color: Colors.textPrimary,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    fontVariant: ['tabular-nums'] as const,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.divider,
    marginVertical: Spacing.sm,
  },
  placeholderCard: {
    backgroundColor: Colors.cardBg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderStyle: 'dashed' as const,
    padding: Spacing.xxl,
    marginBottom: Spacing.md,
    alignItems: 'center',
  },
  placeholderInner: {
    alignItems: 'center',
    gap: Spacing.sm,
  },
  placeholderTitle: {
    color: Colors.textMuted,
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
  },
  placeholderSubtext: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontStyle: 'italic' as const,
  },
});
