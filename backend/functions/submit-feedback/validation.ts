export const FEEDBACK_SCHEMA_VERSION = "courtPulse.feedback.v1";
export const FEEDBACK_CATEGORIES = [
  "bug",
  "feature_request",
  "ux_feedback",
  "data_issue",
  "performance",
  "question",
] as const;

export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number];
export type NotificationStatus = "not_configured" | "pending" | "sent" | "failed";

type JsonRecord = Record<string, unknown>;

export interface ValidFeedbackSubmission {
  schemaVersion: typeof FEEDBACK_SCHEMA_VERSION;
  category: FeedbackCategory;
  title: string;
  description: string;
  expectedBehavior?: string;
  actualBehavior?: string;
  reproSteps?: string;
  reporterName?: string;
  reporterContact?: string;
  context: {
    platform: "ios" | "android" | "web" | "unknown";
    environment: "development" | "preview" | "production";
    appVersion: string;
    buildIdentifier: string;
    stabilityChannel: "stable" | "experimental";
    screen: string;
    subscreen?: string;
    route?: string;
    gameId?: string;
    activeGameTab?: string;
    filters: JsonRecord;
    featureContext: JsonRecord;
  };
  sentryEventId?: string;
  source: "courtpulse_app";
}

export interface ValidationResult {
  ok: boolean;
  value?: ValidFeedbackSubmission;
  error?: string;
}

const TOP_LEVEL_KEYS = new Set([
  "schemaVersion", "category", "title", "description", "expectedBehavior", "actualBehavior",
  "reproSteps", "reporterName", "reporterContact", "context", "sentryEventId", "source",
]);
const CONTEXT_KEYS = new Set([
  "platform", "environment", "appVersion", "buildIdentifier", "stabilityChannel", "screen",
  "subscreen", "route", "gameId", "activeGameTab", "filters", "featureContext",
]);
const SENSITIVE_KEY = /authorization|contact|cookie|dsn|email|password|payload|query|raw|requestbody|responsebody|search|secret|tester|token/i;
const SAFE_CONTEXT_KEY = /^[A-Za-z0-9_.:-]{1,80}$/;
const GAME_ID = /^[A-Za-z0-9_-]{1,64}$/;
const SENTRY_EVENT_ID = /^[a-fA-F0-9]{32}$/;

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasOnlyKeys(value: JsonRecord, allowed: Set<string>): boolean {
  return Object.keys(value).every((key) => allowed.has(key));
}

function requiredString(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength) return null;
  return normalized;
}

function optionalString(value: unknown, maxLength: number): string | undefined | null {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized) return undefined;
  if (normalized.length > maxLength) return null;
  return normalized;
}

function isSafeJson(value: unknown, depth = 0): boolean {
  if (depth > 4) return false;
  if (value === null || typeof value === "boolean") return true;
  if (typeof value === "string") return !/^data:[^;]+;base64,/i.test(value);
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.length <= 20 && value.every((item) => isSafeJson(item, depth + 1));
  if (!isRecord(value) || Object.keys(value).length > 40) return false;
  return Object.entries(value).every(([key, child]) => (
    SAFE_CONTEXT_KEY.test(key)
    && !SENSITIVE_KEY.test(key)
    && isSafeJson(child, depth + 1)
  ));
}

function validJsonObject(value: unknown, maxBytes: number): value is JsonRecord {
  if (!isRecord(value) || !isSafeJson(value)) return false;
  try {
    return new TextEncoder().encode(JSON.stringify(value)).byteLength <= maxBytes;
  } catch {
    return false;
  }
}

