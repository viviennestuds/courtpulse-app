import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Modal, Pressable, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { Spacing, BorderRadius, FontSize, FontWeight } from '@/constants/theme';
import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import type { OnCourtValidationSnapshot } from '@/types/metricValidation';
import type {
  CourtPulsePossessionAuditRow,
  PlayerPossessionAuditSample,
} from '@/types/possessionAudit';
import {
  buildCourtPulsePossessionAuditRows,
  buildPlayerPossessionAuditSample,
  buildPossessionAuditDeltas,
  classifyPossessionAuditIssues,
} from '@/utils/possessionAudit';
import { usePossessionAuditBenchmark } from '@/services/possessionAuditBenchmark';

interface PossessionAuditSheetProps {
  visible: boolean;
  onClose: () => void;
  gameId: string | null;
  teamId: string | null;
  playerId: string | null;
  playerName?: string;
  courtPulseSnapshot?: OnCourtValidationSnapshot | null;
  rawEvents?: unknown[];
  rawLineups?: unknown[];
}

function formatNum(value: number | null | undefined, digits: number = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '\u2014';
  return Number.isInteger(value) ? String(value) : value.toFixed(digits);
}

function formatDelta(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '\u2014';
  const sign = value > 0 ? '+' : '';
  const abs = Math.abs(value);
  const formatted = abs >= 10 || Number.isInteger(value) ? value.toFixed(1) : value.toFixed(2);
  return `${sign}${formatted}`;
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
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.cell}>{formatNum(cp)}</Text>
      <Text style={styles.cell}>{formatNum(pbp)}</Text>
      <Text style={styles.deltaCell}>{formatDelta(delta)}</Text>
    </View>
  );
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function DebugRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.debugRow}>
      <Text style={styles.debugLabel}>{label}</Text>
      <Text style={styles.debugValue} numberOfLines={3}>
        {value}
      </Text>
    </View>
  );
}

