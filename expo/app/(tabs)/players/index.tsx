import React from 'react';
import LegacyPlayersScreen from '@/components/LegacyPlayersScreen';
import PlayersDirectoryScreen from '@/components/PlayersDirectoryScreen';
import { useFeatureFlag } from '@/hooks/useFeatureFlag';

/** Rollback-safe Players tab boundary; only the active implementation mounts and fetches. */
export default function PlayersScreen() {
  const isDirectoryEnabled = useFeatureFlag('players_directory_v1_enabled');
  return isDirectoryEnabled ? <PlayersDirectoryScreen /> : <LegacyPlayersScreen />;
}
