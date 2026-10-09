# Web 0.3B — Recovery A Summary implementation plan

**Status:** PROPOSED IMPLEMENTATION PLAN — focused review requested; not an implementation or validation record  
**Date:** 2026-10-09  
**Plan baseline:** `main @ 9cbd6755cd6257a749790560053834b92bbe9eba`  
**Governing admission:** `docs/architecture/WEB_0_3B_RECOVERY_A_SUMMARY_HYDRATION_ADMISSION_PROPOSAL.md` — **ADMITTED**, project-owner authority, 2026-10-09; admitted proposal `71fb36c57658714bddf59a011a4f93d513fce428`  
**Scope:** RA-01 through RA-06 only. This plan does not admit, implement, validate, or release anything beyond them.

## Outcome and boundary

When live `statsGameHydration` already contains independently compatible team-level evidence but Traditional V3 fields are absent/null, Game Detail **Summary** can show those supported values without inventing zeros. The same rules apply to the two-team comparison and single-team view, including comparison geometry. Existing `GameDetailData.homeTeamStats` and `awayTeamStats` must remain numerically and semantically identical for every existing Matchup/analytics consumer.

This work must **not** alter NBA acquisition, proxy routing, hydration fallback selection, queries/polling, PBP, shots, lineup metrics, sourceStatus/capabilities, Supabase functions, or the separately admitted but unvalidated Playoffs A1 work.

## Inspected repository assembly at plan baseline

- `expo/services/nbaDataProxy.ts`: `pickNumber` defaults missing to zero; `pickPercentage` uses magnitude-based scaling; `extractTeamStats` constructs lossily normalized shared numeric stats. `findTeamStats` matches a team ID then falls back to `homeAway`, even when a supplied real ID is contradictory. `extractStatsTeamStats` mixes shared Traditional values and selected headline/postgame/misc fields. `normalizeStatsHydrationBoxscore` calls it twice; this is the final pre-loss hook into the already-acquired hydration response.
- `expo/services/nbaDataProxy.ts`: `normalizeProxyBoxscore` independently normalizes the primary `boxscore` route through `extractTeamStats`; a complete primary boxscore must not regress merely because the new evidence path is focused on Stats fallback.
- `expo/services/nbaGameData.ts`: `GameDetailData` declares the shared numeric home/away records. An **optional Summary-only resolved pair**, separately typed, can be attached without changing existing fields.
- `expo/services/dataProvider.ts`: `getGameDetail` selects optional FastAPI, then primary proxy, then `statsGameHydration`. It returns normalized `GameDetailData`; no new fetch or source-selection decision is needed for the proposed change.
- `expo/hooks/useNbaData.ts`: `useGameDetail` separately returns home/away numeric stats and hydration metadata. It must carry any optional Summary-only representation to Game Detail without altering React Query keys, refresh timing, PBP, or shared outputs.
- `expo/app/game/[id]/index.tsx`: `SummaryTab` and `TeamStatsSingle` read numeric shared records, including `?? 0` fallbacks. The two-team panel assumes a stats object's nonempty key count proves usable fields; the single-team view also defaults to zero. The `Summary` parent is the only intended consumer of the new resolved values; the adjacent `MatchupRealDataTab` must still receive original numeric records.
- `expo/components/StatBar.tsx`: null displays as an em dash, but the bar-width calculation currently turns null into zero. This is shared UI: any change for Summary must be opt-in (default existing behavior unchanged) or be isolated in a Summary-only wrapper.
- The current Summary rows include FG% and 3PT% but **not FT%**, even though FT% is an RA-04 supported field. A compact FT% row in both Summary modes is within the Summary-only field scope; no broader layout rewrite is proposed.
- `expo/types/index.ts`: `StatsGameHydrationResponse`, `StatsHydratedTeamPair`, Traditional teams, headline, postgame, misc, and `GameDetailHydrationMetadata` already expose the source-specific input shapes. Use those types where possible rather than inventing a new global transport contract.

## Proposed changes, in reviewable slices

### Slice 1 — Pure resolver and explicitly identified source evidence

