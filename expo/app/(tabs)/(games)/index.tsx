import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Activity, ChevronRight, Trophy, Users, FlaskConical, WifiOff, CalendarDays } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { Spacing, BorderRadius, FontSize, FontWeight } from '@/constants/theme';
import GameCard from '@/components/GameCard';
import FeaturedRunCard from '@/components/FeaturedRunCard';
import DataSourceBadge from '@/components/DataSourceBadge';
import DateRail from '@/components/DateRail';
import SegmentControl from '@/components/SegmentControl';
import CalendarModal from '@/components/CalendarModal';
import FeedbackButton from '@/components/FeedbackButton';
import { useFeedbackContext } from '@/providers/FeedbackProvider';
import { useScoreboard, useScoreboardByDate } from '@/hooks/useNbaData';
import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import { getTodayDateString } from '@/services/nbaApi';

const LEGACY_SEGMENTS = ['Today', 'Recent', 'All'];

export default function GamesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dateRailEnabled = useFeatureFlag('games_date_rail_enabled');
  const calendarModalEnabled = useFeatureFlag('games_calendar_modal_enabled');
  const sourceBadgesEnabled = useFeatureFlag('games_source_badges_enabled');

  const today = useMemo(() => getTodayDateString(), []);
  const [selectedDate, setSelectedDate] = useState<string>(today);

  if (dateRailEnabled) {
    return (
      <DateDrivenGames
        insets={insets}
        router={router}
        today={today}
        selectedDate={selectedDate}
        setSelectedDate={setSelectedDate}
        calendarModalEnabled={calendarModalEnabled}
        sourceBadgesEnabled={sourceBadgesEnabled}
      />
    );
  }

  return <LegacyGames insets={insets} router={router} sourceBadgesEnabled={sourceBadgesEnabled} />;
}

interface DateDrivenProps {
  insets: { top: number };
  router: ReturnType<typeof useRouter>;
  today: string;
  selectedDate: string;
  setSelectedDate: (d: string) => void;
  calendarModalEnabled: boolean;
  sourceBadgesEnabled: boolean;
}

