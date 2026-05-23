import React, { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { Snapshot, ChangeEntry } from '@/constants/versionManifest';
import { FLAG_RENAME_MAP } from '@/constants/featureFlags';
import { useFeatureFlags } from './FeatureFlagsProvider';

const SNAPSHOTS_KEY = '@nba_snapshots';
const CHANGELOG_KEY = '@nba_changelog';

export const [SnapshotProvider, useSnapshots] = createContextHook(() => {
  const { resolved, channel, overrides, replaceOverrides, setChannel } = useFeatureFlags();
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [changelog, setChangelog] = useState<ChangeEntry[]>([]);
  const [loaded, setLoaded] = useState<boolean>(false);

  useEffect(() => {
    (async () => {
      try {
        const [storedSnaps, storedLog] = await Promise.all([
          AsyncStorage.getItem(SNAPSHOTS_KEY),
          AsyncStorage.getItem(CHANGELOG_KEY),
        ]);
        if (storedSnaps) setSnapshots(JSON.parse(storedSnaps));
        if (storedLog) setChangelog(JSON.parse(storedLog));
      } catch (err) {
        console.warn('[Snapshots] Failed to load', err);
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  const persistSnapshots = useCallback(async (next: Snapshot[]) => {
    setSnapshots(next);
    try {
      await AsyncStorage.setItem(SNAPSHOTS_KEY, JSON.stringify(next));
    } catch (err) {
      console.warn('[Snapshots] Failed to persist snapshots', err);
    }
  }, []);

  const persistChangelog = useCallback(async (next: ChangeEntry[]) => {
    setChangelog(next);
    try {
      await AsyncStorage.setItem(CHANGELOG_KEY, JSON.stringify(next));
    } catch (err) {
      console.warn('[Snapshots] Failed to persist changelog', err);
    }
  }, []);

  const createSnapshot = useCallback(
    async (name: string, description: string, components?: string[]) => {
      const snap: Snapshot = {
        id: `snap_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        name,
        timestamp: Date.now(),
        channel,
        flagState: { ...resolved },
        flagOverrides: { ...overrides },
        components: components ?? [],
        description,
      };
      console.log(`[Snapshots] Creating snapshot: ${name}`);
      const next = [snap, ...snapshots];
      await persistSnapshots(next);
      return snap;
    },
    [snapshots, channel, resolved, overrides, persistSnapshots]
  );

  const restoreSnapshot = useCallback(
    async (snapshotId: string): Promise<Snapshot | null> => {
      const snap = snapshots.find(s => s.id === snapshotId);
      if (!snap) {
        console.warn(`[Snapshots] Snapshot not found: ${snapshotId}`);
        return null;
      }

      console.log(`[Snapshots] Restoring snapshot: ${snap.name}`);
      console.log(`[Snapshots] Restoring overrides:`, snap.flagOverrides ?? {});
      console.log(`[Snapshots] Restoring channel:`, snap.channel);

      const rawOverrides = snap.flagOverrides ?? {};
      const restoredOverrides: Record<string, boolean> = {};
      for (const [key, value] of Object.entries(rawOverrides)) {
        const newKey = FLAG_RENAME_MAP[key];
        if (newKey) {
          console.log(`[Snapshots] Migrating snapshot flag: "${key}" → "${newKey}"`);
          restoredOverrides[newKey] = value;
        } else {
          restoredOverrides[key] = value;
        }
      }
      await replaceOverrides(restoredOverrides);
      await setChannel(snap.channel);

      const entry: ChangeEntry = {
        timestamp: Date.now(),
        snapshotBefore: snapshots[0]?.id ?? null,
        snapshotAfter: snapshotId,
        filesModified: snap.components,
        summary: `Restored to snapshot "${snap.name}"`,
      };
      await persistChangelog([entry, ...changelog]);

      return snap;
    },
    [snapshots, changelog, persistChangelog, replaceOverrides, setChannel]
  );

  const deleteSnapshot = useCallback(
    async (snapshotId: string) => {
      const next = snapshots.filter(s => s.id !== snapshotId);
      await persistSnapshots(next);
    },
    [snapshots, persistSnapshots]
  );

  const logChange = useCallback(
    async (filesModified: string[], summary: string) => {
      const entry: ChangeEntry = {
        timestamp: Date.now(),
        snapshotBefore: snapshots[0]?.id ?? null,
        snapshotAfter: null,
        filesModified,
        summary,
      };
      await persistChangelog([entry, ...changelog.slice(0, 49)]);
    },
    [snapshots, changelog, persistChangelog]
  );

  const diffBetween = useCallback(
    (snapA: string, snapB: string): { added: string[]; removed: string[]; shared: string[] } | null => {
      const a = snapshots.find(s => s.id === snapA);
      const b = snapshots.find(s => s.id === snapB);
      if (!a || !b) return null;

      const setA = new Set(a.components);
      const setB = new Set(b.components);
      const added = [...setB].filter(c => !setA.has(c));
      const removed = [...setA].filter(c => !setB.has(c));
      const shared = [...setA].filter(c => setB.has(c));

      return { added, removed, shared };
    },
    [snapshots]
  );

  const flagDiffBetween = useCallback(
    (snapA: string, snapB: string): { key: string; before: boolean; after: boolean }[] | null => {
      const a = snapshots.find(s => s.id === snapA);
      const b = snapshots.find(s => s.id === snapB);
      if (!a || !b) return null;

      const allKeys = new Set([...Object.keys(a.flagState), ...Object.keys(b.flagState)]);
      const diffs: { key: string; before: boolean; after: boolean }[] = [];
      for (const key of allKeys) {
        const before = a.flagState[key] ?? false;
        const after = b.flagState[key] ?? false;
        if (before !== after) {
          diffs.push({ key, before, after });
        }
      }
      return diffs;
    },
    [snapshots]
  );

  return {
    snapshots,
    changelog,
    loaded,
    createSnapshot,
    restoreSnapshot,
    deleteSnapshot,
    logChange,
    diffBetween,
    flagDiffBetween,
  };
});
