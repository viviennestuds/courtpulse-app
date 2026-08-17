import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { GestureResponderEvent } from 'react-native';
import {
  Check,
  ChevronDown,
  ChevronUp,
  Film,
  Shield,
  UserRound,
  X,
} from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { BorderRadius, FontSize, FontWeight, Spacing } from '@/constants/theme';
import { useGameMatchupSummaryV2, MatchupSummaryV2GameStatus } from '@/hooks/useGameMatchupSummaryV2';
import type {
  GameMatchupSummaryV2Response,
  MatchupSummaryV2DefenderDistributionRow,
  MatchupSummaryV2FactorContext,
  MatchupSummaryV2KeyMatchup,
  MatchupSummaryV2NotabilityReason,
  MatchupSummaryV2OffensePlayer,
  MatchupSummaryV2PlayerIdentity,
} from '@/types/matchupSummaryV2';

export interface MatchupV2PairSelection {
  offensePlayerId: string;
  defensePlayerId: string;
  offenseTeamId: string;
  offenseName: string;
  defenseName: string;
}

interface ActiveMatchupV2Pair {
  offensePlayerId: string;
  defensePlayerId: string;
}

interface MatchupV2TeamAccent {
  id: string;
  abbreviation: string;
  primaryColor: string;
}

function SectionHeader({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <View style={styles.sectionHeader}>
      {icon}
      <Text style={styles.sectionLabel}>{label}</Text>
    </View>
  );
}

function asId(value: string | number): string {
  return String(value);
}

function isSamePair(
  matchup: MatchupSummaryV2KeyMatchup,
  activePair: ActiveMatchupV2Pair | null,
): boolean {
  if (!activePair) return false;
  return asId(matchup.pairing.offense.playerId) === activePair.offensePlayerId
    && asId(matchup.pairing.defense.playerId) === activePair.defensePlayerId;
}

type MatchupReasonSemantic = 'positive' | 'negative' | 'neutral';

function compactDecimal(value: number, fractionDigits: number): string {
  return value.toFixed(fractionDigits).replace(/\.0+$/, '');
}

function formatPercent(value: number): string {
  return `${compactDecimal(value * 100, 1)}%`;
}

function directionArrow(reason: MatchupSummaryV2NotabilityReason): '↑' | '↓' | '' {
  if (reason.direction === 'higherInMatchup' || reason.direction === 'moreThreePointHeavy') return '↑';
  if (reason.direction === 'lowerInMatchup' || reason.direction === 'lessThreePointHeavy') return '↓';
  if (reason.value > 0) return '↑';
  if (reason.value < 0) return '↓';
  return '';
}

/** Formats canonical reason values without deriving or re-ranking analytics. */
export function formatMatchupV2ReasonValue(reason: MatchupSummaryV2NotabilityReason): string {
  if (reason.key === 'efficiencySwing' || reason.unit === 'efgPctDelta') {
    return `${directionArrow(reason)}${compactDecimal(Math.abs(reason.value) * 100, 1)} pp eFG`;
  }
  if (reason.key === 'threePointDietShift' || reason.unit === 'attemptRateDelta') {
    return `${directionArrow(reason)}${compactDecimal(Math.abs(reason.value) * 100, 1)} pp 3PA rate`;
  }
  if (reason.key === 'turnoverConcentration' || reason.unit === 'shareOfFullGameTurnovers') {
    return `${formatPercent(reason.value)} full-game TOV`;
  }
  if (reason.key === 'foulPressure' || reason.unit === 'freeThrowRate') {
    return `${formatPercent(reason.value)} FTr`;
  }
  if (reason.key === 'blockedAttempt' || reason.unit === 'blocks') {
    return `${compactDecimal(reason.value, 0)} BLK`;
  }
  if (reason.key === 'highExposure' || reason.unit === 'partialPossessions') {
    return `${compactDecimal(reason.value, 1)} poss.`;
  }
  return Number.isInteger(reason.value) ? reason.value.toString() : reason.value.toFixed(2);
}

