import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import {
  classifyPlayoffCatalogAcquisition,
  PlayoffCatalogUnavailableError,
  requireUsablePlayoffCatalog,
} from '../services/playoffCatalogAvailability';

const playoffsSource = readFileSync(new URL('../app/playoffs.tsx', import.meta.url), 'utf8');
const proxySource = readFileSync(new URL('../services/nbaDataProxy.ts', import.meta.url), 'utf8');

function game(gameId = '0042500111') {
  return {
    gameId,
    primaryDate: '2026-04-18',
    gameStatus: 1,
    gameStatusText: '7:30 pm ET',
    homeTeam: { teamId: 1, teamTricode: 'BOS', teamName: 'Celtics' },
    awayTeam: { teamId: 2, teamTricode: 'PHI', teamName: '76ers' },
  };
}

function series(games, seriesKey = '1-2') {
  return {
    seriesKey,
    gameCount: games.length,
    games,
  };
}

function populatedCatalog(source = 'scheduleLeague') {
  const games = [game()];
  const seriesList = [series(games)];
  return {
    success: true,
    type: 'playoffCatalog',
    source,
    sourceStatus: 'ok',
    errorCategory: null,
    noGamesConfirmed: true,
    playoffGameCount: games.length,
    seriesCount: seriesList.length,
    games,
    series: seriesList,
  };
}

function zeroCatalog(source = 'scheduleLeague') {
  return {
    success: true,
    type: 'playoffCatalog',
    source,
    sourceStatus: 'ok',
    errorCategory: null,
    noGamesConfirmed: true,
    playoffGameCount: 0,
    seriesCount: 0,
    games: [],
    series: [],
  };
}

