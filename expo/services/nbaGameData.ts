import { BoxScorePlayer, PlayByPlayEvent, ShotEvent, Game } from '@/types';
import { fetchNbaCdn, fetchNbaStats, parsePTClock, parsePTMinutes, parsePTToSeconds, getGameStatus, getPeriodText, getStatusClockText } from './nbaApi';
import { getTeamInfoById } from '@/constants/nbaTeams';

interface CdnBoxScoreResponse {
  game: CdnBoxScoreGame;
}

interface CdnBoxScoreGame {
  gameId: string;
  gameStatus: number;
  gameStatusText: string;
  period: number;
  gameClock: string;
  arena: {
    arenaName: string;
    arenaCity: string;
    arenaState: string;
  };
  attendance: number;
  homeTeam: CdnBoxScoreTeam;
  awayTeam: CdnBoxScoreTeam;
}

interface CdnBoxScoreTeam {
  teamId: number;
  teamName: string;
  teamCity: string;
  teamTricode: string;
  score: number;
  players: CdnBoxScorePlayer[];
  statistics: Record<string, number | string>;
}

interface CdnBoxScorePlayer {
  status: string;
  order: number;
  personId: number;
  jerseyNum: string;
  position: string;
  starter: string;
  oncourt: string;
  played: string;
  statistics: {
    assists: number;
    blocks: number;
    fieldGoalsAttempted: number;
    fieldGoalsMade: number;
    freeThrowsAttempted: number;
    freeThrowsMade: number;
    minutes: string;
    minutesCalculated: string;
    plusMinusPoints: number;
    points: number;
    reboundsDefensive: number;
    reboundsOffensive: number;
    reboundsTotal: number;
    steals: number;
    threePointersAttempted: number;
    threePointersMade: number;
    turnovers: number;
    [key: string]: number | string;
  };
  name: string;
  nameI: string;
  firstName: string;
  familyName: string;
}

interface CdnPlayByPlayResponse {
  game: {
    gameId: string;
    actions: CdnPbpAction[];
  };
}

export interface CdnPbpAction {
  actionNumber: number;
  clock: string;
  timeActual: string;
  period: number;
  periodType: string;
  teamId: number;
  teamTricode: string;
  actionType: string;
  subType: string;
  qualifiers: string[];
  personId: number;
  x: number;
  y: number;
  area: string;
  areaDetail: string;
  side: string;
  shotDistance: number;
  possession: number;
  scoreHome: string;
  scoreAway: string;
  xLegacy: number;
  yLegacy: number;
  isFieldGoal: number;
  shotResult: string;
  pointsTotal: number;
  playerName: string;
  playerNameI: string;
  description: string;
  personIdsFilter: number[];
  assistPersonId?: number;
  assistPlayerNameInitial?: string;
}

export interface GameDetailData {
  game: Game;
  homeBoxScore: BoxScorePlayer[];
  awayBoxScore: BoxScorePlayer[];
  homeTeamStats: Record<string, number>;
  awayTeamStats: Record<string, number>;
}

function transformBoxScorePlayer(p: CdnBoxScorePlayer): BoxScorePlayer {
  const stats = p.statistics;
  return {
    playerId: String(p.personId),
    name: p.nameI || p.name,
    position: p.position || '',
    minutes: parsePTMinutes(stats.minutes as string),
    points: stats.points,
    rebounds: stats.reboundsTotal,
    offensiveRebounds: stats.reboundsOffensive,
    defensiveRebounds: stats.reboundsDefensive,
    assists: stats.assists,
    steals: stats.steals,
    blocks: stats.blocks,
    turnovers: stats.turnovers,
    fgm: stats.fieldGoalsMade,
    fga: stats.fieldGoalsAttempted,
    tpm: stats.threePointersMade,
    tpa: stats.threePointersAttempted,
    ftm: stats.freeThrowsMade,
    fta: stats.freeThrowsAttempted,
    plusMinus: stats.plusMinusPoints,
    isStarter: p.starter === '1',
  };
}

