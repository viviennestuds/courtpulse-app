import { describe, expect, test } from 'bun:test';
import {
  validateGameMatchupSummaryV2Response,
} from '../types/matchupSummaryV2';
import {
  gameMatchupSummaryV2QueryKey,
  shouldRetryGameMatchupSummaryV2,
} from '../services/matchupSummaryV2QueryPolicy';
import {
  MatchupSummaryV2Error,
} from '../services/matchupSummaryV2Error';
import {
  resolveMatchupSummaryV2Availability,
} from '../services/matchupSummaryV2Availability';
import {
  isGameMatchupEventsV2ResponseForPair,
} from '../types/matchupEventsV2';

globalThis.__DEV__ = false;

function player(playerId, teamId, teamTricode = 'BOS') {
  return { playerId, name: `Player ${playerId}`, teamId, teamTricode };
}

function keyMatchup(index, shareOfFullGameTurnovers = 0.5) {
  return {
    pairing: {
      offense: player(1000 + index, 1, 'BOS'),
      defense: player(2000 + index, 2, 'PHI'),
    },
    boxScore: {
      matchupTime: '4:12',
      matchupSeconds: 252,
      partialPossessions: 18.5,
      percentageTotalTimeBothOn: 0.4,
      offense: {
        points: 8,
        fgm: 3,
        fga: 7,
        fg3m: 1,
        fg3a: 3,
        ftm: 1,
        fta: 2,
        assists: 2,
        turnovers: 1,
        efgPct: 0.5,
        freeThrowRate: 2 / 7,
      },
      defense: { blocks: 1, shootingFouls: 1 },
    },
    factorContext: {
      shooting: {
        selected: { fga: 7, efgPct: 0.5, threePointAttemptRate: 3 / 7 },
        restOfGameExclusive: { fga: 8, efgPct: null, threePointAttemptRate: null },
        deltasSelectedMinusRest: { efgPct: null, threePointAttemptRate: null },
      },
      ballSecurity: {
        turnovers: 1,
        shareOfFullGameTurnovers,
      },
      foulPressure: {
        freeThrowAttempts: 2,
        freeThrowRate: 2 / 7,
        restOfGameExclusiveFreeThrowRate: null,
        shootingFoulsByDefender: 1,
      },
      creation: {
        assists: 2,
        shareOfFullGameAssists: null,
      },
      defensiveActivity: { blocks: 1, shootingFouls: 1 },
    },
    notabilityReasons: [{
      key: 'highExposure',
      label: 'High exposure',
      direction: 'selectedPair',
      value: 18.5,
      unit: 'partialPossessions',
      strength: 'supporting',
      selectionRole: 'exposure',
      explanation: 'Representative production-shaped fixture.',
    }],
    selectionProfile: {
      highestStrength: 'supporting',
      majorReasonCount: 0,
      notableReasonCount: 0,
      supportingReasonCount: 1,
      primaryFactorReasonCount: 0,
      supportingFactorReasonCount: 0,
      exposureReasonCount: 1,
      strongestReasonKey: 'highExposure',
      partialPossessions: 18.5,
    },
    capabilities: {
      personalBoxScore: { available: true },
      shotProfile: { queryEligible: true, availabilityConfirmed: false },
      film: { queryEligible: true, availabilityConfirmed: false },
    },
  };
}

function summaryFixture(gameId, offensePlayerCount, nullableTurnoverShares = false) {
  const keyMatchups = Array.from({ length: 5 }, (_, index) => keyMatchup(
    index,
    nullableTurnoverShares && index >= 2 ? null : 0.5,
  ));
  return {
    success: true,
    type: 'statsGameMatchupSummaryV2',
    gameId,
    contractRelease: '1.1',
    schemaVersion: 'courtPulseMatchup2.summary.v1.1',
    sourceStatus: 'ok',
    errorCategory: null,
    orientation: { value: 'sourcePrimaryIsOffense' },
    selectionPolicy: { rule: 'canonical' },
    keyMatchups,
    offensePlayers: Array.from({ length: offensePlayerCount }, (_, index) => ({
      ...player(3000 + index, index % 2 === 0 ? 1 : 2, index % 2 === 0 ? 'BOS' : 'PHI'),
      matchupCount: 4,
      maxPartialPossessions: 20,
    })),
    selectedOffense: null,
    sources: { matchups: 'MatchupsV3', traditional: 'TraditionalV3' },
    dataQuality: { orientationVerified: true },
  };
}

