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
    expectedBehavior: 'The point appears at the recorded location',
    actualBehavior: 'The point appears on the opposite side',
    reproSteps: 'Open the game, then select the Shots tab',
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

function validateRequest(request) {
  const result = validateFeedbackSubmission(request);
  if (!result.ok || !result.value) throw new Error(result.error ?? 'validation failed');
  return result.value;
}

function validatedPayload() {
  return validateRequest(validRequest());
}

function persistedRecordFrom(payload, overrides = {}) {
  return {
    id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
    notification_status: 'pending',
    sentry_event_id: payload.sentryEventId ?? null,
    content_fingerprint: 'a'.repeat(64),
    category: payload.category,
    title: payload.title,
    description: payload.description,
    expected_behavior: payload.expectedBehavior ?? null,
    actual_behavior: payload.actualBehavior ?? null,
    repro_steps: payload.reproSteps ?? null,
    reporter_name: payload.reporterName ?? null,
    reporter_contact: payload.reporterContact ?? null,
    ...overrides,
  };
}

describe('feedback idempotency and server policy', () => {
  test('first submission and uncertain-timeout retry preserve one row, Sentry identity, and notification', async () => {
    const payload = validatedPayload();
    const records = new Map();
    let insertCount = 0;
    let notificationCount = 0;

    const persist = () => persistFeedbackIdempotently(
      payload,
      async () => {
        if (records.has(payload.submissionId)) return { record: null, errorCode: '23505' };
        insertCount += 1;
        const record = persistedRecordFrom(payload);
        records.set(payload.submissionId, record);
        return { record };
      },
      async () => ({ record: records.get(payload.submissionId) ?? null }),
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
      expect(retry.record.sentry_event_id).toBe(payload.sentryEventId);
      notificationCount += shouldAttemptImmediateNotification('immediate', retry.idempotentReplay) ? 1 : 0;
    }
    expect(records.size).toBe(1);
    expect(insertCount).toBe(1);
    expect(notificationCount).toBe(1);
  });

  test('accepts an identical complete user-authored report as a replay', async () => {
    const payload = validatedPayload();
    const record = persistedRecordFrom(payload, {
      content_fingerprint: await createContentFingerprint(payload),
    });

    const replay = await persistFeedbackIdempotently(
      payload,
      async () => ({ record: null, errorCode: '23505' }),
      async () => ({ record }),
    );

    expect(replay).toMatchObject({ ok: true, idempotentReplay: true, record: { id: record.id } });
  });

  test('accepts a normalization-equivalent complete report after canonical validation', async () => {
    const base = validatedPayload();
    const equivalent = validateRequest({
      ...validRequest(),
      title: `  ${base.title}  `,
      description: `  ${base.description}  `,
      expectedBehavior: `  ${base.expectedBehavior}  `,
      actualBehavior: `  ${base.actualBehavior}  `,
      reproSteps: `  ${base.reproSteps}  `,
      reporterName: `  ${base.reporterName}  `,
      reporterContact: `  ${base.reporterContact}  `,
      context: {
        ...validRequest().context,
        route: '/game/0042500117?different=true#summary',
      },
    });
    const originalFingerprint = await createContentFingerprint(base);
    const equivalentFingerprint = await createContentFingerprint(equivalent);
    const record = persistedRecordFrom(base, { content_fingerprint: originalFingerprint });

    const replay = await persistFeedbackIdempotently(
      equivalent,
      async () => ({ record: null, errorCode: '23505' }),
      async () => ({ record }),
    );

    expect(equivalentFingerprint).toBe(originalFingerprint);
    expect(replay).toMatchObject({ ok: true, idempotentReplay: true, record: { id: record.id } });
  });

  const changedUserFields = [
    ['category', 'performance'],
    ['expectedBehavior', 'The chart should retain every point'],
    ['actualBehavior', 'Chart disappeared after selecting Q4'],
    ['reproSteps', 'Open the game, select Q4, then select Shots'],
    ['reporterName', 'Reporter B'],
    ['reporterContact', 'reporter-b@example.com'],
    ['title', 'Shot chart vanished'],
    ['description', 'The plotted point disappears after the quarter changes.'],
  ];

  for (const [field, changedValue] of changedUserFields) {
    test(`rejects a duplicate ID when only ${field} changes without mutation or notification`, async () => {
      const originalPayload = validatedPayload();
      const incomingPayload = { ...originalPayload, [field]: changedValue };
      const originalRecord = persistedRecordFrom(originalPayload, {
        notification_status: 'sent',
        content_fingerprint: await createContentFingerprint(originalPayload),
      });
      const storedRecord = structuredClone(originalRecord);
      let insertedRows = 1;
      let notificationCount = 1;

      const mismatch = await persistFeedbackIdempotently(
        incomingPayload,
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
      expect(JSON.stringify(mismatch)).not.toContain(originalPayload.reporterName);
      expect(JSON.stringify(mismatch)).not.toContain(originalPayload.reporterContact);
    });
  }

  test('treats absent validated optional values as equivalent to persisted NULL', async () => {
    const request = validRequest();
    delete request.expectedBehavior;
    delete request.actualBehavior;
    delete request.reproSteps;
    delete request.reporterName;
    delete request.reporterContact;
    const payload = validateRequest(request);
    const record = persistedRecordFrom(payload);

    const replay = await persistFeedbackIdempotently(
      payload,
      async () => ({ record: null, errorCode: '23505' }),
      async () => ({ record }),
    );

    expect(record.expected_behavior).toBeNull();
    expect(record.reporter_contact).toBeNull();
    expect(replay).toMatchObject({ ok: true, idempotentReplay: true });
  });

  test('does not treat volatile technical context as user-authored replay identity', async () => {
    const originalPayload = validatedPayload();
    const retryPayload = {
      ...originalPayload,
      sentryEventId: 'fedcba9876543210fedcba9876543210',
      context: {
        ...originalPayload.context,
        environment: 'production',
        buildIdentifier: 'different-build',
        route: '/players',
        gameId: 'different-game',
        filters: { team: 'away' },
        featureContext: { enabledFlags: ['different_flag'] },
      },
    };
    const record = persistedRecordFrom(originalPayload, {
      content_fingerprint: await createContentFingerprint(originalPayload),
    });

    const replay = await persistFeedbackIdempotently(
      retryPayload,
      async () => ({ record: null, errorCode: '23505' }),
      async () => ({ record }),
    );

    expect(await createContentFingerprint(retryPayload)).not.toBe(record.content_fingerprint);
    expect(replay).toMatchObject({ ok: true, idempotentReplay: true });
    if (replay.ok) expect(replay.record.sentry_event_id).toBe(originalPayload.sentryEventId);
  });

  test('does not convert non-unique persistence errors into replay success', async () => {
    const payload = validatedPayload();
    const result = await persistFeedbackIdempotently(
      payload,
      async () => ({ record: null, errorCode: '42501' }),
      async () => ({ record: persistedRecordFrom(payload, { id: 'must-not-load' }) }),
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
      expectedBehavior: 'A different expected result',
      actualBehavior: 'A different actual result',
      reproSteps: 'A different sequence of steps',
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
