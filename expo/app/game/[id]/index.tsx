import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, useWindowDimensions, ActivityIndicator, Modal, TextInput, Pressable, Animated } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, ChevronRight, WifiOff, Search, X, ChevronDown, ChevronUp, Users, Filter, Crosshair, Link2, Target } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { Spacing, BorderRadius, FontSize, FontWeight } from '@/constants/theme';
import SegmentControl from '@/components/SegmentControl';
import SubTabBar from '@/components/SubTabBar';
import StatBar from '@/components/StatBar';
import PlayByPlayItem from '@/components/PlayByPlayItem';
import GamePlayByPlayV1 from '@/components/GamePlayByPlayV1';
import ShotChart from '@/components/ShotChart';
import ScoringRunCard from '@/components/ScoringRunCard';
import StretchCard from '@/components/StretchCard';
import MatchupTab from '@/components/MatchupTab';
import MatchupRealDataTab from '@/components/MatchupRealDataTab';
import DataSourceBadge from '@/components/DataSourceBadge';
import FilterChip from '@/components/FilterChip';
import { useGameDetail, useGameAnalytics } from '@/hooks/useNbaData';
import type { DataSource } from '@/services/dataProvider';
import { useQueryClient } from '@tanstack/react-query';
import type { Game } from '@/types';
import { MATCHUP_HOME_STATS, MATCHUP_AWAY_STATS, CONTEXTUAL_MATCHUPS, PLAYER_MATCHUPS, EDGE_SUMMARY } from '@/mocks/matchups';
import { BoxScorePlayer, ScoringRun, ScoringDrought, LineupSegment, CustomMetric, ReconciliationAudit, CanonicalTimelineSegment, GameFlowContext, OnOffRatingStats, OnCourtDetailedStats, OnCourtConfidence, ConfidenceLevel, OnOffConfidenceLevel } from '@/types';
import type { OnCourtValidationSnapshot } from '@/types/metricValidation';
import { buildOnCourtValidationSnapshot } from '@/utils/metricValidation';
import { normalizeShotEvents, filterShots, summarizeShots, getShotEventUrl } from '@/analytics/shots';
import type { CanonicalShotEvent, ShotQuery, ShotQuerySummary, ShotZone } from '@/analytics/shots';
import * as WebBrowser from 'expo-web-browser';
import { CdnPbpAction } from '@/services/nbaGameData';
import { reconstructPlayerIntervals, computeCanonicalOnCourtSummary, computeReconciliationAudit, computeOnCourtDetailedStats, computeGameFlowContext, computeOnOffRating, computeConfidence } from '@/services/analyticsEngine';
import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import OnCourtSummaryDetailSheet from '@/components/OnCourtSummaryDetailSheet';
import FeedbackButton from '@/components/FeedbackButton';
import { useFeedbackContext } from '@/providers/FeedbackProvider';
import { safeBack } from '@/utils/navigation';

const TABS = ['Summary', 'Matchup', 'PBP', 'Shots', 'Analytics'];
const TAB_NAMES = ['Summary', 'Matchup', 'PBP', 'Shots', 'Analytics'];
const ANALYTICS_SUB_NAMES = ['Runs', 'Droughts', 'Lineups', 'Impact'];
const PBP_FILTERS = ['All', 'Scores', 'Turnovers', 'Fouls', 'Steals', 'Blocks'];
const ANALYTICS_SUBS = ['Runs', 'Droughts', 'Lineups', 'Impact'];

function formatPlayoffMeta(game: Game): string {
  const gameNumber = game.seriesGameNumber?.trim();
  const seriesText = game.seriesText?.trim();
  return [gameNumber, seriesText].filter(Boolean).join(' · ');
}

function displayTeamAbbr(abbreviation: string | undefined): string {
  const value = abbreviation?.trim();
  return value || 'TBD';
}

function displayTeamName(name: string | undefined): string {
  const value = name?.trim();
  return value || 'Finals Team TBD';
}

export default function GameDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const [activeTab, setActiveTab] = useState(0);
  const [pbpFilter, setPbpFilter] = useState('All');
  const [summaryTeamTab, setSummaryTeamTab] = useState(2);

  const [analyticsSubTab, setAnalyticsSubTab] = useState(0);

  const queryClient = useQueryClient();
  const cachedGame = useMemo<Game | undefined>(() => {
    if (!id) return undefined;
    const queries = queryClient.getQueriesData<unknown>({ queryKey: ['scoreboard'] });
    for (const [, data] of queries) {
      const d = data as { data?: { games?: Game[] } | Game[] } | undefined;
      const games: Game[] | undefined = Array.isArray(d?.data) ? (d?.data as Game[]) : (d?.data as { games?: Game[] } | undefined)?.games;
      if (Array.isArray(games)) {
        const found = games.find(g => g?.id === id);
        if (found) return found;
      }
    }
    return undefined;
  }, [id, queryClient]);

  const {
    game: loadedGame,
    homeBoxScore,
    awayBoxScore,
    homeTeamStats,
    awayTeamStats,
    events,
    rawActions,
    boxScoreSource,
    pbpSource,
    isLoading,
    isError,
    refetch,
  } = useGameDetail(id ?? '');

  const game = loadedGame ?? cachedGame;

  const analytics = useGameAnalytics(
    events,
    rawActions,
    game?.homeTeam?.id ?? '',
    game?.awayTeam?.id ?? '',
    game?.homeTeam?.abbreviation ?? '',
    game?.awayTeam?.abbreviation ?? '',
    homeBoxScore,
    awayBoxScore,
  );

  const canonicalShotEvents = useMemo<CanonicalShotEvent[]>(() => {
    if (!game || rawActions.length === 0) return [];
    return normalizeShotEvents(rawActions, id ?? '', game.homeTeam.id, game.awayTeam.id);
  }, [rawActions, id, game]);

  const filteredPbp = useMemo(() => {
    if (pbpFilter === 'All') return events;
    const filterMap: Record<string, string[]> = {
      'Scores': ['score'],
      'Turnovers': ['turnover'],
      'Fouls': ['foul'],
      'Steals': ['steal'],
      'Blocks': ['block'],
    };
    const types = filterMap[pbpFilter] ?? [];
    return events.filter(e => types.includes(e.eventType));
  }, [pbpFilter, events]);

  const handleBack = useCallback(() => {
    safeBack(router, '/(tabs)/(games)');
  }, [router]);

  const playerPerformanceEnabled = useFeatureFlag('player_performance_screen_enabled');
  const matchupRealDataEnabled = useFeatureFlag('matchup_screen_real_data_enabled');
  const pbpFiltersV1Enabled = useFeatureFlag('enablePbpFiltersV1');

  const subscreen = activeTab === 4 ? ANALYTICS_SUB_NAMES[analyticsSubTab] ?? undefined : undefined;
  useFeedbackContext({
    screen: 'GameDetail',
    subscreen: `${TAB_NAMES[activeTab] ?? 'Summary'}${subscreen ? `:${subscreen}` : ''}`,
    gameId: id,
    filters: {
      pbpFilter,
      summaryTeamTab,
      analyticsSubTab,
    },
    extra: {
      matchup: game ? `${game.awayTeam?.abbreviation} @ ${game.homeTeam?.abbreviation}` : undefined,
    },
  });

  const handleTabChange = useCallback((index: number) => {
    setActiveTab(index);
  }, []);

  const handlePlayerPress = useCallback((playerId: string) => {
    if (!playerPerformanceEnabled) return;
    console.log('[GameDetail] Navigating to player performance: gameId=%s playerId=%s', id, playerId);
    router.push(`/game/${id}/player/${playerId}`);
  }, [playerPerformanceEnabled, id, router]);

  const effectiveGame = game;
  const isScheduled = effectiveGame?.status === 'scheduled';

  if (isLoading && !effectiveGame) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <View style={styles.headerBar}>
          <TouchableOpacity onPress={handleBack} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <ChevronLeft size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Loading...</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading game data...</Text>
        </View>
      </View>
    );
  }

  if ((isError || !game) && !isScheduled) {
    if (!effectiveGame) {
      return (
        <View style={[styles.screen, { paddingTop: insets.top }]}>
          <View style={styles.headerBar}>
            <TouchableOpacity onPress={handleBack} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <ChevronLeft size={24} color={Colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Game</Text>
            <View style={{ width: 40 }} />
          </View>
          <View style={styles.errorContainer}>
            <WifiOff size={32} color={Colors.textMuted} />
            <Text style={styles.errorText}>Unable to load game data</Text>
            <Text style={styles.errorSubtext}>This game may not be available yet or the NBA servers are unreachable.</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={refetch}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }
  }

  if (isScheduled && effectiveGame) {
    const sAwayAbbr = displayTeamAbbr(effectiveGame.awayTeam.abbreviation);
    const sHomeAbbr = displayTeamAbbr(effectiveGame.homeTeam.abbreviation);
    const sAwayName = displayTeamName(effectiveGame.awayTeam.name);
    const sHomeName = displayTeamName(effectiveGame.homeTeam.name);
    const tipoff = effectiveGame.clock || effectiveGame.period || '';
    const arena = effectiveGame.arena || '';
    const playoffMeta = formatPlayoffMeta(effectiveGame);
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <View style={styles.headerBar}>
          <TouchableOpacity onPress={handleBack} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <ChevronLeft size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>{sAwayAbbr} @ {sHomeAbbr}</Text>
          </View>
          <FeedbackButton
            variant="icon"
            type="bug"
            title={`Bug: ${sAwayAbbr} @ ${sHomeAbbr}`}
            testID="game-report-bug"
          />
        </View>

        <View style={scheduledStyles.header}>
          <View style={scheduledStyles.teamCol}>
            <View style={[styles.teamColorBar, { backgroundColor: effectiveGame.awayTeam.primaryColor }]} />
            <Text style={scheduledStyles.teamAbbr}>{sAwayAbbr}</Text>
            <Text style={scheduledStyles.teamName}>{sAwayName}</Text>
          </View>
          <View style={scheduledStyles.middle}>
            <View style={scheduledStyles.scheduledBadge}>
              <Text style={scheduledStyles.scheduledBadgeText}>SCHEDULED</Text>
            </View>
            {tipoff ? <Text style={scheduledStyles.tipoffText}>{tipoff}</Text> : null}
            {playoffMeta ? <Text style={scheduledStyles.seriesText} numberOfLines={2}>{playoffMeta}</Text> : null}
            <Text style={scheduledStyles.vsText}>vs</Text>
            {arena ? <Text style={scheduledStyles.arenaText} numberOfLines={1}>{arena}</Text> : null}
          </View>
          <View style={scheduledStyles.teamCol}>
            <View style={[styles.teamColorBar, { backgroundColor: effectiveGame.homeTeam.primaryColor }]} />
            <Text style={scheduledStyles.teamAbbr}>{sHomeAbbr}</Text>
            <Text style={scheduledStyles.teamName}>{sHomeName}</Text>
          </View>
        </View>

        <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {matchupRealDataEnabled ? (
            <MatchupRealDataTab
              homeTeam={effectiveGame.homeTeam}
              awayTeam={effectiveGame.awayTeam}
              homeTeamStats={homeTeamStats}
              awayTeamStats={awayTeamStats}
              homeBoxScore={homeBoxScore}
              awayBoxScore={awayBoxScore}
              status={effectiveGame.status}
            />
          ) : (
            <View>
              <DataSourceBadge source="demo" />
              <Text style={styles.demoNotice}>Pre-game matchup view. Showing sample data below.</Text>
              <MatchupTab
                homeStats={MATCHUP_HOME_STATS}
                awayStats={MATCHUP_AWAY_STATS}
                contextual={CONTEXTUAL_MATCHUPS}
                playerMatchups={PLAYER_MATCHUPS}
                edgeSummary={EDGE_SUMMARY}
              />
            </View>
          )}
        </ScrollView>
      </View>
    );
  }

  if (!game) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <View style={styles.headerBar}>
          <TouchableOpacity onPress={handleBack} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <ChevronLeft size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Game</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.errorContainer}>
          <WifiOff size={32} color={Colors.textMuted} />
          <Text style={styles.errorText}>Game data unavailable</Text>
          <Text style={styles.errorSubtext}>No boxscore or schedule data is available for this game yet.</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={refetch}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const isLive = game.status === 'live';
  const homeAbbr = displayTeamAbbr(game.homeTeam.abbreviation);
  const awayAbbr = displayTeamAbbr(game.awayTeam.abbreviation);
  const playoffMeta = formatPlayoffMeta(game);
  const summaryTeamTabs = [homeAbbr, awayAbbr, 'Both'];


  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={handleBack} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <ChevronLeft size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{awayAbbr} @ {homeAbbr}</Text>
          <DataSourceBadge source={boxScoreSource} compact />
        </View>
        <FeedbackButton
          variant="icon"
          type="bug"
          title={`Bug: ${awayAbbr} @ ${homeAbbr}`}
          testID="game-report-bug"
        />
      </View>

      <View style={styles.scoreHeader}>
        <View style={styles.teamScoreCol}>
          <View style={[styles.teamColorBar, { backgroundColor: game.awayTeam.primaryColor }]} />
          <Text style={styles.teamScoreAbbr}>{awayAbbr}</Text>
          <Text style={styles.teamScoreValue}>{game.awayTeam.score}</Text>
        </View>
        <View style={styles.gameInfo}>
          {isLive && (
            <View style={styles.liveBadge}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>LIVE</Text>
            </View>
          )}
          <Text style={styles.periodInfo}>{game.period}{game.clock ? ` · ${game.clock}` : ''}</Text>
          {playoffMeta ? <Text style={styles.seriesInfo} numberOfLines={2}>{playoffMeta}</Text> : null}
          <Text style={styles.arenaInfo}>{game.arena}</Text>
        </View>
        <View style={styles.teamScoreCol}>
          <View style={[styles.teamColorBar, { backgroundColor: game.homeTeam.primaryColor }]} />
          <Text style={styles.teamScoreAbbr}>{homeAbbr}</Text>
          <Text style={styles.teamScoreValue}>{game.homeTeam.score}</Text>
        </View>
      </View>

      <View style={styles.tabContainer}>
        <SegmentControl segments={TABS} selected={activeTab} onSelect={handleTabChange} />
      </View>

      <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {activeTab === 0 && (
          <SummaryTab
            game={game}
            homeBoxScore={homeBoxScore}
            awayBoxScore={awayBoxScore}
            homeTeamStats={homeTeamStats}
            awayTeamStats={awayTeamStats}
            teamTabs={summaryTeamTabs}
            selectedTeamTab={summaryTeamTab}
            onTeamTabChange={setSummaryTeamTab}
            gameId={id}
            onPlayerPress={playerPerformanceEnabled ? handlePlayerPress : undefined}
          />
        )}
        {activeTab === 1 && (
          matchupRealDataEnabled ? (
            <View>
              <DataSourceBadge source={boxScoreSource} />
              <MatchupRealDataTab
                homeTeam={game.homeTeam}
                awayTeam={game.awayTeam}
                homeTeamStats={homeTeamStats}
                awayTeamStats={awayTeamStats}
                homeBoxScore={homeBoxScore}
                awayBoxScore={awayBoxScore}
                status={game.status}
                rawActions={rawActions}
                gameId={id}
              />
            </View>
          ) : (
            <View>
              <DataSourceBadge source="demo" />
              <Text style={styles.demoNotice}>Matchup intelligence requires the Python backend. Showing sample data below.</Text>
              <MatchupTab
                homeStats={MATCHUP_HOME_STATS}
                awayStats={MATCHUP_AWAY_STATS}
                contextual={CONTEXTUAL_MATCHUPS}
                playerMatchups={PLAYER_MATCHUPS}
                edgeSummary={EDGE_SUMMARY}
              />
            </View>
          )
        )}
        {activeTab === 2 && (
          pbpFiltersV1Enabled ? (
            <GamePlayByPlayV1
              events={events}
              pbpSource={pbpSource}
              gameStatus={game.status}
              homeTeamId={game.homeTeam.id}
              awayTeamId={game.awayTeam.id}
              homeAbbr={homeAbbr}
              awayAbbr={awayAbbr}
            />
          ) : (
            <View>
              {events.length > 0 && <DataSourceBadge source={pbpSource} />}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={styles.filterRowContent}>
                {PBP_FILTERS.map(f => (
                  <FilterChip key={f} label={f} active={pbpFilter === f} onPress={() => setPbpFilter(f)} />
                ))}
              </ScrollView>
              {filteredPbp.map(event => (
                <PlayByPlayItem key={event.id} event={event} homeAbbr={homeAbbr} />
              ))}
              {filteredPbp.length === 0 && events.length === 0 && (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyText}>Play-by-play not available for this game</Text>
                  <Text style={styles.emptySubtext}>Data will appear once the game starts or for completed games</Text>
                </View>
              )}
              {filteredPbp.length === 0 && events.length > 0 && (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyText}>No events match this filter</Text>
                </View>
              )}
            </View>
          )
        )}
        {activeTab === 3 && (
          <ShotsTab
            rawActions={rawActions}
            canonicalShots={canonicalShotEvents}
            gameId={id ?? ''}
            screenWidth={screenWidth}
            pbpSource={pbpSource}
            homeTeamId={game.homeTeam.id}
            awayTeamId={game.awayTeam.id}
            homeAbbr={homeAbbr}
            awayAbbr={awayAbbr}
            homeBoxScore={homeBoxScore}
            awayBoxScore={awayBoxScore}
          />
        )}
        {activeTab === 4 && (
          <AnalyticsTab
            runs={analytics.runs}
            droughts={analytics.droughts}
            lineups={analytics.lineups}
            metrics={analytics.metrics}
            hasEvents={events.length > 0}
            selectedSubTab={analyticsSubTab}
            onSubTabChange={setAnalyticsSubTab}
            rawActions={rawActions}
            gameId={id ?? ''}
            homeTeamId={game.homeTeam.id}
            awayTeamId={game.awayTeam.id}
            homeBoxScore={homeBoxScore}
            awayBoxScore={awayBoxScore}
            homeTimeline={analytics.timelines?.homeTimeline}
            awayTimeline={analytics.timelines?.awayTimeline}
            homeStarters={analytics.homeStarters}
            awayStarters={analytics.awayStarters}
            analyticsSource={pbpSource}
          />
        )}
      </ScrollView>
    </View>
  );
}

