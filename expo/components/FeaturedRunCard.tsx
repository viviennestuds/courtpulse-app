import React, { useRef, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { Zap, ChevronRight } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '@/constants/colors';
import { Spacing, BorderRadius, FontSize, FontWeight } from '@/constants/theme';
import { Game } from '@/types';

interface FeaturedRunCardProps {
  game: Game;
  onPress: () => void;
}

export default React.memo(function FeaturedRunCard({ game, onPress }: FeaturedRunCardProps) {
  const run = game.featuredRun;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
    ]).start();

    if (game.status === 'live') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.4, duration: 1000, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
        ])
      ).start();
    }
  }, [game.status, pulseAnim, slideAnim, fadeAnim]);

  const handlePressIn = useCallback(() => {
    Animated.spring(scaleAnim, { toValue: 0.97, useNativeDriver: true, speed: 50, bounciness: 4 }).start();
  }, [scaleAnim]);

  const handlePressOut = useCallback(() => {
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 50, bounciness: 4 }).start();
  }, [scaleAnim]);

  if (!run) return null;

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }, { translateY: slideAnim }], opacity: fadeAnim }}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}
        testID="featured-run-card"
      >
        <LinearGradient
          colors={[run.teamColor + '30', Colors.cardBg, Colors.surface]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradient}
        >
          <View style={styles.topRow}>
            <View style={styles.badge}>
              <Zap size={12} color={Colors.warning} fill={Colors.warning} />
              <Text style={styles.badgeText}>MOMENTUM SHIFT</Text>
            </View>
            {game.status === 'live' && (
              <View style={styles.liveRow}>
                <Animated.View style={[styles.liveDot, { opacity: pulseAnim }]} />
                <Text style={styles.liveLabel}>LIVE</Text>
              </View>
            )}
          </View>

          <View style={styles.matchup}>
            <View style={styles.matchupTeam}>
              <View style={[styles.teamDot, { backgroundColor: game.awayTeam.primaryColor }]} />
              <Text style={styles.matchupAbbr}>{game.awayTeam.abbreviation}</Text>
              <Text style={styles.matchupScore}>{game.awayTeam.score}</Text>
            </View>
            <Text style={styles.atText}>@</Text>
            <View style={styles.matchupTeam}>
              <View style={[styles.teamDot, { backgroundColor: game.homeTeam.primaryColor }]} />
              <Text style={styles.matchupAbbr}>{game.homeTeam.abbreviation}</Text>
              <Text style={styles.matchupScore}>{game.homeTeam.score}</Text>
            </View>
          </View>

          <View style={styles.runHighlight}>
            <Text style={styles.runScore}>{run.totalPoints}-{run.opponentPoints}</Text>
            <Text style={styles.runTeam}>{run.teamAbbr} Run</Text>
          </View>

          <View style={styles.runMeta}>
            <Text style={styles.metaText}>Q{run.period} · {run.startClock} → {run.endClock}</Text>
            <Text style={styles.metaDivider}>·</Text>
            <Text style={styles.metaText}>{run.duration}</Text>
            <Text style={styles.metaDivider}>·</Text>
            <Text style={styles.metaText}>{run.playCount} plays</Text>
          </View>

          <Text style={styles.keyPlay} numberOfLines={2}>{run.keyPlay}</Text>

          <View style={styles.playersRow}>
            {run.players.slice(0, 3).map((player, i) => (
              <View key={i} style={styles.playerChip}>
                <Text style={styles.playerChipText}>{player}</Text>
              </View>
            ))}
            {run.players.length > 3 && (
              <Text style={styles.morePlayersText}>+{run.players.length - 3}</Text>
            )}
          </View>

          <View style={styles.ctaRow}>
            <Text style={styles.ctaText}>View Full Game</Text>
            <ChevronRight size={14} color={Colors.primary} />
          </View>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  gradient: {
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    padding: Spacing.xl,
    marginBottom: Spacing.lg,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.warningMuted,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
    gap: 4,
  },
  badgeText: {
    color: Colors.warning,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    letterSpacing: 1.2,
  },
  liveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.negative,
  },
  liveLabel: {
    color: Colors.negative,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    letterSpacing: 1,
  },
  matchup: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  matchupTeam: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  teamDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  matchupAbbr: {
    color: Colors.textPrimary,
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
  },
  matchupScore: {
    color: Colors.textPrimary,
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.heavy,
  },
  atText: {
    color: Colors.textMuted,
    fontSize: FontSize.lg,
  },
  runHighlight: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  runScore: {
    color: Colors.textPrimary,
    fontSize: 44,
    fontWeight: FontWeight.heavy,
    letterSpacing: -1,
  },
  runTeam: {
    color: Colors.warning,
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
  },
  runMeta: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginBottom: Spacing.lg,
  },
  metaText: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
  },
  metaDivider: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
  },
  keyPlay: {
    color: Colors.textSecondary,
    fontSize: FontSize.md,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: Spacing.lg,
    fontStyle: 'italic',
  },
  playersRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.lg,
  },
  playerChip: {
    backgroundColor: Colors.surfaceLight,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  playerChipText: {
    color: Colors.textSecondary,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
  },
  morePlayersText: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    alignSelf: 'center',
  },
  ctaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  ctaText: {
    color: Colors.primary,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
});
