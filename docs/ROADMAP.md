# CourtPulse Roadmap

**Status:** ACCEPTED  
**Acceptance date:** 2026-09-28  
**Accepted proposal:** `70724d8cca219f860ade9d8de9c37eed6626db5e`  
**Authority:** project-owner acceptance  
**Proposal baseline:** `e92dc3dcbf15c2ff4ce6681fa87e18022766d4c2`

This roadmap separates **sequence** from **implementation authority**. Placement in a future phase does not authorize the work by itself. Each material phase still requires an exact admission before production behavior changes.

## Foundation 0.1 — Repository authority and recoverability foundation

### Evidence prerequisite

Repository Archaeology 0.1 has been independently reviewed and accepted as the evidentiary baseline, subject to documented reviewer amendments.

### Accepted scope

Foundation 0.1 is documentation-only:

- establish a navigable root project entry point;
- establish foundational architecture invariants;
- establish the CourtPulse engineering reasoning framework;
- establish roadmap and non-goal boundaries;
- establish knowledge/evidence semantics;
- preserve Archaeology 0.1 as durable repository evidence;
- record the living production topology separately from the historical archaeology snapshot.

### Foundation 0.1 completion gate

Foundation 0.1 became accepted only after independent review and explicit project-owner acceptance of proposal `70724d8cca219f860ade9d8de9c37eed6626db5e`.

That acceptance grants the normative Foundation documents authority within their stated boundaries. It does not create any production implementation admission.

No production-code correction belongs in the Foundation 0.1 acceptance boundary.

## Web 0.3B — Source, fallback, and analytics trust hardening

**Status:** FUTURE PROPOSED PHASE; exact admissions not yet accepted.

Archaeology identified two broad pressure areas. They should be decomposed before implementation rather than treated as one blanket hardening task.

### Candidate admission A — production web source/transport boundary

Evidence to reconcile before implementation includes:

- browser-side legacy NBA Stats fallback paths;
- public third-party CORS relay behavior;
- existing CourtPulse-controlled Supabase NBA functions;
- incomplete repository recoverability of those NBA functions;
- fallback/capability provenance across CDN and Stats source families.

A later admission may cover controlled transport, source recoverability, fallback semantics, or related security boundaries. Foundation 0.1 does not choose the implementation.

### Candidate admission B — derived-analytics trust assembly

Evidence to reconcile before implementation includes:

- canonical timeline reconstruction and integrity reporting;
- invalid lineup state that can be masked or omitted before validation;
- lineup-dependent analytics continuing after integrity warnings;
- a separate run/drought lineup-inference path;
- minutes-based possession approximations in current lineup/on-off ratings;
- Lineup Swing Value selection-validity defects;
- source-specific event/substitution ordering semantics.

A later admission should define which prerequisite assemblies must be established, how failure/degradation is represented, and which consumers depend on the result.

Foundation 0.1 does not define trust thresholds, repair rules, or possession semantics.

## Production recovery / repository backing

**Status:** FUTURE SCOPE CANDIDATE.

Current deployed `nba-data-proxy` and `nba-stats-proxy` source can be retrieved from Supabase, but the repository alone cannot confidently reconstruct those deployments.

A later, explicitly admitted pass may bring CourtPulse-owned production logic and required non-secret deployment contracts under durable repository authority.

This phase must not imply that secrets belong in Git or that third-party provider internals must be reproducible by CourtPulse.

## Security and abuse-boundary follow-up

**Status:** FUTURE SCOPE CANDIDATE.

Potential future work includes review of:

- Edge Function authentication/admission model;
- CORS policy;
- method and route exposure;
- anonymous feedback abuse protection;
- NBA proxy resource/economic abuse controls;
- production bundle secret review;
- database grants/RLS posture.

Current configuration observations are evidence only. Foundation 0.1 does not select or enforce a new security policy.

## Trusted tester expansion

Trusted tester expansion should follow the material hardening admissions that are judged necessary for truthful data behavior and reasonable public exposure.

This roadmap does not require perfect architecture or a nominal security score before any tester can use CourtPulse. It requires that known high-impact trust and exposure questions be explicitly dispositioned rather than hidden behind successful rendering.

## Future candidate — NBA L2M adjudication context for game events

