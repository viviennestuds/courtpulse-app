import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Zap, ChevronDown, ChevronUp, TrendingDown } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { Spacing, BorderRadius, FontSize, FontWeight } from '@/constants/theme';
import { ScoringRun, ScoringDrought, StretchMode, DroughtLineupPhase } from '@/types';
import PhaseEventsSheet from '@/components/PhaseEventsSheet';

interface Props {
  stretch: ScoringRun | ScoringDrought;
  mode: StretchMode;
  showContextStats?: boolean;
  enablePhaseSheet?: boolean;
}

function isRun(stretch: ScoringRun | ScoringDrought, mode: StretchMode): stretch is ScoringRun {
  return mode === 'run';
}

function formatPct(n: number | null): string {
  if (n == null) return '—';
  return n.toFixed(2);
}

export default function StretchCard({ stretch, mode, showContextStats = true, enablePhaseSheet = true }: Props) {
  const [phasesExpanded, setPhasesExpanded] = useState<boolean>(false);
  const [activePhase, setActivePhase] = useState<DroughtLineupPhase | null>(null);

  const lineupContext = stretch.lineupContext;
  const contextStats = stretch.contextStats;
  const teamAbbr = stretch.teamAbbr;

  const phases = lineupContext?.phases ?? [];
  const hasPhases = phases.length > 1;
  const hasSinglePhase = phases.length === 1;

  const highlight = stretch.highlightText
    ?? (mode === 'run' ? (stretch as ScoringRun).keyPlay : undefined);

  const labelColor = mode === 'run' ? Colors.warning : Colors.negative;
  const labelText = mode === 'run' ? 'Run' : 'Drought';

  const timeRange = `Q${stretch.period} · ${stretch.startClock} → ${stretch.endClock}`;

  const coreStats = useMemo(() => {
    if (isRun(stretch, mode)) {
      const run = stretch;
      return [
        { label: 'Net', value: `+${run.netPoints}`, color: Colors.positive },
        { label: 'Plays', value: String(run.playCount) },
        { label: 'Time', value: run.duration },
      ];
    }
    const drought = stretch as ScoringDrought;
    const teamPts = drought.contextStats?.points ?? 0;
    return [
      { label: 'Duration', value: drought.duration },
      { label: 'Pts', value: String(teamPts), color: teamPts > 0 ? Colors.textPrimary : Colors.textMuted },
      { label: 'Opp Pts', value: String(drought.opponentPoints), color: Colors.negative },
    ];
  }, [stretch, mode]);

  return (
    <View style={styles.card} testID={`stretch-${stretch.id}`}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {mode === 'run' && <Zap size={14} color={Colors.warning} fill={Colors.warning} />}
          {mode === 'drought' && <TrendingDown size={14} color={Colors.negative} />}
          {isRun(stretch, mode) && (
            <View style={[styles.teamDot, { backgroundColor: stretch.teamColor }]} />
          )}
          <Text style={styles.teamBadge}>{teamAbbr}</Text>
          <Text style={[styles.label, { color: labelColor }]}>{labelText}</Text>
          {isRun(stretch, mode) && (
            <Text style={styles.runScore}>{stretch.totalPoints}-{stretch.opponentPoints}</Text>
          )}
        </View>
        <Text style={styles.meta}>{timeRange}</Text>
      </View>

      {isRun(stretch, mode) && (
        <Text style={styles.scoreChange}>{stretch.scoreChange}</Text>
      )}

      <View style={styles.statsRow}>
        {coreStats.map((s, i) => (
          <View key={i} style={styles.statItem}>
            <Text style={[styles.statValue, s.color ? { color: s.color } : null]}>{s.value}</Text>
            <Text style={styles.statLabel}>{s.label}</Text>
          </View>
        ))}
      </View>

      {highlight && (
        <View style={styles.highlightWrap}>
          <Text style={[styles.highlightText, mode === 'drought' ? { color: Colors.positive } : { color: Colors.textSecondary }]}>
            {highlight}
          </Text>
        </View>
      )}

      {showContextStats && contextStats && (contextStats.fga > 0 || contextStats.assists > 0 || contextStats.turnovers > 0) && (
        <View style={styles.ctxRow}>
          <View style={styles.ctxItem}>
            <Text style={styles.ctxValue}>{formatPct(contextStats.ppo)}</Text>
            <Text style={styles.ctxLabel}>PPO</Text>
          </View>
          <View style={styles.ctxItem}>
            <Text style={styles.ctxValue}>{contextStats.assists}/{contextStats.turnovers}</Text>
            <Text style={styles.ctxLabel}>Ast/TO</Text>
          </View>
          <View style={styles.ctxItem}>
            <Text style={styles.ctxValue}>{contextStats.fgm}/{contextStats.fga}</Text>
            <Text style={styles.ctxLabel}>FG</Text>
          </View>
        </View>
      )}

      {showContextStats && contextStats && contextStats.playFinishers.length > 0 && (() => {
        const maxShare = Math.max(...contextStats.playFinishers.map(f => f.share), 1);
        return (
          <View style={styles.finishersBlock}>
            <Text style={styles.finishersLabel}>PLAY-FINISHING SHARE</Text>
            <View style={styles.finishersList}>
              {contextStats.playFinishers.map((f, i) => (
                <View key={i} style={styles.finisherRow}>
                  <Text style={styles.finisherRowName} numberOfLines={1}>{f.name}</Text>
                  <View style={styles.finisherBarTrack}>
                    <View
                      style={[
                        styles.finisherBarFill,
                        {
                          width: `${Math.max(4, (f.share / maxShare) * 100)}%`,
                          backgroundColor: mode === 'run' ? Colors.warning : Colors.textSecondary,
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.finisherRowShare}>{f.share}%</Text>
                  <Text style={styles.finisherRowPts}>{f.points}<Text style={styles.finisherRowPtsUnit}> pts</Text></Text>
                </View>
              ))}
            </View>
          </View>
        );
      })()}

      {lineupContext && lineupContext.primaryLineup.length === 5 && (
        <View style={styles.lineupSection}>
          <TouchableOpacity
            style={styles.lineupHeader}
            disabled={!(hasSinglePhase && enablePhaseSheet)}
            activeOpacity={0.7}
            onPress={() => {
              if (hasSinglePhase && enablePhaseSheet) setActivePhase(phases[0]);
            }}
            testID={`stretch-primary-lineup-${stretch.id}`}
          >
            <Text style={styles.lineupTitle}>PRIMARY LINEUP</Text>
            <View style={styles.lineupHeaderRight}>
              {lineupContext.primaryLineupMinuteShare > 0 && (
                <Text style={styles.lineupShare}>
                  {lineupContext.primaryLineupMinuteShare}% share
                </Text>
              )}
              {hasSinglePhase && enablePhaseSheet && (
                <ChevronDown size={12} color={Colors.primary} style={{ transform: [{ rotate: '-90deg' }] }} />
              )}
            </View>
          </TouchableOpacity>
          <View style={styles.lineupPlayers}>
            {lineupContext.primaryLineup.map((p, i) => (
              <View key={i} style={[styles.lineupChip, mode === 'drought' && styles.lineupChipDrought]}>
                <Text style={styles.lineupChipText}>{p}</Text>
              </View>
            ))}
          </View>

          {lineupContext.substitutionCount > 0 && (
            <View style={styles.subsBadge}>
              <Text style={styles.subsText}>
                {lineupContext.substitutionCount} lineup change{lineupContext.substitutionCount !== 1 ? 's' : ''}
              </Text>
            </View>
          )}

          {hasPhases && (
            <TouchableOpacity
              style={styles.expandBtn}
              onPress={() => setPhasesExpanded(v => !v)}
              activeOpacity={0.7}
              testID={`stretch-expand-${stretch.id}`}
            >
              <Text style={styles.expandText}>
                {phasesExpanded ? 'Hide lineup phases' : `Show lineup phases (${phases.length})`}
              </Text>
              {phasesExpanded ? <ChevronUp size={12} color={Colors.primary} /> : <ChevronDown size={12} color={Colors.primary} />}
            </TouchableOpacity>
          )}

          {phasesExpanded && phases.map((phase, idx) => (
            <TouchableOpacity
              key={idx}
              style={styles.phaseRow}
              onPress={() => enablePhaseSheet && setActivePhase(phase)}
              activeOpacity={0.7}
              testID={`stretch-phase-${stretch.id}-${idx}`}
            >
              <View style={styles.phaseTime}>
                <Text style={styles.phaseTimeText}>
                  {phase.startClock} → {phase.endClock}
                </Text>
                {phase.events && phase.events.length > 0 && (
                  <Text style={styles.phaseEventsCount}>{phase.events.length} events</Text>
                )}
              </View>
              <View style={styles.phasePlayers}>
                {phase.players.map((p, pi) => (
                  <Text key={pi} style={styles.phasePlayerText}>{p}</Text>
                ))}
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <PhaseEventsSheet
        visible={!!activePhase}
        onClose={() => setActivePhase(null)}
        phase={activePhase}
        mode={mode}
        teamAbbr={teamAbbr}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
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
    gap: 6,
    flexShrink: 1,
  },
  teamDot: { width: 8, height: 8, borderRadius: 4 },
  teamBadge: {
    color: Colors.textPrimary,
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
  },
  label: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  runScore: {
    color: Colors.warning,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
  },
  meta: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
  },
  scoreChange: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    marginBottom: Spacing.sm,
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
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
  highlightWrap: {
    marginTop: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  highlightText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    fontStyle: 'italic' as const,
    lineHeight: 18,
  },
  ctxRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
    marginTop: Spacing.md,
  },
  ctxItem: {
    flex: 1,
    backgroundColor: Colors.surfaceLight,
    borderRadius: BorderRadius.sm,
    paddingVertical: Spacing.xs,
    alignItems: 'center',
  },
  ctxValue: {
    color: Colors.textPrimary,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    fontVariant: ['tabular-nums'] as const,
  },
  ctxLabel: {
    color: Colors.textMuted,
    fontSize: 10,
    fontWeight: FontWeight.semibold,
    letterSpacing: 0.5,
    marginTop: 2,
  },
  finishersBlock: {
    marginTop: Spacing.md,
  },
  finishersLabel: {
    color: Colors.textMuted,
    fontSize: 9,
    fontWeight: FontWeight.bold,
    letterSpacing: 1.2,
    marginBottom: Spacing.xs,
  },
  finishersList: {
    gap: 6,
  },
  finisherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  finisherRowName: {
    color: Colors.textPrimary,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
    width: 90,
  },
  finisherBarTrack: {
    flex: 1,
    height: 6,
    backgroundColor: Colors.surfaceLight,
    borderRadius: 3,
    overflow: 'hidden',
  },
  finisherBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  finisherRowShare: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
    width: 36,
    textAlign: 'right',
    fontVariant: ['tabular-nums'] as const,
  },
  finisherRowPts: {
    color: Colors.textPrimary,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    width: 44,
    textAlign: 'right',
    fontVariant: ['tabular-nums'] as const,
  },
  finisherRowPtsUnit: {
    color: Colors.textMuted,
    fontWeight: FontWeight.medium,
  },
  lineupSection: {
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  lineupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  lineupHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  lineupTitle: {
    color: Colors.textMuted,
    fontSize: 9,
    fontWeight: FontWeight.bold,
    letterSpacing: 1.2,
  },
  lineupShare: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
  },
  lineupPlayers: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  lineupChip: {
    backgroundColor: Colors.surfaceLight,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.sm,
  },
  lineupChipDrought: {
    backgroundColor: Colors.negativeMuted,
  },
  lineupChipText: {
    color: Colors.textSecondary,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
  },
  subsBadge: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.warningMuted,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.sm,
  },
  subsText: {
    color: Colors.warning,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
  },
  expandBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  expandText: {
    color: Colors.primary,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
  },
  phaseRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  phaseTime: {
    minWidth: 80,
  },
  phaseTimeText: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontVariant: ['tabular-nums'] as const,
  },
  phaseEventsCount: {
    color: Colors.primary,
    fontSize: 10,
    marginTop: 2,
    fontWeight: FontWeight.semibold,
  },
  phasePlayers: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 3,
  },
  phasePlayerText: {
    color: Colors.textSecondary,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
  },
});
