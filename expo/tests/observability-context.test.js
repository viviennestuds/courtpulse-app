import { describe, expect, test } from 'bun:test';
import {
  buildRouteObservabilityContext,
  isObservabilityConfigured,
  resolveObservabilityEnvironment,
  scrubObservabilityValue,
} from '../utils/observabilityContext.ts';

describe('CourtPulse observability context', () => {
  test('resolves stable runtime environments without random release state', () => {
    expect(resolveObservabilityEnvironment(true)).toBe('development');
    expect(resolveObservabilityEnvironment(false, 'preview')).toBe('preview');
    expect(resolveObservabilityEnvironment(false)).toBe('production');
  });

  test('remains disabled when the public runtime DSN is absent', () => {
    expect(isObservabilityConfigured(undefined)).toBe(false);
    expect(isObservabilityConfigured('   ')).toBe(false);
    expect(isObservabilityConfigured('https://public@example.ingest.sentry.io/1')).toBe(true);
  });

  test('classifies dynamic routes without using IDs as screen tags', () => {
    expect(buildRouteObservabilityContext('/game/0042500117?debug=true')).toEqual({
      pathname: '/game/0042500117',
      routePattern: '/game/[id]',
      screen: 'game',
      gameId: '0042500117',
    });
    expect(buildRouteObservabilityContext('/game/0042500117/player/2544')).toEqual({
      pathname: '/game/0042500117/player/2544',
      routePattern: '/game/[id]/player/[playerId]',
      screen: 'game_player',
      gameId: '0042500117',
      playerId: '2544',
    });
    expect(buildRouteObservabilityContext('/players')).toMatchObject({ screen: 'players' });
  });

  test('scrubs feedback, search, payload, credential, and URL query data', () => {
    const scrubbed = scrubObservabilityValue({
      description: 'private feedback',
      expectedBehavior: 'private expectation',
      reproSteps: 'private steps',
      testerContact: 'person@example.com',
      searchQuery: 'private player search',
      rawPayload: { players: ['raw data'] },
      headers: { authorization: 'Bearer secret', cookie: 'session=secret' },
      url: 'https://example.test/game/1?token=secret#fragment',
      safeMetric: 42,
    });

    expect(scrubbed).toEqual({
      description: '[Filtered]',
      expectedBehavior: '[Filtered]',
      reproSteps: '[Filtered]',
      testerContact: '[Filtered]',
      searchQuery: '[Filtered]',
      rawPayload: '[Filtered]',
      headers: { authorization: '[Filtered]', cookie: '[Filtered]' },
      url: 'https://example.test/game/1',
      safeMetric: 42,
    });
  });
});
