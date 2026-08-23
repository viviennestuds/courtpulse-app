import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Pressable, FlatList, Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { Film, Info, Flame, Target, Activity, Zap, ChevronDown, ArrowLeftRight, RotateCcw, X } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { Spacing, BorderRadius, FontSize, FontWeight } from '@/constants/theme';
import { BoxScorePlayer, Team, Player, ScoringRun } from '@/types';
import { useTeams, usePlayers, useGameMatchups } from '@/hooks/useNbaData';
import { useGameMatchupSummaryV2 } from '@/hooks/useGameMatchupSummaryV2';
import { gameMatchupSummaryV2QueryKey } from '@/services/matchupSummaryV2QueryPolicy';
import { resolveMatchupSummaryV2Availability } from '@/services/matchupSummaryV2Availability';
import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import {
  MatchupV2KeyMatchups,
  MatchupV2PairSelection,
  MatchupV2WhoGuarded,
} from '@/components/MatchupV2Summary';
import type { CdnPbpAction, GameMatchupRow } from '@/services/nbaGameData';
import {
  buildNbaMatchupFilmUrl,
  getSeasonFromGameId,
  getSeasonTypeFromGameId,
} from '@/utils/nbaGameSeason';
import { buildMatchupGameDrivers } from '@/utils/matchupDrivers';
import { useResponsiveLayout } from '@/components/ResponsiveLayout';

interface TeamSide {
  id: string;
  abbreviation: string;
  name: string;
  primaryColor: string;
  score: number;
}

type GameStatus = 'live' | 'final' | 'scheduled';
type FilmRoomSelectionSource = 'default' | 'keyMatchup' | 'custom';

interface FilmRoomPairSelectionRequest extends MatchupV2PairSelection {
  requestId: number;
}

interface MatchupRealDataTabProps {
  homeTeam: TeamSide;
  awayTeam: TeamSide;
  homeTeamStats: Record<string, number>;
  awayTeamStats: Record<string, number>;
  homeBoxScore: BoxScorePlayer[];
  awayBoxScore: BoxScorePlayer[];
  status: GameStatus;
  rawActions?: CdnPbpAction[];
  gameId?: string;
  runs?: ScoringRun[];
}

type EdgeDirection = 'home' | 'away' | 'neutral';

interface FactorRow {
  label: string;
  unit: string;
  homeVal: number;
  awayVal: number;
  threshold: number;
  invert?: boolean;
  format: 'pct' | 'number' | 'rating';
  hint?: string;
}

interface DriverNote {
  id: string;
  body: string;
}

function classifyEdge(home: number, away: number, threshold: number, invert?: boolean): EdgeDirection {
  if (!Number.isFinite(home) || !Number.isFinite(away)) return 'neutral';
  const diff = home - away;
  if (Math.abs(diff) < threshold) return 'neutral';
  const homeBetter = invert ? diff < 0 : diff > 0;
  return homeBetter ? 'home' : 'away';
}

function parseMinutesString(min: string | undefined): number {
  if (!min) return 0;
  const parts = min.split(':');
  const m = Number(parts[0] ?? 0);
  const s = Number(parts[1] ?? 0);
  if (Number.isFinite(m) && Number.isFinite(s)) return m + s / 60;
  return 0;
}

function fmt(value: number, format: FactorRow['format']): string {
  if (!Number.isFinite(value)) return '—';
  if (format === 'pct') return `${value.toFixed(1)}%`;
  if (format === 'rating') return value.toFixed(1);
  return Math.round(value).toString();
}

function shootingPct(makes: number, attempts: number): number {
  if (!attempts || attempts <= 0) return 0;
  return (makes / attempts) * 100;
}

function efgPct(stats: Record<string, number>): number {
  const fgm = stats.fieldGoalsMade ?? 0;
  const fga = stats.fieldGoalsAttempted ?? 0;
  const tpm = stats.threePointersMade ?? 0;
  if (fga <= 0) return 0;
  return ((fgm + 0.5 * tpm) / fga) * 100;
}

function engineScore(p: Pick<Player, 'ppg' | 'apg' | 'rpg' | 'spg' | 'bpg'>): number {
  return p.ppg + p.apg * 2 + p.rpg * 0.7 + p.spg * 2 + p.bpg * 2;
}

function boxEngineScore(p: BoxScorePlayer): number {
  return p.points + p.assists * 2 + p.rebounds * 0.7 + p.steals * 2 + p.blocks * 2 - p.turnovers * 1.5;
}

function descriptorForPlayer(p: Pick<Player, 'ppg' | 'apg' | 'rpg' | 'spg' | 'bpg' | 'usgRate'>): string {
  if (p.apg >= 6 && p.apg >= p.ppg / 4) return 'Playmaking engine';
  if (p.spg + p.bpg >= 2.2) return 'Defensive disruption engine';
  if (p.usgRate >= 26 || p.ppg >= 22) return 'Scoring engine';
  if (p.ppg >= 16) return 'Primary engine';
  return 'Rotation contributor';
}

function isAvailableRating(value: number | undefined): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value !== 0;
}

function descriptorForBox(p: BoxScorePlayer): string {
  if (p.assists >= 7) return 'Playmaking engine';
  if (p.steals + p.blocks >= 4) return 'Defensive disruption engine';
  if (p.points >= 25) return 'Primary offensive engine';
  if (p.points >= 15) return 'Supporting scorer';
  return 'Role contributor';
}

export default React.memo(function MatchupRealDataTab({
  homeTeam,
  awayTeam,
  homeTeamStats,
  awayTeamStats,
  homeBoxScore,
  awayBoxScore,
  status,
  rawActions,
  gameId,
  runs,
}: MatchupRealDataTabProps) {
  const isPreGame = status === 'scheduled';
  const isLiveOrFinal = status === 'live' || status === 'final';
  const matchupV2SummaryEnabled = useFeatureFlag('matchup_v2_summary_enabled');

  const { teams } = useTeams();
  const { players } = usePlayers();

  const homeTeamMeta: Team | undefined = useMemo(
    () => teams.find(t => t.id === homeTeam.id || t.abbreviation === homeTeam.abbreviation),
    [teams, homeTeam.id, homeTeam.abbreviation],
  );
  const awayTeamMeta: Team | undefined = useMemo(
    () => teams.find(t => t.id === awayTeam.id || t.abbreviation === awayTeam.abbreviation),
    [teams, awayTeam.id, awayTeam.abbreviation],
  );

  if (isPreGame) {
    return (
      <PreGameView
        homeTeam={homeTeam}
        awayTeam={awayTeam}
        homeTeamMeta={homeTeamMeta}
        awayTeamMeta={awayTeamMeta}
        players={players}
      />
    );
  }

  if (isLiveOrFinal) {
    return (
      <GameStoryView
        status={status}
        homeTeam={homeTeam}
        awayTeam={awayTeam}
        homeTeamStats={homeTeamStats}
        awayTeamStats={awayTeamStats}
        homeBoxScore={homeBoxScore}
        awayBoxScore={awayBoxScore}
        rawActions={rawActions}
        gameId={gameId}
        runs={runs}
        matchupV2SummaryEnabled={matchupV2SummaryEnabled}
      />
    );
  }

  return (
    <View>
      <FilmRoomCard />
    </View>
  );
});

