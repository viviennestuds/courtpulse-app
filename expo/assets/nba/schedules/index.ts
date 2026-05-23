/**
 * Local bundled NBA historical schedule registry.
 *
 * Why this exists:
 * - The current-season schedule comes reliably from the public NBA CDN
 *   (https://cdn.nba.com/static/json/staticData/scheduleLeagueV2.json).
 * - For prior NBA seasons, stats.nba.com endpoints (e.g. scheduleleaguev2 with
 *   a Season param) are unreliable from client / proxy environments and
 *   often fail or return empty payloads.
 * - To make historical date browsing deterministic we ship season-specific
 *   schedule files locally and load them via require() so they are bundled.
 *
 * How to add a new historical season (e.g. 2024-25):
 *   1. Download from a trusted source. The expected JSON shape mirrors
 *      scheduleLeagueV2.json:
 *        {
 *          "leagueSchedule": {
 *            "seasonYear": "2024-25",
 *            "gameDates": [
 *              { "gameDate": "12/25/2024 00:00:00", "games": [ ... ] },
 *              ...
 *            ]
 *          }
 *        }
 *   2. Save it to: expo/assets/nba/schedules/2024-25/scheduleLeagueV2.json
 *   3. Register it below by uncommenting / adding the matching entry.
 *
 * Until a season file is registered, historical lookups for that season will
 * fall through to optional stats.nba.com fetches (best-effort) and will be
 * marked as fallback / unavailable in the UI rather than misleading users
 * with "Live Data".
 */

type LocalSchedule = unknown;

const LOCAL_SCHEDULES: Record<string, LocalSchedule> = {
  // Example (uncomment after adding the JSON file):
  // '2024-25': require('./2024-25/scheduleLeagueV2.json'),
  // '2023-24': require('./2023-24/scheduleLeagueV2.json'),
};

export function loadLocalSeasonSchedule(season: string): LocalSchedule | null {
  if (!season) return null;
  const entry = LOCAL_SCHEDULES[season];
  return entry ?? null;
}

export function hasLocalSeasonSchedule(season: string): boolean {
  return !!season && season in LOCAL_SCHEDULES;
}

export function listLocalSeasons(): string[] {
  return Object.keys(LOCAL_SCHEDULES);
}
