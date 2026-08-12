export type NbaSeasonId = string;

export interface NbaSeasonOption {
  id: NbaSeasonId;
  label: string;
}

export interface NbaSeasonCatalog {
  latestSupportedDataSeason: NbaSeasonId;
  seasons: readonly NbaSeasonOption[];
}

const NBA_SEASON_ID_PATTERN = /^(\d{4})-(\d{2})$/;
const VALIDATED_DIRECTORY_SEASON_IDS = [
  '2025-26',
  '2024-25',
  '2023-24',
  '2022-23',
  '2021-22',
] as const;

/** Returns whether a value follows CourtPulse's consecutive `YYYY-YY` NBA season format. */
export function isValidNbaSeasonId(value: string): boolean {
  const match = NBA_SEASON_ID_PATTERN.exec(value);
  if (!match) return false;
  const startYear = Number(match[1]);
  const endYear = Number(match[2]);
  return Number.isInteger(startYear) && endYear === (startYear + 1) % 100;
}

/** Returns the four-digit starting year for a valid NBA season ID. */
export function getNbaSeasonStartYear(season: NbaSeasonId): number | null {
  if (!isValidNbaSeasonId(season)) return null;
  return Number(season.slice(0, 4));
}

/** Compares NBA season IDs chronologically by starting year. */
export function compareNbaSeasons(left: NbaSeasonId, right: NbaSeasonId): number {
  const leftYear = getNbaSeasonStartYear(left) ?? Number.MIN_SAFE_INTEGER;
  const rightYear = getNbaSeasonStartYear(right) ?? Number.MIN_SAFE_INTEGER;
  return leftYear - rightYear || left.localeCompare(right);
}

/** Returns a new season-option array ordered newest first. */
export function sortNbaSeasonsNewestFirst<T extends NbaSeasonOption>(seasons: readonly T[]): T[] {
  return [...seasons].sort((left, right) => compareNbaSeasons(right.id, left.id));
}

function createNbaSeasonCatalog(
  latestSupportedDataSeason: NbaSeasonId,
  seasonIds: readonly string[],
): NbaSeasonCatalog {
  const uniqueSeasonIds = [...new Set(seasonIds.filter(isValidNbaSeasonId))];
  const seasons = sortNbaSeasonsNewestFirst(
    uniqueSeasonIds.map((id) => ({ id, label: id })),
  );
  if (!isValidNbaSeasonId(latestSupportedDataSeason)
    || !seasons.some((season) => season.id === latestSupportedDataSeason)) {
    throw new Error('Invalid NBA supported-data season catalog');
  }
  return Object.freeze({
    latestSupportedDataSeason,
    seasons: Object.freeze(seasons),
  });
}

/** Validated CourtPulse data-season catalog, independent of calendar-implied season labels. */
export const NBA_SEASON_CATALOG: NbaSeasonCatalog = createNbaSeasonCatalog(
  '2025-26',
  VALIDATED_DIRECTORY_SEASON_IDS,
);

export const NBA_LATEST_SUPPORTED_DATA_SEASON: NbaSeasonId = NBA_SEASON_CATALOG.latestSupportedDataSeason;
export const NBA_SUPPORTED_DATA_SEASONS: readonly NbaSeasonOption[] = NBA_SEASON_CATALOG.seasons;

/** Returns whether a season is present in the validated production data catalog. */
export function isSupportedNbaDataSeasonId(value: string): boolean {
  return NBA_SUPPORTED_DATA_SEASONS.some((season) => season.id === value);
}