function mapActionTypeToEventType(action: CdnPbpAction): PlayByPlayEvent['eventType'] {
  const at = action.actionType.toLowerCase();
  const sr = action.shotResult?.toLowerCase();

  if (at === '2pt' || at === '3pt') {
    if (sr === 'made') return 'score';
    return 'miss';
  }
  if (at === 'freethrow') {
    if (sr === 'made') return 'score';
    return 'miss';
  }
  if (at === 'turnover') return 'turnover';
  if (at === 'foul') return 'foul';
  if (at === 'substitution') return 'substitution';
  if (at === 'rebound') return 'rebound';
  if (at === 'timeout') return 'timeout';
  if (at === 'block') return 'block';
  if (at === 'steal') return 'steal';

  return 'miss';
}

function transformPbpAction(action: CdnPbpAction, index: number): PlayByPlayEvent {
  const eventType = mapActionTypeToEventType(action);
  const homeScore = parseInt(action.scoreHome, 10) || 0;
  const awayScore = parseInt(action.scoreAway, 10) || 0;

  let scoreDelta: number | undefined;
  if (eventType === 'score') {
    if (action.actionType === '3pt') scoreDelta = 3;
    else if (action.actionType === '2pt') scoreDelta = 2;
    else if (action.actionType === 'freethrow') scoreDelta = 1;
  }

  const playerId = action.personId ? String(action.personId) : undefined;
  const assistPlayerId = action.assistPersonId ? String(action.assistPersonId) : undefined;
  const involvedPlayerIds = Array.from(new Set([playerId, assistPlayerId].filter((id): id is string => !!id)));
  const clockSeconds = parsePTToSeconds(action.clock);
  const isClutch = action.period >= 4 && clockSeconds <= 300 && Math.abs(homeScore - awayScore) <= 5;

  return {
    id: `${action.period}-${action.actionNumber}-${index}`,
    period: action.period,
    clock: parsePTClock(action.clock),
    eventType,
    description: action.description || `${action.playerNameI || ''} ${action.actionType} ${action.subType}`.trim(),
    teamId: String(action.teamId),
    teamAbbr: action.teamTricode || '',
    playerId,
    playerName: action.playerNameI || action.playerName || undefined,
    assistPlayerId,
    assistPlayerName: action.assistPlayerNameInitial || undefined,
    involvedPlayerIds: involvedPlayerIds.length > 0 ? involvedPlayerIds : undefined,
    rawActionType: action.actionType || undefined,
    rawSubType: action.subType || undefined,
    rawQualifiers: action.qualifiers,
    possessionTeamId: action.possession ? String(action.possession) : undefined,
    homeScore,
    awayScore,
    scoreDelta,
    isClutch,
  };
}

function transformShotFromAction(action: CdnPbpAction): ShotEvent | null {
  if (!action.isFieldGoal) return null;
  if (action.actionType === 'freethrow') return null;

  const x = action.xLegacy != null ? (action.xLegacy + 250) / 500 : action.x / 100;
  const y = action.yLegacy != null ? action.yLegacy / 470 : action.y / 100;

  let shotType = action.subType || action.actionType;
  if (action.actionType === '3pt') shotType = '3PT';
  else if (action.actionType === '2pt') shotType = action.subType || '2PT';

  return {
    id: `shot-${action.actionNumber}`,
    playerId: String(action.personId),
    playerName: action.playerNameI || action.playerName || '',
    teamId: String(action.teamId),
    x: Math.max(0, Math.min(1, x)),
    y: Math.max(0, Math.min(1, y)),
    made: action.shotResult?.toLowerCase() === 'made',
    shotType,
    distance: action.shotDistance || 0,
    period: action.period,
    clock: parsePTClock(action.clock),
    points: action.actionType === '3pt' ? 3 : 2,
  };
}

function optionalNumberFromKeys(source: Record<string, number | string>, keys: string[]): number | undefined {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      const value = source[key];
      if (typeof value === 'number' && Number.isFinite(value)) return value;
      if (typeof value === 'string' && value.trim()) {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) return parsed;
      }
    }
  }
  return undefined;
}

