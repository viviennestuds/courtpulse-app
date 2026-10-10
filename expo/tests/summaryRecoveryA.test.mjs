import { describe, expect, test } from 'bun:test';
import { resolveSummaryEvidence, summaryStatValue, summaryComparisonWidths } from '../services/summaryStatResolution';
import { normalizeProxyBoxscore, normalizeStatsHydrationBoxscore } from '../services/nbaDataProxy';

globalThis.__DEV__ = false;

const HOME = '1610612747';
const AWAY = '1610612758';
const GAME = '0012600036';

function teams(homeStats = {}, awayStats = {}, homeId = HOME, awayId = AWAY) {
  return {
    homeTeam: { teamId: homeId, homeAway: 'home', stats: homeStats },
    awayTeam: { teamId: awayId, homeAway: 'away', stats: awayStats },
  };
}

function evidence(overrides = {}) {
  return {
    requestedGameId: GAME,
    responseGameId: GAME,
    homeTeamId: HOME,
    awayTeamId: AWAY,
    gameScore: {
      gameId: GAME,
      homeTeam: { teamId: HOME, homeAway: 'home', score: 80 },
      awayTeam: { teamId: AWAY, homeAway: 'away', score: 70 },
    },
    traditional: teams({ assists: null, reboundsTotal: null }, {}, 0, 0),
    headline: teams({
      assists: 21, reboundsTotal: 28, fieldGoalsPercentage: 0.473,
      threePointersPercentage: 0.292, freeThrowsPercentage: 0.84,
      steals: 7, blocks: 5, turnovers: 18, turnoversTeam: 1, turnoversTotal: 19,
      pointsOffTurnovers: 8,
    }, {
      assists: 15, reboundsTotal: 33, fieldGoalsPercentage: 0.394,
      threePointersPercentage: 0.167, freeThrowsPercentage: 0.636,
      pointsOffTurnovers: 16,
    }),
    ...overrides,
  };
}

function hydration() {
  const input = evidence();
  return {
    success: true,
    type: 'statsGameHydration',
    gameId: GAME,
    sourceStatus: 'ok',
    game: {
      gameId: GAME,
      gameStatus: 2,
      gameStatusText: 'Q3',
      homeTeam: { teamId: HOME, teamTricode: 'LAL', teamName: 'Lakers', score: 80 },
      awayTeam: { teamId: AWAY, teamTricode: 'SAC', teamName: 'Kings', score: 70 },
      headlineStats: input.headline,
    },
    boxscore: {
      gameId: GAME,
      playerCount: 0,
      players: [],
      homeTeam: { teamId: 0, homeAway: 'home', statistics: { assists: null, reboundsTotal: null } },
      awayTeam: { teamId: 0, homeAway: 'away', statistics: { assists: null, reboundsTotal: null } },
    },
    summary: { gameId: GAME },
    misc: { gameId: GAME, teams: [] },
  };
}

