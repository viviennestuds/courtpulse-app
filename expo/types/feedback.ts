export type FeedbackType =
  | 'bug'
  | 'feature_request'
  | 'ux_feedback'
  | 'data_issue'
  | 'performance'
  | 'question';

export interface FeedbackContextSnapshot {
  screen?: string;
  subscreen?: string;
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

export interface FeedbackPayload extends FeedbackFormInput {
  timestamp: string;
  context: FeedbackContextSnapshot;
  app: {
    name: string;
    version: string;
    buildChannel: string;
    platform: string;
    platformVersion: string | number;
    isDevice: boolean;
  };
  flags: {
    channel: string;
    enabled: string[];
    overrides: Record<string, boolean>;
  };
}

export const FEEDBACK_TYPE_OPTIONS: { value: FeedbackType; label: string; short: string }[] = [
  { value: 'bug', label: 'Bug Report', short: 'Bug' },
  { value: 'feature_request', label: 'Feature Request', short: 'Feature' },
  { value: 'ux_feedback', label: 'UX Feedback', short: 'UX' },
  { value: 'data_issue', label: 'Data Issue', short: 'Data' },
  { value: 'performance', label: 'Performance', short: 'Perf' },
  { value: 'question', label: 'Question', short: 'Question' },
];