function extractTeamStats(teamData: CdnBoxScoreTeam): Record<string, number> {
  const stats = teamData.statistics;
  const oreb = Number(stats.reboundsOffensive ?? 0);
  const dreb = Number(stats.reboundsDefensive ?? 0);
  const apiTotal = Number(stats.reboundsTotal ?? 0);
  const canonicalTotal = oreb + dreb;
  if (apiTotal !== canonicalTotal) {
    console.log(`[TeamStats] Rebound mismatch: API reboundsTotal=${apiTotal}, OREB+DREB=${canonicalTotal} (team rebounds=${apiTotal - canonicalTotal})`);
  }
  const mappedStats: Record<string, number> = {
    points: teamData.score,
    fieldGoalsMade: Number(stats.fieldGoalsMade ?? 0),
    fieldGoalsAttempted: Number(stats.fieldGoalsAttempted ?? 0),
    fieldGoalsPercentage: Number(stats.fieldGoalsPercentage ?? 0) * 100,
    threePointersMade: Number(stats.threePointersMade ?? 0),
    threePointersAttempted: Number(stats.threePointersAttempted ?? 0),
    threePointersPercentage: Number(stats.threePointersPercentage ?? 0) * 100,
    freeThrowsMade: Number(stats.freeThrowsMade ?? 0),
    freeThrowsAttempted: Number(stats.freeThrowsAttempted ?? 0),
    freeThrowsPercentage: Number(stats.freeThrowsPercentage ?? 0) * 100,
    reboundsOffensive: oreb,
    reboundsDefensive: dreb,
    reboundsTotal: canonicalTotal,
    reboundsTotalRaw: apiTotal,
    assists: Number(stats.assists ?? 0),
    steals: Number(stats.steals ?? 0),
    blocks: Number(stats.blocks ?? 0),
    turnovers: Number(stats.turnovers ?? 0),
    foulsPersonal: Number(stats.foulsPersonal ?? 0),
    pointsFastBreak: Number(stats.pointsFastBreak ?? 0),
    pointsInThePaint: Number(stats.pointsInThePaint ?? 0),
  };

  const pointsOffTurnovers = optionalNumberFromKeys(stats, [
    'pointsOffTurnovers',
    'ptsOffTurnovers',
    'pointsOffTov',
    'ptsOffTov',
    'pointsFromTurnovers',
    'ptsFromTurnovers',
    'pointsOffTO',
    'ptsOffTO',
    'turnoversPoints',
    'pointsOffOpponentTurnovers',
    'pointsFromOpponentTurnovers',
    'opponentTurnoverPoints',
    'pointsOffTOV',
    'ptsOffTOV',
  ]);
  const secondChancePoints = optionalNumberFromKeys(stats, ['pointsSecondChance', 'secondChancePoints', 'ptsSecondChance']);
  const benchPoints = optionalNumberFromKeys(stats, ['benchPoints', 'ptsBench', 'pointsBench']);
  if (pointsOffTurnovers !== undefined) mappedStats.pointsOffTurnovers = pointsOffTurnovers;
  if (secondChancePoints !== undefined) mappedStats.pointsSecondChance = secondChancePoints;
  if (benchPoints !== undefined) mappedStats.benchPoints = benchPoints;

  return mappedStats;
}

export async function fetchGameBoxScore(gameId: string): Promise<GameDetailData> {
  console.log(`[BoxScore] Fetching box score for game ${gameId}...`);
  const data = await fetchNbaCdn<CdnBoxScoreResponse>(`boxscore/boxscore_${gameId}.json`);
  const g = data.game;

  const homeInfo = getTeamInfoById(g.homeTeam.teamId);
  const awayInfo = getTeamInfoById(g.awayTeam.teamId);

  const game: Game = {
    id: g.gameId,
    date: '',
    status: getGameStatus(g.gameStatus),
    period: getPeriodText(g.period, g.gameStatus),
    clock: getStatusClockText(g.gameStatus, g.gameStatusText, g.gameClock),
    homeTeam: {
      id: String(g.homeTeam.teamId),
      abbreviation: g.homeTeam.teamTricode,
      name: g.homeTeam.teamName,
      score: g.homeTeam.score,
      primaryColor: homeInfo?.primaryColor ?? '#64748B',
    },
    awayTeam: {
      id: String(g.awayTeam.teamId),
      abbreviation: g.awayTeam.teamTricode,
      name: g.awayTeam.teamName,
      score: g.awayTeam.score,
      primaryColor: awayInfo?.primaryColor ?? '#64748B',
    },
    arena: g.arena?.arenaName ?? '',
    attendance: g.attendance,
    isPlayoff: false,
  };

  const activePlayers = (team: CdnBoxScoreTeam) =>
    team.players
      .filter(p => p.played === '1' || p.status === 'ACTIVE')
      .sort((a, b) => a.order - b.order)
      .map(transformBoxScorePlayer);

  return {
    game,
    homeBoxScore: activePlayers(g.homeTeam),
    awayBoxScore: activePlayers(g.awayTeam),
    homeTeamStats: extractTeamStats(g.homeTeam),
    awayTeamStats: extractTeamStats(g.awayTeam),
  };
}

