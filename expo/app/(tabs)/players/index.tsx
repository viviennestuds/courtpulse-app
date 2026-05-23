import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TextInput, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Search } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { Spacing, BorderRadius, FontSize, FontWeight } from '@/constants/theme';
import SegmentControl from '@/components/SegmentControl';
import PlayerCard from '@/components/PlayerCard';
import DataSourceBadge from '@/components/DataSourceBadge';
import { usePlayers } from '@/hooks/useNbaData';
import { NBA_SEASON } from '@/services/nbaApi';

const SORT_SEGMENTS = ['PPG', 'RPG', 'APG', 'TS%'];

export default function PlayersScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [sortIndex, setSortIndex] = useState(0);
  const [search, setSearch] = useState('');

  const { players: rawPlayers, dataSource, isLoading, isRefetching, refetch } = usePlayers();

  const players = useMemo(() => {
    let filtered = rawPlayers;
    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = rawPlayers.filter(p =>
        p.name.toLowerCase().includes(q) || p.teamAbbr.toLowerCase().includes(q)
      );
    }
    return [...filtered].sort((a, b) => {
      if (sortIndex === 0) return b.ppg - a.ppg;
      if (sortIndex === 1) return b.rpg - a.rpg;
      if (sortIndex === 2) return b.apg - a.apg;
      return b.tsPct - a.tsPct;
    });
  }, [search, sortIndex, rawPlayers]);

  const handleRefresh = useCallback(() => {
    void refetch();
  }, [refetch]);

  const handlePlayerPress = useCallback((playerId: string) => {
    router.push(`/player/${playerId}`);
  }, [router]);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={handleRefresh} tintColor={Colors.primary} />}
      >
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>Players</Text>
            <Text style={styles.subtitle}>{NBA_SEASON} Season Leaders</Text>
          </View>
          <DataSourceBadge source={dataSource} />
        </View>

        <View style={styles.searchContainer}>
          <Search size={16} color={Colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search players..."
            placeholderTextColor={Colors.textMuted}
            value={search}
            onChangeText={setSearch}
          />
        </View>

        <View style={styles.segmentRow}>
          <SegmentControl segments={SORT_SEGMENTS} selected={sortIndex} onSelect={setSortIndex} />
        </View>

        {isLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>Loading players...</Text>
          </View>
        )}

        {!isLoading && players.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>{search ? 'No players found' : 'Unable to load player data'}</Text>
            <Text style={styles.emptySubtext}>
              {search ? 'Try a different search term' : 'The stats.nba.com endpoint may be unavailable. Pull to retry.'}
            </Text>
          </View>
        )}

        {!isLoading && players.slice(0, 50).map((player, index) => (
          <PlayerCard
            key={player.id}
            player={player}
            rank={index + 1}
            onPress={() => handlePlayerPress(player.id)}
          />
        ))}

        {!isLoading && players.length > 50 && (
          <Text style={styles.truncatedText}>Showing top 50 of {players.length} players</Text>
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingTop: Spacing.lg,
    marginBottom: Spacing.lg,
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  searchInput: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: FontSize.md,
    padding: 0,
  },
  segmentRow: {
    marginBottom: Spacing.lg,
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
  truncatedText: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    textAlign: 'center',
    paddingVertical: Spacing.lg,
  },
});