function availability(summary, overrides = {}) {
  return resolveMatchupSummaryV2Availability({
    featureEnabled: true,
    gameId: summary?.gameId ?? '0042500117',
    isPending: false,
    isFetching: false,
    isError: false,
    data: summary,
    error: null,
    ...overrides,
  });
}

function error(category, retryable, extra = {}) {
  return new MatchupSummaryV2Error('fixture failure', { category, retryable, ...extra });
}

const fixture114 = summaryFixture('0042500114', 27, false);
const fixture117 = summaryFixture('0042500117', 19, true);

describe('SummaryV2 v1.1 nullability contract', () => {
  test('0042500114 production-shaped fixture is accepted and ready', () => {
    expect(validateGameMatchupSummaryV2Response(fixture114, '0042500114').ok).toBe(true);
    expect(availability(fixture114).state).toBe('ready');
  });

  test('0042500117 nullable turnover shares are accepted and ready', () => {
    expect(validateGameMatchupSummaryV2Response(fixture117, '0042500117').ok).toBe(true);
    expect(availability(fixture117).state).toBe('ready');
  });

  test.each([null, 0, 0.5])('shareOfFullGameTurnovers %p is accepted', (value) => {
    const fixture = structuredClone(fixture117);
    fixture.keyMatchups[0].factorContext.ballSecurity.shareOfFullGameTurnovers = value;
    expect(validateGameMatchupSummaryV2Response(fixture, fixture.gameId).ok).toBe(true);
  });

  test('an absent optional turnover share is accepted', () => {
    const fixture = structuredClone(fixture117);
    delete fixture.keyMatchups[0].factorContext.ballSecurity.shareOfFullGameTurnovers;
    expect(validateGameMatchupSummaryV2Response(fixture, fixture.gameId).ok).toBe(true);
  });

  test('a string turnover share is rejected without coercion', () => {
    const fixture = structuredClone(fixture117);
    fixture.keyMatchups[0].factorContext.ballSecurity.shareOfFullGameTurnovers = '0.5';
    const result = validateGameMatchupSummaryV2Response(fixture, fixture.gameId);
    expect(result.ok).toBe(false);
    expect(result.path).toBe('$.keyMatchups[0].factorContext.ballSecurity.shareOfFullGameTurnovers');
  });

  test('non-finite numeric context is rejected', () => {
    const fixture = structuredClone(fixture117);
    fixture.keyMatchups[0].factorContext.ballSecurity.shareOfFullGameTurnovers = Number.POSITIVE_INFINITY;
    expect(validateGameMatchupSummaryV2Response(fixture, fixture.gameId).ok).toBe(false);
  });

  test('malformed required pairing data is rejected with an identity path', () => {
    const fixture = structuredClone(fixture117);
    fixture.keyMatchups[0].pairing.defense.playerId = null;
    const result = validateGameMatchupSummaryV2Response(fixture, fixture.gameId);
    expect(result.ok).toBe(false);
    expect(result.category).toBe('pairIdentityMismatch');
    expect(result.path).toBe('$.keyMatchups[0].pairing.defense.playerId');
  });

  test.each([
    ['contractRelease', '2.0', 'contractReleaseMismatch'],
    ['schemaVersion', 'courtPulseMatchup2.summary.v2', 'schemaMismatch'],
  ])('wrong %s is rejected', (key, value, category) => {
    const fixture = structuredClone(fixture117);
    fixture[key] = value;
    const result = validateGameMatchupSummaryV2Response(fixture, fixture.gameId);
    expect(result.ok).toBe(false);
    expect(result.category).toBe(category);
  });
});

