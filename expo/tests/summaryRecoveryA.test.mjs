import { describe, expect, mock, test } from 'bun:test';
import { resolveSummaryEvidence, summaryStatValue, summaryComparisonWidths, normalizeSourcePercentage } from '../services/summaryStatResolution';
import { buildSummaryDisplayRows } from '../services/summaryPresentation';
import { readFileSync } from 'node:fs';

globalThis.__DEV__ = false;

// Adapter unit tests do not exercise native device APIs. Mock only this runtime
// dependency before importing the REAL production NBA normalization adapter.
mock.module('react-native', () => ({ Platform: { OS: 'web' } }));
const { normalizeProxyBoxscore, normalizeStatsHydrationBoxscore } = await import('../services/nbaDataProxy');

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
      traditional: teams({ assists: 0, steals: 17, fgPct: 0 }, { assists: 5 }),
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

  test('unrelated contradictory away identity cannot suppress positively matched home evidence', () => {
    const resolved = resolveSummaryEvidence(evidence({
      traditional: teams({ assists: 29 }, { assists: 99 }, HOME, '99'),
      headline: teams({ assists: 21 }, { assists: 99 }, HOME, '99'),
    }));
    expect(resolved.home.assists).toMatchObject({ value: 29, source: 'traditional' });
    expect(resolved.away.assists.value).toBeNull();
  });

  test('duplicate canonical IDs in named slots reject both records, including the apparently matched slot', () => {
    for (const duplicateId of [HOME, AWAY]) {
      const resolved = resolveSummaryEvidence(evidence({
        traditional: teams({ assists: 31 }, { assists: 44 }, duplicateId, duplicateId),
        headline: null,
      }));
      expect(resolved.home.assists.value).toBeNull();
      expect(resolved.away.assists.value).toBeNull();
    }
  });

  test('swapped named canonical team IDs cannot obtain authority from matching side labels', () => {
    const resolved = resolveSummaryEvidence(evidence({
      traditional: teams({ assists: 31 }, { assists: 44 }, AWAY, HOME),
      headline: null,
    }));
    expect(resolved.home.assists.value).toBeNull();
    expect(resolved.away.assists.value).toBeNull();
  });

  test('placeholder identities still require compatible game-scoped opposing identity', () => {
    const rejected = resolveSummaryEvidence(evidence({
      traditional: teams({ assists: 31 }, { assists: 44 }, 0, '99'),
      headline: null,
    }));
    expect(rejected.home.assists.value).toBeNull();
    expect(rejected.away.assists.value).toBeNull();

    const admitted = resolveSummaryEvidence(evidence({
      traditional: { gameId: GAME, ...teams({ assists: 0 }, { assists: 44 }, 0, AWAY) },
      headline: null,
    }));
    expect(admitted.home.assists).toMatchObject({ value: 0, source: 'traditional' });
    expect(admitted.away.assists.value).toBe(44);
  });

  test('array identity requires a unique canonical ID claim, regardless of declared side', () => {
    const unique = resolveSummaryEvidence(evidence({
      traditional: {
        gameId: GAME,
        teams: [
          { teamId: HOME, homeAway: 'home', stats: { assists: 31 } },
          { teamId: AWAY, homeAway: 'away', stats: { assists: 44 } },
        ],
      },
      headline: null,
    }));
    expect(unique.home.assists.value).toBe(31);
    expect(unique.away.assists.value).toBe(44);

    const independentArrayMatch = resolveSummaryEvidence(evidence({
      traditional: {
        gameId: GAME,
        homeTeam: { teamId: '99', homeAway: 'home', stats: { assists: 99 } },
        teams: [{ teamId: AWAY, homeAway: 'away', stats: { assists: 44 } }],
      },
      headline: null,
    }));
    expect(independentArrayMatch.home.assists.value).toBeNull();
    expect(independentArrayMatch.away.assists.value).toBe(44);

    const duplicate = resolveSummaryEvidence(evidence({
      traditional: {
        gameId: GAME,
        teams: [
          { teamId: HOME, homeAway: 'home', stats: { assists: 31 } },
          { teamId: HOME, homeAway: 'away', stats: { assists: 99 } },
        ],
      },
      headline: null,
    }));
    expect(duplicate.home.assists.value).toBeNull();

    const swappedSides = resolveSummaryEvidence(evidence({
      traditional: {
        gameId: GAME,
        teams: [
          { teamId: HOME, homeAway: 'away', stats: { assists: 31 } },
          { teamId: AWAY, homeAway: 'home', stats: { assists: 44 } },
        ],
      },
      headline: null,
    }));
    expect(swappedSides.home.assists.value).toBeNull();
    expect(swappedSides.away.assists.value).toBeNull();
  });

  test('contradictory source game ID cannot authorize otherwise correctly identified team records', () => {
    const resolved = resolveSummaryEvidence(evidence({
      traditional: { gameId: 'different-game', ...teams({ assists: 31 }, { assists: 44 }) },
      headline: null,
    }));
    expect(resolved.home.assists.value).toBeNull();
    expect(resolved.away.assists.value).toBeNull();
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
      traditional: teams({ fgPct: 0, fg3Pct: 1, ftPct: 0.478 }, {}),
    }));
    expect(resolved.home.fieldGoalsPercentage.value).toBe(0);
    expect(resolved.home.threePointersPercentage.value).toBe(100);
    expect(resolved.home.freeThrowsPercentage.value).toBeCloseTo(47.8, 4);
  });

  test('unit conversion is explicit, never chosen from the value magnitude', () => {
    expect(normalizeSourcePercentage(0.478, 'fraction')).toBeCloseTo(47.8, 4);
    expect(normalizeSourcePercentage(1, 'fraction')).toBe(100);
    expect(normalizeSourcePercentage(47.8, 'fraction')).toBeNull();
    expect(normalizeSourcePercentage(47.8, 'percentagePoints')).toBe(47.8);
    expect(normalizeSourcePercentage(1, 'percentagePoints')).toBe(1);
    expect(normalizeSourcePercentage(0.478, 'percentagePoints')).toBe(0.478);
    expect(normalizeSourcePercentage(101, 'percentagePoints')).toBeNull();
    expect(normalizeSourcePercentage(-1, 'fraction')).toBeNull();
  });

  test('only explicitly admitted source-field fraction scales can enter Summary', () => {
    const resolved = resolveSummaryEvidence(evidence({
      traditional: teams({ fieldGoalsPercentage: 47.8, ftPct: 0.84 }, {}),
      headline: teams({ fieldGoalsPercentage: 0.478, threePointersPercentage: 0.291 }, {}),
    }));
    expect(resolved.home.fieldGoalsPercentage).toMatchObject({ value: 47.8, source: 'headline' });
    expect(resolved.home.freeThrowsPercentage).toMatchObject({ value: 84, source: 'traditional' });
    const unsupported = resolveSummaryEvidence(evidence({
      traditional: teams({ fieldGoalsPercentage: 47.8 }, {}),
      headline: teams({ fieldGoalPct: 47.8 }, {}),
      postgame: null,
    }));
    expect(unsupported.home.fieldGoalsPercentage.value).toBeNull();
  });

  test('hydrated Traditional descriptive aliases have no authority over corroborated short fields', () => {
    const resolved = resolveSummaryEvidence(evidence({
      traditional: teams({
        fieldGoalsPercentage: 0.95, fgPct: 0.4,
        threePointersPercentage: 0.99, fg3Pct: 0.25,
        freeThrowsPercentage: 0.88, ftPct: 0.75,
      }, {}),
      headline: teams({
        fieldGoalsPercentage: 0.473,
        threePointersPercentage: 0.292,
        freeThrowsPercentage: 0.84,
      }, {}),
    }));
    expect(resolved.home.fieldGoalsPercentage).toMatchObject({ value: 40, source: 'traditional', sourceField: 'fgPct' });
    expect(resolved.home.threePointersPercentage).toMatchObject({ value: 25, source: 'traditional', sourceField: 'fg3Pct' });
    expect(resolved.home.freeThrowsPercentage).toMatchObject({ value: 75, source: 'traditional', sourceField: 'ftPct' });
  });

  test('unsupported descriptive-only Traditional percentages defer to compatible headline or remain unavailable', () => {
    const withHeadline = resolveSummaryEvidence(evidence({
      traditional: teams({
        fieldGoalsPercentage: 0.95,
        threePointersPercentage: 0.99,
        freeThrowsPercentage: 0.88,
      }, {}),
      headline: teams({
        fieldGoalsPercentage: 0.473,
        threePointersPercentage: 0.292,
        freeThrowsPercentage: 0.84,
      }, {}),
    }));
    expect(withHeadline.home.fieldGoalsPercentage).toMatchObject({ value: 47.3, source: 'headline', sourceField: 'fieldGoalsPercentage' });
    expect(withHeadline.home.threePointersPercentage).toMatchObject({ value: 29.2, source: 'headline', sourceField: 'threePointersPercentage' });
    expect(withHeadline.home.freeThrowsPercentage).toMatchObject({ value: 84, source: 'headline', sourceField: 'freeThrowsPercentage' });

    const noFallback = resolveSummaryEvidence(evidence({
      traditional: teams({
        fieldGoalsPercentage: 0.95,
        threePointersPercentage: 0.99,
        freeThrowsPercentage: 0.88,
      }, {}),
      headline: null,
      postgame: null,
    }));
    for (const field of ['fieldGoalsPercentage', 'threePointersPercentage', 'freeThrowsPercentage']) {
      expect(noFallback.home[field]).toMatchObject({ value: null, available: false, source: null });
    }
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

describe('Recovery A production Summary projection and isolated wiring', () => {
  test('Both and selected team modes read the same resolved values; optional rows honor missingness', () => {
    const summary = resolveSummaryEvidence(evidence());
    const rows = buildSummaryDisplayRows(summary);
    const rebound = rows.find(row => row.key === 'reboundsTotal');
    const assists = rows.find(row => row.key === 'assists');
    const turnover = rows.find(row => row.key === 'turnovers');
    const points = rows.find(row => row.key === 'points');
    expect(rebound).toMatchObject({ homeValue: 28, awayValue: 33 });
    expect(assists).toMatchObject({ homeValue: 21, awayValue: 15 });
    expect(turnover).toMatchObject({ homeValue: null, awayValue: null });
    expect(points).toMatchObject({ homeValue: 80, awayValue: 70 });
    expect(rows.find(row => row.key === 'freeThrowsPercentage')).toMatchObject({ homeValue: 84, awayValue: 63.6, isPercentage: true });
  });

  test('one-side availability does not turn absent opponent value into a graphically implied zero', () => {
    const summary = resolveSummaryEvidence(evidence({
      traditional: teams({ assists: null }, {}),
      headline: { homeTeam: { teamId: HOME, stats: { assists: 21 } } },
    }));
    const row = buildSummaryDisplayRows(summary).find(row => row.key === 'assists');
    expect(row).toMatchObject({ homeValue: 21, awayValue: null });
    expect(summaryComparisonWidths(row.homeValue, row.awayValue)).toMatchObject({ available: false });
  });

  test('supported missing optional misc row is hidden if neither side has evidence', () => {
    const summary = resolveSummaryEvidence(evidence({ headline: teams({ assists: 1 }, { assists: 2 }) }));
    expect(buildSummaryDisplayRows(summary).find(row => row.key === 'benchPoints')).toBeUndefined();
  });

  test('completed multi-stat Traditional fixture preserves preferred values and source authority', () => {
    const boston = '1610612738';
    const cleveland = '1610612739';
    const full = resolveSummaryEvidence({
      requestedGameId: '0012600011',
      responseGameId: '0012600011',
      homeTeamId: cleveland,
      awayTeamId: boston,
      gameScore: {
        gameId: '0012600011',
        homeTeam: { teamId: cleveland, score: 113 },
        awayTeam: { teamId: boston, score: 124 },
      },
      traditional: {
        gameId: '0012600011',
        homeTeam: { teamId: cleveland, statistics: { assists: 32, reboundsTotal: 39, fgPct: 0.478 } },
        awayTeam: { teamId: boston, statistics: { assists: 29, reboundsTotal: 56, fgPct: 0.414 } },
      },
      headline: {
        homeTeam: { teamId: cleveland, stats: { assists: 99 } },
        awayTeam: { teamId: boston, stats: { assists: 99 } },
      },
    });
    expect(full.home.assists).toMatchObject({ value: 32, source: 'traditional' });
    expect(full.away.reboundsTotal.value).toBe(56);
    expect(full.home.points.value).toBe(113);
    expect(full.away.points.value).toBe(124);
    expect(full.home.fieldGoalsPercentage.value).toBeCloseTo(47.8, 4);
  });

  test('only Game Detail Summary consumes optional evidence; Matchup keeps original numeric props', () => {
    const route = readFileSync(new URL('../app/game/[id]/index.tsx', import.meta.url), 'utf8');
    const hook = readFileSync(new URL('../hooks/useNbaData.ts', import.meta.url), 'utf8');
    const provider = readFileSync(new URL('../services/dataProvider.ts', import.meta.url), 'utf8');
    expect(route).toContain('summaryTeamStats={summaryTeamStats}');
    expect(route).toContain('legacyBackendSummary={!summaryTeamStats');
    expect(route).toContain('<MatchupRealDataTab');
    expect(route).not.toContain('summaryTeamStats={summaryTeamStats}\n                homeBoxScore=');
    expect(hook).toContain('summaryTeamStats: boxData?.summaryTeamStats');
    expect(provider).not.toContain('summaryTeamStats');
    expect(route).toContain('neutralWhenMissing={!legacyBackendSummary}');
    const statBar = readFileSync(new URL('../components/StatBar.tsx', import.meta.url), 'utf8');
    expect(statBar).toContain("import { summaryComparisonWidths } from '@/services/summaryStatResolution'");
    expect(statBar).toContain('neutralWhenMissing ? summaryComparisonWidths(homeValue, awayValue) : null');
    expect(statBar).toContain('neutralWhenMissing && !widths?.available');
    expect(statBar).toContain('widths?.home ??');
    expect(statBar).toContain('widths?.away ??');
  });
});
