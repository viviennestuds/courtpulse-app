import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { TrendingUp, TrendingDown, Minus, Info } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { Spacing, BorderRadius, FontSize, FontWeight } from '@/constants/theme';
import { CustomMetric } from '@/types';

interface MetricCardProps {
  metric: CustomMetric;
}

const CATEGORY_COLORS: Record<string, string> = {
  offensive: Colors.primary,
  defensive: Colors.secondary,
  impact: Colors.accent,
  context: Colors.warning,
};

export default React.memo(function MetricCard({ metric }: MetricCardProps) {
  const [showInfo, setShowInfo] = useState(false);
  const catColor = CATEGORY_COLORS[metric.category] ?? Colors.textMuted;

  const toggleInfo = useCallback(() => {
    setShowInfo(prev => !prev);
  }, []);

  const TrendIcon = metric.trend === 'up' ? TrendingUp : metric.trend === 'down' ? TrendingDown : Minus;
  const trendColor = metric.trend === 'up' ? Colors.positive : metric.trend === 'down' ? Colors.negative : Colors.textMuted;

  return (
    <View style={styles.container} testID={`metric-${metric.id}`}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={[styles.categoryDot, { backgroundColor: catColor }]} />
          <Text style={styles.shortName}>{metric.shortName}</Text>
          <View style={[styles.sourceBadge, { backgroundColor: metric.source === 'derived' ? Colors.accentMuted : Colors.secondaryMuted }]}>
            <Text style={[styles.sourceText, { color: metric.source === 'derived' ? Colors.accent : Colors.secondary }]}>
              {metric.source === 'derived' ? 'Derived' : 'Direct'}
            </Text>
          </View>
        </View>
        <TouchableOpacity onPress={toggleInfo} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Info size={16} color={Colors.textMuted} />
        </TouchableOpacity>
      </View>

      <Text style={styles.metricName}>{metric.name}</Text>
      {(metric.playerName || metric.teamAbbr) && (
        <Text style={styles.context}>{metric.playerName}{metric.playerName && metric.teamAbbr ? ' · ' : ''}{metric.teamAbbr}</Text>
      )}

      <View style={styles.valueRow}>
        <Text style={[styles.value, { color: metric.value < 0 ? Colors.negative : Colors.textPrimary }]}>
          {metric.value > 0 && metric.trend === 'up' ? '' : ''}{metric.value}
        </Text>
        <Text style={styles.unit}>{metric.unit}</Text>
        <View style={styles.trendContainer}>
          <TrendIcon size={14} color={trendColor} />
        </View>
      </View>

      <View style={styles.percentileBar}>
        <View style={[styles.percentileFill, { width: `${metric.percentile}%`, backgroundColor: catColor }]} />
      </View>
      <Text style={styles.percentileLabel}>{metric.percentile}th percentile</Text>

      {showInfo && (
        <View style={styles.infoPanel}>
          <Text style={styles.infoTitle}>Definition</Text>
          <Text style={styles.infoText}>{metric.description}</Text>
          <Text style={styles.infoTitle}>Formula</Text>
          <Text style={styles.infoFormula}>{metric.formula}</Text>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  categoryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  shortName: {
    color: Colors.textPrimary,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    letterSpacing: 1,
  },
  sourceBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  sourceText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
  },
  metricName: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    marginBottom: 2,
  },
  context: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    marginBottom: Spacing.md,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    marginBottom: Spacing.md,
  },
  value: {
    color: Colors.textPrimary,
    fontSize: FontSize.xxxl,
    fontWeight: FontWeight.heavy,
  },
  unit: {
    color: Colors.textMuted,
    fontSize: FontSize.md,
    fontWeight: FontWeight.medium,
  },
  trendContainer: {
    marginLeft: Spacing.sm,
  },
  percentileBar: {
    height: 4,
    backgroundColor: Colors.surface,
    borderRadius: 2,
    marginBottom: 4,
    overflow: 'hidden',
  },
  percentileFill: {
    height: 4,
    borderRadius: 2,
  },
  percentileLabel: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    marginBottom: Spacing.sm,
  },
  infoPanel: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginTop: Spacing.sm,
  },
  infoTitle: {
    color: Colors.primary,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
    marginTop: Spacing.sm,
  },
  infoText: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    lineHeight: 20,
  },
  infoFormula: {
    color: Colors.textPrimary,
    fontSize: FontSize.sm,
    fontFamily: 'monospace',
    backgroundColor: Colors.cardBg,
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    overflow: 'hidden',
  },
});