function SummaryTab({ game, homeBoxScore, awayBoxScore, homeTeamStats, awayTeamStats, teamTabs, selectedTeamTab, onTeamTabChange, gameId, onPlayerPress }: {
  game: { homeTeam: { abbreviation: string; score: number; primaryColor: string }; awayTeam: { abbreviation: string; score: number; primaryColor: string } };
  homeBoxScore: BoxScorePlayer[];
  awayBoxScore: BoxScorePlayer[];
  homeTeamStats: Record<string, number>;
  awayTeamStats: Record<string, number>;
  teamTabs: string[];
  selectedTeamTab: number;
  onTeamTabChange: (index: number) => void;
  gameId?: string;
  onPlayerPress?: (playerId: string) => void;
}) {
  const hasStats = Object.keys(homeTeamStats).length > 1;
  const showHome = selectedTeamTab === 0 || selectedTeamTab === 2;
  const showAway = selectedTeamTab === 1 || selectedTeamTab === 2;
  const showBoth = selectedTeamTab === 2;

  return (
    <View>
      <SubTabBar tabs={teamTabs} selected={selectedTeamTab} onSelect={onTeamTabChange} />

      {showBoth && hasStats && (
        <>
          <Text style={styles.sectionLabel}>TEAM COMPARISON</Text>
          <View style={styles.card}>
            <StatBar label="Points" homeValue={homeTeamStats.points ?? game.homeTeam.score} awayValue={awayTeamStats.points ?? game.awayTeam.score} homeColor={game.homeTeam.primaryColor} awayColor={game.awayTeam.primaryColor} />
            <StatBar label="FG%" homeValue={Math.round((homeTeamStats.fieldGoalsPercentage ?? 0) * 10) / 10} awayValue={Math.round((awayTeamStats.fieldGoalsPercentage ?? 0) * 10) / 10} homeColor={game.homeTeam.primaryColor} awayColor={game.awayTeam.primaryColor} isPercentage />
            <StatBar label="3PT%" homeValue={Math.round((homeTeamStats.threePointersPercentage ?? 0) * 10) / 10} awayValue={Math.round((awayTeamStats.threePointersPercentage ?? 0) * 10) / 10} homeColor={game.homeTeam.primaryColor} awayColor={game.awayTeam.primaryColor} isPercentage />
            <StatBar label="Rebounds" homeValue={homeTeamStats.reboundsTotal ?? 0} awayValue={awayTeamStats.reboundsTotal ?? 0} homeColor={game.homeTeam.primaryColor} awayColor={game.awayTeam.primaryColor} />
            <StatBar label="Off. Reb" homeValue={homeTeamStats.reboundsOffensive ?? 0} awayValue={awayTeamStats.reboundsOffensive ?? 0} homeColor={game.homeTeam.primaryColor} awayColor={game.awayTeam.primaryColor} />
            <StatBar label="Def. Reb" homeValue={homeTeamStats.reboundsDefensive ?? 0} awayValue={awayTeamStats.reboundsDefensive ?? 0} homeColor={game.homeTeam.primaryColor} awayColor={game.awayTeam.primaryColor} />
            <StatBar label="Assists" homeValue={homeTeamStats.assists ?? 0} awayValue={awayTeamStats.assists ?? 0} homeColor={game.homeTeam.primaryColor} awayColor={game.awayTeam.primaryColor} />
            <StatBar label="Turnovers" homeValue={homeTeamStats.turnovers ?? 0} awayValue={awayTeamStats.turnovers ?? 0} homeColor={game.homeTeam.primaryColor} awayColor={game.awayTeam.primaryColor} />
            <StatBar label="Steals" homeValue={homeTeamStats.steals ?? 0} awayValue={awayTeamStats.steals ?? 0} homeColor={game.homeTeam.primaryColor} awayColor={game.awayTeam.primaryColor} />
            <StatBar label="Blocks" homeValue={homeTeamStats.blocks ?? 0} awayValue={awayTeamStats.blocks ?? 0} homeColor={game.homeTeam.primaryColor} awayColor={game.awayTeam.primaryColor} />
            <StatBar label="Paint PTS" homeValue={homeTeamStats.pointsInThePaint ?? 0} awayValue={awayTeamStats.pointsInThePaint ?? 0} homeColor={game.homeTeam.primaryColor} awayColor={game.awayTeam.primaryColor} />
            <StatBar label="Fast Break" homeValue={homeTeamStats.pointsFastBreak ?? 0} awayValue={awayTeamStats.pointsFastBreak ?? 0} homeColor={game.homeTeam.primaryColor} awayColor={game.awayTeam.primaryColor} />
          </View>
        </>
      )}

      {!showBoth && hasStats && (
        <>
          <Text style={styles.sectionLabel}>TEAM STATS</Text>
          <TeamStatsSingle
            stats={selectedTeamTab === 0 ? homeTeamStats : awayTeamStats}
            score={selectedTeamTab === 0 ? game.homeTeam.score : game.awayTeam.score}
            color={selectedTeamTab === 0 ? game.homeTeam.primaryColor : game.awayTeam.primaryColor}
          />
        </>
      )}

      {showBoth && !hasStats && (
        <View style={styles.card}>
          <StatBar label="Points" homeValue={game.homeTeam.score} awayValue={game.awayTeam.score} homeColor={game.homeTeam.primaryColor} awayColor={game.awayTeam.primaryColor} />
        </View>
      )}

      {showBoth && homeBoxScore.length > 0 && (
        <>
          <Text style={styles.sectionLabel}>{game.homeTeam.abbreviation} BOX SCORE</Text>
          <BoxScoreTable players={homeBoxScore} gameId={gameId} onPlayerPress={onPlayerPress} />
        </>
      )}

      {showBoth && awayBoxScore.length > 0 && (
        <>
          <Text style={styles.sectionLabel}>{game.awayTeam.abbreviation} BOX SCORE</Text>
          <BoxScoreTable players={awayBoxScore} gameId={gameId} onPlayerPress={onPlayerPress} />
        </>
      )}

      {showHome && !showBoth && homeBoxScore.length > 0 && (
        <>
          <Text style={styles.sectionLabel}>BOX SCORE</Text>
          <BoxScoreTable players={homeBoxScore} gameId={gameId} onPlayerPress={onPlayerPress} />
        </>
      )}

      {showAway && !showBoth && awayBoxScore.length > 0 && (
        <>
          <Text style={styles.sectionLabel}>BOX SCORE</Text>
          <BoxScoreTable players={awayBoxScore} gameId={gameId} onPlayerPress={onPlayerPress} />
        </>
      )}

      {homeBoxScore.length === 0 && awayBoxScore.length === 0 && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Box score not available yet</Text>
          <Text style={styles.emptySubtext}>Stats will appear once the game starts</Text>
        </View>
      )}
    </View>
  );
}

