import { describe, expect, test } from 'bun:test';
import { validateFeedbackSubmission } from '../../backend/functions/submit-feedback/validation.ts';

function validRequest() {
  return {
    schemaVersion: 'courtPulse.feedback.v1',
    category: 'bug',
    title: 'CourtPulse feedback integration test',
    description: 'Development-only persistence test',
    expectedBehavior: 'The report persists',
    context: {
      platform: 'web',
      environment: 'development',
      appVersion: '1.2.0-MVP',
      buildIdentifier: '2026-04-09',
      stabilityChannel: 'stable',
      screen: 'GameDetail',
      subscreen: 'Summary',
      route: '/game/0042500117',
      gameId: '0042500117',
      activeGameTab: 'summary',
      filters: { team: 'all' },
      featureContext: { enabledFlags: ['feedback_reporting_enabled'] },
    },
    sentryEventId: '0123456789abcdef0123456789abcdef',
    source: 'courtpulse_app',
  };
}

describe('submit-feedback Edge Function validation', () => {
  test('accepts and normalizes the canonical request', () => {
    const result = validateFeedbackSubmission(validRequest());
    expect(result.ok).toBe(true);
    expect(result.value?.category).toBe('bug');
    expect(result.value?.context.filters).toEqual({ team: 'all' });
  });

  test('rejects unknown categories and impossible client status fields', () => {
    expect(validateFeedbackSubmission({ ...validRequest(), category: 'incident' })).toMatchObject({
      ok: false,
      error: 'Invalid feedback category',
    });
    expect(validateFeedbackSubmission({ ...validRequest(), status: 'resolved' })).toMatchObject({
      ok: false,
      error: 'Invalid feedback payload',
    });
  });

  test('enforces text size limits', () => {
    expect(validateFeedbackSubmission({ ...validRequest(), title: 'x'.repeat(121) }).ok).toBe(false);
    expect(validateFeedbackSubmission({ ...validRequest(), description: 'x'.repeat(4001) }).ok).toBe(false);
    expect(validateFeedbackSubmission({ ...validRequest(), reporterContact: 'x'.repeat(201) }).ok).toBe(false);
  });

  test('requires bounded objects and rejects credential keys and encoded attachments', () => {
    const arrayFilters = validRequest();
    arrayFilters.context.filters = [];
    expect(validateFeedbackSubmission(arrayFilters).ok).toBe(false);

    const credentialContext = validRequest();
    credentialContext.context.filters = { authorization: 'Bearer private' };
    expect(validateFeedbackSubmission(credentialContext).ok).toBe(false);

    const attachmentContext = validRequest();
    attachmentContext.context.filters = { image: 'data:image/png;base64,AAAA' };
    expect(validateFeedbackSubmission(attachmentContext).ok).toBe(false);

    const oversizedContext = validRequest();
    oversizedContext.context.filters = { note: 'x'.repeat(12_100) };
    expect(validateFeedbackSubmission(oversizedContext).ok).toBe(false);
  });
});
