import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  FEEDBACK_SCHEMA_VERSION,
  createContentFingerprint,
  notificationEligibilityForSubmission,
  shouldAttemptImmediateNotification,
  type NotificationEligibility,
  type NotificationStatus,
  type ValidFeedbackSubmission,
  validateFeedbackSubmission,
} from "./validation.ts";
import {
  persistFeedbackIdempotently,
  type PersistedFeedbackRecord,
  type PersistenceAttempt,
} from "./idempotency.ts";

const MAX_BODY_BYTES = 32_768;
const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8" };
const VALID_NOTIFICATION_STATUSES: readonly NotificationStatus[] = [
  "not_configured",
  "pending",
  "sent",
  "failed",
  "digested",
];

type JsonRecord = Record<string, unknown>;

function allowedOrigins(): string[] {
  return (Deno.env.get("FEEDBACK_ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin");
  const configured = allowedOrigins();
  const allowOrigin = configured.length === 0
    ? "*"
    : origin && configured.includes(origin)
      ? origin
      : configured[0];
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

function isOriginAllowed(req: Request): boolean {
  const origin = req.headers.get("Origin");
  const configured = allowedOrigins();
  return !origin || configured.length === 0 || configured.includes(origin);
}

function jsonResponse(req: Request, body: JsonRecord, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), ...JSON_HEADERS },
  });
}

function errorResponse(
  req: Request,
  status: number,
  code: string,
  message: string,
  retryable: boolean,
): Response {
  return jsonResponse(req, { ok: false, error: { code, message, retryable } }, status);
}

function adminClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceRoleKey) throw new Error("Supabase runtime is not configured");
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function feedbackReference(id: string): string {
  return `CP-FB-${id.replaceAll("-", "").slice(0, 6).toUpperCase()}`;
}

function initialNotificationStatus(
  eligibility: NotificationEligibility,
  isNotifierConfigured: boolean,
): NotificationStatus {
  if (eligibility.notificationClass === "digest") return "pending";
  return isNotifierConfigured ? "pending" : "not_configured";
}

function toInsertRow(
  payload: ValidFeedbackSubmission,
  contentFingerprint: string,
  eligibility: NotificationEligibility,
  createdAt: string,
  notificationStatus: NotificationStatus,
): JsonRecord {
  return {
    submission_id: payload.submissionId,
    created_at: createdAt,
    status: "new",
    category: payload.category,
    title: payload.title,
    description: payload.description,
    expected_behavior: payload.expectedBehavior ?? null,
    actual_behavior: payload.actualBehavior ?? null,
    repro_steps: payload.reproSteps ?? null,
    reporter_name: payload.reporterName ?? null,
    reporter_contact: payload.reporterContact ?? null,
    platform: payload.context.platform,
    environment: payload.context.environment,
    app_version: payload.context.appVersion,
    build_identifier: payload.context.buildIdentifier,
    stability_channel: payload.context.stabilityChannel,
    screen: payload.context.screen,
    subscreen: payload.context.subscreen ?? null,
    route: payload.context.route ?? null,
    game_id: payload.context.gameId ?? null,
    active_game_tab: payload.context.activeGameTab ?? null,
    filters_json: payload.context.filters,
    feature_context_json: payload.context.featureContext,
    sentry_event_id: payload.sentryEventId ?? null,
    source: payload.source,
    content_fingerprint: contentFingerprint,
    notification_class: eligibility.notificationClass,
    notification_status: notificationStatus,
    notification_eligible_at: eligibility.eligibleAt,
    notified_at: null,
    notification_error: null,
    metadata_json: {
      schemaVersion: payload.schemaVersion,
      ...(eligibility.notificationClass === "digest"
        ? { digestWindowMinutes: eligibility.digestWindowMinutes }
        : {}),
    },
  };
}

function persistedRecord(value: unknown): PersistedFeedbackRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (
    typeof record.id !== "string"
    || typeof record.notification_status !== "string"
    || !VALID_NOTIFICATION_STATUSES.includes(record.notification_status as NotificationStatus)
    || (record.sentry_event_id !== null && typeof record.sentry_event_id !== "string")
  ) {
    return null;
  }
  return {
    id: record.id,
    notification_status: record.notification_status,
    sentry_event_id: record.sentry_event_id as string | null,
  };
}

interface NotificationResult {
  status: NotificationStatus;
  error?: string;
}

