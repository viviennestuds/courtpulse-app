import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Modal, Pressable, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, Target, CircleX, Shield, Zap, Clock, Magnet, Undo2 } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { Spacing, BorderRadius, FontSize, FontWeight } from '@/constants/theme';
import { DroughtLineupPhase, StretchMode, StretchPhaseEvent, StretchPhaseEventKind } from '@/types';

interface Props {
  visible: boolean;
  onClose: () => void;
  phase: DroughtLineupPhase | null;
  mode: StretchMode;
  teamAbbr: string;
}

const KIND_ICON: Record<StretchPhaseEventKind, React.ComponentType<{ size?: number; color?: string }>> = {
  made_fg: Target,
  missed_fg: CircleX,
  made_ft: Target,
  missed_ft: CircleX,
  turnover: Undo2,
  timeout: Clock,
  steal: Shield,
  block: Shield,
  offensive_rebound: Magnet,
  assist: Zap,
};

function kindColor(kind: StretchPhaseEventKind): string {
  switch (kind) {
    case 'made_fg':
    case 'made_ft':
    case 'steal':
    case 'block':
    case 'offensive_rebound':
      return Colors.positive;
    case 'missed_fg':
    case 'missed_ft':
    case 'turnover':
      return Colors.negative;
    case 'timeout':
      return Colors.warning;
    default:
      return Colors.textSecondary;
  }
}

function kindLabel(e: StretchPhaseEvent): string {
  const player = e.playerName ?? 'Unknown';
  switch (e.kind) {
    case 'made_fg': {
      const pts = e.points ?? 2;
      const base = `${player} made ${pts === 3 ? '3PT' : 'FG'}`;
      return e.assisterName ? `${base} (ast. ${e.assisterName})` : base;
    }
    case 'missed_fg':
      return `${player} missed FG`;
    case 'made_ft':
      return `${player} made FT`;
    case 'missed_ft':
      return `${player} missed FT`;
    case 'turnover':
      return `${player} turnover`;
    case 'timeout':
      return `Timeout`;
    case 'steal':
      return `${player} steal`;
    case 'block':
      return `${player} block`;
    case 'offensive_rebound':
      return `${player} offensive rebound`;
    case 'assist':
      return `${player} assist`;
  }
}

export default function PhaseEventsSheet({ visible, onClose, phase, mode, teamAbbr }: Props) {
  const insets = useSafeAreaInsets();

  const events = useMemo<StretchPhaseEvent[]>(() => {
    if (!phase?.events) return [];
    return phase.events;
  }, [phase]);

  const title = mode === 'run' ? 'Run phase' : 'Drought phase';
  const subtitle = phase ? `${teamAbbr} · ${phase.startClock} → ${phase.endClock}` : '';

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.dismiss} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + Spacing.lg }]}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.subtitle}>{subtitle}</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <X size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {phase && (
            <View style={styles.lineupRow}>
              {phase.players.map((p, i) => (
                <View key={i} style={styles.lineupChip}>
                  <Text style={styles.lineupChipText}>{p}</Text>
                </View>
              ))}
            </View>
          )}

          <Text style={styles.sectionLabel}>
            {mode === 'run' ? 'SUCCESS-DRIVING EVENTS' : 'STALL EVENTS'}
          </Text>

          <ScrollView style={styles.list} contentContainerStyle={{ paddingBottom: Spacing.md }}>
            {events.length === 0 && (
              <Text style={styles.emptyText}>
                No curated events detected for this phase.
              </Text>
            )}
            {events.map((e, i) => {
              const Icon = KIND_ICON[e.kind];
              const color = kindColor(e.kind);
              return (
                <View key={i} style={styles.eventRow} testID={`phase-event-${i}`}>
                  <View style={styles.eventClock}>
                    <Text style={styles.eventClockText}>Q{e.period} {e.clock}</Text>
                  </View>
                  <View style={[styles.eventIcon, { backgroundColor: color + '22' }]}>
                    <Icon size={14} color={color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.eventLabel}>{kindLabel(e)}</Text>
                    {e.description && e.description !== kindLabel(e) && (
                      <Text style={styles.eventDesc} numberOfLines={2}>{e.description}</Text>
                    )}
                  </View>
                  {typeof e.points === 'number' && e.points > 0 && (
                    <Text style={[styles.eventPts, { color }]}>+{e.points}</Text>
                  )}
                </View>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: Colors.overlay },
  dismiss: { flex: 1 },
  sheet: {
    backgroundColor: Colors.cardBg,
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    maxHeight: '80%',
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: Colors.cardBorder,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: Spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
  },
  subtitle: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    marginTop: 2,
  },
  lineupRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  lineupChip: {
    backgroundColor: Colors.surfaceLight,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.sm,
  },
  lineupChipText: {
    color: Colors.textSecondary,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
  },
  sectionLabel: {
    color: Colors.textMuted,
    fontSize: 10,
    fontWeight: FontWeight.bold,
    letterSpacing: 1.2,
    marginBottom: Spacing.sm,
  },
  list: { maxHeight: 400 },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  eventClock: { minWidth: 54 },
  eventClockText: {
    color: Colors.textMuted,
    fontSize: 11,
    fontVariant: ['tabular-nums'] as const,
  },
  eventIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventLabel: {
    color: Colors.textPrimary,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
  eventDesc: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    marginTop: 2,
  },
  eventPts: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    marginLeft: Spacing.xs,
  },
  emptyText: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    paddingVertical: Spacing.lg,
    textAlign: 'center',
  },
});
