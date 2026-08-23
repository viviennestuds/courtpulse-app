import { describe, expect, test } from 'bun:test';
import {
  buildFeedbackSentryContext,
  buildFeedbackSubmissionRequest,
  normalizeFeedbackEndpoint,
  parseFeedbackSubmissionResponse,
} from '../utils/feedbackContract.ts';

const runtime = {
  platform: 'web',
  environment: 'development',
  appVersion: '1.2.0-MVP',
  buildIdentifier: '2026-04-09',
  stabilityChannel: 'stable',
  featureContext: {
    enabledFlags: ['feedback_reporting_enabled'],
    authorization: 'must not leave the client',
  },
};

describe('CourtPulse feedback client contract', () => {
  test('accepts only the durable submit-feedback Edge Function endpoint', () => {
    expect(normalizeFeedbackEndpoint('https://project.supabase.co/functions/v1/submit-feedback')).toBe(
      'https://project.supabase.co/functions/v1/submit-feedback',
    );
    expect(normalizeFeedbackEndpoint('https://script.google.com/macros/s/legacy/exec')).toBe('');
    expect(normalizeFeedbackEndpoint('https://api.example.com/api/feedback')).toBe('');
    expect(normalizeFeedbackEndpoint(undefined)).toBe('');
  });

  test('constructs the explicit v1 payload and constrains structured context', () => {
    const request = buildFeedbackSubmissionRequest({
      type: 'bug',
      title: '  Shot chart issue  ',
      description: '  A point is misplaced.  ',
      expectedBehavior: ' correct location ',
      testerName: 'Private Reporter',
      testerContact: 'private@example.com',
    }, {
      screen: 'GameDetail',
      subscreen: 'Shots',
      route: '/game/0042500117?debug=true',
      gameId: '0042500117',
      filters: { team: 'home', token: 'must be removed' },
      extra: { activeGameTab: 'shots' },
    }, runtime, '0123456789abcdef0123456789abcdef');

    expect(request).toEqual({
      schemaVersion: 'courtPulse.feedback.v1',
      category: 'bug',
      title: 'Shot chart issue',
      description: 'A point is misplaced.',
      expectedBehavior: 'correct location',
      actualBehavior: undefined,
      reproSteps: undefined,
      reporterName: 'Private Reporter',
      reporterContact: 'private@example.com',
      context: {
        platform: 'web',
        environment: 'development',
        appVersion: '1.2.0-MVP',
        buildIdentifier: '2026-04-09',
        stabilityChannel: 'stable',
        screen: 'GameDetail',
        subscreen: 'Shots',
        route: '/game/0042500117',
        gameId: '0042500117',
        activeGameTab: 'shots',
        filters: { team: 'home' },
        featureContext: { enabledFlags: ['feedback_reporting_enabled'] },
      },
      sentryEventId: '0123456789abcdef0123456789abcdef',
      source: 'courtpulse_app',
    });
  });

  test('parses durable success without requiring notification success', () => {
    const result = parseFeedbackSubmissionResponse(201, {
      ok: true,
      schemaVersion: 'courtPulse.feedback.v1',
      feedbackId: '123e4567-e89b-12d3-a456-426614174000',
      feedbackReference: 'CP-FB-123E45',
      notificationStatus: 'failed',
      sentryEventId: '0123456789abcdef0123456789abcdef',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.feedbackReference).toBe('CP-FB-123E45');
      expect(result.notificationStatus).toBe('failed');
    }
  });

  test('sanitizes backend failures and rejects malformed success responses', () => {
    expect(parseFeedbackSubmissionResponse(503, {
      ok: false,
      error: { code: 'persistence_unavailable', message: 'private database detail', retryable: true },
    })).toEqual({
      ok: false,
      error: { code: 'persistence_unavailable', message: 'Feedback could not be sent', retryable: true },
    });
    expect(parseFeedbackSubmissionResponse(201, { ok: true, feedbackId: 'not-a-uuid' })).toMatchObject({
      ok: false,
      error: { code: 'invalid_response' },
    });
  });

  test('correlates only technical categories with privacy-safe metadata', () => {
    const context = {
      screen: 'GameDetail',
      subscreen: 'Matchup:Runs',
      route: '/game/0042500117?debug=true',
      gameId: '0042500117',
      filters: { search: 'private search' },
      extra: { activeGameTab: 'matchup', reporterContact: 'private@example.com' },
    };
    expect(buildFeedbackSentryContext('bug', context)).toEqual({
      feedback_category: 'bug',
      feedback_correlation: true,
      route: '/game/0042500117',
      gameId: '0042500117',
      activeGameTab: 'matchup',
    });
    expect(buildFeedbackSentryContext('performance', context)).not.toBeNull();
    expect(buildFeedbackSentryContext('feature_request', context)).toBeNull();
    expect(buildFeedbackSentryContext('question', context)).toBeNull();
    expect(JSON.stringify(buildFeedbackSentryContext('bug', context))).not.toContain('private');
  });
});
