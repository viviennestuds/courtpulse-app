import type {
  FeedbackContextSnapshot,
  FeedbackFormInput,
  FeedbackNotificationStatus,
  FeedbackRuntimeMetadata,
  FeedbackSubmissionAttempt,
  FeedbackSubmissionFailure,
  FeedbackSubmissionRequest,
  FeedbackSubmissionResponse,
  FeedbackType,
} from '@/types/feedback';
import { FEEDBACK_IDEMPOTENCY_PAYLOAD_MISMATCH_CODE } from '@/types/feedback';

export const FEEDBACK_SCHEMA_VERSION = 'courtPulse.feedback.v1' as const;
export const TECHNICAL_FEEDBACK_TYPES: readonly FeedbackType[] = ['bug', 'performance'];

/** Accepts only the HTTPS Supabase Edge Function path used by durable feedback persistence. */
export function normalizeFeedbackEndpoint(value: string | undefined): string {
  const candidate = value?.trim();
  if (!candidate) return '';
  try {
    const url = new URL(candidate);
    const functionPath = url.pathname.replace(/\/$/, '').endsWith('/functions/v1/submit-feedback');
    return url.protocol === 'https:' && functionPath ? url.toString() : '';
  } catch {
    return '';
  }
}

const SAFE_KEY = /^[A-Za-z0-9_.:-]{1,80}$/;
const SENSITIVE_KEY = /authorization|contact|cookie|dsn|email|password|payload|query|raw|search|secret|tester|token/i;

function boundedOptional(value: string | undefined, maxLength: number): string | undefined {
  const normalized = value?.trim();
  if (!normalized) return undefined;
  return normalized.slice(0, maxLength);
}

function sanitizeStructuredValue(value: unknown, depth = 0): unknown {
  if (depth > 4) return undefined;
  if (value === null || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value === 'string') return value.slice(0, 240);
  if (Array.isArray(value)) {
    return value.slice(0, 20).map(item => sanitizeStructuredValue(item, depth + 1));
  }
  if (typeof value !== 'object') return undefined;

  const output: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value as Record<string, unknown>).slice(0, 40)) {
    if (!SAFE_KEY.test(key) || SENSITIVE_KEY.test(key)) continue;
    const sanitized = sanitizeStructuredValue(child, depth + 1);
    if (sanitized !== undefined) output[key] = sanitized;
  }
  return output;
}

function sanitizeStructuredObject(value: Record<string, unknown> | undefined): Record<string, unknown> {
  const sanitized = sanitizeStructuredValue(value ?? {});
  return sanitized && typeof sanitized === 'object' && !Array.isArray(sanitized)
    ? sanitized as Record<string, unknown>
    : {};
}