Create `expo/services/summaryStatResolution.ts` (provisional name) with a small pure interface accepting an explicit requested game/known home-away identity, raw source-specific team-stat records and raw score evidence from **one selected acquisition assembly**. Return a pair of field-resolved Summary records. Each field has a finite `number | null` and provenance identifying its actual field/source when present. `null` means unavailable; zero is a real number only if explicitly provided by a compatible source.

Keep the supported field set bounded by RA-04: points, FG%/3PT%/FT%, total/defensive/offensive rebounds, assists, steals, blocks, qualified misc scoring fields, and conditionally admitted total-team turnovers. A fixed field-to-source-key/scale map is preferable to a generic recursive picker. Preserve explicit zeros by testing field presence *before* parsing/defaulting. Never pass values already produced by `extractTeamStats` into this pure resolver as Traditional evidence.

Proposed resolver input composition:
- **Hydration:** explicit `response.gameId`, hydrated `game` and `summary` identity/score shells, original `response.boxscore` Traditional teams, `response.game?.headlineStats`, `response.summary?.postgameCharts`, `response.misc?.teams`. Do **not** use the existing lossy `extractStatsTeamStats` or unsafe `findTeamStats` to establish new authority.
- **Primary proxy boxscore:** original `response.data.game` teams and their raw `statistics`/`stats` and scores, resolved under their own source-specific mapping. Preserve complete primary-source Summary presentation. This source is a different acquisition assembly; never merge its values with a later hydration response.
- **Optional FastAPI result:** current backend response can contain already-normalized numeric team stats with unknown missingness. Do not convert those numbers into newly verified Summary evidence. Treat backend Summary resolution as unsupported unless existing provenance proves raw field presence; record its current conditional reachability and any observed UI degradation for reviewer disposition. Do not expand backend source scope to work around this.

Identity gate: match requested `gameId` with the response; anchor to independently coherent game-shell home/away team IDs. A real source teamId conflicting with that anchor disqualifies the record even if its `homeAway` says the correct side. A placeholder/missing ID may be associated only when a uniquely assigned home/away source slot, game-scoped pairing, and absence of contradictory real IDs establish that association. A free-standing `teams[]` record marked only `homeAway` is not automatically sufficient. Where association is not established, return unavailable for its fields, not invented zeros.

Source/field scale must be selected by **source family + field**, not by numeric magnitude. For example, an established fractional source's `0.478` represents 47.8 percent; an established percentage-point source's `1` remains 1 percent. Where field scale cannot be established from source contract/fixture evidence, mark that field unavailable and report the gap rather than guess.

**Turnovers:** `turnovers`, `turnoversTeam`, and `turnoversTotal` remain distinct. Only explicit `turnoversTotal` with separately established source-specific *total-team* meaning may feed the team-total TURNOVERS row. If this proof is missing, leave the row unavailable. Never derive `turnovers + turnoversTeam` or use bare `turnovers` as an alias.

**Points and temporal identity:** Prefer valid raw game-detail score from the same requested hydration/proxy assembly when team identity and score-field availability are established. Do not treat `normalizeProxyGame`'s zero-filled `Game.homeTeam.score` as raw evidence; do not silently use the cached scoreboard shell as a Summary evidence source. Where an alternate compatible team-stat points value disagrees, preserve source identities and precedence without claiming upstream endpoints were exactly synchronized.

### Slice 2 — Preserve evidence through existing Game Detail without changing shared stats

Add an **optional** `summaryTeamStats`-style field to `GameDetailData` in `expo/services/nbaGameData.ts` (actual name subject to normal implementation discretion), typed from the pure resolver. Construct it in `normalizeStatsHydrationBoxscore` *from raw response evidence before the shared numeric output loses missingness*. Add corresponding raw-source resolution to `normalizeProxyBoxscore`.

Maintain the existing implementation and output of `extractTeamStats`, `extractStatsTeamStats`, `homeTeamStats`, `awayTeamStats`, player records, hydration metadata, status and source selection. `getGameDetail` should require no control-flow changes. Forward the optional resolved pair only through `useGameDetail` to the Summary prop on the game route. Do not pass it into Matchup or analytics.

**Intermediate verification gate before UI:** deterministic fixtures prove that the resolved pair gets expected headline values and unavailable splits, while serializing the existing numeric home/away records before/after is byte-for-byte/deep-equal for the same inputs. If impossible without altering shared output, stop and return for review; do not silently weaken RA-06.