describe('Recovery A pure Summary evidence resolution', () => {
  test('reconstructed live SAC-LAL partial hydration recovers explicit headline values, not missing splits', () => {
    const resolved = resolveSummaryEvidence(evidence());
    expect(summaryStatValue(resolved.home, 'points')).toBe(80);
    expect(summaryStatValue(resolved.away, 'points')).toBe(70);
    expect(summaryStatValue(resolved.home, 'reboundsTotal')).toBe(28);
    expect(summaryStatValue(resolved.home, 'assists')).toBe(21);
    expect(summaryStatValue(resolved.home, 'fieldGoalsPercentage')).toBeCloseTo(47.3, 4);
    expect(summaryStatValue(resolved.home, 'threePointersPercentage')).toBeCloseTo(29.2, 4);
    expect(summaryStatValue(resolved.home, 'freeThrowsPercentage')).toBe(84);
    expect(summaryStatValue(resolved.home, 'pointsOffTurnovers')).toBe(8);
    expect(summaryStatValue(resolved.away, 'pointsOffTurnovers')).toBe(16);
    expect(summaryStatValue(resolved.home, 'reboundsOffensive')).toBeNull();
    expect(summaryStatValue(resolved.home, 'reboundsDefensive')).toBeNull();
    expect(summaryStatValue(resolved.home, 'turnovers')).toBeNull();
    expect(resolved.home.assists.source).toBe('headline');
  });

  test('explicit traditional zero and nonzero values win over conflicting headline values', () => {
    const resolved = resolveSummaryEvidence(evidence({
      traditional: teams({ assists: 0, steals: 17, fieldGoalsPercentage: 0 }, { assists: 5 }),
    }));
    expect(resolved.home.assists).toMatchObject({ value: 0, source: 'traditional', available: true });
    expect(resolved.home.steals).toMatchObject({ value: 17, source: 'traditional' });
    expect(resolved.home.fieldGoalsPercentage.value).toBe(0);
    expect(resolved.away.assists.value).toBe(5);
  });

  test('contradictory real team ID is not redeemed by matching side', () => {
    const resolved = resolveSummaryEvidence(evidence({
      traditional: teams({ assists: 99 }, { assists: 44 }, '99', AWAY),
      headline: teams({ assists: 21 }, { assists: 15 }, '99', AWAY),
    }));
    expect(resolved.home.assists.value).toBeNull();
    expect(resolved.away.assists.value).toBe(44);
  });

  test('placeholder named side is accepted only with game-scoped identity; unscoped arrays cannot establish it', () => {
    const named = resolveSummaryEvidence(evidence({ traditional: teams({ assists: 0 }, {}, 0, 0) }));
    expect(named.home.assists.value).toBe(0);
    const ambiguous = resolveSummaryEvidence(evidence({
      traditional: { teams: [{ teamId: 0, homeAway: 'home', stats: { assists: 99 } }] },
      headline: null,
    }));
    expect(ambiguous.home.assists.value).toBeNull();
    expect(resolveSummaryEvidence(evidence({ responseGameId: 'wrong' }))).toBeNull();
  });

  test('fractional percentages obey source-defined fraction scale, 0 and 1 remain meaningful', () => {
    const resolved = resolveSummaryEvidence(evidence({
      traditional: teams({ fieldGoalsPercentage: 0, threePointersPercentage: 1, freeThrowsPercentage: 0.478 }, {}),
    }));
    expect(resolved.home.fieldGoalsPercentage.value).toBe(0);
    expect(resolved.home.threePointersPercentage.value).toBe(100);
    expect(resolved.home.freeThrowsPercentage.value).toBeCloseTo(47.8, 4);
  });

  test('invalid and absent source fields remain unavailable instead of defaulting to zero', () => {
    const resolved = resolveSummaryEvidence(evidence({
      traditional: teams({ assists: null, steals: 'not numeric' }, {}),
      headline: null,
    }));
    expect(resolved.home.assists).toMatchObject({ value: null, available: false, source: null });
    expect(resolved.home.steals.value).toBeNull();
  });

  test('all team-turnover keys remain distinct until total-team semantics are independently verified', () => {
    const resolved = resolveSummaryEvidence(evidence({
      traditional: teams({ turnovers: 17, turnoversTeam: 1, turnoversTotal: 18 }, {}),
    }));
    expect(resolved.home.turnovers.value).toBeNull();
  });

  test('neutralizes partial comparisons but preserves explicit zero comparisons', () => {
    expect(summaryComparisonWidths(null, 39)).toMatchObject({ available: false });
    expect(summaryComparisonWidths(0, 39)).toMatchObject({ available: true, home: 0, away: 100 });
    expect(summaryComparisonWidths(0, 0)).toMatchObject({ available: true, home: 50, away: 50 });
  });
});

describe('Recovery A production adapters — reconstructed characterization inputs', () => {
  test('actual Stats adapter preserves missingness separately while leaving shared numeric defaults unchanged', () => {
    const normalized = normalizeStatsHydrationBoxscore(hydration());
    expect(normalized).not.toBeNull();
    expect(normalized.summaryTeamStats.home.assists.value).toBe(21);
    expect(normalized.summaryTeamStats.home.reboundsTotal.value).toBe(28);
    expect(normalized.homeTeamStats.assists).toBe(0);
    expect(normalized.homeTeamStats.reboundsTotal).toBe(0);
    expect(normalized.homeTeamStats.pointsOffTurnovers).toBe(8);
    expect(normalized.awayTeamStats.pointsOffTurnovers).toBe(16);
    expect(normalized.homeBoxScore).toHaveLength(0);
    expect(normalized.awayBoxScore).toHaveLength(0);
  });

  test('primary proxy boxscore derives supported evidence without a second source request', () => {
    const response = {
      success: true,
      type: 'boxscore',
      gameId: GAME,
      data: {
        game: {
          gameId: GAME,
          gameStatus: 3,
          homeTeam: {
            teamId: HOME, teamTricode: 'LAL', score: 110,
            statistics: { assists: 22, reboundsTotal: 40, reboundsOffensive: 7, reboundsDefensive: 33, fieldGoalsPercentage: 0.5 },
          },
          awayTeam: {
            teamId: AWAY, teamTricode: 'SAC', score: 99,
            statistics: { assists: 18, reboundsTotal: 34, reboundsOffensive: 6, reboundsDefensive: 28, fieldGoalsPercentage: 0.42 },
          },
        },
      },
    };
    const normalized = normalizeProxyBoxscore(response);
    expect(normalized.summaryTeamStats.home.points.value).toBe(110);
    expect(normalized.summaryTeamStats.home.assists.value).toBe(22);
    expect(normalized.summaryTeamStats.home.reboundsTotal.value).toBe(40);
    expect(normalized.summaryTeamStats.home.fieldGoalsPercentage.value).toBe(50);
    expect(normalized.homeTeamStats.assists).toBe(22);
    expect(normalized.homeTeamStats.reboundsTotal).toBe(40);
  });
});