async function sendBestEffortNotification(
  payload: ValidFeedbackSubmission,
  reportId: string,
): Promise<NotificationResult> {
  const notifyUrl = Deno.env.get("BRRR_NOTIFY_URL")?.trim();
  if (!notifyUrl) return { status: "not_configured" };

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const bearerToken = Deno.env.get("BRRR_BEARER_TOKEN")?.trim();
  if (notifyUrl.replace(/\/$/, "").endsWith("/v1/send") && bearerToken) {
    headers.Authorization = `Bearer ${bearerToken}`;
  }

  const reference = feedbackReference(reportId);
  const notification: JsonRecord = {
    title: "CourtPulse feedback received",
    message: `${payload.category.replaceAll("_", " ")} · ${reference}`,
    sound: "default",
    interruption_level: "active",
    thread_id: "courtpulse-feedback",
  };
  const reviewBaseUrl = Deno.env.get("FEEDBACK_REVIEW_BASE_URL")?.trim();
  if (reviewBaseUrl) notification.open_url = `${reviewBaseUrl.replace(/\/$/, "")}/${reportId}`;

  try {
    const response = await fetch(notifyUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(notification),
      signal: AbortSignal.timeout(2_500),
    });
    if (!response.ok) return { status: "failed", error: `http_${response.status}` };
    return { status: "sent" };
  } catch (error) {
    const reason = error instanceof DOMException && error.name === "TimeoutError"
      ? "timeout"
      : "transport_error";
    return { status: "failed", error: reason };
  }
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (!isOriginAllowed(req)) {
    return errorResponse(req, 403, "origin_not_allowed", "Origin is not allowed", false);
  }
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(req) });
  }
  if (req.method !== "POST") {
    return errorResponse(req, 405, "method_not_allowed", "Only POST is supported", false);
  }

  const contentLength = Number(req.headers.get("Content-Length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return errorResponse(req, 413, "payload_too_large", "Feedback payload is too large", false);
  }
  if (!(req.headers.get("Content-Type") ?? "").toLowerCase().includes("application/json")) {
    return errorResponse(req, 415, "invalid_content_type", "Content-Type must be application/json", false);
  }

  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch {
    return errorResponse(req, 400, "invalid_body", "Feedback body could not be read", false);
  }
  if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
    return errorResponse(req, 413, "payload_too_large", "Feedback payload is too large", false);
  }

  let input: unknown;
  try {
    input = JSON.parse(rawBody);
  } catch {
    return errorResponse(req, 400, "invalid_json", "Feedback body must be valid JSON", false);
  }

  const validation = validateFeedbackSubmission(input);
  if (!validation.ok || !validation.value) {
    return errorResponse(req, 400, "validation_failed", validation.error ?? "Invalid feedback payload", false);
  }

  const payload = validation.value;
  const createdAt = new Date();
  const eligibility = notificationEligibilityForSubmission(
    payload.category,
    createdAt,
    Deno.env.get("FEEDBACK_DIGEST_WINDOW_MINUTES"),
  );
  const isNotifierConfigured = Boolean(Deno.env.get("BRRR_NOTIFY_URL")?.trim());
  const initialStatus = initialNotificationStatus(eligibility, isNotifierConfigured);

  try {
    const contentFingerprint = await createContentFingerprint(payload);
    const supabase = adminClient();
    const insertRow = toInsertRow(
      payload,
      contentFingerprint,
      eligibility,
      createdAt.toISOString(),
      initialStatus,
    );

    const persistence = await persistFeedbackIdempotently<PersistedFeedbackRecord>(
      async (): Promise<PersistenceAttempt<PersistedFeedbackRecord>> => {
        const { data, error } = await supabase
          .from("feedback_reports")
          .insert(insertRow)
          .select("id, notification_status, sentry_event_id")
          .single();
        return { record: persistedRecord(data), errorCode: error?.code };
      },
      async (): Promise<PersistenceAttempt<PersistedFeedbackRecord>> => {
        const { data, error } = await supabase
          .from("feedback_reports")
          .select("id, notification_status, sentry_event_id")
          .eq("submission_id", payload.submissionId)
          .single();
        return { record: persistedRecord(data), errorCode: error?.code };
      },
    );

    if (!persistence.ok) {
      console.error("[submit-feedback] persistence failed", persistence.errorCode);
      return errorResponse(req, 503, "persistence_unavailable", "Feedback could not be saved", true);
    }

    const { record, idempotentReplay } = persistence;
    let notificationStatus = record.notification_status as NotificationStatus;

    if (shouldAttemptImmediateNotification(eligibility.notificationClass, idempotentReplay)) {
      const notification = await sendBestEffortNotification(payload, record.id);
      notificationStatus = notification.status;
      if (notification.status !== initialStatus || notification.error) {
        const { error: updateError } = await supabase
          .from("feedback_reports")
          .update({
            notification_status: notification.status,
            notified_at: notification.status === "sent" ? new Date().toISOString() : null,
            notification_error: notification.error ?? null,
          })
          .eq("id", record.id);
        if (updateError) console.warn("[submit-feedback] notification status update failed", updateError.code);
      }
    }

    return jsonResponse(req, {
      ok: true,
      schemaVersion: FEEDBACK_SCHEMA_VERSION,
      feedbackId: record.id,
      feedbackReference: feedbackReference(record.id),
      notificationStatus,
      idempotentReplay,
      ...(record.sentry_event_id ? { sentryEventId: record.sentry_event_id } : {}),
    }, idempotentReplay ? 200 : 201);
  } catch {
    console.error("[submit-feedback] unexpected persistence failure");
    return errorResponse(req, 503, "persistence_unavailable", "Feedback could not be saved", true);
  }
});
