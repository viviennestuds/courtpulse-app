create extension if not exists pgcrypto;

create table if not exists public.feedback_reports (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null,
  created_at timestamptz not null default now(),
  status text not null default 'new'
    check (status in ('new', 'reviewing', 'resolved', 'wont_fix')),
  category text not null
    check (category in ('bug', 'feature_request', 'ux_feedback', 'data_issue', 'performance', 'question')),
  title text not null
    check (char_length(btrim(title)) between 1 and 120),
  description text not null
    check (char_length(btrim(description)) between 1 and 4000),
  expected_behavior text
    check (expected_behavior is null or char_length(expected_behavior) <= 1500),
  actual_behavior text
    check (actual_behavior is null or char_length(actual_behavior) <= 1500),
  repro_steps text
    check (repro_steps is null or char_length(repro_steps) <= 2000),
  reporter_name text
    check (reporter_name is null or char_length(reporter_name) <= 100),
  reporter_contact text
    check (reporter_contact is null or char_length(reporter_contact) <= 200),
  platform text not null
    check (platform in ('ios', 'android', 'web', 'unknown')),
  environment text not null
    check (environment in ('development', 'preview', 'production')),
  app_version text not null
    check (char_length(app_version) between 1 and 64),
  build_identifier text not null
    check (char_length(build_identifier) between 1 and 64),
  stability_channel text not null
    check (stability_channel in ('stable', 'experimental')),
  screen text not null
    check (char_length(screen) between 1 and 120),
  subscreen text
    check (subscreen is null or char_length(subscreen) <= 120),
  route text
    check (route is null or char_length(route) <= 240),
  game_id text
    check (game_id is null or game_id ~ '^[A-Za-z0-9_-]{1,64}$'),
  active_game_tab text
    check (active_game_tab is null or char_length(active_game_tab) <= 64),
  filters_json jsonb not null default '{}'::jsonb
    check (jsonb_typeof(filters_json) = 'object' and pg_column_size(filters_json) <= 16384),
  feature_context_json jsonb not null default '{}'::jsonb
    check (jsonb_typeof(feature_context_json) = 'object' and pg_column_size(feature_context_json) <= 16384),
  sentry_event_id text
    check (sentry_event_id is null or sentry_event_id ~ '^[a-fA-F0-9]{32}$'),
  source text not null default 'courtpulse_app'
    check (source in ('courtpulse_app')),
  content_fingerprint text not null
    check (content_fingerprint ~ '^[a-f0-9]{64}$'),
  notification_class text not null
    check (notification_class in ('immediate', 'digest')),
  notification_status text not null default 'pending'
    check (notification_status in ('not_configured', 'pending', 'sent', 'failed', 'digested')),
  notification_eligible_at timestamptz not null,
  notified_at timestamptz,
  notification_error text
    check (notification_error is null or char_length(notification_error) <= 240),
  metadata_json jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata_json) = 'object' and pg_column_size(metadata_json) <= 8192),
  constraint feedback_reports_submission_id_key unique (submission_id),
  constraint feedback_reports_notified_state_check check (
    notified_at is null or notification_status in ('sent', 'digested')
  )
);

alter table public.feedback_reports enable row level security;

revoke all on table public.feedback_reports from anon, authenticated;
grant all on table public.feedback_reports to service_role;

create index if not exists feedback_reports_created_at_idx
  on public.feedback_reports (created_at desc);
create index if not exists feedback_reports_status_created_at_idx
  on public.feedback_reports (status, created_at desc);
create index if not exists feedback_reports_category_created_at_idx
  on public.feedback_reports (category, created_at desc);
create index if not exists feedback_reports_fingerprint_created_at_idx
  on public.feedback_reports (content_fingerprint, created_at desc);
create index if not exists feedback_reports_digest_pending_eligible_idx
  on public.feedback_reports (notification_eligible_at)
  where notification_class = 'digest' and notification_status = 'pending';

comment on table public.feedback_reports is
  'Private durable CourtPulse product and technical feedback. Writes occur only through submit-feedback.';
comment on column public.feedback_reports.submission_id is
  'Client-generated UUID idempotency key. Replays return this row and never create another report.';
comment on column public.feedback_reports.content_fingerprint is
  'Server-generated SHA-256 over normalized report content/context; grouping signal only and never unique.';
comment on column public.feedback_reports.sentry_event_id is
  'Optional 32-character Sentry event correlation ID; never contains reporter text or identity.';
comment on column public.feedback_reports.notification_eligible_at is
  'Future digest worker selects bounded batches where class=digest, status=pending, and this timestamp is due; successful batches atomically become digested with notified_at set.';
