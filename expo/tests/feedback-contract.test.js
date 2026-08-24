import { describe, expect, test } from 'bun:test';
import {
  buildFeedbackSentryContext,
  buildFeedbackSubmissionRequest,
  ensureFeedbackSubmissionAttempt,
  feedbackAttemptAfterFailure,
  normalizeFeedbackEndpoint,
  parseFeedbackSubmissionResponse,
} from '../utils/feedbackContract.ts';
import { FEEDBACK_IDEMPOTENCY_PAYLOAD_MISMATCH_CODE } from '../types/feedback.ts';

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
    }, runtime, '123e4567-e89b-42d3-a456-426614174000', '0123456789abcdef0123456789abcdef');

    expect(request).toEqual({
      schemaVersion: 'courtPulse.feedback.v1',
      submissionId: '123e4567-e89b-42d3-a456-426614174000',
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
      idempotentReplay: false,
      sentryEventId: '0123456789abcdef0123456789abcdef',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.feedbackReference).toBe('CP-FB-123E45');
      expect(result.notificationStatus).toBe('failed');
    }
  });

  test('parses payload mismatch as a restrained typed 409 conflict without fingerprint leakage', () => {
    const storedFingerprint = 'a'.repeat(64);
    const incomingFingerprint = 'b'.repeat(64);
    const result = parseFeedbackSubmissionResponse(409, {
      ok: false,
      error: {
        code: FEEDBACK_IDEMPOTENCY_PAYLOAD_MISMATCH_CODE,
        message: `private ${storedFingerprint} ${incomingFingerprint}`,
        retryable: true,
      },
    });

    expect(result).toEqual({
      ok: false,
      error: {
        code: FEEDBACK_IDEMPOTENCY_PAYLOAD_MISMATCH_CODE,
        message: 'The earlier version of this report was already received. Submit again to send your edited version.',
        retryable: false,
      },
    });
    expect(JSON.stringify(result)).not.toContain(storedFingerprint);
    expect(JSON.stringify(result)).not.toContain(incomingFingerprint);
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

  test('retains one submission UUID and one Sentry event across retries', () => {
    let uuidCalls = 0;
    let sentryCalls = 0;
    const createSubmissionId = () => {
      uuidCalls += 1;
      return '123e4567-e89b-42d3-a456-426614174000';
    };
    const captureCorrelation = () => {
      sentryCalls += 1;
      return '0123456789abcdef0123456789abcdef';
    };
    const context = { screen: 'GameDetail', route: '/game/0042500117' };

    const first = ensureFeedbackSubmissionAttempt(
      null,
      'bug',
      context,
      createSubmissionId,
      captureCorrelation,
    );
    const retry = ensureFeedbackSubmissionAttempt(
      first,
      'bug',
      context,
      createSubmissionId,
      captureCorrelation,
    );

    expect(retry).toBe(first);
    expect(retry).toEqual({
      submissionId: '123e4567-e89b-42d3-a456-426614174000',
      sentryEventId: '0123456789abcdef0123456789abcdef',
    });
    expect(uuidCalls).toBe(1);
    expect(sentryCalls).toBe(1);
  });

  test('clears a mismatched technical attempt and creates new UUID and Sentry identity on the next press', () => {
    const form = {
      type: 'bug',
      title: 'Edited title',
      description: 'Edited description remains visible',
    };
    const oldAttempt = {
      submissionId: '123e4567-e89b-42d3-a456-426614174000',
      sentryEventId: '0123456789abcdef0123456789abcdef',
    };
    const mismatch = parseFeedbackSubmissionResponse(409, {
      ok: false,
      error: {
        code: FEEDBACK_IDEMPOTENCY_PAYLOAD_MISMATCH_CODE,
        message: 'server copy is not trusted',
        retryable: false,
      },
    });
    if (mismatch.ok) throw new Error('expected mismatch failure');

    const retainedForm = form;
    const clearedAttempt = feedbackAttemptAfterFailure(oldAttempt, mismatch);
    let sentryCalls = 0;
    const nextAttempt = ensureFeedbackSubmissionAttempt(
      clearedAttempt,
      form.type,
      { screen: 'GameDetail', route: '/game/0042500117' },
      () => '223e4567-e89b-42d3-a456-426614174000',
      () => {
        sentryCalls += 1;
        return 'fedcba9876543210fedcba9876543210';
      },
    );

    expect(retainedForm).toBe(form);
    expect(clearedAttempt).toBeNull();
    expect(nextAttempt.submissionId).not.toBe(oldAttempt.submissionId);
    expect(nextAttempt.sentryEventId).not.toBe(oldAttempt.sentryEventId);
    expect(sentryCalls).toBe(1);
  });

  test('retains the same attempt after a normal uncertain transport failure', () => {
    const attempt = {
      submissionId: '123e4567-e89b-42d3-a456-426614174000',
      sentryEventId: '0123456789abcdef0123456789abcdef',
    };
    const timeout = parseFeedbackSubmissionResponse(503, {
      ok: false,
      error: { code: 'timeout', message: 'private transport detail', retryable: true },
    });
    if (timeout.ok) throw new Error('expected transport failure');
    expect(feedbackAttemptAfterFailure(attempt, timeout)).toBe(attempt);
  });

  test('keeps non-technical attempts Sentry-free before and after mismatch reset', () => {
    let sentryCalls = 0;
    const attempt = ensureFeedbackSubmissionAttempt(
      null,
      'feature_request',
      { screen: 'Games' },
      () => '123e4567-e89b-42d3-a456-426614174000',
      () => {
        sentryCalls += 1;
        return '0123456789abcdef0123456789abcdef';
      },
    );
    expect(attempt.sentryEventId).toBeUndefined();
    const categoryChangedRequest = buildFeedbackSubmissionRequest(
      {
        type: 'feature_request',
        title: 'Edited feature request',
        description: 'Changed from an earlier technical category',
      },
      { screen: 'Games' },
      runtime,
      attempt.submissionId,
      '0123456789abcdef0123456789abcdef',
    );
    expect(categoryChangedRequest.sentryEventId).toBeUndefined();

    const mismatch = parseFeedbackSubmissionResponse(409, {
      ok: false,
      error: {
        code: FEEDBACK_IDEMPOTENCY_PAYLOAD_MISMATCH_CODE,
        message: 'different content',
        retryable: false,
      },
    });
    if (mismatch.ok) throw new Error('expected mismatch failure');
    const clearedAttempt = feedbackAttemptAfterFailure(attempt, mismatch);
    const nextAttempt = ensureFeedbackSubmissionAttempt(
      clearedAttempt,
      'feature_request',
      { screen: 'Games' },
      () => '223e4567-e89b-42d3-a456-426614174000',
      () => {
        sentryCalls += 1;
        return 'fedcba9876543210fedcba9876543210';
      },
    );

    expect(clearedAttempt).toBeNull();
    expect(nextAttempt.submissionId).not.toBe(attempt.submissionId);
    expect(nextAttempt.sentryEventId).toBeUndefined();
    expect(sentryCalls).toBe(0);
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
