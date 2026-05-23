/**
 * NBA GameID-derived season metadata.
 *
 * NBA GameID format: `00X{YY}{NNNNN}` where:
 *   - `X` is the season type digit (1=Pre Season, 2=Regular Season, 4=Playoffs, 5=Play-In)
 *   - `YY` is the season start year (last 2 digits)
 *   - `NNNNN` is the per-season game number
 *
 * Examples:
 *   - `0042500114` → Playoffs, season starting 2025 → `2025-26`, type `Playoffs`
 *   - `0022400001` → Regular Season, season starting 2024 → `2024-25`
 */

export type NbaSeasonType = 'Regular Season' | 'Playoffs' | 'PlayIn' | 'Pre Season';

function seasonTypeDigit(gameId: string): string | null {
  if (!gameId || gameId.length < 5) return null;
  return gameId.charAt(2);
}

export function getSeasonFromGameId(gameId: string): string | undefined {
  if (!gameId || gameId.length < 5) return undefined;
  const yy = gameId.substring(3, 5);
  const yearNum = parseInt(yy, 10);
  if (!Number.isFinite(yearNum)) return undefined;
  const start = yearNum < 50 ? 2000 + yearNum : 1900 + yearNum;
  const next = (start + 1) % 100;
  return `${start}-${next.toString().padStart(2, '0')}`;
}

export function getSeasonTypeFromGameId(gameId: string): NbaSeasonType | undefined {
  const d = seasonTypeDigit(gameId);
  if (d === '2') return 'Regular Season';
  if (d === '4') return 'Playoffs';
  if (d === '5') return 'PlayIn';
  if (d === '1') return 'Pre Season';
  return undefined;
}

export interface MatchupFilmUrlParams {
  gameId: string;
  offensivePlayerId: string;
  defensivePlayerId: string;
  defensiveTeamId: string;
  season?: string;
  seasonType?: NbaSeasonType;
}

/**
 * Builds an NBA.com Stats matchup film URL using the DEF_FGA context.
 *
 *   PlayerID    = defender
 *   OppPlayerID = offensive player
 *   TeamID      = defender's team
 *
 * Reference URL:
 * https://www.nba.com/stats/events?CFID=&CFPARAMS=&ContextMeasure=DEF_FGA&GameID=0042500114&OppPlayerID=1630202&PlayerID=203083&Season=2025-26&SeasonType=Playoffs&TeamID=1610612755&flag=1&sct=plot&section=game
 */
export function buildNbaMatchupFilmUrl(params: MatchupFilmUrlParams): string {
  const { gameId, offensivePlayerId, defensivePlayerId, defensiveTeamId, season, seasonType } = params;
  const qp = new URLSearchParams();
  qp.append('CFID', '');
  qp.append('CFPARAMS', '');
  qp.append('ContextMeasure', 'DEF_FGA');
  qp.append('GameID', gameId);
  qp.append('OppPlayerID', offensivePlayerId);
  qp.append('PlayerID', defensivePlayerId);
  qp.append('TeamID', defensiveTeamId);
  if (season) qp.append('Season', season);
  if (seasonType) qp.append('SeasonType', seasonType);
  qp.append('flag', '1');
  qp.append('sct', 'plot');
  qp.append('section', 'game');
  return `https://www.nba.com/stats/events?${qp.toString()}`;
}
