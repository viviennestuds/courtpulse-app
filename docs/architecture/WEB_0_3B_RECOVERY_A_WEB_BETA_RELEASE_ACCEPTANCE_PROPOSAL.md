# Web 0.3B — Recovery A: Web Beta Release-Acceptance Record

**Status:** **RELEASE-ACCEPTED (CONDITIONAL)** — **NOT MERGED / NOT DEPLOYED**  
**Release-acceptance date:** 2026-10-11 (project-owner local date)  
**Accepted proposal:** `4300c5baed8de07c435782f12ec84827c7da2fd4` (PR #8, independently reviewed at exact SHA; reviewer disposition PASS)  
**Authority:** explicit project-owner release acceptance after independent review; documentation-only promotion commit  
**Original proposal date:** 2026-10-10  
**Repository proposal baseline:** `9cbd6755cd6257a749790560053834b92bbe9eba` (`main` at reviewed checkpoint)  
**Validated implementation:** `5f15d8af33dcd7bd9ff22471944f3f53cb4be563` (PR #7; independent `VALIDATED`)  
**Accepted release boundary:** CourtPulse **Web Beta only**, client-side Game Detail > Summary RA-01 through RA-06; preserve exact validated eight-file implementation content.

**Three previously approved temporary product exceptions:** Existing baseline TypeScript TS2322 (full `tsc` check does **not** pass); NBA CDN 403 / reduced live-data capability (no false zeros or claim that live acquisition is restored); and inaccurate live player-statistics empty-state wording (requires **separately tracked correction**). These are not blanket approval of unrelated debt or product behavior.

**Distinct operational-risk acceptance:** The project owner was specifically asked whether they accepted **(1) an unrehearsed GitHub Pages rollback** and **(2) an unverified control-plane SHA of the currently published Pages site**, subject to a source-based recovery procedure and separate integration/deployment authorizations. The owner responded: **“I am comfortable with proceeding with Recovery A being release-accepted.”** This grants the bounded fourth exception following independent review, without claiming a deployed rollback was successful or identifying a SHA not observed.

**Non-authorizations:** Release acceptance does **not** authorize merging PR #7 or PR #8, Pages workflow dispatch, Supabase changes, NBA header changes, feature-flag changes, or further implementation. Each merge and Pages publication requires **separate explicit owner authorization**.

## 1. Decision question and preserved identities

**Decision recorded: YES, conditionally.** The owner approved `RELEASE-ACCEPTED` for the exact `5f15d8af33dcd7bd9ff22471944f3f53cb4be563` implementation with previously accepted product limitations and the explicit separate Pages operational-risk acceptance. Integration and publication remain future, independent decisions.

Do not collapse these distinct identities:

| Identity | Current evidence / disposition |
| --- | --- |
| Recovery A implementation under validation | `5f15d8af33dcd7bd9ff22471944f3f53cb4be563`; independently reviewed `VALIDATED`, exact client implementation content |
| Original PR integration base / current `main` | `9cbd6755cd6257a749790560053834b92bbe9eba`; PR #7 open, draft, unmerged, 20 ahead / 0 behind at proposal preparation |
| Future integration commit | **NOT CREATED**. A merge commit may have a new SHA; verify the complete integration tree retains the validated eight-file Recovery A changes exactly and contains no unrelated change |
| Future Pages build source SHA and artifact | **NOT CREATED**. Must be established from the actual Actions checkout/export/upload/deploy run; do not assume equality from PR approval or merge |
| Latest historically successful Pages source | `a4217e79dc25876cbde1ac6c8c5f1163ef5e0ee0`, 2026-08-28 workflow run [33143321417](https://github.com/viviennestuds/courtpulse-app/actions/runs/33143321417) |
| Currently served Pages | HTTP 200 observed on 2026-10-10 and again 2026-10-11 at `https://viviennestuds.github.io/courtpulse-app/`; public HTML references exactly the August 28 known JS/CSS asset **filenames**. This does **not** prove byte equality, current executed bundle identity, or current deployment control-plane SHA |
| Rollback source candidate | `a4217e79dc25876cbde1ac6c8c5f1163ef5e0ee0`, historically deployed with identical pre-Recovery-A `expo/` and `.github/` trees. A local nonpublishing frozen install and Expo Web export **passed**, but a real Pages restoration and current deployment control-plane identity remain **unproven** |

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

**Independent implementation validation** at `5f15d8af33dcd7bd9ff22471944f3f53cb4be563` did not itself establish a passing full TypeScript check, live provider recovery, deployment observation, native parity, or release authority. The **separate subsequent release-acceptance decision** is recorded above. Retain the exact validation SHA and evidence trail.

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

`FeatureFlagsProvider.tsx` uses `process.env.EXPO_PUBLIC_FEATURE_PROFILE?.trim() === 'web_beta'` to establish Web Beta behavior. The August 28 successful build job log explicitly printed `EXPO_PUBLIC_FEATURE_PROFILE: web_beta`. On 2026-10-11 the project owner directly checked **Settings → Secrets and variables → Actions → Variables** and confirmed that the **current repository variable is `web_beta`**. This is **owner-reported current control-plane evidence**, not an independently read API value; the GitHub connector does not expose this setting. The actual configured values/scope of `EXPO_PUBLIC_FEEDBACK_ENDPOINT` and `EXPO_PUBLIC_SENTRY_DSN` have **not** been confirmed through the same evidence; validate relevant variables before separately authorized Pages dispatch without disclosing secrets. No new build or deploy follows from this observation.

**Pages/publication observation:** On 2026-10-10, public HTML at `https://viviennestuds.github.io/courtpulse-app/` returned 200 and referenced `_expo/static/js/web/entry-6029938dec72b5217afc4ed1b59081f4.js` and `_expo/static/css/default-styles-0e38295fc7b48fadf3d291c0c2e516d5.css`. The August 28 successful export log lists those exact filenames and explicitly records the `web_beta` environment. This **supports** continuity of the historically deployed asset family. It is **not** an observed live Pages deployment SHA nor byte-equality proof. The retrieved Actions artifact listing is empty (historical artifact not currently retrievable there); do not promise one-click artifact rollback.

### Required integration and deployment verification, only after separate authorizations

- **Before merge:** lease/check PR #7 HEAD is exactly `5f15d8af33dcd7bd9ff22471944f3f53cb4be563`, main remains the reviewed base or reconcile changes, and compare all eight validated implementation blobs with the prospective integration tree. Confirm no extra source changes. Run or preserve the appropriate no-regression checks for an updated integration tree.
- **After a separately authorized merge:** record *new* `main` integration SHA, tree/file parity with validated candidate, and merge method/parentage. Do not infer Pages has changed.
- **Before separately authorized Pages dispatch:** reconfirm Actions variables, selected workflow ref and source SHA, Pages settings/environment, and establish a concrete rollback source/build path. Confirm the future build is for the integration SHA (not a stale or floating branch).
- **After deploy:** capture run ID, checkout SHA, successful export, artifact identity if available, deployment environment URL / ID, and independently inspect the served site and shipped bundle identity, not just a successful Actions green checkmark.

## 4. Existing limitations — previously approved temporary exceptions preserved

| Limitation | Established state | Owner-authorized *temporary Web Beta* disposition / limitation |
| --- | --- | --- |
| Baseline TypeScript TS2322 | Existing `FlagOverrides` vs partial Web Beta preset assignment at `FeatureFlagsProvider.tsx:80`; same sole compiler error on baseline and candidate | **OWNER-APPROVED TEMPORARY EXCEPTION, 2026-10-11:** document baseline debt for this Web Beta release only. Do not claim full typecheck PASS; track correction separately |
| NBA CDN 403 / partial live game evidence | Primary CDN access failures persist in some observations; Recovery A truthfully presents supported fallback Summary values but does not repair upstream transport, PBP, Shots, or player-level Traditional data | **OWNER-APPROVED TEMPORARY EXCEPTION, 2026-10-11:** bounded existing degradation only, with no fabricated zeros/availability and no claim of restored live feed; follow-up Recovery B/C remains separate |
| Live-game empty-player-box-score text | During controlled live Q3 when player rows unavailable, UI says **“Stats will appear once the game starts”** even though game is underway | **OWNER-APPROVED TEMPORARY EXCEPTION, 2026-10-11:** allow this preexisting misleading copy only for this release, **require separately tracked correction**; never call the current text accurate for live games or implicitly change validated Recovery A implementation |
| Shared/other product surfaces | RA-06 proves representative shared-record parity, not every Matchup/analytics interaction or source state | Preserve established scope; smoke-test representative game and unrelated pages after publication rather than claim universal regression proof |
| Deployed backend provenance | Supabase `nba-data-proxy` v33 source is retrievable but NBA Edge Functions are not fully repository-backed in current topology | No backend deploy in Recovery A. Confirm current v33 transport output if production changed; recovery of backend source remains separate proposed scope |

## 5. Selected recovery procedure and owner-accepted operational risk — Pages rollback NOT REHEARSED

**Precisely preserved evidence:** The historical Web Beta source `a4217e79dc25876cbde1ac6c8c5f1163ef5e0ee0` passed an isolated frozen installation and local Expo Web export. The original Pages deployment artifact is no longer accessible via the connector. Public HTML still references August 28 JS/CSS asset **filenames**, but not an independently established present Pages deployment SHA or asset-byte identity. An actual Pages restoration has **not** been performed. After independent review the project owner explicitly accepted those **bounded operational uncertainties** for this specific client-only Web Beta release. The risk remains real; acceptance does not mean the missing observations have been supplied.

**Selected preferred rollback method — reviewed reversion of Recovery A integration plus new, separately authorized Pages publication:**

1. The **project owner decides** whether a verified material regression requires rollback, and separately authorizes Git changes and any Pages dispatch. Before publication, name a restoration operator and **verify actual GitHub write, Actions, and Pages permissions**. No operator is preauthorized merely by this record.
2. Pin the **future** integration commit SHA, topology and then-current `main` state. For a normal **two-parent merge**, prepare a reviewable revert using `main`'s first parent as mainline. For a **squash or rebase merge**, prepare the correct reviewed revert(s) for the actual integrated commits; do not assume a merge SHA or integration method in advance.
3. Verify reverted client source/tree content matches the pre-Recovery-A application baseline (pre-release `main=${base}`, accounting for unrelated later changes) and record the new reverted SHA. Reverting Git source does **not** itself restore public Pages.
4. Under **separate explicit Pages dispatch authorization**, confirm the selected source/ref, workflow and current build variables (including `web_beta`), run manual Pages publication, and verify public assets, source/deploy identity and representative Game Detail Summary behavior.

**Alternative if reversion is unsuitable:** With separately authorized preparation and publication, create a controlled source recovery ref at `a4217e79dc25876cbde1ac6c8c5f1163ef5e0ee0` and rebuild/redeploy. Its successful local export is evidence of source-build feasibility **not** byte-identical restoration of August 28. No recovery ref or workflow dispatch is authorized now.

**Historical artifact:** Logged artifact ID `9674808212` and ZIP SHA-256 `8aee1eb9eba5aa5ef31aa5ba4c39566f732dcf8869046bacfd04e49b788e8e5e` provide provenance only, not a retrievable rollback asset.

**Proposed rollback triggers:** New false-zero Summary values, unsupported 100:0 bars, wrong team/source attribution, game-page crashes, or unexpectedly expanded feature exposure. The owner decides whether to revert; the authorized operator records the trigger, code/merge identity, dispatch and post-restoration observations.

**Post-restoration checks:** exact workflow/ref/run and new served source, Web Beta profile, HTML/assets and representative completed/partially available Summary. The prior local export does **not** prove these steps will succeed; the owner has accepted the residual risk rather than rehearsing an actual production rollback.

## 6. Post-deployment observations (conditional, not already executed)

Observe from a clean browser session after the proposed Pages release:

- Verify landing/navigation, selected Web Beta feature exposure, game list and Game Detail routing.
- Exercise a known **completed** game with populated Traditional boxscore and a representative **partial live** game or bounded injected fixture. Confirm team scores, rebounds, assists, percentages including FT%, and team identity.
- Confirm zero is shown only when explicitly supported; unsupported rebounds/turnovers show `—`; one-sided missing comparison bars are neutral, not 100:0.
- Observe both comparison and individual team views; spot-check Matchup/analytics consumers against prior accepted expectations without claiming comprehensive retesting.
- Record whether upstream CDN/Stats requests fail or partially succeed, source capability/provenance, and accurate player/PBP availability indicators (with the known empty-state limitation explicitly reported).
- Record live Pages URL, build/deployment IDs, browser/log evidence, run time, and rollback decision path. A failure to establish these observations should not be hidden by a successful deployment job.

Do **not** use reconstructed fixture values as if they were the live real-time NBA response. An unavailable live game must not be represented as authoritative empty data.

## 7. Release decision and separately controlled integration / publication

| Gate | Status at release acceptance | Next obligation |
| --- | --- | --- |
| Recovery A implementation | **RELEASE-ACCEPTED** for Web Beta only at `5f15d8af33dcd7bd9ff22471944f3f53cb4be563`, previously independently `VALIDATED` | Preserve exact eight-file candidate and ensure no unrelated code changes |
| Present Web Beta profile | `EXPO_PUBLIC_FEATURE_PROFILE=web_beta` **confirmed by project owner**, not independently read via connector | Reconfirm relevant current Actions variable scope/configuration before Pages dispatch |
| Three product limitations | **Temporarily accepted by owner** (TS2322, CDN 403/partial live capability, inaccurate Q3 empty state) | Track copy correction separately; do not claim missing capabilities are restored |
| Historical-source rehearsal / cleanup | Frozen install/export **PASS**; only expected worktree remained registered with clean Git checkout | Actual Pages restoration remains unperformed; no new source export required solely for cleanup |
| Public Pages provenance | Public asset filenames match historical build; current control-plane deployment SHA remains **UNKNOWN** and is explicitly risk-accepted | Seek actual control-plane identity where available; capture source and artifact evidence for next publication |
| Operational rollback | Source-build feasibility demonstrated; **actual Pages rollback NOT rehearsed**, owner separately accepted specific residual risk | Use selected integration-reversion procedure; confirm authorized rollback operator and permissions |
| Source integration | PR #7 still draft/unmerged; integration SHA not yet created | **Separate explicit merge authorization**, then verify validated source/tree parity |
| Pages publication | No new Pages workflow dispatch or public verification performed | **Separate explicit dispatch authorization**, then record run/source/artifact and smoke-test actual public Game Detail Summary |
| Release authority | **RELEASE-ACCEPTED 2026-10-11**, accepted reviewed proposal `4300c5baed8de07c435782f12ec84827c7da2fd4` and validated implementation `5f15d8af33dcd7bd9ff22471944f3f53cb4be563` | This promotion-only docs commit records the decision; **not MERGED or DEPLOYED** |

**Sequence:** independently reviewed proposal `4300c5baed8de07c435782f12ec84827c7da2fd4` PASS → owner accepts temporary limits and separate Pages operational risks → **RELEASE-ACCEPTED recorded in this promotion-only commit** → separately authorized implementation/docs integration → content-parity checks → separately authorized manual Pages dispatch → verified public behavior and owner-authorized rollback if needed.

## 7A. Readiness evidence received after initial proposal (2026-10-11)

This is a **descriptive evidence reconciliation**, not a release promotion. Earlier section-2 validation remains pinned to the exact eight-file implementation at `5f15d8af33dcd7bd9ff22471944f3f53cb4be563`.

- **Earlier proposal review (historical stage):** The initial draft received independent **PASS at PROPOSED level**. The revised exact proposed checkpoint `4300c5baed8de07c435782f12ec84827c7da2fd4` was **subsequently independently reviewed and passed for final readiness**. The owner has now granted separate conditional release acceptance, recorded in this promotion commit.
- **Owner control-plane confirmation:** Project owner inspected current GitHub Actions repository variables on 2026-10-11 and explicitly confirmed `EXPO_PUBLIC_FEATURE_PROFILE=web_beta`. The owner, not the GitHub connector, is the evidence source; no authenticated variable-value response was obtained by the assistant.
- **Historical-source build feasibility:** Windows nonpublishing rehearsal explicitly targeted `a4217e79dc25876cbde1ac6c8c5f1163ef5e0ee0` in an isolated temporary Git worktree and used intended `web_beta` profile. User-supplied recovered evidence archive `CourtPulse-Rollback-Export-20261011-215702-evidence.zip`, SHA-256 `a35ba3796a9f87dad647107b3f7901082c9697ab6a29810ef3e141cf5d50ba2b`, contains 7 files: two command records, corresponding stdout/stderr, and an export manifest. Records report Bun frozen install **exit 0** (73.876 sec, 995 packages) and Expo Web export **exit 0** (41.502 sec, 2,929 modules). Manifest records 25 paths totaling **4,863,925 bytes**, `index.html` and `404.html` with the same SHA-256, and `.nojekyll`. This archive stores file-hash **measurements**, not exported binary bytes; individual bundle hashes cannot be independently recomputed from the archive. The rebuilt JS asset filename differs from the August 28 deployment; no bitwise-artifact identity is claimed.
- **Rehearsal-script cleanup distinction:** The post-export `git worktree remove --force` initially failed with a Windows long-path error, preventing automatic final `result.json` and ZIP completion. The owner subsequently reported running **`git worktree list`** with exactly one registered worktree, `C:/Users/awate/CourtPulse-Validation 5f15d8a (detached HEAD)`, and **`git status --short`** with no output. This **establishes the observed Git worktree registry and checkout cleanliness** at that point, rather than proving every temporary file was physically deleted or that the failed finalization phase was retroactively executed. The short displayed hash is consistent with the validated implementation; the full implementation SHA remains established independently from GitHub.
- **Public Pages observation:** On 2026-10-11, a fresh public HTML fetch returned **HTTP 200** and continued to reference the exact August 28 logged JS/CSS asset names. Current Pages deployment control-plane SHA, current bytes of those assets, and executable restoration remain unverified.
- **Three owner-approved temporary limitations:** The owner explicitly approved preexisting TS2322, ongoing CDN 403/reduced live-game capability, and inaccurate live-game player-statistics empty-state copy **for this bounded Web Beta release**, subject to a separately tracked correction of the copy. This decision is **not** an approval to misrepresent missing basketball data, a waiver of other release prerequisites, or a grant of RELEASE-ACCEPTED.

**Subsequent decision:** Independent reviewer reported **PASS for final readiness** at `4300c5baed8de07c435782f12ec84827c7da2fd4` and recommended conditional acceptance only if the owner separately accepts the unrehearsed Pages rollback and unverified current deployment SHA. When expressly asked about precisely those risks, the owner agreed to make Recovery A `RELEASE-ACCEPTED`. This is a fourth, distinct operational-risk acceptance. No actual restoration was demonstrated, and no PR merge, Pages dispatch, Supabase, flag or Gabriel-header change was authorized.

## 8. Independent review PASS and binding release boundaries

The independent reviewer checked PR #8 at exact `4300c5baed8de07c435782f12ec84827c7da2fd4` and recommended **conditional `RELEASE-ACCEPTED`** upon explicit owner risk disposition. The project owner has granted that precise acceptance. The review also required a concrete preferred rollback method; Section 5 now selects a reviewed **integration reversion** and separately authorized Pages deployment, with historical-source rebuilding as fallback.

**The following safeguards remain required before use/publication:**

- Preserve exactly the eight-file validated implementation at `5f15d8af33dcd7bd9ff22471944f3f53cb4be563`; verify PR #7 HEAD and pre-/post-integration parity and record any future actual integration SHA and topology.
- Request **separate owner authorization** for PR #7 integration, PR #8 documentation integration, and Pages workflow dispatch. This acceptance does not authorize any of them.
- Before dispatch, verify source/ref selection, relevant build variables, Pages permissions, and an available, authorized rollback operator.
- After deployment, capture workflow/ref/build/deployment evidence and verify public Web Beta configuration, navigation, completed/partially available Game Detail Summary, percentages and truthful unavailable values. Do not label constructed fixtures as live NBA observations.
- Separately track correction of the inaccurate player-statistics empty state. Recovery B/C, Gabriel-header acquisition diagnostics, native app/SDK, L2M and other work remain separate and unauthorized by this release decision.

**Durable authority boundary:** `RELEASE-ACCEPTED` exists as this documentation-only promotion commit on PR #8's branch. Both PR #7 and PR #8 are still unmerged at this point, and canonical `main` was not changed by this promotion. No GitHub Pages or Supabase deployment was initiated.