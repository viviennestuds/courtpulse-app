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