function TeamStatsSingle({ stats, score, color }: {
  stats: Record<string, number>;
  score: number;
  color: string;
}) {
  const statRows: Array<{ label: string; value: string }> = useMemo(() => {
    return [
      { label: 'Points', value: String(stats.points ?? score) },
      { label: 'FG%', value: `${((stats.fieldGoalsPercentage ?? 0)).toFixed(1)}%` },
      { label: '3PT%', value: `${((stats.threePointersPercentage ?? 0)).toFixed(1)}%` },
      { label: 'Rebounds', value: String(stats.reboundsTotal ?? 0) },
      { label: 'Off. Reb', value: String(stats.reboundsOffensive ?? 0) },
      { label: 'Def. Reb', value: String(stats.reboundsDefensive ?? 0) },
      { label: 'Assists', value: String(stats.assists ?? 0) },
      { label: 'Turnovers', value: String(stats.turnovers ?? 0) },
      { label: 'Steals', value: String(stats.steals ?? 0) },
      { label: 'Blocks', value: String(stats.blocks ?? 0) },
      { label: 'Paint PTS', value: String(stats.pointsInThePaint ?? 0) },
      { label: 'Fast Break', value: String(stats.pointsFastBreak ?? 0) },
    ];
  }, [stats, score]);

  return (
    <View style={styles.card}>
      {statRows.map((row) => (
        <View key={row.label} style={styles.singleStatRow}>
          <Text style={styles.singleStatLabel}>{row.label}</Text>
          <View style={styles.singleStatValueWrap}>
            <View style={[styles.singleStatDot, { backgroundColor: color }]} />
            <Text style={styles.singleStatValue}>{row.value}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function BoxScoreTable({ players, gameId, onPlayerPress }: { players: BoxScorePlayer[]; gameId?: string; onPlayerPress?: (playerId: string) => void }) {
  return (
    <View style={styles.boxCard}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          <View style={styles.boxHeader}>
            <Text style={[styles.boxCell, styles.boxNameCell, styles.boxHeaderText]}>Player</Text>
            <Text style={[styles.boxCell, styles.boxHeaderText]}>MIN</Text>
            <Text style={[styles.boxCell, styles.boxHeaderText]}>PTS</Text>
            <Text style={[styles.boxCell, styles.boxHeaderText]}>REB</Text>
            <Text style={[styles.boxCell, styles.boxHeaderText]}>OREB</Text>
            <Text style={[styles.boxCell, styles.boxHeaderText]}>DREB</Text>
            <Text style={[styles.boxCell, styles.boxHeaderText]}>AST</Text>
            <Text style={[styles.boxCell, styles.boxHeaderText]}>STL</Text>
            <Text style={[styles.boxCell, styles.boxHeaderText]}>BLK</Text>
            <Text style={[styles.boxCell, styles.boxHeaderText]}>FG</Text>
            <Text style={[styles.boxCell, styles.boxHeaderText]}>3PT</Text>
            <Text style={[styles.boxCell, styles.boxHeaderText]}>+/-</Text>
          </View>
          {players.map((p) => {
            const RowWrapper = onPlayerPress ? TouchableOpacity : View;
            const rowProps = onPlayerPress
              ? { onPress: () => onPlayerPress(p.playerId), activeOpacity: 0.6 }
              : {};
            return (
              <RowWrapper key={p.playerId} style={styles.boxRow} {...(rowProps as any)}>
                <View style={[styles.boxNameCell]}>
                  <Text style={[styles.boxPlayerName, onPlayerPress ? styles.boxPlayerNameTappable : undefined]}>{p.name}</Text>
                  <Text style={styles.boxPlayerPos}>{p.position}</Text>
                </View>
                <Text style={styles.boxCell}>{p.minutes.split(':')[0]}</Text>
                <Text style={[styles.boxCell, styles.boxBold]}>{p.points}</Text>
                <Text style={[styles.boxCell, styles.boxBold]}>{p.rebounds}</Text>
                <Text style={styles.boxCell}>{p.offensiveRebounds ?? 0}</Text>
                <Text style={styles.boxCell}>{p.defensiveRebounds ?? 0}</Text>
                <Text style={styles.boxCell}>{p.assists}</Text>
                <Text style={styles.boxCell}>{p.steals}</Text>
                <Text style={styles.boxCell}>{p.blocks}</Text>
                <Text style={styles.boxCell}>{p.fgm}-{p.fga}</Text>
                <Text style={styles.boxCell}>{p.tpm}-{p.tpa}</Text>
                <Text style={[styles.boxCell, { color: p.plusMinus >= 0 ? Colors.positive : Colors.negative }]}>
                  {p.plusMinus > 0 ? '+' : ''}{p.plusMinus}
                </Text>
              </RowWrapper>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const SHOT_RESULT_FILTERS = ['All', 'Makes', 'Misses'] as const;
const SHOT_ZONE_FILTERS_BASE = ['All', 'Rim', 'Mid', '3PT'] as const;
const SHOT_ZONE_FILTERS_WITH_FT = ['All', 'Rim', 'Mid', '3PT', 'FT'] as const;

function ShotsPlayerSheet({
  visible,
  onClose,
  players,
  selectedId,
  onSelect,
  shots,
}: {
  visible: boolean;
  onClose: () => void;
  players: Array<[string, string]>;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  shots: CanonicalShotEvent[];
}) {
  const [search, setSearch] = useState<string>('');
  const insets = useSafeAreaInsets();

  const playerStats = useMemo(() => {
    const map = new Map<string, { makes: number; attempts: number }>();
    for (const shot of shots) {
      if (!shot.playerId) continue;
      const existing = map.get(shot.playerId) ?? { makes: 0, attempts: 0 };
      existing.attempts++;
      if (shot.result === 'make') existing.makes++;
      map.set(shot.playerId, existing);
    }
    return players
      .map(([id, name]) => {
        const stat = map.get(id) ?? { makes: 0, attempts: 0 };
        return { id, name, ...stat };
      })
      .sort((a, b) => b.attempts - a.attempts);
  }, [players, shots]);

  const filtered = useMemo(() => {
    if (!search.trim()) return playerStats;
    const q = search.toLowerCase();
    return playerStats.filter(p => p.name.toLowerCase().includes(q));
  }, [playerStats, search]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.sheetOverlay}>
        <Pressable style={styles.sheetDismiss} onPress={onClose} />
        <View style={[styles.sheetContainer, { paddingBottom: insets.bottom + Spacing.md }]}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Filter by Player</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <X size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <View style={styles.sheetSearchBar}>
            <Search size={14} color={Colors.textMuted} />
            <TextInput
              style={styles.sheetSearchInput}
              placeholder="Search players..."
              placeholderTextColor={Colors.textMuted}
              value={search}
              onChangeText={setSearch}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
          {selectedId && (
            <TouchableOpacity
              style={shotStyles.sheetClearRow}
              onPress={() => { onSelect(null); onClose(); }}
              activeOpacity={0.7}
            >
              <Text style={shotStyles.sheetClearRowText}>Clear player filter</Text>
            </TouchableOpacity>
          )}
          <ScrollView style={styles.sheetList} showsVerticalScrollIndicator={false}>
            {filtered.map(p => {
              const isSelected = selectedId === p.id;
              const fgPct = p.attempts > 0 ? Math.round((p.makes / p.attempts) * 1000) / 10 : null;
              return (
                <TouchableOpacity
                  key={p.id}
                  style={[styles.sheetPlayerRow, isSelected && styles.sheetPlayerRowSelected]}
                  onPress={() => { onSelect(p.id); onClose(); }}
                  activeOpacity={0.6}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.sheetPlayerName, isSelected && styles.sheetPlayerNameSelected]}>
                      {p.name}
                    </Text>
                  </View>
                  <Text style={shotStyles.sheetPlayerStat}>
                    {p.makes}/{p.attempts}
                  </Text>
                  <Text style={[
                    shotStyles.sheetPlayerPct,
                    { color: fgPct !== null && fgPct >= 50 ? Colors.positive : fgPct !== null && fgPct < 35 ? Colors.negative : Colors.textSecondary },
                  ]}>
                    {fgPct !== null ? `${fgPct}%` : '—'}
                  </Text>
                  {isSelected && (
                    <View style={styles.sheetCheckmark}>
                      <Text style={styles.sheetCheckmarkText}>✓</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function FacilitatorSheet({
  visible,
  onClose,
  facilitators,
  selectedId,
  onSelect,
  shots,
}: {
  visible: boolean;
  onClose: () => void;
  facilitators: Array<[string, string]>;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  shots: CanonicalShotEvent[];
}) {
  const [search, setSearch] = useState<string>('');
  const insets = useSafeAreaInsets();

  const facilitatorStats = useMemo(() => {
    const map = new Map<string, { assists: number; makes: number }>();
    for (const shot of shots) {
      if (!shot.assisterId || shot.result !== 'make') continue;
      const existing = map.get(shot.assisterId) ?? { assists: 0, makes: 0 };
      existing.assists++;
      existing.makes++;
      map.set(shot.assisterId, existing);
    }
    return facilitators
      .map(([id, name]) => {
        const stat = map.get(id) ?? { assists: 0, makes: 0 };
        return { id, name, ...stat };
      })
      .sort((a, b) => b.assists - a.assists);
  }, [facilitators, shots]);

  const filtered = useMemo(() => {
    if (!search.trim()) return facilitatorStats;
    const q = search.toLowerCase();
    return facilitatorStats.filter(p => p.name.toLowerCase().includes(q));
  }, [facilitatorStats, search]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.sheetOverlay}>
        <Pressable style={styles.sheetDismiss} onPress={onClose} />
        <View style={[styles.sheetContainer, { paddingBottom: insets.bottom + Spacing.md }]}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Filter by Facilitator</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <X size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <View style={styles.sheetSearchBar}>
            <Search size={14} color={Colors.textMuted} />
            <TextInput
              style={styles.sheetSearchInput}
              placeholder="Search facilitators..."
              placeholderTextColor={Colors.textMuted}
              value={search}
              onChangeText={setSearch}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
          {selectedId && (
            <TouchableOpacity
              style={shotStyles.sheetClearRow}
              onPress={() => { onSelect(null); onClose(); }}
              activeOpacity={0.7}
            >
              <Text style={shotStyles.sheetClearRowText}>Clear facilitator filter</Text>
            </TouchableOpacity>
          )}
          <ScrollView style={styles.sheetList} showsVerticalScrollIndicator={false}>
            {filtered.map(p => {
              const isSelected = selectedId === p.id;
              return (
                <TouchableOpacity
                  key={p.id}
                  style={[styles.sheetPlayerRow, isSelected && styles.sheetPlayerRowSelected]}
                  onPress={() => { onSelect(p.id); onClose(); }}
                  activeOpacity={0.6}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.sheetPlayerName, isSelected && styles.sheetPlayerNameSelected]}>
                      {p.name}
                    </Text>
                  </View>
                  <Text style={shotStyles.sheetPlayerStat}>
                    {p.assists} ast
                  </Text>
                  {isSelected && (
                    <View style={styles.sheetCheckmark}>
                      <Text style={styles.sheetCheckmarkText}>✓</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function ShotDetailSheet({
  visible,
  onClose,
  shot,
  onNavigate,
  hasPrev,
  hasNext,
  position,
}: {
  visible: boolean;
  onClose: () => void;
  shot: CanonicalShotEvent | null;
  onNavigate?: (direction: 1 | -1) => void;
  hasPrev?: boolean;
  hasNext?: boolean;
  position?: { index: number; total: number } | null;
}) {
  const insets = useSafeAreaInsets();
  const eventLinksEnabled = useFeatureFlag('shots_event_links_enabled');
  const derivedTagsEnabled = useFeatureFlag('enableDerivedContextTags');
  if (!shot) return null;

  const eventUrl = eventLinksEnabled ? getShotEventUrl(shot) : undefined;
  const isLinkable = !!eventUrl;

  if (eventLinksEnabled && __DEV__) {
    console.log('[ShotDetail][debug] candidate ids', {
      shotId: shot.id,
      gameId: shot.gameId,
      gameEventId: shot.gameEventId,
      eventNum: shot.eventNum,
      season: shot.season,
      period: shot.period,
      periodTime: shot.periodTime,
      rawDescription: shot.rawDescription,
      eventUrl,
    });
  }

  const handleOpenEventUrl = async () => {
    if (!eventUrl) return;
    try {
      console.log('[ShotDetail] Opening NBA event URL', eventUrl);
      await WebBrowser.openBrowserAsync(eventUrl);
    } catch (err) {
      console.warn('[ShotDetail] Failed to open NBA event URL', err);
    }
  };

  const isMake = shot.result === 'make';
  const isFt = shot.shotZone === 'ft';
  const zoneLabel = shot.shotZone === 'rim' ? 'Rim' : shot.shotZone === 'mid' ? 'Mid-Range' : shot.shotZone === '3pt' ? '3-Point' : 'Free Throw';
  const periodLabel = shot.period <= 4 ? `Q${shot.period}` : `OT${shot.period - 4}`;
  const scoreText = shot.scoreHome != null && shot.scoreAway != null ? `${shot.scoreAway}-${shot.scoreHome}` : null;
  const hasContextTags = shot.isClutch === true || shot.isFastBreak === true || (derivedTagsEnabled && (shot.contextTags ?? []).includes('off_turnover')) || shot.isSecondChance === true;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.sheetOverlay}>
        <Pressable style={styles.sheetDismiss} onPress={onClose} />
        <View style={[shotDetailStyles.container, { paddingBottom: insets.bottom + Spacing.md }]}>
          <View style={styles.sheetHandle} />

          <View style={shotDetailStyles.headerRow}>
            <View style={[
              shotDetailStyles.resultBadge,
              { backgroundColor: isMake ? Colors.positiveMuted : Colors.negativeMuted },
            ]}>
              <Text style={[
                shotDetailStyles.resultText,
                { color: isMake ? Colors.positive : Colors.negative },
              ]}>
                {isMake ? 'MAKE' : 'MISS'}
              </Text>
            </View>
            <Text style={shotDetailStyles.pointsText}>
              {isMake ? `+${shot.points} PTS` : (isFt ? 'FT attempt' : `${shot.points}PT attempt`)}
            </Text>
            {onNavigate && position && position.total > 1 && (
              <Text style={shotDetailStyles.navPositionText}>
                {position.index + 1}/{position.total}
              </Text>
            )}
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <X size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={shotDetailStyles.mainInfo}>
            <Text style={shotDetailStyles.shooterName}>
              {shot.playerName ?? 'Unknown Player'}
            </Text>
            <Text style={shotDetailStyles.shotTypeText}>{zoneLabel}</Text>
          </View>

          <View style={shotDetailStyles.detailGrid}>
            <View style={shotDetailStyles.detailItem}>
              <Text style={shotDetailStyles.detailLabel}>Period</Text>
              <Text style={shotDetailStyles.detailValue}>{periodLabel}</Text>
            </View>
            {shot.periodTime && (
              <View style={shotDetailStyles.detailItem}>
                <Text style={shotDetailStyles.detailLabel}>Clock</Text>
                <Text style={shotDetailStyles.detailValue}>{shot.periodTime}</Text>
              </View>
            )}
            <View style={shotDetailStyles.detailItem}>
              <Text style={shotDetailStyles.detailLabel}>Zone</Text>
              <Text style={shotDetailStyles.detailValue}>{zoneLabel}</Text>
            </View>
            <View style={shotDetailStyles.detailItem}>
              <Text style={shotDetailStyles.detailLabel}>Value</Text>
              <Text style={shotDetailStyles.detailValue}>{isFt ? '1PT' : `${shot.points}PT`}</Text>
            </View>
            {scoreText && (
              <View style={shotDetailStyles.detailItem}>
                <Text style={shotDetailStyles.detailLabel}>Score</Text>
                <Text style={shotDetailStyles.detailValue}>{scoreText}</Text>
              </View>
            )}
          </View>

          {isMake && shot.assisterName && (
            <View style={shotDetailStyles.assistRow}>
              <Link2 size={13} color={Colors.secondary} />
              <Text style={shotDetailStyles.assistLabel}>Assisted by</Text>
              <Text style={shotDetailStyles.assistName}>{shot.assisterName}</Text>
            </View>
          )}

          {hasContextTags && (
            <View style={shotDetailStyles.tagsRow}>
              {shot.isClutch === true && (
                <View style={shotDetailStyles.tagBadge}>
                  <Text style={shotDetailStyles.tagText}>Clutch</Text>
                </View>
              )}
              {shot.isFastBreak === true && (
                <View style={shotDetailStyles.tagBadge}>
                  <Text style={shotDetailStyles.tagText}>Fast Break</Text>
                </View>
              )}
              {derivedTagsEnabled && (shot.contextTags ?? []).includes('off_turnover') && (
                <View style={shotDetailStyles.derivedTagBadge}>
                  <Text style={shotDetailStyles.derivedTagText}>Off Turnover</Text>
                </View>
              )}
              {shot.isSecondChance === true && (
                <View style={shotDetailStyles.tagBadge}>
                  <Text style={shotDetailStyles.tagText}>2nd Chance</Text>
                </View>
              )}
            </View>
          )}

          {shot.rawDescription && (
            isLinkable ? (
              <TouchableOpacity
                style={[shotDetailStyles.descriptionRow, shotDetailStyles.descriptionRowLink]}
                onPress={handleOpenEventUrl}
                activeOpacity={0.7}
                testID="shot-detail-description-link"
              >
                <Text style={[shotDetailStyles.descriptionText, shotDetailStyles.descriptionTextLink]}>
                  {shot.rawDescription}
                </Text>
              </TouchableOpacity>
            ) : (
              <View style={shotDetailStyles.descriptionRow}>
                <Text style={shotDetailStyles.descriptionText}>{shot.rawDescription}</Text>
              </View>
            )
          )}

          {onNavigate && (
            <View style={shotDetailStyles.navRow}>
              <TouchableOpacity
                style={[shotDetailStyles.navBtn, !hasPrev && shotDetailStyles.navBtnDisabled]}
                onPress={() => hasPrev && onNavigate(-1)}
                disabled={!hasPrev}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <ChevronLeft size={18} color={hasPrev ? Colors.textPrimary : Colors.textMuted} />
                <Text style={[shotDetailStyles.navBtnText, !hasPrev && shotDetailStyles.navBtnTextDisabled]}>Prev</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[shotDetailStyles.navBtn, !hasNext && shotDetailStyles.navBtnDisabled]}
                onPress={() => hasNext && onNavigate(1)}
                disabled={!hasNext}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={[shotDetailStyles.navBtnText, !hasNext && shotDetailStyles.navBtnTextDisabled]}>Next</Text>
                <ChevronRight size={18} color={hasNext ? Colors.textPrimary : Colors.textMuted} />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const shotDetailStyles = StyleSheet.create({
  container: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  resultBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  resultText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.heavy,
    letterSpacing: 1,
  },
  pointsText: {
    flex: 1,
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  mainInfo: {
    marginBottom: Spacing.lg,
  },
  shooterName: {
    color: Colors.textPrimary,
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    marginBottom: Spacing.xs,
  },
  shotTypeText: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
  detailGrid: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  detailItem: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.sm,
    paddingVertical: Spacing.md,
    alignItems: 'center' as const,
  },
  detailLabel: {
    color: Colors.textMuted,
    fontSize: 9,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  detailValue: {
    color: Colors.textPrimary,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    fontVariant: ['tabular-nums'] as const,
  },
  assistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.secondaryMuted,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    marginBottom: Spacing.md,
  },
  assistLabel: {
    color: Colors.secondary,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
  },
  assistName: {
    color: Colors.secondary,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
  },
  tagsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  tagBadge: {
    backgroundColor: Colors.warningMuted,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.sm,
  },
  tagText: {
    color: Colors.warning,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
  },
  derivedTagBadge: {
    backgroundColor: Colors.primaryMuted,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.sm,
  },
  derivedTagText: {
    color: Colors.primary,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
  },
  descriptionRow: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    marginBottom: Spacing.md,
  },
  descriptionText: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontStyle: 'italic' as const,
    lineHeight: 16,
  },
  descriptionRowLink: {},
  descriptionTextLink: {
    color: Colors.secondary,
    textDecorationLine: 'underline',
  },
  navRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  navBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    paddingVertical: Spacing.sm,
  },
  navBtnDisabled: {
    opacity: 0.4,
  },
  navBtnText: {
    color: Colors.textPrimary,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  navBtnTextDisabled: {
    color: Colors.textMuted,
  },
  navPositionText: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    fontVariant: ['tabular-nums'] as const,
    marginRight: Spacing.sm,
  },
});

function ShotsTab({ rawActions, canonicalShots, gameId, screenWidth, pbpSource, homeTeamId, awayTeamId, homeAbbr, awayAbbr, homeBoxScore, awayBoxScore }: {
  rawActions: CdnPbpAction[];
  canonicalShots: CanonicalShotEvent[];
  gameId: string;
  screenWidth: number;
  pbpSource: DataSource;
  homeTeamId: string;
  awayTeamId: string;
  homeAbbr: string;
  awayAbbr: string;
  homeBoxScore: BoxScorePlayer[];
  awayBoxScore: BoxScorePlayer[];
}) {
  const facilitatorFilterEnabled = useFeatureFlag('shots_facilitator_filter_enabled');
  const shotDetailEnabled = useFeatureFlag('shots_detail_on_tap_enabled');
  const freeThrowsEnabled = useFeatureFlag('shots_free_throws_enabled');
  const detailNavEnabled = useFeatureFlag('shots_detail_navigation_enabled');

  const [teamFilter, setTeamFilter] = useState<number>(2);
  const [resultFilter, setResultFilter] = useState<number>(0);
  const [zoneFilter, setZoneFilter] = useState<number>(0);
  const [periodFilter, setPeriodFilter] = useState<number>(0);
  const [clutchOnly, setClutchOnly] = useState<boolean>(false);
  const [playerFilter, setPlayerFilter] = useState<string | null>(null);
  const [facilitatorFilter, setFacilitatorFilter] = useState<string | null>(null);
  const [playerSheetVisible, setPlayerSheetVisible] = useState<boolean>(false);
  const [facilitatorSheetVisible, setFacilitatorSheetVisible] = useState<boolean>(false);
  const [selectedShot, setSelectedShot] = useState<CanonicalShotEvent | null>(null);
  const [shotDetailVisible, setShotDetailVisible] = useState<boolean>(false);

  const teamTabs = useMemo(() => [homeAbbr, awayAbbr, 'Both'], [homeAbbr, awayAbbr]);

  const maxPeriod = useMemo(() => {
    if (canonicalShots.length === 0) return 4;
    return Math.max(...canonicalShots.map(s => s.period));
  }, [canonicalShots]);

  const periodTabs = useMemo(() => {
    const tabs = ['All'];
    for (let i = 1; i <= Math.min(maxPeriod, 4); i++) tabs.push(`Q${i}`);
    for (let i = 5; i <= maxPeriod; i++) tabs.push(`OT${i - 4}`);
    return tabs;
  }, [maxPeriod]);

  const allPlayers = useMemo(() => {
    const map = new Map<string, string>();
    canonicalShots.forEach(s => {
      if (s.playerId && s.playerName) map.set(s.playerId, s.playerName);
    });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [canonicalShots]);

  const allFacilitators = useMemo(() => {
    const map = new Map<string, string>();
    canonicalShots.forEach(s => {
      if (s.assisterId && s.assisterName) map.set(s.assisterId, s.assisterName);
    });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [canonicalShots]);

  const teamFilteredFacilitators = useMemo(() => {
    if (teamFilter === 2) return allFacilitators;
    const targetTeamId = teamFilter === 0 ? homeTeamId : awayTeamId;
    const teamAssisterIds = new Set(
      canonicalShots.filter(s => s.teamId === targetTeamId && s.assisterId).map(s => s.assisterId)
    );
    return allFacilitators.filter(([id]) => teamAssisterIds.has(id));
  }, [allFacilitators, teamFilter, homeTeamId, awayTeamId, canonicalShots]);

  const teamFilteredPlayers = useMemo(() => {
    if (teamFilter === 2) return allPlayers;
    const targetTeamId = teamFilter === 0 ? homeTeamId : awayTeamId;
    const teamPlayerIds = new Set(
      canonicalShots.filter(s => s.teamId === targetTeamId && s.playerId).map(s => s.playerId)
    );
    return allPlayers.filter(([id]) => teamPlayerIds.has(id));
  }, [allPlayers, teamFilter, homeTeamId, awayTeamId, canonicalShots]);

  useEffect(() => {
    if (playerFilter && teamFilter !== 2) {
      const targetTeamId = teamFilter === 0 ? homeTeamId : awayTeamId;
      const playerShot = canonicalShots.find(s => s.playerId === playerFilter);
      if (playerShot && playerShot.teamId !== targetTeamId) {
        setPlayerFilter(null);
      }
    }
    if (facilitatorFilter && teamFilter !== 2) {
      const targetTeamId = teamFilter === 0 ? homeTeamId : awayTeamId;
      const assistShot = canonicalShots.find(s => s.assisterId === facilitatorFilter);
      if (assistShot && assistShot.teamId !== targetTeamId) {
        setFacilitatorFilter(null);
      }
    }
  }, [teamFilter, playerFilter, facilitatorFilter, homeTeamId, awayTeamId, canonicalShots]);

  const activeQuery = useMemo<ShotQuery>(() => {
    const q: ShotQuery = {};
    if (teamFilter === 0) q.teamId = homeTeamId;
    else if (teamFilter === 1) q.teamId = awayTeamId;
    if (resultFilter === 1) q.result = 'make';
    else if (resultFilter === 2) q.result = 'miss';
    const zoneMap: Record<number, ShotZone> = { 1: 'rim', 2: 'mid', 3: '3pt', 4: 'ft' };
    if (zoneFilter > 0 && zoneMap[zoneFilter]) q.shotZone = zoneMap[zoneFilter];
    if (periodFilter > 0) q.period = periodFilter;
    if (clutchOnly) q.clutchOnly = true;
    if (playerFilter) q.playerId = playerFilter;
    if (facilitatorFilter) q.assisterId = facilitatorFilter;
    return q;
  }, [teamFilter, resultFilter, zoneFilter, periodFilter, clutchOnly, playerFilter, facilitatorFilter, homeTeamId, awayTeamId]);

  const filteredShots = useMemo(() => {
    return filterShots(canonicalShots, activeQuery);
  }, [canonicalShots, activeQuery]);

  const summary = useMemo<ShotQuerySummary>(() => {
    return summarizeShots(filteredShots);
  }, [filteredShots]);

  const zoneBreakdown = useMemo(() => {
    const zones: ShotZone[] = freeThrowsEnabled ? ['rim', 'mid', '3pt', 'ft'] : ['rim', 'mid', '3pt'];
    return zones.map(zone => {
      const zoneShots = filterShots(filteredShots, { shotZone: zone });
      const zoneSummary = summarizeShots(zoneShots);
      return { zone, ...zoneSummary };
    });
  }, [filteredShots, freeThrowsEnabled]);

  const ftAggregate = useMemo(() => {
    const ftShots = filterShots(filteredShots, { shotZone: 'ft' });
    return { summary: summarizeShots(ftShots), shots: ftShots };
  }, [filteredShots]);

  const [ftAggregateVisible, setFtAggregateVisible] = useState<boolean>(false);

  const isFtFocus = useMemo(() => zoneFilter === 4, [zoneFilter]);

  const handleShotNavigate = useCallback((direction: 1 | -1) => {
    if (!selectedShot) return;
    const idx = filteredShots.findIndex(s => s.id === selectedShot.id);
    if (idx === -1) return;
    const nextIdx = idx + direction;
    if (nextIdx < 0 || nextIdx >= filteredShots.length) return;
    console.log('[ShotsTab] Shot nav %s: from idx=%d -> %d', direction > 0 ? 'next' : 'prev', idx, nextIdx);
    setSelectedShot(filteredShots[nextIdx]);
  }, [selectedShot, filteredShots]);

  const handlePlayerFilter = useCallback((playerId: string | null) => {
    setPlayerFilter(prev => prev === playerId ? null : playerId);
  }, []);

  const handleFacilitatorFilter = useCallback((facilitatorId: string | null) => {
    setFacilitatorFilter(prev => prev === facilitatorId ? null : facilitatorId);
  }, []);

  const selectedFacilitatorName = useMemo(() => {
    if (!facilitatorFilter) return null;
    return allFacilitators.find(p => p[0] === facilitatorFilter)?.[1] ?? null;
  }, [facilitatorFilter, allFacilitators]);

  const handleShotPress = useCallback((shot: CanonicalShotEvent) => {
    if (!shotDetailEnabled) return;
    console.log('[ShotsTab] Shot detail requested: id=%s player=%s result=%s zone=%s', shot.id, shot.playerName, shot.result, shot.shotZone);
    setSelectedShot(shot);
    setShotDetailVisible(true);
  }, [shotDetailEnabled]);

  const handleShotDetailClose = useCallback(() => {
    setShotDetailVisible(false);
    setSelectedShot(null);
  }, []);

  const handleZonePress = useCallback((zoneIndex: number) => {
    setZoneFilter(prev => prev === zoneIndex ? 0 : zoneIndex);
  }, []);

  const selectedPlayerName = useMemo(() => {
    if (!playerFilter) return null;
    return allPlayers.find(p => p[0] === playerFilter)?.[1] ?? null;
  }, [playerFilter, allPlayers]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (resultFilter !== 0) count++;
    if (zoneFilter !== 0) count++;
    if (periodFilter !== 0) count++;
    if (clutchOnly) count++;
    if (playerFilter) count++;
    if (facilitatorFilter) count++;
    return count;
  }, [resultFilter, zoneFilter, periodFilter, clutchOnly, playerFilter, facilitatorFilter]);

  if (rawActions.length === 0) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyText}>Shot data not available</Text>
        <Text style={styles.emptySubtext}>Shot data will appear once the game starts</Text>
      </View>
    );
  }

  if (canonicalShots.length === 0) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyText}>No shots found</Text>
        <Text style={styles.emptySubtext}>Unable to extract shot events from play-by-play data</Text>
      </View>
    );
  }

  return (
    <View>
      <DataSourceBadge source={pbpSource} />

      <SubTabBar tabs={teamTabs} selected={teamFilter} onSelect={setTeamFilter} />

      <View style={shotStyles.filterSection}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={shotStyles.filterRowInner}>
          {SHOT_RESULT_FILTERS.map((f, i) => (
            <FilterChip key={f} label={f} active={resultFilter === i} onPress={() => setResultFilter(i)} />
          ))}
          <View style={shotStyles.filterDivider} />
          {(freeThrowsEnabled ? SHOT_ZONE_FILTERS_WITH_FT : SHOT_ZONE_FILTERS_BASE).map((f, i) => (
            <FilterChip key={f} label={f} active={zoneFilter === i} onPress={() => setZoneFilter(i)} />
          ))}
        </ScrollView>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={shotStyles.filterRowInner}>
          {periodTabs.map((f, i) => (
            <FilterChip key={f} label={f} active={periodFilter === i} onPress={() => setPeriodFilter(i)} />
          ))}
          <View style={shotStyles.filterDivider} />
          <FilterChip label="Clutch" active={clutchOnly} onPress={() => setClutchOnly(previous => !previous)} />
        </ScrollView>

        <View style={shotStyles.playerFacilitatorRow}>
          <TouchableOpacity
            style={[
              shotStyles.playerFilterTrigger,
              { flex: 1 },
              playerFilter != null && shotStyles.playerFilterTriggerActive,
            ]}
            onPress={() => setPlayerSheetVisible(true)}
            activeOpacity={0.7}
          >
            <Crosshair size={13} color={playerFilter ? Colors.primary : Colors.textMuted} />
            <Text style={[
              shotStyles.playerFilterTriggerText,
              playerFilter != null && shotStyles.playerFilterTriggerTextActive,
            ]} numberOfLines={1}>
              {selectedPlayerName ?? 'All Players'}
            </Text>
            {playerFilter && (
              <TouchableOpacity
                onPress={() => setPlayerFilter(null)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={shotStyles.playerFilterClearBtn}
              >
                <X size={12} color={Colors.primary} />
              </TouchableOpacity>
            )}
            {!playerFilter && <ChevronDown size={13} color={Colors.textMuted} />}
          </TouchableOpacity>

          {facilitatorFilterEnabled && (
            <TouchableOpacity
              style={[
                shotStyles.playerFilterTrigger,
                { flex: 1 },
                facilitatorFilter != null && shotStyles.facilitatorFilterTriggerActive,
              ]}
              onPress={() => setFacilitatorSheetVisible(true)}
              activeOpacity={0.7}
            >
              <Link2 size={13} color={facilitatorFilter ? Colors.secondary : Colors.textMuted} />
              <Text style={[
                shotStyles.playerFilterTriggerText,
                facilitatorFilter != null && shotStyles.facilitatorFilterTriggerTextActive,
              ]} numberOfLines={1}>
                {selectedFacilitatorName ?? 'All Facilitators'}
              </Text>
              {facilitatorFilter && (
                <TouchableOpacity
                  onPress={() => setFacilitatorFilter(null)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={shotStyles.playerFilterClearBtn}
                >
                  <X size={12} color={Colors.secondary} />
                </TouchableOpacity>
              )}
              {!facilitatorFilter && <ChevronDown size={13} color={Colors.textMuted} />}
            </TouchableOpacity>
          )}
        </View>
      </View>

      {activeFilterCount > 0 && (
        <View style={shotStyles.activeFilterBar}>
          <Text style={shotStyles.activeFilterText}>
            {filteredShots.length} shot{filteredShots.length !== 1 ? 's' : ''} matching {activeFilterCount} filter{activeFilterCount !== 1 ? 's' : ''}
          </Text>
          <TouchableOpacity
            onPress={() => {
              setResultFilter(0);
              setZoneFilter(0);
              setPeriodFilter(0);
              setClutchOnly(false);
              setPlayerFilter(null);
              setFacilitatorFilter(null);
            }}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Text style={shotStyles.activeFilterClear}>Clear all</Text>
          </TouchableOpacity>
        </View>
      )}

      {facilitatorFilterEnabled && facilitatorFilter && selectedFacilitatorName && (
        <View style={shotStyles.facilitatorActiveBadge}>
          <Link2 size={11} color={Colors.secondary} />
          <Text style={shotStyles.facilitatorActiveText}>
            Assisted by {selectedFacilitatorName}
          </Text>
          <TouchableOpacity
            onPress={() => setFacilitatorFilter(null)}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <X size={12} color={Colors.secondary} />
          </TouchableOpacity>
        </View>
      )}

      <ShotsSummaryBlock summary={summary} isFtFocus={isFtFocus} showEfficiency={freeThrowsEnabled} />

      <Text style={styles.sectionLabel}>ZONE BREAKDOWN</Text>
      <View style={shotStyles.zoneRow}>
        {zoneBreakdown.map((z, idx) => {
          const zoneIndex = idx + 1;
          const isActiveZone = zoneFilter === zoneIndex;
          const isFtZone = z.zone === 'ft';
          const cardMakes = isFtZone ? z.ftMade : z.makes;
          const cardAttempts = isFtZone ? z.ftAttempted : z.attempts;
          const cardPct = isFtZone ? z.ftPct : z.fgPct;
          return (
            <TouchableOpacity
              key={z.zone}
              style={[
                shotStyles.zoneCard,
                isActiveZone && shotStyles.zoneCardActive,
              ]}
              onPress={() => handleZonePress(zoneIndex)}
              activeOpacity={0.7}
              testID={`zoneCard-${z.zone}`}
            >
              <Text style={[shotStyles.zoneLabel, isActiveZone && shotStyles.zoneLabelActive]}>
                {z.zone === 'rim' ? 'RIM' : z.zone === 'mid' ? 'MID' : z.zone === '3pt' ? '3PT' : 'FT'}
              </Text>
              <Text style={[shotStyles.zoneValue, isActiveZone && shotStyles.zoneValueActive]}>
                {cardMakes}/{cardAttempts}
              </Text>
              <Text style={[
                shotStyles.zonePct,
                { color: cardPct !== null && cardPct >= 50 ? Colors.positive : cardPct !== null && cardPct < 35 ? Colors.negative : Colors.textSecondary },
              ]}>
                {cardPct !== null ? `${cardPct}%` : '—'}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={styles.sectionLabel}>SHOT CHART</Text>
      <View style={shotStyles.chartWrap}>
        <ShotChart
          shots={filteredShots}
          width={screenWidth - 32}
          onShotPress={shotDetailEnabled ? handleShotPress : undefined}
          selectedShotId={selectedShot?.id ?? null}
        />
        {freeThrowsEnabled && ftAggregate.summary.ftAttempted > 0 && (
          <View pointerEvents="box-none" style={[shotStyles.ftBadgeAnchor, { top: ((screenWidth - 32) * 0.94) * (190 / 470) - 14 }]}>
          <TouchableOpacity
            style={[shotStyles.ftBadgeOnCourt, isFtFocus && shotStyles.ftBadgeOnCourtActive]}
            onPress={() => setFtAggregateVisible(true)}
            activeOpacity={0.8}
            testID="ft-chart-badge"
            accessibilityLabel="Free throws summary"
          >
            <Target size={11} color={isFtFocus ? Colors.background : Colors.secondary} />
            <Text style={[shotStyles.ftBadgeLabel, isFtFocus && shotStyles.ftBadgeLabelActive]}>FT</Text>
          </TouchableOpacity>
          </View>
        )}
      </View>

      {allPlayers.length > 0 && (
        <>
          <Text style={styles.sectionLabel}>PLAYER SHOTS</Text>
          <PlayerShotList
            shots={filteredShots}
            allPlayers={allPlayers}
            selectedPlayerId={playerFilter}
            onSelectPlayer={handlePlayerFilter}
            isFtFocus={isFtFocus}
            isFgFocus={zoneFilter >= 1 && zoneFilter <= 3}
            showFt={freeThrowsEnabled}
          />
        </>
      )}

      {filteredShots.length === 0 && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No shots match current filters</Text>
        </View>
      )}

      <ShotsPlayerSheet
        visible={playerSheetVisible}
        onClose={() => setPlayerSheetVisible(false)}
        players={teamFilteredPlayers}
        selectedId={playerFilter}
        onSelect={handlePlayerFilter}
        shots={canonicalShots}
      />

      {facilitatorFilterEnabled && (
        <FacilitatorSheet
          visible={facilitatorSheetVisible}
          onClose={() => setFacilitatorSheetVisible(false)}
          facilitators={teamFilteredFacilitators}
          selectedId={facilitatorFilter}
          onSelect={handleFacilitatorFilter}
          shots={canonicalShots}
        />
      )}

      {shotDetailEnabled && (
        <ShotDetailSheet
          visible={shotDetailVisible}
          onClose={handleShotDetailClose}
          shot={selectedShot}
          onNavigate={detailNavEnabled ? handleShotNavigate : undefined}
          hasPrev={detailNavEnabled && selectedShot ? filteredShots.findIndex(s => s.id === selectedShot.id) > 0 : false}
          hasNext={detailNavEnabled && selectedShot ? filteredShots.findIndex(s => s.id === selectedShot.id) < filteredShots.length - 1 : false}
          position={detailNavEnabled && selectedShot ? { index: filteredShots.findIndex(s => s.id === selectedShot.id), total: filteredShots.length } : null}
        />
      )}

      {freeThrowsEnabled && (
        <FtAggregateSheet
          visible={ftAggregateVisible}
          onClose={() => setFtAggregateVisible(false)}
          summary={ftAggregate.summary}
          shots={ftAggregate.shots}
        />
      )}
    </View>
  );
}

function ShotsSummaryBlock({ summary, isFtFocus, showEfficiency }: { summary: ShotQuerySummary; isFtFocus: boolean; showEfficiency: boolean }) {
  const heroAttempts = isFtFocus ? summary.ftAttempted : summary.attempts;
  const heroMakes = isFtFocus ? summary.ftMade : summary.makes;
  const heroPctLabel = isFtFocus ? 'FT%' : 'FG%';
  const heroPct = isFtFocus ? summary.ftPct : summary.fgPct;

  return (
    <View style={shotStyles.summaryCard}>
      <View style={shotStyles.summaryPrimaryRow}>
        <View style={shotStyles.summaryHeroItem}>
          <Text style={shotStyles.summaryHeroValue}>{heroAttempts}</Text>
          <Text style={shotStyles.summaryHeroLabel}>ATT</Text>
        </View>
        <View style={shotStyles.summaryHeroItem}>
          <Text style={[shotStyles.summaryHeroValue, { color: Colors.positive }]}>{heroMakes}</Text>
          <Text style={shotStyles.summaryHeroLabel}>MAKES</Text>
        </View>
        <View style={[shotStyles.summaryHeroItem, shotStyles.summaryFgItem]}>
          <Text style={shotStyles.summaryFgValue}>
            {heroPct !== null ? `${heroPct}%` : '—'}
          </Text>
          <Text style={shotStyles.summaryHeroLabel}>{heroPctLabel}</Text>
        </View>
        <View style={shotStyles.summaryHeroItem}>
          <Text style={[shotStyles.summaryHeroValue, { color: Colors.primary }]}>{summary.points}</Text>
          <Text style={shotStyles.summaryHeroLabel}>PTS</Text>
        </View>
      </View>
      <View style={shotStyles.summarySecondaryRow}>
        {isFtFocus ? (
          <>
            <View style={shotStyles.summarySecItem}>
              <Text style={shotStyles.summarySecValue}>{summary.ftAttempted - summary.ftMade}</Text>
              <Text style={shotStyles.summarySecLabel}>MISS</Text>
            </View>
            {showEfficiency && (
              <>
                <View style={shotStyles.summarySecDivider} />
                <View style={shotStyles.summarySecItem}>
                  <Text style={shotStyles.summarySecValue}>{summary.ppo !== null ? summary.ppo.toFixed(2) : '—'}</Text>
                  <Text style={shotStyles.summarySecLabel}>PPO</Text>
                </View>
                <View style={shotStyles.summarySecDivider} />
                <View style={shotStyles.summarySecItem}>
                  <Text style={shotStyles.summarySecValue}>{summary.tsPct !== null ? `${summary.tsPct}%` : '—'}</Text>
                  <Text style={shotStyles.summarySecLabel}>TS%</Text>
                </View>
              </>
            )}
          </>
        ) : (
          <>
            <View style={shotStyles.summarySecItem}>
              <Text style={shotStyles.summarySecValue}>{summary.misses}</Text>
              <Text style={shotStyles.summarySecLabel}>MISS</Text>
            </View>
            <View style={shotStyles.summarySecDivider} />
            <View style={shotStyles.summarySecItem}>
              <Text style={shotStyles.summarySecValue}>{summary.twosMade}/{summary.twosAttempted}</Text>
              <Text style={shotStyles.summarySecLabel}>2PT</Text>
            </View>
            <View style={shotStyles.summarySecDivider} />
            <View style={shotStyles.summarySecItem}>
              <Text style={shotStyles.summarySecValue}>{summary.threesMade}/{summary.threesAttempted}</Text>
              <Text style={shotStyles.summarySecLabel}>3PT</Text>
            </View>
            {showEfficiency && (
              <>
                <View style={shotStyles.summarySecDivider} />
                <View style={shotStyles.summarySecItem}>
                  <Text style={shotStyles.summarySecValue}>{summary.ftMade}/{summary.ftAttempted}</Text>
                  <Text style={shotStyles.summarySecLabel}>FT</Text>
                </View>
              </>
            )}
          </>
        )}
      </View>
      {showEfficiency && !isFtFocus && (summary.ppo !== null || summary.tsPct !== null) && (
        <View style={shotStyles.summaryTertiaryRow}>
          <View style={shotStyles.summaryTerItem}>
            <Text style={shotStyles.summaryTerLabel}>PPO</Text>
            <Text style={shotStyles.summaryTerValue}>
              {summary.ppo !== null ? summary.ppo.toFixed(2) : '—'}
            </Text>
          </View>
          <View style={shotStyles.summaryTerDivider} />
          <View style={shotStyles.summaryTerItem}>
            <Text style={shotStyles.summaryTerLabel}>TS%</Text>
            <Text style={shotStyles.summaryTerValue}>
              {summary.tsPct !== null ? `${summary.tsPct}%` : '—'}
            </Text>
          </View>
          <View style={shotStyles.summaryTerDivider} />
          <View style={shotStyles.summaryTerItem}>
            <Text style={shotStyles.summaryTerLabel}>FT%</Text>
            <Text style={shotStyles.summaryTerValue}>
              {summary.ftPct !== null ? `${summary.ftPct}%` : '—'}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

function FtAggregateSheet({ visible, onClose, summary, shots }: {
  visible: boolean;
  onClose: () => void;
  summary: ShotQuerySummary;
  shots: CanonicalShotEvent[];
}) {
  const insets = useSafeAreaInsets();
  const ftPoints = summary.ftMade;
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.sheetOverlay}>
        <Pressable style={styles.sheetDismiss} onPress={onClose} />
        <View style={[shotDetailStyles.container, { paddingBottom: insets.bottom + Spacing.md, maxHeight: '80%' }]}>
          <View style={styles.sheetHandle} />
          <View style={shotDetailStyles.headerRow}>
            <View style={[shotDetailStyles.resultBadge, { backgroundColor: Colors.secondaryMuted }]}>
              <Text style={[shotDetailStyles.resultText, { color: Colors.secondary }]}>FT</Text>
            </View>
            <Text style={shotDetailStyles.pointsText}>Free Throws · current filters</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <X size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={shotDetailStyles.detailGrid}>
            <View style={shotDetailStyles.detailItem}>
              <Text style={shotDetailStyles.detailLabel}>FTM/FTA</Text>
              <Text style={shotDetailStyles.detailValue}>{summary.ftMade}/{summary.ftAttempted}</Text>
            </View>
            <View style={shotDetailStyles.detailItem}>
              <Text style={shotDetailStyles.detailLabel}>FT%</Text>
              <Text style={shotDetailStyles.detailValue}>{summary.ftPct !== null ? `${summary.ftPct}%` : '—'}</Text>
            </View>
            <View style={shotDetailStyles.detailItem}>
              <Text style={shotDetailStyles.detailLabel}>FT PTS</Text>
              <Text style={shotDetailStyles.detailValue}>{ftPoints}</Text>
            </View>
          </View>

          <ScrollView style={{ maxHeight: 280 }}>
            {shots.map(s => {
              const isMake = s.result === 'make';
              const periodLabel = s.period <= 4 ? `Q${s.period}` : `OT${s.period - 4}`;
              return (
                <View key={s.id} style={shotStyles.ftListRow}>
                  <View style={[shotStyles.ftListDot, { backgroundColor: isMake ? Colors.positive : Colors.negative }]} />
                  <Text style={shotStyles.ftListPeriod}>{periodLabel}</Text>
                  <Text style={shotStyles.ftListClock}>{s.periodTime ?? '—'}</Text>
                  <Text style={shotStyles.ftListName} numberOfLines={1}>{s.playerName ?? 'Unknown'}</Text>
                  <Text style={[shotStyles.ftListResult, { color: isMake ? Colors.positive : Colors.negative }]}>
                    {isMake ? 'MAKE' : 'MISS'}
                  </Text>
                </View>
              );
            })}
            {shots.length === 0 && (
              <Text style={shotStyles.ftListEmpty}>No free throws in current filter</Text>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function PlayerShotList({ shots, allPlayers, selectedPlayerId, onSelectPlayer, isFtFocus, isFgFocus, showFt }: {
  shots: CanonicalShotEvent[];
  allPlayers: Array<[string, string]>;
  selectedPlayerId: string | null;
  onSelectPlayer: (playerId: string | null) => void;
  isFtFocus: boolean;
  isFgFocus: boolean;
  showFt: boolean;
}) {
  const playerStats = useMemo(() => {
    const map = new Map<string, CanonicalShotEvent[]>();
    for (const shot of shots) {
      if (!shot.playerId) continue;
      const arr = map.get(shot.playerId) ?? [];
      arr.push(shot);
      map.set(shot.playerId, arr);
    }
    return allPlayers
      .map(([id, name]) => {
        const playerShots = map.get(id) ?? [];
        const summary = summarizeShots(playerShots);
        const fgMakes = summary.makes;
        const fgAttempts = summary.attempts;
        const ftMakes = summary.ftMade;
        const ftAttempts = summary.ftAttempted;
        const pts = summary.points;
        const totalAttempts = fgAttempts + ftAttempts;
        return { id, name, fgMakes, fgAttempts, ftMakes, ftAttempts, pts, totalAttempts, tsPct: summary.tsPct };
      })
      .filter(p => isFtFocus ? p.ftAttempts > 0 : p.totalAttempts > 0)
      .sort((a, b) => {
        if (isFtFocus) return b.ftAttempts - a.ftAttempts;
        return b.fgAttempts - a.fgAttempts || b.pts - a.pts;
      });
  }, [shots, allPlayers, isFtFocus]);

  const maxBarAttempts = useMemo(() => {
    if (playerStats.length === 0) return 1;
    return isFtFocus ? playerStats[0].ftAttempts : playerStats[0].fgAttempts;
  }, [playerStats, isFtFocus]);

  return (
    <View style={shotStyles.playerListCard}>
      <View style={shotStyles.playerListHeader}>
        <Text style={shotStyles.playerListHeaderName}>PLAYER</Text>
        {isFtFocus ? (
          <>
            <Text style={shotStyles.playerListHeaderStat}>FT</Text>
            <Text style={shotStyles.playerListHeaderStat}>FT%</Text>
            <Text style={shotStyles.playerListHeaderStat}>PTS</Text>
          </>
        ) : isFgFocus ? (
          <>
            <Text style={shotStyles.playerListHeaderStat}>FG</Text>
            <Text style={shotStyles.playerListHeaderStat}>FG%</Text>
            <Text style={shotStyles.playerListHeaderStat}>PTS</Text>
          </>
        ) : (
          <>
            <Text style={shotStyles.playerListHeaderStat}>FG</Text>
            {showFt && <Text style={shotStyles.playerListHeaderStat}>FT</Text>}
            <Text style={shotStyles.playerListHeaderStat}>TS%</Text>
            <Text style={shotStyles.playerListHeaderStat}>PTS</Text>
          </>
        )}
      </View>
      {playerStats.map((p, idx) => {
        const isSelected = selectedPlayerId === p.id;
        const fgPct = p.fgAttempts > 0 ? Math.round((p.fgMakes / p.fgAttempts) * 1000) / 10 : null;
        const ftPct = p.ftAttempts > 0 ? Math.round((p.ftMakes / p.ftAttempts) * 1000) / 10 : null;
        const barAttempts = isFtFocus ? p.ftAttempts : p.fgAttempts;
        const barMakes = isFtFocus ? p.ftMakes : p.fgMakes;
        const barWidth = maxBarAttempts > 0 ? (barAttempts / maxBarAttempts) * 100 : 0;
        const displayPct = isFtFocus ? ftPct : fgPct;
        return (
          <TouchableOpacity
            key={p.id}
            style={[shotStyles.playerRow, isSelected && shotStyles.playerRowSelected]}
            onPress={() => onSelectPlayer(p.id)}
            activeOpacity={0.6}
          >
            <View style={shotStyles.playerNameCol}>
              <Text style={shotStyles.playerRank}>{idx + 1}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[shotStyles.playerName, isSelected && shotStyles.playerNameSelected]} numberOfLines={1}>
                  {p.name}
                </Text>
                <View style={shotStyles.playerBarTrack}>
                  <View style={[shotStyles.playerBarTotal, { width: `${barWidth}%` as unknown as number }]}>
                    <View style={[
                      shotStyles.playerBarMakes,
                      { width: barAttempts > 0 ? `${(barMakes / barAttempts) * 100}%` as unknown as number : 0 },
                      isSelected && shotStyles.playerBarMakesSelected,
                    ]} />
                    <View style={[
                      shotStyles.playerBarMisses,
                      { flex: 1 },
                      isSelected && shotStyles.playerBarMissesSelected,
                    ]} />
                  </View>
                </View>
              </View>
            </View>
            {isFtFocus ? (
              <>
                <Text style={shotStyles.playerStat}>{p.ftMakes}/{p.ftAttempts}</Text>
                <Text style={[
                  shotStyles.playerPct,
                  { color: ftPct !== null && ftPct >= 80 ? Colors.positive : ftPct !== null && ftPct < 65 ? Colors.negative : Colors.textSecondary },
                ]}>
                  {ftPct !== null ? `${ftPct}%` : '—'}
                </Text>
                <Text style={shotStyles.playerPts}>{p.ftMakes}</Text>
              </>
            ) : isFgFocus ? (
              <>
                <Text style={shotStyles.playerStat}>{p.fgMakes}/{p.fgAttempts}</Text>
                <Text style={[
                  shotStyles.playerPct,
                  { color: fgPct !== null && fgPct >= 50 ? Colors.positive : fgPct !== null && fgPct < 35 ? Colors.negative : Colors.textSecondary },
                ]}>
                  {fgPct !== null ? `${fgPct}%` : '—'}
                </Text>
                <Text style={shotStyles.playerPts}>{p.pts}</Text>
              </>
            ) : (
              <>
                <Text style={shotStyles.playerStat}>{p.fgMakes}/{p.fgAttempts}</Text>
                {showFt && (
                  <Text style={shotStyles.playerStat}>
                    {p.ftAttempts > 0 ? `${p.ftMakes}/${p.ftAttempts}` : '—'}
                  </Text>
                )}
                <Text style={[
                  shotStyles.playerPct,
                  { color: p.tsPct !== null && p.tsPct >= 55 ? Colors.positive : p.tsPct !== null && p.tsPct < 45 ? Colors.negative : Colors.textSecondary },
                ]}>
                  {p.tsPct !== null ? `${p.tsPct}%` : '—'}
                </Text>
                <Text style={shotStyles.playerPts}>{p.pts}</Text>
              </>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const shotStyles = StyleSheet.create({
  filterSection: {
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  filterRowInner: {
    gap: Spacing.sm,
    paddingVertical: 2,
  },
  filterDivider: {
    width: 1,
    height: 20,
    backgroundColor: Colors.divider,
    alignSelf: 'center' as const,
    marginHorizontal: Spacing.xs,
  },
  playerFilterTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  playerFilterTriggerActive: {
    backgroundColor: Colors.primaryMuted,
    borderColor: Colors.primary,
  },
  playerFilterTriggerText: {
    flex: 1,
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
  playerFilterTriggerTextActive: {
    color: Colors.primary,
    fontWeight: FontWeight.semibold,
  },
  playerFilterClearBtn: {
    padding: 4,
  },
  playerFacilitatorRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  facilitatorFilterTriggerActive: {
    backgroundColor: Colors.secondaryMuted,
    borderColor: Colors.secondary,
  },
  facilitatorFilterTriggerTextActive: {
    color: Colors.secondary,
    fontWeight: FontWeight.semibold,
  },
  facilitatorActiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.secondaryMuted,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  facilitatorActiveText: {
    flex: 1,
    color: Colors.secondary,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
  },
  activeFilterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  activeFilterText: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
  },
  activeFilterClear: {
    color: Colors.primary,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
  },
  summaryCard: {
    backgroundColor: Colors.cardBg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    overflow: 'hidden' as const,
  },
  summaryPrimaryRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  summaryHeroItem: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.sm,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  summaryHeroValue: {
    color: Colors.textPrimary,
    fontSize: FontSize.xl,
    fontWeight: FontWeight.heavy,
    fontVariant: ['tabular-nums'] as const,
  },
  summaryHeroLabel: {
    color: Colors.textMuted,
    fontSize: 9,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.5,
    marginTop: 3,
  },
  summaryFgItem: {
    backgroundColor: Colors.surfaceLight,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  summaryFgValue: {
    color: Colors.primary,
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.heavy,
    fontVariant: ['tabular-nums'] as const,
  },
  summarySecondaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xs,
  },
  summarySecItem: {
    flex: 1,
    alignItems: 'center',
  },
  summarySecValue: {
    color: Colors.textSecondary,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    fontVariant: ['tabular-nums'] as const,
  },
  summarySecLabel: {
    color: Colors.textMuted,
    fontSize: 8,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.3,
    marginTop: 1,
  },
  summarySecDivider: {
    width: 1,
    height: 16,
    backgroundColor: Colors.divider,
  },
  summaryTertiaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  summaryTerItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
  },
  summaryTerLabel: {
    color: Colors.textMuted,
    fontSize: 9,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.5,
  },
  summaryTerValue: {
    color: Colors.textSecondary,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    fontVariant: ['tabular-nums'] as const,
  },
  summaryTerDivider: {
    width: 1,
    height: 12,
    backgroundColor: Colors.divider,
  },
  chartWrap: {
    position: 'relative' as const,
    marginBottom: Spacing.md,
  },
  ftBadgeAnchor: {
    position: 'absolute' as const,
    left: 0,
    right: 0,
    alignItems: 'center' as const,
  },
  ftBadgeOnCourt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    borderColor: Colors.secondary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  ftBadgeOnCourtActive: {
    backgroundColor: Colors.secondary,
    borderColor: Colors.secondary,
    shadowOpacity: 0.3,
  },
  ftBadgeLabel: {
    color: Colors.secondary,
    fontSize: 10,
    fontWeight: FontWeight.heavy,
    letterSpacing: 0.8,
  },
  ftBadgeLabelActive: {
    color: Colors.background,
  },
  ftListRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  ftListDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  ftListPeriod: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    width: 32,
  },
  ftListClock: {
    color: Colors.textSecondary,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
    width: 50,
    fontVariant: ['tabular-nums'] as const,
  },
  ftListName: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
  ftListResult: {
    fontSize: 10,
    fontWeight: FontWeight.heavy,
    letterSpacing: 0.5,
  },
  ftListEmpty: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    textAlign: 'center' as const,
    paddingVertical: Spacing.lg,
  },
  zoneRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  zoneCard: {
    flex: 1,
    backgroundColor: Colors.cardBg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: Spacing.md,
    alignItems: 'center',
  },
  zoneCardActive: {
    backgroundColor: Colors.primaryMuted,
    borderColor: Colors.primary,
  },
  zoneLabel: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.5,
    marginBottom: Spacing.xs,
  },
  zoneLabelActive: {
    color: Colors.primary,
  },
  zoneValue: {
    color: Colors.textPrimary,
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    fontVariant: ['tabular-nums'] as const,
  },
  zoneValueActive: {
    color: Colors.primary,
  },
  zonePct: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    fontVariant: ['tabular-nums'] as const,
    marginTop: 2,
  },
  playerListCard: {
    backgroundColor: Colors.cardBg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    overflow: 'hidden' as const,
    marginBottom: Spacing.md,
  },
  playerListHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  playerListHeaderName: {
    flex: 1,
    color: Colors.textMuted,
    fontSize: 9,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.8,
  },
  playerListHeaderStat: {
    color: Colors.textMuted,
    fontSize: 9,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.5,
    width: 44,
    textAlign: 'center' as const,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  playerRowSelected: {
    backgroundColor: Colors.primaryMuted,
  },
  playerNameCol: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginRight: Spacing.sm,
  },
  playerRank: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    width: 16,
    fontVariant: ['tabular-nums'] as const,
  },
  playerName: {
    color: Colors.textPrimary,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
  playerNameSelected: {
    color: Colors.primary,
    fontWeight: FontWeight.bold,
  },
  playerBarTrack: {
    height: 4,
    backgroundColor: Colors.surface,
    borderRadius: 2,
    marginTop: 4,
    overflow: 'hidden' as const,
  },
  playerBarTotal: {
    height: 4,
    borderRadius: 2,
    flexDirection: 'row' as const,
    overflow: 'hidden' as const,
  },
  playerBarMakes: {
    height: 4,
    backgroundColor: Colors.positive,
    opacity: 0.85,
  },
  playerBarMakesSelected: {
    backgroundColor: Colors.primary,
    opacity: 1,
  },
  playerBarMisses: {
    height: 4,
    backgroundColor: Colors.textMuted,
    opacity: 0.2,
  },
  playerBarMissesSelected: {
    backgroundColor: Colors.primary,
    opacity: 0.25,
  },
  playerStat: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    fontVariant: ['tabular-nums'] as const,
    width: 44,
    textAlign: 'center' as const,
  },
  playerPct: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    fontVariant: ['tabular-nums'] as const,
    width: 44,
    textAlign: 'center' as const,
  },
  playerPts: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    fontVariant: ['tabular-nums'] as const,
    width: 44,
    textAlign: 'center' as const,
  },
  sheetClearRow: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
    backgroundColor: Colors.negativeMuted,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
  },
  sheetClearRowText: {
    color: Colors.negative,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  sheetPlayerStat: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    fontVariant: ['tabular-nums'] as const,
    width: 44,
    textAlign: 'center' as const,
    marginRight: Spacing.sm,
  },
  sheetPlayerPct: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    fontVariant: ['tabular-nums'] as const,
    width: 44,
    textAlign: 'center' as const,
    marginRight: Spacing.sm,
  },
})

function AnalyticsTab({ runs, droughts, lineups, metrics, hasEvents, selectedSubTab, onSubTabChange, rawActions, gameId, homeTeamId, awayTeamId, homeBoxScore, awayBoxScore, homeTimeline, awayTimeline, homeStarters, awayStarters, analyticsSource }: {
  runs: ScoringRun[];
  droughts: ScoringDrought[];
  lineups: LineupSegment[];
  metrics: CustomMetric[];
  hasEvents: boolean;
  selectedSubTab: number;
  onSubTabChange: (index: number) => void;
  rawActions: CdnPbpAction[];
  gameId: string;
  homeTeamId: string;
  awayTeamId: string;
  homeBoxScore: BoxScorePlayer[];
  awayBoxScore: BoxScorePlayer[];
  homeTimeline?: CanonicalTimelineSegment[];
  awayTimeline?: CanonicalTimelineSegment[];
  homeStarters: string[];
  awayStarters: string[];
  analyticsSource: DataSource;
}) {
  if (!hasEvents) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyText}>Analytics not available yet</Text>
        <Text style={styles.emptySubtext}>Scoring runs, droughts, and lineups are computed from play-by-play data once the game starts.</Text>
      </View>
    );
  }

  return (
    <View>
      <DataSourceBadge source={analyticsSource} />
      <SubTabBar tabs={ANALYTICS_SUBS} selected={selectedSubTab} onSelect={onSubTabChange} />

      {selectedSubTab === 0 && <RunsPanel runs={runs} />}
      {selectedSubTab === 1 && <DroughtsPanel droughts={droughts} />}
      {selectedSubTab === 2 && (
        <LineupsPanel
          lineups={lineups}
          rawActions={rawActions}
          gameId={gameId}
          homeTeamId={homeTeamId}
          awayTeamId={awayTeamId}
          homeBoxScore={homeBoxScore}
          awayBoxScore={awayBoxScore}
          homeTimeline={homeTimeline ?? undefined}
          awayTimeline={awayTimeline ?? undefined}
          homeStarters={homeStarters}
          awayStarters={awayStarters}
          runs={runs}
          droughts={droughts}
        />
      )}
      {selectedSubTab === 3 && <ImpactPanel metrics={metrics} />}
    </View>
  );
}

function RunsPanel({ runs }: { runs: ScoringRun[] }) {
  const unifiedCardEnabled = useFeatureFlag('stretches_unified_card_enabled');
  const contextStatsEnabled = useFeatureFlag('stretches_context_stats_enabled');

  if (runs.length === 0) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyText}>No scoring runs detected yet</Text>
        <Text style={styles.emptySubtext}>Runs are identified when a team scores 8+ points while outscoring the opponent by 6+ within a 3-minute window</Text>
      </View>
    );
  }

  return (
    <View>
      <Text style={styles.sectionLabel}>SCORING RUNS ({runs.length})</Text>
      {runs.map(run => (
        unifiedCardEnabled
          ? <StretchCard key={run.id} stretch={run} mode="run" showContextStats={contextStatsEnabled} />
          : <ScoringRunCard key={run.id} run={run} />
      ))}
    </View>
  );
}

function DroughtCard({ drought }: { drought: ScoringDrought }) {
  const lineupContextEnabled = useFeatureFlag('droughts_lineup_context_enabled');
  const endEventEnabled = useFeatureFlag('droughts_end_event_caption_enabled');
  const lineupChangesEnabled = useFeatureFlag('droughts_lineup_changes_enabled');
  const [expanded, setExpanded] = useState<boolean>(false);

  const hasPhases = lineupChangesEnabled
    && drought.lineupContext?.phases
    && drought.lineupContext.phases.length > 1;

  const endCaption = useMemo(() => {
    if (!endEventEnabled || !drought.endingEvent) return null;
    const ev = drought.endingEvent;
    const durationParts = drought.duration.split(':');
    const durationStr = durationParts[0] !== '0'
      ? `${durationParts[0]}:${durationParts[1]}`
      : `0:${durationParts[1]}`;
    if (ev.shotType.includes('free throw')) {
      return `${ev.shotType} by ${ev.playerName} ends a ${durationStr} drought`;
    }
    return `${ev.playerName} ${ev.shotType} ends a ${durationStr} drought`;
  }, [endEventEnabled, drought.endingEvent, drought.duration]);

  return (
    <View style={styles.card}>
      <View style={styles.droughtHeader}>
        <Text style={styles.droughtTeam}>{drought.teamAbbr}</Text>
        <Text style={styles.droughtLabel}>Drought</Text>
        <Text style={styles.droughtMeta}>Q{drought.period} · {drought.startClock} → {drought.endClock}</Text>
      </View>
      <View style={styles.droughtStats}>
        <View style={styles.droughtStat}>
          <Text style={styles.droughtStatValue}>{drought.duration}</Text>
          <Text style={styles.droughtStatLabel}>Duration</Text>
        </View>
        <View style={styles.droughtStat}>
          <Text style={[styles.droughtStatValue, { color: Colors.negative }]}>{drought.opponentPoints}</Text>
          <Text style={styles.droughtStatLabel}>Opp Pts</Text>
        </View>
        <View style={styles.droughtStat}>
          <Text style={styles.droughtStatValue}>{drought.players.length}</Text>
          <Text style={styles.droughtStatLabel}>On Floor</Text>
        </View>
      </View>
      {endCaption && (
        <View style={styles.droughtEndCaption}>
          <Text style={styles.droughtEndCaptionText}>{endCaption}</Text>
        </View>
      )}
      {lineupContextEnabled && drought.lineupContext && drought.lineupContext.primaryLineup.length === 5 && (
        <View style={styles.droughtLineupSection}>
          <View style={styles.droughtLineupHeader}>
            <Text style={styles.droughtLineupTitle}>PRIMARY LINEUP</Text>
            {drought.lineupContext.primaryLineupMinuteShare > 0 && (
              <Text style={styles.droughtLineupShare}>
                {drought.lineupContext.primaryLineupMinuteShare}% of drought
              </Text>
            )}
          </View>
          <View style={styles.droughtLineupPlayers}>
            {drought.lineupContext.primaryLineup.map((player, idx) => (
              <View key={idx} style={styles.droughtLineupChip}>
                <Text style={styles.droughtLineupChipText}>{player}</Text>
              </View>
            ))}
          </View>
          {drought.lineupContext.substitutionCount > 0 && (
            <View style={styles.droughtSubsBadge}>
              <Text style={styles.droughtSubsText}>
                {drought.lineupContext.substitutionCount} lineup change{drought.lineupContext.substitutionCount !== 1 ? 's' : ''}
              </Text>
            </View>
          )}
          {hasPhases && (
            <TouchableOpacity
              style={styles.droughtExpandBtn}
              onPress={() => setExpanded(v => !v)}
              activeOpacity={0.7}
            >
              <Text style={styles.droughtExpandText}>
                {expanded ? 'Hide lineup phases' : 'Show lineup phases'}
              </Text>
              {expanded
                ? <ChevronUp size={12} color={Colors.primary} />
                : <ChevronDown size={12} color={Colors.primary} />
              }
            </TouchableOpacity>
          )}
          {expanded && hasPhases && drought.lineupContext?.phases?.map((phase, idx) => (
            <View key={idx} style={styles.droughtPhaseRow}>
              <View style={styles.droughtPhaseTime}>
                <Text style={styles.droughtPhaseTimeText}>
                  {phase.startClock} → {phase.endClock}
                </Text>
              </View>
              <View style={styles.droughtPhasePlayers}>
                {phase.players.map((p, pi) => (
                  <Text key={pi} style={styles.droughtPhasePlayerText}>{p}</Text>
                ))}
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function DroughtsPanel({ droughts }: { droughts: ScoringDrought[] }) {
  const unifiedCardEnabled = useFeatureFlag('stretches_unified_card_enabled');
  const contextStatsEnabled = useFeatureFlag('stretches_context_stats_enabled');

  if (droughts.length === 0) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyText}>No scoring droughts detected</Text>
        <Text style={styles.emptySubtext}>A drought is 2+ minutes of game clock without a made field goal</Text>
      </View>
    );
  }

  return (
    <View>
      <Text style={styles.sectionLabel}>SCORING DROUGHTS ({droughts.length})</Text>
      {droughts.map(drought => (
        unifiedCardEnabled
          ? <StretchCard key={drought.id} stretch={drought} mode="drought" showContextStats={contextStatsEnabled} />
          : <DroughtCard key={drought.id} drought={drought} />
      ))}
    </View>
  );
}

function PlayerFilterSheet({
  visible,
  onClose,
  players,
  selected,
  onToggle,
  onClear,
}: {
  visible: boolean;
  onClose: () => void;
  players: string[];
  selected: Set<string>;
  onToggle: (name: string) => void;
  onClear: () => void;
}) {
  const [search, setSearch] = useState<string>('');
  const insets = useSafeAreaInsets();

  const filtered = useMemo(() => {
    if (!search.trim()) return players;
    const q = search.toLowerCase();
    return players.filter(p => p.toLowerCase().includes(q));
  }, [players, search]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.sheetOverlay}>
        <Pressable style={styles.sheetDismiss} onPress={onClose} />
        <View style={[styles.sheetContainer, { paddingBottom: insets.bottom + Spacing.md }]}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Filter by Players</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <X size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <View style={styles.sheetSearchBar}>
            <Search size={14} color={Colors.textMuted} />
            <TextInput
              style={styles.sheetSearchInput}
              placeholder="Search players..."
              placeholderTextColor={Colors.textMuted}
              value={search}
              onChangeText={setSearch}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
          {selected.size > 0 && (
            <View style={styles.sheetSelectedRow}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sheetPillsContent}>
                {Array.from(selected).map(name => (
                  <TouchableOpacity key={name} style={styles.sheetPill} onPress={() => onToggle(name)}>
                    <Text style={styles.sheetPillText}>{name}</Text>
                    <X size={10} color={Colors.primary} />
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <TouchableOpacity style={styles.sheetClearBtn} onPress={onClear}>
                <Text style={styles.sheetClearText}>Clear</Text>
              </TouchableOpacity>
            </View>
          )}
          <ScrollView style={styles.sheetList} showsVerticalScrollIndicator={false}>
            {filtered.map(player => {
              const isSelected = selected.has(player);
              const disabled = !isSelected && selected.size >= 5;
              return (
                <TouchableOpacity
                  key={player}
                  style={[styles.sheetPlayerRow, isSelected && styles.sheetPlayerRowSelected]}
                  onPress={() => !disabled && onToggle(player)}
                  activeOpacity={disabled ? 1 : 0.6}
                >
                  <Text style={[
                    styles.sheetPlayerName,
                    isSelected && styles.sheetPlayerNameSelected,
                    disabled && styles.sheetPlayerNameDisabled,
                  ]}>{player}</Text>
                  {isSelected && (
                    <View style={styles.sheetCheckmark}>
                      <Text style={styles.sheetCheckmarkText}>✓</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <TouchableOpacity style={styles.sheetDoneBtn} onPress={onClose} activeOpacity={0.8}>
            <Text style={styles.sheetDoneText}>
              {selected.size > 0 ? `Apply (${selected.size} player${selected.size !== 1 ? 's' : ''})` : 'Done'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function getConfidenceOpacity(level: ConfidenceLevel): number {
  if (level === 'ultra_low') return 0.3;
  if (level === 'low') return 0.4;
  if (level === 'medium') return 0.7;
  return 1;
}

function getOnOffConfidenceOpacity(level: OnOffConfidenceLevel): number {
  if (level === 'none') return 0.3;
  if (level === 'low') return 0.5;
  if (level === 'medium') return 0.75;
  return 1;
}

function OnCourtSummaryCard({ selectedPlayers, rawActions, gameId, teamId, isHome, homeBoxScore, awayBoxScore, timeline, starters, runs, droughts }: {
  selectedPlayers: Set<string>;
  rawActions: CdnPbpAction[];
  gameId: string;
  teamId: string;
  isHome: boolean;
  homeBoxScore: BoxScorePlayer[];
  awayBoxScore: BoxScorePlayer[];
  timeline?: CanonicalTimelineSegment[];
  starters: string[];
  runs: ScoringRun[];
  droughts: ScoringDrought[];
}) {
  const detailsEnabled = useFeatureFlag('lineups_on_court_summary_details_enabled');
  const contextEnabled = useFeatureFlag('lineups_on_court_summary_context_enabled');
  const onOffEnabled = useFeatureFlag('lineups_on_court_summary_on_off_enabled');
  const [detailSheetVisible, setDetailSheetVisible] = useState<boolean>(false);
  const playerNames = useMemo(() => Array.from(selectedPlayers), [selectedPlayers]);

  const intervals = useMemo(() => {
    if (playerNames.length === 0 || rawActions.length === 0) return [];
    return reconstructPlayerIntervals(rawActions, playerNames, teamId, isHome, starters.length === 5 ? starters : undefined, timeline);
  }, [rawActions, playerNames, teamId, isHome, starters, timeline]);

  const summary = useMemo(() => {
    return computeCanonicalOnCourtSummary(intervals, isHome);
  }, [intervals, isHome]);

  const detailedStats = useMemo<OnCourtDetailedStats | null>(() => {
    if (!detailsEnabled || intervals.length === 0) return null;
    const boxScore = isHome ? homeBoxScore : awayBoxScore;
    return computeOnCourtDetailedStats(intervals, rawActions, teamId, isHome, playerNames, boxScore);
  }, [detailsEnabled, intervals, rawActions, teamId, isHome, playerNames, homeBoxScore, awayBoxScore]);

  const gameFlowContext = useMemo<GameFlowContext | null>(() => {
    if (!contextEnabled || !detailsEnabled || intervals.length === 0) return null;
    return computeGameFlowContext(intervals, runs, droughts, teamId);
  }, [contextEnabled, detailsEnabled, intervals, runs, droughts, teamId]);

  const onOffStats = useMemo<OnOffRatingStats | null>(() => {
    if (!onOffEnabled || intervals.length === 0 || !timeline) return null;
    return computeOnOffRating(intervals, timeline, playerNames, isHome);
  }, [onOffEnabled, intervals, timeline, playerNames, isHome]);

  const confidence = useMemo<OnCourtConfidence | null>(() => {
    if (!summary) return null;
    return computeConfidence(summary.possessions, onOffStats);
  }, [summary, onOffStats]);

  const audit = useMemo<ReconciliationAudit | null>(() => {
    if (playerNames.length !== 1 || intervals.length === 0) return null;
    const boxScore = isHome ? homeBoxScore : awayBoxScore;
    const player = boxScore.find(p => p.name === playerNames[0]);
    if (!player) return null;
    return computeReconciliationAudit(intervals, player.minutes, player.plusMinus, isHome, rawActions, playerNames[0], teamId);
  }, [playerNames, intervals, isHome, homeBoxScore, awayBoxScore, rawActions, teamId]);

  const validationSnapshot = useMemo<OnCourtValidationSnapshot | null>(() => {
    if (!onOffStats) return null;
    const boxScore = isHome ? homeBoxScore : awayBoxScore;
    const playerId = playerNames.length === 1
      ? (boxScore.find(p => p.name === playerNames[0])?.playerId ?? '')
      : '';
    return buildOnCourtValidationSnapshot({
      gameId,
      teamId,
      playerId,
      detailedStats,
      onOffStats,
    });
  }, [onOffStats, detailedStats, gameId, teamId, playerNames, isHome, homeBoxScore, awayBoxScore]);

  const handleSummaryPress = useCallback(() => {
    console.log('[OnCourtSummary] Press: detailsEnabled=%s detailedStats=%s intervals=%d', detailsEnabled, detailedStats != null, intervals.length);
    if (detailedStats) {
      console.log('[OnCourtSummary] Stats check: MIN=%s PTS=%s FG=%s/%s', detailedStats.minutes, detailedStats.points, detailedStats.fgm, detailedStats.fga);
    }
    if (detailsEnabled && detailedStats) {
      console.log('[OnCourtSummary] Opening detail sheet for', playerNames.join(', '));
      setDetailSheetVisible(true);
    }
  }, [detailsEnabled, detailedStats, playerNames, intervals.length]);

  if (!summary) return null;

  const CardOuter = detailsEnabled ? TouchableOpacity : View;
  const cardOuterProps = detailsEnabled
    ? { onPress: handleSummaryPress, activeOpacity: 0.7 }
    : {};

  const advancedOpacity = confidence ? getConfidenceOpacity(confidence.confidenceLevel) : 1;
  const onOffOpacity = confidence ? getOnOffConfidenceOpacity(confidence.onOffConfidenceLevel) : 1;
  const showOnOff = onOffEnabled && onOffStats && confidence && confidence.onOffConfidenceLevel !== 'none';

  return (
    <>
    <CardOuter style={styles.summaryCard} {...(cardOuterProps as any)}>
      <View style={styles.summaryTitleRow}>
        <Users size={12} color={Colors.secondary} />
        <Text style={styles.summaryTitle}>ON-COURT SUMMARY</Text>
        <Text style={styles.summarySubtitle}>{summary.segmentCount} interval{summary.segmentCount !== 1 ? 's' : ''}</Text>
      </View>
      <View style={styles.summaryGrid}>
        <View style={styles.summaryGridItem}>
          <Text style={styles.summaryGridValue}>{summary.minutes}</Text>
          <Text style={styles.summaryGridLabel}>MIN</Text>
        </View>
        <View style={styles.summaryGridItem}>
          <Text style={styles.summaryGridValue}>{summary.possessions}</Text>
          <Text style={styles.summaryGridLabel}>POSS</Text>
        </View>
        <View style={[styles.summaryGridItem, styles.summaryPrimaryItem]}>
          <Text style={[styles.summaryPrimaryValue, { color: summary.plusMinus >= 0 ? Colors.positive : Colors.negative }]}>
            {summary.plusMinus > 0 ? '+' : ''}{summary.plusMinus}
          </Text>
          <Text style={styles.summaryGridLabel}>+/-</Text>
        </View>
      </View>
      <View style={[styles.summaryGrid, { opacity: advancedOpacity }]}>
        {(() => {
          const isUltraLow = confidence?.confidenceLevel === 'ultra_low';
          const dp = isUltraLow ? 0 : 1;
          return (
            <>
              <View style={styles.summaryGridItem}>
                <Text style={[styles.summaryGridValue, { color: summary.netRating >= 0 ? Colors.positive : Colors.negative }]}>
                  {summary.netRating >= 0 ? '+' : ''}{summary.netRating.toFixed(dp)}
                </Text>
                <Text style={styles.summaryGridLabel}>NET</Text>
              </View>
              <View style={styles.summaryGridItem}>
                <Text style={styles.summaryGridValue}>{summary.offRating.toFixed(dp)}</Text>
                <Text style={styles.summaryGridLabel}>ORTG</Text>
              </View>
              <View style={styles.summaryGridItem}>
                <Text style={styles.summaryGridValue}>{summary.defRating.toFixed(dp)}</Text>
                <Text style={styles.summaryGridLabel}>DRTG</Text>
              </View>
            </>
          );
        })()}
      </View>
      {showOnOff && onOffStats && (
        <View style={[styles.summaryOnOffRow, { opacity: onOffOpacity }]}>
          <Text style={styles.summaryOnOffLabel}>On/Off</Text>
          <Text style={[
            styles.summaryOnOffValue,
            { color: onOffStats.onOffRating !== null
              ? (onOffStats.onOffRating >= 0 ? Colors.positive : Colors.negative)
              : Colors.textMuted
            },
          ]}>
            {onOffStats.onOffRating !== null
              ? `${onOffStats.onOffRating >= 0 ? '+' : ''}${onOffStats.onOffRating.toFixed(1)}`
              : '—'}
          </Text>
        </View>
      )}
      {onOffEnabled && !showOnOff && (
        <View style={[styles.summaryOnOffRow, { opacity: 0.35 }]}>
          <Text style={styles.summaryOnOffLabel}>On/Off</Text>
          <Text style={[styles.summaryOnOffValue, { color: Colors.textMuted }]}>—</Text>
        </View>
      )}
      {confidence && confidence.confidenceLevel === 'ultra_low' && (
        <Text style={styles.summarySmallSampleText}>
          Small sample ({summary.possessions} possessions)
        </Text>
      )}
      {detailsEnabled && (
        <View style={styles.summaryTapHint}>
          <Text style={styles.summaryTapHintText}>Tap for detailed breakdown</Text>
        </View>
      )}
      {audit && (
        <View style={styles.auditSection}>
          <Text style={styles.auditTitle}>RECONCILIATION</Text>
          <View style={styles.auditRow}>
            <Text style={styles.auditLabel}>Box Score MIN</Text>
            <Text style={styles.auditValue}>{audit.boxScoreMinutes}</Text>
          </View>
          <View style={styles.auditRow}>
            <Text style={styles.auditLabel}>Computed MIN</Text>
            <Text style={styles.auditValue}>{audit.computedMinutes}</Text>
          </View>
          <View style={styles.auditRow}>
            <Text style={styles.auditLabel}>MIN Δ</Text>
            <Text style={[
              styles.auditValue,
              { color: Math.abs(audit.minutesDelta) <= 0.5 ? Colors.positive : Math.abs(audit.minutesDelta) <= 1.5 ? Colors.warning : Colors.negative },
            ]}>
              {audit.minutesDelta > 0 ? '+' : ''}{audit.minutesDelta}
            </Text>
          </View>
          <View style={styles.auditDivider} />
          <View style={styles.auditRow}>
            <Text style={styles.auditLabel}>Box Score +/-</Text>
            <Text style={styles.auditValue}>{audit.boxScorePlusMinus > 0 ? '+' : ''}{audit.boxScorePlusMinus}</Text>
          </View>
          <View style={styles.auditRow}>
            <Text style={styles.auditLabel}>Computed +/-</Text>
            <Text style={styles.auditValue}>{audit.computedPlusMinus > 0 ? '+' : ''}{audit.computedPlusMinus}</Text>
          </View>
          <View style={styles.auditRow}>
            <Text style={styles.auditLabel}>+/- Δ</Text>
            <Text style={[
              styles.auditValue,
              { color: audit.plusMinusDelta === 0 ? Colors.positive : Math.abs(audit.plusMinusDelta) <= 2 ? Colors.warning : Colors.negative },
            ]}>
              {audit.plusMinusDelta > 0 ? '+' : ''}{audit.plusMinusDelta}
            </Text>
          </View>
          <View style={styles.auditDivider} />
          <View style={styles.auditRow}>
            <Text style={styles.auditLabel}>Intervals</Text>
            <Text style={styles.auditValue}>{audit.intervalCount}</Text>
          </View>
          <View style={styles.auditRow}>
            <Text style={styles.auditLabel}>Gaps</Text>
            <Text style={[styles.auditValue, { color: audit.hasGaps ? Colors.warning : Colors.positive }]}>
              {audit.hasGaps ? `${audit.gapSeconds}s` : 'None'}
            </Text>
          </View>
          <View style={styles.auditRow}>
            <Text style={styles.auditLabel}>Overlaps</Text>
            <Text style={[styles.auditValue, { color: audit.hasOverlaps ? Colors.negative : Colors.positive }]}>
              {audit.hasOverlaps ? `${audit.overlapSeconds}s` : 'None'}
            </Text>
          </View>
          {audit.plusMinusDelta !== 0 && audit.mismatchCauses.length > 0 && (
            <>
              <View style={styles.auditDivider} />
              <View style={styles.auditRow}>
                <Text style={styles.auditLabel}>Likely cause</Text>
                <Text style={[styles.auditValue, { color: Colors.warning, fontSize: 10 }]} numberOfLines={2}>
                  {audit.mismatchCauses.map(c => c.replace(/_/g, ' ')).join(', ')}
                </Text>
              </View>
              {audit.sameClockSubEvents > 0 && (
                <View style={styles.auditRow}>
                  <Text style={styles.auditLabel}>Same-clock subs</Text>
                  <Text style={styles.auditValue}>{audit.sameClockSubEvents}</Text>
                </View>
              )}
              {audit.ftSequenceSubEvents > 0 && (
                <View style={styles.auditRow}>
                  <Text style={styles.auditLabel}>FT sequence subs</Text>
                  <Text style={styles.auditValue}>{audit.ftSequenceSubEvents}</Text>
                </View>
              )}
              {audit.quarterStartAmbiguities > 0 && (
                <View style={styles.auditRow}>
                  <Text style={styles.auditLabel}>Qtr start ambiguity</Text>
                  <Text style={styles.auditValue}>{audit.quarterStartAmbiguities}</Text>
                </View>
              )}
            </>
          )}
        </View>
      )}
    </CardOuter>
    {detailsEnabled && (
      <OnCourtSummaryDetailSheet
        visible={detailSheetVisible}
        onClose={() => setDetailSheetVisible(false)}
        stats={detailedStats}
        playerNames={playerNames}
        gameFlowContext={gameFlowContext}
        onOffStats={onOffStats}
        confidence={confidence}
        validationSnapshot={validationSnapshot}
      />
    )}
    </>
  );
}

function LineupDeepDiveModal({ visible, onClose, segment }: {
  visible: boolean;
  onClose: () => void;
  segment: LineupSegment | null;
}) {
  const insets = useSafeAreaInsets();
  if (!segment) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.sheetOverlay}>
        <Pressable style={styles.sheetDismiss} onPress={onClose} />
        <View style={[styles.deepDiveContainer, { paddingBottom: insets.bottom + Spacing.md }]}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Lineup Deep Dive</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <X size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.deepDivePlayers}>
              {segment.players.map((p, i) => (
                <View key={i} style={styles.deepDivePlayerChip}>
                  <Text style={styles.deepDivePlayerText}>{p}</Text>
                </View>
              ))}
            </View>
            <View style={styles.deepDiveStatsGrid}>
              <View style={styles.deepDiveStatBox}>
                <Text style={styles.deepDiveStatValue}>{segment.minutes.toFixed(1)}</Text>
                <Text style={styles.deepDiveStatLabel}>Minutes</Text>
              </View>
              <View style={styles.deepDiveStatBox}>
                <Text style={[styles.deepDiveStatValue, { color: segment.plusMinus >= 0 ? Colors.positive : Colors.negative }]}>
                  {segment.plusMinus > 0 ? '+' : ''}{segment.plusMinus}
                </Text>
                <Text style={styles.deepDiveStatLabel}>+/-</Text>
              </View>
              <View style={styles.deepDiveStatBox}>
                <Text style={styles.deepDiveStatValue}>{segment.offRating.toFixed(1)}</Text>
                <Text style={styles.deepDiveStatLabel}>ORtg</Text>
              </View>
              <View style={styles.deepDiveStatBox}>
                <Text style={styles.deepDiveStatValue}>{segment.defRating.toFixed(1)}</Text>
                <Text style={styles.deepDiveStatLabel}>DRtg</Text>
              </View>
              <View style={styles.deepDiveStatBox}>
                <Text style={[styles.deepDiveStatValue, { color: segment.netRating >= 0 ? Colors.positive : Colors.negative }]}>
                  {segment.netRating >= 0 ? '+' : ''}{segment.netRating.toFixed(1)}
                </Text>
                <Text style={styles.deepDiveStatLabel}>Net Rtg</Text>
              </View>
              <View style={styles.deepDiveStatBox}>
                <Text style={styles.deepDiveStatValue}>{segment.points}</Text>
                <Text style={styles.deepDiveStatLabel}>PTS For</Text>
              </View>
            </View>
            {segment.stints && segment.stints.length > 1 && (
              <View style={styles.deepDiveStintsSection}>
                <Text style={styles.deepDiveStintsTitle}>STINT BREAKDOWN</Text>
                {segment.stints.map((stint, idx) => (
                  <View key={idx} style={styles.deepDiveStintRow}>
                    <Text style={styles.deepDiveStintLabel}>Stint {idx + 1}</Text>
                    <Text style={styles.deepDiveStintMins}>{stint.minutes.toFixed(1)} min</Text>
                    <Text style={[
                      styles.deepDiveStintPM,
                      { color: stint.plusMinus >= 0 ? Colors.positive : Colors.negative }
                    ]}>
                      {stint.plusMinus > 0 ? '+' : ''}{stint.plusMinus}
                    </Text>
                  </View>
                ))}
              </View>
            )}
            {segment.isLowLeverage && (
              <View style={[styles.lowLeverageBadge, { marginTop: Spacing.md }]}>
                <Text style={styles.lowLeverageText}>Low Leverage</Text>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function LineupsPanel({ lineups, rawActions, gameId, homeTeamId, awayTeamId, homeBoxScore, awayBoxScore, homeTimeline, awayTimeline, homeStarters, awayStarters, runs, droughts }: {
  lineups: LineupSegment[];
  rawActions: CdnPbpAction[];
  gameId: string;
  homeTeamId: string;
  awayTeamId: string;
  homeBoxScore: BoxScorePlayer[];
  awayBoxScore: BoxScorePlayer[];
  homeTimeline?: CanonicalTimelineSegment[];
  awayTimeline?: CanonicalTimelineSegment[];
  homeStarters: string[];
  awayStarters: string[];
  runs: ScoringRun[];
  droughts: ScoringDrought[];
}) {
  const filtersEnabled = useFeatureFlag('lineups_filters_enabled');
  const playerFiltersEnabled = useFeatureFlag('lineups_player_filters_enabled');
  const onCourtSummaryEnabled = useFeatureFlag('lineups_on_court_summary_enabled');
  const deepDiveEnabled = useFeatureFlag('lineups_deep_dive_enabled');

  const [sortBy, setSortBy] = useState<'netRating' | 'minutes' | 'plusMinus'>('netRating');
  const [minMinutes, setMinMinutes] = useState<number>(0);
  const [hideLowLeverage, setHideLowLeverage] = useState<boolean>(false);
  const [selectedPlayers, setSelectedPlayers] = useState<Set<string>>(new Set());
  const [sheetVisible, setSheetVisible] = useState<boolean>(false);
  const [deepDiveSeg, setDeepDiveSeg] = useState<LineupSegment | null>(null);

  const allPlayers = useMemo(() => {
    const set = new Set<string>();
    lineups.forEach(seg => seg.players.forEach(p => set.add(p)));
    return Array.from(set).sort();
  }, [lineups]);

  const handleTogglePlayer = useCallback((name: string) => {
    setSelectedPlayers(prev => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else if (next.size < 5) {
        next.add(name);
      }
      return next;
    });
  }, []);

  const handleClearPlayers = useCallback(() => {
    setSelectedPlayers(new Set());
  }, []);

  const filteredLineups = useMemo(() => {
    let result = [...lineups];

    if (playerFiltersEnabled && selectedPlayers.size > 0) {
      result = result.filter(seg =>
        Array.from(selectedPlayers).every(p => seg.players.includes(p))
      );
    }

    if (filtersEnabled) {
      if (minMinutes > 0) {
        result = result.filter(s => s.minutes >= minMinutes);
      }
      if (hideLowLeverage) {
        result = result.filter(s => !s.isLowLeverage);
      }
      result.sort((a, b) => {
        if (sortBy === 'netRating') return b.netRating - a.netRating;
        if (sortBy === 'minutes') return b.minutes - a.minutes;
        return b.plusMinus - a.plusMinus;
      });
    }

    return result;
  }, [lineups, filtersEnabled, playerFiltersEnabled, selectedPlayers, sortBy, minMinutes, hideLowLeverage]);

  const displayLineups = (filtersEnabled || (playerFiltersEnabled && selectedPlayers.size > 0))
    ? filteredLineups
    : lineups;

  if (lineups.length === 0) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyText}>No lineup segments computed</Text>
        <Text style={styles.emptySubtext}>Lineups are reconstructed from substitution patterns in play-by-play data</Text>
      </View>
    );
  }

  return (
    <View>
      {playerFiltersEnabled && (
        <TouchableOpacity
          style={styles.playerFilterBtn}
          onPress={() => setSheetVisible(true)}
          activeOpacity={0.7}
        >
          <Filter size={14} color={selectedPlayers.size > 0 ? Colors.primary : Colors.textMuted} />
          <Text style={[
            styles.playerFilterBtnText,
            selectedPlayers.size > 0 && styles.playerFilterBtnTextActive,
          ]}>
            {selectedPlayers.size > 0
              ? `On Court: ${Array.from(selectedPlayers).join(', ')}`
              : 'On Court: All'
            }
          </Text>
          <ChevronDown size={14} color={selectedPlayers.size > 0 ? Colors.primary : Colors.textMuted} />
        </TouchableOpacity>
      )}

      {playerFiltersEnabled && onCourtSummaryEnabled && selectedPlayers.size > 0 && (() => {
        const firstPlayer = Array.from(selectedPlayers)[0];
        const isHomeTeam = lineups.some(seg =>
          seg.teamId === homeTeamId && seg.players.includes(firstPlayer)
        );
        const teamId = isHomeTeam ? homeTeamId : awayTeamId;
        return (
          <OnCourtSummaryCard
            selectedPlayers={selectedPlayers}
            rawActions={rawActions}
            gameId={gameId}
            teamId={teamId}
            isHome={isHomeTeam}
            homeBoxScore={homeBoxScore}
            awayBoxScore={awayBoxScore}
            timeline={isHomeTeam ? homeTimeline : awayTimeline}
            starters={isHomeTeam ? homeStarters : awayStarters}
            runs={runs}
            droughts={droughts}
          />
        );
      })()}

      {filtersEnabled && (
        <View style={styles.lineupFilterBar}>
          <View style={styles.lineupFilterRow}>
            <Text style={styles.lineupFilterLabel}>Sort</Text>
            {(['netRating', 'minutes', 'plusMinus'] as const).map(key => (
              <TouchableOpacity
                key={key}
                style={[styles.lineupFilterChip, sortBy === key && styles.lineupFilterChipActive]}
                onPress={() => setSortBy(key)}
              >
                <Text style={[styles.lineupFilterChipText, sortBy === key && styles.lineupFilterChipTextActive]}>
                  {key === 'netRating' ? 'Net Rtg' : key === 'minutes' ? 'Minutes' : '+/-'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.lineupFilterRow}>
            <Text style={styles.lineupFilterLabel}>Min minutes</Text>
            {[0, 2, 5].map(val => (
              <TouchableOpacity
                key={val}
                style={[styles.lineupFilterChip, minMinutes === val && styles.lineupFilterChipActive]}
                onPress={() => setMinMinutes(val)}
              >
                <Text style={[styles.lineupFilterChipText, minMinutes === val && styles.lineupFilterChipTextActive]}>
                  {val === 0 ? 'All' : `${val}+`}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[styles.lineupFilterChip, hideLowLeverage && styles.lineupFilterChipActive]}
              onPress={() => setHideLowLeverage(v => !v)}
            >
              <Text style={[styles.lineupFilterChipText, hideLowLeverage && styles.lineupFilterChipTextActive]}>
                Hide Low Leverage
              </Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.lineupFilterHint}>
            Showing {displayLineups.length} of {lineups.length} segments
          </Text>
        </View>
      )}
      <Text style={styles.sectionLabel}>LINEUP SEGMENTS ({displayLineups.length})</Text>
      {displayLineups.map(seg => {
        const CardWrapper = deepDiveEnabled ? TouchableOpacity : View;
        const wrapperProps = deepDiveEnabled
          ? { onPress: () => setDeepDiveSeg(seg), activeOpacity: 0.7 }
          : {};
        return (
          <CardWrapper key={seg.id} style={styles.card} {...(wrapperProps as any)}>
            <View style={styles.lineupHeader}>
              <Text style={[styles.lineupNet, { color: seg.netRating >= 0 ? Colors.positive : Colors.negative }]}>
                {seg.netRating >= 0 ? '+' : ''}{seg.netRating.toFixed(1)}
              </Text>
              <Text style={styles.lineupNetLabel}>NET RTG</Text>
              <Text style={styles.lineupMinutes}>{seg.minutes.toFixed(1)} min</Text>
            </View>
            <View style={styles.lineupPlayers}>
              {seg.players.map((p, i) => {
                const isHighlighted = playerFiltersEnabled && selectedPlayers.size > 0 && selectedPlayers.has(p);
                return (
                  <View key={i} style={[styles.lineupChip, isHighlighted && styles.lineupChipHighlighted]}>
                    <Text style={[styles.lineupChipText, isHighlighted && styles.lineupChipTextHighlighted]}>{p}</Text>
                  </View>
                );
              })}
            </View>
            <View style={styles.lineupStats}>
              <View style={styles.lineupStatItem}>
                <Text style={styles.lineupStatValue}>{seg.points}</Text>
                <Text style={styles.lineupStatLabel}>PTS</Text>
              </View>
              <View style={styles.lineupStatItem}>
                <Text style={styles.lineupStatValue}>{seg.pointsAllowed}</Text>
                <Text style={styles.lineupStatLabel}>Allowed</Text>
              </View>
              <View style={styles.lineupStatItem}>
                <Text style={[styles.lineupStatValue, { color: seg.plusMinus >= 0 ? Colors.positive : Colors.negative }]}>
                  {seg.plusMinus > 0 ? '+' : ''}{seg.plusMinus}
                </Text>
                <Text style={styles.lineupStatLabel}>+/-</Text>
              </View>
              <View style={styles.lineupStatItem}>
                <Text style={styles.lineupStatValue}>{seg.offRating.toFixed(0)}</Text>
                <Text style={styles.lineupStatLabel}>ORtg</Text>
              </View>
              <View style={styles.lineupStatItem}>
                <Text style={styles.lineupStatValue}>{seg.defRating.toFixed(0)}</Text>
                <Text style={styles.lineupStatLabel}>DRtg</Text>
              </View>
            </View>
            {seg.isLowLeverage && (
              <View style={styles.lowLeverageBadge}>
                <Text style={styles.lowLeverageText}>Low Leverage</Text>
              </View>
            )}
            {deepDiveEnabled && (
              <View style={styles.lineupTapHint}>
                <Text style={styles.lineupTapHintText}>Tap for details</Text>
              </View>
            )}
          </CardWrapper>
        );
      })}

      {playerFiltersEnabled && (
        <PlayerFilterSheet
          visible={sheetVisible}
          onClose={() => setSheetVisible(false)}
          players={allPlayers}
          selected={selectedPlayers}
          onToggle={handleTogglePlayer}
          onClear={handleClearPlayers}
        />
      )}

      {deepDiveEnabled && (
        <LineupDeepDiveModal
          visible={!!deepDiveSeg}
          onClose={() => setDeepDiveSeg(null)}
          segment={deepDiveSeg}
        />
      )}
    </View>
  );
}

function ImpactPanel({ metrics }: { metrics: CustomMetric[] }) {
  if (metrics.length === 0) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyText}>No derived metrics available</Text>
        <Text style={styles.emptySubtext}>Run participation, swing metrics, and impact scores will appear as more game data is processed</Text>
      </View>
    );
  }

  return (
    <View>
      <Text style={styles.sectionLabel}>DERIVED METRICS ({metrics.length})</Text>
      {metrics.map(m => (
        <View key={m.id} style={styles.card}>
          <View style={styles.metricRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.metricName}>{m.name}</Text>
              {m.playerName && <Text style={styles.metricPlayer}>{m.playerName} · {m.teamAbbr}</Text>}
            </View>
            <View style={styles.metricValueCol}>
              <Text style={[styles.metricValue, {
                color: m.trend === 'up' ? Colors.positive : m.trend === 'down' ? Colors.negative : Colors.textSecondary,
              }]}>{m.value}{m.unit === '%' ? '%' : ''}</Text>
              <Text style={styles.metricUnit}>{m.unit !== '%' ? m.unit : ''}</Text>
            </View>
          </View>
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
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  headerCenter: {
    alignItems: 'center',
    gap: 2,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: Colors.textPrimary,
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  loadingText: {
    color: Colors.textMuted,
    fontSize: FontSize.md,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xxl,
    gap: Spacing.md,
  },
  errorText: {
    color: Colors.textPrimary,
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
  },
  errorSubtext: {
    color: Colors.textMuted,
    fontSize: FontSize.md,
    textAlign: 'center',
    lineHeight: 22,
  },
  retryBtn: {
    backgroundColor: Colors.primaryMuted,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.md,
  },
  retryText: {
    color: Colors.primary,
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
  },
  scoreHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.lg,
  },
  teamScoreCol: {
    alignItems: 'center',
    gap: 4,
  },
  teamColorBar: {
    width: 32,
    height: 3,
    borderRadius: 2,
    marginBottom: 4,
  },
  teamScoreAbbr: {
    color: Colors.textSecondary,
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
  },
  teamScoreValue: {
    color: Colors.textPrimary,
    fontSize: 40,
    fontWeight: FontWeight.heavy,
    letterSpacing: -1,
  },
  gameInfo: {
    alignItems: 'center',
    gap: 4,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.negativeMuted,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.sm,
    gap: 4,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.negative,
  },
  liveText: {
    color: Colors.negative,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    letterSpacing: 1,
  },
  periodInfo: {
    color: Colors.textSecondary,
    fontSize: FontSize.md,
    fontWeight: FontWeight.medium,
  },
  arenaInfo: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
  },
  seriesInfo: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    textAlign: 'center',
    maxWidth: 150,
  },
  tabContainer: {
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
  sectionLabel: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    letterSpacing: 1.5,
    marginBottom: Spacing.md,
    marginTop: Spacing.lg,
  },
  demoNotice: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    lineHeight: 18,
    marginTop: Spacing.sm,
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
  filterRow: {
    marginBottom: Spacing.md,
  },
  filterRowContent: {
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  emptyState: {
    padding: Spacing.xxxl,
    alignItems: 'center',
    gap: Spacing.xs,
  },
  emptyText: {
    color: Colors.textMuted,
    fontSize: FontSize.md,
  },
  emptySubtext: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    textAlign: 'center',
    lineHeight: 18,
  },
  singleStatRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  singleStatLabel: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  singleStatValueWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  singleStatDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  singleStatValue: {
    color: Colors.textPrimary,
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    fontVariant: ['tabular-nums'] as const,
  },
  boxCard: {
    backgroundColor: Colors.cardBg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  boxHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
    paddingBottom: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  boxHeaderText: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.5,
  },
  boxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  boxNameCell: {
    width: 100,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  boxPlayerName: {
    color: Colors.textPrimary,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  boxPlayerNameTappable: {
    color: Colors.primary,
  },
  boxPlayerPos: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
  },
  boxCell: {
    width: 44,
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    textAlign: 'center',
    fontVariant: ['tabular-nums'] as const,
  },
  boxBold: {
    color: Colors.textPrimary,
    fontWeight: FontWeight.bold,
  },
  droughtHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  droughtTeam: {
    color: Colors.textPrimary,
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
  },
  droughtLabel: {
    color: Colors.negative,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  droughtMeta: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    marginLeft: 'auto',
  },
  droughtStats: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  droughtStat: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.sm,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
  },
  droughtStatValue: {
    color: Colors.textPrimary,
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
  },
  droughtStatLabel: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    marginTop: 2,
  },
  droughtLineupSection: {
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  droughtLineupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  droughtLineupTitle: {
    color: Colors.textMuted,
    fontSize: 9,
    fontWeight: FontWeight.bold,
    letterSpacing: 1.2,
  },
  droughtLineupShare: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
  },
  droughtLineupPlayers: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  droughtLineupChip: {
    backgroundColor: Colors.negativeMuted,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.sm,
  },
  droughtLineupChipText: {
    color: Colors.textSecondary,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
  },
  droughtSubsBadge: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.warningMuted,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.sm,
  },
  droughtSubsText: {
    color: Colors.warning,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
  },
  lineupHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  lineupNet: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.heavy,
  },
  lineupNetLabel: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.5,
  },
  lineupMinutes: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    marginLeft: 'auto',
  },
  lineupPlayers: {
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
  lineupStats: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  lineupStatItem: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.sm,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
  },
  lineupStatValue: {
    color: Colors.textPrimary,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
  },
  lineupStatLabel: {
    color: Colors.textMuted,
    fontSize: 9,
    marginTop: 2,
  },
  lowLeverageBadge: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.warningMuted,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.sm,
  },
  lowLeverageText: {
    color: Colors.warning,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metricName: {
    color: Colors.textPrimary,
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
  },
  metricPlayer: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    marginTop: 2,
  },
  metricValueCol: {
    alignItems: 'flex-end',
  },
  metricValue: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.heavy,
  },
  metricUnit: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
  },
  lineupFilterBar: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    gap: Spacing.sm,
  },
  lineupFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    flexWrap: 'wrap',
  },
  lineupFilterLabel: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    marginRight: 4,
    minWidth: 36,
  },
  lineupFilterChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.surfaceLight,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  lineupFilterChipActive: {
    backgroundColor: Colors.primaryMuted,
    borderColor: Colors.primary,
  },
  lineupFilterChipText: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
  },
  lineupFilterChipTextActive: {
    color: Colors.primary,
  },
  lineupFilterHint: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    marginTop: 2,
  },
  droughtEndCaption: {
    marginTop: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  droughtEndCaptionText: {
    color: Colors.positive,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    fontStyle: 'italic' as const,
    lineHeight: 18,
  },
  droughtExpandBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  droughtExpandText: {
    color: Colors.primary,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
  },
  droughtPhaseRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  droughtPhaseTime: {
    minWidth: 80,
  },
  droughtPhaseTimeText: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontVariant: ['tabular-nums'] as const,
  },
  droughtPhasePlayers: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 3,
  },
  droughtPhasePlayerText: {
    color: Colors.textSecondary,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
  },
  playerFilterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    marginBottom: Spacing.md,
  },
  playerFilterBtnText: {
    flex: 1,
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
  playerFilterBtnTextActive: {
    color: Colors.primary,
  },
  lineupChipHighlighted: {
    backgroundColor: Colors.primaryMuted,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  lineupChipTextHighlighted: {
    color: Colors.primary,
    fontWeight: FontWeight.bold,
  },
  lineupTapHint: {
    alignItems: 'center',
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  lineupTapHintText: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
  },
  summaryCard: {
    backgroundColor: Colors.cardBg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.secondary,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  summaryTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  summaryTitle: {
    color: Colors.secondary,
    fontSize: 9,
    fontWeight: FontWeight.bold,
    letterSpacing: 1.2,
  },
  summarySubtitle: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    marginLeft: 'auto',
  },
  summaryGrid: {
    flexDirection: 'row',
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  summaryGridItem: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.sm,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
  },
  summaryGridValue: {
    color: Colors.textPrimary,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    fontVariant: ['tabular-nums'] as const,
  },
  summaryPrimaryItem: {
    backgroundColor: Colors.surfaceLight,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  summaryPrimaryValue: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.heavy,
    fontVariant: ['tabular-nums'] as const,
  },
  summaryGridLabel: {
    color: Colors.textMuted,
    fontSize: 9,
    marginTop: 2,
  },
  summaryOnOffRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  summaryOnOffLabel: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.5,
  },
  summaryOnOffValue: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    fontVariant: ['tabular-nums'] as const,
  },
  summarySmallSampleText: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    textAlign: 'center' as const,
    paddingVertical: Spacing.xs,
    fontStyle: 'italic' as const,
  },
  summaryTapHint: {
    alignItems: 'center',
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  summaryTapHintText: {
    color: Colors.secondary,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
  },
  sheetOverlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'flex-end',
  },
  sheetDismiss: {
    flex: 1,
  },
  sheetContainer: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    maxHeight: '80%',
    paddingHorizontal: Spacing.lg,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.divider,
    alignSelf: 'center',
    marginTop: Spacing.md,
    marginBottom: Spacing.md,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  sheetTitle: {
    color: Colors.textPrimary,
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
  },
  sheetSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.md,
  },
  sheetSearchInput: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: FontSize.sm,
    padding: 0,
  },
  sheetSelectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  sheetPillsContent: {
    gap: Spacing.xs,
  },
  sheetPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primaryMuted,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  sheetPillText: {
    color: Colors.primary,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
  },
  sheetClearBtn: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
  },
  sheetClearText: {
    color: Colors.negative,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
  },
  sheetList: {
    maxHeight: 300,
  },
  sheetPlayerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  sheetPlayerRowSelected: {
    backgroundColor: Colors.primaryMuted,
    marginHorizontal: -Spacing.sm,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.sm,
    borderBottomColor: 'transparent',
  },
  sheetPlayerName: {
    color: Colors.textPrimary,
    fontSize: FontSize.md,
    fontWeight: FontWeight.medium,
  },
  sheetPlayerNameSelected: {
    color: Colors.primary,
    fontWeight: FontWeight.bold,
  },
  sheetPlayerNameDisabled: {
    color: Colors.textMuted,
  },
  sheetCheckmark: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetCheckmarkText: {
    color: Colors.white,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
  },
  sheetDoneBtn: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  sheetDoneText: {
    color: Colors.white,
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
  },
  deepDiveContainer: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    maxHeight: '85%',
    paddingHorizontal: Spacing.lg,
  },
  deepDivePlayers: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  deepDivePlayerChip: {
    backgroundColor: Colors.surfaceLight,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  deepDivePlayerText: {
    color: Colors.textPrimary,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  deepDiveStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  deepDiveStatBox: {
    width: '30%',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    flexGrow: 1,
  },
  deepDiveStatValue: {
    color: Colors.textPrimary,
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    fontVariant: ['tabular-nums'] as const,
  },
  deepDiveStatLabel: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    marginTop: 4,
  },
  deepDiveStintsSection: {
    marginBottom: Spacing.lg,
  },
  deepDiveStintsTitle: {
    color: Colors.textMuted,
    fontSize: 9,
    fontWeight: FontWeight.bold,
    letterSpacing: 1.2,
    marginBottom: Spacing.md,
  },
  deepDiveStintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  deepDiveStintLabel: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    flex: 1,
  },
  deepDiveStintMins: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    fontVariant: ['tabular-nums'] as const,
    marginRight: Spacing.lg,
  },
  deepDiveStintPM: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    fontVariant: ['tabular-nums'] as const,
    minWidth: 36,
    textAlign: 'right' as const,
  },
  auditSection: {
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  auditTitle: {
    color: Colors.textMuted,
    fontSize: 9,
    fontWeight: FontWeight.bold,
    letterSpacing: 1.2,
    marginBottom: Spacing.sm,
  },
  auditRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 3,
  },
  auditLabel: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
  },
  auditValue: {
    color: Colors.textSecondary,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    fontVariant: ['tabular-nums'] as const,
  },
  auditDivider: {
    height: 1,
    backgroundColor: Colors.divider,
    marginVertical: 4,
  },
});

const scheduledStyles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.lg,
  },
  teamCol: {
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  teamAbbr: {
    color: Colors.textPrimary,
    fontSize: FontSize.xl,
    fontWeight: FontWeight.heavy,
    letterSpacing: 0.5,
  },
  teamName: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
  },
  middle: {
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  scheduledBadge: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.sm,
  },
  scheduledBadgeText: {
    color: Colors.textSecondary,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    letterSpacing: 1,
  },
  vsText: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    letterSpacing: 1,
  },
  tipoffText: {
    color: Colors.textPrimary,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
  },
  arenaText: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
    maxWidth: 140,
    textAlign: 'center',
  },
  seriesText: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    maxWidth: 150,
    textAlign: 'center',
  },
});
