import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchPlayersDirectory, fetchPlayersPhaseAvailability } from './nbaStats';
import { getPlayersDirectoryCacheKey, isValidPlayerDirectorySnapshot } from './playersDirectoryValidation';
import type {
  PlayerDirectorySnapshot,
  PlayersDirectoryCacheDiagnostic,
  PlayersDirectoryCacheManifestEntry,
  PlayersDirectoryCacheSource,
  PlayersDirectoryFreshness,
  PlayersDirectoryRepositoryError,
  PlayersDirectoryRepositoryResult,
  PlayersPhaseAvailabilityResponse,
  PlayersSeasonPhase,
} from '@/types/playersDirectory';

const MANIFEST_STORAGE_KEY = '@courtpulse/players-directory/manifest:v1';
const SNAPSHOT_STORAGE_PREFIX = '@courtpulse/players-directory/snapshot:';

export interface PlayersDirectoryStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export interface PlayersDirectoryRequest {
  season: string;
  phase: PlayersSeasonPhase;
  forceRefresh?: boolean;
}

export interface PlayersDirectoryRepositoryDependencies {
  storage?: PlayersDirectoryStorage;
  fetchDirectory?: (season: string, phase: PlayersSeasonPhase) => Promise<PlayerDirectorySnapshot>;
  fetchPhaseAvailability?: (season: string) => Promise<PlayersPhaseAvailabilityResponse>;
  now?: () => number;
}

interface PersistedDirectoryEntry {
  snapshot: PlayerDirectorySnapshot;
  metadata: PlayersDirectoryCacheManifestEntry;
}

interface MemoryDirectoryEntry extends PersistedDirectoryEntry {}

interface PlayersDirectoryCacheManifest {
  version: 1;
  entries: PlayersDirectoryCacheManifestEntry[];
}

type RepositoryListener = (result: PlayersDirectoryRepositoryResult) => void;