function PreGameView({
  homeTeam,
  awayTeam,
  homeTeamMeta,
  awayTeamMeta,
  players,
}: {
  homeTeam: TeamSide;
  awayTeam: TeamSide;
  homeTeamMeta?: Team;
  awayTeamMeta?: Team;
  players: Player[];
}) {
  const hasTeamMeta = !!homeTeamMeta && !!awayTeamMeta;

  const factorRows: FactorRow[] = useMemo(() => {
    if (!homeTeamMeta || !awayTeamMeta) return [];
    const rows: FactorRow[] = [];
    if (isAvailableRating(homeTeamMeta.offRating) && isAvailableRating(awayTeamMeta.offRating)) {
      rows.push({
        label: 'Off Rating',
        unit: 'pts/100',
        homeVal: homeTeamMeta.offRating,
        awayVal: awayTeamMeta.offRating,
        threshold: 1.5,
        format: 'rating',
      });
    }
    if (isAvailableRating(homeTeamMeta.defRating) && isAvailableRating(awayTeamMeta.defRating)) {
      rows.push({
        label: 'Def Rating',
        unit: 'pts/100',
        homeVal: homeTeamMeta.defRating,
        awayVal: awayTeamMeta.defRating,
        threshold: 1.5,
        format: 'rating',
        invert: true,
      });
    }
    if (
      Number.isFinite(homeTeamMeta.netRating) &&
      Number.isFinite(awayTeamMeta.netRating) &&
      (homeTeamMeta.netRating !== 0 || awayTeamMeta.netRating !== 0)
    ) {
      rows.push({
        label: 'Net Rating',
        unit: 'diff',
        homeVal: homeTeamMeta.netRating,
        awayVal: awayTeamMeta.netRating,
        threshold: 1.5,
        format: 'rating',
      });
    }
    if (isAvailableRating(homeTeamMeta.pace) && isAvailableRating(awayTeamMeta.pace)) {
      rows.push({
        label: 'Pace',
        unit: 'poss/g',
        homeVal: homeTeamMeta.pace,
        awayVal: awayTeamMeta.pace,
        threshold: 1.0,
        format: 'rating',
      });
    }
    return rows;
  }, [homeTeamMeta, awayTeamMeta]);

  const keys: DriverNote[] = useMemo(() => {
    if (!homeTeamMeta || !awayTeamMeta) return [];
    const notes: DriverNote[] = [];

    const offAvail = isAvailableRating(homeTeamMeta.offRating) && isAvailableRating(awayTeamMeta.offRating);
    const defAvail = isAvailableRating(homeTeamMeta.defRating) && isAvailableRating(awayTeamMeta.defRating);
    const netAvail = Number.isFinite(homeTeamMeta.netRating) && Number.isFinite(awayTeamMeta.netRating) && (homeTeamMeta.netRating !== 0 || awayTeamMeta.netRating !== 0);
    const paceAvail = isAvailableRating(homeTeamMeta.pace) && isAvailableRating(awayTeamMeta.pace);

    if (offAvail) {
      const offDiff = homeTeamMeta.offRating - awayTeamMeta.offRating;
      if (Math.abs(offDiff) >= 3) {
        const better = offDiff > 0 ? homeTeam.abbreviation : awayTeam.abbreviation;
        const hi = Math.max(homeTeamMeta.offRating, awayTeamMeta.offRating).toFixed(1);
        const lo = Math.min(homeTeamMeta.offRating, awayTeamMeta.offRating).toFixed(1);
        notes.push({
          id: 'off',
          body: `${better}'s offensive edge (${hi} ORtg vs ${lo}) could be the difference.`,
        });
      }
    }

    if (defAvail) {
      const defDiff = homeTeamMeta.defRating - awayTeamMeta.defRating;
      if (Math.abs(defDiff) >= 3) {
        const better = defDiff < 0 ? homeTeam.abbreviation : awayTeam.abbreviation;
        const lo = Math.min(homeTeamMeta.defRating, awayTeamMeta.defRating).toFixed(1);
        const hi = Math.max(homeTeamMeta.defRating, awayTeamMeta.defRating).toFixed(1);
        notes.push({
          id: 'def',
          body: `${better}'s defense (${lo} DRtg vs ${hi}) should set the ceiling for points allowed.`,
        });
      }
    }

    if (paceAvail) {
      const paceDiff = homeTeamMeta.pace - awayTeamMeta.pace;
      if (Math.abs(paceDiff) >= 3) {
        const faster = paceDiff > 0 ? homeTeam.abbreviation : awayTeam.abbreviation;
        notes.push({
          id: 'pace',
          body: `Controlling tempo will matter — ${faster} plays significantly faster.`,
        });
      }
    }

    if (netAvail && notes.length === 0) {
      const netDiff = Math.abs(homeTeamMeta.netRating - awayTeamMeta.netRating);
      if (netDiff < 2) {
        notes.push({
          id: 'even',
          body: 'Teams are evenly matched — execution in late possessions may decide this game.',
        });
      } else {
        const stronger = homeTeamMeta.netRating > awayTeamMeta.netRating ? homeTeam.abbreviation : awayTeam.abbreviation;
        notes.push({
          id: 'net',
          body: `${stronger} carries the stronger season net rating — early-quarter response will be key for the underdog.`,
        });
      }
    }

    return notes.slice(0, 3);
  }, [homeTeamMeta, awayTeamMeta, homeTeam.abbreviation, awayTeam.abbreviation]);

  const homeTopPlayers = useMemo(() => {
    if (!homeTeamMeta) return [] as Player[];
    return [...players]
      .filter(p => p.teamId === homeTeamMeta.id || p.teamAbbr === homeTeamMeta.abbreviation)
      .sort((a, b) => engineScore(b) - engineScore(a))
      .slice(0, 2);
  }, [players, homeTeamMeta]);

  const awayTopPlayers = useMemo(() => {
    if (!awayTeamMeta) return [] as Player[];
    return [...players]
      .filter(p => p.teamId === awayTeamMeta.id || p.teamAbbr === awayTeamMeta.abbreviation)
      .sort((a, b) => engineScore(b) - engineScore(a))
      .slice(0, 2);
  }, [players, awayTeamMeta]);

  const noEngines = homeTopPlayers.length === 0 && awayTopPlayers.length === 0;

  return (
    <View>
      <View style={styles.preGameBanner}>
        <View style={[styles.bannerSide, { alignItems: 'flex-start' }]}>
          <View style={[styles.bannerDot, { backgroundColor: awayTeam.primaryColor }]} />
          <Text style={styles.bannerAbbr}>{awayTeam.abbreviation}</Text>
          {awayTeamMeta && (awayTeamMeta.wins > 0 || awayTeamMeta.losses > 0) && (
            <Text style={styles.bannerRecord}>({awayTeamMeta.wins}-{awayTeamMeta.losses})</Text>
          )}
        </View>
        <View style={styles.bannerCenter}>
          <Text style={styles.bannerEyebrow}>TALE OF THE TAPE</Text>
          <Text style={styles.bannerTitle}>Pre-game preview</Text>
        </View>
        <View style={[styles.bannerSide, { alignItems: 'flex-end' }]}>
          <View style={[styles.bannerDot, { backgroundColor: homeTeam.primaryColor }]} />
          <Text style={styles.bannerAbbr}>{homeTeam.abbreviation}</Text>
          {homeTeamMeta && (homeTeamMeta.wins > 0 || homeTeamMeta.losses > 0) && (
            <Text style={styles.bannerRecord}>({homeTeamMeta.wins}-{homeTeamMeta.losses})</Text>
          )}
        </View>
      </View>

      {!hasTeamMeta && (
        <View style={styles.emptyCard}>
          <Info size={14} color={Colors.textMuted} />
          <Text style={styles.emptyText}>Season averages unavailable for this matchup.</Text>
        </View>
      )}

      {hasTeamMeta && factorRows.length === 0 && keys.length === 0 && (
        <View style={styles.emptyCard}>
          <Info size={14} color={Colors.textMuted} />
          <Text style={styles.emptyText}>Not enough pre-game data available.</Text>
        </View>
      )}

      {factorRows.length > 0 && (
        <>
          <SectionHeader icon={<Target size={12} color={Colors.textMuted} />} label="FOUR FACTORS · PROJECTED" />
          <FactorTable rows={factorRows} away={awayTeam} home={homeTeam} />
        </>
      )}

      {keys.length > 0 && (
        <>
          <SectionHeader icon={<Flame size={12} color={Colors.warning} />} label="KEYS TO THE GAME" />
          <View style={styles.notesCard}>
            {keys.map((n, i) => (
              <View key={n.id} style={[styles.noteRow, i > 0 && styles.noteRowBorder]}>
                <View style={styles.noteBullet} />
                <Text style={styles.noteText}>{n.body}</Text>
              </View>
            ))}
          </View>
        </>
      )}

      {!noEngines && (
        <>
          <SectionHeader icon={<Zap size={12} color={Colors.accent} />} label="PLAYER ENGINES" />
          <View style={styles.engineGrid}>
            {[...awayTopPlayers.map(p => ({ p, side: 'away' as const })), ...homeTopPlayers.map(p => ({ p, side: 'home' as const }))].map(({ p, side }) => (
              <PreGamePlayerCard
                key={`${side}-${p.id}`}
                player={p}
                color={side === 'home' ? homeTeam.primaryColor : awayTeam.primaryColor}
                teamAbbr={side === 'home' ? homeTeam.abbreviation : awayTeam.abbreviation}
              />
            ))}
          </View>
        </>
      )}

      <FilmRoomCard />
    </View>
  );
}

