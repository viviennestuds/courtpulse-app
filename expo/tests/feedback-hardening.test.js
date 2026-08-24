import { describe, expect, test } from 'bun:test';
import { persistFeedbackIdempotently } from '../../backend/functions/submit-feedback/idempotency.ts';
import {
  DEFAULT_DIGEST_WINDOW_MINUTES,
  createContentFingerprint,
  notificationClassForCategory,
  notificationEligibilityForSubmission,
  resolveDigestWindowMinutes,
  shouldAttemptImmediateNotification,
  validateFeedbackSubmission,
} from '../../backend/functions/submit-feedback/validation.ts';

function validRequest() {
  return {
    schemaVersion: 'courtPulse.feedback.v1',
    submissionId: '123e4567-e89b-42d3-a456-426614174000',
    category: 'bug',
    title: '  Shot Chart   Point Wrong  ',
    description: ' The plotted point is on the wrong side. ',
    reporterName: 'Reporter A',
    reporterContact: 'reporter-a@example.com',
    context: {
      platform: 'web',
      environment: 'development',
      appVersion: '1.2.0-MVP',
      buildIdentifier: '2026-04-09',
      stabilityChannel: 'stable',
      screen: 'GameDetail',
      route: '/game/0042500117?debug=true#shots',
      gameId: '0042500117',
      filters: {},
      featureContext: {},
    },
    sentryEventId: '0123456789abcdef0123456789abcdef',
    source: 'courtpulse_app',
  };
}

function validatedPayload() {
  const result = validateFeedbackSubmission(validRequest());
  if (!result.ok || !result.value) throw new Error(result.error ?? 'validation failed');
  return result.value;
}

describe('feedback idempotency and server policy', () => {
  test('first submission inserts and repeated submission returns the same record', async () => {
    const records = new Map();
    let insertCount = 0;
    let notificationCount = 0;
    const submissionId = '123e4567-e89b-42d3-a456-426614174000';
    const contentFingerprint = 'a'.repeat(64);

    const persist = () => persistFeedbackIdempotently(
      contentFingerprint,
      async () => {
        if (records.has(submissionId)) return { record: null, errorCode: '23505' };
        insertCount += 1;
        const record = {
          id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
          notification_status: 'pending',
          sentry_event_id: '0123456789abcdef0123456789abcdef',
          content_fingerprint: contentFingerprint,
        };
        records.set(submissionId, record);
        return { record };
      },
      async () => ({ record: records.get(submissionId) ?? null }),
    );

    const first = await persist();
    const retry = await persist();
    expect(first).toMatchObject({ ok: true, idempotentReplay: false });
    expect(retry).toMatchObject({ ok: true, idempotentReplay: true });
    if (first.ok) {
      notificationCount += shouldAttemptImmediateNotification('immediate', first.idempotentReplay) ? 1 : 0;
    }
    if (retry.ok) {
      expect(retry.record.id).toBe(first.ok ? first.record.id : undefined);
      notificationCount += shouldAttemptImmediateNotification('immediate', retry.idempotentReplay) ? 1 : 0;
    }
    expect(records.size).toBe(1);
    expect(insertCount).toBe(1);
    expect(notificationCount).toBe(1);
  });

  test('accepts a duplicate ID when normalized content has the same fingerprint', async () => {
    const base = validatedPayload();
    const equivalent = {
      ...base,
      title: 'shot chart point wrong',
      description: 'the plotted point is on the wrong side.',
      context: { ...base.context, route: '/game/0042500117?different=true#summary' },
    };
    const originalFingerprint = await createContentFingerprint(base);
    const equivalentFingerprint = await createContentFingerprint(equivalent);
    const record = {
      id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
      notification_status: 'pending',
      sentry_event_id: '0123456789abcdef0123456789abcdef',
      content_fingerprint: originalFingerprint,
    };

    const replay = await persistFeedbackIdempotently(
      equivalentFingerprint,
      async () => ({ record: null, errorCode: '23505' }),
      async () => ({ record }),
    );

    expect(equivalentFingerprint).toBe(originalFingerprint);
    expect(replay).toMatchObject({ ok: true, idempotentReplay: true, record: { id: record.id } });
  });

  test('rejects a duplicate ID with different content without overwrite, insertion, notification, or leakage', async () => {
    const originalFingerprint = 'a'.repeat(64);
    const incomingFingerprint = 'b'.repeat(64);
    const originalRecord = {
      id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
      notification_status: 'sent',
      sentry_event_id: '0123456789abcdef0123456789abcdef',
      content_fingerprint: originalFingerprint,
      title: 'Original title',
      description: 'Original description',
    };
    const storedRecord = structuredClone(originalRecord);
    let insertedRows = 1;
    let notificationCount = 1;

    const mismatch = await persistFeedbackIdempotently(
      incomingFingerprint,
      async () => ({ record: null, errorCode: '23505' }),
      async () => ({ record: storedRecord }),
    );
    if (mismatch.ok) {
      insertedRows += 1;
      notificationCount += shouldAttemptImmediateNotification('immediate', mismatch.idempotentReplay) ? 1 : 0;
    }

    expect(mismatch).toEqual({ ok: false, errorCode: 'idempotency_payload_mismatch' });
    expect(storedRecord).toEqual(originalRecord);
    expect(insertedRows).toBe(1);
    expect(notificationCount).toBe(1);
    expect(JSON.stringify(mismatch)).not.toContain(originalFingerprint);
    expect(JSON.stringify(mismatch)).not.toContain(incomingFingerprint);
  });

  test('does not convert non-unique persistence errors into replay success', async () => {
    const result = await persistFeedbackIdempotently(
      'a'.repeat(64),
      async () => ({ record: null, errorCode: '42501' }),
      async () => ({
        record: {
          id: 'must-not-load',
          notification_status: 'pending',
          sentry_event_id: null,
          content_fingerprint: 'a'.repeat(64),
        },
      }),
    );
    expect(result).toEqual({ ok: false, errorCode: '42501' });
  });

  test('classifies only bug and performance as immediate', () => {
    expect(notificationClassForCategory('bug')).toBe('immediate');
    expect(notificationClassForCategory('performance')).toBe('immediate');
    for (const category of ['feature_request', 'ux_feedback', 'data_issue', 'question']) {
      expect(notificationClassForCategory(category)).toBe('digest');
    }
  });

  test('computes exact immediate and digest eligibility from a fixed clock', () => {
    const now = new Date('2026-08-23T12:00:00.000Z');
    expect(notificationEligibilityForSubmission('bug', now, '90')).toEqual({
      notificationClass: 'immediate',
      eligibleAt: '2026-08-23T12:00:00.000Z',
      digestWindowMinutes: 90,
    });
    expect(notificationEligibilityForSubmission('question', now, '90')).toEqual({
      notificationClass: 'digest',
      eligibleAt: '2026-08-23T13:30:00.000Z',
      digestWindowMinutes: 90,
    });
  });

  test('bounds digest configuration and safely falls back', () => {
    expect(resolveDigestWindowMinutes(undefined)).toBe(DEFAULT_DIGEST_WINDOW_MINUTES);
    expect(resolveDigestWindowMinutes('')).toBe(DEFAULT_DIGEST_WINDOW_MINUTES);
    expect(resolveDigestWindowMinutes('4')).toBe(DEFAULT_DIGEST_WINDOW_MINUTES);
    expect(resolveDigestWindowMinutes('1441')).toBe(DEFAULT_DIGEST_WINDOW_MINUTES);
    expect(resolveDigestWindowMinutes('60.5')).toBe(DEFAULT_DIGEST_WINDOW_MINUTES);
    expect(resolveDigestWindowMinutes('not-a-number')).toBe(DEFAULT_DIGEST_WINDOW_MINUTES);
    expect(resolveDigestWindowMinutes('5')).toBe(5);
    expect(resolveDigestWindowMinutes('1440')).toBe(1440);
  });

  test('never attempts immediate notifications for digest reports or replays', () => {
    expect(shouldAttemptImmediateNotification('digest', false)).toBe(false);
    expect(shouldAttemptImmediateNotification('digest', true)).toBe(false);
    expect(shouldAttemptImmediateNotification('immediate', true)).toBe(false);
    expect(shouldAttemptImmediateNotification('immediate', false)).toBe(true);
  });
});

