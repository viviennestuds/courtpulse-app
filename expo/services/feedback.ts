import { Platform } from 'react-native';
import { APP_VERSION, versionString } from '@/constants/versionManifest';
import { captureFeedbackCorrelation } from '@/services/observability';
import { resolveObservabilityEnvironment } from '@/utils/observabilityContext';
import {
  buildFeedbackSubmissionRequest,
  normalizeFeedbackEndpoint,
  parseFeedbackSubmissionResponse,
} from '@/utils/feedbackContract';
import type {
  FeedbackContextSnapshot,
  FeedbackFormInput,
  FeedbackPlatform,
  FeedbackSubmissionRequest,
  FeedbackSubmissionResponse,
  FeedbackSubmissionSuccess,
} from '@/types/feedback';

const REQUEST_TIMEOUT_MS = 15_000;
const configuredEndpoint = process.env.EXPO_PUBLIC_FEEDBACK_ENDPOINT?.trim() ?? '';

export interface BuildPayloadArgs {
  form: FeedbackFormInput;
  context: FeedbackContextSnapshot;
  flags: {
    channel: 'stable' | 'experimental';
    resolved: Record<string, boolean>;
    overrides: Record<string, boolean>;
  };
  sentryEventId?: string;
}

export interface FeedbackBackendDiagnostics {
  isConfigured: boolean;
  endpointHost?: string;
  reason?: 'missing' | 'invalid_url' | 'legacy_endpoint';
}

export type SubmitFeedbackResult = FeedbackSubmissionResponse;

function normalizedPlatform(): FeedbackPlatform {
  if (Platform.OS === 'ios' || Platform.OS === 'android' || Platform.OS === 'web') return Platform.OS;
  return 'unknown';
}

function resolveFeedbackEndpoint(): string {
  return normalizeFeedbackEndpoint(configuredEndpoint);
}

/** Returns safe endpoint diagnostics without exposing query strings or credentials. */
export function getFeedbackBackendDiagnostics(): FeedbackBackendDiagnostics {
  if (!configuredEndpoint) return { isConfigured: false, reason: 'missing' };
  try {
    const url = new URL(configuredEndpoint);
    if (!resolveFeedbackEndpoint()) {
      return { isConfigured: false, endpointHost: url.host, reason: 'legacy_endpoint' };
    }
    return { isConfigured: true, endpointHost: url.host };
  } catch {
    return { isConfigured: false, reason: 'invalid_url' };
  }
}

/** Builds the canonical CourtPulse feedback request from approved context fields only. */
export function buildFeedbackPayload({
  form,
  context,
  flags,
  sentryEventId,
}: BuildPayloadArgs): FeedbackSubmissionRequest {
  const enabledFlags = Object.entries(flags.resolved)
    .filter(([, isEnabled]) => isEnabled)
    .map(([key]) => key);
  const overriddenFlags = Object.keys(flags.overrides);

  return buildFeedbackSubmissionRequest(form, context, {
    platform: normalizedPlatform(),
    environment: resolveObservabilityEnvironment(__DEV__),
    appVersion: versionString(),
    buildIdentifier: APP_VERSION.buildDate,
    stabilityChannel: flags.channel,
    featureContext: { enabledFlags, overriddenFlags },
  }, sentryEventId);
}

function safeFailure(code: string, message: string, retryable: boolean): SubmitFeedbackResult {
  return { ok: false, error: { code, message, retryable } };
}

/** Submits one explicit feedback request; persistence success is the only success condition. */
export async function submitFeedback(payload: FeedbackSubmissionRequest): Promise<SubmitFeedbackResult> {
  const endpoint = resolveFeedbackEndpoint();
  if (!endpoint) {
    return safeFailure(
      'backend_not_configured',
      __DEV__
        ? 'Feedback backend is not deployed or EXPO_PUBLIC_FEEDBACK_ENDPOINT is not the submit-feedback function URL.'
        : 'Feedback could not be sent',
      false,
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const body: unknown = await response.json().catch(() => null);
    return parseFeedbackSubmissionResponse(response.status, body);
  } catch (error) {
    const isTimeout = error instanceof Error && error.name === 'AbortError';
    return safeFailure(
      isTimeout ? 'timeout' : 'network_error',
      isTimeout ? 'Feedback request timed out' : 'Feedback service is unavailable',
      true,
    );
  } finally {
    clearTimeout(timeout);
  }
}

/** Builds, optionally correlates, and submits a form without exposing transport details to UI code. */
export async function submitFeedbackForm(args: BuildPayloadArgs): Promise<FeedbackSubmissionSuccess | Exclude<SubmitFeedbackResult, FeedbackSubmissionSuccess>> {
  if (!hasFeedbackEndpoint()) {
    return submitFeedback(buildFeedbackPayload(args));
  }
  const sentryEventId = captureFeedbackCorrelation(args.form.type, args.context) ?? undefined;
  return submitFeedback(buildFeedbackPayload({ ...args, sentryEventId }));
}

export function hasFeedbackEndpoint(): boolean {
  return resolveFeedbackEndpoint().length > 0;
}