function sanitizeRoute(value: string | undefined): string | undefined {
  const normalized = boundedOptional(value, 240);
  return normalized?.split(/[?#]/, 1)[0];
}

function deriveActiveGameTab(context: FeedbackContextSnapshot): string | undefined {
  const explicit = typeof context.extra?.activeGameTab === 'string'
    ? context.extra.activeGameTab
    : undefined;
  return boundedOptional(explicit ?? context.subscreen?.split(':')[0], 64);
}

/** Explicitly constructs the versioned wire contract from the form and approved CourtPulse context. */
export function buildFeedbackSubmissionRequest(
  form: FeedbackFormInput,
  context: FeedbackContextSnapshot,
  runtime: FeedbackRuntimeMetadata,
  submissionId: string,
  sentryEventId?: string,
): FeedbackSubmissionRequest {
  return {
    schemaVersion: FEEDBACK_SCHEMA_VERSION,
    submissionId,
    category: form.type,
    title: form.title.trim(),
    description: form.description.trim(),
    expectedBehavior: boundedOptional(form.expectedBehavior, 1500),
    actualBehavior: boundedOptional(form.actualBehavior, 1500),
    reproSteps: boundedOptional(form.reproSteps, 2000),
    reporterName: boundedOptional(form.testerName, 100),
    reporterContact: boundedOptional(form.testerContact, 200),
    context: {
      platform: runtime.platform,
      environment: runtime.environment,
      appVersion: runtime.appVersion,
      buildIdentifier: runtime.buildIdentifier,
      stabilityChannel: runtime.stabilityChannel,
      screen: boundedOptional(context.screen, 120) ?? 'Unknown',
      subscreen: boundedOptional(context.subscreen, 120),
      route: sanitizeRoute(context.route),
      gameId: boundedOptional(context.gameId, 64),
      activeGameTab: deriveActiveGameTab(context),
      filters: sanitizeStructuredObject(context.filters),
      featureContext: sanitizeStructuredObject(runtime.featureContext),
    },
    sentryEventId: TECHNICAL_FEEDBACK_TYPES.includes(form.type) ? sentryEventId : undefined,
    source: 'courtpulse_app',
  };
}

function responseFailure(code: string, message: string, retryable: boolean): FeedbackSubmissionResponse {
  return { ok: false, error: { code, message, retryable } };
}

/** Parses the bounded public response contract without trusting arbitrary backend fields. */
export function parseFeedbackSubmissionResponse(status: number, value: unknown): FeedbackSubmissionResponse {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return responseFailure('invalid_response', 'Feedback service returned an invalid response', true);
  }
  const data = value as Record<string, unknown>;
  if (status >= 200 && status < 300 && data.ok === true) {
    const validNotificationStatuses: FeedbackNotificationStatus[] = [
      'not_configured', 'pending', 'sent', 'failed', 'digested',
    ];
    if (
      data.schemaVersion !== FEEDBACK_SCHEMA_VERSION
      || typeof data.feedbackId !== 'string'
      || !/^[a-fA-F0-9-]{36}$/.test(data.feedbackId)
      || typeof data.feedbackReference !== 'string'
      || !/^CP-FB-[A-F0-9]{6}$/.test(data.feedbackReference)
      || typeof data.notificationStatus !== 'string'
      || !validNotificationStatuses.includes(data.notificationStatus as FeedbackNotificationStatus)
      || typeof data.idempotentReplay !== 'boolean'
      || (data.sentryEventId !== undefined && (
        typeof data.sentryEventId !== 'string' || !/^[a-fA-F0-9]{32}$/.test(data.sentryEventId)
      ))
    ) {
      return responseFailure('invalid_response', 'Feedback service returned an invalid response', true);
    }
    return {
      ok: true,
      schemaVersion: FEEDBACK_SCHEMA_VERSION,
      feedbackId: data.feedbackId,
      feedbackReference: data.feedbackReference,
      notificationStatus: data.notificationStatus as FeedbackNotificationStatus,
      idempotentReplay: data.idempotentReplay,
      sentryEventId: data.sentryEventId as string | undefined,
    };
  }

  const backendError = data.error;
  if (backendError && typeof backendError === 'object' && !Array.isArray(backendError)) {
    const error = backendError as Record<string, unknown>;
    const code = typeof error.code === 'string' ? error.code.slice(0, 80) : 'submission_failed';
    if (status === 409 && code === FEEDBACK_IDEMPOTENCY_PAYLOAD_MISMATCH_CODE) {
      return responseFailure(
        code,
        'The earlier version of this report was already received. Submit again to send your edited version.',
        false,
      );
    }
    const retryable = typeof error.retryable === 'boolean' ? error.retryable : status >= 500;
    return responseFailure(code, 'Feedback could not be sent', retryable);
  }
  return responseFailure('submission_failed', 'Feedback could not be sent', status >= 500);
}

/** Clears a consumed attempt only when the server reports that its ID belongs to different content. */
export function feedbackAttemptAfterFailure(
  current: FeedbackSubmissionAttempt,
  failure: FeedbackSubmissionFailure,
): FeedbackSubmissionAttempt | null {
  return failure.error.code === FEEDBACK_IDEMPOTENCY_PAYLOAD_MISMATCH_CODE ? null : current;
}

/** Retains one idempotency/correlation identity until its logical report is confirmed. */
export function ensureFeedbackSubmissionAttempt(
  current: FeedbackSubmissionAttempt | null,
  category: FeedbackType,
  context: FeedbackContextSnapshot,
  createSubmissionId: () => string,
  captureCorrelation: (
    category: FeedbackType,
    context: FeedbackContextSnapshot,
    submissionId: string,
  ) => string | null,
): FeedbackSubmissionAttempt {
  if (current) return current;
  const submissionId = createSubmissionId();
  const sentryEventId = TECHNICAL_FEEDBACK_TYPES.includes(category)
    ? captureCorrelation(category, context, submissionId) ?? undefined
    : undefined;
  return { submissionId, sentryEventId };
}

/** Returns the only metadata permitted in a feedback-correlation Sentry event. */
export function buildFeedbackSentryContext(
  category: FeedbackType,
  context: FeedbackContextSnapshot,
  submissionId?: string,
): Record<string, string | boolean> | null {
  if (!TECHNICAL_FEEDBACK_TYPES.includes(category)) return null;
  const safeContext: Record<string, string | boolean> = {
    feedback_category: category,
    feedback_correlation: true,
  };
  if (submissionId) safeContext.feedback_submission_id = submissionId;
  const route = sanitizeRoute(context.route);
  const gameId = boundedOptional(context.gameId, 64);
  const activeGameTab = deriveActiveGameTab(context);
  if (route) safeContext.route = route;
  if (gameId) safeContext.gameId = gameId;
  if (activeGameTab) safeContext.activeGameTab = activeGameTab;
  return safeContext;
}
