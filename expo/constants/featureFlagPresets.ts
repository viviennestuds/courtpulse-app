import type { FeatureFlagKey } from '@/constants/featureFlags';

export const WEB_BETA_FLAG_OVERRIDES: Partial<Record<FeatureFlagKey, boolean>> = {
  // Lineups / on-court
  lineups_filters_enabled: true,
  lineups_player_filters_enabled: true,
  lineups_on_court_summary_enabled: true,
  lineups_on_court_summary_details_enabled: true,
  lineups_on_court_summary_context_enabled: true,
  lineups_on_court_summary_on_off_enabled: true,
  lineups_deep_dive_enabled: true,

  // Runs / droughts
  droughts_enhancements_enabled: true,
  droughts_lineup_context_enabled: true,
  droughts_end_event_caption_enabled: true,
  droughts_lineup_changes_enabled: true,
  stretches_unified_card_enabled: true,
  stretches_context_stats_enabled: true,
  stretches_phase_events_enabled: true,

  // Games / navigation
  games_live_scoreboard_enabled: true,
  games_date_rail_enabled: true,
  games_calendar_modal_enabled: true,
  enablePlayoffBracketV1: true,

  // Matchup 2.0
  matchup_screen_real_data_enabled: true,
  matchup_v2_summary_enabled: true,
  matchup_v2_events_enabled: true,

  // Play-by-play
  enablePbpFiltersV1: true,

  // Shots
  shots_chart_enabled: true,
  shots_facilitator_filter_enabled: true,
  shots_detail_on_tap_enabled: true,
  shots_free_throws_enabled: true,
  shots_detail_navigation_enabled: true,
  shots_event_links_enabled: true,

  // Product surfaces
  analytics_lab_enabled: true,
  player_performance_screen_enabled: true,
  feedback_reporting_enabled: true,

  // Source-backed hydration
  teams_roster_hydration_enabled: true,
  game_detail_stats_hydration_enabled: true,
  players_directory_v1_enabled: true,

  // Explicitly excluded from Web Beta
  analytics_context_shot_diet_enabled: false,

  // Developer / internal tooling
  games_debug_panel_enabled: false,
  games_source_badges_enabled: false,
  shotquery_dev_view_enabled: false,
  enableMetricValidationDebug: false,
  enableStatTraceDebug: false,
  enableStatTraceWarnings: false,
  enableExternalPbpStatsValidation: false,
  enablePossessionAuditDebug: false,
};
