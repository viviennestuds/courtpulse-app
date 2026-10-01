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

function series(games) {
  return {
    seriesKey: '1-2',
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
