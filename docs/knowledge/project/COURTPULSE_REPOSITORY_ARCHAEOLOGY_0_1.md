# CourtPulse Repository Archaeology 0.1

**Kind:** project  
**Status:** historical-baseline / active-evidence  
**Review status:** accepted as the evidentiary baseline for Foundation 0.1, subject to the reviewer amendments incorporated below  
**Repository branch:** `main`  
**Repository baseline:** `e92dc3dcbf15c2ff4ce6681fa87e18022766d4c2`  
**Tree:** `e8f1f0a95a1ddb28b9fced5e2aab9a0d9957a02a`  
**Observation date:** 2026-09-27

## Scope and boundary

Archaeology 0.1 was a read-only investigation with respect to production behavior.

It examined:

1. product/governance reality;
2. production topology;
3. data/source topology;
4. derived-analytics topology;
5. evidence/validation topology.

It did not:

- change application code;
- change feature flags;
- redeploy Edge Functions;
- repair discovered defects;
- draft accepted Architecture Contract rules;
- assign automatic acceptance/regression status to existing tests.

The evidence model used two separate lanes:

```text
EVIDENCE / EPISTEMIC LANE          NORMATIVE / AUTHORITY LANE

facts + observations                architecture contract
        ↓                                    ↓
interpretation                      roadmap / non-goals
        ↓                                    ↓
epistemic warrant                   exact admission
        ↓                                    ↓
responsible conclusion              implementation plan
```

Archaeology operated on the evidence side only.

## Evidence vocabulary

- **ESTABLISHED** — directly supported.
- **OBSERVED** — actually seen in a specific environment/time.
- **INFERRED** — reasonable but not directly established.
- **UNKNOWN** — insufficient evidence.
- **CONFLICT / TENSION** — supported observations do not reconcile.
- **EXTERNAL ASSERTION** — known operationally but not independently recoverable from the artifact under review.

## A. Product and governance reality

### ESTABLISHED

At the pinned tree:

- there was no root `README.md`;
- there was no `docs/` tree;
- `expo/README.md` was still generic Rork orientation material;
- the repository had no durable project-level Architecture Contract, Roadmap, Non-Goals, or evidence/knowledge layer;
- Web Beta behavior was encoded primarily in implementation/configuration such as feature presets and workflow state.

### INFERRED

Substantial project knowledge required conversation/operator memory to reconstruct, particularly around production topology, accepted Matchup semantics, and source/fallback behavior.

This justified a repository-recoverability investigation. It did not itself dictate which governance files must exist.

## B. Production topology

### ESTABLISHED — repository state

The baseline Git tree contained checked-in Edge Function source only under:

```text
backend/functions/submit-feedback/
```

No checked-in source for `nba-data-proxy` or `nba-stats-proxy` was present.

The checked-in Python Matchup service remained a `not_implemented` placeholder.

### OBSERVED — Supabase control plane

On 2026-09-27, the connected Supabase project exposed function records including:

```text
nba-data-proxy          v33
nba-stats-proxy         v11
clever-endpoint         v3  (function name nba-stats-proxy)
submit-feedback         v7
send-brrr-notification  v10
```

The relevant records reported `ACTIVE` and `verify_jwt=false`.

The initial project-level observation reported `INACTIVE` while individual functions reported `ACTIVE`. This was preserved as a control-plane tension rather than interpreted as an outage.

Later on 2026-09-27 the user resumed the paused project. A follow-up connector observation reported project status `ACTIVE_HEALTHY`. This later state does not rewrite the earlier observation; it resolves the operational context by time.

### ESTABLISHED / OBSERVED — NBA source recoverability

The deployed `nba-data-proxy` and `nba-stats-proxy` source could be retrieved from Supabase.

The correct warrant is:

> Current deployed NBA Edge Function source is recoverable from Supabase today. The CourtPulse repository alone cannot reconstruct or confidently reproduce that deployment.

Do not broaden this to “the full deployment is operationally recoverable.” Source retrieval does not prove possession of all required secrets, project settings, runtime configuration, provider state, deployment history, or other control-plane state.

### ESTABLISHED / OBSERVED — feedback counterexample

All three deployed `submit-feedback` v7 files matched their Git counterparts exactly after newline normalization.

The repository also contained the feedback database migration and documented environment surface.

The correct characterization is:

