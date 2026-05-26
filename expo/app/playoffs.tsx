import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { ArrowLeft, ChevronDown, ChevronRight, GitFork, WifiOff } from 'lucide-react-native';
import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';
import { BorderRadius, FontSize, FontWeight, Spacing } from '@/constants/theme';
import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import { getPlayoffCatalog } from '@/services/nbaDataProxy';
import { buildPlayoffBracket, PlayoffBracketRound, PlayoffCatalogLike, PlayoffSeries, PlayoffSeriesGame, PlayoffTeamSlot } from '@/utils/playoffBracket';

function hexToRgba(hex: string, alpha: number): string {
  const normalized = hex.replace('#', '');
  if (normalized.length !== 6) return `rgba(59,130,246,${alpha})`;
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  if (![r, g, b].every(Number.isFinite)) return `rgba(59,130,246,${alpha})`;
  return `rgba(${r},${g},${b},${alpha})`;
}

function teamLabel(team: PlayoffTeamSlot): string {
  if (team.isTbd) return team.name && team.name !== 'TBD' ? team.name : 'TBD';
  return team.abbreviation;
}

function fullTeamLabel(team: PlayoffTeamSlot): string {
  if (team.isTbd) return team.name && team.name !== 'TBD' ? team.name : 'Opponent TBD';
  return team.name;
}

function isTeamWinner(series: PlayoffSeries, team: PlayoffTeamSlot): boolean {
  return !team.isTbd && series.winnerAbbr === team.abbreviation;
}

function isTeamLoser(series: PlayoffSeries, team: PlayoffTeamSlot): boolean {
  return series.isComplete && !team.isTbd && !!series.winnerAbbr && series.winnerAbbr !== team.abbreviation;
}

function isTeamLeader(series: PlayoffSeries, team: PlayoffTeamSlot): boolean {
  return !series.isComplete && !team.isTbd && series.leaderAbbr === team.abbreviation;
}

export default function PlayoffsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const enabled = useFeatureFlag('enablePlayoffBracketV1');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const query = useQuery({
    queryKey: ['playoffCatalog'],
    queryFn: getPlayoffCatalog,
    staleTime: 1000 * 60 * 15,
    gcTime: 1000 * 60 * 60,
    retry: 1,
    enabled,
  });

  const bracket = useMemo(() => buildPlayoffBracket(query.data as PlayoffCatalogLike | undefined), [query.data]);

  const toggleSeries = useCallback((seriesId: string) => {
    setExpanded(current => ({ ...current, [seriesId]: !current[seriesId] }));
  }, []);

  const openGame = useCallback((gameId: string) => {
    if (gameId) router.push(`/game/${gameId}`);
  }, [router]);

  if (!enabled) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}> 
        <Header title="Playoff Bracket" subtitle="Feature disabled" onBack={() => router.back()} />
        <View style={styles.emptyState}>
          <GitFork size={32} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>Playoff Bracket is off</Text>
          <Text style={styles.emptyText}>Enable the Phase 1 Playoff Bracket flag to preview this experience.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}> 
      <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Header title={bracket.title} subtitle={bracket.subtitle} onBack={() => router.back()} />

        <View style={styles.heroCard}>
          <View style={styles.heroIconWrap}>
            <GitFork size={22} color={Colors.secondary} />
          </View>
          <View style={styles.heroCopy}>
            <Text style={styles.heroTitle}>Playoff Tree</Text>
            <Text style={styles.heroSubtitle}>{bracket.seriesCount} series · {bracket.gameCount} games · {bracket.sourceLabel}</Text>
          </View>
        </View>

        {query.isLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>Building bracket from NBA schedule…</Text>
          </View>
        )}

        {query.isError && (
          <View style={styles.errorBanner}>
            <WifiOff size={16} color={Colors.warning} />
            <Text style={styles.errorBannerText}>Unable to load playoff schedule metadata. Pull back and try again.</Text>
          </View>
        )}

        {!query.isLoading && !query.isError && bracket.rounds.length === 0 && (
          <View style={styles.emptyState}>
            <GitFork size={32} color={Colors.textMuted} />
            <Text style={styles.emptyTitle}>No playoff series found</Text>
            <Text style={styles.emptyText}>CourtPulse only shows games with playoff schedule metadata here.</Text>
          </View>
        )}

        {bracket.rounds.map(round => (
          <RoundSection
            key={round.id}
            round={round}
            expanded={expanded}
            onToggleSeries={toggleSeries}
            onOpenGame={openGame}
          />
        ))}
      </ScrollView>
    </View>
  );
}

