import React, { useState, useEffect, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { FEATURE_FLAGS, FeatureFlagDefinition, FLAG_RENAME_MAP } from '@/constants/featureFlags';

const STORAGE_KEY = '@nba_feature_flags';
const CHANNEL_KEY = '@nba_stability_channel';

export type StabilityChannel = 'stable' | 'experimental';

export interface FlagOverrides {
  [key: string]: boolean;
}

function migrateOverrides(overrides: FlagOverrides): { migrated: FlagOverrides; didMigrate: boolean } {
  const migrated: FlagOverrides = {};
  let didMigrate = false;
  for (const [key, value] of Object.entries(overrides)) {
    const newKey = FLAG_RENAME_MAP[key];
    if (newKey) {
      console.log(`[FeatureFlags] Migrating persisted flag: "${key}" → "${newKey}"`);
      migrated[newKey] = value;
      didMigrate = true;
    } else {
      migrated[key] = value;
    }
  }
  return { migrated, didMigrate };
}

function resolveFlags(
  overrides: FlagOverrides,
  channel: StabilityChannel
): Record<string, boolean> {
  const resolved: Record<string, boolean> = {};
  for (const flag of FEATURE_FLAGS) {
    if (flag.key in overrides) {
      resolved[flag.key] = overrides[flag.key];
    } else if (channel === 'stable' && flag.channel === 'experimental') {
      resolved[flag.key] = false;
    } else {
      resolved[flag.key] = flag.defaultEnabled;
    }
  }
  return resolved;
}

export const [FeatureFlagsProvider, useFeatureFlags] = createContextHook(() => {
  const [overrides, setOverrides] = useState<FlagOverrides>({});
  const [channel, setChannelState] = useState<StabilityChannel>('stable');
  const [loaded, setLoaded] = useState<boolean>(false);

  useEffect(() => {
    (async () => {
      try {
        const [storedOverrides, storedChannel] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY),
          AsyncStorage.getItem(CHANNEL_KEY),
        ]);
        if (storedOverrides) {
          const parsed = JSON.parse(storedOverrides) as FlagOverrides;
          const { migrated, didMigrate } = migrateOverrides(parsed);
          setOverrides(migrated);
          if (didMigrate) {
            console.log('[FeatureFlags] Persisting migrated overrides');
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
          }
        }
        if (storedChannel === 'stable' || storedChannel === 'experimental') {
          setChannelState(storedChannel);
        }
      } catch (err) {
        console.warn('[FeatureFlags] Failed to load persisted flags', err);
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  const resolved = useMemo(
    () => resolveFlags(overrides, channel),
    [overrides, channel]
  );

  const isEnabled = useCallback(
    (key: string): boolean => {
      return resolved[key] ?? false;
    },
    [resolved]
  );

  const setFlag = useCallback(
    async (key: string, enabled: boolean) => {
      const next = { ...overrides, [key]: enabled };
      setOverrides(next);
      try {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch (err) {
        console.warn('[FeatureFlags] Failed to persist flag', err);
      }
    },
    [overrides]
  );

  const resetFlag = useCallback(
    async (key: string) => {
      const next = { ...overrides };
      delete next[key];
      setOverrides(next);
      try {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch (err) {
        console.warn('[FeatureFlags] Failed to persist flag reset', err);
      }
    },
    [overrides]
  );

  const resetAllFlags = useCallback(async () => {
    setOverrides({});
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
    } catch (err) {
      console.warn('[FeatureFlags] Failed to clear flags', err);
    }
  }, []);

  const replaceOverrides = useCallback(async (next: FlagOverrides) => {
    setOverrides(next);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      console.log('[FeatureFlags] Bulk replaced overrides', next);
    } catch (err) {
      console.warn('[FeatureFlags] Failed to persist bulk overrides', err);
    }
  }, []);

  const setChannel = useCallback(async (ch: StabilityChannel) => {
    setChannelState(ch);
    try {
      await AsyncStorage.setItem(CHANNEL_KEY, ch);
    } catch (err) {
      console.warn('[FeatureFlags] Failed to persist channel', err);
    }
  }, []);

  const flagDefinitions: FeatureFlagDefinition[] = FEATURE_FLAGS;

  return {
    isEnabled,
    setFlag,
    resetFlag,
    resetAllFlags,
    replaceOverrides,
    channel,
    setChannel,
    overrides,
    resolved,
    flagDefinitions,
    loaded,
  };
});
