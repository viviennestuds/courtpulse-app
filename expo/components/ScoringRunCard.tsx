import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Zap } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { Spacing, BorderRadius, FontSize, FontWeight } from '@/constants/theme';
import { ScoringRun } from '@/types';

interface ScoringRunCardProps {
  run: ScoringRun;
  compact?: boolean;
}

export default React.memo(function ScoringRunCard({ run, compact }: ScoringRunCardProps) {
  return (
    <View style={[styles.container, compact && styles.containerCompact]} testID={`run-${run.id}`}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Zap size={14} color={Colors.warning} fill={Colors.warning} />
          <View style={[styles.teamDot, { backgroundColor: run.teamColor }]} />
          <Text style={styles.teamBadge}>{run.teamAbbr}</Text>
          <Text style={styles.runLabel}>{run.totalPoints}-{run.opponentPoints}</Text>
        </View>
        <Text style={styles.periodClock}>Q{run.period} · {run.startClock} → {run.endClock}</Text>
      </View>

      {!compact && (
        <>
          <Text style={styles.scoreChange}>{run.scoreChange}</Text>
          <Text style={styles.keyPlay} numberOfLines={2}>{run.keyPlay}</Text>
        </>
      )}

      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>+{run.netPoints}</Text>
          <Text style={styles.statLabel}>Net</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{run.playCount}</Text>
          <Text style={styles.statLabel}>Plays</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{run.duration}</Text>
          <Text style={styles.statLabel}>Time</Text>
        </View>
      </View>

      {!compact && (
        <View style={styles.playersRow}>
          {run.players.map((player, i) => (
            <View key={i} style={styles.playerChip}>
              <Text style={styles.playerChipText}>{player}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.cardBg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  containerCompact: {
    padding: Spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  teamDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  teamBadge: {
    color: Colors.textPrimary,
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
  },
  runLabel: {
    color: Colors.warning,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
  },
  periodClock: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
  },
  scoreChange: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    marginBottom: Spacing.sm,
  },
  keyPlay: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    fontStyle: 'italic',
    lineHeight: 20,
    marginBottom: Spacing.md,
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  statItem: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.sm,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
  },
  statValue: {
    color: Colors.textPrimary,
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
  },
  statLabel: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    marginTop: 2,
  },
  playersRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  playerChip: {
    backgroundColor: Colors.surfaceLight,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.sm,
  },
  playerChipText: {
    color: Colors.textSecondary,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
  },
});