### Slice 3 — Summary-only projection and presentation

In `expo/app/game/[id]/index.tsx`, pass the optional resolved Summary pair to `SummaryTab` and `TeamStatsSingle`. Use one small, testable Summary row projection or accessor for both views, with explicit `number | null` values; avoid all `?? 0` for admitted fields. Supported values unavailable in a particular acquisition are displayed as `—`. Keep existing conditional optional-misc row exposure when **both** sides lack that field, while one-sided availability shows the populated value and unavailable opposing value. Do not use `Object.keys(sharedStats).length` as Summary field-availability authority.

Add FT% consistently in both Summary views only, since RA-04 explicitly supports it. Preserve box score tables and Summary tab selection/scroll structure. No new global UI concepts.

For the comparison geometry, propose a tiny pure helper (e.g., `resolveSummaryComparisonWidths`) plus a Summary opt-in `StatBar` property, or a Summary-only wrapper. If either side is unavailable, render no relative dominance bars (neutral/suppressed), rather than interpreting `null` as zero. If both sides are present, retain current valid percentage/ratio behavior. The default shared `StatBar` behavior for other screens must not change.

When `summaryTeamStats` is absent entirely, **do not promote shared numeric records to verified values**. The UI may show unavailable fields or only those independently proven in the same acquisition; no blanket fallback to lossy shared numbers. Test primary boxscore success so that this constraint does not unnecessarily suppress data with genuine raw evidence.

### Slice 4 — Regression closure and runtime evidence

Run focused resolver, adapter and presentation tests, compare fixed baseline shared outputs, then full applicable TypeScript, Bun tests and lint. Finally exercise Summary Both/Home/Away on a deterministic partial and complete fixture or a controlled UI harness, including missing-one-side geometry; a hosted/manual check may support but must not replace deterministic tests. Capture exact branch HEAD, tool versions, commands, exit codes, and changed-file list. Do not claim a screenshot alone proves source-semantic compatibility.

Do not merge or deploy merely because tests pass. The implementation branch first returns its exact diff and evidence for independent implementation review, followed by validation/release decisions under the accepted state model.

## Expected files and change ceiling

| File | Expected change | Isolation constraint |
| --- | --- | --- |
| `expo/services/summaryStatResolution.ts` (new) | Pure evidence classification, field resolver and limited types | No runtime/network/React dependency |
| `expo/services/nbaDataProxy.ts` | Attach resolved Summary evidence while raw Stats/proxy source values remain available | Do not change requestProxy, source routing, old numeric functions/outputs |
| `expo/services/nbaGameData.ts` | Optional Summary-only `GameDetailData` field | Shared home/away numeric types unchanged |
| `expo/hooks/useNbaData.ts` | Forward optional field from box query | PBP/queries/analytics unchanged |
| `expo/app/game/[id]/index.tsx` | Summary props, both Summary modes and limited FT% presentation | Matchup receives identical original numeric records |
| `expo/components/StatBar.tsx` **only if needed** | Default-preserving opt-in neutral comparison when missing | All non-Summary call sites unchanged |
| `expo/tests/summaryRecoveryA.test.mjs` (new, provisional) | Pure resolver, adapter/source and UI-projection semantics | Deterministic; no live network |
| Other small Summary-only test/helper file **only if justified** | Executable geometry/row projection test seam | No application-wide refactor |

Treat this as a likely file envelope, **not** permission for a broader refactor. Tests may require a dedicated Summary-only pure projection helper; do not invent a global availability/provenance platform for this phase.

## Validation matrix and test roles

