import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { BorderRadius, FontSize, FontWeight, Spacing } from '@/constants/theme';
import type { PlayerDirectoryEntry } from '@/types/playersDirectory';
import { formatDirectoryDecimal, formatDirectoryNet, formatDirectoryPercent } from '@/utils/playersDirectoryUi';

interface PlayerDirectoryRowProps {
  player: PlayerDirectoryEntry;
  onPress: (playerId: string) => void;
}

interface MetricProps {
  label: string;
  value: string;
  tone?: 'positive' | 'negative' | 'default';
}

const Metric = React.memo(function Metric({ label, value, tone = 'default' }: MetricProps) {
  const toneStyle = tone === 'positive'
    ? styles.positiveValue
    : tone === 'negative'
      ? styles.negativeValue
      : null;
  return (
    <View style={styles.metric}>
      <Text style={[styles.metricValue, toneStyle]} numberOfLines={1}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
});

function PlayerDirectoryRowImpl({ player, onPress }: PlayerDirectoryRowProps) {
  const teamAbbreviation = player.identity.team.abbreviation ?? '—';
  const gamesPlayed = player.base.gamesPlayed;
  const netRating = player.advanced.netRating;
  const netTone: MetricProps['tone'] = netRating === null || netRating === 0
    ? 'default'
    : netRating > 0 ? 'positive' : 'negative';

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={() => onPress(String(player.playerId))}
      activeOpacity={0.72}
      accessibilityRole="button"
      accessibilityLabel={`${player.identity.fullName}, ${teamAbbreviation}. Open player details.`}
      testID={`player-directory-row-${String(player.playerId)}`}
    >
      <View style={styles.identityRow}>
        <View style={styles.teamMark}>
          <Text style={styles.teamMarkText} numberOfLines={1}>{teamAbbreviation}</Text>
        </View>
        <View style={styles.identityCopy}>
          <Text style={styles.name} numberOfLines={1}>{player.identity.fullName}</Text>
          <Text style={styles.meta} numberOfLines={1}>
            {teamAbbreviation}{gamesPlayed === null ? '' : `  ·  ${gamesPlayed} GP`}
          </Text>
        </View>
        <ChevronRight size={18} color={Colors.textMuted} />
      </View>

      <View style={styles.metricsGrid}>
        <View style={styles.metricRow}>
          <Metric label="PTS" value={formatDirectoryDecimal(player.base.pointsPerGame)} />
          <Metric label="REB" value={formatDirectoryDecimal(player.base.reboundsPerGame)} />
          <Metric label="AST" value={formatDirectoryDecimal(player.base.assistsPerGame)} />
        </View>
        <View style={[styles.metricRow, styles.metricRowSecondary]}>
          <Metric label="TS%" value={formatDirectoryPercent(player.advanced.trueShootingPct)} />
          <Metric label="MIN" value={formatDirectoryDecimal(player.base.minutesPerGame)} />
          <Metric label="NET" value={formatDirectoryNet(netRating)} tone={netTone} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default React.memo(PlayerDirectoryRowImpl);

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.cardBg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  identityRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  teamMark: {
    width: 42,
    height: 42,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.primaryMuted,
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  teamMarkText: {
    color: Colors.primary,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.heavy,
    letterSpacing: 0.4,
  },
  identityCopy: { flex: 1, minWidth: 0 },
  name: {
    color: Colors.textPrimary,
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    letterSpacing: -0.2,
  },
  meta: { color: Colors.textMuted, fontSize: FontSize.xs, fontWeight: FontWeight.medium, marginTop: 3 },
  metricsGrid: {
    marginTop: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  metricRow: { flexDirection: 'row' },
  metricRowSecondary: { marginTop: Spacing.sm },
  metric: { flex: 1, flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  metricValue: {
    color: Colors.textPrimary,
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    fontVariant: ['tabular-nums'],
  },
  metricLabel: { color: Colors.textMuted, fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  positiveValue: { color: Colors.positive },
  negativeValue: { color: Colors.negative },
});
