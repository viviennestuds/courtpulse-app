import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { Spacing, BorderRadius, FontSize, FontWeight } from '@/constants/theme';
import SegmentControl from '@/components/SegmentControl';
import DataSourceBadge from '@/components/DataSourceBadge';
import { useTeams } from '@/hooks/useNbaData';
import { Team, TeamRecordSplits } from '@/types';
import { safeBack } from '@/utils/navigation';
import {
  formatGamesBack,
  formatNumber,
  formatRank,
  formatRating,
  formatRecord,
  formatRecordSplit,
  formatWinPct,
  parseRecordSplit,
  safeNumber,
} from '@/utils/teamFormatting';

const TEAM_TABS = ['Overview', 'Roster', 'Games', 'Conditions'];

type RecordSplitKey = keyof TeamRecordSplits;

interface OverviewRowItem {
  label: string;
  value: string;
}

interface WinConditionItem {
  key: RecordSplitKey;
  label: string;
  helper: string;
}

const WIN_CONDITIONS: WinConditionItem[] = [
  { key: 'aheadAtThird', label: 'Leading after 3Q', helper: 'Closing from control' },
  { key: 'leadInFgPct', label: 'Leading in FG%', helper: 'Shooting efficiency edge' },
  { key: 'leadInRebounds', label: 'Winning Rebound Battle', helper: 'Possession control' },
  { key: 'fewerTurnovers', label: 'Fewer Turnovers', helper: 'Cleaner possessions' },
  { key: 'score100Plus', label: 'Scoring 100+', helper: 'Offensive baseline' },
  { key: 'vsOppOver500', label: 'Vs Opponents Over .500', helper: 'Quality-opponent record' },
  { key: 'aheadAtHalf', label: 'Leading at Half', helper: 'First-half advantage' },
  { key: 'behindAtHalf', label: 'Trailing at Half', helper: 'Comeback profile' },
  { key: 'tiedAtHalf', label: 'Tied at Half', helper: 'Even at the break' },
  { key: 'behindAtThird', label: 'Trailing after 3Q', helper: 'Late comeback profile' },
  { key: 'tiedAtThird', label: 'Tied after 3Q', helper: 'Fourth-quarter separation' },
  { key: 'opponentScore100Plus', label: 'Opponent Scores 100+', helper: 'When pace/scoring rises' },
];

function getRecord(team: Team): string {
  return formatRecord(team.overview?.standings.wins ?? (team.recordAvailable ? team.wins : null), team.overview?.standings.losses ?? (team.recordAvailable ? team.losses : null));
}

function metricColor(value: number | null | undefined, positiveIsGood: boolean = true): string {
  const safeValue = safeNumber(value);
  if (safeValue === undefined || safeValue === 0) return Colors.textPrimary;
  const isPositive = safeValue > 0;
  return isPositive === positiveIsGood ? Colors.positive : Colors.negative;
}

function buildOverviewRows(team: Team): OverviewRowItem[] {
  const standings = team.overview?.standings;
  const rows: OverviewRowItem[] = [
    { label: 'Win Percentage', value: formatWinPct(standings?.winPct, 'percent') },
    { label: 'Games Back', value: formatGamesBack(standings?.gamesBackConference) },
    { label: 'Conference Rank', value: formatRank(standings?.conferenceRank) },
    { label: 'Division Rank', value: formatRank(standings?.divisionRank) },
    { label: 'Last 10', value: standings?.last10 ?? '—' },
    { label: 'Streak', value: standings?.streak ?? '—' },
    { label: 'Home', value: standings?.homeRecord ?? '—' },
    { label: 'Road', value: standings?.roadRecord ?? '—' },
  ];
  return rows;
}

function buildScoringRows(team: Team): OverviewRowItem[] {
  const scoring = team.overview?.scoring;
  return [
    { label: 'PPG', value: formatNumber(scoring?.pointsPerGame, 1) },
    { label: 'Opponent PPG', value: formatNumber(scoring?.opponentPointsPerGame, 1) },
    { label: 'Margin', value: formatNumber(scoring?.plusMinusPerGame, 1, true) },
    { label: 'Total Point Differential', value: formatNumber(scoring?.totalPointDifferential, 0, true) },
  ];
}

