import * as Sentry from '@sentry/react-native';
import { isRunningInExpoGo } from 'expo';
import { Platform } from 'react-native';
import { APP_VERSION, versionString } from '@/constants/versionManifest';
import {
  buildRouteObservabilityContext,
  isObservabilityConfigured,
  resolveObservabilityEnvironment,
  scrubObservabilityValue,
} from '@/utils/observabilityContext';
import type { StabilityChannel } from '@/providers/FeatureFlagsProvider';
import type { FeedbackContextSnapshot, FeedbackType } from '@/types/feedback';
import { buildFeedbackSentryContext } from '@/utils/feedbackContract';

export type GameObservabilityTab = 'summary' | 'matchup' | 'pbp' | 'shots' | 'analytics';

type SafeCaptureContext = Record<string, string | number | boolean | null>;

export interface ObservabilityDiagnostics {
  isConfigured: boolean;
  isInitialized: boolean;
  platform: string;
  environment: string;
  appVersion: string;
  buildIdentifier: string;
  release: string;
  initializationError?: string;
}

export interface DiagnosticEventResult {
  ok: boolean;
  eventId?: string;
  flushed?: boolean;
  error?: string;
}

const runtimeDsn = (process.env.EXPO_PUBLIC_SENTRY_DSN as string | undefined)?.trim();
const appVersion = `${APP_VERSION.major}.${APP_VERSION.minor}.${APP_VERSION.patch}`;
const buildIdentifier = APP_VERSION.buildDate;
const environment = resolveObservabilityEnvironment(__DEV__);
const navigationIntegration = Sentry.reactNavigationIntegration({
  enableTimeToInitialDisplay: !isRunningInExpoGo(),
  ignoreEmptyBackNavigationTransactions: true,
});

let isInitialized = false;
let hasAttemptedInitialization = false;
let initializationError: string | undefined;
let currentGameId: string | undefined;

function scrubEvent<TEvent extends Sentry.Event>(event: TEvent): TEvent {
  const scrubbed = scrubObservabilityValue(event) as TEvent;
  scrubbed.user = undefined;
  return scrubbed;
}

function scrubBreadcrumb(breadcrumb: Sentry.Breadcrumb): Sentry.Breadcrumb | null {
  const category = breadcrumb.category?.toLowerCase() ?? '';
  if (category === 'console' || category.startsWith('ui.')) return null;
  return scrubObservabilityValue(breadcrumb) as Sentry.Breadcrumb;
}

function setSafeCaptureContext(scope: Sentry.Scope, context?: SafeCaptureContext): void {
  if (!context) return;
  const scrubbed = scrubObservabilityValue(context) as SafeCaptureContext;
  scope.setContext('court_pulse_capture', scrubbed);
}

/** Initializes the shared Sentry client once when a public runtime DSN is configured. */
export function initializeObservability(): void {
  if (hasAttemptedInitialization) return;
  hasAttemptedInitialization = true;

  if (!isObservabilityConfigured(runtimeDsn)) return;

  try {
    Sentry.init({
      dsn: runtimeDsn,
      environment,
      sendDefaultPii: false,
      tracesSampleRate: 0.1,
      profilesSampleRate: 0,
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: 0,
      enableLogs: false,
      attachScreenshot: false,
      attachViewHierarchy: false,
      enableCaptureFailedRequests: false,
      enableUserInteractionTracing: false,
      enableNativeFramesTracking: Platform.OS !== 'web' && !isRunningInExpoGo(),
      integrations: [navigationIntegration],
      beforeSend: scrubEvent,
      beforeSendTransaction: scrubEvent,
      beforeBreadcrumb: scrubBreadcrumb,
    });
    isInitialized = true;
    Sentry.setTags({
      platform: Platform.OS,
      app_version: appVersion,
    });
    Sentry.setContext('court_pulse_app', {
      appVersion,
      buildIdentifier,
      versionLabel: APP_VERSION.label,
      platform: Platform.OS,
    });
  } catch {
    initializationError = 'Sentry initialization failed';
  }
}

/** Registers Expo Router's navigation container with the SDK 7.2 navigation integration. */
export function registerObservabilityNavigationContainer(navigationContainerRef: unknown): void {
  if (!isInitialized) return;
  navigationIntegration.registerNavigationContainer(navigationContainerRef);
}