function GameStoryView({
  status,
  homeTeam,
  awayTeam,
  homeTeamStats,
  awayTeamStats,
  homeBoxScore,
  awayBoxScore,
  rawActions,
  gameId,
  runs,
  matchupV2SummaryEnabled,
}: {
  status: GameStatus;
  homeTeam: TeamSide;
  awayTeam: TeamSide;
  homeTeamStats: Record<string, number>;
  awayTeamStats: Record<string, number>;
  homeBoxScore: BoxScorePlayer[];
  awayBoxScore: BoxScorePlayer[];
  rawActions?: CdnPbpAction[];
  gameId?: string;
  runs?: ScoringRun[];
  matchupV2SummaryEnabled: boolean;
}) {
  const summaryQuery = useGameMatchupSummaryV2({
    gameId: gameId ?? '',
    enabled: matchupV2SummaryEnabled && !!gameId,
    status,
  });
  const matchupV2Availability = useMemo(() => resolveMatchupSummaryV2Availability({
    featureEnabled: matchupV2SummaryEnabled,
    gameId: gameId ?? '',
    isPending: summaryQuery.isPending,
    isFetching: summaryQuery.isFetching,
    isError: summaryQuery.isError,
    data: summaryQuery.data,
    error: summaryQuery.error,
  }), [
    gameId,
    matchupV2SummaryEnabled,
    summaryQuery.data,
    summaryQuery.error,
    summaryQuery.isError,
    summaryQuery.isFetching,
    summaryQuery.isPending,
  ]);
  const isV2LayoutActive = matchupV2Availability.state !== 'disabled';
  const hasValidatedV2Summary = matchupV2Availability.state === 'ready'
    || matchupV2Availability.state === 'empty';
  const summary = hasValidatedV2Summary ? matchupV2Availability.summary : undefined;
  const [filmRoomSource, setFilmRoomSource] = useState<FilmRoomSelectionSource>('default');
  const [activeKeyMatchupPair, setActiveKeyMatchupPair] = useState<{
    offensePlayerId: string;
    defensePlayerId: string;
  } | null>(null);
  const [filmRoomSelectionRequest, setFilmRoomSelectionRequest] = useState<FilmRoomPairSelectionRequest | undefined>(undefined);
  const selectionRequestIdRef = React.useRef<number>(0);

  React.useEffect(() => {
    setFilmRoomSource('default');
    setActiveKeyMatchupPair(null);
    setFilmRoomSelectionRequest(undefined);
  }, [gameId, matchupV2SummaryEnabled]);

  React.useEffect(() => {
    if (!__DEV__) return;
    const error = 'error' in matchupV2Availability ? matchupV2Availability.error : null;
    console.log('[MatchupSummaryV2] availability resolved', {
      gameId: gameId ?? null,
      queryKey: gameMatchupSummaryV2QueryKey(gameId ?? ''),
      state: matchupV2Availability.state,
      failureCategory: error?.category ?? null,
      httpStatus: error?.httpStatus ?? null,
      sourceStatus: error?.sourceStatus ?? null,
      errorCategory: error?.errorCategory ?? null,
      contractRelease: error?.contractRelease ?? summary?.contractRelease ?? null,
      schemaVersion: error?.schemaVersion ?? summary?.schemaVersion ?? null,
      validationPath: error?.validationPath ?? null,
      validationReason: error?.validationReason ?? null,
      failureCount: summaryQuery.failureCount,
      retainedValidatedData: (matchupV2Availability.state === 'ready'
        || matchupV2Availability.state === 'empty')
        && matchupV2Availability.isRetainingCachedDataAfterError,
    });
  }, [gameId, matchupV2Availability, summary, summaryQuery.failureCount]);

  const handleLoadKeyMatchup = useCallback((selection: MatchupV2PairSelection) => {
    selectionRequestIdRef.current += 1;
    setFilmRoomSource('keyMatchup');
    setActiveKeyMatchupPair({
      offensePlayerId: selection.offensePlayerId,
      defensePlayerId: selection.defensePlayerId,
    });
    setFilmRoomSelectionRequest({ ...selection, requestId: selectionRequestIdRef.current });
    if (__DEV__) {
      console.log('[MatchupSummaryV2] pair loaded into Film Room', {
        gameId: gameId ?? null,
        offensePlayerId: selection.offensePlayerId,
        defensePlayerId: selection.defensePlayerId,
      });
    }
  }, [gameId]);

  const handleFilmRoomSourceChange = useCallback((source: FilmRoomSelectionSource) => {
    setFilmRoomSource(source);
    if (source !== 'keyMatchup') setActiveKeyMatchupPair(null);
    if (__DEV__) {
      console.log('[MatchupFilmRoom] source transition', { gameId: gameId ?? null, source });
    }
  }, [gameId]);

  const handleExternalSelectionResolved = useCallback((wasRepresented: boolean) => {
    if (wasRepresented) return;
    setFilmRoomSource('default');
    setActiveKeyMatchupPair(null);
  }, []);

  const hasTeamStats = Object.keys(homeTeamStats).length > 1 && Object.keys(awayTeamStats).length > 1;
  const hasBoxScores = homeBoxScore.length > 0 && awayBoxScore.length > 0;

  const factorRows: FactorRow[] = useMemo(() => {
    if (!hasTeamStats) return [];
    const homeEfg = efgPct(homeTeamStats);
    const awayEfg = efgPct(awayTeamStats);
    return [
      {
        label: 'eFG%',
        unit: 'shooting',
        homeVal: homeEfg,
        awayVal: awayEfg,
        threshold: 2,
        format: 'pct',
      },
      {
        label: 'TOV',
        unit: 'turnovers',
        homeVal: homeTeamStats.turnovers ?? 0,
        awayVal: awayTeamStats.turnovers ?? 0,
        threshold: 2,
        format: 'number',
        invert: true,
      },
      {
        label: 'OREB',
        unit: '2nd-chance',
        homeVal: homeTeamStats.reboundsOffensive ?? 0,
        awayVal: awayTeamStats.reboundsOffensive ?? 0,
        threshold: 1.5,
        format: 'number',
      },
      {
        label: 'FTA',
        unit: 'FT pressure',
        homeVal: homeTeamStats.freeThrowsAttempted ?? 0,
        awayVal: awayTeamStats.freeThrowsAttempted ?? 0,
        threshold: 3,
        format: 'number',
      },
    ];
  }, [hasTeamStats, homeTeamStats, awayTeamStats]);

  const drivers: DriverNote[] = useMemo(() => {
    if (!hasTeamStats) return [];
    return buildMatchupGameDrivers({
      homeTeam,
      awayTeam,
      homeTeamStats,
      awayTeamStats,
      runs,
    });
  }, [hasTeamStats, homeTeamStats, awayTeamStats, homeTeam, awayTeam, runs]);

  const homeEngines = useMemo(() => {
    return [...homeBoxScore]
      .filter(p => parseMinutesString(p.minutes) > 0 || p.points > 0)
      .sort((a, b) => boxEngineScore(b) - boxEngineScore(a))
      .slice(0, 2);
  }, [homeBoxScore]);

  const awayEngines = useMemo(() => {
    return [...awayBoxScore]
      .filter(p => parseMinutesString(p.minutes) > 0 || p.points > 0)
      .sort((a, b) => boxEngineScore(b) - boxEngineScore(a))
      .slice(0, 2);
  }, [awayBoxScore]);

  if (!hasTeamStats && !hasBoxScores && !isV2LayoutActive) {
    return (
      <View>
        <View style={styles.emptyCard}>
          <Info size={14} color={Colors.textMuted} />
          <Text style={styles.emptyText}>Not enough matchup data available yet.</Text>
        </View>
        <FilmRoomCard />
      </View>
    );
  }

  return (
    <View>
      {factorRows.length > 0 && (
        <>
          <SectionHeader
            icon={<Target size={12} color={Colors.textMuted} />}
            label={status === 'live' ? 'GAME FACTORS · LIVE' : 'GAME FACTORS · FINAL'}
          />
          <FactorTable rows={factorRows} away={awayTeam} home={homeTeam} />
        </>
      )}

      {matchupV2Availability.state === 'disabled' ? (
        <>
          {drivers.length > 0 && (
            <>
              <SectionHeader icon={<Activity size={12} color={Colors.warning} />} label="GAME DRIVERS" />
              <View style={styles.notesCard}>
                {drivers.map((n, i) => (
                  <View key={n.id} style={[styles.noteRow, i > 0 && styles.noteRowBorder]}>
                    <View style={styles.noteBullet} />
                    <Text style={styles.noteText}>{n.body}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {(homeEngines.length > 0 || awayEngines.length > 0) && (
            <>
              <SectionHeader icon={<Zap size={12} color={Colors.accent} />} label="PLAYER ENGINES" />
              <View style={styles.engineGrid}>
                {[...awayEngines.map(p => ({ p, side: 'away' as const })), ...homeEngines.map(p => ({ p, side: 'home' as const }))].map(({ p, side }) => (
                  <BoxEngineCard
                    key={`${side}-${p.playerId}`}
                    player={p}
                    color={side === 'home' ? homeTeam.primaryColor : awayTeam.primaryColor}
                    teamAbbr={side === 'home' ? homeTeam.abbreviation : awayTeam.abbreviation}
                  />
                ))}
              </View>
            </>
          )}
        </>
      ) : matchupV2Availability.state === 'loading' ? (
        <MatchupV2KeyMatchups
          keyMatchups={[]}
          homeTeam={homeTeam}
          awayTeam={awayTeam}
          isLoading
          activePair={null}
          onLoadPair={handleLoadKeyMatchup}
        />
      ) : matchupV2Availability.state === 'ready' || matchupV2Availability.state === 'empty' ? (
        <>
          <MatchupV2KeyMatchups
            keyMatchups={matchupV2Availability.summary.keyMatchups}
            homeTeam={homeTeam}
            awayTeam={awayTeam}
            isLoading={false}
            activePair={filmRoomSource === 'keyMatchup' ? activeKeyMatchupPair : null}
            onLoadPair={handleLoadKeyMatchup}
          />
          <MatchupV2WhoGuarded
            key={gameId ?? 'missing-game'}
            gameId={gameId ?? ''}
            status={status}
            summary={matchupV2Availability.summary}
          />
        </>
      ) : (
        <MatchupV2AvailabilityState
          state={matchupV2Availability.state}
          onRetry={matchupV2Availability.state === 'transientError'
            ? () => { void summaryQuery.refetch(); }
            : undefined}
        />
      )}

      <MatchupFilmRoom
        rawActions={rawActions}
        homeTeam={homeTeam}
        awayTeam={awayTeam}
        homeBoxScore={homeBoxScore}
        awayBoxScore={awayBoxScore}
        gameId={gameId}
        selectionRequest={hasValidatedV2Summary ? filmRoomSelectionRequest : undefined}
        selectionSource={hasValidatedV2Summary ? filmRoomSource : 'default'}
        onSelectionSourceChange={handleFilmRoomSourceChange}
        onExternalSelectionResolved={handleExternalSelectionResolved}
      />
    </View>
  );
}

function MatchupV2AvailabilityState({
  state,
  onRetry,
}: {
  state: 'transientError' | 'unsupported' | 'contractError';
  onRetry?: () => void;
}) {
  const message = state === 'unsupported'
    ? 'Detailed matchup tracking is unavailable for this game.'
    : state === 'contractError'
      ? 'Matchup 2.0 data could not be verified.'
      : 'Detailed matchup tracking is temporarily unavailable.';
  return (
    <View testID={`matchup-v2-${state}`}>
      <SectionHeader icon={<Info size={12} color={Colors.secondary} />} label="KEY MATCHUPS" />
      <View style={styles.matchupV2StateCard}>
        <Info size={15} color={Colors.textMuted} />
        <View style={styles.matchupV2StateCopy}>
          <Text style={styles.matchupV2StateTitle}>Matchup 2.0</Text>
          <Text style={styles.emptyText}>{message}</Text>
        </View>
        {onRetry ? (
          <TouchableOpacity
            onPress={onRetry}
            style={styles.matchupV2RetryButton}
            activeOpacity={0.72}
            accessibilityRole="button"
            accessibilityLabel="Retry Matchup 2.0"
            testID="matchup-v2-retry"
          >
            <RotateCcw size={13} color={Colors.secondary} />
            <Text style={styles.matchupV2RetryText}>Retry</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

function SectionHeader({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <View style={styles.sectionHeader}>
      {icon}
      <Text style={styles.sectionLabel}>{label}</Text>
    </View>
  );
}

function FactorTable({ rows, home, away }: { rows: FactorRow[]; home: TeamSide; away: TeamSide }) {
  return (
    <View style={styles.comparisonCard}>
      <View style={styles.compHeader}>
        <View style={styles.compHeaderSide}>
          <View style={[styles.compHeaderDot, { backgroundColor: away.primaryColor }]} />
          <Text style={styles.compHeaderAbbr}>{away.abbreviation}</Text>
        </View>
        <View style={[styles.compHeaderSide, { justifyContent: 'flex-end' }]}>
          <Text style={styles.compHeaderAbbr}>{home.abbreviation}</Text>
          <View style={[styles.compHeaderDot, { backgroundColor: home.primaryColor }]} />
        </View>
      </View>
      <View style={styles.compDivider} />
      {rows.map(row => {
        const edge = classifyEdge(row.homeVal, row.awayVal, row.threshold, row.invert);
        const homeColor = edge === 'home' ? Colors.positive : edge === 'away' ? Colors.negative : Colors.textSecondary;
        const awayColor = edge === 'away' ? Colors.positive : edge === 'home' ? Colors.negative : Colors.textSecondary;
        return (
          <View key={row.label} style={styles.compRow}>
            <Text style={[styles.compValue, { color: awayColor, textAlign: 'left' }]}>{fmt(row.awayVal, row.format)}</Text>
            <View style={styles.compLabelWrap}>
              <Text style={styles.compLabel}>{row.label}</Text>
              {row.unit ? <Text style={styles.compUnit}>{row.unit}</Text> : null}
            </View>
            <Text style={[styles.compValue, { color: homeColor, textAlign: 'right' }]}>{fmt(row.homeVal, row.format)}</Text>
          </View>
        );
      })}
    </View>
  );
}

function PreGamePlayerCard({ player, color, teamAbbr }: { player: Player; color: string; teamAbbr: string }) {
  const desc = descriptorForPlayer(player);
  return (
    <View style={[styles.engineCard, { borderLeftColor: color }]}>
      <View style={styles.engineHeader}>
        <View style={[styles.engineTeamPill, { backgroundColor: `${color}26` }]}>
          <Text style={[styles.engineTeamPillText, { color }]}>{teamAbbr}</Text>
        </View>
        <Text style={styles.engineDescriptor}>{desc}</Text>
      </View>
      <Text style={styles.engineName} numberOfLines={1}>{player.name}</Text>
      <View style={styles.engineStatsRow}>
        <EngineStat label="PTS" value={player.ppg.toFixed(1)} />
        <EngineStat label="AST" value={player.apg.toFixed(1)} />
        <EngineStat label="REB" value={player.rpg.toFixed(1)} />
        <EngineStat label="STL" value={player.spg.toFixed(1)} />
        <EngineStat label="BLK" value={player.bpg.toFixed(1)} />
      </View>
    </View>
  );
}

function BoxEngineCard({ player, color, teamAbbr }: { player: BoxScorePlayer; color: string; teamAbbr: string }) {
  const desc = descriptorForBox(player);
  const fgPct = shootingPct(player.fgm, player.fga);
  return (
    <View style={[styles.engineCard, { borderLeftColor: color }]}>
      <View style={styles.engineHeader}>
        <View style={[styles.engineTeamPill, { backgroundColor: `${color}26` }]}>
          <Text style={[styles.engineTeamPillText, { color }]}>{teamAbbr}</Text>
        </View>
        <Text style={styles.engineDescriptor}>{desc}</Text>
      </View>
      <Text style={styles.engineName} numberOfLines={1}>{player.name}</Text>
      <View style={styles.engineStatsRow}>
        <EngineStat label="PTS" value={player.points.toString()} />
        <EngineStat label="AST" value={player.assists.toString()} subValue={player.assists > 0 ? `+${player.assists * 2}` : undefined} subLabel="pts" />
        <EngineStat label="REB" value={player.rebounds.toString()} />
        <EngineStat label="FG%" value={player.fga > 0 ? `${fgPct.toFixed(0)}%` : '—'} />
        <EngineStat label="+/-" value={player.plusMinus > 0 ? `+${player.plusMinus}` : `${player.plusMinus}`} />
      </View>
      {buildBoxEngineContext(player) ? (
        <Text style={styles.engineFootnote}>{buildBoxEngineContext(player)}</Text>
      ) : null}
    </View>
  );
}

function buildBoxEngineContext(player: BoxScorePlayer): string {
  const tags: string[] = [];
  if (player.pointsInThePaint !== undefined && player.pointsInThePaint >= 10) tags.push(`${player.pointsInThePaint} paint pts`);
  if (player.pointsFastBreak !== undefined && player.pointsFastBreak >= 6) tags.push(`${player.pointsFastBreak} fast break pts`);
  if (player.pointsSecondChance !== undefined && player.pointsSecondChance >= 6) tags.push(`${player.pointsSecondChance} 2nd chance pts`);
  if (player.personalFoulsDrawn !== undefined && player.personalFoulsDrawn >= 5) tags.push(`${player.personalFoulsDrawn} fouls drawn`);
  if (player.blockedAttempts !== undefined && player.blockedAttempts >= 3) tags.push(`${player.blockedAttempts} attempts blocked`);
  if (tags.length === 0) {
    if (player.steals > 0) tags.push(`${player.steals} STL`);
    if (player.blocks > 0) tags.push(`${player.blocks} BLK`);
  }
  return tags.slice(0, 2).join(' · ');
}

function EngineStat({ label, value, subValue, subLabel }: { label: string; value: string; subValue?: string; subLabel?: string }) {
  return (
    <View style={styles.engineStat}>
      <Text style={styles.engineStatValue}>{value}</Text>
      <Text style={styles.engineStatLabel}>{label}</Text>
      {subValue ? <Text style={styles.engineStatSub}>{subValue} {subLabel}</Text> : null}
    </View>
  );
}

interface FilmPlayerOption {
  playerId: string;
  name: string;
  teamId: string;
  teamAbbr: string;
  teamColor: string;
  totalFga: number;
  totalPoints: number;
}

interface FilmDefenderOption extends FilmPlayerOption {
  matchupRow?: GameMatchupRow;
}

function teamMetaForId(
  teamId: string,
  homeTeam: TeamSide,
  awayTeam: TeamSide,
): { abbreviation: string; primaryColor: string } {
  if (teamId === homeTeam.id) return { abbreviation: homeTeam.abbreviation, primaryColor: homeTeam.primaryColor };
  if (teamId === awayTeam.id) return { abbreviation: awayTeam.abbreviation, primaryColor: awayTeam.primaryColor };
  return { abbreviation: '', primaryColor: Colors.textMuted };
}

function MatchupFilmRoom({
  homeTeam,
  awayTeam,
  homeBoxScore,
  awayBoxScore,
  gameId,
  selectionRequest,
  selectionSource,
  onSelectionSourceChange,
  onExternalSelectionResolved,
}: {
  rawActions?: CdnPbpAction[];
  homeTeam: TeamSide;
  awayTeam: TeamSide;
  homeBoxScore: BoxScorePlayer[];
  awayBoxScore: BoxScorePlayer[];
  gameId?: string;
  selectionRequest?: FilmRoomPairSelectionRequest;
  selectionSource: FilmRoomSelectionSource;
  onSelectionSourceChange: (source: FilmRoomSelectionSource) => void;
  onExternalSelectionResolved: (wasRepresented: boolean) => void;
}) {
  const { matchups, isLoading } = useGameMatchups(gameId ?? '', !!gameId);

  const verifiedOffensiveOptions = useMemo<FilmPlayerOption[]>(() => {
    const map = new Map<string, FilmPlayerOption>();
    for (const row of matchups) {
      const meta = teamMetaForId(row.offensiveTeamId, homeTeam, awayTeam);
      const existing = map.get(row.offensivePlayerId);
      if (existing) {
        existing.totalFga += row.fga;
        existing.totalPoints += row.points;
      } else {
        map.set(row.offensivePlayerId, {
          playerId: row.offensivePlayerId,
          name: row.offensivePlayerName,
          teamId: row.offensiveTeamId,
          teamAbbr: meta.abbreviation,
          teamColor: meta.primaryColor,
          totalFga: row.fga,
          totalPoints: row.points,
        });
      }
    }
    return [...map.values()].sort(
      (a, b) => b.totalFga - a.totalFga || b.totalPoints - a.totalPoints,
    );
  }, [matchups, homeTeam, awayTeam]);

  const verified = verifiedOffensiveOptions.length > 0;

  const [offensiveTeamId, setOffensiveTeamId] = useState<string>(homeTeam.id);
  const defensiveTeamId = offensiveTeamId === homeTeam.id ? awayTeam.id : homeTeam.id;

  const fallbackOffensiveOptions = useMemo<FilmPlayerOption[]>(() => {
    const isHomeOffense = offensiveTeamId === homeTeam.id;
    const offRoster = isHomeOffense ? homeBoxScore : awayBoxScore;
    const offMeta = teamMetaForId(offensiveTeamId, homeTeam, awayTeam);
    const result = offRoster
      .filter(p => p.playerId && p.playerId !== '0')
      .map<FilmPlayerOption>(p => ({
        playerId: p.playerId,
        name: p.name,
        teamId: offensiveTeamId,
        teamAbbr: offMeta.abbreviation,
        teamColor: offMeta.primaryColor,
        totalFga: p.fga,
        totalPoints: p.points,
      }))
      .sort((a, b) => b.totalFga - a.totalFga || b.totalPoints - a.totalPoints);
    console.log(
      `[MatchupFilmRoom][fallback] offense team=${offensiveTeamId} (${offMeta.abbreviation}) players=${result.length}`,
    );
    return result;
  }, [offensiveTeamId, homeTeam, awayTeam, homeBoxScore, awayBoxScore]);

  const offensiveOptions = useMemo<FilmPlayerOption[]>(() => {
    if (verified) return verifiedOffensiveOptions;
    return fallbackOffensiveOptions.filter(p => p.teamId === offensiveTeamId);
  }, [verified, verifiedOffensiveOptions, fallbackOffensiveOptions, offensiveTeamId]);

  const [offensiveId, setOffensiveId] = useState<string | undefined>(undefined);
  const [defensiveId, setDefensiveId] = useState<string | undefined>(undefined);
  const [pickerOpen, setPickerOpen] = useState<null | 'offense' | 'defense'>(null);
  const pendingExternalSelectionRef = React.useRef<FilmRoomPairSelectionRequest | null>(null);
  const lastHandledSelectionRequestIdRef = React.useRef<number>(0);

  React.useEffect(() => {
    if (!selectionRequest || selectionRequest.requestId === lastHandledSelectionRequestIdRef.current) return;
    lastHandledSelectionRequestIdRef.current = selectionRequest.requestId;
    pendingExternalSelectionRef.current = selectionRequest;
    setOffensiveTeamId(selectionRequest.offenseTeamId);
    setOffensiveId(selectionRequest.offensePlayerId);
    setDefensiveId((current: string | undefined) => (
      current === selectionRequest.defensePlayerId ? current : undefined
    ));
    setPickerOpen(null);
  }, [selectionRequest]);

  React.useEffect(() => {
    if (pendingExternalSelectionRef.current) return;
    if (!offensiveId && offensiveOptions[0]) {
      setOffensiveId(offensiveOptions[0].playerId);
      return;
    }
    if (offensiveId && !offensiveOptions.some(p => p.playerId === offensiveId)) {
      setOffensiveId(offensiveOptions[0]?.playerId);
    }
  }, [offensiveOptions, offensiveId]);

  const defensiveOptions = useMemo<FilmDefenderOption[]>(() => {
    if (!offensiveId) return [];
    if (verified) {
      return matchups
        .filter(r => r.offensivePlayerId === offensiveId)
        .map<FilmDefenderOption>(row => {
          const meta = teamMetaForId(row.defensiveTeamId, homeTeam, awayTeam);
          return {
            playerId: row.defensivePlayerId,
            name: row.defensivePlayerName,
            teamId: row.defensiveTeamId,
            teamAbbr: meta.abbreviation,
            teamColor: meta.primaryColor,
            totalFga: row.fga,
            totalPoints: row.points,
            matchupRow: row,
          };
        })
        .sort((a, b) => b.totalFga - a.totalFga || b.totalPoints - a.totalPoints);
    }
    const isHomeDefense = defensiveTeamId === homeTeam.id;
    const defenderRoster = isHomeDefense ? homeBoxScore : awayBoxScore;
    const defenderTeamMeta = teamMetaForId(defensiveTeamId, homeTeam, awayTeam);
    type WithSort = FilmDefenderOption & { _minutesSec: number; _fga: number };
    const enriched: WithSort[] = defenderRoster
      .filter(p => p.playerId && p.playerId !== '0')
      .map(p => ({
        playerId: p.playerId,
        name: p.name,
        teamId: defensiveTeamId,
        teamAbbr: defenderTeamMeta.abbreviation,
        teamColor: defenderTeamMeta.primaryColor,
        totalFga: 0,
        totalPoints: 0,
        _minutesSec: parseMinutesToSeconds(p.minutes),
        _fga: p.fga,
      }));
    enriched.sort((a, b) => {
      if (b._minutesSec !== a._minutesSec) return b._minutesSec - a._minutesSec;
      if (b._fga !== a._fga) return b._fga - a._fga;
      return a.name.localeCompare(b.name);
    });
    const filtered = enriched.filter(d => d.teamId === defensiveTeamId);
    console.log(
      `[MatchupFilmRoom][fallback] defense team=${defensiveTeamId} (${defenderTeamMeta.abbreviation}) players=${filtered.length}`,
    );
    return filtered;
  }, [matchups, offensiveId, homeTeam, awayTeam, verified, defensiveTeamId, homeBoxScore, awayBoxScore]);

  React.useEffect(() => {
    const pending = pendingExternalSelectionRef.current;
    if (!pending || offensiveId !== pending.offensePlayerId) return;

    const canRepresentOffense = offensiveOptions.some(option => option.playerId === pending.offensePlayerId);
    if (!canRepresentOffense) {
      if (isLoading) return;
      pendingExternalSelectionRef.current = null;
      onExternalSelectionResolved(false);
      return;
    }

    const canRepresentDefense = defensiveOptions.some(option => option.playerId === pending.defensePlayerId);
    if (!canRepresentDefense) {
      if (isLoading) return;
      pendingExternalSelectionRef.current = null;
      onExternalSelectionResolved(false);
      return;
    }

    if (defensiveId !== pending.defensePlayerId) {
      setDefensiveId(pending.defensePlayerId);
      return;
    }

    pendingExternalSelectionRef.current = null;
    onExternalSelectionResolved(true);
  }, [defensiveId, defensiveOptions, isLoading, offensiveId, offensiveOptions, onExternalSelectionResolved]);

  React.useEffect(() => {
    if (pendingExternalSelectionRef.current) return;
    if (defensiveOptions.length === 0) {
      if (defensiveId !== undefined) setDefensiveId(undefined);
      return;
    }
    const stillValid = defensiveOptions.some(d => d.playerId === defensiveId);
    if (!stillValid) {
      setDefensiveId(defensiveOptions[0].playerId);
    }
  }, [defensiveOptions, defensiveId]);

  React.useEffect(() => {
    if (selectionSource !== 'keyMatchup' || !selectionRequest || pendingExternalSelectionRef.current || isLoading) return;
    const stillRepresented = offensiveOptions.some(option => option.playerId === selectionRequest.offensePlayerId)
      && defensiveOptions.some(option => option.playerId === selectionRequest.defensePlayerId)
      && offensiveId === selectionRequest.offensePlayerId
      && defensiveId === selectionRequest.defensePlayerId;
    if (!stillRepresented) onExternalSelectionResolved(false);
  }, [
    defensiveId,
    defensiveOptions,
    isLoading,
    offensiveId,
    offensiveOptions,
    onExternalSelectionResolved,
    selectionRequest,
    selectionSource,
  ]);

  const offensivePlayer = useMemo(
    () => offensiveOptions.find(p => p.playerId === offensiveId),
    [offensiveOptions, offensiveId],
  );
  const defensivePlayer = useMemo(
    () => defensiveOptions.find(p => p.playerId === defensiveId),
    [defensiveOptions, defensiveId],
  );

  const onSwap = useCallback(() => {
    pendingExternalSelectionRef.current = null;
    onSelectionSourceChange('custom');
    if (verified) {
      if (!defensivePlayer) return;
      const newOffensiveId = defensivePlayer.playerId;
      const newDefensiveCandidate = offensivePlayer?.playerId;
      setOffensiveId(newOffensiveId);
      setDefensiveId(newDefensiveCandidate);
      return;
    }
    setOffensiveTeamId(prev => (prev === homeTeam.id ? awayTeam.id : homeTeam.id));
    setOffensiveId(undefined);
    setDefensiveId(undefined);
  }, [verified, defensivePlayer, offensivePlayer, homeTeam.id, awayTeam.id, onSelectionSourceChange]);

  const onSelectOffense = useCallback((id: string) => {
    pendingExternalSelectionRef.current = null;
    onSelectionSourceChange('custom');
    setOffensiveId(id);
    setDefensiveId(undefined);
    setPickerOpen(null);
  }, [onSelectionSourceChange]);
  const onSelectDefense = useCallback((id: string) => {
    pendingExternalSelectionRef.current = null;
    onSelectionSourceChange('custom');
    setDefensiveId(id);
    setPickerOpen(null);
  }, [onSelectionSourceChange]);

  const season = gameId ? getSeasonFromGameId(gameId) : undefined;
  const seasonType = gameId ? getSeasonTypeFromGameId(gameId) : undefined;

  const canOpen =
    !!gameId
    && !!offensivePlayer
    && !!defensivePlayer
    && !!defensivePlayer.teamId
    && (verified ? !!defensivePlayer.matchupRow : true);

  const onOpen = useCallback(async () => {
    if (!canOpen || !gameId || !offensivePlayer || !defensivePlayer) return;
    const url = buildNbaMatchupFilmUrl({
      gameId,
      offensivePlayerId: offensivePlayer.playerId,
      defensivePlayerId: defensivePlayer.playerId,
      defensiveTeamId: defensivePlayer.teamId,
      season,
      seasonType,
    });
    if (__DEV__) {
      console.log('[MatchupFilmRoom] URL inputs', {
        gameId,
        offensivePlayerName: offensivePlayer.name,
        offensivePlayerId: offensivePlayer.playerId,
        defensivePlayerName: defensivePlayer.name,
        defensivePlayerId: defensivePlayer.playerId,
        defensiveTeamId: defensivePlayer.teamId,
        season,
        seasonType,
        url,
      });
    }
    try {
      console.log('[MatchupFilmRoom] Opening', url);
      await WebBrowser.openBrowserAsync(url);
    } catch (err) {
      console.warn('[MatchupFilmRoom] Failed to open URL', err);
    }
  }, [canOpen, gameId, offensivePlayer, defensivePlayer, season, seasonType]);

  if (!gameId) return null;

  if (!isLoading && offensiveOptions.length === 0) {
    return (
      <>
        <SectionHeader icon={<Film size={12} color={Colors.accent} />} label="MATCHUP FILM ROOM" />
        <View style={styles.filmEmpty} testID="matchup-film-room-empty">
          <Film size={14} color={Colors.textMuted} />
          <View style={{ flex: 1 }}>
            <Text style={styles.emptyText}>Matchup table unavailable for this game.</Text>
            <Text style={styles.filmEmptyHint}>Shot film is still available from the Shots tab.</Text>
          </View>
        </View>
      </>
    );
  }

  const summaryLine = verified && defensivePlayer?.matchupRow
    ? buildMatchupSummary(defensivePlayer.matchupRow)
    : '';

  return (
    <>
      <SectionHeader icon={<Film size={12} color={Colors.accent} />} label="MATCHUP FILM ROOM" />
      <View style={styles.filmSelectorCard} testID="matchup-film-room">
        {selectionSource !== 'default' ? (
          <View style={styles.filmSourceBadge}>
            <Text style={styles.filmSourceBadgeText}>
              {selectionSource === 'keyMatchup' ? 'KEY MATCHUP' : 'CUSTOM MATCHUP'}
            </Text>
          </View>
        ) : null}
        <Text style={styles.filmSelectorSubtitle}>
          {verified
            ? 'Pick a real defender that guarded the offensive player to open NBA matchup film.'
            : 'Verified matchup data unavailable — opening NBA film by selected players.'}
        </Text>

        <PlayerSelectorRow
          label="OFFENSE"
          player={offensivePlayer}
          placeholder={isLoading ? 'Loading matchups…' : 'Choose offensive player'}
          onPress={() => offensiveOptions.length > 0 && setPickerOpen('offense')}
          testID="film-offense-selector"
        />

        <View style={styles.swapRow}>
          <View style={styles.swapDivider} />
          <TouchableOpacity
            onPress={onSwap}
            disabled={!defensivePlayer}
            style={[styles.swapBtn, !defensivePlayer && { opacity: 0.5 }]}
            testID="film-swap-btn"
            activeOpacity={0.7}
          >
            <ArrowLeftRight size={12} color={Colors.textSecondary} />
            <Text style={styles.swapBtnText}>SWAP SIDES</Text>
          </TouchableOpacity>
          <View style={styles.swapDivider} />
        </View>

        <PlayerSelectorRow
          label="DEFENSE"
          player={defensivePlayer}
          placeholder={offensivePlayer ? 'Choose defender' : 'Pick offense first'}
          onPress={() => defensiveOptions.length > 0 && setPickerOpen('defense')}
          testID="film-defense-selector"
          subtitle={defensivePlayer ? buildDefenderSubtitle(defensivePlayer) : undefined}
        />

        {summaryLine ? (
          <Text style={styles.filmSummaryLine}>{summaryLine}</Text>
        ) : null}

        <TouchableOpacity
          onPress={onOpen}
          disabled={!canOpen}
          style={[styles.filmCTA, !canOpen && styles.filmCTADisabled]}
          testID="film-watch-cta"
          activeOpacity={0.85}
        >
          <Film size={14} color={canOpen ? Colors.accent : Colors.textMuted} />
          <Text style={[styles.filmCTAText, !canOpen && styles.filmCTATextDisabled]}>
            Watch Matchup Film
          </Text>
        </TouchableOpacity>
      </View>

      <OffensivePickerModal
        visible={pickerOpen === 'offense'}
        roster={offensiveOptions}
        selectedId={offensiveId}
        onSelect={onSelectOffense}
        onClose={() => setPickerOpen(null)}
      />
      <DefenderPickerModal
        visible={pickerOpen === 'defense'}
        roster={defensiveOptions}
        selectedId={defensiveId}
        onSelect={onSelectDefense}
        onClose={() => setPickerOpen(null)}
      />
    </>
  );
  // TODO(M2C): true Player A vs Player B detailed breakdown beyond row stats
  // TODO(M2C): in-app clip playback integration
  // TODO(M2C): hustle stats are intentionally not surfaced per-matchup unless
  //            an endpoint exposes them as matchup-specific.
}

function buildDefenderSubtitle(d: FilmDefenderOption): string {
  const row = d.matchupRow;
  const parts: string[] = [];
  if (d.teamAbbr) parts.push(d.teamAbbr);
  if (!row) return parts.join(' · ');
  if (row.fga > 0) {
    parts.push(`${row.fgm}/${row.fga} FG allowed`);
    if (row.points > 0) parts.push(`${row.points} PTS allowed`);
  } else if (row.points > 0) {
    parts.push(`${row.points} PTS allowed`);
  } else if (row.partialPossessions != null && row.partialPossessions > 0) {
    parts.push(`${row.partialPossessions.toFixed(1)} poss`);
  }
  return parts.join(' · ');
}

function buildMatchupSummary(row: GameMatchupRow): string {
  const parts: string[] = [];
  if (row.fga > 0) parts.push(`${row.fgm}/${row.fga} FG`);
  if (row.fg3a != null && row.fg3a > 0) parts.push(`${row.fg3m ?? 0}/${row.fg3a} 3PT`);
  if (row.points > 0) parts.push(`${row.points} PTS`);
  if (row.assists != null && row.assists > 0) parts.push(`${row.assists} AST`);
  if (row.turnovers != null && row.turnovers > 0) parts.push(`${row.turnovers} TOV`);
  if (parts.length === 0) return '';
  return `${shortName(row.offensivePlayerName)} vs ${shortName(row.defensivePlayerName)}: ${parts.join(', ')}`;
}

function OffensivePickerModal({
  visible,
  roster,
  selectedId,
  onSelect,
  onClose,
}: {
  visible: boolean;
  roster: FilmPlayerOption[];
  selectedId?: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const { modalSheetStyle } = useResponsiveLayout();

  return (
    <Modal
      visible={visible}
      transparent
      animationType={Platform.OS === 'web' ? 'fade' : 'slide'}
      onRequestClose={onClose}
    >
      <View style={styles.modalBackdrop}>
        <Pressable
          style={styles.modalBackdropDismiss}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Dismiss Film Room player picker"
        />
        <View style={[styles.modalSheet, modalSheetStyle]}>
          <View style={styles.modalHandle} />
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Offensive player</Text>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              testID="film-picker-close"
            >
              <X size={18} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <FlatList
            data={roster}
            keyExtractor={item => item.playerId}
            renderItem={({ item }) => {
              const selected = item.playerId === selectedId;
              const meta: string[] = [];
              if (item.teamAbbr) meta.push(item.teamAbbr);
              if (item.totalFga > 0) meta.push(`${item.totalFga} FGA`);
              if (item.totalPoints > 0) meta.push(`${item.totalPoints} PTS`);
              return (
                <TouchableOpacity
                  onPress={() => onSelect(item.playerId)}
                  style={[styles.modalRow, selected && styles.modalRowSelected]}
                  activeOpacity={0.75}
                  testID={`film-picker-row-${item.playerId}`}
                >
                  <View style={[styles.modalRowDot, { backgroundColor: item.teamColor }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalRowName} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.modalRowMeta}>{meta.join(' · ')}</Text>
                  </View>
                </TouchableOpacity>
              );
            }}
            ItemSeparatorComponent={() => <View style={styles.modalSep} />}
            style={styles.modalList}
          />
        </View>
      </View>
    </Modal>
  );
}

function DefenderPickerModal({
  visible,
  roster,
  selectedId,
  onSelect,
  onClose,
}: {
  visible: boolean;
  roster: FilmDefenderOption[];
  selectedId?: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const { modalSheetStyle } = useResponsiveLayout();

  return (
    <Modal
      visible={visible}
      transparent
      animationType={Platform.OS === 'web' ? 'fade' : 'slide'}
      onRequestClose={onClose}
    >
      <View style={styles.modalBackdrop}>
        <Pressable
          style={styles.modalBackdropDismiss}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Dismiss Film Room player picker"
        />
        <View style={[styles.modalSheet, modalSheetStyle]}>
          <View style={styles.modalHandle} />
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Defender</Text>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              testID="film-picker-close"
            >
              <X size={18} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <FlatList
            data={roster}
            keyExtractor={item => item.playerId}
            renderItem={({ item }) => {
              const selected = item.playerId === selectedId;
              return (
                <TouchableOpacity
                  onPress={() => onSelect(item.playerId)}
                  style={[styles.modalRow, selected && styles.modalRowSelected]}
                  activeOpacity={0.75}
                  testID={`film-picker-row-${item.playerId}`}
                >
                  <View style={[styles.modalRowDot, { backgroundColor: item.teamColor }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalRowName} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.modalRowMeta}>{buildDefenderSubtitle(item)}</Text>
                  </View>
                </TouchableOpacity>
              );
            }}
            ItemSeparatorComponent={() => <View style={styles.modalSep} />}
            style={styles.modalList}
          />
        </View>
      </View>
    </Modal>
  );
}

function parseMinutesToSeconds(raw: string | undefined | null): number {
  if (!raw) return 0;
  const s = String(raw).trim();
  if (!s) return 0;
  const iso = s.match(/^PT(\d+)M([\d.]+)S$/i);
  if (iso) {
    const m = parseInt(iso[1], 10);
    const sec = parseFloat(iso[2]);
    return (Number.isFinite(m) ? m * 60 : 0) + (Number.isFinite(sec) ? sec : 0);
  }
  const colon = s.match(/^(\d+):(\d{1,2})/);
  if (colon) {
    const m = parseInt(colon[1], 10);
    const sec = parseInt(colon[2], 10);
    return (Number.isFinite(m) ? m * 60 : 0) + (Number.isFinite(sec) ? sec : 0);
  }
  const num = parseFloat(s);
  if (Number.isFinite(num)) return num * 60;
  return 0;
}

function shortName(full: string): string {
  const parts = full.trim().split(/\s+/);
  if (parts.length <= 1) return full;
  return `${parts[0].charAt(0)}. ${parts.slice(1).join(' ')}`;
}

function PlayerSelectorRow({
  label,
  player,
  placeholder,
  onPress,
  testID,
  subtitle,
}: {
  label: string;
  player?: { name: string; teamAbbr: string; teamColor: string };
  placeholder: string;
  onPress: () => void;
  testID?: string;
  subtitle?: string;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={styles.selectorRow}
      activeOpacity={0.75}
      testID={testID}
    >
      <View style={styles.selectorLabelWrap}>
        <Text style={styles.selectorLabel}>{label}</Text>
        {player && player.teamAbbr ? (
          <View style={[styles.selectorTeamPill, { backgroundColor: `${player.teamColor}26` }]}>
            <Text style={[styles.selectorTeamPillText, { color: player.teamColor }]}>
              {player.teamAbbr}
            </Text>
          </View>
        ) : null}
      </View>
      <View style={styles.selectorValueWrap}>
        <View style={{ flex: 1, alignItems: 'flex-end' }}>
          <Text
            style={[styles.selectorValue, !player && styles.selectorValueMuted]}
            numberOfLines={1}
          >
            {player ? player.name : placeholder}
          </Text>
          {subtitle ? (
            <Text style={styles.selectorSubtitle} numberOfLines={1}>{subtitle}</Text>
          ) : null}
        </View>
        <ChevronDown size={16} color={Colors.textMuted} />
      </View>
    </TouchableOpacity>
  );
}

function FilmRoomCard() {
  return (
    <View style={styles.filmCard} testID="matchup-film-room">
      <View style={styles.filmIconWrap}>
        <Film size={16} color={Colors.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.filmTitle}>Matchup Film Room</Text>
        <Text style={styles.filmBody}>
          Coming later: grouped shot clips, defender matchups, and player-vs-player film collections.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
  },
  sectionLabel: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    letterSpacing: 1.5,
  },
  preGameBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.cardBg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    marginTop: Spacing.md,
  },
  bannerSide: {
    flex: 1,
    gap: 4,
  },
  bannerDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  bannerAbbr: {
    color: Colors.textPrimary,
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
  },
  bannerRecord: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontVariant: ['tabular-nums'] as const,
  },
  bannerCenter: {
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
  },
  bannerEyebrow: {
    color: Colors.warning,
    fontSize: 9,
    fontWeight: FontWeight.bold,
    letterSpacing: 1.4,
    marginBottom: 2,
  },
  bannerTitle: {
    color: Colors.textSecondary,
    fontSize: FontSize.xs,
  },
  emptyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.cardBg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    marginTop: Spacing.md,
  },
  emptyText: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    flex: 1,
  },
  matchupV2StateCard: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.cardBg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: Spacing.md,
  },
  matchupV2StateCopy: {
    flex: 1,
    gap: 2,
  },
  matchupV2StateTitle: {
    color: Colors.textPrimary,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
  },
  matchupV2RetryButton: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.secondaryMuted,
    paddingHorizontal: Spacing.md,
  },
  matchupV2RetryText: {
    color: Colors.secondary,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
  },
  comparisonCard: {
    backgroundColor: Colors.cardBg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
  },
  compHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  compHeaderSide: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  compHeaderDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  compHeaderAbbr: {
    color: Colors.textPrimary,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
  },
  compDivider: {
    height: 1,
    backgroundColor: Colors.divider,
    marginBottom: Spacing.xs,
  },
  compRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  compValue: {
    flex: 1,
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    fontVariant: ['tabular-nums'] as const,
  },
  compLabelWrap: {
    width: 96,
    alignItems: 'center',
  },
  compLabel: {
    color: Colors.textPrimary,
    fontSize: 11,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.5,
  },
  compUnit: {
    color: Colors.textMuted,
    fontSize: 9,
    marginTop: 1,
    letterSpacing: 0.3,
  },
  notesCard: {
    backgroundColor: Colors.cardBg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    paddingHorizontal: Spacing.lg,
  },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
  },
  noteRowBorder: {
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  noteBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.secondary,
    marginTop: 6,
  },
  noteText: {
    flex: 1,
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    lineHeight: 20,
  },
  engineGrid: {
    gap: Spacing.sm,
  },
  engineCard: {
    backgroundColor: Colors.cardBg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderLeftWidth: 3,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  engineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
  engineTeamPill: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  engineTeamPillText: {
    fontSize: 10,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.5,
  },
  engineDescriptor: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontStyle: 'italic',
  },
  engineName: {
    color: Colors.textPrimary,
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    marginBottom: Spacing.sm,
  },
  engineStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 4,
  },
  engineStat: {
    flex: 1,
    alignItems: 'center',
  },
  engineStatValue: {
    color: Colors.textPrimary,
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    fontVariant: ['tabular-nums'] as const,
  },
  engineStatLabel: {
    color: Colors.textMuted,
    fontSize: 9,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.5,
    marginTop: 2,
  },
  engineStatSub: {
    color: Colors.accent,
    fontSize: 9,
    marginTop: 1,
    fontVariant: ['tabular-nums'] as const,
  },
  engineFootnote: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    marginTop: Spacing.sm,
    textAlign: 'center',
  },
  filmEmpty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.cardBg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderStyle: 'dashed',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    marginBottom: Spacing.lg,
  },
  filmGrid: {
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  filmGroupCard: {
    backgroundColor: Colors.cardBg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  filmGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  filmGroupTitle: {
    color: Colors.textPrimary,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    flex: 1,
  },
  filmGroupPossPill: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.accentMuted,
  },
  filmGroupPossText: {
    color: Colors.accent,
    fontSize: 10,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.5,
    fontVariant: ['tabular-nums'] as const,
  },
  filmGroupStats: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.sm,
  },
  filmStat: {
    alignItems: 'flex-start',
  },
  filmStatValue: {
    color: Colors.textPrimary,
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    fontVariant: ['tabular-nums'] as const,
  },
  filmStatLabel: {
    color: Colors.textMuted,
    fontSize: 9,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.5,
    marginTop: 2,
  },
  filmStatLine: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginBottom: Spacing.sm,
  },
  filmStatLineValue: {
    color: Colors.textPrimary,
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    fontVariant: ['tabular-nums'] as const,
  },
  filmStatLineLabel: {
    color: Colors.textMuted,
    fontSize: 10,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.5,
    marginRight: 4,
  },
  filmStatLineSep: {
    width: 1,
    height: 12,
    backgroundColor: Colors.divider,
    marginHorizontal: 2,
    alignSelf: 'center',
  },
  defenseBlock: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.sm,
    gap: 4,
  },
  defenseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  defenseHeaderText: {
    color: Colors.textMuted,
    fontSize: 9,
    fontWeight: FontWeight.bold,
    letterSpacing: 1,
  },
  defenseLine: {
    color: Colors.textSecondary,
    fontSize: FontSize.xs,
    fontVariant: ['tabular-nums'] as const,
  },
  filmLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.accentMuted,
  },
  filmLinkText: {
    color: Colors.accent,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.3,
  },
  filmCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.cardBg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderStyle: 'dashed',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    marginTop: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  filmIconWrap: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.accentMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filmTitle: {
    color: Colors.textPrimary,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    marginBottom: 2,
  },
  filmBody: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    lineHeight: 16,
  },
  filmSelectorCard: {
    backgroundColor: Colors.cardBg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    marginBottom: Spacing.lg,
    gap: Spacing.md,
  },
  filmSourceBadge: {
    alignSelf: 'flex-start',
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.accentMuted,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
  },
  filmSourceBadgeText: {
    color: Colors.accent,
    fontSize: 9,
    fontWeight: FontWeight.bold,
    letterSpacing: 1,
  },
  filmSelectorSubtitle: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    lineHeight: 16,
  },
  selectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  selectorLabelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  selectorLabel: {
    color: Colors.textMuted,
    fontSize: 10,
    fontWeight: FontWeight.bold,
    letterSpacing: 1.4,
  },
  selectorTeamPill: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  selectorTeamPillText: {
    fontSize: 10,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.5,
  },
  selectorValueWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: Spacing.sm,
  },
  selectorValue: {
    color: Colors.textPrimary,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    flexShrink: 1,
    textAlign: 'right',
  },
  selectorValueMuted: {
    color: Colors.textMuted,
    fontWeight: FontWeight.medium,
  },
  selectorSubtitle: {
    color: Colors.textMuted,
    fontSize: 10,
    marginTop: 2,
    fontVariant: ['tabular-nums'] as const,
  },
  filmEmptyHint: {
    color: Colors.textMuted,
    fontSize: 10,
    marginTop: 2,
  },
  swapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  swapDivider: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.divider,
  },
  swapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.background,
  },
  swapBtnText: {
    color: Colors.textSecondary,
    fontSize: 10,
    fontWeight: FontWeight.bold,
    letterSpacing: 1.2,
  },
  filmSummaryLine: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    lineHeight: 16,
    fontStyle: 'italic',
  },
  filmCTA: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.accentMuted,
  },
  filmCTADisabled: {
    backgroundColor: Colors.cardBorder,
    opacity: 0.7,
  },
  filmCTAText: {
    color: Colors.accent,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.3,
  },
  filmCTATextDisabled: {
    color: Colors.textMuted,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  modalBackdropDismiss: {
    flex: 1,
    alignSelf: 'stretch',
  },
  modalSheet: {
    backgroundColor: Colors.cardBg,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    paddingBottom: Spacing.xl,
    paddingTop: Spacing.sm,
    maxHeight: '75%',
  },
  modalHandle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.divider,
    marginBottom: Spacing.sm,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  modalTitle: {
    color: Colors.textPrimary,
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
  },
  modalList: {
    paddingHorizontal: Spacing.md,
  },
  modalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  modalRowSelected: {
    backgroundColor: Colors.accentMuted,
  },
  modalRowDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  modalRowName: {
    color: Colors.textPrimary,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  modalRowMeta: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    marginTop: 2,
  },
  modalSep: {
    height: 1,
    backgroundColor: 'transparent',
  },
});