describe('explicit availability and retry state', () => {
  test('valid keyMatchups empty resolves empty rather than disabled', () => {
    const fixture = structuredClone(fixture117);
    fixture.keyMatchups = [];
    expect(validateGameMatchupSummaryV2Response(fixture, fixture.gameId).ok).toBe(true);
    expect(availability(fixture).state).toBe('empty');
  });

  test('a transient 5xx stays loading while retrying and then reaches ready', () => {
    const transient = error('http5xx', true, { httpStatus: 503 });
    expect(shouldRetryGameMatchupSummaryV2(0, transient)).toBe(true);
    expect(availability(undefined, { isPending: true, error: transient }).state).toBe('loading');
    expect(availability(fixture117).state).toBe('ready');
  });

  test('exhausted transient retries resolve transientError', () => {
    const transient = error('http5xx', true, { httpStatus: 503 });
    expect(shouldRetryGameMatchupSummaryV2(1, transient)).toBe(false);
    expect(availability(undefined, { isError: true, error: transient }).state).toBe('transientError');
  });

  test.each(['contractReleaseMismatch', 'schemaMismatch', 'structuralValidation'])('%s does not retry and resolves contractError', (category) => {
    const contractFailure = error(category, false);
    expect(shouldRetryGameMatchupSummaryV2(0, contractFailure)).toBe(false);
    expect(availability(undefined, { isError: true, error: contractFailure }).state).toBe('contractError');
  });

  test('an explicitly unsupported response resolves unsupported', () => {
    const unsupported = error('unsupported', false, { sourceStatus: 'unsupported' });
    expect(shouldRetryGameMatchupSummaryV2(0, unsupported)).toBe(false);
    expect(availability(undefined, { isError: true, error: unsupported }).state).toBe('unsupported');
  });

  test('validated LIVE cache survives a transient refresh failure', () => {
    const state = availability(fixture117, {
      isFetching: false,
      isError: true,
      error: error('network', true),
    });
    expect(state.state).toBe('ready');
    expect(state.isRetainingCachedDataAfterError).toBe(true);
  });

  test('feature flag off takes precedence over cached validated data', () => {
    expect(availability(fixture117, { featureEnabled: false }).state).toBe('disabled');
  });

  test('new game identity does not reuse previous-game SummaryV2 data', () => {
    expect(gameMatchupSummaryV2QueryKey('game-a')).not.toEqual(gameMatchupSummaryV2QueryKey('game-b'));
    expect(availability(undefined, { gameId: 'game-b', isPending: true }).state).toBe('loading');
    expect(availability(fixture117, { gameId: 'game-b' }).state).toBe('contractError');
  });
});

describe('Matchup Events identity isolation regression', () => {
  const events = {
    success: true,
    type: 'statsGameMatchupEventsV2',
    gameId: '0042500117',
    contractRelease: '1.3',
    schemaVersion: 'courtPulseMatchup2.events.v1.3',
    sourceStatus: 'ok',
    errorCategory: null,
    pairing: { offense: player(10, 1), defense: player(20, 2, 'PHI') },
    matchupExposure: {
      matchupTime: '2:00',
      matchupSeconds: 120,
      partialPossessions: 8,
      percentageTotalTimeBothOn: 0.2,
    },
    defenderActivity: {
      steals: { count: 0, eventIds: [], provenance: 'official', status: 'verified' },
      blocks: { count: 0, eventIds: [], provenance: 'official', status: 'verified' },
      shootingFoulsCommitted: { count: 0, provenance: 'official', status: 'verified' },
      offensiveFoulTurnoversAttributedToPair: { count: 0, eventIds: [], provenance: 'official', status: 'verifiedPairAttribution' },
      offensiveFoulsDrawn: { count: null, eventIds: [], provenance: 'unavailable', status: 'unavailable' },
    },
    eventSummary: { totalEvidenceEvents: 0 },
    events: [],
  };

  test('accepts only the requested game and pair', () => {
    expect(isGameMatchupEventsV2ResponseForPair(events, '0042500117', '10', '20')).toBe(true);
    expect(isGameMatchupEventsV2ResponseForPair(events, '0042500114', '10', '20')).toBe(false);
    expect(isGameMatchupEventsV2ResponseForPair(events, '0042500117', '10', '21')).toBe(false);
  });
});