interface HeaderProps {
  title: string;
  subtitle: string;
  onBack: () => void;
}

function Header({ title, subtitle, onBack }: HeaderProps) {
  return (
    <View style={styles.header}>
      <TouchableOpacity style={styles.backButton} onPress={onBack} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel="Go back">
        <ArrowLeft size={20} color={Colors.textPrimary} />
      </TouchableOpacity>
      <View style={styles.headerCopy}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
    </View>
  );
}

interface RoundSectionProps {
  round: PlayoffBracketRound;
  expanded: Record<string, boolean>;
  onToggleSeries: (seriesId: string) => void;
  onOpenGame: (gameId: string) => void;
}

function RoundSection({ round, expanded, onToggleSeries, onOpenGame }: RoundSectionProps) {
  return (
    <View style={styles.roundSection}>
      <View style={styles.roundHeader}>
        <Text style={styles.roundLabel}>{round.label}</Text>
        <Text style={styles.roundMeta}>{round.series.length} {round.series.length === 1 ? 'series' : 'series'}</Text>
      </View>
      {round.series.map(series => (
        <SeriesCard
          key={series.id}
          series={series}
          expanded={!!expanded[series.id]}
          onToggle={() => onToggleSeries(series.id)}
          onOpenGame={onOpenGame}
        />
      ))}
    </View>
  );
}

interface SeriesCardProps {
  series: PlayoffSeries;
  expanded: boolean;
  onToggle: () => void;
  onOpenGame: (gameId: string) => void;
}

function SeriesCard({ series, expanded, onToggle, onOpenGame }: SeriesCardProps) {
  const accentBg = hexToRgba(series.accentColor, 0.15);
  return (
    <View style={[styles.seriesCard, { borderColor: hexToRgba(series.accentColor, series.isComplete ? 0.42 : 0.24) }]}> 
      <TouchableOpacity onPress={onToggle} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel={`Toggle ${teamLabel(series.teamA)} versus ${teamLabel(series.teamB)} series`}>
        <View style={styles.seriesTopRow}>
          <View style={[styles.seriesAccent, { backgroundColor: series.accentColor }]} />
          <View style={styles.seriesSummaryWrap}>
            <Text style={styles.seriesMatchup}>{teamLabel(series.teamA)} / {teamLabel(series.teamB)}</Text>
            <Text style={styles.seriesSummary}>{series.summary}</Text>
          </View>
          <View style={[styles.seriesPill, { backgroundColor: accentBg }]}> 
            <Text style={[styles.seriesPillText, { color: series.accentColor }]}>{series.isComplete ? 'FINAL' : 'SERIES'}</Text>
          </View>
          {expanded ? <ChevronDown size={18} color={Colors.textMuted} /> : <ChevronRight size={18} color={Colors.textMuted} />}
        </View>

        <View style={styles.teamRows}>
          <SeriesTeamRow series={series} team={series.teamA} wins={series.winsA} />
          <SeriesTeamRow series={series} team={series.teamB} wins={series.winsB} />
        </View>
      </TouchableOpacity>

      {expanded && (
        <View style={styles.gamesList}>
          {series.games.map(game => (
            <GameRow key={game.id} game={game} onOpenGame={onOpenGame} />
          ))}
        </View>
      )}
    </View>
  );
}

interface SeriesTeamRowProps {
  series: PlayoffSeries;
  team: PlayoffTeamSlot;
  wins?: number;
}

function SeriesTeamRow({ series, team, wins }: SeriesTeamRowProps) {
  const winner = isTeamWinner(series, team);
  const loser = isTeamLoser(series, team);
  const leader = isTeamLeader(series, team);
  return (
    <View style={styles.teamRow}>
      <View style={[styles.teamDot, { backgroundColor: team.color, opacity: team.isTbd ? 0.45 : 1 }]} />
      <Text style={[styles.teamAbbr, (winner || leader) && styles.teamStrong, loser && styles.teamMuted]}>{teamLabel(team)}</Text>
      <Text style={[styles.teamName, loser && styles.teamMuted]} numberOfLines={1}>{fullTeamLabel(team)}</Text>
      <Text style={[styles.teamWins, (winner || leader) && styles.teamStrong, loser && styles.teamMuted]}>{wins ?? '—'}</Text>
    </View>
  );
}

