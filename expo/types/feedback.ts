export type FeedbackType =
  | 'bug'
  | 'feature_request'
  | 'ux_feedback'
  | 'data_issue'
  | 'performance'
  | 'question';

export type FeedbackEnvironment = 'development' | 'preview' | 'production';
export type FeedbackPlatform = 'ios' | 'android' | 'web' | 'unknown';
export type FeedbackNotificationStatus = 'not_configured' | 'pending' | 'sent' | 'failed' | 'digested';

export interface FeedbackContextSnapshot {
  screen?: string;
  subscreen?: string;
  route?: string;
  gameId?: string;
  filters?: Record<string, unknown>;
  extra?: Record<string, unknown>;
}

export interface FeedbackFormInput {
  type: FeedbackType;
  title: string;
  description: string;
  expectedBehavior?: string;
  actualBehavior?: string;
  reproSteps?: string;
  testerName?: string;
  testerContact?: string;
}

export interface FeedbackRuntimeMetadata {
  platform: FeedbackPlatform;
  environment: FeedbackEnvironment;
  appVersion: string;
  buildIdentifier: string;
  stabilityChannel: 'stable' | 'experimental';
  featureContext: Record<string, unknown>;
}

export interface FeedbackSubmissionContext {
  platform: FeedbackPlatform;
  environment: FeedbackEnvironment;
  appVersion: string;
  buildIdentifier: string;
  stabilityChannel: 'stable' | 'experimental';
  screen: string;
  subscreen?: string;
  route?: string;
  gameId?: string;
  activeGameTab?: string;
  filters: Record<string, unknown>;
  featureContext: Record<string, unknown>;
}

export interface FeedbackSubmissionRequest {
  schemaVersion: 'courtPulse.feedback.v1';
  submissionId: string;
  category: FeedbackType;
  title: string;
  description: string;
  expectedBehavior?: string;
  actualBehavior?: string;
  reproSteps?: string;
  reporterName?: string;
  reporterContact?: string;
  context: FeedbackSubmissionContext;
  sentryEventId?: string;
  source: 'courtpulse_app';
}

export interface FeedbackSubmissionAttempt {
  submissionId: string;
  sentryEventId?: string;
}

export interface FeedbackSubmissionSuccess {
  ok: true;
  schemaVersion: 'courtPulse.feedback.v1';
  feedbackId: string;
  feedbackReference: string;
  notificationStatus: FeedbackNotificationStatus;
  idempotentReplay: boolean;
  sentryEventId?: string;
}

export interface FeedbackSubmissionFailure {
  ok: false;
  error: {
    code: string;
    message: string;
    retryable: boolean;
  };
}

export type FeedbackSubmissionResponse = FeedbackSubmissionSuccess | FeedbackSubmissionFailure;

export const FEEDBACK_TYPE_OPTIONS: { value: FeedbackType; label: string; short: string }[] = [
  { value: 'bug', label: 'Bug Report', short: 'Bug' },
  { value: 'feature_request', label: 'Feature Request', short: 'Feature' },
  { value: 'ux_feedback', label: 'UX Feedback', short: 'UX' },
  { value: 'data_issue', label: 'Data Issue', short: 'Data' },
  { value: 'performance', label: 'Performance', short: 'Perf' },
  { value: 'question', label: 'Question', short: 'Question' },
];
