# Web 0.3B — Recovery A: Web Beta Release-Readiness / Release-Acceptance Proposal

**Status:** PROPOSED — **NOT RELEASE-ACCEPTED**  
**Proposal date:** 2026-10-10  
**Repository proposal baseline:** `9cbd6755cd6257a749790560053834b92bbe9eba` (`main` at review)  
**Validated implementation:** `5f15d8af33dcd7bd9ff22471944f3f53cb4be563` (PR [#7](https://github.com/viviennestuds/courtpulse-app/pull/7))  
**Validation authority:** Independent reviewer accepted bounded RA-01 through RA-06 as `VALIDATED`; no project-owner release authorization implied  
**Proposed release boundary:** CourtPulse **Web Beta**, client-side Game Detail > Summary recovery only  
**Non-authorizations:** This proposal does **not** authorize merging PR #7, changing a branch's readiness state, dispatching GitHub Pages, deploying Supabase, changing application code, accepting unrelated debt, or promoting to `RELEASE-ACCEPTED`.

## 1. Decision question and preserved identities

**Decision requested:** Is the already validated Recovery A implementation suitable for a *separately authorized* CourtPulse Web Beta integration and Pages publication, with the limitations and recoverability conditions below?

Do not collapse these distinct identities:

| Identity | Current evidence / disposition |
| --- | --- |
| Recovery A implementation under validation | `5f15d8af33dcd7bd9ff22471944f3f53cb4be563`; independently reviewed `VALIDATED`, exact client implementation content |
| Original PR integration base / current `main` | `9cbd6755cd6257a749790560053834b92bbe9eba`; PR #7 open, draft, unmerged, 20 ahead / 0 behind at proposal preparation |
| Future integration commit | **NOT CREATED**. A merge commit may have a new SHA; verify the complete integration tree retains the validated eight-file Recovery A changes exactly and contains no unrelated change |
| Future Pages build source SHA and artifact | **NOT CREATED**. Must be established from the actual Actions checkout/export/upload/deploy run; do not assume equality from PR approval or merge |
| Latest historically successful Pages source | `a4217e79dc25876cbde1ac6c8c5f1163ef5e0ee0`, 2026-08-28 workflow run [33143321417](https://github.com/viviennestuds/courtpulse-app/actions/runs/33143321417) |
| Currently served Pages | Public HTML returned HTTP 200 on 2026-10-10 at `https://viviennestuds.github.io/courtpulse-app/` and referenced exactly the August 28 build's known JS/CSS asset **filenames**. This is a strong asset-identity observation, **not proof of byte-identical assets or the current deployment control-plane SHA** |
| Rollback source candidate | `a4217e79dc25876cbde1ac6c8c5f1163ef5e0ee0` given matched asset filenames, **conditional** on release-time published-source confirmation and a practicable re-publish path; not an already recoverable retained artifact |

**Repository / control-plane observation scope:** GitHub repository and workflow reads and public Page checks were made 2026-10-10. GitHub `main` was unprotected at read time; permissions and environment state may change. The GitHub connection could not read current Pages deployment identity or current Actions variable values through the available endpoint access. Unknown must remain unknown.

## 2. Durable record of the already accepted VALIDATED implementation

The independent reviewer accepted Recovery A's **RA-01 through RA-06** contract at `5f15d8af33dcd7bd9ff22471944f3f53cb4be563`, following the final source-authority restriction. This section records that evidence; it does **not** claim a new release decision or require reopening the implementation.

| Validation evidence | Disposition / precise limit |
| --- | --- |
| `CourtPulse-RecoveryA-20261010-121125.zip` | Exact-HEAD Windows Bun focused **25/25** tests / **112 assertions**, full suite **95/95** / **345 assertions**, both exit 0 |
| TypeScript comparison | Independent baseline `9cbd6755cd6257a749790560053834b92bbe9eba` and validated implementation both `bunx tsc --noEmit` exit **2**, raw diagnostics byte-identical; sole existing `expo/providers/FeatureFlagsProvider.tsx:80 TS2322`. **No-regression PASS; full typecheck FAILS** |
| Lint / Git / dependencies | `bun run lint` exit 0 with **13 warnings**, 0 errors; frozen installations pass; working/committed diff checks pass, final worktree clean |
| Shared-contract isolation | `CPRA-Shared-20261010-100424.zip`: six complete shared home/away team-stat records from three representative input fixtures deep-equal between baseline and earlier candidate `b14e0fcb...`; subsequent two commits change only pure Summary percentage lookup and its tests, not shared adapters. **Not universal payload equivalence** |
| Actual Web UI | `CPRA-UI-20261010-122124.zip`: local Chrome/Expo Web on validated SHA; controlled reconstructed partial hydration with 403 primary response; **18/18** Both/LAL/SAC checks; zero page JS errors; neutral Blocks bar **814/814 px** for 5/—, assists proportional **58.33%/41.67%** for 21/15; FT% and unavailable dashes visible. **Not live CDN or native-device proof** |
| Percentage source semantics | Archived hydrated Traditional short keys / headline / postgame observations; pinned NBA live-boxscore reference for primary descriptive fraction fields; deployed Supabase `nba-data-proxy` **v33** confirms Traditional input aliases are emitted only as normalized `fgPct`, `fg3Pct`, `ftPct`. Final PR code disallows descriptive-only Traditional output aliases |
| Git implementation envelope | PR #7 changes eight Recovery A client files, **20 ahead / 0 behind** `9cbd6755cd6257a749790560053834b92bbe9eba`; final percentage correction exclusively resolver + its tests |

**Independent decision recorded:** `VALIDATED` at `5f15d8af33dcd7bd9ff22471944f3f53cb4be563`, not a completely passing TypeScript build, deployment check, live provider reachability guarantee, native parity test, or release acceptance. Preserve the evidence ZIPs, reviewer acceptance, and this exact SHA as linked authorities. PR discussion currently holds the detailed executable evidence trail.

## 3. GitHub Pages build and release boundaries

At `9cbd6755cd6257a749790560053834b92bbe9eba`, `.github/workflows/pages.yml` is manually triggered via **`workflow_dispatch` only**. The workflow:

1. checks out the selected source with `actions/checkout@v6`;
2. installs Bun and `bun install --frozen-lockfile` in `expo/`;
3. runs `bunx expo export --platform web`;
4. copies `dist/index.html` to `dist/404.html` and creates `dist/.nojekyll`;
5. uploads `expo/dist` as a Pages artifact;
6. publishes via `actions/deploy-pages@v4` to the `github-pages` environment.

**No automatic deploy on merge. No embedded `bun test`, `tsc --noEmit`, or lint gate.** The validated local checks cannot be misdescribed as checks enforced by this workflow.

The build step takes **build-time repository Actions variables**:

- `EXPO_PUBLIC_FEEDBACK_ENDPOINT`
- `EXPO_PUBLIC_SENTRY_DSN`
- `EXPO_PUBLIC_FEATURE_PROFILE`

`FeatureFlagsProvider.tsx` uses `process.env.EXPO_PUBLIC_FEATURE_PROFILE?.trim() === 'web_beta'` to establish Web Beta behavior. The August 28 successful build job log explicitly printed `EXPO_PUBLIC_FEATURE_PROFILE: web_beta`, but **the CURRENT repository variable was not directly readable**. Before release acceptance, the authorized operator must inspect **Settings → Secrets and variables → Actions → Variables**, and confirm that `EXPO_PUBLIC_FEATURE_PROFILE` is exactly `web_beta` and that the other build variables are correctly scoped/configured (without exposing or checking in secrets). Capture the inspection date and evidence. Never infer present values from old logs.

**Pages/publication observation:** On 2026-10-10, public HTML at `https://viviennestuds.github.io/courtpulse-app/` returned 200 and referenced `_expo/static/js/web/entry-6029938dec72b5217afc4ed1b59081f4.js` and `_expo/static/css/default-styles-0e38295fc7b48fadf3d291c0c2e516d5.css`. The August 28 successful export log lists those exact filenames and explicitly records the `web_beta` environment. This **supports** continuity of the historically deployed asset family. It is **not** an observed live Pages deployment SHA nor byte-equality proof. The retrieved Actions artifact listing is empty (historical artifact not currently retrievable there); do not promise one-click artifact rollback.

### Required integration and deployment verification, only after separate authorizations

- **Before merge:** lease/check PR #7 HEAD is exactly `5f15d8af33dcd7bd9ff22471944f3f53cb4be563`, main remains the reviewed base or reconcile changes, and compare all eight validated implementation blobs with the prospective integration tree. Confirm no extra source changes. Run or preserve the appropriate no-regression checks for an updated integration tree.
- **After a separately authorized merge:** record *new* `main` integration SHA, tree/file parity with validated candidate, and merge method/parentage. Do not infer Pages has changed.
- **Before separately authorized Pages dispatch:** reconfirm Actions variables, selected workflow ref and source SHA, Pages settings/environment, and establish a concrete rollback source/build path. Confirm the future build is for the integration SHA (not a stale or floating branch).
- **After deploy:** capture run ID, checkout SHA, successful export, artifact identity if available, deployment environment URL / ID, and independently inspect the served site and shipped bundle identity, not just a successful Actions green checkmark.

## 4. Known limitations requiring explicit owner disposition

| Limitation | Established state | Proposed release disposition to decide |
| --- | --- | --- |
| Baseline TypeScript TS2322 | Existing `FlagOverrides` vs partial Web Beta preset assignment at `FeatureFlagsProvider.tsx:80`; same sole compiler error on baseline and candidate | **Proposed: document as accepted preexisting debt for this Web Beta release only**. No claim of full typecheck PASS; independent future issue for correction. Owner may instead hold release |
| NBA CDN 403 / partial live game evidence | Primary CDN access failures persist in some observations; Recovery A truthfully presents supported fallback Summary values but does not repair upstream transport, PBP, Shots, or player-level Traditional data | **Proposed: accept bounded degradation for trusted Web Beta** if live smoke tests show no false zeros or fabricated availability. No guarantee of feed recovery |
| Live-game empty-player-box-score text | During controlled live Q3 when player rows unavailable, UI says **“Stats will appear once the game starts”** even though game is underway | **Explicit product-owner decision required:** accept temporarily with separate capability-truthfulness follow-up or hold release until separately corrected. Do not alter Recovery A's accepted stats implementation implicitly |
| Shared/other product surfaces | RA-06 proves representative shared-record parity, not every Matchup/analytics interaction or source state | Preserve established scope; smoke-test representative game and unrelated pages after publication rather than claim universal regression proof |
| Deployed backend provenance | Supabase `nba-data-proxy` v33 source is retrievable but NBA Edge Functions are not fully repository-backed in current topology | No backend deploy in Recovery A. Confirm current v33 transport output if production changed; recovery of backend source remains separate proposed scope |

## 5. Recoverability and rollback proposal — NOT YET PROVEN

**Before a release acceptance decision**, the release operator should record the exact presently published Pages deployment (via authorized Pages control-plane inspection) and secure the ability to publish the prior known source or artifact. A matching public asset filename alone does not meet this requirement.

**Candidate restoration approaches (choose and rehearse one):**

1. **Restore previously published source:** Prepare an independently controlled recovery ref at the confirmed rollback source commit (the historical candidate is `a4217e79dc25876cbde1ac6c8c5f1163ef5e0ee0`), confirm `.github/workflows/pages.yml` can be dispatched on that selected ref with necessary `web_beta` variables, build an artifact, and deploy after explicit rollback authorization. **Rebuilding source is not byte-identical artifact restoration**, as dependency/environment/tool resolution and external services can change. Do not create a rollback branch or dispatch without separate authority.
2. **Back out integration:** Revert the exact Recovery A integration on `main` (or restore the pre-release tree through reviewed Git history), then separately dispatch Pages and verify served content. **This restores the prior Git tree, which may not equal the previously served August asset.** Keep that distinction explicit.

The prior workflow artifact ID `9674808212` and ZIP SHA-256 `8aee1eb9eba5aa5ef31aa5ba4c39566f732dcf8869046bacfd04e49b788e8e5e` were recorded in historical logs, but the artifacts listing returned no accessible retained item. They are provenance, **not an available rollback artifact**.

**Rollback trigger proposal:** Any material new false-zero Summary stats, fabricated bar ratios, incorrect team/source identity, game page crash, or unexpectedly widespread feature exposure should halt rollout/trigger an explicit restoration decision. Record who has rollback authorization and what observations justify it.

**Post-rollback evidence:** exact workflow/ref and Pages run, restored site response/assets, Web Beta feature profile, representative game page/Stats fallback, and new known-good published source identity. If restoration cannot be demonstrated in advance, release readiness remains **BLOCKED / UNRESOLVED**.

## 6. Post-deployment observations (conditional, not already executed)

Observe from a clean browser session after the proposed Pages release:

- Verify landing/navigation, selected Web Beta feature exposure, game list and Game Detail routing.
- Exercise a known **completed** game with populated Traditional boxscore and a representative **partial live** game or bounded injected fixture. Confirm team scores, rebounds, assists, percentages including FT%, and team identity.
- Confirm zero is shown only when explicitly supported; unsupported rebounds/turnovers show `—`; one-sided missing comparison bars are neutral, not 100:0.
- Observe both comparison and individual team views; spot-check Matchup/analytics consumers against prior accepted expectations without claiming comprehensive retesting.
- Record whether upstream CDN/Stats requests fail or partially succeed, source capability/provenance, and accurate player/PBP availability indicators (with the known empty-state limitation explicitly reported).
- Record live Pages URL, build/deployment IDs, browser/log evidence, run time, and rollback decision path. A failure to establish these observations should not be hidden by a successful deployment job.

Do **not** use reconstructed fixture values as if they were the live real-time NBA response. An unavailable live game must not be represented as authoritative empty data.

## 7. Proposed release-acceptance decision gates (none yet conferred)

| Gate | Current state | Required before owner can accept |
| --- | --- | --- |
| Exact Recovery A implementation | **VALIDATED** `5f15d8af33dcd7bd9ff22471944f3f53cb4be563` | Preserve exact eight-file candidate; hold implementation changes |
| Integration and source provenance | PR draft/unmerged; integration SHA nonexistent | Explicit separate merge authorization, verified post-merge tree, then separately authorized Pages dispatch |
| Build/profile contract | Historical `web_beta`; current variable **UNKNOWN** | Direct operator confirmation of actual variable values and relevant environment |
| Existing limitations | Documented, **not owner-release-dispositioned** | Owner choices for TS2322, CDN degradation, and inaccurate Q3 empty state |
| Published baseline | Current site HTML matches historical asset filenames; control-plane SHA **UNKNOWN** | Record current Pages deployment/source identity and ability to restore it |
| Rollback practicality | Proposed procedures only; historical artifact inaccessible | Choose/test executable recovery path with accepted limitations |
| Deployment post-checks | Proposed, not executed | Define responsibilities, criteria and evidence capture; subsequently observe actual release |
| Release authority | **NOT RELEASE-ACCEPTED** | Independent proposal review; explicit project-owner release acceptance recorded in a durable separate promotion commit |

**Recommended sequence:** independent review this **PROPOSED** document → close its control-plane/recoverability questions → project-owner release-acceptance decision and durable record → separately authorized merge → integration tree verification → separately authorized manual Pages dispatch → actual release observations / rollback if needed.

## 8. Reviewer questions

1. Is the August 28 log + current asset-name match sufficient to identify a *candidate* rollback source, and what additional control-plane evidence is required to treat it as an executable rollback?
2. Can the current `EXPO_PUBLIC_FEATURE_PROFILE` be independently confirmed as `web_beta` at acceptance time, without conflating historical build logs and current Actions settings?
3. Is the preexisting TS2322 baseline debt acceptable for bounded Web Beta while explicitly labeling full typecheck failure?
4. Is the Q3 empty-state copy defect temporarily acceptable for this release, or does product truthfulness require a separate fix first?
5. What level of pre-release restore rehearsal and post-deployment observation is proportional to this client-only Summary change?
6. Can release acceptance be granted conditionally before merge, with explicit post-merge content verification and separately authorized deployment, without confusing **RELEASE-ACCEPTED**, **MERGED**, and **DEPLOYED**?

**Requested next response:** focused independent release-readiness disposition on this one proposal, not another Recovery A implementation review.

**No implementation, release, merge, or deployment authority is created by this document.**
