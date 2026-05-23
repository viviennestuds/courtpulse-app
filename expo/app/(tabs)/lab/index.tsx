import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FlaskConical, BookOpen } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { Spacing, BorderRadius, FontSize, FontWeight } from '@/constants/theme';
import MetricCard from '@/components/MetricCard';
import SegmentControl from '@/components/SegmentControl';
import DataSourceBadge from '@/components/DataSourceBadge';
import { CUSTOM_METRICS, THRESHOLD_SPLITS } from '@/mocks/analytics';

const LAB_TABS = ['Metrics', 'Thresholds', 'Glossary'];
const METRIC_CATEGORIES = ['All', 'Impact', 'Offensive', 'Defensive', 'Context'];

export default function LabScreen() {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState(0);
  const [category, setCategory] = useState('All');
  const [refreshing, setRefreshing] = useState(false);

  const filteredMetrics = useMemo(() => {
    if (category === 'All') return CUSTOM_METRICS;
    return CUSTOM_METRICS.filter(m => m.category === category.toLowerCase());
  }, [category]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={Colors.primary} />}
      >
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>Analytics Lab</Text>
            <Text style={styles.subtitle}>Derived metrics & custom splits</Text>
          </View>
          <View style={styles.labBadge}>
            <FlaskConical size={14} color={Colors.accent} />
            <Text style={styles.labBadgeText}>BETA</Text>
          </View>
        </View>

        <View style={styles.introCard}>
          <DataSourceBadge source="demo" />
          <Text style={[styles.introText, { marginTop: Spacing.sm }]}>
            These metrics are computed from raw play-by-play data and are not available in standard NBA stat feeds. Showing sample data — connect the Python backend for live analytics.
          </Text>
        </View>

        <View style={styles.segmentRow}>
          <SegmentControl segments={LAB_TABS} selected={activeTab} onSelect={setActiveTab} />
        </View>

        {activeTab === 0 && (
          <View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={styles.filterRowContent}>
              {METRIC_CATEGORIES.map(c => (
                <TouchableOpacity
                  key={c}
                  style={[styles.catChip, category === c && styles.catChipActive]}
                  onPress={() => setCategory(c)}
                >
                  <Text style={[styles.catChipText, category === c && styles.catChipTextActive]}>{c}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            {filteredMetrics.map(metric => (
              <MetricCard key={metric.id} metric={metric} />
            ))}
          </View>
        )}

        {activeTab === 1 && (
          <ThresholdTab />
        )}

        {activeTab === 2 && (
          <GlossaryTab />
        )}
      </ScrollView>
    </View>
  );
}

function ThresholdTab() {
  const grouped = useMemo(() => {
    const groups: Record<string, typeof THRESHOLD_SPLITS> = {};
    THRESHOLD_SPLITS.forEach(s => {
      if (!groups[s.metric]) groups[s.metric] = [];
      groups[s.metric].push(s);
    });
    return groups;
  }, []);

  return (
    <View>
      <Text style={styles.sectionDescription}>
        Compare performance when a stat crosses a defined threshold. Shows win-loss record and key averages across the band.
      </Text>
      {Object.entries(grouped).map(([metric, splits]) => (
        <View key={metric} style={styles.thresholdGroup}>
          <Text style={styles.thresholdMetricName}>{metric}</Text>
          {splits.map(split => (
            <View key={split.id} style={styles.thresholdCard}>
              <View style={styles.thresholdHeader}>
                <Text style={styles.thresholdCondition}>
                  {split.operator === 'above' ? '≥' : '≤'} {split.threshold}
                </Text>
                <View style={[styles.recordBadge, {
                  backgroundColor: (split.wins / split.gamesPlayed) >= 0.6 ? Colors.positiveMuted : Colors.warningMuted,
                }]}>
                  <Text style={[styles.recordText, {
                    color: (split.wins / split.gamesPlayed) >= 0.6 ? Colors.positive : Colors.warning,
                  }]}>
                    {split.wins}-{split.losses}
                  </Text>
                </View>
              </View>
              <View style={styles.thresholdStats}>
                <View style={styles.tStat}>
                  <Text style={styles.tStatValue}>{((split.wins / split.gamesPlayed) * 100).toFixed(0)}%</Text>
                  <Text style={styles.tStatLabel}>Win%</Text>
                </View>
                <View style={styles.tStat}>
                  <Text style={styles.tStatValue}>{split.avgPoints.toFixed(1)}</Text>
                  <Text style={styles.tStatLabel}>PPG</Text>
                </View>
                <View style={styles.tStat}>
                  <Text style={styles.tStatValue}>{split.avgRebounds.toFixed(1)}</Text>
                  <Text style={styles.tStatLabel}>RPG</Text>
                </View>
                <View style={styles.tStat}>
                  <Text style={styles.tStatValue}>{split.avgAssists.toFixed(1)}</Text>
                  <Text style={styles.tStatLabel}>APG</Text>
                </View>
                <View style={styles.tStat}>
                  <Text style={[styles.tStatValue, { color: split.netRating >= 0 ? Colors.positive : Colors.negative }]}>
                    {split.netRating > 0 ? '+' : ''}{split.netRating.toFixed(1)}
                  </Text>
                  <Text style={styles.tStatLabel}>Net</Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

const GLOSSARY_ITEMS = [
  { abbr: 'RPR', name: 'Run Participation Rate', def: 'Percent of a team\'s positive scoring runs in which a player was on the floor.' },
  { abbr: 'LSV', name: 'Lineup Swing Value', def: 'Change in score margin per 100 possessions during a lineup segment vs team baseline.' },
  { abbr: 'CSDS', name: 'Context Shot Diet Shift', def: 'How a player\'s shot distribution changes between clutch and non-clutch situations.' },
  { abbr: 'TTR', name: 'Threshold Trigger Record', def: 'Team record when a chosen stat crosses a defined threshold band.' },
  { abbr: 'RCI', name: 'Run Creation Index', def: 'Composite score of scoring, assists, stops, forced turnovers, and lineup context during runs.' },
  { abbr: 'DI', name: 'Drought Impact', def: 'Team performance during scoring droughts when a player is on floor.' },
];

function GlossaryTab() {
  return (
    <View>
      <View style={styles.glossaryIntro}>
        <BookOpen size={16} color={Colors.accent} />
        <Text style={styles.glossaryIntroText}>All derived metrics used in CourtPulse</Text>
      </View>
      {GLOSSARY_ITEMS.map((item, i) => (
        <View key={i} style={styles.glossaryCard}>
          <View style={styles.glossaryHeader}>
            <Text style={styles.glossaryAbbr}>{item.abbr}</Text>
            <Text style={styles.glossaryName}>{item.name}</Text>
          </View>
          <Text style={styles.glossaryDef}>{item.def}</Text>
        </View>
      ))}
    </View>
  );
}

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
  labBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.accentMuted,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.sm,
  },
  labBadgeText: {
    color: Colors.accent,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    letterSpacing: 1,
  },
  introCard: {
    backgroundColor: Colors.cardBg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  introText: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    lineHeight: 20,
  },
  segmentRow: {
    marginBottom: Spacing.lg,
  },
  filterRow: {
    marginBottom: Spacing.md,
  },
  filterRowContent: {
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  catChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  catChipActive: {
    backgroundColor: Colors.accentMuted,
    borderColor: Colors.accent,
  },
  catChipText: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
  catChipTextActive: {
    color: Colors.accent,
    fontWeight: FontWeight.semibold,
  },
  sectionDescription: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    lineHeight: 20,
    marginBottom: Spacing.lg,
  },
  thresholdGroup: {
    marginBottom: Spacing.lg,
  },
  thresholdMetricName: {
    color: Colors.textPrimary,
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    marginBottom: Spacing.md,
  },
  thresholdCard: {
    backgroundColor: Colors.cardBg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  thresholdHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  thresholdCondition: {
    color: Colors.textPrimary,
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
  },
  recordBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  recordText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
  },
  thresholdStats: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  tStat: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.sm,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
  },
  tStatValue: {
    color: Colors.textPrimary,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    fontVariant: ['tabular-nums'],
  },
  tStatLabel: {
    color: Colors.textMuted,
    fontSize: 9,
    marginTop: 2,
  },
  glossaryIntro: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  glossaryIntroText: {
    color: Colors.textSecondary,
    fontSize: FontSize.md,
  },
  glossaryCard: {
    backgroundColor: Colors.cardBg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  glossaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  glossaryAbbr: {
    color: Colors.accent,
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    letterSpacing: 1,
    backgroundColor: Colors.accentMuted,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    overflow: 'hidden',
  },
  glossaryName: {
    color: Colors.textPrimary,
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
  },
  glossaryDef: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    lineHeight: 20,
  },
});