interface GameRowProps {
  game: PlayoffSeriesGame;
  onOpenGame: (gameId: string) => void;
}

function GameRow({ game, onOpenGame }: GameRowProps) {
  const isFinal = game.status === 'final';
  const scoreText = isFinal && game.awayScore !== undefined && game.homeScore !== undefined
    ? `${game.awayScore}–${game.homeScore}`
    : game.statusText;
  const content = (
    <View style={styles.gameRowInner}>
      <View style={styles.gameMetaCol}>
        <Text style={styles.gameNumber}>{game.gameNumber}</Text>
        <Text style={styles.gameDate}>{game.dateLabel}</Text>
      </View>
      <View style={styles.gameMatchupCol}>
        <Text style={styles.gameMatchup} numberOfLines={1}>{teamLabel(game.awayTeam)} @ {teamLabel(game.homeTeam)}</Text>
        <Text style={styles.gameStatus} numberOfLines={1}>{game.status === 'scheduled' ? game.statusText : game.status.toUpperCase()}</Text>
      </View>
      <Text style={[styles.gameScore, isFinal && styles.gameScoreFinal]}>{scoreText}</Text>
    </View>
  );

  if (!game.canOpen) {
    return <View style={styles.gameRow}>{content}</View>;
  }

  return (
    <TouchableOpacity style={styles.gameRow} onPress={() => onOpenGame(game.id)} activeOpacity={0.75} accessibilityRole="button" accessibilityLabel={`Open ${game.gameNumber}`}>
      {content}
    </TouchableOpacity>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingTop: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  headerCopy: {
    flex: 1,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: FontSize.xxxl,
    fontWeight: FontWeight.heavy,
    letterSpacing: -0.4,
  },
  subtitle: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    marginTop: 2,
  },
  heroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.cardBg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  heroIconWrap: {
    width: 42,
    height: 42,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.secondaryMuted,
  },
  heroCopy: {
    flex: 1,
  },
  heroTitle: {
    color: Colors.textPrimary,
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
  },
  heroSubtitle: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    marginTop: 3,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.xxxl,
    gap: Spacing.md,
  },
  loadingText: {
    color: Colors.textMuted,
    fontSize: FontSize.md,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.warningMuted,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  errorBannerText: {
    color: Colors.warning,
    fontSize: FontSize.sm,
    flex: 1,
  },
  emptyState: {
    alignItems: 'center',
    padding: Spacing.xxxl,
    gap: Spacing.sm,
  },
  emptyTitle: {
    color: Colors.textSecondary,
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
  },
  emptyText: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    textAlign: 'center',
  },
  roundSection: {
    marginBottom: Spacing.xl,
  },
  roundHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: Spacing.md,
  },
  roundLabel: {
    color: Colors.textPrimary,
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
  },
  roundMeta: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    letterSpacing: 0.5,
  },
  seriesCard: {
    backgroundColor: Colors.cardBg,
    borderWidth: 1,
    borderRadius: BorderRadius.xl,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  seriesTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  seriesAccent: {
    width: 4,
    height: 38,
    borderRadius: BorderRadius.full,
  },
  seriesSummaryWrap: {
    flex: 1,
  },
  seriesMatchup: {
    color: Colors.textPrimary,
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.3,
  },
  seriesSummary: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    marginTop: 2,
  },
  seriesPill: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  seriesPillText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.7,
  },
  teamRows: {
    gap: 6,
  },
  teamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 28,
  },
  teamDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: Spacing.sm,
  },
  teamAbbr: {
    color: Colors.textSecondary,
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    width: 48,
  },
  teamName: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    flex: 1,
  },
  teamWins: {
    color: Colors.textSecondary,
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    minWidth: 20,
    textAlign: 'right',
  },
  teamStrong: {
    color: Colors.textPrimary,
  },
  teamMuted: {
    color: Colors.textMuted,
    opacity: 0.58,
  },
  gamesList: {
    marginTop: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
    gap: Spacing.sm,
  },
  gameRow: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  gameRowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  gameMetaCol: {
    width: 52,
  },
  gameNumber: {
    color: Colors.textSecondary,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
  },
  gameDate: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    marginTop: 2,
  },
  gameMatchupCol: {
    flex: 1,
  },
  gameMatchup: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  gameStatus: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    marginTop: 2,
  },
  gameScore: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    maxWidth: 86,
    textAlign: 'right',
  },
  gameScoreFinal: {
    color: Colors.textPrimary,
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
  },
});