export default function TeamDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<number>(0);

  const { teams, dataSource: teamSource, dataState, isLoading } = useTeams();
  const team = useMemo<Team | undefined>(() => teams.find(t => t.id === id), [teams, id]);

  const handleBack = useCallback(() => {
    safeBack(router, '/(tabs)/teams');
  }, [router]);

  const overviewRows = useMemo<OverviewRowItem[]>(() => team ? buildOverviewRows(team) : [], [team]);
  const scoringRows = useMemo<OverviewRowItem[]>(() => team ? buildScoringRows(team) : [], [team]);
  const winConditions = useMemo(() => {
    const splits = team?.overview?.recordSplits;
    if (!splits) return [];
    return WIN_CONDITIONS
      .map(condition => ({ ...condition, record: splits[condition.key] }))
      .filter(condition => condition.record && formatRecordSplit(condition.record) !== '—');
  }, [team]);

  if (isLoading && !team) {
    return (
      <View style={[styles.screen, styles.centeredScreen, { paddingTop: insets.top }]}> 
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading team profile...</Text>
      </View>
    );
  }

  if (!team) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}> 
        <View style={styles.headerBar}>
          <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
            <ChevronLeft size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>
        <Text style={styles.errorText}>Team not found</Text>
      </View>
    );
  }

  const ratings = team.overview?.ratings;
  const standings = team.overview?.standings;
  const isSourceBacked = dataState === 'success' || dataState === 'partial';
  const headerRecord = getRecord(team);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}> 
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
          <ChevronLeft size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerBadgeSlot}>
          <DataSourceBadge source={teamSource} compact />
        </View>
      </View>

      <View style={styles.teamHeader}>
        <View style={[styles.teamColorAccent, { backgroundColor: team.primaryColor }]} />
        <View style={styles.teamHeaderInfo}>
          <Text style={styles.teamCity}>{team.city}</Text>
          <Text style={styles.teamName}>{team.name}</Text>
          <Text style={styles.teamRecord}>
            {headerRecord} · {team.conference} · {team.division || '—'}
          </Text>
        </View>
      </View>

      <View style={styles.quickStats}>
        <MetricTile label="OFF RTG" value={formatRating(ratings?.offRating)} />
        <MetricTile label="DEF RTG" value={formatRating(ratings?.defRating)} />
        <MetricTile label="NET RTG" value={formatRating(ratings?.netRating, true)} valueColor={metricColor(ratings?.netRating)} />
        <MetricTile label="PACE" value={formatRating(ratings?.pace)} />
      </View>

      <View style={styles.tabRow}>
        <SegmentControl segments={TEAM_TABS} selected={activeTab} onSelect={setActiveTab} />
      </View>

      <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {activeTab === 0 && (
          <View>
            <View style={styles.sourceCallout}>
              <View style={[styles.sourceDot, { backgroundColor: isSourceBacked ? Colors.primary : Colors.warning }]} />
              <Text style={styles.sourceCalloutText}>
                {isSourceBacked ? 'Regular-season standings, ratings, and scoring are source-backed.' : 'Static fallback team metadata is shown because source data is unavailable.'}
              </Text>
            </View>

            <Text style={styles.sectionLabel}>SEASON OVERVIEW</Text>
            <View style={styles.card}>
              {overviewRows.map(row => <OverviewRow key={row.label} label={row.label} value={row.value} />)}
            </View>

            <Text style={styles.sectionLabel}>SCORING / TEAM PROFILE</Text>
            <View style={styles.card}>
              {scoringRows.map(row => <OverviewRow key={row.label} label={row.label} value={row.value} />)}
            </View>

            <Text style={styles.sectionLabel}>RATINGS SNAPSHOT</Text>
            <View style={styles.ratingsRow}>
              <RatingCard title="Offense" value={formatRating(ratings?.offRating)} accent={Colors.positive} detail="Source-backed offensive rating" />
              <RatingCard title="Defense" value={formatRating(ratings?.defRating)} accent={Colors.secondary} detail="Lower defensive rating is better" />
            </View>

            {standings?.clinchIndicator && (
              <View style={styles.clinchCard}>
                <Text style={styles.clinchLabel}>CLINCH INDICATOR</Text>
                <Text style={styles.clinchValue}>{standings.clinchIndicator}</Text>
              </View>
            )}
          </View>
        )}

        {activeTab === 1 && (
          <View>
            <Text style={styles.sectionLabel}>ROSTER</Text>
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>Roster data is coming soon.</Text>
              <Text style={styles.emptyText}>This pass focuses on source-backed team season data.</Text>
            </View>
          </View>
        )}

        {activeTab === 2 && (
          <View>
            <Text style={styles.sectionLabel}>TEAM GAME LOGS</Text>
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>Team game logs are coming soon.</Text>
              <Text style={styles.emptyText}>Future hydration can reuse the Supabase stats proxy without changing this team profile.</Text>
            </View>
          </View>
        )}

        {activeTab === 3 && (
          <View>
            <Text style={styles.sectionLabel}>WIN CONDITIONS</Text>
            <Text style={styles.sectionDescription}>
              Source-backed team records when common game conditions occur.
            </Text>
            {winConditions.length > 0 ? (
              winConditions.map(condition => (
                <WinConditionCard
                  key={condition.key}
                  label={condition.label}
                  record={condition.record ?? null}
                  helper={condition.helper}
                />
              ))
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>Win condition data is unavailable for this team.</Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const MetricTile = React.memo(function MetricTile({ label, value, valueColor = Colors.textPrimary }: { label: string; value: string; valueColor?: string }) {
  return (
    <View style={styles.qStat}>
      <Text style={[styles.qStatValue, value === '—' && styles.unavailableValue, { color: value === '—' ? Colors.textMuted : valueColor }]}>{value}</Text>
      <Text style={styles.qStatLabel}>{label}</Text>
    </View>
  );
});

const OverviewRow = React.memo(function OverviewRow({ label, value }: OverviewRowItem) {
  return (
    <View style={styles.overviewRow}>
      <Text style={styles.overviewLabel}>{label}</Text>
      <Text style={[styles.overviewValue, value === '—' && styles.unavailableValue]}>{value}</Text>
    </View>
  );
});

const RatingCard = React.memo(function RatingCard({ title, value, accent, detail }: { title: string; value: string; accent: string; detail: string }) {
  return (
    <View style={[styles.ratingCard, { borderLeftColor: accent }]}> 
      <Text style={styles.ratingTitle}>{title}</Text>
      <Text style={[styles.ratingValue, value === '—' && styles.unavailableValue]}>{value}</Text>
      <Text style={styles.ratingDetail}>{detail}</Text>
    </View>
  );
});

const WinConditionCard = React.memo(function WinConditionCard({ label, record, helper }: { label: string; record: string | null; helper: string }) {
  const parsed = parseRecordSplit(record);
  const winRate = parsed?.winRate;
  const winRateText = winRate === null || winRate === undefined ? '' : `${(winRate * 100).toFixed(1)}% win rate`;
  const recordColor = winRate === undefined || winRate === null ? Colors.textPrimary : winRate >= 0.7 ? Colors.positive : winRate >= 0.5 ? Colors.warning : Colors.textSecondary;

  return (
    <View style={styles.splitCard}>
      <View style={styles.splitHeader}>
        <Text style={styles.splitMetric}>{label}</Text>
        <Text style={styles.splitHelper}>{helper}</Text>
      </View>
      <View style={styles.splitRecord}>
        <Text style={[styles.splitRecordText, { color: recordColor }]}>{formatRecordSplit(record)}</Text>
        {winRateText.length > 0 && <Text style={styles.splitWinPct}>{winRateText}</Text>}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  centeredScreen: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  loadingText: {
    color: Colors.textMuted,
    fontSize: FontSize.md,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBadgeSlot: {
    minWidth: 80,
    alignItems: 'flex-end',
  },
  teamHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.lg,
    gap: Spacing.lg,
  },
  teamColorAccent: {
    width: 4,
    height: 60,
    borderRadius: 2,
  },
  teamHeaderInfo: {
    flex: 1,
  },
  teamCity: {
    color: Colors.textMuted,
    fontSize: FontSize.md,
    fontWeight: FontWeight.medium,
  },
  teamName: {
    color: Colors.textPrimary,
    fontSize: FontSize.xxxl,
    fontWeight: FontWeight.heavy,
    letterSpacing: -0.5,
  },
  teamRecord: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    marginTop: 2,
  },
  quickStats: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  qStat: {
    flex: 1,
    backgroundColor: Colors.cardBg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  qStatValue: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    fontVariant: ['tabular-nums'],
  },
  qStatLabel: {
    color: Colors.textMuted,
    fontSize: 9,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.5,
    marginTop: 2,
  },
  tabRow: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxxl,
  },
  sourceCallout: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  sourceDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  sourceCalloutText: {
    flex: 1,
    color: Colors.textSecondary,
    fontSize: FontSize.xs,
    lineHeight: 16,
  },
  sectionLabel: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    letterSpacing: 1.5,
    marginBottom: Spacing.md,
    marginTop: Spacing.lg,
  },
  sectionDescription: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    lineHeight: 20,
    marginBottom: Spacing.md,
  },
  card: {
    backgroundColor: Colors.cardBg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  overviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  overviewLabel: {
    color: Colors.textSecondary,
    fontSize: FontSize.md,
    flex: 1,
  },
  overviewValue: {
    color: Colors.textPrimary,
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    fontVariant: ['tabular-nums'],
    textAlign: 'right',
  },
  ratingsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  ratingCard: {
    flex: 1,
    backgroundColor: Colors.cardBg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderLeftWidth: 3,
    padding: Spacing.lg,
  },
  ratingTitle: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
  },
  ratingValue: {
    color: Colors.textPrimary,
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.heavy,
    marginBottom: Spacing.xs,
    fontVariant: ['tabular-nums'],
  },
  ratingDetail: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    lineHeight: 16,
  },
  clinchCard: {
    backgroundColor: Colors.warningMuted,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.warning + '40',
    padding: Spacing.lg,
    marginTop: Spacing.md,
  },
  clinchLabel: {
    color: Colors.warning,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    letterSpacing: 1,
    marginBottom: Spacing.xs,
  },
  clinchValue: {
    color: Colors.textPrimary,
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
  },
  emptyState: {
    padding: Spacing.xl,
    alignItems: 'center',
    backgroundColor: Colors.cardBg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    gap: Spacing.xs,
  },
  emptyTitle: {
    color: Colors.textPrimary,
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    textAlign: 'center',
  },
  emptyText: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    textAlign: 'center',
    lineHeight: 18,
  },
  errorText: {
    color: Colors.textMuted,
    fontSize: FontSize.lg,
    textAlign: 'center',
    marginTop: 100,
  },
  splitCard: {
    backgroundColor: Colors.cardBg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  splitHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: Spacing.md,
    marginBottom: Spacing.sm,
  },
  splitMetric: {
    color: Colors.textSecondary,
    fontSize: FontSize.md,
    fontWeight: FontWeight.medium,
    flex: 1,
  },
  splitHelper: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    textAlign: 'right',
    flex: 1,
  },
  splitRecord: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.sm,
  },
  splitRecordText: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.heavy,
    fontVariant: ['tabular-nums'],
  },
  splitWinPct: {
    color: Colors.textMuted,
    fontSize: FontSize.md,
  },
  unavailableValue: {
    color: Colors.textMuted,
  },
});