function AuditRow({ row }: { row: CourtPulsePossessionAuditRow }) {
  return (
    <View style={styles.eventRow}>
      <Text style={styles.eventTitle}>
        Q{row.period} · {row.startClock ?? '\u2014'} \u2192 {row.endClock ?? '\u2014'}
      </Text>
      <View style={styles.eventMeta}>
        <Text style={styles.eventMetaText}>
          OFF {row.offenseTeamId ?? '\u2014'} · DEF {row.defenseTeamId ?? '\u2014'} · PTS {row.pointsScored}
        </Text>
      </View>
      <Text style={styles.eventMetaText}>End: {row.endingReason}</Text>
      <Text style={styles.eventMetaText}>
        Events: {String(row.startEventId ?? '\u2014')} \u2192 {String(row.endEventId ?? '\u2014')}
      </Text>
      {row.issues.length > 0 && (
        <View style={styles.issuesWrap}>
          {row.issues.map((iss) => (
            <View key={iss} style={styles.issueChip}>
              <Text style={styles.issueChipText}>{iss}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

export default function PossessionAuditSheet({
  visible,
  onClose,
  gameId,
  teamId,
  playerId,
  playerName,
  courtPulseSnapshot,
  rawEvents,
  rawLineups,
}: PossessionAuditSheetProps) {
  const insets = useSafeAreaInsets();
  const flagEnabled = useFeatureFlag('enablePossessionAuditDebug');

  const { state: benchmarkState } = usePossessionAuditBenchmark({
    enabled: visible,
    gameId,
    teamId,
    playerId,
    playerName,
  });

  const auditRows = useMemo<CourtPulsePossessionAuditRow[]>(() => {
    if (!gameId) return [];
    const teamIds: string[] = [];
    if (teamId) teamIds.push(teamId);
    return buildCourtPulsePossessionAuditRows({
      gameId,
      events: rawEvents,
      lineups: rawLineups,
      teamIds,
    });
  }, [gameId, teamId, rawEvents, rawLineups]);

  const courtPulseSample = useMemo<PlayerPossessionAuditSample | null>(() => {
    if (!gameId || !teamId || !playerId) return null;
    const fallback = courtPulseSnapshot
      ? {
          offensivePossessions: courtPulseSnapshot.on.possessions,
          defensivePossessions: courtPulseSnapshot.on.possessions,
          pointsFor: courtPulseSnapshot.on.pointsFor,
          pointsAgainst: courtPulseSnapshot.on.pointsAgainst,
          minutes: courtPulseSnapshot.on.minutes,
        }
      : undefined;
    return buildPlayerPossessionAuditSample({
      playerId,
      teamId,
      gameId,
      auditRows,
      fallback,
    });
  }, [gameId, teamId, playerId, auditRows, courtPulseSnapshot]);

  const benchmark = benchmarkState.benchmark;

  const deltas = useMemo(() => {
    if (!courtPulseSample) {
      return {
        minutesDelta: null,
        offensivePossessionsDelta: null,
        defensivePossessionsDelta: null,
        offRtgDelta: null,
        defRtgDelta: null,
        netRtgDelta: null,
      };
    }
    return buildPossessionAuditDeltas(courtPulseSample, benchmark);
  }, [courtPulseSample, benchmark]);

  const classification = useMemo(() => {
    if (!courtPulseSample) return { issues: [], notes: [] };
    return classifyPossessionAuditIssues({
      courtPulse: courtPulseSample,
      pbpStats: benchmark,
      rows: auditRows,
    });
  }, [courtPulseSample, benchmark, auditRows]);

  if (!flagEnabled) return null;

  const cpOffRtg =
    courtPulseSample && courtPulseSample.offensivePossessions > 0
      ? (courtPulseSample.pointsFor / courtPulseSample.offensivePossessions) * 100
      : null;
  const cpDefRtg =
    courtPulseSample && courtPulseSample.defensivePossessions > 0
      ? (courtPulseSample.pointsAgainst / courtPulseSample.defensivePossessions) * 100
      : null;
  const cpNetRtg = cpOffRtg !== null && cpDefRtg !== null ? cpOffRtg - cpDefRtg : null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.dismiss} onPress={onClose} />
        <View style={[styles.container, { paddingBottom: insets.bottom + Spacing.md }]}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={styles.headerTextWrap}>
              <Text style={styles.headerTitle}>Possession Audit</Text>
              <Text style={styles.headerSubtitle} numberOfLines={1}>
                {playerName ?? playerId ?? '\u2014'} · Team {teamId ?? '\u2014'} · Game {gameId ?? '\u2014'}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <X size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll}>
            <Text style={styles.sectionTitle}>SUMMARY COMPARISON</Text>
            <View style={styles.panel}>
              <View style={styles.headerRow}>
                <Text style={styles.rowLabel}> </Text>
                <Text style={styles.headerCell}>CP</Text>
                <Text style={styles.headerCell}>PBP</Text>
                <Text style={styles.headerCell}>{'\u0394'}</Text>
              </View>
              {benchmarkState.status === 'loading' && (
                <Text style={styles.note}>Fetching PBPStats benchmark\u2026</Text>
              )}
              {(benchmarkState.status === 'unavailable' || benchmarkState.status === 'error') && (
                <Text style={styles.warning}>PBPStats benchmark unavailable</Text>
              )}
              {benchmarkState.errorMessage && (
                <Text style={styles.note}>{benchmarkState.errorMessage}</Text>
              )}
              <CompareRow
                label="Minutes"
                cp={courtPulseSample?.minutes ?? null}
                pbp={benchmark?.minutes ?? null}
                delta={deltas.minutesDelta}
              />
              <CompareRow
                label="Off Poss"
                cp={courtPulseSample?.offensivePossessions ?? null}
                pbp={benchmark?.offPoss ?? null}
                delta={deltas.offensivePossessionsDelta}
              />
              <CompareRow
                label="Def Poss"
                cp={courtPulseSample?.defensivePossessions ?? null}
                pbp={benchmark?.defPoss ?? null}
                delta={deltas.defensivePossessionsDelta}
              />
              <CompareRow label="ORtg" cp={cpOffRtg} pbp={benchmark?.offRtg ?? null} delta={deltas.offRtgDelta} />
              <CompareRow label="DRtg" cp={cpDefRtg} pbp={benchmark?.defRtg ?? null} delta={deltas.defRtgDelta} />
              <CompareRow label="Net" cp={cpNetRtg} pbp={benchmark?.netRtg ?? null} delta={deltas.netRtgDelta} />
              {benchmarkState.endpoint && (
                <Text style={styles.endpointNote} numberOfLines={2}>
                  {benchmarkState.endpoint}
                </Text>
              )}
              <Text style={styles.note}>
                PBPStats values may be season/playoff scoped unless the endpoint supports game filtering.
              </Text>
              {benchmark && (
                <Text style={styles.note}>PBPStats returned OffPoss and DefPoss separately.</Text>
              )}
            </View>

            <Text style={styles.sectionTitle}>LIKELY ISSUES</Text>
            <View style={styles.panel}>
              {classification.issues.length === 0 ? (
                <Text style={styles.note}>No issues classified.</Text>
              ) : (
                <View style={styles.issuesWrap}>
                  {classification.issues.map((iss) => (
                    <View key={iss} style={styles.issueChip}>
                      <Text style={styles.issueChipText}>{iss}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>

            <Text style={styles.sectionTitle}>AUDIT NOTES</Text>
            <View style={styles.panel}>
              {classification.notes.length === 0 ? (
                <Text style={styles.note}>No notes.</Text>
              ) : (
                classification.notes.map((n, i) => (
                  <Text key={i} style={styles.note}>{'\u2022 '}{n}</Text>
                ))
              )}
            </View>

            <Text style={styles.sectionTitle}>BENCHMARK MATCH DEBUG</Text>
            <View style={styles.panel}>
              <DebugRow label="Source" value={benchmarkState.debug?.source ?? '\u2014'} />
              <DebugRow
                label="Fallback"
                value={benchmarkState.debug?.fallbackUsed ? 'yes' : 'no'}
              />
              {benchmarkState.debug?.primaryError ? (
                <DebugRow label="Primary err" value={benchmarkState.debug.primaryError} />
              ) : null}
              <DebugRow
                label="Endpoint"
                value={benchmarkState.debug?.endpoint ?? benchmarkState.endpoint ?? '\u2014'}
              />
              <DebugRow
                label="Result keys"
                value={
                  benchmarkState.debug?.rawResultKeys.length
                    ? benchmarkState.debug.rawResultKeys.join(', ')
                    : '\u2014'
                }
              />
              <DebugRow
                label="Candidates"
                value={String(benchmarkState.debug?.candidateRowsCount ?? 0)}
              />
              <DebugRow
                label="Matched rows"
                value={String(benchmarkState.debug?.matchedRowsCount ?? 0)}
              />
              <DebugRow
                label="Matched by"
                value={benchmarkState.debug?.matchedBy ?? 'none'}
              />
              <DebugRow
                label="Selected idx"
                value={
                  benchmarkState.debug?.selectedRowIndex !== null &&
                  benchmarkState.debug?.selectedRowIndex !== undefined
                    ? String(benchmarkState.debug.selectedRowIndex)
                    : '\u2014'
                }
              />
              <DebugRow
                label="Reason"
                value={benchmarkState.debug?.selectedRowReason ?? '\u2014'}
              />
              {benchmark?.rawMinutes !== undefined && benchmark?.rawMinutes !== null && (
                <DebugRow label="Raw minutes" value={String(benchmark.rawMinutes)} />
              )}
              {benchmark?.minutes !== null && benchmark?.minutes !== undefined && (
                <DebugRow label="Parsed min" value={benchmark.minutes.toFixed(3)} />
              )}
              {benchmarkState.debug?.selectedRowPreview && (
                <View style={styles.jsonBlock}>
                  <Text style={styles.jsonLabel}>Selected row preview</Text>
                  <Text style={styles.jsonText}>
                    {safeJson(benchmarkState.debug.selectedRowPreview)}
                  </Text>
                </View>
              )}
              {benchmarkState.debug?.firstCandidatePreview &&
                benchmarkState.debug.matchedBy === 'none' && (
                  <View style={styles.jsonBlock}>
                    <Text style={styles.jsonLabel}>First candidate preview</Text>
                    <Text style={styles.jsonText}>
                      {safeJson(benchmarkState.debug.firstCandidatePreview)}
                    </Text>
                  </View>
                )}
              {benchmarkState.debug?.matchedBy === 'none' && (
                <Text style={styles.warning}>
                  PBPStats response received, but no matching player row was found.
                </Text>
              )}
            </View>

            <Text style={styles.sectionTitle}>POSSESSION ROWS</Text>
            <View style={styles.panel}>
              {auditRows.length === 0 ? (
                <Text style={styles.note}>
                  Row-level audit data is unavailable for this game in this build.
                </Text>
              ) : (
                auditRows.map((row) => <AuditRow key={row.id} row={row} />)
              )}
            </View>

            <View style={{ height: Spacing.xxl }} />
          </ScrollView>
        </View>
      </View>
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
    gap: Spacing.sm,
  },
  headerTextWrap: {
    flex: 1,
  },
  headerTitle: {
    color: Colors.textPrimary,
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
  },
  headerSubtitle: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    marginTop: 2,
  },
  scroll: {
    flexGrow: 1,
    flexShrink: 1,
  },
  sectionTitle: {
    color: Colors.textMuted,
    fontSize: 9,
    fontWeight: FontWeight.bold,
    letterSpacing: 1.2,
    marginBottom: Spacing.sm,
    marginTop: Spacing.sm,
  },
  panel: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 3,
  },
  rowLabel: {
    flex: 1,
    color: Colors.textMuted,
    fontSize: FontSize.xs,
  },
  headerCell: {
    width: 56,
    textAlign: 'right' as const,
    color: Colors.textMuted,
    fontSize: 9,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.8,
  },
  cell: {
    width: 56,
    textAlign: 'right' as const,
    color: Colors.textPrimary,
    fontSize: FontSize.xs,
    fontVariant: ['tabular-nums'] as const,
  },
  deltaCell: {
    width: 56,
    textAlign: 'right' as const,
    color: Colors.warning,
    fontSize: FontSize.xs,
    fontVariant: ['tabular-nums'] as const,
  },
  note: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontStyle: 'italic' as const,
    marginTop: 4,
  },
  warning: {
    color: Colors.warning,
    fontSize: FontSize.xs,
    fontStyle: 'italic' as const,
    marginTop: 4,
  },
  endpointNote: {
    color: Colors.textMuted,
    fontSize: 10,
    marginTop: Spacing.xs,
  },
  issuesWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginTop: 4,
  },
  issueChip: {
    backgroundColor: Colors.primaryMuted,
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
  },
  issueChipText: {
    color: Colors.primary,
    fontSize: 10,
    fontWeight: FontWeight.semibold,
  },
  eventRow: {
    paddingVertical: Spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
    marginBottom: Spacing.xs,
  },
  eventTitle: {
    color: Colors.textPrimary,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
  },
  eventMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginTop: 2,
  },
  eventMetaText: {
    color: Colors.textMuted,
    fontSize: 10,
    marginTop: 2,
  },
  debugRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 2,
    gap: Spacing.sm,
  },
  debugLabel: {
    width: 96,
    color: Colors.textMuted,
    fontSize: 10,
    letterSpacing: 0.4,
  },
  debugValue: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: 10,
    fontVariant: ['tabular-nums'] as const,
  },
  jsonBlock: {
    marginTop: Spacing.xs,
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  jsonLabel: {
    color: Colors.textMuted,
    fontSize: 9,
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  jsonText: {
    color: Colors.textPrimary,
    fontSize: 10,
    fontFamily: 'monospace',
  },
});