function snapshotStorageKey(key: string): string {
  return `${SNAPSHOT_STORAGE_PREFIX}${key}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isManifestEntry(value: unknown): value is PlayersDirectoryCacheManifestEntry {
  if (!isRecord(value)) return false;
  return typeof value.key === 'string'
    && typeof value.schemaVersion === 'string'
    && typeof value.season === 'string'
    && (value.phase === 'regular' || value.phase === 'postseason')
    && (typeof value.fetchedAt === 'string' || value.fetchedAt === null)
    && typeof value.storedAt === 'string'
    && typeof value.lastAccessedAt === 'string'
    && typeof value.dataAvailable === 'boolean'
    && typeof value.playerCount === 'number';
}

function createRepositoryError(error: unknown, now: number): PlayersDirectoryRepositoryError {
  const rawMessage = error instanceof Error ? error.message : String(error);
  const invalidResponse = /invalid|schema|payload|identity/i.test(rawMessage);
  return {
    code: invalidResponse ? 'invalidResponse' : 'network',
    message: invalidResponse ? 'The Players service returned an incompatible response.' : 'Player directory data is temporarily unavailable.',
    retryable: true,
    occurredAt: new Date(now).toISOString(),
  };
}

/**
 * Owns Players directory network, memory, persistence, freshness, SWR, and
 * request deduplication. UI consumers should use the keyed hook instead.
 */
export class PlayersRepository {
  private readonly storage: PlayersDirectoryStorage;
  private readonly fetchDirectory: (season: string, phase: PlayersSeasonPhase) => Promise<PlayerDirectorySnapshot>;
  private readonly fetchAvailability: (season: string) => Promise<PlayersPhaseAvailabilityResponse>;
  private readonly now: () => number;
  private readonly memory = new Map<string, MemoryDirectoryEntry>();
  private readonly inFlight = new Map<string, Promise<PlayerDirectorySnapshot>>();
  private readonly availabilityInFlight = new Map<string, Promise<PlayersPhaseAvailabilityResponse>>();
  private readonly persistentLoads = new Map<string, Promise<MemoryDirectoryEntry | null>>();
  private readonly listeners = new Map<string, Set<RepositoryListener>>();
  private readonly states = new Map<string, PlayersDirectoryRepositoryResult>();
  private manifestEntries: PlayersDirectoryCacheManifestEntry[] | null = null;
  private manifestQueue: Promise<void> = Promise.resolve();
  private cacheGeneration = 0;

  constructor(dependencies: PlayersDirectoryRepositoryDependencies = {}) {
    this.storage = dependencies.storage ?? AsyncStorage;
    this.fetchDirectory = dependencies.fetchDirectory ?? fetchPlayersDirectory;
    this.fetchAvailability = dependencies.fetchPhaseAvailability ?? fetchPlayersPhaseAvailability;
    this.now = dependencies.now ?? Date.now;
  }

  /** Returns cached data immediately when possible and starts SWR for stale entries. */
  async getDirectory(request: PlayersDirectoryRequest): Promise<PlayersDirectoryRepositoryResult> {
    const key = getPlayersDirectoryCacheKey(request.season, request.phase);
    const memoryEntry = this.memory.get(key) ?? null;

    if (request.forceRefresh) {
      if (memoryEntry) {
        return this.refreshAndResolve(key, request.season, request.phase, memoryEntry, 'memory');
      }
      const persistentEntry = await this.loadPersistent(request.season, request.phase);
      return this.refreshAndResolve(key, request.season, request.phase, persistentEntry, persistentEntry ? 'persistent' : null);
    }

    if (memoryEntry) {
      this.touchMemoryEntry(memoryEntry);
      return this.resolveCachedEntry(key, memoryEntry, 'memory');
    }

    const persistentEntry = await this.loadPersistent(request.season, request.phase);
    if (persistentEntry) {
      return this.resolveCachedEntry(key, persistentEntry, 'persistent');
    }

    return this.refreshAndResolve(key, request.season, request.phase, null, null);
  }

  /** Lightweight, demand-driven availability request with in-flight deduplication. */
  getPhaseAvailability(season: string): Promise<PlayersPhaseAvailabilityResponse> {
    const existing = this.availabilityInFlight.get(season);
    if (existing) return existing;
    const request = this.fetchAvailability(season).finally(() => {
      if (this.availabilityInFlight.get(season) === request) {
        this.availabilityInFlight.delete(season);
      }
    });
    this.availabilityInFlight.set(season, request);
    return request;
  }

  /** Subscribes to SWR completion for one exact season/phase identity. */
  subscribe(season: string, phase: PlayersSeasonPhase, listener: RepositoryListener): () => void {
    const key = getPlayersDirectoryCacheKey(season, phase);
    const listeners = this.listeners.get(key) ?? new Set<RepositoryListener>();
    listeners.add(listener);
    this.listeners.set(key, listeners);
    const current = this.states.get(key);
    if (current) listener(current);
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) this.listeners.delete(key);
    };
  }

  /** Returns the latest state for one exact identity, primarily for hook race closure. */
  getCurrentResult(season: string, phase: PlayersSeasonPhase): PlayersDirectoryRepositoryResult | null {
    return this.states.get(getPlayersDirectoryCacheKey(season, phase)) ?? null;
  }

  /** Development/test diagnostics without exposing cache internals to production UI. */
  async getCacheDiagnostics(): Promise<PlayersDirectoryCacheDiagnostic[]> {
    const manifest = await this.loadManifest();
    return manifest.map((entry) => {
      const memoryEntry = this.memory.get(entry.key);
      const state = this.states.get(entry.key);
      return {
        ...entry,
        cacheSource: memoryEntry ? 'memory' : state?.cacheSource ?? 'manifest',
        freshness: memoryEntry ? this.getFreshness(memoryEntry) : state?.freshness ?? 'unknown',
        isRefreshing: state?.isRefreshing ?? this.inFlight.has(entry.key),
        lastRefreshError: state?.refreshError ?? null,
      };
    });
  }

  /** Clears one snapshot or all persisted Players directory snapshots. */
  async clearDirectoryCache(request?: { season: string; phase: PlayersSeasonPhase }): Promise<void> {
    this.cacheGeneration += 1;
    const manifest = await this.loadManifest();
    const keys = request
      ? [getPlayersDirectoryCacheKey(request.season, request.phase)]
      : manifest.map((entry) => entry.key);

    keys.forEach((key) => {
      this.memory.delete(key);
      this.states.delete(key);
      this.persistentLoads.delete(key);
    });
    await Promise.all(keys.map((key) => this.storage.removeItem(snapshotStorageKey(key)).catch(() => undefined)));
    await this.updateManifest((entries) => request ? entries.filter((entry) => !keys.includes(entry.key)) : []);
  }

  /** Test helper that clears process memory while leaving persisted snapshots intact. */
  clearMemoryCache(): void {
    this.memory.clear();
    this.states.clear();
    this.persistentLoads.clear();
  }

  private resolveCachedEntry(
    key: string,
    entry: MemoryDirectoryEntry,
    source: Exclude<PlayersDirectoryCacheSource, 'network' | null>,
  ): PlayersDirectoryRepositoryResult {
    const freshness = this.getFreshness(entry);
    if (freshness === 'stale') {
      return this.startBackgroundRefresh(key, entry, source);
    }
    const result = this.result(entry.snapshot, source, freshness, false, null, null);
    this.setState(key, result);
    return result;
  }

  private startBackgroundRefresh(
    key: string,
    entry: MemoryDirectoryEntry,
    source: Exclude<PlayersDirectoryCacheSource, 'network' | null>,
  ): PlayersDirectoryRepositoryResult {
    const staleResult = this.result(entry.snapshot, source, 'stale', true, null, null);
    this.setState(key, staleResult);
    void this.requestNetwork(entry.snapshot.season, entry.snapshot.phase)
      .then((snapshot) => {
        const freshResult = this.result(snapshot, 'network', 'fresh', false, null, null);
        this.setState(key, freshResult);
      })
      .catch((error: unknown) => {
        const refreshError = createRepositoryError(error, this.now());
        const retained = this.result(entry.snapshot, source, 'stale', false, null, refreshError);
        this.setState(key, retained);
      });
    return staleResult;
  }

  private async refreshAndResolve(
    key: string,
    season: string,
    phase: PlayersSeasonPhase,
    fallbackEntry: MemoryDirectoryEntry | null,
    fallbackSource: Exclude<PlayersDirectoryCacheSource, 'network'>,
  ): Promise<PlayersDirectoryRepositoryResult> {
    if (fallbackEntry && fallbackSource) {
      this.setState(key, this.result(fallbackEntry.snapshot, fallbackSource, this.getFreshness(fallbackEntry), true, null, null));
    }
    try {
      const snapshot = await this.requestNetwork(season, phase);
      const result = this.result(snapshot, 'network', 'fresh', false, null, null);
      this.setState(key, result);
      return result;
    } catch (error) {
      const repositoryError = createRepositoryError(error, this.now());
      if (fallbackEntry && fallbackSource) {
        const result = this.result(fallbackEntry.snapshot, fallbackSource, this.getFreshness(fallbackEntry), false, null, repositoryError);
        this.setState(key, result);
        return result;
      }
      const result = this.result(null, null, 'unknown', false, repositoryError, null);
      this.setState(key, result);
      return result;
    }
  }

  private requestNetwork(season: string, phase: PlayersSeasonPhase): Promise<PlayerDirectorySnapshot> {
    const key = getPlayersDirectoryCacheKey(season, phase);
    const existing = this.inFlight.get(key);
    if (existing) return existing;
    const generation = this.cacheGeneration;
    const request = this.fetchDirectory(season, phase)
      .then(async (snapshot) => {
        if (!isValidPlayerDirectorySnapshot(snapshot, season, phase)) {
          throw new Error(`Invalid players directory identity for ${season} ${phase}`);
        }
        if (generation !== this.cacheGeneration) {
          throw new Error('Players directory request invalidated by cache clear');
        }
        await this.storeSnapshot(snapshot);
        return snapshot;
      })
      .finally(() => {
        if (this.inFlight.get(key) === request) this.inFlight.delete(key);
      });
    this.inFlight.set(key, request);
    return request;
  }

  private async storeSnapshot(snapshot: PlayerDirectorySnapshot): Promise<void> {
    const nowIso = new Date(this.now()).toISOString();
    const key = snapshot.cachePolicy.key;
    const metadata: PlayersDirectoryCacheManifestEntry = {
      key,
      schemaVersion: snapshot.schemaVersion,
      season: snapshot.season,
      phase: snapshot.phase,
      fetchedAt: snapshot.fetchedAt,
      storedAt: nowIso,
      lastAccessedAt: nowIso,
      dataAvailable: snapshot.dataAvailable,
      playerCount: snapshot.players.length,
    };
    const entry: MemoryDirectoryEntry = { snapshot, metadata };
    this.memory.set(key, entry);
    try {
      await this.storage.setItem(snapshotStorageKey(key), JSON.stringify(entry));
      await this.updateManifest((entries) => [metadata, ...entries.filter((item) => item.key !== key)]);
    } catch (error) {
      console.warn('[PlayersRepository] Unable to persist validated snapshot', error instanceof Error ? error.message : 'storage error');
    }
  }

  private loadPersistent(season: string, phase: PlayersSeasonPhase): Promise<MemoryDirectoryEntry | null> {
    const key = getPlayersDirectoryCacheKey(season, phase);
    const existing = this.persistentLoads.get(key);
    if (existing) return existing;
    const request = this.readPersistent(key, season, phase).finally(() => {
      if (this.persistentLoads.get(key) === request) this.persistentLoads.delete(key);
    });
    this.persistentLoads.set(key, request);
    return request;
  }

  private async readPersistent(key: string, season: string, phase: PlayersSeasonPhase): Promise<MemoryDirectoryEntry | null> {
    try {
      const raw = await this.storage.getItem(snapshotStorageKey(key));
      if (!raw) return null;
      const parsed = JSON.parse(raw) as unknown;
      if (!isRecord(parsed) || !isRecord(parsed.metadata) || !isManifestEntry(parsed.metadata)
        || parsed.metadata.key !== key || parsed.metadata.season !== season || parsed.metadata.phase !== phase
        || !isValidPlayerDirectorySnapshot(parsed.snapshot, season, phase)) {
        await this.discardPersistent(key);
        return null;
      }
      const nowIso = new Date(this.now()).toISOString();
      const entry: MemoryDirectoryEntry = {
        snapshot: parsed.snapshot,
        metadata: { ...parsed.metadata, lastAccessedAt: nowIso },
      };
      this.memory.set(key, entry);
      try {
        await Promise.all([
          this.storage.setItem(snapshotStorageKey(key), JSON.stringify(entry)),
          this.updateManifest((entries) => [entry.metadata, ...entries.filter((item) => item.key !== key)]),
        ]);
      } catch (error) {
        console.warn('[PlayersRepository] Unable to update cache access metadata', error instanceof Error ? error.message : 'storage error');
      }
      return entry;
    } catch (error) {
      console.warn('[PlayersRepository] Discarding unreadable persisted snapshot', error instanceof Error ? error.message : 'storage error');
      await this.discardPersistent(key);
      return null;
    }
  }

  private touchMemoryEntry(entry: MemoryDirectoryEntry): void {
    const metadata = { ...entry.metadata, lastAccessedAt: new Date(this.now()).toISOString() };
    entry.metadata = metadata;
    void this.updateManifest((entries) => [metadata, ...entries.filter((item) => item.key !== metadata.key)])
      .catch(() => undefined);
  }

  private getFreshness(entry: MemoryDirectoryEntry): PlayersDirectoryFreshness {
    const staleAfterSeconds = entry.snapshot.cachePolicy.freshness.staleAfterSeconds;
    if (staleAfterSeconds === null) return 'fresh';
    const fetchedAtMs = entry.snapshot.fetchedAt ? Date.parse(entry.snapshot.fetchedAt) : Number.NaN;
    const storedAtMs = Date.parse(entry.metadata.storedAt);
    const baseline = Number.isFinite(fetchedAtMs) ? fetchedAtMs : storedAtMs;
    if (!Number.isFinite(baseline)) return 'unknown';
    return this.now() - baseline >= staleAfterSeconds * 1000 ? 'stale' : 'fresh';
  }

  private result(
    snapshot: PlayerDirectorySnapshot | null,
    cacheSource: PlayersDirectoryCacheSource,
    freshness: PlayersDirectoryFreshness,
    isRefreshing: boolean,
    error: PlayersDirectoryRepositoryError | null,
    refreshError: PlayersDirectoryRepositoryError | null,
  ): PlayersDirectoryRepositoryResult {
    return { snapshot, cacheSource, freshness, isLoading: false, isRefreshing, error, refreshError };
  }

  private setState(key: string, result: PlayersDirectoryRepositoryResult): void {
    this.states.set(key, result);
    this.listeners.get(key)?.forEach((listener) => listener(result));
  }

  private async discardPersistent(key: string): Promise<void> {
    this.memory.delete(key);
    await this.storage.removeItem(snapshotStorageKey(key)).catch(() => undefined);
    await this.updateManifest((entries) => entries.filter((entry) => entry.key !== key));
  }

  private async loadManifest(): Promise<PlayersDirectoryCacheManifestEntry[]> {
    if (this.manifestEntries) return [...this.manifestEntries];
    try {
      const raw = await this.storage.getItem(MANIFEST_STORAGE_KEY);
      if (!raw) {
        this.manifestEntries = [];
        return [];
      }
      const parsed = JSON.parse(raw) as unknown;
      if (!isRecord(parsed) || parsed.version !== 1 || !Array.isArray(parsed.entries)) {
        throw new Error('invalid manifest');
      }
      this.manifestEntries = parsed.entries.filter(isManifestEntry);
      return [...this.manifestEntries];
    } catch {
      this.manifestEntries = [];
      await this.storage.removeItem(MANIFEST_STORAGE_KEY).catch(() => undefined);
      return [];
    }
  }

  private updateManifest(
    update: (entries: PlayersDirectoryCacheManifestEntry[]) => PlayersDirectoryCacheManifestEntry[],
  ): Promise<void> {
    const operation = this.manifestQueue.then(async () => {
      const current = await this.loadManifest();
      const next = update(current);
      const manifest: PlayersDirectoryCacheManifest = { version: 1, entries: next };
      await this.storage.setItem(MANIFEST_STORAGE_KEY, JSON.stringify(manifest));
      this.manifestEntries = next;
    });
    this.manifestQueue = operation.catch(() => undefined);
    return operation;
  }
}

export const playersRepository = new PlayersRepository();
