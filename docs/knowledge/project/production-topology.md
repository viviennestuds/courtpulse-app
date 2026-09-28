# CourtPulse Production Topology

**Kind:** project knowledge  
**Status:** living evidence  
**Repository baseline for initial topology:** `e92dc3dcbf15c2ff4ce6681fa87e18022766d4c2`  
**Initial observation date:** 2026-09-27

This document records current-state topology. It is not an Architecture Contract and does not declare that every deployed component is authoritative or desirable.

## Observation discipline

Repository state is pinned to the SHA above.

Supabase project/function status and GitHub branch settings are control-plane observations from 2026-09-27. They can change independently of the Git commit.

During the first Archaeology 0.1 control-plane observation, the Supabase project reported `INACTIVE` while individual Edge Functions reported `ACTIVE`. The user subsequently resumed the project. A follow-up connector observation on 2026-09-27 reported:

```text
CourtPulse-Dev project status: ACTIVE_HEALTHY
database: PostgreSQL 17.6.1.111
region: us-east-1
```

This state transition is retained here because it demonstrates why control-plane facts must be timestamped instead of being treated as properties of a repository commit.

## Component matrix

| Component | Repository state at baseline | Observed production/control-plane role | Recoverability notes |
|---|---|---|---|
| Expo / React Native app | Checked in under `expo/` | Primary client | Source-backed |
| GitHub Pages | `.github/workflows/pages.yml` checked in | Hosted web export/deploy path | Workflow-backed; repository/environment variable values remain external |
| `nba-data-proxy` | No source found in baseline Git tree | Supabase Edge Function v33, ACTIVE, `verify_jwt=false` | Current deployed source retrievable from Supabase; repository alone cannot reconstruct/confidently reproduce deployment |
| `nba-stats-proxy` | No source found in baseline Git tree | Supabase Edge Function v11, ACTIVE, `verify_jwt=false` | Same recoverability gap |
| `clever-endpoint` / function name `nba-stats-proxy` | No source found in baseline Git tree | Supabase Edge Function v3, ACTIVE | Current client caller not established; role remains UNKNOWN |
| `submit-feedback` | `backend/functions/submit-feedback/` checked in | Supabase Edge Function v7, ACTIVE, `verify_jwt=false` | Deployed `index.ts`, `validation.ts`, and `idempotency.ts` exactly match Git after newline normalization |
| Feedback database schema | Migration checked in | Supports durable feedback persistence | Schema intent substantially repository-backed; live DB/control-plane state remains external |
| `send-brrr-notification` | No matching function source found in baseline Git tree | Supabase Edge Function v10, ACTIVE | Current application role remains to be dispositioned |
| Python FastAPI backend | Checked in under `backend/app/` | Client may use it when `EXPO_PUBLIC_NBA_API_URL` is configured | Current deployment role is UNKNOWN; current Pages workflow does not inject that variable |
| NBA CDN | External | NBA schedule/scoreboard/box/PBP source family | Third-party dependency |
| `stats.nba.com` | External | Stats, hydration, Matchup, Players, Teams source family | Third-party dependency |
| PBPStats | External | Diagnostic/validation source paths | External; relevant feature is disabled in current Web Beta preset |
| Sentry | Integration/config checked in | Observability provider | Provider state external; client privacy configuration represented in Git |

## GitHub delivery observations

At the initial observation:

- `main` pointed to `e92dc3dcbf15c2ff4ce6681fa87e18022766d4c2`;
- GitHub reported the branch as unprotected;
- no required status checks were configured;
- the repository contained one Pages workflow;
- that workflow installed dependencies, exported Expo web, created the SPA 404 copy, uploaded the Pages artifact, and deployed it;
- the workflow did not run the test suite, TypeScript validation, or lint before deployment.

These are observations, not an accepted CI policy.

## Supabase NBA function boundary

### nba-data-proxy v33

Deployed source retrieved during Archaeology 0.1 showed:

- NBA CDN routes for scoreboard, schedule, boxscore, and play-by-play;
- NBA Stats routes including ScoreboardV3, LeagueGameLog, Traditional/Summary/Advanced boxscore data, PlayByPlayV3, MatchupsV3, Hustle, and Matchup evidence/video support;
- production Matchup 2.0 contract routes;
- playoff discovery/catalog support;
- diagnostic/audit routes.

Configuration/source observation:

```text
verify_jwt = false
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, OPTIONS
```

The handler explicitly treats `OPTIONS` but does not enforce a GET-only or POST-only gate before dispatching query-based routes.

**Runtime external reachability was not probed during Archaeology 0.1.** The evidence establishes deployed configuration and handler behavior, not every external network-control condition.

### nba-stats-proxy v11

Deployed source retrieved during Archaeology 0.1 showed NBA Stats families including:

- LeagueStandingsV3;
- TeamEstimatedMetrics;
- LeagueDashTeamStats;
- CommonTeamRoster;
- LeagueDashPlayerStats.

It likewise had `verify_jwt=false` and permissive CORS in the observed deployed source.

## Repository/deployment mismatch

**ESTABLISHED at the repository baseline:** the Git tree contains checked-in Edge Function implementation source for `submit-feedback`, but not for `nba-data-proxy` or `nba-stats-proxy`.

**OBSERVED:** current deployed source for the NBA functions can be retrieved from the Supabase control plane.

**Warrant:** CourtPulse's repository alone cannot currently reconstruct or confidently reproduce the NBA Edge Function deployment.

This does not mean the deployed source is lost, and it does not imply that secrets should be checked into Git.

## FastAPI / Matchup topology tension

The checked-in Python Matchup service returns a `not_implemented` placeholder.

The Expo client at the same baseline consumes versioned Matchup 2.0 contracts from the Supabase NBA proxy, and the deployed `nba-data-proxy` implements those contracts.

Therefore repository-only inspection of the Python backend can give an incomplete picture of current Matchup production behavior.

## Feedback as a repository-backed counterexample

For deployed `submit-feedback` v7:

- implementation source is checked in;
- all three deployed source files matched Git exactly after newline normalization;
- the database migration is checked in;
- the application-specific environment surface is documented in repository configuration/examples;
- Supabase-provided runtime variables, including `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`, are referenced in function source and supplied externally by the platform.

Actual application-specific secret values, Supabase-provided runtime values, and complete control-plane state remain external by design.

The appropriate characterization is **substantially repository-backed implementation authority**, not “the full live deployment can be reproduced from Git alone.”

## Open topology questions

- What, if any, current role remains for `clever-endpoint`?
- Is the checked-in FastAPI backend deployed in any currently relevant environment?
- What deployment history and non-secret configuration are required to reproduce the NBA Edge Functions reliably?
- Which diagnostic routes are intentionally production-exposed versus merely present in deployed source?
- Which external control-plane settings should eventually become documented/reconstructible contracts?