- implementation source: repository-backed;
- database schema intent: represented;
- expected environment surface: documented;
- actual secrets/runtime values: external by design;
- exact control-plane state: not wholly Git-owned.

Therefore `submit-feedback` is substantially repository-backed, not proof that the full deployed system is reproducible from Git alone.

### OBSERVED — NBA Edge Function configuration

Retrieved deployed source showed:

```text
verify_jwt = false
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, OPTIONS
```

The `nba-data-proxy` request handler handled `OPTIONS` explicitly and did not impose a GET-only or POST-only method gate before query-route dispatch.

The correct finding is:

> A deployed Edge Function was observed with JWT verification disabled, permissive CORS, and no route-level method gate in the inspected handler. External runtime reachability was not probed during Archaeology 0.1.

Do not replace this with the stronger unproven phrase “publicly callable.”

## C. Data/source topology

### ESTABLISHED

CourtPulse currently has several distinct source and fallback mechanisms.

Examples include:

- Games/date discovery through `gamesByDate` on `nba-data-proxy`;
- game boxscore and PBP through NBA proxy routes;
- Stats game hydration as fallback when richer CDN game detail is unavailable;
- Matchup 2.0 through strict versioned proxy contracts;
- Teams/Players through `nba-stats-proxy`;
- local/static fallbacks in selected client paths;
- legacy browser-side Stats access through public CORS relays in selected paths;
- PBPStats as diagnostic/validation evidence in feature-gated paths.

### ESTABLISHED — vocabulary pressure

`live` is overloaded. At the baseline, a successful Stats-hydrated historical game and a successful network-backed team request can both emerge as `source: 'live'`.

Therefore `live` does not establish:

- temporal liveness;
- one upstream family;
- semantic equivalence;
- completeness.

Likewise, `fallback`, `source`, `validated`, and `canonical` have multiple current meanings.

Archaeology exposed this ambiguity. It did not authorize a code-wide rename.

## D. Derived-analytics topology

A simplified dependency map established during archaeology:

```text
BOX SCORE
    │
    └── starter markers
              │
              ▼
PBP ──────► timeline reconstruction
 │                 │
 │                 ▼
 │         timeline integrity report
 │                 │
 │                 ├── observational only
 │                 ▼
 │          lineup reconstruction
 │                 │
 │                 ├── minutes / +/-
 │                 ├── lineup ratings
 │                 ├── player intervals
 │                 └── on/off
 │
 ├── shot normalization
 ├── scoring runs
 └── droughts
         │
         └── separate stretch lineup inference
```

### ESTABLISHED — integrity is not a trust gate

`validateTimelineIntegrity()` reports coverage, gaps, overlaps, player minutes, plus/minus, and lineup counts, and logs large discrepancies.

The dependent analytics pipeline continues after the report. The report does not currently establish a `trusted / degraded / unavailable` authority state.

### ESTABLISHED — validator cannot faithfully observe every original invalid lineup state

In `buildTeamTimeline()`:

- when the internal lineup has more than five players, a stored segment uses `.slice(0, 5)`;
- when fewer than five players are tracked, the segment is omitted.

Therefore explicit over-five state is masked before validation.

Explicit under-five state is also omitted before validation, although the resulting missing time may still appear indirectly as coverage gaps.

The precise finding is:

> the validator cannot faithfully observe the original invalid lineup state.

It should not be stated that every under-five error becomes completely invisible.

### ESTABLISHED — same-clock priority already exists

The timeline builder groups same-period/same-clock actions and applies priority ordering in which scoring/free-throw events precede substitutions.

Therefore future lineup work should not characterize same-clock scoring-before-substitution ordering as wholly absent.

What remains unresolved is whether the current ordering and identity semantics are sufficient for atomic multi-player substitutions and fallback source families.

### ESTABLISHED — second lineup inference path

Run/drought stretch context does not consume the canonical timeline. It independently reconstructs lineup phases from player activity and substitutions and truncates over-five state.

Therefore gating only the canonical timeline would not automatically govern all lineup-dependent presentation.

### ESTABLISHED — possessions are currently approximated

Current lineup/on-court rating code uses a time-based possession approximation such as:

```text
possessions ≈ minutes × 1.6
```

This is not event-level canonical possession lineage.

### ESTABLISHED — Lineup Swing Value has two independent selection-validity defects

Inside team-specific custom-metric construction, the candidate set is formed without filtering by the current `teamId`.

