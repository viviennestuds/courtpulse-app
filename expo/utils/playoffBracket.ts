import { getTeamColor, getTeamInfoByAbbr } from '@/constants/nbaTeams';

export type PlayoffConference = 'East' | 'West';
export type PlayoffGameStatus = 'final' | 'live' | 'scheduled';

interface CatalogTeamShape {
  teamId?: string | number | null;
  teamCity?: string | null;
  teamName?: string | null;
  teamTricode?: string | null;
  score?: string | number | null;
}

interface CatalogArenaShape {
  arenaName?: string | null;
  arenaCity?: string | null;
  arenaState?: string | null;
}

export interface PlayoffCatalogGameShape {
  gameId?: string | null;
  gameCode?: string | null;
  primaryDate?: string | null;
  gameCodeDate?: string | null;
  utcDate?: string | null;
  gameDateUTC?: string | null;
  gameStatus?: string | number | null;
  gameStatusText?: string | null;
  gameClock?: string | null;
  gameTimeUTC?: string | null;
  gameEt?: string | null;
  gameTimeLocal?: string | null;
  seriesGameNumber?: string | null;
  seriesText?: string | null;
  arena?: CatalogArenaShape | null;
  homeTeam?: CatalogTeamShape | null;
  awayTeam?: CatalogTeamShape | null;
}

export interface PlayoffCatalogSeriesShape {
  seriesKey?: string | null;
  latestSeriesText?: string | null;
  latestGameDate?: string | null;
  gameCount?: number | null;
  teams?: {
    homeTeam?: CatalogTeamShape | null;
    awayTeam?: CatalogTeamShape | null;
  } | null;
  games?: PlayoffCatalogGameShape[] | null;
}

export interface PlayoffCatalogLike {
  success?: boolean;
  type?: string;
  source?: string;
  fetchedAt?: string;
  playoffGameCount?: number;
  seriesCount?: number;
  games?: PlayoffCatalogGameShape[];
  series?: PlayoffCatalogSeriesShape[];
}

export interface PlayoffTeamSlot {
  id: string;
  abbreviation: string;
  name: string;
  color: string;
  conference?: PlayoffConference;
  isTbd: boolean;
}

export interface PlayoffSeriesGame {
  id: string;
  gameNumber: string;
  dateLabel: string;
  status: PlayoffGameStatus;
  statusText: string;
  homeTeam: PlayoffTeamSlot;
  awayTeam: PlayoffTeamSlot;
  homeScore?: number;
  awayScore?: number;
  winnerAbbr?: string;
  canOpen: boolean;
}

export interface PlayoffSeries {
  id: string;
  roundOrder: number;
  roundLabel: string;
  conference?: PlayoffConference;
  teamA: PlayoffTeamSlot;
  teamB: PlayoffTeamSlot;
  games: PlayoffSeriesGame[];
  summary: string;
  seriesText?: string;
  winnerAbbr?: string;
  leaderAbbr?: string;
  winsA?: number;
  winsB?: number;
  isComplete: boolean;
  accentColor: string;
}

export interface PlayoffBracketRound {
  id: string;
  label: string;
  order: number;
  conference?: PlayoffConference;
  series: PlayoffSeries[];
}

export interface PlayoffBracket {
  title: string;
  subtitle: string;
  rounds: PlayoffBracketRound[];
  hasConferenceData: boolean;
  seriesCount: number;
  completedGameCount: number;
  liveGameCount: number;
}

interface ParsedSeriesText {
  summary?: string;
  winnerAbbr?: string;
  leaderAbbr?: string;
  winsByAbbr: Record<string, number>;
  isComplete: boolean;
}