function reasonSemantic(reason: MatchupSummaryV2NotabilityReason): MatchupReasonSemantic {
  if (reason.key === 'efficiencySwing' || reason.unit === 'efgPctDelta') {
    if (reason.direction === 'higherInMatchup') return 'positive';
    if (reason.direction === 'lowerInMatchup') return 'negative';
    return reason.value > 0 ? 'positive' : 'negative';
  }
  if (reason.key === 'turnoverConcentration' || reason.key === 'blockedAttempt' || reason.unit === 'blocks') {
    return 'negative';
  }
  if (reason.key === 'foulPressure' || reason.unit === 'freeThrowRate') return 'positive';
  return 'neutral';
}

function semanticColor(semantic: MatchupReasonSemantic): string {
  if (semantic === 'positive') return Colors.positive;
  if (semantic === 'negative') return Colors.negative;
  return Colors.secondary;
}

function factorContextLine(
  reason: MatchupSummaryV2NotabilityReason,
  context: MatchupSummaryV2FactorContext,
): string | null {
  if (reason.key === 'efficiencySwing' || reason.unit === 'efgPctDelta') {
    const selected = context.shooting?.selected?.efgPct;
    const rest = context.shooting?.restOfGameExclusive?.efgPct;
    if (typeof selected === 'number' && typeof rest === 'number') {
      return `${formatPercent(selected)} eFG vs ${formatPercent(rest)} rest of game`;
    }
  }
  if (reason.key === 'threePointDietShift' || reason.unit === 'attemptRateDelta') {
    const selected = context.shooting?.selected?.threePointAttemptRate;
    const rest = context.shooting?.restOfGameExclusive?.threePointAttemptRate;
    if (typeof selected === 'number' && typeof rest === 'number') {
      return `${formatPercent(selected)} 3PA rate vs ${formatPercent(rest)} rest of game`;
    }
  }
  if (reason.key === 'foulPressure' || reason.unit === 'freeThrowRate') {
    const selected = context.foulPressure?.freeThrowRate;
    const rest = context.foulPressure?.restOfGameExclusiveFreeThrowRate;
    if (typeof selected === 'number' && typeof rest === 'number') {
      return `${formatPercent(selected)} FTr vs ${formatPercent(rest)} rest of game`;
    }
  }
  if (reason.key === 'turnoverConcentration') {
    const turnovers = context.ballSecurity?.turnovers;
    const share = context.ballSecurity?.shareOfFullGameTurnovers;
    if (typeof turnovers === 'number' && typeof share === 'number') {
      return `${compactDecimal(turnovers, 0)} TOV · ${formatPercent(share)} of full-game TOV`;
    }
  }
  return null;
}

function strengthColors(strength: MatchupSummaryV2NotabilityReason['strength']): {
  backgroundColor: string;
  borderColor: string;
  textColor: string;
} {
  if (strength === 'major') {
    return { backgroundColor: Colors.warningMuted, borderColor: 'rgba(245,158,11,0.35)', textColor: Colors.warning };
  }
  if (strength === 'notable') {
    return { backgroundColor: Colors.secondaryMuted, borderColor: 'rgba(6,182,212,0.32)', textColor: Colors.secondary };
  }
  return { backgroundColor: Colors.surfaceLight, borderColor: Colors.cardBorder, textColor: Colors.textSecondary };
}

function teamColorFor(
  player: MatchupSummaryV2PlayerIdentity,
  homeTeam: MatchupV2TeamAccent,
  awayTeam: MatchupV2TeamAccent,
): string {
  const teamId = asId(player.teamId);
  if (teamId === homeTeam.id || player.teamTricode === homeTeam.abbreviation) return homeTeam.primaryColor;
  if (teamId === awayTeam.id || player.teamTricode === awayTeam.abbreviation) return awayTeam.primaryColor;
  return Colors.textMuted;
}