export async function fetchGamePlayByPlay(gameId: string): Promise<{
  events: PlayByPlayEvent[];
  shots: ShotEvent[];
  rawActions: CdnPbpAction[];
}> {
  console.log(`[PBP] Fetching play-by-play for game ${gameId}...`);
  const data = await fetchNbaCdn<CdnPlayByPlayResponse>(`playbyplay/playbyplay_${gameId}.json`);

  const actions = data.game.actions;

  const filteredActions = actions.filter(a => {
    const at = a.actionType?.toLowerCase();
    return at !== 'period' && at !== 'game' && at !== 'jumpball' && at !== 'stoppage';
  });

  const events = filteredActions.map((a, i) => transformPbpAction(a, i));

  const shots: ShotEvent[] = [];
  for (const action of actions) {
    const shot = transformShotFromAction(action);
    if (shot) shots.push(shot);
  }

  console.log(`[PBP] Parsed ${events.length} events and ${shots.length} shots`);

  return { events, shots, rawActions: actions };
}

export interface HustlePlayerContests {
  contestedShots: number;
  contested2Pt: number;
  contested3Pt: number;
}

export interface HustleStats {
  byPlayer: Record<string, HustlePlayerContests>;
}

interface HustleResultSet {
  name: string;
  headers: string[];
  rowSet: (string | number | null)[][];
}

interface HustleResponse {
  resultSets?: HustleResultSet[];
}

export interface GameMatchupRow {
  offensivePlayerId: string;
  offensivePlayerName: string;
  offensiveTeamId: string;
  defensivePlayerId: string;
  defensivePlayerName: string;
  defensiveTeamId: string;
  fga: number;
  fgm: number;
  points: number;
  fg3m?: number;
  fg3a?: number;
  assists?: number;
  turnovers?: number;
  steals?: number;
  blocks?: number;
  partialPossessions?: number;
  matchupMinutes?: string;
}

interface CdnMatchupEntry {
  personId: number;
  firstName?: string;
  familyName?: string;
  nameI?: string;
  matchupMinutes?: string;
  partialPossessions?: number;
  playerPoints?: number;
  teamPoints?: number;
  matchupAssists?: number;
  matchupTurnovers?: number;
  matchupBlocks?: number;
  matchupFieldGoalsMade?: number;
  matchupFieldGoalsAttempted?: number;
  matchupFieldGoalPercentage?: number;
  matchupThreePointersMade?: number;
  matchupThreePointersAttempted?: number;
  matchupThreePointerPercentage?: number;
  matchupFreeThrowsMade?: number;
  matchupFreeThrowsAttempted?: number;
  steals?: number;
  blocks?: number;
}

interface CdnMatchupPlayer {
  personId: number;
  firstName?: string;
  familyName?: string;
  nameI?: string;
  matchups?: CdnMatchupEntry[];
}

interface CdnMatchupTeam {
  teamId: number;
  teamTricode?: string;
  players: CdnMatchupPlayer[];
}

interface CdnMatchupsResponse {
  boxScoreMatchups?: {
    gameId: string;
    homeTeamId: number;
    awayTeamId: number;
    homeTeam: CdnMatchupTeam;
    awayTeam: CdnMatchupTeam;
  };
  resultSets?: Array<{
    name?: string;
    headers?: string[];
    rowSet?: (string | number | null)[][];
  }>;
  resource?: string;
}

function matchupName(p: { nameI?: string; firstName?: string; familyName?: string }): string {
  if (p.nameI && p.nameI.trim()) return p.nameI;
  const fn = p.firstName ?? '';
  const ln = p.familyName ?? '';
  return `${fn} ${ln}`.trim();
}

function hasIds(personId: unknown, defenderId: unknown): boolean {
  return personId != null && defenderId != null
    && String(personId).length > 0 && String(defenderId).length > 0
    && String(personId) !== '0' && String(defenderId) !== '0';
}