/** Updates low-cardinality route tags and structured dynamic route context. */
export function setRouteObservabilityContext(pathname: string): void {
  if (!isInitialized) return;
  const route = buildRouteObservabilityContext(pathname);
  Sentry.setTag('route', route.screen);
  Sentry.setContext('court_pulse_route', {
    pathname: route.pathname,
    routePattern: route.routePattern,
    screen: route.screen,
    gameId: route.gameId,
    playerId: route.playerId,
    teamId: route.teamId,
  });
  if (route.screen !== 'game') clearGameObservabilityContext();
}

/** Sets the one stability-channel tag without attaching the complete flag state. */
export function setStabilityObservabilityContext(channel: StabilityChannel): void {
  if (!isInitialized) return;
  Sentry.setTag('stability_channel', channel);
}

/** Sets Game Detail's ID and in-screen tab without changing route semantics. */
export function setGameObservabilityContext(gameId: string, gameTab: GameObservabilityTab): void {
  if (!isInitialized || !gameId) return;
  currentGameId = gameId;
  Sentry.setContext('court_pulse_game', { gameId, gameTab });
}

/** Clears Game Detail context, guarding against stale cleanup from a replaced game route. */
export function clearGameObservabilityContext(expectedGameId?: string): void {
  if (!isInitialized) return;
  if (expectedGameId && currentGameId && expectedGameId !== currentGameId) return;
  currentGameId = undefined;
  Sentry.setContext('court_pulse_game', null);
}

/** Captures a controlled exception with a small, scrubbed CourtPulse context. */
export function captureCourtPulseException(error: unknown, context?: SafeCaptureContext): string | null {
  if (!isInitialized) return null;
  const safeError = error instanceof Error ? error : new Error('CourtPulse captured non-error exception');
  return Sentry.withScope(scope => {
    setSafeCaptureContext(scope, context);
    return Sentry.captureException(safeError);
  }) ?? null;
}

/** Captures a controlled message with a small, scrubbed CourtPulse context. */
export function captureCourtPulseMessage(
  message: string,
  level: Sentry.SeverityLevel = 'info',
  context?: SafeCaptureContext,
): string | null {
  if (!isInitialized) return null;
  return Sentry.withScope(scope => {
    setSafeCaptureContext(scope, context);
    return Sentry.captureMessage(message, level);
  }) ?? null;
}

/** Creates a low-noise correlation message only for technical feedback categories. */
export function captureFeedbackCorrelation(
  category: FeedbackType,
  context: FeedbackContextSnapshot,
  submissionId: string,
): string | null {
  const safeContext = buildFeedbackSentryContext(category, context, submissionId);
  if (!safeContext) return null;
  return captureCourtPulseMessage(`CourtPulse user feedback: ${category}`, 'info', safeContext);
}

/** Returns non-secret status information for the development DevTools panel. */
export function getObservabilityDiagnostics(): ObservabilityDiagnostics {
  const release = isInitialized
    ? Sentry.getClient()?.getOptions().release ?? 'Automatic SDK release'
    : 'Unavailable';
  return {
    isConfigured: isObservabilityConfigured(runtimeDsn),
    isInitialized,
    platform: Platform.OS,
    environment,
    appVersion: versionString(),
    buildIdentifier,
    release,
    initializationError,
  };
}

async function flushDiagnosticEvent(eventId: string | null): Promise<DiagnosticEventResult> {
  if (!eventId) return { ok: false, error: 'Sentry is not configured' };
  try {
    const flushed = await Sentry.flush();
    return { ok: true, eventId, flushed };
  } catch {
    return { ok: false, eventId, error: 'Sentry could not flush the diagnostic event' };
  }
}

/** Sends one development diagnostic message and reports the generated event ID. */
export async function sendSentryDiagnosticMessage(): Promise<DiagnosticEventResult> {
  if (!__DEV__) return { ok: false, error: 'Diagnostics are development-only' };
  const eventId = captureCourtPulseMessage('CourtPulse Sentry integration test message', 'info', {
    diagnostic: true,
    source: 'devtools',
  });
  return flushDiagnosticEvent(eventId);
}

/** Sends one controlled development exception without crashing CourtPulse. */
export async function sendSentryDiagnosticException(): Promise<DiagnosticEventResult> {
  if (!__DEV__) return { ok: false, error: 'Diagnostics are development-only' };
  const eventId = captureCourtPulseException(new Error('CourtPulse Sentry integration test'), {
    diagnostic: true,
    source: 'devtools',
  });
  return flushDiagnosticEvent(eventId);
}