describe('Candidate A1 playoff catalog acquisition classification', () => {
  test.each(['scheduleLeague', 'statsLeagueGameLog'])(
    'accepts a compatible populated %s catalog',
    (source) => {
      const result = classifyPlayoffCatalogAcquisition(populatedCatalog(source));
      expect(result.state).toBe('usable');
      if (result.state === 'usable') {
        expect(result.catalog.source).toBe(source);
      }
    },
  );


  test('accepts a valid populated multi-series catalog with exact unique membership', () => {
    const games = [
      game('0042500111'),
      game('0042500112'),
      game('0042500211'),
    ];
    const seriesList = [
      series(games.slice(0, 2), 'series-a'),
      series([games[2]], 'series-b'),
    ];
    const result = classifyPlayoffCatalogAcquisition({
      ...populatedCatalog(),
      playoffGameCount: games.length,
      seriesCount: seriesList.length,
      games,
      series: seriesList,
    });
    expect(result.state).toBe('usable');
  });

  test('rejects a top-level game not referenced by any series', () => {
    const games = [game('0042500111'), game('0042500112')];
    const result = classifyPlayoffCatalogAcquisition({
      ...populatedCatalog(),
      playoffGameCount: games.length,
      games,
      series: [series([games[0]])],
    });
    expect(result).toMatchObject({ state: 'unavailable', reason: 'incompatiblePayload' });
  });

  test('rejects duplicate top-level game IDs', () => {
    const duplicateGame = game('0042500111');
    const games = [duplicateGame, { ...duplicateGame }];
    const result = classifyPlayoffCatalogAcquisition({
      ...populatedCatalog(),
      playoffGameCount: games.length,
      games,
      series: [series(games)],
    });
    expect(result).toMatchObject({ state: 'unavailable', reason: 'incompatiblePayload' });
  });

  test('rejects duplicate game membership within a series', () => {
    const topLevelGame = game('0042500111');
    const result = classifyPlayoffCatalogAcquisition({
      ...populatedCatalog(),
      games: [topLevelGame],
      series: [series([topLevelGame, { ...topLevelGame }])],
    });
    expect(result).toMatchObject({ state: 'unavailable', reason: 'incompatiblePayload' });
  });

  test('rejects a game assigned to two different series', () => {
    const sharedGame = game('0042500111');
    const seriesList = [
      series([sharedGame], 'series-a'),
      series([{ ...sharedGame }], 'series-b'),
    ];
    const result = classifyPlayoffCatalogAcquisition({
      ...populatedCatalog(),
      seriesCount: seriesList.length,
      series: seriesList,
    });
    expect(result).toMatchObject({ state: 'unavailable', reason: 'incompatiblePayload' });
  });

  test('rejects duplicate series keys', () => {
    const games = [game('0042500111'), game('0042500211')];
    const seriesList = [
      series([games[0]], 'duplicate-key'),
      series([games[1]], 'duplicate-key'),
    ];
    const result = classifyPlayoffCatalogAcquisition({
      ...populatedCatalog(),
      playoffGameCount: games.length,
      seriesCount: seriesList.length,
      games,
      series: seriesList,
    });
    expect(result).toMatchObject({ state: 'unavailable', reason: 'incompatiblePayload' });
  });

  test.each([
    [{ success: false, type: 'playoffCatalog', clientErrorCategory: 'network' }, 'network'],
    [{ success: false, type: 'playoffCatalog', clientErrorCategory: 'timeout' }, 'timeout'],
    [{ success: false, type: 'playoffCatalog', clientErrorCategory: 'invalidJson' }, 'invalid JSON'],
    [{ success: false, type: 'playoffCatalog', httpStatus: 502 }, 'backend failure'],
  ])('classifies %s as unavailable request failure', (payload) => {
    const result = classifyPlayoffCatalogAcquisition(payload);
    expect(result).toMatchObject({ state: 'unavailable', reason: 'requestFailure' });
  });

  test.each([
    null,
    [],
    {},
    { ...populatedCatalog(), type: 'gamesByDate' },
    { ...populatedCatalog(), sourceStatus: 'failed' },
    { ...populatedCatalog(), source: '' },
    { ...populatedCatalog(), playoffGameCount: 2 },
    { ...populatedCatalog(), seriesCount: 2 },
    { ...populatedCatalog(), games: [{}] },
    {
      ...populatedCatalog(),
      series: [{ seriesKey: '1-2', gameCount: 1, games: [game('0042500999')] }],
    },
  ])('rejects structurally incompatible route payload %#', (payload) => {
    const result = classifyPlayoffCatalogAcquisition(payload);
    expect(result).toMatchObject({ state: 'unavailable', reason: 'incompatiblePayload' });
  });

  test.each(['scheduleLeague', 'statsLeagueGameLog'])(
    'does not grant authoritative-empty status to zero-result %s catalog',
    (source) => {
      const result = classifyPlayoffCatalogAcquisition(zeroCatalog(source));
      expect(result).toMatchObject({ state: 'unavailable', reason: 'zeroResult' });
    },
  );

  test('noGamesConfirmed does not make a zero-result catalog usable', () => {
    const result = classifyPlayoffCatalogAcquisition({
      ...zeroCatalog(),
      noGamesConfirmed: true,
    });
    expect(result).toMatchObject({ state: 'unavailable', reason: 'zeroResult' });
  });

  test('requireUsablePlayoffCatalog turns unavailable acquisition into an error', () => {
    expect(() => requireUsablePlayoffCatalog(zeroCatalog())).toThrow(PlayoffCatalogUnavailableError);
    try {
      requireUsablePlayoffCatalog(zeroCatalog());
    } catch (error) {
      expect(error).toBeInstanceOf(PlayoffCatalogUnavailableError);
      expect(error.reason).toBe('zeroResult');
    }
  });
});

describe('Candidate A1 Playoffs integration boundary', () => {
  test('classifies before bracket construction and removes acquisition-empty presentation', () => {
    expect(playoffsSource).toContain('requireUsablePlayoffCatalog(response)');
    expect(playoffsSource).toContain('queryFn: getUsablePlayoffCatalog');
    expect(playoffsSource).not.toContain('No playoff series found');
    expect(playoffsSource).toContain('Unable to establish a usable playoff catalog');
  });

  test('preserves filter-empty presentation after usable bracket data exists', () => {
    expect(playoffsSource).toContain('No series match these filters');
    expect(playoffsSource).toContain('bracket.rounds.length > 0 && displayRounds.length === 0 && hasActiveFilters');
  });

  test('leaves generic requestProxy and getPlayoffCatalog semantics outside A1', () => {
    expect(proxySource).toContain("return requestProxy<NbaPlayoffCatalogProxyResponse>('playoffCatalog');");
    expect(proxySource).not.toContain('playoffCatalogAvailability');
  });
});