function parseV3Shape(root: NonNullable<CdnMatchupsResponse['boxScoreMatchups']>): GameMatchupRow[] {
  const rows: GameMatchupRow[] = [];
  const homeTeamId = String(root.homeTeam?.teamId ?? '');
  const awayTeamId = String(root.awayTeam?.teamId ?? '');
  let rawCount = 0;

  const ingest = (defenderTeam: CdnMatchupTeam | undefined, defenderTeamId: string, offensiveTeamId: string) => {
    if (!defenderTeam) return;
    for (const defender of defenderTeam.players ?? []) {
      const matchups = defender.matchups ?? [];
      for (const m of matchups) {
        rawCount++;
        if (!hasIds(m.personId, defender.personId)) continue;
        rows.push({
          offensivePlayerId: String(m.personId),
          offensivePlayerName: matchupName(m),
          offensiveTeamId,
          defensivePlayerId: String(defender.personId),
          defensivePlayerName: matchupName(defender),
          defensiveTeamId: defenderTeamId,
          fga: Number(m.matchupFieldGoalsAttempted ?? 0),
          fgm: Number(m.matchupFieldGoalsMade ?? 0),
          points: Number(m.playerPoints ?? 0),
          fg3m: m.matchupThreePointersMade != null ? Number(m.matchupThreePointersMade) : undefined,
          fg3a: m.matchupThreePointersAttempted != null ? Number(m.matchupThreePointersAttempted) : undefined,
          assists: m.matchupAssists != null ? Number(m.matchupAssists) : undefined,
          turnovers: m.matchupTurnovers != null ? Number(m.matchupTurnovers) : undefined,
          steals: m.steals != null ? Number(m.steals) : undefined,
          blocks: m.matchupBlocks != null ? Number(m.matchupBlocks) : undefined,
          partialPossessions: m.partialPossessions != null ? Number(m.partialPossessions) : undefined,
          matchupMinutes: m.matchupMinutes,
        });
      }
    }
  };

  ingest(root.homeTeam, homeTeamId, awayTeamId);
  ingest(root.awayTeam, awayTeamId, homeTeamId);
  console.log(`[Matchups][v3] raw entries=${rawCount} normalized rows=${rows.length}`);
  return rows;
}

function parseResultSetsShape(rs: NonNullable<CdnMatchupsResponse['resultSets']>): GameMatchupRow[] {
  const set = rs.find(r => /matchup/i.test(r?.name ?? '')) ?? rs[0];
  if (!set || !set.headers || !set.rowSet) {
    console.log('[Matchups][resultSets] no usable result set');
    return [];
  }
  const idx = (h: string): number => set.headers!.indexOf(h);
  const offId = idx('PERSON_ID') >= 0 ? idx('PERSON_ID') : idx('OFF_PLAYER_ID');
  const defId = idx('DEF_PERSON_ID') >= 0 ? idx('DEF_PERSON_ID') : idx('DEF_PLAYER_ID');
  const offName = idx('PLAYER_NAME') >= 0 ? idx('PLAYER_NAME') : idx('OFF_PLAYER_NAME');
  const defName = idx('DEF_PLAYER_NAME');
  const offTeam = idx('TEAM_ID') >= 0 ? idx('TEAM_ID') : idx('OFF_TEAM_ID');
  const defTeam = idx('DEF_TEAM_ID');
  const fga = idx('MATCHUP_FGA') >= 0 ? idx('MATCHUP_FGA') : idx('FGA');
  const fgm = idx('MATCHUP_FGM') >= 0 ? idx('MATCHUP_FGM') : idx('FGM');
  const pts = idx('PLAYER_PTS') >= 0 ? idx('PLAYER_PTS') : idx('POINTS');
  const pp = idx('PARTIAL_POSS');
  const min = idx('MATCHUP_MIN');

  const rows: GameMatchupRow[] = [];
  for (const row of set.rowSet) {
    const oid = offId >= 0 ? row[offId] : null;
    const did = defId >= 0 ? row[defId] : null;
    if (!hasIds(oid, did)) continue;
    rows.push({
      offensivePlayerId: String(oid),
      offensivePlayerName: offName >= 0 ? String(row[offName] ?? '') : '',
      offensiveTeamId: offTeam >= 0 ? String(row[offTeam] ?? '') : '',
      defensivePlayerId: String(did),
      defensivePlayerName: defName >= 0 ? String(row[defName] ?? '') : '',
      defensiveTeamId: defTeam >= 0 ? String(row[defTeam] ?? '') : '',
      fga: fga >= 0 ? Number(row[fga] ?? 0) : 0,
      fgm: fgm >= 0 ? Number(row[fgm] ?? 0) : 0,
      points: pts >= 0 ? Number(row[pts] ?? 0) : 0,
      partialPossessions: pp >= 0 && row[pp] != null ? Number(row[pp]) : undefined,
      matchupMinutes: min >= 0 && row[min] != null ? String(row[min]) : undefined,
    });
  }
  console.log(`[Matchups][resultSets] raw=${set.rowSet.length} normalized=${rows.length}`);
  return rows;
}