export function validateFeedbackSubmission(input: unknown): ValidationResult {
  if (!isRecord(input) || !hasOnlyKeys(input, TOP_LEVEL_KEYS)) {
    return { ok: false, error: "Invalid feedback payload" };
  }
  if (input.schemaVersion !== FEEDBACK_SCHEMA_VERSION) {
    return { ok: false, error: "Unsupported feedback schema" };
  }
  if (typeof input.category !== "string" || !FEEDBACK_CATEGORIES.includes(input.category as FeedbackCategory)) {
    return { ok: false, error: "Invalid feedback category" };
  }
  if (input.source !== "courtpulse_app") {
    return { ok: false, error: "Invalid feedback source" };
  }

  const title = requiredString(input.title, 120);
  const description = requiredString(input.description, 4000);
  if (!title || !description) return { ok: false, error: "Title and description are required" };

  const expectedBehavior = optionalString(input.expectedBehavior, 1500);
  const actualBehavior = optionalString(input.actualBehavior, 1500);
  const reproSteps = optionalString(input.reproSteps, 2000);
  const reporterName = optionalString(input.reporterName, 100);
  const reporterContact = optionalString(input.reporterContact, 200);
  if ([expectedBehavior, actualBehavior, reproSteps, reporterName, reporterContact].includes(null)) {
    return { ok: false, error: "A feedback field exceeds its allowed size" };
  }

  if (!isRecord(input.context) || !hasOnlyKeys(input.context, CONTEXT_KEYS)) {
    return { ok: false, error: "Invalid feedback context" };
  }
  const context = input.context;
  const platform = context.platform;
  const environment = context.environment;
  const stabilityChannel = context.stabilityChannel;
  if (!(["ios", "android", "web", "unknown"] as unknown[]).includes(platform)) {
    return { ok: false, error: "Invalid platform" };
  }
  if (!(["development", "preview", "production"] as unknown[]).includes(environment)) {
    return { ok: false, error: "Invalid environment" };
  }
  if (!(["stable", "experimental"] as unknown[]).includes(stabilityChannel)) {
    return { ok: false, error: "Invalid stability channel" };
  }

  const appVersion = requiredString(context.appVersion, 64);
  const buildIdentifier = requiredString(context.buildIdentifier, 64);
  const screen = requiredString(context.screen, 120);
  const subscreen = optionalString(context.subscreen, 120);
  const route = optionalString(context.route, 240);
  const gameId = optionalString(context.gameId, 64);
  const activeGameTab = optionalString(context.activeGameTab, 64);
  if (!appVersion || !buildIdentifier || !screen || [subscreen, route, gameId, activeGameTab].includes(null)) {
    return { ok: false, error: "Invalid feedback context fields" };
  }
  if (gameId && !GAME_ID.test(gameId)) return { ok: false, error: "Invalid game identifier" };
  if (!validJsonObject(context.filters, 12_000) || !validJsonObject(context.featureContext, 12_000)) {
    return { ok: false, error: "Invalid structured feedback context" };
  }

  const sentryEventId = optionalString(input.sentryEventId, 32);
  if (sentryEventId === null || (sentryEventId && !SENTRY_EVENT_ID.test(sentryEventId))) {
    return { ok: false, error: "Invalid Sentry correlation identifier" };
  }

  return {
    ok: true,
    value: {
      schemaVersion: FEEDBACK_SCHEMA_VERSION,
      category: input.category as FeedbackCategory,
      title,
      description,
      expectedBehavior: expectedBehavior ?? undefined,
      actualBehavior: actualBehavior ?? undefined,
      reproSteps: reproSteps ?? undefined,
      reporterName: reporterName ?? undefined,
      reporterContact: reporterContact ?? undefined,
      context: {
        platform: platform as ValidFeedbackSubmission["context"]["platform"],
        environment: environment as ValidFeedbackSubmission["context"]["environment"],
        appVersion,
        buildIdentifier,
        stabilityChannel: stabilityChannel as ValidFeedbackSubmission["context"]["stabilityChannel"],
        screen,
        subscreen: subscreen ?? undefined,
        route: route ?? undefined,
        gameId: gameId ?? undefined,
        activeGameTab: activeGameTab ?? undefined,
        filters: context.filters,
        featureContext: context.featureContext,
      },
      sentryEventId: sentryEventId ?? undefined,
      source: "courtpulse_app",
    },
  };
}
