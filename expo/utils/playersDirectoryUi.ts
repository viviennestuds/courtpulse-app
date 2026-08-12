import type { PlayerDirectoryEntry, PlayersPhaseAvailability } from '@/types/playersDirectory';

export const PLAYERS_DEFAULT_SEASON = '2025-26';
export const PLAYERS_DIRECTORY_SEASONS = ['2025-26', '2024-25'] as const;

export type PlayersDirectorySortMetric = 'PTS' | 'REB' | 'AST' | 'TS%' | 'MIN' | 'NET';

export interface PlayersTeamFilterOption {
  key: string;
  teamId: number | string | null;
  abbreviation: string;
  name: string;
}

export interface PlayersDirectoryTransformOptions {
  searchQuery: string;
  teamKey: string | null;
  minimumGames: number | null;
  sortMetric: PlayersDirectorySortMetric;
}

export interface PlayersPostseasonControlState {
  isVisible: boolean;
  isDisabled: boolean;
  accessibilityHint: string;
}

export const PLAYERS_SORT_OPTIONS: readonly PlayersDirectorySortMetric[] = ['PTS', 'REB', 'AST', 'TS%', 'MIN', 'NET'];

export function getPlayerTeamKey(player: PlayerDirectoryEntry): string | null {
  const { teamId, abbreviation } = player.identity.team;
  if (teamId !== null) return `id:${String(teamId)}`;
  const normalizedAbbreviation = abbreviation?.trim().toUpperCase() ?? '';
  return normalizedAbbreviation ? `abbr:${normalizedAbbreviation}` : null;
}

/** Derives canonical displayed-team filter options without inferring historical stints. */
export function derivePlayersTeamOptions(players: PlayerDirectoryEntry[]): PlayersTeamFilterOption[] {
  const options = new Map<string, PlayersTeamFilterOption>();
  players.forEach((player) => {
    const key = getPlayerTeamKey(player);
    const abbreviation = player.identity.team.abbreviation?.trim().toUpperCase() ?? '';
    if (!key || !abbreviation || options.has(key)) return;
    const name = player.identity.team.name?.trim() || abbreviation;
    options.set(key, { key, teamId: player.identity.team.teamId, abbreviation, name });
  });
  return [...options.values()].sort((left, right) =>
    left.name.localeCompare(right.name) || left.abbreviation.localeCompare(right.abbreviation)
  );
}

export function getPlayersSortValue(player: PlayerDirectoryEntry, metric: PlayersDirectorySortMetric): number | null {
  switch (metric) {
    case 'PTS':
      return player.base.pointsPerGame;
    case 'REB':
      return player.base.reboundsPerGame;
    case 'AST':
      return player.base.assistsPerGame;
    case 'TS%':
      return player.advanced.trueShootingPct;
    case 'MIN':
      return player.base.minutesPerGame;
    case 'NET':
      return player.advanced.netRating;
  }
}

/** Applies all directory interactions locally and never mutates the repository snapshot. */
export function transformPlayersDirectory(
  players: PlayerDirectoryEntry[],
  options: PlayersDirectoryTransformOptions,
): PlayerDirectoryEntry[] {
  const query = options.searchQuery.trim().toLocaleLowerCase();
  const filtered = players.filter((player) => {
    if (query) {
      const searchable = [
        player.identity.fullName,
        player.identity.nickname ?? '',
        player.identity.team.abbreviation ?? '',
      ].join(' ').toLocaleLowerCase();
      if (!searchable.includes(query)) return false;
    }
    if (options.teamKey !== null && getPlayerTeamKey(player) !== options.teamKey) return false;
    if (options.minimumGames !== null) {
      const gamesPlayed = player.base.gamesPlayed;
      if (gamesPlayed === null || gamesPlayed < options.minimumGames) return false;
    }
    return true;
  });

  return [...filtered].sort((left, right) => {
    const leftValue = getPlayersSortValue(left, options.sortMetric);
    const rightValue = getPlayersSortValue(right, options.sortMetric);
    if (leftValue === null && rightValue !== null) return 1;
    if (leftValue !== null && rightValue === null) return -1;
    if (leftValue !== null && rightValue !== null && leftValue !== rightValue) return rightValue - leftValue;
    return left.identity.fullName.localeCompare(right.identity.fullName);
  });
}

/** Preserves unknown probe semantics while disabling only confirmed-empty postseason data. */
export function getPostseasonControlState(
  availability: PlayersPhaseAvailability | null,
): PlayersPostseasonControlState {
  if (availability?.supported === false && availability.status === 'unsupported') {
    return {
      isVisible: false,
      isDisabled: true,
      accessibilityHint: 'Postseason is not supported for this season.',
    };
  }
  const isConfirmedEmpty = availability?.available === false
    && availability.status === 'empty'
    && availability.noDataConfirmed === true;
  return {
    isVisible: true,
    isDisabled: isConfirmedEmpty,
    accessibilityHint: isConfirmedEmpty
      ? 'Postseason player data is not available for this season yet.'
      : 'Show postseason players.',
  };
}

export function formatDirectoryDecimal(value: number | null): string {
  return value === null ? '—' : value.toFixed(1);
}

export function formatDirectoryPercent(value: number | null): string {
  return value === null ? '—' : `${(value * 100).toFixed(1)}%`;
}

export function formatDirectoryNet(value: number | null): string {
  if (value === null) return '—';
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}`;
}