function cleanString(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function toNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function normalizeAbbr(value: unknown): string {
  return cleanString(value).toUpperCase();
}

function normalizeTeam(team: CatalogTeamShape | null | undefined): PlayoffTeamSlot {
  const id = cleanString(team?.teamId);
  const rawAbbr = normalizeAbbr(team?.teamTricode);
  const isMissingTeam = !id || id === '0' || !rawAbbr;
  const abbreviation = isMissingTeam ? 'TBD' : rawAbbr;
  const info = getTeamInfoByAbbr(abbreviation);
  const rawName = cleanString(team?.teamName) || cleanString(team?.teamCity);
  const name = isMissingTeam ? rawName || 'TBD' : rawName || info?.name || abbreviation;
  return {
    id: isMissingTeam ? '' : id,
    abbreviation,
    name,
    color: isMissingTeam ? '#64748B' : getTeamColor(abbreviation),
    conference: info?.conference,
    isTbd: isMissingTeam,
  };
}

function isSameTeam(a: PlayoffTeamSlot, b: PlayoffTeamSlot): boolean {
  if (a.isTbd || b.isTbd) return false;
  return (a.id.length > 0 && a.id === b.id) || a.abbreviation === b.abbreviation;
}

function collectSeriesTeams(series: PlayoffCatalogSeriesShape): [PlayoffTeamSlot, PlayoffTeamSlot] {
  const candidates: PlayoffTeamSlot[] = [];
  const add = (team: PlayoffTeamSlot) => {
    if (!team.isTbd && !candidates.some(existing => isSameTeam(existing, team))) {
      candidates.push(team);
    }
  };

  (series.games ?? []).forEach(game => {
    add(normalizeTeam(game.awayTeam));
    add(normalizeTeam(game.homeTeam));
  });
  add(normalizeTeam(series.teams?.awayTeam));
  add(normalizeTeam(series.teams?.homeTeam));

  const teamA = candidates[0] ?? normalizeTeam(series.teams?.awayTeam);
  const teamB = candidates[1] ?? normalizeTeam(series.teams?.homeTeam);
  return [teamA?.isTbd ? normalizeTeam(null) : teamA, teamB?.isTbd ? normalizeTeam(null) : teamB];
}

function playoffLikeGame(game: PlayoffCatalogGameShape): boolean {
  const id = cleanString(game.gameId);
  return id.startsWith('004') || !!cleanString(game.seriesGameNumber) || !!cleanString(game.seriesText);
}

function roundOrderFromGameId(gameId: string): number {
  if (gameId.length >= 10 && gameId.startsWith('004')) {
    const value = Number(gameId.charAt(7));
    if ([1, 2, 3, 4].includes(value)) return value;
  }
  return 99;
}

function roundLabelFromOrder(order: number): string {
  switch (order) {
    case 1: return 'Round 1';
    case 2: return 'Conference Semifinals';
    case 3: return 'Conference Finals';
    case 4: return 'NBA Finals';
    default: return 'Playoffs';
  }
}

function inferConference(order: number, teams: PlayoffTeamSlot[]): PlayoffConference | undefined {
  if (order === 4) return undefined;
  const known = teams.map(team => team.conference).filter((value): value is PlayoffConference => value === 'East' || value === 'West');
  if (known.length === 0) return undefined;
  return known.every(conf => conf === known[0]) ? known[0] : undefined;
}

function getGameDate(game: PlayoffCatalogGameShape): string {
  return cleanString(game.primaryDate) || cleanString(game.gameCodeDate) || cleanString(game.utcDate) || cleanString(game.gameDateUTC).slice(0, 10);
}

function formatDateLabel(date: string): string {
  if (!date) return 'Date TBD';
  const parsed = new Date(`${date.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function compareGames(a: PlayoffCatalogGameShape, b: PlayoffCatalogGameShape): number {
  const dateCompare = getGameDate(a).localeCompare(getGameDate(b));
  if (dateCompare !== 0) return dateCompare;
  return cleanString(a.gameId).localeCompare(cleanString(b.gameId));
}

function getStatus(game: PlayoffCatalogGameShape): PlayoffGameStatus {
  const status = toNumber(game.gameStatus) ?? 1;
  if (status === 3 || cleanString(game.gameStatusText).toLowerCase().includes('final')) return 'final';
  if (status === 2) return 'live';
  return 'scheduled';
}

function parseSeriesText(text: string, teamA: PlayoffTeamSlot, teamB: PlayoffTeamSlot): ParsedSeriesText {
  const trimmed = text.trim();
  const winsByAbbr: Record<string, number> = {};
  const completeMatch = trimmed.match(/^([A-Z]{2,3})\s+wins?\s+(\d+)\s*-\s*(\d+)/i);
  if (completeMatch) {
    const winnerAbbr = completeMatch[1]?.toUpperCase() ?? '';
    const winnerWins = Number(completeMatch[2] ?? 0);
    const loserWins = Number(completeMatch[3] ?? 0);
    winsByAbbr[winnerAbbr] = winnerWins;
    const opponent = [teamA, teamB].find(team => !team.isTbd && team.abbreviation !== winnerAbbr);
    if (opponent) winsByAbbr[opponent.abbreviation] = loserWins;
    return {
      summary: `${winnerAbbr} won ${winnerWins}-${loserWins}`,
      winnerAbbr,
      leaderAbbr: winnerAbbr,
      winsByAbbr,
      isComplete: true,
    };
  }

  const leadMatch = trimmed.match(/^([A-Z]{2,3})\s+leads?\s+(\d+)\s*-\s*(\d+)/i);
  if (leadMatch) {
    const leaderAbbr = leadMatch[1]?.toUpperCase() ?? '';
    const leaderWins = Number(leadMatch[2] ?? 0);
    const trailingWins = Number(leadMatch[3] ?? 0);
    winsByAbbr[leaderAbbr] = leaderWins;
    const opponent = [teamA, teamB].find(team => !team.isTbd && team.abbreviation !== leaderAbbr);
    if (opponent) winsByAbbr[opponent.abbreviation] = trailingWins;
    return {
      summary: `${leaderAbbr} leads ${leaderWins}-${trailingWins}`,
      leaderAbbr,
      winsByAbbr,
      isComplete: false,
    };
  }

  const tiedMatch = trimmed.match(/^Series\s+tied\s+(\d+)\s*-\s*(\d+)/i);
  if (tiedMatch) {
    const aWins = Number(tiedMatch[1] ?? 0);
    const bWins = Number(tiedMatch[2] ?? aWins);
    if (!teamA.isTbd) winsByAbbr[teamA.abbreviation] = aWins;
    if (!teamB.isTbd) winsByAbbr[teamB.abbreviation] = bWins;
    return {
      summary: `Series tied ${aWins}-${bWins}`,
      winsByAbbr,
      isComplete: false,
    };
  }

  return { summary: trimmed || undefined, winsByAbbr, isComplete: false };
}

function fallbackSeriesState(games: PlayoffSeriesGame[], teamA: PlayoffTeamSlot, teamB: PlayoffTeamSlot): ParsedSeriesText {
  const winsByAbbr: Record<string, number> = {};
  games.forEach(game => {
    if (game.status !== 'final' || !game.winnerAbbr) return;
    winsByAbbr[game.winnerAbbr] = (winsByAbbr[game.winnerAbbr] ?? 0) + 1;
  });
  const winsA = teamA.isTbd ? 0 : winsByAbbr[teamA.abbreviation] ?? 0;
  const winsB = teamB.isTbd ? 0 : winsByAbbr[teamB.abbreviation] ?? 0;
  if (winsA === 0 && winsB === 0) return { summary: 'Series TBD', winsByAbbr, isComplete: false };
  if (winsA === winsB) return { summary: `Series tied ${winsA}-${winsB}`, winsByAbbr, isComplete: false };
  const leader = winsA > winsB ? teamA : teamB;
  const leaderWins = Math.max(winsA, winsB);
  const trailingWins = Math.min(winsA, winsB);
  const isComplete = leaderWins >= 4;
  return {
    summary: `${leader.abbreviation} ${isComplete ? 'won' : 'leads'} ${leaderWins}-${trailingWins}`,
    winnerAbbr: isComplete ? leader.abbreviation : undefined,
    leaderAbbr: leader.abbreviation,
    winsByAbbr,
    isComplete,
  };
}

function normalizeSeriesGame(game: PlayoffCatalogGameShape): PlayoffSeriesGame {
  const status = getStatus(game);
  const homeTeam = normalizeTeam(game.homeTeam);
  const awayTeam = normalizeTeam(game.awayTeam);
  const homeScore = toNumber(game.homeTeam?.score);
  const awayScore = toNumber(game.awayTeam?.score);
  const winnerAbbr = status === 'final' && homeScore !== undefined && awayScore !== undefined && homeScore !== awayScore
    ? homeScore > awayScore ? homeTeam.abbreviation : awayTeam.abbreviation
    : undefined;
  const statusText = cleanString(game.gameStatusText) || (status === 'scheduled' ? 'Scheduled' : status === 'live' ? 'Live' : 'Final');
  return {
    id: cleanString(game.gameId),
    gameNumber: cleanString(game.seriesGameNumber) || 'Game',
    dateLabel: formatDateLabel(getGameDate(game)),
    status,
    statusText,
    homeTeam,
    awayTeam,
    homeScore,
    awayScore,
    winnerAbbr,
    canOpen: !!cleanString(game.gameId) && (status === 'final' || status === 'live'),
  };
}

function groupGamesIntoSeries(games: PlayoffCatalogGameShape[]): PlayoffCatalogSeriesShape[] {
  const grouped = new Map<string, PlayoffCatalogGameShape[]>();
  games.filter(playoffLikeGame).forEach(game => {
    const id = cleanString(game.gameId);
    const key = id.startsWith('004') && id.length >= 10
      ? id.slice(0, -1)
      : [roundOrderFromGameId(id), normalizeTeam(game.awayTeam).abbreviation, normalizeTeam(game.homeTeam).abbreviation, cleanString(game.seriesText)].join('|');
    grouped.set(key, [...(grouped.get(key) ?? []), game]);
  });
  return Array.from(grouped.entries()).map(([seriesKey, seriesGames]) => {
    const sortedGames = [...seriesGames].sort(compareGames);
    const latestGame = sortedGames[sortedGames.length - 1];
    return {
      seriesKey,
      latestSeriesText: latestGame?.seriesText ?? null,
      latestGameDate: latestGame?.primaryDate ?? null,
      gameCount: seriesGames.length,
      games: seriesGames,
    };
  });
}

function buildSeries(series: PlayoffCatalogSeriesShape): PlayoffSeries | null {
  const rawGames = (series.games ?? []).filter(playoffLikeGame).sort(compareGames);
  if (rawGames.length === 0) return null;
  const [teamA, teamB] = collectSeriesTeams({ ...series, games: rawGames });
  const games = rawGames.map(normalizeSeriesGame);
  const firstGameId = cleanString(rawGames[0]?.gameId);
  const roundOrder = roundOrderFromGameId(firstGameId);
  const roundLabel = roundLabelFromOrder(roundOrder);
  const conference = inferConference(roundOrder, [teamA, teamB]);
  const latestGame = rawGames[rawGames.length - 1];
  const latestSeriesText = cleanString(series.latestSeriesText) || cleanString(latestGame?.seriesText);
  const parsed = latestSeriesText ? parseSeriesText(latestSeriesText, teamA, teamB) : fallbackSeriesState(games, teamA, teamB);
  const state = parsed.summary ? parsed : fallbackSeriesState(games, teamA, teamB);
  const leaderOrWinner = state.winnerAbbr ?? state.leaderAbbr;
  const accentTeam = [teamA, teamB].find(team => !team.isTbd && team.abbreviation === leaderOrWinner);
  const fallbackAccentTeam = !teamA.isTbd ? teamA : !teamB.isTbd ? teamB : undefined;

  return {
    id: cleanString(series.seriesKey) || firstGameId.slice(0, -1) || `${teamA.abbreviation}-${teamB.abbreviation}-${roundOrder}`,
    roundOrder,
    roundLabel,
    conference,
    teamA,
    teamB,
    games,
    summary: state.summary ?? 'Series TBD',
    seriesText: latestSeriesText || undefined,
    winnerAbbr: state.winnerAbbr,
    leaderAbbr: state.leaderAbbr,
    winsA: teamA.isTbd ? undefined : state.winsByAbbr[teamA.abbreviation],
    winsB: teamB.isTbd ? undefined : state.winsByAbbr[teamB.abbreviation],
    isComplete: state.isComplete,
    accentColor: accentTeam?.color ?? fallbackAccentTeam?.color ?? '#3B82F6',
  };
}

function getSeasonTitle(games: PlayoffCatalogGameShape[]): string {
  const year = games.map(game => getGameDate(game).slice(0, 4)).find(value => /^\d{4}$/.test(value));
  return `${year ?? new Date().getFullYear()} NBA Playoffs`;
}

function roundSortKey(round: PlayoffBracketRound): string {
  const conferenceOrder = round.conference === 'East' ? '0' : round.conference === 'West' ? '1' : '2';
  return `${round.order.toString().padStart(2, '0')}-${conferenceOrder}-${round.label}`;
}

/**
 * Builds a mobile-friendly playoff bracket from the already-fetched NBA schedule/playoff catalog.
 * The parser intentionally stays source-backed: it uses schedule game IDs, teams, scores, dates,
 * status, series labels, and only falls back to completed-game win counts inside each detected series.
 */
export function buildPlayoffBracket(catalog: PlayoffCatalogLike | null | undefined): PlayoffBracket {
  const catalogGames = (catalog?.games ?? []).filter(playoffLikeGame);
  const rawSeries = Array.isArray(catalog?.series) && catalog.series.length > 0
    ? catalog.series
    : groupGamesIntoSeries(catalogGames);
  const series = rawSeries
    .map(buildSeries)
    .filter((value): value is PlayoffSeries => value !== null)
    .sort((a, b) => {
      const roundDiff = a.roundOrder - b.roundOrder;
      if (roundDiff !== 0) return roundDiff;
      const confDiff = (a.conference ?? 'Z').localeCompare(b.conference ?? 'Z');
      if (confDiff !== 0) return confDiff;
      return a.id.localeCompare(b.id);
    });

  const roundsByKey = new Map<string, PlayoffBracketRound>();
  series.forEach(item => {
    const key = `${item.roundOrder}-${item.conference ?? 'finals'}`;
    const label = item.conference && item.roundOrder !== 4 ? `${item.conference} · ${item.roundLabel}` : item.roundLabel;
    const existing = roundsByKey.get(key);
    if (existing) {
      existing.series.push(item);
    } else {
      roundsByKey.set(key, {
        id: key,
        label,
        order: item.roundOrder,
        conference: item.conference,
        series: [item],
      });
    }
  });

  const rounds = Array.from(roundsByKey.values()).sort((a, b) => roundSortKey(a).localeCompare(roundSortKey(b)));
  const hasConferenceData = series.some(item => item.conference === 'East' || item.conference === 'West');
  const allSeriesGames = series.flatMap(item => item.games);
  const completedGameCount = allSeriesGames.filter(game => (
    game.status === 'final' &&
    game.homeScore !== undefined &&
    game.awayScore !== undefined
  )).length;
  const liveGameCount = allSeriesGames.filter(game => game.status === 'live').length;

  return {
    title: getSeasonTitle(catalogGames),
    subtitle: 'Series results and game outcomes',
    rounds,
    hasConferenceData,
    seriesCount: series.length,
    completedGameCount,
    liveGameCount,
  };
}
