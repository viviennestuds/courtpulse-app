import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '@/constants/colors';
import { Spacing, FontSize, FontWeight } from '@/constants/theme';

interface StatBarProps {
  label: string;
  homeValue: number | null;
  awayValue: number | null;
  homeColor: string;
  awayColor: string;
  isPercentage?: boolean;
}

export default React.memo(function StatBar({ label, homeValue, awayValue, homeColor, awayColor, isPercentage }: StatBarProps) {
  const safeHomeValue = homeValue ?? 0;
  const safeAwayValue = awayValue ?? 0;
  const total = safeHomeValue + safeAwayValue;
  const homeWidth = total > 0 ? (safeHomeValue / total) * 100 : 50;
  const awayWidth = total > 0 ? (safeAwayValue / total) * 100 : 50;
  const format = (v: number | null) => {
    if (v === null) return '—';
    return isPercentage ? `${v.toFixed(1)}%` : String(v);
  };

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Text style={styles.value}>{format(homeValue)}</Text>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>{format(awayValue)}</Text>
      </View>
      <View style={styles.barContainer}>
        <View style={[styles.barHome, { width: `${homeWidth}%`, backgroundColor: homeColor }]} />
        <View style={[styles.barAway, { width: `${awayWidth}%`, backgroundColor: awayColor }]} />
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.md,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  value: {
    color: Colors.textPrimary,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    fontVariant: ['tabular-nums'],
    minWidth: 36,
  },
  label: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  barContainer: {
    flexDirection: 'row',
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    gap: 2,
  },
  barHome: {
    height: 4,
    borderRadius: 2,
  },
  barAway: {
    height: 4,
    borderRadius: 2,
  },
});