export async function fetchGameMatchups(gameId: string): Promise<GameMatchupRow[]> {
  const params = {
    GameID: gameId,
    LeagueID: '00',
    endPeriod: '10',
    endRange: '2147483647',
    rangeType: '2',
    startPeriod: '1',
    startRange: '0',
  };
  const debugUrl = `https://stats.nba.com/stats/boxscorematchupsv3?${new URLSearchParams(params).toString()}`;
  console.log(`[Matchups] Fetching for game ${gameId}`);
  console.log(`[Matchups] Request URL: ${debugUrl}`);
  try {
    const data = await fetchNbaStats<CdnMatchupsResponse>('boxscorematchupsv3', params);
    const topKeys = data && typeof data === 'object' ? Object.keys(data as object) : [];
    console.log(`[Matchups] Response top-level keys: ${topKeys.join(', ')}`);

    if (data?.boxScoreMatchups) {
      const root = data.boxScoreMatchups;
      console.log(
        `[Matchups] boxScoreMatchups present. homeTeam keys=${root.homeTeam ? Object.keys(root.homeTeam).join(',') : 'none'} awayTeam keys=${root.awayTeam ? Object.keys(root.awayTeam).join(',') : 'none'}`,
      );
      const homeP = root.homeTeam?.players?.length ?? 0;
      const awayP = root.awayTeam?.players?.length ?? 0;
      console.log(`[Matchups] parent players home=${homeP} away=${awayP}`);
      const firstSample = root.homeTeam?.players?.[0]?.matchups?.[0]
        ?? root.awayTeam?.players?.[0]?.matchups?.[0];
      if (firstSample) {
        try {
          console.log(`[Matchups] sample matchup entry: ${JSON.stringify(firstSample).slice(0, 400)}`);
        } catch {}
      }
      const rows = parseV3Shape(root);
      return rows;
    }

    if (Array.isArray(data?.resultSets) && data.resultSets.length > 0) {
      console.log(
        `[Matchups] resultSets present. names=${data.resultSets.map(r => r?.name).join(',')}`,
      );
      const rows = parseResultSetsShape(data.resultSets);
      return rows;
    }

    console.warn('[Matchups] No recognized payload shape; sample=' + JSON.stringify(data).slice(0, 300));
    return [];
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[Matchups] fetch failed: ${msg}`);
    return [];
  }
}

export async function fetchGameHustleStats(gameId: string): Promise<HustleStats | null> {
  try {
    console.log(`[Hustle] Fetching hustle stats for game ${gameId}...`);
    const data = await fetchNbaStats<HustleResponse>('hustlestatsboxscore', { GameID: gameId });
    const playerSet = data.resultSets?.find(r => r.name === 'PlayerStats');
    if (!playerSet) {
      console.log('[Hustle] No PlayerStats result set');
      return null;
    }
    const idx = (h: string) => playerSet.headers.indexOf(h);
    const pid = idx('PLAYER_ID');
    const cs = idx('CONTESTED_SHOTS');
    const c2 = idx('CONTESTED_SHOTS_2PT');
    const c3 = idx('CONTESTED_SHOTS_3PT');
    if (pid < 0) {
      console.log('[Hustle] Missing PLAYER_ID header');
      return null;
    }
    const byPlayer: Record<string, HustlePlayerContests> = {};
    for (const row of playerSet.rowSet) {
      const playerId = String(row[pid]);
      byPlayer[playerId] = {
        contestedShots: cs >= 0 ? Number(row[cs] ?? 0) : 0,
        contested2Pt: c2 >= 0 ? Number(row[c2] ?? 0) : 0,
        contested3Pt: c3 >= 0 ? Number(row[c3] ?? 0) : 0,
      };
    }
    console.log(`[Hustle] Parsed contests for ${Object.keys(byPlayer).length} players`);
    return { byPlayer };
  } catch (err) {
    console.warn('[Hustle] fetch failed', err);
    return null;
  }
}