Therefore both teams can consume the same cross-team lineup pool.

Independently, the code then assigns:

```text
best = nonLowLevLineups[0]
```

without a demonstrated ranking step that establishes element zero as best by Net Rating or another accepted criterion.

The correct evidence record is:

1. the candidate pool is not team-scoped;
2. “best” is the first surviving lineup, not a demonstrated best-by-metric selection.

No correction was made during archaeology.

## E. Matchup 2.0 as an existing authority exemplar

### ESTABLISHED

The pinned client uses Matchup Events contract release `1.3` / schema `courtPulseMatchup2.events.v1.3`.

The contract preserves distinctions among concepts such as:

- matchup attribution;
- credited defensive actors;
- source overlap;
- provenance;
- defensive-actor relationship;
- free-throw sequence evidence.

The client validates exact requested game/offensive-player/defensive-player identity before accepting pair evidence.

The deployed backend also preserves the semantic warning that official opponent-turnover matchup attribution is not automatically defender-caused turnover evidence.

This is evidence that CourtPulse already has a mature local example of bounded semantic authority. Foundation work should learn from it without retroactively reopening the frozen Matchup contract.

## F. Validation/test topology

### ESTABLISHED

The baseline contained exactly seven executable test files under `expo/tests/`, covering:

- feedback client contract;
- feedback Edge validation;
- feedback idempotency/policy;
- Matchup web interaction structure;
- Matchup Summary/Events hardening;
- observability context/privacy;
- responsive layout.

No checked-in lineup/timeline/analytics-engine test file was present at the pinned tree.

The Pages workflow did not run tests, TypeScript validation, or lint before deployment.

GitHub reported `main` unprotected with no required checks at the time observed.

### Warrant

None of these facts automatically authorizes CI gating.

Existing tests should not be labeled acceptance or regression tests merely because they exist or pass. Test roles are semantic claims requiring support from accepted requirements or evidence questions.

## G. Vocabulary findings

Archaeology identified at least three distinct concepts currently hidden behind `canonical`:

### Canonical representation

One normalized CourtPulse shape used internally.

### Canonical source authority

The source or evidence family that owns a particular factual field or claim.

### Canonical semantic contract

The meaning CourtPulse has explicitly accepted for a concept.

These are not interchangeable.

Similar ambiguity exists around `fallback`, `live`, `source`, `validated`, and `trusted`.

Archaeology does not authorize a universal replacement vocabulary. It establishes the need for future material work to disambiguate what it means.

## H. Conflicts, tensions, and unknowns

### CONFLICT / TENSION

A prior Rork audit referred to `backend/supabase/config.toml`, but that path did not exist in the pinned Git tree. Whether it existed only in another workspace, was generated/untracked, or reflected another local state was not established.

### OBSERVED / later resolved by time

Initial Supabase project-level status was `INACTIVE` while function records were `ACTIVE`. After the user resumed the project later on 2026-09-27, the project reported `ACTIVE_HEALTHY`.

### UNKNOWN

The current role of Supabase function slug `clever-endpoint`.

### UNKNOWN

Whether the checked-in FastAPI backend is deployed in a currently relevant non-Pages environment.

### UNKNOWN

The full deployment/configuration history required to reproduce `nba-data-proxy` and `nba-stats-proxy`.

### UNKNOWN

A repository-wide accepted analytics-trust model.

### UNKNOWN

Formal semantic roles for each existing test.

## I. What Archaeology 0.1 earns

Archaeology 0.1 is sufficient evidence to draft Foundation 0.1 as a documentation-only proposal.

It is not sufficient by itself to:

- fix discovered analytics defects;
- migrate/deploy NBA Edge Function source;
- define a lineup trust algorithm;
- redefine possessions;
- select new CORS/JWT/authentication policy;
- remove diagnostic routes;
- delete the Python backend;
- rename overloaded identifiers;
- add mandatory CI gates;
- classify all existing tests;
- begin Web 0.3B implementation.

Those are normative and implementation decisions that require separate authority.

## J. Accepted evidentiary disposition

The accepted baseline conclusion is:

> CourtPulse has enough recovered evidence about its present repository, deployment topology, source/fallback structure, derived-analytics dependencies, and validation gaps to propose a repository-level engineering foundation without depending on conversation mythology.

That conclusion does not determine the final architecture.

Foundation 0.1 must remain **PROPOSED** until independently reviewed and explicitly accepted.
