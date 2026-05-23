export interface Snapshot {
  id: string;
  name: string;
  timestamp: number;
  channel: 'stable' | 'experimental';
  flagState: Record<string, boolean>;
  flagOverrides: Record<string, boolean>;
  components: string[];
  description: string;
}

export interface ChangeEntry {
  timestamp: number;
  snapshotBefore: string | null;
  snapshotAfter: string | null;
  filesModified: string[];
  summary: string;
}

export const APP_VERSION = {
  major: 1,
  minor: 2,
  patch: 0,
  label: 'MVP',
  buildDate: '2026-04-09',
} as const;

export const APP_COMPONENTS = [
  'app/(tabs)/(games)/index.tsx',
  'app/(tabs)/lab/index.tsx',
  'app/(tabs)/players/index.tsx',
  'app/(tabs)/teams/index.tsx',
  'app/game/[id].tsx',
  'app/player/[id].tsx',
  'app/team/[id].tsx',
  'components/DataSourceBadge.tsx',
  'components/FeaturedRunCard.tsx',
  'components/FilterChip.tsx',
  'components/GameCard.tsx',
  'components/MatchupTab.tsx',
  'components/MetricCard.tsx',
  'components/PlayByPlayItem.tsx',
  'components/PlayerCard.tsx',
  'components/ScoringRunCard.tsx',
  'components/SegmentControl.tsx',
  'components/ShotChart.tsx',
  'components/StatBar.tsx',
  'components/SubTabBar.tsx',
  'services/analyticsEngine.ts',
  'services/dataProvider.ts',
  'services/nbaApi.ts',
  'services/nbaGameData.ts',
  'services/nbaScoreboard.ts',
  'services/nbaStats.ts',
  'hooks/useNbaData.ts',
  'mocks/analytics.ts',
  'mocks/games.ts',
  'mocks/matchups.ts',
  'mocks/playbyplay.ts',
  'mocks/players.ts',
  'mocks/shots.ts',
  'mocks/teams.ts',
] as const;

export function versionString(): string {
  return `${APP_VERSION.major}.${APP_VERSION.minor}.${APP_VERSION.patch}-${APP_VERSION.label}`;
}
