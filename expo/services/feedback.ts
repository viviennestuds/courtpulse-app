import { Platform } from 'react-native';
import { APP_VERSION, versionString } from '@/constants/versionManifest';
import type { FeedbackFormInput, FeedbackPayload, FeedbackContextSnapshot } from '@/types/feedback';

const FEEDBACK_ENDPOINT_OVERRIDE =
  (process.env.EXPO_PUBLIC_FEEDBACK_ENDPOINT as string | undefined) ?? '';
const BACKEND_BASE =
  (process.env.EXPO_PUBLIC_NBA_API_URL as string | undefined) ?? '';

function resolveFeedbackEndpoint(): string {
  if (FEEDBACK_ENDPOINT_OVERRIDE) return FEEDBACK_ENDPOINT_OVERRIDE;
  if (BACKEND_BASE) {
    const base = BACKEND_BASE.endsWith('/') ? BACKEND_BASE.slice(0, -1) : BACKEND_BASE;
    return `${base}/api/feedback`;
  }
  return '';
}

export interface BuildPayloadArgs {
  form: FeedbackFormInput;
  context: FeedbackContextSnapshot;
  flags: {
    channel: string;
    resolved: Record<string, boolean>;
    overrides: Record<string, boolean>;
  };
}

export function buildFeedbackPayload({ form, context, flags }: BuildPayloadArgs): FeedbackPayload {
  const enabled = Object.entries(flags.resolved)
    .filter(([, v]) => v === true)
    .map(([k]) => k);

  return {
    ...form,
    timestamp: new Date().toISOString(),
    context,
    app: {
      name: 'CourtPulse',
      version: versionString(),
      buildChannel: APP_VERSION.label,
      platform: Platform.OS,
      platformVersion: Platform.Version ?? 'unknown',
      isDevice: Platform.OS !== 'web',
    },
    flags: {
      channel: flags.channel,
      enabled,
      overrides: flags.overrides,
    },
  };
}

export interface SubmitFeedbackResult {
  ok: boolean;
  pasteUrl?: string;
  error?: string;
}

export async function submitFeedback(payload: FeedbackPayload): Promise<SubmitFeedbackResult> {
  const endpoint = resolveFeedbackEndpoint();
  if (!endpoint) {
    console.warn('[Feedback] No feedback endpoint configured. Logging payload locally.');
    console.log('[Feedback] payload:', JSON.stringify(payload, null, 2));
    return { ok: false, error: 'Feedback endpoint not configured.' };
  }

  try {
    console.log('[Feedback] Submitting', payload.type, payload.title, '->', endpoint);
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.warn('[Feedback] Non-OK response', res.status, text);
      return { ok: false, error: `Server responded ${res.status}` };
    }
    const json = (await res.json().catch(() => ({}))) as { pasteUrl?: string };
    console.log('[Feedback] Submission ok', json?.pasteUrl);
    return { ok: true, pasteUrl: json?.pasteUrl };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.warn('[Feedback] Submission failed', message);
    return { ok: false, error: message };
  }
}

export function hasFeedbackEndpoint(): boolean {
  return resolveFeedbackEndpoint().length > 0;
}
