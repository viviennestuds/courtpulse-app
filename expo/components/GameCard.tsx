import React, { useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { Colors } from '@/constants/colors';
import { Spacing, BorderRadius, FontSize, FontWeight } from '@/constants/theme';
import { Game } from '@/types';

interface GameCardProps {
  game: Game;
  onPress: () => void;
}

export default React.memo(function GameCard({ game, onPress }: GameCardProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const isLive = game.status === 'live';
  const isFinal = game.status === 'final';
  const isScheduled = game.status === 'scheduled';

  const handlePressIn = useCallback(() => {
    Animated.spring(scaleAnim, { toValue: 0.97, useNativeDriver: true, speed: 50, bounciness: 4 }).start();
  }, [scaleAnim]);

  const handlePressOut = useCallback(() => {
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 50, bounciness: 4 }).start();
  }, [scaleAnim]);

  const homeWon = isFinal && game.homeTeam.score > game.awayTeam.score;
  const awayWon = isFinal && game.awayTeam.score > game.homeTeam.score;

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        style={styles.container}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}
        testID={`game-card-${game.id}`}
      >
        <View style={styles.statusRow}>
          {isLive && (
            <View style={styles.liveBadge}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>LIVE</Text>
            </View>
          )}
          {isLive && <Text style={styles.periodText}>{game.period} · {game.clock}</Text>}
          {isFinal && <Text style={styles.finalText}>{game.period}</Text>}
          {isScheduled && <Text style={styles.scheduledText}>{game.clock}</Text>}
        </View>

        <View style={styles.matchupContainer}>
          <View style={styles.teamRow}>
            <View style={[styles.teamStripe, { backgroundColor: game.awayTeam.primaryColor }]} />
            <Text style={[styles.teamAbbr, awayWon && styles.winnerText]}>{game.awayTeam.abbreviation}</Text>
            <Text style={styles.teamName} numberOfLines={1}>{game.awayTeam.name}</Text>
            <Text style={[
              styles.score,
              isScheduled && styles.noScore,
              awayWon && styles.winnerText,
            ]}>
              {isScheduled ? '' : game.awayTeam.score}
            </Text>
          </View>

          <View style={styles.teamRow}>
            <View style={[styles.teamStripe, { backgroundColor: game.homeTeam.primaryColor }]} />
            <Text style={[styles.teamAbbr, homeWon && styles.winnerText]}>{game.homeTeam.abbreviation}</Text>
            <Text style={styles.teamName} numberOfLines={1}>{game.homeTeam.name}</Text>
            <Text style={[
              styles.score,
              isScheduled && styles.noScore,
              homeWon && styles.winnerText,
            ]}>
              {isScheduled ? '' : game.homeTeam.score}
            </Text>
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.arenaText}>{game.arena}</Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.cardBg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
    gap: Spacing.sm,
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
  periodText: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
  },
  finalText: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
  scheduledText: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
  matchupContainer: {
    gap: 6,
  },
  teamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  teamStripe: {
    width: 3,
    height: 20,
    borderRadius: 2,
    marginRight: Spacing.sm,
  },
  teamAbbr: {
    color: Colors.textPrimary,
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    width: 44,
  },
  teamName: {
    color: Colors.textMuted,
    fontSize: FontSize.md,
    flex: 1,
  },
  score: {
    color: Colors.textSecondary,
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    minWidth: 40,
    textAlign: 'right',
  },
  noScore: {
    color: Colors.textMuted,
  },
  winnerText: {
    color: Colors.textPrimary,
  },
  footer: {
    marginTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
    paddingTop: Spacing.sm,
  },
  arenaText: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
  },
});
