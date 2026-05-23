import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Modal, Pressable, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, TrendingUp, TrendingDown, Shield, Target, BarChart3, Activity, User } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { Spacing, BorderRadius, FontSize, FontWeight } from '@/constants/theme';
import { OnCourtDetailedStats, GameFlowContext, OnOffRatingStats, OnCourtConfidence } from '@/types';
import type { OnCourtValidationSnapshot } from '@/types/metricValidation';
import type { StatTrace, StatTraceRegistry } from '@/types/statTrace';
import type { ExternalValidationComparison } from '@/types/pbpStatsValidation';
import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import { formatPossessionSample } from '@/utils/metricValidation';
import { usePbpStatsValidation } from '@/services/pbpStatsValidation';
import PossessionAuditSheet from '@/components/PossessionAuditSheet';
import {
  buildOffensiveRatingTrace,
  buildDefensiveRatingTrace,
  buildNetRatingTrace,
  buildOnOffTrace,
  getStatConfidence,
  statTraceHasDrift,
} from '@/utils/statTrace';

interface OnCourtSummaryDetailSheetProps {
  visible: boolean;
  onClose: () => void;
  stats: OnCourtDetailedStats | null;
  playerNames: string[];
  gameFlowContext?: GameFlowContext | null;
  onOffStats?: OnOffRatingStats | null;
  confidence?: OnCourtConfidence | null;
  validationSnapshot?: OnCourtValidationSnapshot | null;
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

function TurnoverDisplay({ forced, total }: { forced: number; total: number }) {
  return (
    <View style={styles.statRow}>
      <Text style={styles.statRowLabel}>Turnovers</Text>
      <Text style={styles.statRowValue}>
        <Text style={styles.forcedTov}>({forced})</Text> {total}
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

function CoreStatsGrid({ stats }: { stats: OnCourtDetailedStats }) {
  const pmColor = stats.plusMinus >= 0 ? Colors.positive : Colors.negative;
  const netColor = stats.netRating >= 0 ? Colors.positive : Colors.negative;

  return (
    <View style={styles.coreGrid}>
      <View style={styles.coreGridRow}>
        <View style={styles.coreGridCell}>
          <Text style={styles.coreGridValue}>{stats.minutes}</Text>
          <Text style={styles.coreGridLabel}>MIN</Text>
        </View>
        <View style={styles.coreGridCell}>
          <Text style={styles.coreGridValue}>{stats.possessions}</Text>
          <Text style={styles.coreGridLabel}>POSS</Text>
        </View>
        <View style={styles.coreGridCell}>
          <Text style={styles.coreGridValue}>{stats.points}</Text>
          <Text style={styles.coreGridLabel}>PTS</Text>
        </View>
        <View style={styles.coreGridCell}>
          <Text style={styles.coreGridValue}>{stats.pointsAllowed}</Text>
          <Text style={styles.coreGridLabel}>PTS ALW</Text>
        </View>
      </View>
      <View style={styles.coreGridRow}>
        <View style={styles.coreGridCell}>
          <Text style={[styles.coreGridValue, { color: pmColor }]}>
            {stats.plusMinus > 0 ? '+' : ''}{stats.plusMinus}
          </Text>
          <Text style={styles.coreGridLabel}>+/-</Text>
        </View>
        <View style={styles.coreGridCell}>
          <Text style={styles.coreGridValue}>{stats.offRating.toFixed(1)}</Text>
          <Text style={styles.coreGridLabel}>ORtg</Text>
        </View>
        <View style={styles.coreGridCell}>
          <Text style={styles.coreGridValue}>{stats.defRating.toFixed(1)}</Text>
          <Text style={styles.coreGridLabel}>DRtg</Text>
        </View>
        <View style={styles.coreGridCell}>
          <Text style={[styles.coreGridValue, { color: netColor }]}>
            {stats.netRating >= 0 ? '+' : ''}{stats.netRating.toFixed(1)}
          </Text>
          <Text style={styles.coreGridLabel}>NET</Text>
        </View>
      </View>
    </View>
  );
}

function GameFlowContextSection({ context }: { context: GameFlowContext }) {
  return (
    <View style={styles.statSection}>
      <StatRow label="Runs featured in" value={context.teamRunsCount} />
      <StatRow label="Droughts featured in" value={context.teamDroughtsCount} />
      <StatRow label="Opp. runs featured in" value={context.opponentRunsCount} />
      <StatRow label="Opp. droughts featured in" value={context.opponentDroughtsCount} />
    </View>
  );
}

function OnOffSection({ onOff, confidence }: { onOff: OnOffRatingStats; confidence?: OnCourtConfidence | null }) {
  const formatRating = (val: number | null): string => {
    if (val === null) return '\u2014';
    return `${val >= 0 ? '+' : ''}${val.toFixed(1)}`;
  };
  const ratingColor = (val: number | null): string | undefined => {
    if (val === null) return Colors.textMuted;
    return val >= 0 ? Colors.positive : Colors.negative;
  };

  return (
    <View style={styles.statSection}>
      <View style={styles.onOffCompareRow}>
        <View style={styles.onOffCompareCell} />
        <View style={styles.onOffCompareHeaderCell}>
          <Text style={styles.onOffCompareHeaderText}>ON</Text>
        </View>
        <View style={styles.onOffCompareHeaderCell}>
          <Text style={styles.onOffCompareHeaderText}>OFF</Text>
        </View>
      </View>
      <View style={styles.onOffCompareRow}>
        <View style={styles.onOffCompareCell}>
          <Text style={styles.onOffCompareLabelText}>Minutes</Text>
        </View>
        <View style={styles.onOffCompareValueCell}>
          <Text style={styles.onOffCompareValueText}>{onOff.onMinutes}</Text>
        </View>
        <View style={styles.onOffCompareValueCell}>
          <Text style={styles.onOffCompareValueText}>{onOff.offMinutes}</Text>
        </View>
      </View>
      <View style={styles.onOffCompareRow}>
        <View style={styles.onOffCompareCell}>
          <Text style={styles.onOffCompareLabelText}>Poss</Text>
        </View>
        <View style={styles.onOffCompareValueCell}>
          <Text style={styles.onOffCompareValueText}>{onOff.onPossessions}</Text>
        </View>
        <View style={styles.onOffCompareValueCell}>
          <Text style={styles.onOffCompareValueText}>{onOff.offPossessions}</Text>
        </View>
      </View>
      <View style={styles.onOffCompareRow}>
        <View style={styles.onOffCompareCell}>
          <Text style={styles.onOffCompareLabelText}>ORtg</Text>
        </View>
        <View style={styles.onOffCompareValueCell}>
          <Text style={styles.onOffCompareValueText}>{formatRating(onOff.onOffensiveRating)}</Text>
        </View>
        <View style={styles.onOffCompareValueCell}>
          <Text style={styles.onOffCompareValueText}>{formatRating(onOff.offOffensiveRating)}</Text>
        </View>
      </View>
      <View style={styles.onOffCompareRow}>
        <View style={styles.onOffCompareCell}>
          <Text style={styles.onOffCompareLabelText}>DRtg</Text>
        </View>
        <View style={styles.onOffCompareValueCell}>
          <Text style={styles.onOffCompareValueText}>{formatRating(onOff.onDefensiveRating)}</Text>
        </View>
        <View style={styles.onOffCompareValueCell}>
          <Text style={styles.onOffCompareValueText}>{formatRating(onOff.offDefensiveRating)}</Text>
        </View>
      </View>
      <View style={styles.onOffCompareRow}>
        <View style={styles.onOffCompareCell}>
          <Text style={styles.onOffCompareLabelText}>Net</Text>
        </View>
        <View style={styles.onOffCompareValueCell}>
          <Text style={[styles.onOffCompareValueText, { color: ratingColor(onOff.onNetRating) }]}>
            {formatRating(onOff.onNetRating)}
          </Text>
        </View>
        <View style={styles.onOffCompareValueCell}>
          <Text style={[styles.onOffCompareValueText, { color: ratingColor(onOff.offNetRating) }]}>
            {formatRating(onOff.offNetRating)}
          </Text>
        </View>
      </View>
      <View style={styles.onOffSummaryRow}>
        <Text style={styles.onOffSummaryLabel}>On/Off</Text>
        <Text style={[styles.onOffSummaryValue, { color: ratingColor(onOff.onOffRating) }]}>
          {formatRating(onOff.onOffRating)}
        </Text>
      </View>
      {onOff.onOffConfidenceLevel === 'none' && (
        <Text style={styles.onOffUnavailableText}>Not enough off-court sample</Text>
      )}
    </View>
  );
}

function formatRtg(val: number | null | undefined): string {
  if (val === null || val === undefined) return '\u2014';
  return `${val >= 0 ? '+' : ''}${val.toFixed(1)}`;
}

function DebugRow({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={styles.debugRow}>
      <Text style={styles.debugLabel}>{label}</Text>
      <Text style={styles.debugValue}>{value}</Text>
    </View>
  );
}

function DebugPanel({ snapshot }: { snapshot: OnCourtValidationSnapshot }) {
  return (
    <View style={styles.debugPanel}>
      <Text style={styles.debugTitle}>DEBUG METRIC AUDIT</Text>
      <DebugRow label="Source" value={snapshot.source} />
      <DebugRow label="Player ID" value={snapshot.playerId || '\u2014'} />
      <DebugRow label="Team ID" value={snapshot.teamId || '\u2014'} />
      <DebugRow label="Game ID" value={snapshot.gameId || '\u2014'} />
      <View style={styles.debugDivider} />
      <DebugRow label="ON minutes" value={snapshot.on.minutes} />
      <DebugRow label="OFF minutes" value={snapshot.off.minutes} />
      <DebugRow label="ON possessions" value={snapshot.on.possessions} />
      <DebugRow label="OFF possessions" value={snapshot.off.possessions} />
      <View style={styles.debugDivider} />
      <DebugRow label="ON PF / PA" value={`${snapshot.on.pointsFor} / ${snapshot.on.pointsAgainst}`} />
      <DebugRow label="OFF PF / PA" value={`${snapshot.off.pointsFor} / ${snapshot.off.pointsAgainst}`} />
      <View style={styles.debugDivider} />
      <DebugRow label="ON ORtg" value={formatRtg(snapshot.on.offRtg)} />
      <DebugRow label="ON DRtg" value={formatRtg(snapshot.on.defRtg)} />
      <DebugRow label="ON Net" value={formatRtg(snapshot.on.netRtg)} />
      <DebugRow label="OFF ORtg" value={formatRtg(snapshot.off.offRtg)} />
      <DebugRow label="OFF DRtg" value={formatRtg(snapshot.off.defRtg)} />
      <DebugRow label="OFF Net" value={formatRtg(snapshot.off.netRtg)} />
      <View style={styles.debugDivider} />
      <DebugRow label="On/Off Net" value={formatRtg(snapshot.onOffNet)} />
      <DebugRow label="Confidence" value={snapshot.confidence} />
      {snapshot.likelyIssue && <DebugRow label="Likely issue" value={snapshot.likelyIssue} />}
    </View>
  );
}

function formatTraceValue(value: number | string | null): string {
  if (value === null || value === undefined) return '\u2014';
  if (typeof value === 'string') return value;
  if (!Number.isFinite(value)) return '\u2014';
  return Number.isInteger(value) ? String(value) : value.toFixed(3);
}

function StatTraceItem({ trace, showWarnings }: { trace: StatTrace; showWarnings: boolean }) {
  const drift = showWarnings && statTraceHasDrift(trace);
  return (
    <View style={styles.statTraceItem}>
      <Text style={styles.statTraceLabel}>{trace.label}</Text>
      <DebugRow label="Displayed" value={formatTraceValue(trace.displayedValue)} />
      <DebugRow label="Computed" value={formatTraceValue(trace.computedValue)} />
      <DebugRow label="Formula" value={trace.formula} />
      {trace.inputs.map((input) => (
        <DebugRow
          key={input.key}
          label={input.label}
          value={Number.isInteger(input.value) ? input.value : input.value.toFixed(3)}
        />
      ))}
      <DebugRow label="Confidence" value={trace.confidence} />
      {trace.notes?.map((note, idx) => (
        <Text key={idx} style={styles.statTraceNote}>{note}</Text>
      ))}
      {drift && (
        <Text style={styles.statTraceWarning}>Displayed value differs from computed value</Text>
      )}
    </View>
  );
}

function formatDelta(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '\u2014';
  const sign = value > 0 ? '+' : '';
  const abs = Math.abs(value);
  const formatted = abs >= 10 || Number.isInteger(value) ? value.toFixed(1) : value.toFixed(2);
  return `${sign}${formatted}`;
}

function formatNum(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '\u2014';
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function CompareRow({
  label,
  cp,
  pbp,
  delta,
}: {
  label: string;
  cp: number | null | undefined;
  pbp: number | null | undefined;
  delta: number | null | undefined;
}) {
  return (
    <View style={styles.compareRow}>
      <Text style={styles.compareLabel}>{label}</Text>
      <Text style={styles.compareCell}>{formatNum(cp)}</Text>
      <Text style={styles.compareCell}>{formatNum(pbp)}</Text>
      <Text style={styles.compareDeltaCell}>{formatDelta(delta)}</Text>
    </View>
  );
}

function ExternalValidationPanel({
  comparison,
  endpoint,
  showAuditEntry,
  onOpenAudit,
}: {
  comparison: ExternalValidationComparison | null;
  endpoint: string | null;
  showAuditEntry: boolean;
  onOpenAudit: () => void;
}) {
  return (
    <View style={styles.debugPanel}>
      <Text style={styles.debugTitle}>EXTERNAL VALIDATION</Text>
      <DebugRow label="Source" value="PBPStats" />
      <DebugRow label="Status" value={comparison?.status ?? 'idle'} />
      {endpoint && <DebugRow label="Endpoint" value={endpoint} />}
      <Text style={styles.statTraceNote}>
        If this endpoint succeeds, it may represent season/playoff on-off data rather than single-game on-off data unless PBPStats supports GameId for this endpoint.
      </Text>
      {comparison?.courtPulseSnapshot && (
        <>
          <DebugRow label="Player ID" value={comparison.courtPulseSnapshot.playerId || '\u2014'} />
          <DebugRow label="Team ID" value={comparison.courtPulseSnapshot.teamId || '\u2014'} />
          <DebugRow label="Game ID" value={comparison.courtPulseSnapshot.gameId || '\u2014'} />
        </>
      )}

      {comparison?.status === 'loading' && (
        <Text style={styles.statTraceNote}>Fetching PBPStats comparison\u2026</Text>
      )}

      {comparison?.status === 'unavailable' && (
        <>
          <Text style={styles.statTraceWarning}>PBPStats validation unavailable</Text>
          {comparison.notes.map((n, i) => (
            <Text key={i} style={styles.statTraceNote}>{n}</Text>
          ))}
        </>
      )}

      {comparison?.status === 'error' && (
        <>
          <Text style={styles.statTraceWarning}>PBPStats validation unavailable</Text>
          {comparison.error?.message && (
            <Text style={styles.statTraceNote}>{comparison.error.message}</Text>
          )}
          {comparison.error?.statusCode !== undefined && (
            <DebugRow label="HTTP" value={comparison.error.statusCode} />
          )}
        </>
      )}

      {showAuditEntry && (
        <TouchableOpacity
          onPress={onOpenAudit}
          style={styles.openAuditButton}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.openAuditButtonText}>Open Possession Audit</Text>
        </TouchableOpacity>
      )}

      {comparison?.status === 'success' && comparison.pbpStatsSnapshot && comparison.delta && (
        <>
          <View style={styles.debugDivider} />
          <View style={styles.compareHeaderRow}>
            <Text style={styles.compareLabel}> </Text>
            <Text style={styles.compareHeaderCell}>CP</Text>
            <Text style={styles.compareHeaderCell}>PBP</Text>
            <Text style={styles.compareHeaderCell}>\u0394</Text>
          </View>
          <CompareRow
            label="ON minutes"
            cp={comparison.courtPulseSnapshot.on.minutes}
            pbp={comparison.pbpStatsSnapshot.on.minutes}
            delta={comparison.delta.minutesOnDelta}
          />
          <CompareRow
            label="OFF minutes"
            cp={comparison.courtPulseSnapshot.off.minutes}
            pbp={comparison.pbpStatsSnapshot.off.minutes}
            delta={comparison.delta.minutesOffDelta}
          />
          <CompareRow
            label="ON poss"
            cp={comparison.courtPulseSnapshot.on.possessions}
            pbp={comparison.pbpStatsSnapshot.on.possessions}
            delta={comparison.delta.possessionsOnDelta}
          />
          <CompareRow
            label="OFF poss"
            cp={comparison.courtPulseSnapshot.off.possessions}
            pbp={comparison.pbpStatsSnapshot.off.possessions}
            delta={comparison.delta.possessionsOffDelta}
          />
          <CompareRow
            label="ON PF"
            cp={comparison.courtPulseSnapshot.on.pointsFor}
            pbp={comparison.pbpStatsSnapshot.on.pointsFor}
            delta={comparison.delta.pointsForOnDelta}
          />
          <CompareRow
            label="ON PA"
            cp={comparison.courtPulseSnapshot.on.pointsAgainst}
            pbp={comparison.pbpStatsSnapshot.on.pointsAgainst}
            delta={comparison.delta.pointsAgainstOnDelta}
          />
          <CompareRow
            label="OFF PF"
            cp={comparison.courtPulseSnapshot.off.pointsFor}
            pbp={comparison.pbpStatsSnapshot.off.pointsFor}
            delta={comparison.delta.pointsForOffDelta}
          />
          <CompareRow
            label="OFF PA"
            cp={comparison.courtPulseSnapshot.off.pointsAgainst}
            pbp={comparison.pbpStatsSnapshot.off.pointsAgainst}
            delta={comparison.delta.pointsAgainstOffDelta}
          />
          <CompareRow
            label="ON ORtg"
            cp={comparison.courtPulseSnapshot.on.offRtg}
            pbp={comparison.pbpStatsSnapshot.on.offRtg}
            delta={comparison.delta.offRtgOnDelta}
          />
          <CompareRow
            label="ON DRtg"
            cp={comparison.courtPulseSnapshot.on.defRtg}
            pbp={comparison.pbpStatsSnapshot.on.defRtg}
            delta={comparison.delta.defRtgOnDelta}
          />
          <CompareRow
            label="ON Net"
            cp={comparison.courtPulseSnapshot.on.netRtg}
            pbp={comparison.pbpStatsSnapshot.on.netRtg}
            delta={comparison.delta.netRtgOnDelta}
          />
          <CompareRow
            label="OFF ORtg"
            cp={comparison.courtPulseSnapshot.off.offRtg}
            pbp={comparison.pbpStatsSnapshot.off.offRtg}
            delta={comparison.delta.offRtgOffDelta}
          />
          <CompareRow
            label="OFF DRtg"
            cp={comparison.courtPulseSnapshot.off.defRtg}
            pbp={comparison.pbpStatsSnapshot.off.defRtg}
            delta={comparison.delta.defRtgOffDelta}
          />
          <CompareRow
            label="OFF Net"
            cp={comparison.courtPulseSnapshot.off.netRtg}
            pbp={comparison.pbpStatsSnapshot.off.netRtg}
            delta={comparison.delta.netRtgOffDelta}
          />
          <CompareRow
            label="On/Off Net"
            cp={comparison.courtPulseSnapshot.onOffNet}
            pbp={comparison.pbpStatsSnapshot.onOffNet}
            delta={comparison.delta.onOffNetDelta}
          />
          {comparison.likelyIssues.length > 0 && (
            <>
              <View style={styles.debugDivider} />
              <Text style={styles.debugLabel}>Likely Issues</Text>
              {comparison.likelyIssues.map((issue) => (
                <Text key={issue} style={styles.debugValue}>\u2022 {issue}</Text>
              ))}
            </>
          )}
          {comparison.notes.length > 0 && (
            <>
              <View style={styles.debugDivider} />
              {comparison.notes.map((n, i) => (
                <Text key={i} style={styles.statTraceNote}>{n}</Text>
              ))}
            </>
          )}
        </>
      )}
    </View>
  );
}

function StatTracePanel({ registry, showWarnings }: { registry: StatTraceRegistry; showWarnings: boolean }) {
  const traces = Object.values(registry);
  return (
    <View style={styles.debugPanel}>
      <Text style={styles.debugTitle}>STAT TRACE</Text>
      {traces.map((trace) => (
        <StatTraceItem key={trace.statKey} trace={trace} showWarnings={showWarnings} />
      ))}
    </View>
  );
}

export default function OnCourtSummaryDetailSheet({
  visible,
  onClose,
  stats,
  playerNames,
  gameFlowContext,
  onOffStats,
  confidence,
  validationSnapshot,
}: OnCourtSummaryDetailSheetProps) {
  const insets = useSafeAreaInsets();
  const sampleLabelsEnabled = useFeatureFlag('enableOnCourtSampleLabels');
  const confidenceLabelsEnabled = useFeatureFlag('enableMetricConfidenceLabels');
  const debugEnabled = useFeatureFlag('enableMetricValidationDebug');
  const statTraceDebugEnabled = useFeatureFlag('enableStatTraceDebug');
  const statTraceWarningsEnabled = useFeatureFlag('enableStatTraceWarnings');
  const externalValidationEnabled = useFeatureFlag('enableExternalPbpStatsValidation');
  const possessionAuditEnabled = useFeatureFlag('enablePossessionAuditDebug');
  const [auditSheetVisible, setAuditSheetVisible] = useState<boolean>(false);

  const { comparison: externalComparison, endpoint: externalEndpoint } = usePbpStatsValidation({
    enabled: externalValidationEnabled && visible,
    snapshot: validationSnapshot ?? null,
  });

  const statTraceRegistry = useMemo<StatTraceRegistry | null>(() => {
    if (!stats) return null;
    const onPoss = onOffStats?.onPossessions ?? stats.possessions;
    const offPoss = onOffStats?.offPossessions ?? 0;
    const confidence = getStatConfidence({ possessions: onPoss, offPossessions: offPoss });

    const offRtgTrace = buildOffensiveRatingTrace({
      pointsFor: stats.points,
      possessions: stats.possessions,
      displayedValue: stats.offRating,
      confidence,
    });
    const defRtgTrace = buildDefensiveRatingTrace({
      pointsAgainst: stats.pointsAllowed,
      possessions: stats.possessions,
      displayedValue: stats.defRating,
      confidence,
    });
    const netRtgTrace = buildNetRatingTrace({
      offRtg: stats.offRating,
      defRtg: stats.defRating,
      displayedValue: stats.netRating,
      confidence,
    });

    const registry: StatTraceRegistry = {
      offRtg: offRtgTrace,
      defRtg: defRtgTrace,
      netRtg: netRtgTrace,
    };

    if (
      onOffStats &&
      onOffStats.onNetRating !== null &&
      onOffStats.offNetRating !== null &&
      onOffStats.onOffRating !== null
    ) {
      registry.onOffNet = buildOnOffTrace({
        onNet: onOffStats.onNetRating,
        offNet: onOffStats.offNetRating,
        displayedValue: onOffStats.onOffRating,
        confidence,
      });
    }

    return registry;
  }, [stats, onOffStats]);

  console.log('[OnCourtDetailSheet] render visible=%s stats=%s playerNames=%s', visible, stats != null, playerNames.join(','));
  if (stats) {
    console.log('[OnCourtDetailSheet] stats snapshot: MIN=%s PTS=%s +/-=%s FG=%s/%s', stats.minutes, stats.points, stats.plusMinus, stats.fgm, stats.fga);
  }

  if (!stats) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.dismiss} onPress={onClose} />
        <View style={[styles.container, { paddingBottom: insets.bottom + Spacing.md }]}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <Text style={styles.headerTitle}>On-Court Detail</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <X size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.playerPills}>
            {playerNames.map((name, idx) => (
              <View key={idx} style={styles.playerPill}>
                <Text style={styles.playerPillText}>{name}</Text>
              </View>
            ))}
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={styles.scrollContent}>
            <SectionHeader
              title="TEAM DURING ON-COURT SAMPLE"
              icon={<TrendingUp size={12} color={Colors.secondary} />}
            />

            <CoreStatsGrid stats={stats} />

            <View style={styles.statSection}>
              <StatRow label="PPP" value={stats.pointsPerPossession.toFixed(3)} />
              <StatRow label="A/TO" value={stats.assistTurnoverRatio !== null ? stats.assistTurnoverRatio.toFixed(2) : '\u2014'} />
            </View>

            <View style={styles.divider} />
            <SectionHeader
              title="SHOOTING"
              icon={<Target size={12} color={Colors.primary} />}
            />
            <View style={styles.statSection}>
              <StatRow label="FG%" value={`${stats.fgm}/${stats.fga}`} suffix={` (${stats.fgPct}%)`} />
              <StatRow label="3PT%" value={`${stats.tpm}/${stats.tpa}`} suffix={` (${stats.tpPct}%)`} />
              <StatRow label="FT%" value={`${stats.ftm}/${stats.fta}`} suffix={` (${stats.ftPct}%)`} />
              <StatRow label="TS%" value={`${stats.tsPct}%`} />
            </View>

            <View style={styles.divider} />
            <SectionHeader
              title="TURNOVERS & ASSISTS"
              icon={<BarChart3 size={12} color={Colors.warning} />}
            />
            <View style={styles.statSection}>
              <StatRow label="Assists" value={stats.assists} />
              <TurnoverDisplay forced={stats.forcedTurnovers} total={stats.turnovers} />
              <StatRow label="A/TO" value={stats.assistTurnoverRatio !== null ? stats.assistTurnoverRatio.toFixed(2) : '\u2014'} />
            </View>

            <View style={styles.divider} />
            <SectionHeader
              title="BALL PRESSURE / DEFENSE"
              icon={<Shield size={12} color={Colors.positive} />}
            />
            <View style={styles.statSection}>
              <StatRow label="Steals" value={stats.steals} />
              <StatRow label="Blocks" value={stats.blocks} />
              <StatRow label="Fastbreak PTS" value={stats.fastbreakPoints} />
            </View>

            <View style={styles.divider} />
            <SectionHeader
              title="REBOUNDING"
              icon={<BarChart3 size={12} color={Colors.accent} />}
            />
            <View style={styles.statSection}>
              <StatRow label="REB%" value={`${stats.reboundPct}%`} />
              <StatRow label="Off. Rebounds" value={stats.offensiveRebounds} />
              <StatRow label="Def. Rebounds" value={stats.defensiveRebounds} />
              <StatRow label="Total Rebounds" value={stats.totalRebounds} />
            </View>

            <View style={styles.oppDivider} />
            <SectionHeader
              title="OPPONENT DURING ON-COURT SAMPLE"
              icon={<TrendingDown size={12} color={Colors.negative} />}
            />

            <View style={styles.statSection}>
              <StatRow label="Opp PPP" value={stats.oppPointsPerPossession.toFixed(3)} />
            </View>

            <View style={styles.divider} />
            <Text style={styles.subSectionLabel}>OPP SHOOTING</Text>
            <View style={styles.statSection}>
              <StatRow label="Opp FG%" value={`${stats.oppFgm}/${stats.oppFga}`} suffix={` (${stats.oppFgPct}%)`} />
              <StatRow label="Opp 3PT%" value={`${stats.oppTpm}/${stats.oppTpa}`} suffix={` (${stats.oppTpPct}%)`} />
              <StatRow label="Opp FT%" value={`${stats.oppFtm}/${stats.oppFta}`} suffix={` (${stats.oppFtPct}%)`} />
              <StatRow label="Opp TS%" value={`${stats.oppTsPct}%`} />
            </View>

            <View style={styles.divider} />
            <Text style={styles.subSectionLabel}>OPP TURNOVERS</Text>
            <View style={styles.statSection}>
              <TurnoverDisplay forced={stats.oppForcedTurnovers} total={stats.oppTurnovers} />
            </View>

            <View style={styles.divider} />
            <Text style={styles.subSectionLabel}>OPP DEFENSE / PRESSURE</Text>
            <View style={styles.statSection}>
              <StatRow label="Opp Steals" value={stats.oppSteals} />
              <StatRow label="Opp Blocks" value={stats.oppBlocks} />
              <StatRow label="Opp Fastbreak PTS" value={stats.oppFastbreakPoints} />
            </View>

            <View style={styles.divider} />
            <Text style={styles.subSectionLabel}>OPP REBOUNDING</Text>
            <View style={styles.statSection}>
              <StatRow label="Opp REB%" value={`${stats.oppReboundPct}%`} />
              <StatRow label="Opp Off. Rebounds" value={stats.oppOffensiveRebounds} />
              <StatRow label="Opp Def. Rebounds" value={stats.oppDefensiveRebounds} />
              <StatRow label="Opp Total Rebounds" value={stats.oppTotalRebounds} />
            </View>

            {playerNames.length === 1 && (stats.usageRate !== null || stats.playFinishingShare !== null) && (
              <>
                <View style={styles.oppDivider} />
                <SectionHeader
                  title="PLAYER CONTEXT"
                  icon={<User size={12} color={Colors.secondary} />}
                />
                <View style={styles.statSection}>
                  {stats.usageRate !== null && (
                    <StatRow label="Usage Rate" value={`${stats.usageRate}%`} />
                  )}
                  {stats.playFinishingShare !== null && (
                    <StatRow label="Play-Finishing Share" value={`${stats.playFinishingShare}%`} />
                  )}
                  <StatRow label="Minutes" value={stats.minutes} />
                  <StatRow label="Possessions" value={stats.possessions} />
                </View>
              </>
            )}

            {onOffStats && (
              <>
                <View style={styles.oppDivider} />
                <SectionHeader
                  title="ON / OFF RATING"
                  icon={<BarChart3 size={12} color={Colors.secondary} />}
                />
                <OnOffSection onOff={onOffStats} confidence={confidence} />
                {sampleLabelsEnabled && (
                  <Text style={styles.possessionSampleText}>
                    Possession sample: {formatPossessionSample(onOffStats.onPossessions, onOffStats.offPossessions)}
                  </Text>
                )}
                {confidenceLabelsEnabled && validationSnapshot && validationSnapshot.confidence === 'low' && (
                  <Text style={styles.smallSampleWarningText}>
                    Small sample — interpret cautiously
                  </Text>
                )}
              </>
            )}

            {debugEnabled && validationSnapshot && (
              <>
                <View style={styles.oppDivider} />
                <DebugPanel snapshot={validationSnapshot} />
              </>
            )}

            {statTraceDebugEnabled && statTraceRegistry && (
              <>
                <View style={styles.oppDivider} />
                <StatTracePanel
                  registry={statTraceRegistry}
                  showWarnings={statTraceWarningsEnabled}
                />
              </>
            )}

            {externalValidationEnabled && (
              <>
                <View style={styles.oppDivider} />
                <ExternalValidationPanel
                  comparison={externalComparison}
                  endpoint={externalEndpoint}
                  showAuditEntry={possessionAuditEnabled}
                  onOpenAudit={() => setAuditSheetVisible(true)}
                />
              </>
            )}

            {possessionAuditEnabled && !externalValidationEnabled && (
              <>
                <View style={styles.oppDivider} />
                <View style={styles.debugPanel}>
                  <Text style={styles.debugTitle}>POSSESSION AUDIT</Text>
                  <TouchableOpacity
                    onPress={() => setAuditSheetVisible(true)}
                    style={styles.openAuditButton}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={styles.openAuditButtonText}>Open Possession Audit</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {gameFlowContext && (
              <>
                <View style={styles.oppDivider} />
                <SectionHeader
                  title="GAME FLOW CONTEXT"
                  icon={<Activity size={12} color={Colors.secondary} />}
                />
                <GameFlowContextSection context={gameFlowContext} />
              </>
            )}

            <View style={{ height: Spacing.xxl }} />
          </ScrollView>
        </View>
      </View>
      {possessionAuditEnabled && (
        <PossessionAuditSheet
          visible={auditSheetVisible}
          onClose={() => setAuditSheetVisible(false)}
          gameId={validationSnapshot?.gameId ?? null}
          teamId={validationSnapshot?.teamId ?? null}
          playerId={validationSnapshot?.playerId ?? null}
          playerName={playerNames.length === 1 ? playerNames[0] : undefined}
          courtPulseSnapshot={validationSnapshot ?? null}
        />
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'flex-end',
  },
  dismiss: {
    flex: 1,
  },
  container: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    maxHeight: '90%',
    paddingHorizontal: Spacing.lg,
    flexShrink: 1,
    overflow: 'hidden' as const,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.divider,
    alignSelf: 'center',
    marginTop: Spacing.md,
    marginBottom: Spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  headerTitle: {
    color: Colors.textPrimary,
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
  },
  playerPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginBottom: Spacing.lg,
  },
  playerPill: {
    backgroundColor: Colors.primaryMuted,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  playerPillText: {
    color: Colors.primary,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
  },
  scrollContent: {
    flexGrow: 1,
    flexShrink: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  sectionHeaderText: {
    color: Colors.textMuted,
    fontSize: 9,
    fontWeight: FontWeight.bold,
    letterSpacing: 1.2,
  },
  coreGrid: {
    backgroundColor: Colors.cardBg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: Spacing.sm,
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  coreGridRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  coreGridCell: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.sm,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
  },
  coreGridValue: {
    color: Colors.textPrimary,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    fontVariant: ['tabular-nums'] as const,
  },
  coreGridLabel: {
    color: Colors.textMuted,
    fontSize: 8,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.5,
    marginTop: 2,
  },
  statSection: {
    backgroundColor: Colors.cardBg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xs,
    marginBottom: Spacing.md,
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
  forcedTov: {
    color: Colors.warning,
    fontWeight: FontWeight.bold,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.divider,
    marginVertical: Spacing.sm,
  },
  oppDivider: {
    height: 2,
    backgroundColor: Colors.negative,
    marginVertical: Spacing.lg,
    opacity: 0.3,
  },
  subSectionLabel: {
    color: Colors.textMuted,
    fontSize: 9,
    fontWeight: FontWeight.bold,
    letterSpacing: 1.2,
    marginBottom: Spacing.sm,
    marginTop: Spacing.xs,
  },
  onOffCompareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
    paddingVertical: Spacing.sm,
  },
  onOffCompareCell: {
    flex: 1,
  },
  onOffCompareHeaderCell: {
    width: 72,
    alignItems: 'center',
  },
  onOffCompareHeaderText: {
    color: Colors.textMuted,
    fontSize: 9,
    fontWeight: FontWeight.bold,
    letterSpacing: 1,
  },
  onOffCompareLabelText: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
  onOffCompareValueCell: {
    width: 72,
    alignItems: 'center',
  },
  onOffCompareValueText: {
    color: Colors.textPrimary,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    fontVariant: ['tabular-nums'] as const,
  },
  onOffSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    marginTop: Spacing.xs,
  },
  onOffSummaryLabel: {
    color: Colors.textPrimary,
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
  },
  onOffSummaryValue: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.heavy,
    fontVariant: ['tabular-nums'] as const,
  },
  onOffUnavailableText: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontStyle: 'italic' as const,
    textAlign: 'center' as const,
    paddingVertical: Spacing.sm,
  },
  possessionSampleText: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    textAlign: 'center' as const,
    marginTop: -Spacing.xs,
    marginBottom: Spacing.sm,
  },
  smallSampleWarningText: {
    color: Colors.warning,
    fontSize: FontSize.xs,
    fontStyle: 'italic' as const,
    textAlign: 'center' as const,
    marginBottom: Spacing.sm,
  },
  debugPanel: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  debugTitle: {
    color: Colors.textMuted,
    fontSize: 9,
    fontWeight: FontWeight.bold,
    letterSpacing: 1.2,
    marginBottom: Spacing.sm,
  },
  debugRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  debugLabel: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
  },
  debugValue: {
    color: Colors.textPrimary,
    fontSize: FontSize.xs,
    fontVariant: ['tabular-nums'] as const,
  },
  debugDivider: {
    height: 1,
    backgroundColor: Colors.divider,
    marginVertical: Spacing.xs,
  },
  statTraceItem: {
    paddingVertical: Spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
    marginBottom: Spacing.xs,
  },
  statTraceLabel: {
    color: Colors.textPrimary,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  statTraceNote: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontStyle: 'italic' as const,
    marginTop: 4,
  },
  statTraceWarning: {
    color: Colors.warning,
    fontSize: FontSize.xs,
    fontStyle: 'italic' as const,
    marginTop: 4,
  },
  compareHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
  },
  compareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
  },
  compareLabel: {
    flex: 1,
    color: Colors.textMuted,
    fontSize: FontSize.xs,
  },
  compareCell: {
    width: 56,
    textAlign: 'right' as const,
    color: Colors.textPrimary,
    fontSize: FontSize.xs,
    fontVariant: ['tabular-nums'] as const,
  },
  compareDeltaCell: {
    width: 56,
    textAlign: 'right' as const,
    color: Colors.warning,
    fontSize: FontSize.xs,
    fontVariant: ['tabular-nums'] as const,
  },
  compareHeaderCell: {
    width: 56,
    textAlign: 'right' as const,
    color: Colors.textMuted,
    fontSize: 9,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.8,
  },
  openAuditButton: {
    marginTop: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.primary,
    alignItems: 'center',
    backgroundColor: Colors.primaryMuted,
  },
  openAuditButtonText: {
    color: Colors.primary,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    letterSpacing: 0.5,
  },
});
