create extension if not exists pgcrypto;

create table if not exists public.feedback_reports (
  id uuid primary key default gen_random_uuid(),
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
  notification_status text not null default 'not_configured'
    check (notification_status in ('not_configured', 'pending', 'sent', 'failed')),
  notification_error text
    check (notification_error is null or char_length(notification_error) <= 240),
  metadata_json jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata_json) = 'object' and pg_column_size(metadata_json) <= 8192)
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

comment on table public.feedback_reports is
  'Private durable CourtPulse product and technical feedback. Writes occur only through submit-feedback.';
comment on column public.feedback_reports.sentry_event_id is
  'Optional 32-character Sentry event correlation ID; never contains reporter text or identity.';
