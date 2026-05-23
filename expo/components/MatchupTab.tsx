import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Shield, Swords, TrendingUp, TrendingDown, Minus, Info } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { Spacing, BorderRadius, FontSize, FontWeight } from '@/constants/theme';
import {
  MatchupPlayerPair,
  TeamMatchupStats,
  ContextualMatchup,
  MatchupEdgeSummary,
  MatchupPlayer,
} from '@/types';

interface MatchupTabProps {
  homeStats: TeamMatchupStats;
  awayStats: TeamMatchupStats;
  contextual: ContextualMatchup[];
  playerMatchups: MatchupPlayerPair[];
  edgeSummary: MatchupEdgeSummary;
}

function getAdvantageColor(homeVal: number, awayVal: number, invert?: boolean): { home: string; away: string } {
  const threshold = 0.5;
  const diff = homeVal - awayVal;
  if (Math.abs(diff) < threshold) return { home: Colors.textSecondary, away: Colors.textSecondary };
  const homeWins = invert ? diff < 0 : diff > 0;
  return {
    home: homeWins ? Colors.positive : Colors.negative,
    away: homeWins ? Colors.negative : Colors.positive,
  };
}

function getRunTagColor(tag: MatchupPlayer['runTag']): string {
  switch (tag) {
    case 'Primary Run Creator': return Colors.positive;
    case 'High Run Impact': return Colors.secondary;
    case 'Low Run Involvement': return Colors.textMuted;
  }
}

function getRunTagBg(tag: MatchupPlayer['runTag']): string {
  switch (tag) {
    case 'Primary Run Creator': return Colors.positiveMuted;
    case 'High Run Impact': return Colors.secondaryMuted;
    case 'Low Run Involvement': return 'rgba(100,116,139,0.12)';
  }
}

export default React.memo(function MatchupTab({
  homeStats,
  awayStats,
  contextual,
  playerMatchups,
  edgeSummary,
}: MatchupTabProps) {
  return (
    <View>
      <EdgeSummarySection summary={edgeSummary} />
      <TeamComparisonSection home={homeStats} away={awayStats} />
      <ContextualSection matchups={contextual} />
      <PlayerMatchupsSection pairs={playerMatchups} homeAbbr={homeStats.abbreviation} awayAbbr={awayStats.abbreviation} homeColor={homeStats.primaryColor} awayColor={awayStats.primaryColor} />
    </View>
  );
});