function KeyMatchupReasonRow({
  reason,
  factorContext,
}: {
  reason: MatchupSummaryV2NotabilityReason;
  factorContext: MatchupSummaryV2FactorContext;
}) {
  const colors = strengthColors(reason.strength);
  const contextLine = factorContextLine(reason, factorContext);
  const valueColor = semanticColor(reasonSemantic(reason));

  return (
    <View style={styles.reasonBlock}>
      <View style={styles.reasonRow}>
        <View style={[styles.reasonStrength, { backgroundColor: colors.backgroundColor, borderColor: colors.borderColor }]}>
          <Text style={[styles.reasonStrengthText, { color: colors.textColor }]}>{reason.strength.toUpperCase()}</Text>
        </View>
        <Text style={styles.reasonText}>
          {reason.label} · <Text style={[styles.reasonValue, { color: valueColor }]}>{formatMatchupV2ReasonValue(reason)}</Text>
        </Text>
      </View>
      {contextLine ? <Text style={styles.factorContextLine}>{contextLine}</Text> : null}
    </View>
  );
}

function KeyMatchupCard({
  matchup,
  homeTeam,
  awayTeam,
  isActive,
  onPress,
}: {
  matchup: MatchupSummaryV2KeyMatchup;
  homeTeam: MatchupV2TeamAccent;
  awayTeam: MatchupV2TeamAccent;
  isActive: boolean;
  onPress: () => void;
}) {
  const { offense, defense } = matchup.pairing;
  const offenseColor = teamColorFor(offense, homeTeam, awayTeam);
  const defenseColor = teamColorFor(defense, homeTeam, awayTeam);
  const [reasonsExpanded, setReasonsExpanded] = useState<boolean>(false);
  const initiallyVisibleReasonCount = Math.min(2, matchup.notabilityReasons.length);
  const visibleReasons = reasonsExpanded
    ? matchup.notabilityReasons
    : matchup.notabilityReasons.slice(0, initiallyVisibleReasonCount);
  const hiddenReasonCount = Math.max(0, matchup.notabilityReasons.length - initiallyVisibleReasonCount);
  const handleToggleReasons = useCallback((event: GestureResponderEvent) => {
    event.stopPropagation();
    setReasonsExpanded((value: boolean) => !value);
  }, []);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }: { pressed: boolean }) => [
        styles.keyMatchupCard,
        isActive && styles.keyMatchupCardActive,
        pressed && styles.keyMatchupCardPressed,
      ]}
      testID={`matchup-v2-key-matchup-${asId(offense.playerId)}-${asId(defense.playerId)}`}
      accessibilityRole="button"
      accessibilityLabel={`${offense.name} versus ${defense.name}. ${isActive ? 'Loaded in Film Room.' : 'Tap to load in Film Room.'}`}
    >
      <View style={styles.pairingRow}>
        <View style={styles.pairingNames}>
          <View style={styles.playerNameRow}>
            <View style={[styles.teamDot, { backgroundColor: offenseColor }]} />
            <Text style={styles.offenseName} numberOfLines={1}>{offense.name}</Text>
            <Text style={[styles.teamTricode, { color: offenseColor }]}>{offense.teamTricode}</Text>
          </View>
          <View style={styles.playerNameRow}>
            <Text style={styles.versusText}>vs</Text>
            <View style={[styles.teamDot, { backgroundColor: defenseColor }]} />
            <Text style={styles.defenseName} numberOfLines={1}>{defense.name}</Text>
            <Text style={[styles.teamTricode, { color: defenseColor }]}>{defense.teamTricode}</Text>
          </View>
        </View>
        {isActive ? (
          <View style={styles.loadedBadge} testID="matchup-v2-key-matchup-active">
            <Film size={11} color={Colors.accent} />
            <Text style={styles.loadedBadgeText}>LOADED</Text>
          </View>
        ) : null}
      </View>

      <Text style={styles.exposureLine}>
        {matchup.boxScore.matchupTime} · {matchup.boxScore.partialPossessions.toFixed(1)} matchup poss.
      </Text>
      <Text style={styles.boxScoreLine}>
        {matchup.boxScore.offense.points} PTS · {matchup.boxScore.offense.fgm}/{matchup.boxScore.offense.fga} FG
      </Text>

      {visibleReasons.length > 0 ? (
        <View style={styles.reasonList}>
          {visibleReasons.map((reason: MatchupSummaryV2NotabilityReason, index: number) => (
            <KeyMatchupReasonRow
              key={`${reason.key}-${index}`}
              reason={reason}
              factorContext={matchup.factorContext}
            />
          ))}
          {hiddenReasonCount > 0 ? (
            <Pressable
              onPress={handleToggleReasons}
              hitSlop={8}
              style={({ pressed }: { pressed: boolean }) => [styles.moreReasonsButton, pressed && styles.localControlPressed]}
              accessibilityRole="button"
              accessibilityLabel={reasonsExpanded ? 'Show fewer matchup signals' : `Show ${hiddenReasonCount} more matchup signals`}
              testID={`matchup-v2-key-matchup-reasons-${asId(offense.playerId)}-${asId(defense.playerId)}`}
            >
              <Text style={styles.moreReasonsText}>
                {reasonsExpanded
                  ? 'Show less'
                  : `+${hiddenReasonCount} more signal${hiddenReasonCount === 1 ? '' : 's'}`}
              </Text>
              {reasonsExpanded
                ? <ChevronUp size={13} color={Colors.secondary} />
                : <ChevronDown size={13} color={Colors.secondary} />}
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {!isActive ? <Text style={styles.loadAffordance}>Tap to load in Film Room</Text> : null}
    </Pressable>
  );
}

export const MatchupV2KeyMatchups = React.memo(function MatchupV2KeyMatchups({
  keyMatchups,
  homeTeam,
  awayTeam,
  isLoading,
  activePair,
  onLoadPair,
}: {
  keyMatchups: MatchupSummaryV2KeyMatchup[];
  homeTeam: MatchupV2TeamAccent;
  awayTeam: MatchupV2TeamAccent;
  isLoading: boolean;
  activePair: ActiveMatchupV2Pair | null;
  onLoadPair: (selection: MatchupV2PairSelection) => void;
}) {
  const [showAllMatchups, setShowAllMatchups] = useState<boolean>(false);
  const activeMatchup = keyMatchups.find((matchup: MatchupSummaryV2KeyMatchup) => isSamePair(matchup, activePair));
  const visibleMatchups = showAllMatchups ? keyMatchups : keyMatchups.slice(0, 3);

  return (
    <View testID="matchup-v2-key-matchups">
      <SectionHeader icon={<Shield size={12} color={Colors.secondary} />} label="KEY MATCHUPS" />
      {isLoading ? (
        <View style={styles.loadingCard}>
          <ActivityIndicator size="small" color={Colors.secondary} />
          <View style={styles.loadingLines}>
            <View style={[styles.loadingLine, { width: '72%' }]} />
            <View style={[styles.loadingLine, { width: '46%' }]} />
          </View>
        </View>
      ) : keyMatchups.length === 0 ? (
        <View style={styles.containedState}>
          <Text style={styles.containedStateText}>No key matchup signals met the current threshold.</Text>
        </View>
      ) : (
        <View style={styles.keyMatchupList}>
          {visibleMatchups.map((matchup: MatchupSummaryV2KeyMatchup) => {
            const offensePlayerId = asId(matchup.pairing.offense.playerId);
            const defensePlayerId = asId(matchup.pairing.defense.playerId);
            return (
              <KeyMatchupCard
                key={`${offensePlayerId}-${defensePlayerId}`}
                matchup={matchup}
                homeTeam={homeTeam}
                awayTeam={awayTeam}
                isActive={isSamePair(matchup, activePair)}
                onPress={() => onLoadPair({
                  offensePlayerId,
                  defensePlayerId,
                  offenseTeamId: asId(matchup.pairing.offense.teamId),
                  offenseName: matchup.pairing.offense.name,
                  defenseName: matchup.pairing.defense.name,
                })}
              />
            );
          })}
          {keyMatchups.length > 3 ? (
            <Pressable
              onPress={() => setShowAllMatchups((value: boolean) => !value)}
              style={({ pressed }: { pressed: boolean }) => [styles.showAllButton, pressed && styles.localControlPressed]}
              accessibilityRole="button"
              accessibilityLabel={showAllMatchups ? 'Show fewer key matchups' : `View all ${keyMatchups.length} key matchups`}
              testID="matchup-v2-key-matchups-toggle"
            >
              <Text style={styles.showAllText}>
                {showAllMatchups ? 'Show less' : `View all ${keyMatchups.length}`}
              </Text>
              {showAllMatchups
                ? <ChevronUp size={14} color={Colors.secondary} />
                : <ChevronDown size={14} color={Colors.secondary} />}
            </Pressable>
          ) : null}
        </View>
      )}

      {activeMatchup ? (
        <View style={styles.selectionConfirmation} testID="matchup-v2-selection-confirmation">
          <Check size={13} color={Colors.positive} />
          <Text style={styles.selectionConfirmationText} numberOfLines={1}>
            {activeMatchup.pairing.offense.name} vs {activeMatchup.pairing.defense.name} loaded in Film Room
          </Text>
        </View>
      ) : null}
    </View>
  );
});

function MatchupV2PlayerPicker({
  visible,
  players,
  selectedPlayerId,
  onSelect,
  onClose,
}: {
  visible: boolean;
  players: MatchupSummaryV2OffensePlayer[];
  selectedPlayerId?: string;
  onSelect: (playerId: string) => void;
  onClose: () => void;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType={Platform.OS === 'web' ? 'fade' : 'slide'}
      onRequestClose={onClose}
    >
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.modalSheet} onPress={() => {}}>
          <View style={styles.modalHandle} />
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Offensive player</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton} accessibilityLabel="Close player picker">
              <X size={18} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <FlatList
            data={players}
            keyExtractor={(item: MatchupSummaryV2OffensePlayer) => asId(item.playerId)}
            renderItem={({ item }: { item: MatchupSummaryV2OffensePlayer }) => {
              const playerId = asId(item.playerId);
              const selected = playerId === selectedPlayerId;
              return (
                <TouchableOpacity
                  onPress={() => onSelect(playerId)}
                  style={[styles.modalRow, selected && styles.modalRowSelected]}
                  activeOpacity={0.75}
                  testID={`matchup-v2-who-guarded-player-${playerId}`}
                >
                  <View style={styles.modalRowMain}>
                    <Text style={styles.modalRowName} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.modalRowMeta}>
                      {item.teamTricode} · {item.matchupCount} matchups
                    </Text>
                  </View>
                  {selected ? <Check size={16} color={Colors.secondary} /> : null}
                </TouchableOpacity>
              );
            }}
            style={styles.modalList}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function DefenderDistributionRow({ row }: { row: MatchupSummaryV2DefenderDistributionRow }) {
  const defenderActivity: string[] = [];
  if (row.defenderBlocks > 0) defenderActivity.push(`${row.defenderBlocks} BLK`);
  if (row.defenderShootingFouls > 0) {
    defenderActivity.push(`${row.defenderShootingFouls} shooting foul${row.defenderShootingFouls === 1 ? '' : 's'}`);
  }
  const rawExposurePercent = row.percentageTotalTimeBothOn <= 1
    ? row.percentageTotalTimeBothOn * 100
    : row.percentageTotalTimeBothOn;
  const exposurePercent = Math.max(0, Math.min(100, rawExposurePercent));
  const exposureWidth = `${exposurePercent}%` as `${number}%`;

  return (
    <View style={styles.defenderRow} testID={`matchup-v2-defender-row-${asId(row.defense.playerId)}`}>
      <View style={styles.defenderHeader}>
        <View style={styles.defenderIdentity}>
          <Text style={styles.defenderName} numberOfLines={1}>{row.defense.name}</Text>
          <Text style={styles.defenderTeam}>{row.defense.teamTricode}</Text>
        </View>
        <Text style={styles.defenderExposure}>{row.matchupTime} · {row.partialPossessions.toFixed(1)} poss.</Text>
      </View>
      <View
        style={styles.exposureTrack}
        accessibilityLabel={`${compactDecimal(exposurePercent, 1)} percent shared court-time exposure`}
      >
        <View style={[styles.exposureFill, { width: exposureWidth }]} />
      </View>
      <Text style={styles.defenderPrimaryStats}>
        {row.points} PTS · {row.fgm}/{row.fga} FG
      </Text>
      <Text style={styles.defenderSecondaryStats}>
        {row.assists} AST · {row.turnovers} TOV
      </Text>
      {defenderActivity.length > 0 ? (
        <View style={styles.defenderActivityRow}>
          <Text style={styles.defenderActivityLabel}>DEF</Text>
          <Text style={styles.defenderActivityText}>{defenderActivity.join(' · ')}</Text>
        </View>
      ) : null}
    </View>
  );
}

export const MatchupV2WhoGuarded = React.memo(function MatchupV2WhoGuarded({
  gameId,
  status,
  summary,
}: {
  gameId: string;
  status: MatchupSummaryV2GameStatus;
  summary: GameMatchupSummaryV2Response;
}) {
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | undefined>(undefined);
  const [pickerOpen, setPickerOpen] = useState<boolean>(false);
  const [showAll, setShowAll] = useState<boolean>(false);
  const initializedGameIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (initializedGameIdRef.current === gameId) return;
    const seededPlayerId = summary.keyMatchups[0]
      ? asId(summary.keyMatchups[0].pairing.offense.playerId)
      : summary.offensePlayers[0]
        ? asId(summary.offensePlayers[0].playerId)
        : undefined;
    initializedGameIdRef.current = gameId;
    setSelectedPlayerId(seededPlayerId);
    setPickerOpen(false);
    setShowAll(false);
  }, [gameId, summary.keyMatchups, summary.offensePlayers]);

  const selectedPlayer = useMemo(
    () => summary.offensePlayers.find((player: MatchupSummaryV2OffensePlayer) => asId(player.playerId) === selectedPlayerId),
    [summary.offensePlayers, selectedPlayerId],
  );

  const distributionQuery = useGameMatchupSummaryV2({
    gameId,
    offensePlayerId: selectedPlayerId,
    enabled: selectedPlayerId !== undefined,
    status,
  });
  const selectedOffense = distributionQuery.data?.selectedOffense ?? null;
  const responseMatchesSelection = selectedOffense !== null
    && asId(selectedOffense.offense.playerId) === selectedPlayerId;
  const canShowPreviousDistribution = distributionQuery.isPlaceholderData && selectedOffense !== null;
  const distribution = responseMatchesSelection || canShowPreviousDistribution
    ? selectedOffense?.defenderDistribution ?? []
    : [];
  const visibleDistribution = showAll ? distribution : distribution.slice(0, 5);
  const hasContainedError = distributionQuery.isError
    || (!distributionQuery.isPending && !distributionQuery.isPlaceholderData && !responseMatchesSelection);

  const handleSelect = useCallback((playerId: string) => {
    setSelectedPlayerId(playerId);
    setPickerOpen(false);
    setShowAll(false);
    if (__DEV__) {
      console.log('[MatchupSummaryV2] Who Guarded player selected', { gameId, offensePlayerId: playerId });
    }
  }, [gameId]);

  return (
    <View testID="matchup-v2-who-guarded">
      <SectionHeader icon={<UserRound size={12} color={Colors.accent} />} label="WHO GUARDED HIM?" />
      {summary.offensePlayers.length === 0 ? (
        <View style={styles.containedState}>
          <Text style={styles.containedStateText}>Player matchup distribution unavailable.</Text>
        </View>
      ) : (
        <View style={styles.whoGuardedCard}>
          <TouchableOpacity
            onPress={() => setPickerOpen(true)}
            style={styles.whoGuardedSelector}
            activeOpacity={0.76}
            testID="matchup-v2-who-guarded-selector"
          >
            <View style={styles.selectorCopy}>
              <Text style={styles.selectorEyebrow}>OFFENSIVE PLAYER</Text>
              <Text style={styles.selectedPlayerName} numberOfLines={1}>
                {selectedPlayer ? `${selectedPlayer.name} vs…` : 'Choose player'}
              </Text>
            </View>
            <ChevronDown size={17} color={Colors.textMuted} />
          </TouchableOpacity>

          {distributionQuery.isFetching ? (
            <View style={styles.refreshingRow}>
              <ActivityIndicator size="small" color={Colors.secondary} />
              <Text style={styles.refreshingText}>
                {distribution.length > 0 ? 'Refreshing defender distribution…' : 'Loading defender distribution…'}
              </Text>
            </View>
          ) : null}

          {hasContainedError ? (
            <View style={styles.inlineState}>
              <Text style={styles.inlineStateText}>Defender distribution unavailable.</Text>
            </View>
          ) : !distributionQuery.isPending && distribution.length === 0 ? (
            <View style={styles.inlineState}>
              <Text style={styles.inlineStateText}>Defender distribution unavailable.</Text>
            </View>
          ) : (
            <View
              style={[
                styles.defenderList,
                distributionQuery.isPlaceholderData && styles.defenderListPlaceholder,
              ]}
            >
              {visibleDistribution.map((row: MatchupSummaryV2DefenderDistributionRow) => (
                <DefenderDistributionRow key={asId(row.defense.playerId)} row={row} />
              ))}
            </View>
          )}

          {distribution.length > 5 ? (
            <TouchableOpacity
              onPress={() => setShowAll((value: boolean) => !value)}
              style={styles.showAllButton}
              activeOpacity={0.75}
            >
              <Text style={styles.showAllText}>{showAll ? 'Show less' : `Show all ${distribution.length}`}</Text>
              {showAll
                ? <ChevronUp size={14} color={Colors.secondary} />
                : <ChevronDown size={14} color={Colors.secondary} />}
            </TouchableOpacity>
          ) : null}
        </View>
      )}

      <MatchupV2PlayerPicker
        visible={pickerOpen}
        players={summary.offensePlayers}
        selectedPlayerId={selectedPlayerId}
        onSelect={handleSelect}
        onClose={() => setPickerOpen(false)}
      />
    </View>
  );
});

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
  keyMatchupList: {
    gap: Spacing.sm,
  },
  keyMatchupCard: {
    backgroundColor: Colors.cardBg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: Spacing.md,
  },
  keyMatchupCardActive: {
    borderColor: Colors.accent,
    backgroundColor: 'rgba(139,92,246,0.08)',
  },
  keyMatchupCardPressed: {
    opacity: 0.82,
  },
  pairingRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  pairingNames: {
    flex: 1,
    gap: 3,
  },
  playerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  teamDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  offenseName: {
    color: Colors.textPrimary,
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    flexShrink: 1,
  },
  defenseName: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    flexShrink: 1,
  },
  versusText: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    marginLeft: 12,
  },
  teamTricode: {
    fontSize: 9,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.6,
  },
  loadedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.accentMuted,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
  },
  loadedBadgeText: {
    color: Colors.accent,
    fontSize: 8,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.8,
  },
  exposureLine: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    marginTop: Spacing.sm,
    fontVariant: ['tabular-nums'] as const,
  },
  boxScoreLine: {
    color: Colors.textPrimary,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    marginTop: 3,
    fontVariant: ['tabular-nums'] as const,
  },
  reasonList: {
    gap: 5,
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  reasonBlock: {
    gap: 3,
  },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  reasonStrength: {
    minWidth: 66,
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  reasonStrengthText: {
    fontSize: 8,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.7,
  },
  reasonText: {
    color: Colors.textSecondary,
    fontSize: FontSize.xs,
    flex: 1,
    fontVariant: ['tabular-nums'] as const,
  },
  reasonValue: {
    fontWeight: FontWeight.semibold,
  },
  factorContextLine: {
    color: Colors.textMuted,
    fontSize: 10,
    lineHeight: 14,
    marginLeft: 72,
    fontVariant: ['tabular-nums'] as const,
  },
  moreReasonsButton: {
    minHeight: 36,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginLeft: 66,
    paddingHorizontal: 6,
  },
  moreReasonsText: {
    color: Colors.secondary,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
  },
  localControlPressed: {
    opacity: 0.58,
  },
  loadAffordance: {
    color: Colors.textMuted,
    fontSize: 10,
    marginTop: Spacing.sm,
  },
  selectionConfirmation: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: Spacing.sm,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.positiveMuted,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  selectionConfirmationText: {
    color: Colors.positive,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    flex: 1,
  },
  loadingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.cardBg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: Spacing.lg,
  },
  loadingLines: {
    flex: 1,
    gap: Spacing.sm,
  },
  loadingLine: {
    height: 8,
    backgroundColor: Colors.surfaceLight,
    borderRadius: BorderRadius.full,
  },
  containedState: {
    backgroundColor: Colors.cardBg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderStyle: 'dashed',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  containedStateText: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
  },
  whoGuardedCard: {
    backgroundColor: Colors.cardBg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    overflow: 'hidden',
  },
  whoGuardedSelector: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
    backgroundColor: Colors.surfaceLight,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  selectorCopy: {
    flex: 1,
  },
  selectorEyebrow: {
    color: Colors.textMuted,
    fontSize: 9,
    fontWeight: FontWeight.bold,
    letterSpacing: 1.1,
    marginBottom: 3,
  },
  selectedPlayerName: {
    color: Colors.textPrimary,
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
  },
  refreshingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
  },
  refreshingText: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
  },
  defenderList: {
    paddingHorizontal: Spacing.md,
  },
  defenderListPlaceholder: {
    opacity: 0.52,
  },
  defenderRow: {
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  defenderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  defenderIdentity: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    flex: 1,
  },
  defenderName: {
    color: Colors.textPrimary,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    flexShrink: 1,
  },
  defenderTeam: {
    color: Colors.textMuted,
    fontSize: 9,
    fontWeight: FontWeight.bold,
  },
  defenderExposure: {
    color: Colors.textMuted,
    fontSize: 10,
    fontVariant: ['tabular-nums'] as const,
  },
  exposureTrack: {
    height: 3,
    overflow: 'hidden',
    backgroundColor: Colors.surfaceLight,
    borderRadius: BorderRadius.full,
    marginTop: 7,
  },
  exposureFill: {
    height: '100%',
    backgroundColor: Colors.secondary,
    borderRadius: BorderRadius.full,
    opacity: 0.55,
  },
  defenderPrimaryStats: {
    color: Colors.textSecondary,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    marginTop: 5,
    fontVariant: ['tabular-nums'] as const,
  },
  defenderSecondaryStats: {
    color: Colors.textMuted,
    fontSize: 10,
    marginTop: 2,
    fontVariant: ['tabular-nums'] as const,
  },
  defenderActivityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 5,
  },
  defenderActivityLabel: {
    color: Colors.secondary,
    fontSize: 8,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.8,
    backgroundColor: Colors.secondaryMuted,
    borderRadius: BorderRadius.sm,
    overflow: 'hidden',
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  defenderActivityText: {
    color: Colors.textSecondary,
    fontSize: 10,
    fontWeight: FontWeight.semibold,
    fontVariant: ['tabular-nums'] as const,
  },
  inlineState: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.lg,
  },
  inlineStateText: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
  },
  showAllButton: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  showAllText: {
    color: Colors.secondary,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: Colors.cardBg,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xl,
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
  closeButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalList: {
    paddingHorizontal: Spacing.md,
  },
  modalRow: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  modalRowSelected: {
    backgroundColor: Colors.secondaryMuted,
  },
  modalRowMain: {
    flex: 1,
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
});