describe('feedback content fingerprint', () => {
  test('is deterministic and excludes reporter, submission, and Sentry identity', async () => {
    const base = validatedPayload();
    const changedIdentity = {
      ...base,
      submissionId: '223e4567-e89b-42d3-a456-426614174000',
      reporterName: 'Reporter B',
      reporterContact: 'reporter-b@example.com',
      sentryEventId: 'fedcba9876543210fedcba9876543210',
    };
    const first = await createContentFingerprint(base);
    const second = await createContentFingerprint(base);
    const identityChanged = await createContentFingerprint(changedIdentity);
    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(second).toBe(first);
    expect(identityChanged).toBe(first);
  });

  test('normalizes casing, whitespace, and route query/fragment noise', async () => {
    const base = validatedPayload();
    const normalizedEquivalent = {
      ...base,
      title: 'shot chart point wrong',
      description: 'the plotted point is on the wrong side.',
      context: { ...base.context, route: '/game/0042500117?other=true#summary' },
    };
    expect(await createContentFingerprint(normalizedEquivalent)).toBe(
      await createContentFingerprint(base),
    );
  });

  test('changes when meaningful content or grouping context changes', async () => {
    const base = validatedPayload();
    const baseHash = await createContentFingerprint(base);
    const variants = [
      { ...base, title: 'Different title' },
      { ...base, description: 'Different description' },
      { ...base, category: 'performance' },
      { ...base, context: { ...base.context, gameId: 'different-game' } },
      { ...base, context: { ...base.context, route: '/players' } },
    ];
    for (const variant of variants) {
      expect(await createContentFingerprint(variant)).not.toBe(baseHash);
    }
  });
});