function EdgeSummarySection({ summary }: { summary: MatchupEdgeSummary }) {
  return (
    <View style={styles.edgeContainer}>
      <View style={styles.edgeHeader}>
        <Swords size={14} color={Colors.warning} />
        <Text style={styles.edgeTitle}>MATCHUP INTELLIGENCE</Text>
      </View>
      <View style={[styles.edgeOverallBar, { borderLeftColor: summary.overallTeamColor }]}>
        <Text style={styles.edgeOverallLabel}>
          <Text style={[styles.edgeTeamHighlight, { color: summary.overallTeamColor }]}>{summary.overallTeamAbbr}</Text>
          {' holds the edge'}
        </Text>
        <Text style={styles.edgeOverallDesc}>{summary.overallEdge}</Text>
      </View>
      <View style={styles.edgeRows}>
        <View style={styles.edgeRow}>
          <View style={styles.edgeIconWrap}>
            <TrendingUp size={12} color={Colors.positive} />
          </View>
          <View style={styles.edgeRowText}>
            <Text style={styles.edgeRowTitle}>Offensive Edge</Text>
            <Text style={styles.edgeRowDesc}>{summary.offensiveEdge}</Text>
          </View>
        </View>
        <View style={[styles.edgeDivider]} />
        <View style={styles.edgeRow}>
          <View style={styles.edgeIconWrap}>
            <Shield size={12} color={Colors.secondary} />
          </View>
          <View style={styles.edgeRowText}>
            <Text style={styles.edgeRowTitle}>Defensive Edge</Text>
            <Text style={styles.edgeRowDesc}>{summary.defensiveEdge}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

interface StatRowProps {
  label: string;
  homeVal: number;
  awayVal: number;
  format?: 'number' | 'rating' | 'pct';
  invert?: boolean;
}

function formatStat(val: number, format: string): string {
  switch (format) {
    case 'pct': return `${val.toFixed(1)}%`;
    case 'rating': return val.toFixed(1);
    default: return val.toFixed(1);
  }
}

function MirrorStatRow({ label, homeVal, awayVal, format = 'number', invert = false }: StatRowProps) {
  const colors = getAdvantageColor(homeVal, awayVal, invert);
  const diff = Math.abs(homeVal - awayVal);
  const maxVal = Math.max(homeVal, awayVal);
  const homeBarPct = maxVal > 0 ? (homeVal / maxVal) * 100 : 50;
  const awayBarPct = maxVal > 0 ? (awayVal / maxVal) * 100 : 50;

  return (
    <View style={styles.mirrorRow}>
      <View style={styles.mirrorLeft}>
        <Text style={[styles.mirrorValue, { color: colors.home }]}>
          {formatStat(homeVal, format)}
        </Text>
        <View style={styles.mirrorBarTrack}>
          <View style={[styles.mirrorBarFillLeft, { width: `${homeBarPct}%`, backgroundColor: colors.home === Colors.positive ? 'rgba(16,185,129,0.3)' : colors.home === Colors.negative ? 'rgba(239,68,68,0.2)' : 'rgba(148,163,184,0.15)' }]} />
        </View>
      </View>
      <View style={styles.mirrorCenter}>
        <Text style={styles.mirrorLabel}>{label}</Text>
        {diff > 0.4 && (
          <Text style={styles.mirrorDiff}>
            {invert ? (homeVal < awayVal ? '◀' : '▶') : (homeVal > awayVal ? '◀' : '▶')}
          </Text>
        )}
      </View>
      <View style={styles.mirrorRight}>
        <View style={styles.mirrorBarTrack}>
          <View style={[styles.mirrorBarFillRight, { width: `${awayBarPct}%`, backgroundColor: colors.away === Colors.positive ? 'rgba(16,185,129,0.3)' : colors.away === Colors.negative ? 'rgba(239,68,68,0.2)' : 'rgba(148,163,184,0.15)' }]} />
        </View>
        <Text style={[styles.mirrorValue, { color: colors.away }]}>
          {formatStat(awayVal, format)}
        </Text>
      </View>
    </View>
  );
}

function TeamComparisonSection({ home, away }: { home: TeamMatchupStats; away: TeamMatchupStats }) {
  return (
    <View>
      <Text style={styles.sectionLabel}>TEAM vs TEAM</Text>
      <View style={styles.comparisonContainer}>
        <View style={styles.comparisonHeader}>
          <View style={styles.compTeamLeft}>
            <View style={[styles.compTeamDot, { backgroundColor: home.primaryColor }]} />
            <Text style={styles.compTeamName}>{home.abbreviation}</Text>
            <Text style={styles.compTeamRecord}>{home.record}</Text>
          </View>
          <View style={styles.compTeamRight}>
            <Text style={styles.compTeamRecord}>{away.record}</Text>
            <Text style={styles.compTeamName}>{away.abbreviation}</Text>
            <View style={[styles.compTeamDot, { backgroundColor: away.primaryColor }]} />
          </View>
        </View>
        <View style={styles.compDivider} />
        <MirrorStatRow label="Net Rtg" homeVal={home.netRating} awayVal={away.netRating} format="rating" />
        <MirrorStatRow label="Off Rtg" homeVal={home.offRating} awayVal={away.offRating} format="rating" />
        <MirrorStatRow label="Def Rtg" homeVal={home.defRating} awayVal={away.defRating} format="rating" invert />
        <MirrorStatRow label="PPG" homeVal={home.ppg} awayVal={away.ppg} />
        <MirrorStatRow label="APG" homeVal={home.apg} awayVal={away.apg} />
        <MirrorStatRow label="TOV" homeVal={home.tov} awayVal={away.tov} invert />
        <MirrorStatRow label="TS%" homeVal={home.tsPct} awayVal={away.tsPct} format="pct" />
      </View>
    </View>
  );
}

function ContextualSection({ matchups }: { matchups: ContextualMatchup[] }) {
  return (
    <View>
      <Text style={styles.sectionLabel}>CONTEXTUAL MATCHUPS</Text>
      {matchups.map((m, i) => {
        const edgeColor = m.edge === 'offense' ? Colors.positive : m.edge === 'defense' ? Colors.secondary : Colors.textMuted;
        return (
          <View key={i} style={styles.contextCard}>
            <View style={styles.contextRow}>
              <View style={styles.contextSide}>
                <View style={[styles.contextDot, { backgroundColor: m.offenseColor }]} />
                <Text style={styles.contextTeam}>{m.offenseAbbr}</Text>
                <Text style={styles.contextRole}>OFF</Text>
                <Text style={[styles.contextRating, { color: Colors.positive }]}>{m.offRating.toFixed(1)}</Text>
              </View>
              <View style={styles.contextVs}>
                <Text style={styles.contextVsText}>vs</Text>
              </View>
              <View style={[styles.contextSide, { justifyContent: 'flex-end' }]}>
                <Text style={[styles.contextRating, { color: Colors.secondary }]}>{m.defRating.toFixed(1)}</Text>
                <Text style={styles.contextRole}>DEF</Text>
                <Text style={styles.contextTeam}>{m.defenseAbbr}</Text>
                <View style={[styles.contextDot, { backgroundColor: m.defenseColor }]} />
              </View>
            </View>
            <View style={styles.contextEdgeBar}>
              <View style={[styles.contextEdgeIndicator, { backgroundColor: edgeColor }]} />
              <Text style={[styles.contextEdgeText, { color: edgeColor }]}>
                {m.edge === 'offense' ? `${m.offenseAbbr} offense` : m.edge === 'defense' ? `${m.defenseAbbr} defense` : 'Even'} +{m.differential.toFixed(1)}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

function PlayerMatchupsSection({ pairs, homeAbbr, awayAbbr, homeColor, awayColor }: {
  pairs: MatchupPlayerPair[];
  homeAbbr: string;
  awayAbbr: string;
  homeColor: string;
  awayColor: string;
}) {
  return (
    <View>
      <Text style={styles.sectionLabel}>KEY PLAYER MATCHUPS</Text>
      <View style={styles.playerHeader}>
        <View style={styles.playerHeaderSide}>
          <View style={[styles.playerHeaderDot, { backgroundColor: homeColor }]} />
          <Text style={styles.playerHeaderTeam}>{homeAbbr}</Text>
        </View>
        <Text style={styles.playerHeaderVs}>vs</Text>
        <View style={[styles.playerHeaderSide, { justifyContent: 'flex-end' }]}>
          <Text style={styles.playerHeaderTeam}>{awayAbbr}</Text>
          <View style={[styles.playerHeaderDot, { backgroundColor: awayColor }]} />
        </View>
      </View>
      {pairs.map((pair, i) => (
        <PlayerMatchupRow key={i} pair={pair} index={i} homeColor={homeColor} awayColor={awayColor} />
      ))}
      <View style={styles.legendRow}>
        <Info size={10} color={Colors.textMuted} />
        <Text style={styles.legendText}>Run analytics derived from play-by-play event data</Text>
      </View>
    </View>
  );
}

function PlayerMatchupRow({ pair, index, homeColor, awayColor }: {
  pair: MatchupPlayerPair;
  index: number;
  homeColor: string;
  awayColor: string;
}) {
  const { home, away } = pair;

  const stats: Array<{ label: string; homeVal: number; awayVal: number; format: string }> = useMemo(() => [
    { label: 'PTS', homeVal: home.points, awayVal: away.points, format: 'number' },
    { label: 'USG', homeVal: home.usage, awayVal: away.usage, format: 'pct' },
    { label: 'TS%', homeVal: home.tsPct, awayVal: away.tsPct, format: 'pct' },
    { label: 'AST', homeVal: home.assists, awayVal: away.assists, format: 'number' },
    { label: 'REB', homeVal: home.rebounds, awayVal: away.rebounds, format: 'number' },
  ], [home, away]);

  return (
    <View style={[styles.playerCard, index === 0 && styles.playerCardFirst]}>
      <View style={styles.playerNames}>
        <View style={styles.playerNameLeft}>
          <View style={[styles.posChip, { borderColor: homeColor }]}>
            <Text style={[styles.posChipText, { color: homeColor }]}>{home.position}</Text>
          </View>
          <Text style={styles.playerName} numberOfLines={1}>{home.name}</Text>
        </View>
        <View style={styles.playerNameRight}>
          <Text style={styles.playerName} numberOfLines={1}>{away.name}</Text>
          <View style={[styles.posChip, { borderColor: awayColor }]}>
            <Text style={[styles.posChipText, { color: awayColor }]}>{away.position}</Text>
          </View>
        </View>
      </View>

      {stats.map((s) => {
        const colors = getAdvantageColor(s.homeVal, s.awayVal);
        return (
          <View key={s.label} style={styles.playerStatRow}>
            <Text style={[styles.playerStatVal, { color: colors.home }]}>
              {s.format === 'pct' ? `${s.homeVal.toFixed(1)}%` : s.homeVal.toFixed(1)}
            </Text>
            <Text style={styles.playerStatLabel}>{s.label}</Text>
            <Text style={[styles.playerStatVal, { color: colors.away }]}>
              {s.format === 'pct' ? `${s.awayVal.toFixed(1)}%` : s.awayVal.toFixed(1)}
            </Text>
          </View>
        );
      })}

      <View style={styles.runAnalyticsSection}>
        <View style={styles.runAnalyticsRow}>
          <View style={styles.runAnalyticLeft}>
            <Text style={[styles.runAnalyticValue, { color: Colors.secondary }]}>{home.runParticipation.toFixed(0)}%</Text>
            <Text style={styles.runAnalyticSmall}>RPR</Text>
          </View>
          <Text style={styles.runAnalyticCenter}>Run Analytics</Text>
          <View style={styles.runAnalyticRight}>
            <Text style={styles.runAnalyticSmall}>RPR</Text>
            <Text style={[styles.runAnalyticValue, { color: Colors.secondary }]}>{away.runParticipation.toFixed(0)}%</Text>
          </View>
        </View>
        <View style={styles.runAnalyticsRow}>
          <View style={styles.runAnalyticLeft}>
            <Text style={[styles.runAnalyticValue, { color: Colors.accent }]}>{home.runImpactScore.toFixed(1)}</Text>
            <Text style={styles.runAnalyticSmall}>RIS</Text>
          </View>
          <Text style={styles.runAnalyticCenter}>Impact Score</Text>
          <View style={styles.runAnalyticRight}>
            <Text style={styles.runAnalyticSmall}>RIS</Text>
            <Text style={[styles.runAnalyticValue, { color: Colors.accent }]}>{away.runImpactScore.toFixed(1)}</Text>
          </View>
        </View>
      </View>

      <View style={styles.runTags}>
        <View style={[styles.runTag, { backgroundColor: getRunTagBg(home.runTag) }]}>
          <Text style={[styles.runTagText, { color: getRunTagColor(home.runTag) }]}>{home.runTag}</Text>
        </View>
        <View style={{ flex: 1 }} />
        <View style={[styles.runTag, { backgroundColor: getRunTagBg(away.runTag) }]}>
          <Text style={[styles.runTagText, { color: getRunTagColor(away.runTag) }]}>{away.runTag}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionLabel: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    letterSpacing: 1.5,
    marginBottom: Spacing.md,
    marginTop: Spacing.lg,
  },
  edgeContainer: {
    backgroundColor: Colors.cardBg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    overflow: 'hidden',
    marginTop: Spacing.md,
  },
  edgeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  edgeTitle: {
    color: Colors.warning,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    letterSpacing: 1.2,
  },
  edgeOverallBar: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    borderLeftWidth: 3,
    paddingLeft: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  edgeOverallLabel: {
    color: Colors.textPrimary,
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    marginBottom: 2,
  },
  edgeTeamHighlight: {
    fontWeight: FontWeight.heavy,
  },
  edgeOverallDesc: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    lineHeight: 18,
  },
  edgeRows: {
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  edgeRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  edgeIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  edgeRowText: {
    flex: 1,
  },
  edgeRowTitle: {
    color: Colors.textPrimary,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    marginBottom: 2,
  },
  edgeRowDesc: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    lineHeight: 17,
  },
  edgeDivider: {
    height: 1,
    backgroundColor: Colors.divider,
    marginHorizontal: Spacing.lg,
  },
  comparisonContainer: {
    backgroundColor: Colors.cardBg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
  },
  comparisonHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.xs,
  },
  compTeamLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  compTeamRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  compTeamDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  compTeamName: {
    color: Colors.textPrimary,
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
  },
  compTeamRecord: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
  },
  compDivider: {
    height: 1,
    backgroundColor: Colors.divider,
    marginBottom: Spacing.sm,
  },
  mirrorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
  },
  mirrorLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  mirrorRight: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: Spacing.sm,
  },
  mirrorCenter: {
    width: 56,
    alignItems: 'center',
  },
  mirrorLabel: {
    color: Colors.textMuted,
    fontSize: 10,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.3,
  },
  mirrorDiff: {
    color: Colors.textMuted,
    fontSize: 8,
    marginTop: 1,
  },
  mirrorValue: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    fontVariant: ['tabular-nums'] as const,
    minWidth: 40,
    textAlign: 'center',
  },
  mirrorBarTrack: {
    flex: 1,
    height: 4,
    backgroundColor: 'rgba(148,163,184,0.08)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  mirrorBarFillLeft: {
    height: 4,
    borderRadius: 2,
    alignSelf: 'flex-end',
  },
  mirrorBarFillRight: {
    height: 4,
    borderRadius: 2,
  },
  contextCard: {
    backgroundColor: Colors.cardBg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  contextRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  contextSide: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  contextDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  contextTeam: {
    color: Colors.textPrimary,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
  },
  contextRole: {
    color: Colors.textMuted,
    fontSize: 9,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.5,
  },
  contextRating: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.heavy,
    fontVariant: ['tabular-nums'] as const,
  },
  contextVs: {
    width: 32,
    alignItems: 'center',
  },
  contextVsText: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
  },
  contextEdgeBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  contextEdgeIndicator: {
    width: 3,
    height: 14,
    borderRadius: 2,
  },
  contextEdgeText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
  },
  playerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.xs,
  },
  playerHeaderSide: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
  },
  playerHeaderDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  playerHeaderTeam: {
    color: Colors.textPrimary,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
  },
  playerHeaderVs: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    marginHorizontal: Spacing.md,
  },
  playerCard: {
    backgroundColor: Colors.cardBg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  playerCardFirst: {
    borderColor: Colors.glassBorder,
    borderWidth: 1,
  },
  playerNames: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  playerNameLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
  },
  playerNameRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
    justifyContent: 'flex-end',
  },
  posChip: {
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  posChipText: {
    fontSize: 9,
    fontWeight: FontWeight.bold,
  },
  playerName: {
    color: Colors.textPrimary,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    maxWidth: 90,
  },
  playerStatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  playerStatVal: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    fontVariant: ['tabular-nums'] as const,
    width: 54,
  },
  playerStatLabel: {
    color: Colors.textMuted,
    fontSize: 10,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.5,
    textAlign: 'center',
    flex: 1,
  },
  runAnalyticsSection: {
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
    gap: 4,
  },
  runAnalyticsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  runAnalyticLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    flex: 1,
  },
  runAnalyticRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    flex: 1,
    justifyContent: 'flex-end',
  },
  runAnalyticCenter: {
    color: Colors.textMuted,
    fontSize: 9,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.3,
    textAlign: 'center',
    flex: 1,
  },
  runAnalyticValue: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.heavy,
    fontVariant: ['tabular-nums'] as const,
  },
  runAnalyticSmall: {
    color: Colors.textMuted,
    fontSize: 8,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.3,
  },
  runTags: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.sm,
  },
  runTag: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.sm,
  },
  runTagText: {
    fontSize: 9,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.3,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.xs,
  },
  legendText: {
    color: Colors.textMuted,
    fontSize: 9,
  },
});