function DateDrivenGames({ insets, router, today, selectedDate, setSelectedDate, calendarModalEnabled, sourceBadgesEnabled }: DateDrivenProps) {
  const [calendarOpen, setCalendarOpen] = useState<boolean>(false);
  useFeedbackContext({ screen: 'Games', filters: { selectedDate } });
  const {
    games,
    gameDate,
    dataSource,
    dataState,
    liveGames,
    completedGames,
    scheduledGames,
    featuredGame,
    isLoading,
    isError,
    refetch,
    isRefetching,
    isPlaceholderData,
  } = useScoreboardByDate(selectedDate);

  const isToday = selectedDate === today;
  const isInitialLoading = isLoading && games.length === 0;
  const showSourceBadge = sourceBadgesEnabled && !(isError && games.length === 0) && dataState !== 'fallback';

  const handleRefresh = useCallback(() => {
    void refetch();
  }, [refetch]);

  const handleGamePress = useCallback((gameId: string) => {
    router.push(`/game/${gameId}`);
  }, [router]);

  const displayDate = useMemo(() => {
    const src = gameDate || selectedDate;
    const d = new Date(src + 'T12:00:00');
    if (isToday) return `Today · ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  }, [gameDate, selectedDate, isToday]);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={handleRefresh} tintColor={Colors.primary} />}
      >
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.title}>CourtPulse</Text>
            {calendarModalEnabled ? (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setCalendarOpen(true)}
                style={styles.dateHeaderBtn}
                testID="games-open-calendar"
                accessibilityRole="button"
                accessibilityLabel="Open calendar"
              >
                <Text style={styles.subtitle}>{displayDate}</Text>
                <CalendarDays size={14} color={Colors.primary} />
              </TouchableOpacity>
            ) : (
              <Text style={styles.subtitle}>{displayDate}</Text>
            )}
          </View>
          <View style={styles.headerRight}>
            {liveGames.length > 0 ? (
              <View style={styles.statusIndicator}>
                <Activity size={14} color={Colors.positive} />
                <Text style={styles.statusText}>{liveGames.length} Live</Text>
              </View>
            ) : (
              <View style={styles.statusIndicatorIdle}>
                <Text style={styles.statusTextIdle}>NBA</Text>
              </View>
            )}
            {showSourceBadge && <DataSourceBadge source={dataSource} compact />}
          </View>
        </View>

        <DateRail selectedDate={selectedDate} onSelectDate={setSelectedDate} testId="games-date-rail" />

        {!isToday && (
          <TouchableOpacity
            activeOpacity={0.7}
            style={styles.jumpTodayChip}
            onPress={() => setSelectedDate(today)}
            testID="games-jump-today"
          >
            <CalendarDays size={14} color={Colors.primary} />
            <Text style={styles.jumpTodayText}>Jump to Today</Text>
          </TouchableOpacity>
        )}

        {isError && (
          <View style={styles.errorBanner}>
            <WifiOff size={16} color={Colors.warning} />
            <Text style={styles.errorBannerText}>Unable to reach NBA servers. Pull to retry.</Text>
          </View>
        )}

        {isInitialLoading && !isRefetching && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>Loading games…</Text>
          </View>
        )}

        {!isInitialLoading && featuredGame && featuredGame.status !== 'scheduled' && (
          <View style={styles.section}>
            <FeaturedRunCard game={featuredGame} onPress={() => handleGamePress(featuredGame.id)} />
          </View>
        )}

        <View style={styles.feedbackRow}>
          <FeedbackButton variant="pill" type="ux_feedback" label="Send Feedback" testID="games-send-feedback" />
        </View>

        <View style={styles.quickLinks}>
          <TouchableOpacity style={styles.quickLink} onPress={() => router.push('/(tabs)/teams')} activeOpacity={0.7}>
            <Trophy size={18} color={Colors.warning} />
            <Text style={styles.quickLinkText}>Teams</Text>
            <ChevronRight size={14} color={Colors.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickLink} onPress={() => router.push('/(tabs)/players')} activeOpacity={0.7}>
            <Users size={18} color={Colors.secondary} />
            <Text style={styles.quickLinkText}>Players</Text>
            <ChevronRight size={14} color={Colors.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickLink} onPress={() => router.push('/(tabs)/lab')} activeOpacity={0.7}>
            <FlaskConical size={18} color={Colors.accent} />
            <Text style={styles.quickLinkText}>Lab</Text>
            <ChevronRight size={14} color={Colors.textMuted} />
          </TouchableOpacity>
        </View>

        <View style={styles.scoreboardHeaderRow}>
          <Text style={styles.sectionTitle}>Scoreboard</Text>
          <Text style={styles.scoreboardMeta}>{isInitialLoading ? 'Loading…' : isPlaceholderData ? 'Updating…' : `${games.length} ${games.length === 1 ? 'game' : 'games'}`}</Text>
        </View>

        {liveGames.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>LIVE NOW</Text>
            {liveGames.map(game => (
              <GameCard key={game.id} game={game} onPress={() => handleGamePress(game.id)} />
            ))}
          </View>
        )}

        {completedGames.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{isToday ? 'COMPLETED TODAY' : 'FINAL'}</Text>
            {completedGames.map(game => (
              <GameCard key={game.id} game={game} onPress={() => handleGamePress(game.id)} />
            ))}
          </View>
        )}

        {scheduledGames.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>UPCOMING</Text>
            {scheduledGames.map(game => (
              <GameCard key={game.id} game={game} onPress={() => handleGamePress(game.id)} />
            ))}
          </View>
        )}

        {!isInitialLoading && !isRefetching && !isPlaceholderData && games.length === 0 && (
          <View style={styles.emptyState}>
            <CalendarDays size={28} color={Colors.textMuted} />
            <Text style={styles.emptyText}>No games on this date</Text>
            <Text style={styles.emptySubtext}>Pick another day from the date rail above.</Text>
          </View>
        )}
      </ScrollView>
      {calendarModalEnabled && (
        <CalendarModal
          visible={calendarOpen}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          onClose={() => setCalendarOpen(false)}
          testId="games-calendar-modal"
        />
      )}
    </View>
  );
}

interface LegacyProps {
  insets: { top: number };
  router: ReturnType<typeof useRouter>;
  sourceBadgesEnabled: boolean;
}

function LegacyGames({ insets, router, sourceBadgesEnabled }: LegacyProps) {
  const [segment, setSegment] = useState(0);
  const {
    todayGames,
    recentGames,
    allGames,
    liveGames,
    featuredGame,
    gameDate,
    dataSource,
    dataState,
    isLoading,
    isError,
    refetch,
    isRefetching,
  } = useScoreboard();

  const showSourceBadge = sourceBadgesEnabled && !(isError && todayGames.length === 0) && dataState !== 'fallback';

  const games = useMemo(() => {
    if (segment === 0) return todayGames;
    if (segment === 1) return recentGames;
    return allGames;
  }, [segment, todayGames, recentGames, allGames]);

  const liveInView = useMemo(() => games.filter(g => g.status === 'live'), [games]);
  const completedInView = useMemo(() => games.filter(g => g.status === 'final'), [games]);
  const scheduledInView = useMemo(() => games.filter(g => g.status === 'scheduled'), [games]);

  const handleGamePress = useCallback((gameId: string) => {
    router.push(`/game/${gameId}`);
  }, [router]);

  const displayDate = useMemo(() => {
    const src = gameDate || new Date().toISOString().slice(0, 10);
    const d = new Date(src + 'T12:00:00');
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  }, [gameDate]);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} tintColor={Colors.primary} />}
      >
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.title}>CourtPulse</Text>
            <Text style={styles.subtitle}>{displayDate}</Text>
          </View>
          <View style={styles.headerRight}>
            {liveGames.length > 0 ? (
              <View style={styles.statusIndicator}>
                <Activity size={14} color={Colors.positive} />
                <Text style={styles.statusText}>{liveGames.length} Live</Text>
              </View>
            ) : (
              <View style={styles.statusIndicatorIdle}>
                <Text style={styles.statusTextIdle}>NBA</Text>
              </View>
            )}
            {showSourceBadge && <DataSourceBadge source={dataSource} compact />}
          </View>
        </View>

        {isError && (
          <View style={styles.errorBanner}>
            <WifiOff size={16} color={Colors.warning} />
            <Text style={styles.errorBannerText}>Unable to reach NBA servers. Pull to retry.</Text>
          </View>
        )}

        {isLoading && !isRefetching && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>Loading games…</Text>
          </View>
        )}

        {!isLoading && featuredGame && featuredGame.status !== 'scheduled' && (
          <View style={styles.section}>
            <FeaturedRunCard game={featuredGame} onPress={() => handleGamePress(featuredGame.id)} />
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Scoreboard</Text>
          <SegmentControl segments={LEGACY_SEGMENTS} selected={segment} onSelect={setSegment} />
        </View>

        {liveInView.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>LIVE NOW</Text>
            {liveInView.map(game => <GameCard key={game.id} game={game} onPress={() => handleGamePress(game.id)} />)}
          </View>
        )}
        {completedInView.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>FINAL</Text>
            {completedInView.map(game => <GameCard key={game.id} game={game} onPress={() => handleGamePress(game.id)} />)}
          </View>
        )}
        {scheduledInView.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>UPCOMING</Text>
            {scheduledInView.map(game => <GameCard key={game.id} game={game} onPress={() => handleGamePress(game.id)} />)}
          </View>
        )}
      </ScrollView>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingTop: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  headerLeft: {
    flex: 1,
  },
  headerRight: {
    alignItems: 'flex-end',
    gap: 4,
    marginTop: Spacing.sm,
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
  dateHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.positiveMuted,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  statusText: {
    color: Colors.positive,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
  },
  statusIndicatorIdle: {
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  statusTextIdle: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    letterSpacing: 1,
  },
  jumpTodayChip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    marginBottom: Spacing.lg,
  },
  jumpTodayText: {
    color: Colors.primary,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.5,
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
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.xxxl,
    gap: Spacing.md,
  },
  loadingText: {
    color: Colors.textMuted,
    fontSize: FontSize.md,
  },
  feedbackRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: Spacing.md,
  },
  quickLinks: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  quickLink: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.cardBg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
  },
  quickLinkText: {
    color: Colors.textSecondary,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    flex: 1,
  },
  section: {
    marginBottom: Spacing.lg,
  },
  scoreboardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: Spacing.md,
  },
  scoreboardMeta: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    letterSpacing: 0.5,
  },
  sectionTitle: {
    color: Colors.textPrimary,
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
  },
  sectionLabel: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    letterSpacing: 1.5,
    marginBottom: Spacing.md,
  },
  emptyState: {
    padding: Spacing.xxxl,
    alignItems: 'center',
    gap: Spacing.xs,
  },
  emptyText: {
    color: Colors.textSecondary,
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    marginTop: Spacing.sm,
  },
  emptySubtext: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    textAlign: 'center',
  },
});
