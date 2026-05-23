import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '@/constants/colors';
import { Spacing, FontSize, FontWeight } from '@/constants/theme';
import { PlayByPlayEvent } from '@/types';

interface PlayByPlayItemProps {
  event: PlayByPlayEvent;
  homeAbbr: string;
}

const EVENT_COLORS: Record<string, string> = {
  score: Colors.positive,
  turnover: Colors.negative,
  foul: Colors.warning,
  steal: Colors.secondary,
  block: Colors.accent,
  rebound: Colors.textSecondary,
  substitution: Colors.textMuted,
  timeout: Colors.textMuted,
  miss: Colors.textMuted,
};

export default React.memo(function PlayByPlayItem({ event, homeAbbr }: PlayByPlayItemProps) {
  const isHome = event.teamAbbr === homeAbbr;
  const color = EVENT_COLORS[event.eventType] ?? Colors.textMuted;
  const isScoring = event.eventType === 'score';

  return (
    <View style={[styles.container, isScoring && styles.scoringContainer]}>
      <View style={styles.clockCol}>
        <Text style={styles.clock}>{event.clock}</Text>
      </View>

      <View style={[styles.indicator, { backgroundColor: color }]} />

      <View style={[styles.contentCol, isHome ? styles.homeAlign : styles.awayAlign]}>
        <View style={styles.eventRow}>
          <Text style={[styles.teamLabel, { color }]}>{event.teamAbbr}</Text>
          <Text style={styles.description} numberOfLines={2}>{event.description}</Text>
        </View>
      </View>

      <View style={styles.scoreCol}>
        <Text style={styles.scoreText}>{event.homeScore}-{event.awayScore}</Text>
        {isScoring && event.scoreDelta && (
          <Text style={[styles.delta, { color }]}>+{event.scoreDelta}</Text>
        )}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
    gap: Spacing.sm,
  },
  scoringContainer: {
    backgroundColor: Colors.positiveMuted,
  },
  clockCol: {
    width: 42,
  },
  clock: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
    fontVariant: ['tabular-nums'],
  },
  indicator: {
    width: 3,
    height: 24,
    borderRadius: 2,
  },
  contentCol: {
    flex: 1,
  },
  homeAlign: {},
  awayAlign: {},
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  teamLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.5,
    width: 30,
  },
  description: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    flex: 1,
    lineHeight: 18,
  },
  scoreCol: {
    alignItems: 'flex-end',
    minWidth: 50,
  },
  scoreText: {
    color: Colors.textPrimary,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    fontVariant: ['tabular-nums'],
  },
  delta: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
  },
});