**Status:** PROPOSED BACKLOG CANDIDATE — not admitted, implemented, validated, or release-authorized. **Priority:** deferred until current Recovery A release-readiness and live-game source/capability reliability work have their own dispositions. This entry proposes future product research; it does not authorize new acquisition, scraping, UI changes, or analytics.

### Product opportunity

Add **postgame, league-assessed officiating context** from the NBA's Last Two Minute (L2M) reports to CourtPulse's existing Play-by-Play event experience, in the spirit of its existing *Clutch* contextual label. A supported, confidently associated PBP play could show a compact **NBA L2M** indicator and the league's **Review Decision**, with a link to the official explanatory report and to its video *when that particular source record supplies a usable link*. A report-first view must remain possible for reviewed incidents without a corresponding PBP action, especially non-calls. Any later reuse in Shots or Runs/Droughts event lists must point to the same evidenced association; Matchup references require independent semantic justification.

**Distinct semantics:** *Clutch* is a CourtPulse game-state/time/margin classification, while *NBA L2M* is a **retrospective published league assessment of selected officiating incidents**. Neither implies the other. The league's eligibility criteria concern close-game conditions during the last two minutes of Q4/OT, not CourtPulse's five-minute clutch definition. Reports need not exist for all games and are not inherently available during live play. A missing/inaccessible/not-yet-published report does **not** mean an error-free game. The NBA may revise assessments after further review.

The official vocabulary is **CC** (Correct Call), **IC** (Incorrect Call), **CNC** (Correct Non-Call), **INC** (Incorrect Non-Call). Preserve the distinction between an on-court whistle, its absence, and the later **NBA assessment**: for example, `INC` is not an in-game foul call. Labels should say **“NBA L2M review”**, not imply an in-game replay ruling. Retain call type, league explanation, report provenance and publication/retrieval or revision time when known; preserve ungraded/qualified states rather than manufacturing a decision.

### Necessary source and event-association research before admission

- Characterize official report discovery, eligibility, source accessibility, retention and acceptable use/linking rights **before building an importer or caching/redistributing league text/video**. Prefer attribution and source links; do not assume automated redistribution is permitted.
- Establish an L2M-specific record identity and separate it from NBA PBP `actionNumber` / CourtPulse event IDs. Report video URLs may carry `gameNo` and `eventNum` that identify a **report/video locator**, not a demonstrated PBP join key. Preserve original game ID, period, subsecond clock, possession context, review type, named participants/teams, report row/video locator and source version independently.
- Define evidence-grounded association states (for example **linked**, **ambiguous**, **unmatched**). Never join solely on clock or participant text; multiple incidents may share one timestamp or possession, and **non-calls may have no PBP row**. An unmatched L2M incident remains report context, not a newly invented canonical PBP action. If an association is ambiguous, show a separate L2M listing / source link rather than attaching a misleading PBP badge.
- Test real and adversarial cases: correct/incorrect calls and non-calls, absent report, late publication/revision, same-clock multiple incidents, participant/team mismatches, linked/unlinked clips, and final regulation versus overtime. Validate consistency across any secondary UI consumers without altering accepted canonical game scores, event order, or shared derived analytics.

**Inspection example (2026-10-10):** [official L2M report for NBA game `0042500405`](https://official.nba.com/l2m/L2MReport.html?gameId=0042500405) reports Q4 **00:11.0**, **Foul: Personal**, **INC**, with a separate official video locator `gameNo=0042500405&eventNum=2655`; it also has **two distinct reviewed incidents at Q4 00:21.5**. These are useful counterexamples to treating the report's `eventNum` as a PBP action number or clock time as a unique key. Report content is live external evidence, not frozen repository bytes, and may change.

### Explicit initial non-goals

No speculative **“deserved winner,” corrected final score, referee-caused outcome, counterfactual win probability, player unfair-benefit ranking, or official/referee blame leaderboard** from isolated L2M judgments. Such claims would require substantially different opportunity denominators, non-selection-bias controls, causal assumptions, and separately accepted authority. L2M is **selected postgame assessment evidence**, not a complete officiating audit of every possession or proof of a counterfactual game result.

This is a **future roadmap candidate**, not a Foundation 0.1 non-goal or a dependency of Recovery A/B/C. An exact later admission must settle rights, acquisition/provenance, match confidence, degradations, and allowed presentation before implementation.