| Fixture/condition | Required evidence | Role |
| --- | --- | --- |
| Reconstructed SAC @ LAL `0012600036`, Q3, Traditional null/placeholder, headline populated | Recovery of explicit headline team stats, absent OREB/DREB and absent PBP/player rows do not block Summary | Characterization-derived regression for admitted behavior; **not** an archived exact payload |
| Completed BOS @ CLE `0012600011` with populated Traditional | Correct field precedence and no full-data Summary regression | Regression with reconstructed/independently sourced fixture provenance |
| Preferred Traditional `0` and conflicting headline `7` | Result `0`, source traditional | Acceptance |
| Preferred Traditional `17` and conflicting headline `18` | Result `17`, source traditional | Acceptance |
| Preferred absent/null/invalid; compatible headline present | Headline used only under valid identity and source scale | Acceptance |
| Every source absent, null, nonfinite, or semantically incompatible | Value `null`, not 0 | Acceptance |
| Valid team ID and contradictory real ID with matching `homeAway` | Valid accepted; contradictory rejected | Acceptance |
| Placeholder ID with proven same-game pairing vs ambiguous side-only | Only proven unique association accepted | Acceptance |
| Fraction 0, 1, 0.478 and percentage-point 0, 1, 47.8 | Source-defined scale preserved | Acceptance |
| Total rebounds present, OREB/DREB missing | Total present; both splits null | Acceptance |
| Raw `turnovers`, `turnoversTeam`, `turnoversTotal` differ | No aliasing/synthesis; total only if source meaning established | Acceptance |
| Valid same-acquisition score vs synthetic normalized 0 and conflicting headline score | Valid raw score does not disappear; source/timing not overclaimed | Acceptance |
| One side missing, other side valid; Both mode | Dash + neutral/suppressed ratio bars | Acceptance |
| Home mode, Away mode, Both mode | Same per-field source and availability decisions | Acceptance |
| Fully missing optional misc stat on both sides | Existing optional-row omission may remain; no invented 0 | Regression |
| Unchanged complete proxy boxscore / optional FastAPI data path | Primary values preserved, unsupported evidence not invented | Regression/characterization |
| Normalize original shared team stats before/after on same fixture | Exact home/away numeric record equality, including synthetic legacy zeros, for Matchup/analytics | Isolation regression |
| New Summary evidence present with same underlying query data | No new requests; query keys, polling, PBP unchanged | Structural regression |
| Unrelated `StatBar` caller with original props | Original width semantics unchanged; Summary opt-in neutralizes missing comparisons | Regression |

**Test design:** Keep the resolver and row/geometry projection functions pure so `bun test` can execute them without mounting React Native. Adapter-level tests should exercise the actual public normalizer when the repository's runner supports it; if importing app dependencies prevents that, introduce the smallest controlled integration seam rather than relying only on static tests. UI wiring still needs executable integration assertions or a targeted runtime exercise; a pure resolver pass is not proof of correct rendering.

**Execution on exact implementation HEAD, from `expo/`:**
- `bun test tests/summaryRecoveryA.test.mjs` (or actual reviewed focused test file)
- `bun test`
- `bunx tsc --noEmit`
- `bun run lint`
- `git diff --check`

Preserve raw output and exit codes; distinguish newly introduced failures from an independently verified main-baseline condition rather than assigning every unrelated failure to Recovery A. A passing test alone does not grant RELEASE-ACCEPTED.

## Explicit stop / return conditions

Stop before widening implementation if a correct resolver requires changing shared `homeTeamStats`/`awayTeamStats` semantics, fetching an additional endpoint, revising backend capability/status contracts, using cached scoreboard data without admitted provenance, redefining source percentage/turnover semantics from guesswork, changing Matchup/analytics/PBP outputs, or adding a general provenance/state-management framework.

If a contemplated change touches **Recovery B** capability status, **Recovery C** PBP, **Candidate B** analytics trust, Playoffs A1, CDN access, Supabase source, deployment/security, or CI, treat it as outside the current admission and return for separate owner authorization.

## Focused reviewer questions before substantial code changes

1. Is carrying an optional pre-loss Summary pair on `GameDetailData` the minimum viable isolated seam? Are the primary proxy and optional FastAPI paths dispositioned without fabricated availability?
2. Is the independent game/team association strong enough for placeholder Traditional team IDs while correctly refusing contradictory real IDs?
3. Are source-specific percentage scales and total-team turnover proof handled conservatively without blocking other fields?
4. Should RA-04's supported FT% be rendered as a compact additional row in both Summary modes, as proposed here?
5. Is the Summary-only comparison-geometry opt-in isolated from existing `StatBar` consumers?
6. Do the proposed intermediate shared-output equality gate and final validation suite actually establish RA-06 isolation?

**Disposition sought:** approve this *implementation plan* for bounded coding; do not reopen the already ADMITTED RA-01–RA-06 contract or represent this plan as a new ADMISSION. No production code has been changed by this planning artifact.
