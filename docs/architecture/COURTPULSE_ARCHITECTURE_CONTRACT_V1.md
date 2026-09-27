# CourtPulse Architecture Contract V1

**Status:** PROPOSED  
**Authority:** Normative proposal pending independent review and explicit acceptance  
**Proposal baseline:** `e92dc3dcbf15c2ff4ce6681fa87e18022766d4c2`  
**Archaeology basis:** CourtPulse Repository Archaeology 0.1

## Purpose

This document proposes the minimum foundational invariants needed for future material CourtPulse work. It does not canonize the current implementation. It does not authorize production-code changes by itself.

Repository Archaeology 0.1 established evidence about current CourtPulse behavior and recoverability. Those findings explain why these rules are being proposed; they do not make the rules accepted automatically.

## AC-01 — Evidence and authority are separate lanes

Facts, observations, tests, runtime traces, upstream responses, and implementation behavior belong to the evidence / epistemic lane.

Architecture contracts, roadmap admissions, non-goals, responsibility decisions, and implementation admissions belong to the normative / authority lane.

Evidence can establish prerequisites for a decision. Evidence does not grant itself normative authority.

A current implementation may establish what CourtPulse does. It does not, by that fact alone, establish what CourtPulse should permanently require.

## AC-02 — Source evidence, representation, derived analytics, and presentation are distinct

CourtPulse must not collapse these layers conceptually:

```text
source evidence
      ↓
normalized / canonical representation
      ↓
derived analytics
      ↓
presentation
```

A normalized representation does not make every upstream source semantically equivalent.

A presentation state does not establish the validity of the analytics beneath it.

When the term `canonical` is used in material new work, the work must make clear whether it means:

- a normalized CourtPulse representation;
- source authority for a specific fact; or
- an accepted semantic contract.

Existing identifiers need not be renamed merely to satisfy this terminology.

## AC-03 — Downstream claims may not gain unsupported semantic authority

A downstream transformation or UI claim must not assert a stronger meaning than its evidence and accepted contracts support.

Normalization may change shape. It may not silently manufacture certainty, causality, identity, completeness, or source equivalence.

When evidence supports association but not causation, CourtPulse must preserve that limit. For example, official matchup attribution does not by itself establish that a defender caused a turnover.

## AC-04 — Fallback success does not imply semantic equivalence

A fallback may restore transport, availability, source coverage, schema compatibility, or a reduced capability set. Those are different conditions.

Successful fallback must not be treated as proof that:

- the replacement source has identical semantics;
- every downstream field remains available;
- every derived analytic remains valid; or
- the original provenance no longer matters.

Material fallback paths must preserve enough provenance and capability information to support truthful downstream behavior.

## AC-05 — Failure is not legitimate empty data

An unavailable, failed, incompatible, or untrusted source state must not be silently represented as a legitimate zero-row or empty-domain result when that distinction matters to the user or to downstream computation.

Empty data is authoritative only when CourtPulse has sufficient evidence that the queried domain is genuinely empty under the relevant contract.

## AC-06 — Derived analytics require established prerequisite assemblies

A derived metric or analytic is not trustworthy merely because its arithmetic executes.

Before an analytic is presented as valid, the semantic prerequisites it depends on must be sufficiently established for that use.

Examples of prerequisite assemblies can include:

- player and team identity;
- event ordering;
- lineup membership;
- possession boundaries;
- source completeness;
- metric ownership;
- pair orientation;
- required upstream capability.

If a prerequisite is unresolved or fails an accepted trust condition, dependent analytics must not silently continue as though the prerequisite had succeeded.

This invariant does not define the trust algorithm or thresholds for any current CourtPulse analytic. Those require separate admission.

## AC-07 — Provenance must survive far enough to support truthful degradation

CourtPulse does not need to expose raw upstream metadata everywhere, but transformations must retain enough provenance to distinguish materially different states later.

Where downstream behavior depends on source family, completeness, fallback mode, validation status, or capability, that information must not be discarded before the dependency is resolved.

## AC-08 — Degradation must be truthful and capability-aware

When CourtPulse cannot support an admitted claim at full strength, the system should prefer an explicit reduced-capability or unavailable state over a fabricated repair or misleadingly complete result.

A degraded state must not imply that unavailable evidence was observed.

Synthetic or demo content must not masquerade as production evidence.

## AC-09 — Feature exposure does not establish factual or metric authority

A feature flag, route, experiment, visual surface, or successful rendering state controls exposure. It does not independently establish that the underlying data or metric is valid.

Likewise, a successful request, a passing test, or a deployed function does not independently establish that its behavior is desirable or release-authorized.

## AC-10 — Test roles are semantic, not historical

A test's role is determined by what accepted requirement or evidence question it serves.

The mere existence of a green test does not make it an acceptance test or regression test.

A characterization or probe can later become regression protection when the corresponding behavior is explicitly accepted. That transition must be intentional.

## AC-11 — CourtPulse-owned production behavior must be recoverable through governed artifacts

CourtPulse-owned executable logic required to satisfy an admitted production contract should be recoverable from version-controlled source or another explicitly governed reproducible artifact.

This proposed invariant distinguishes:

- **CourtPulse-owned executable logic:** version-controlled or governed reproducibly;
- **non-secret deployment configuration:** reconstructible and documented to the extent required by the contract;
- **secrets and credentials:** intentionally external to source control;
- **third-party provider internals:** external dependencies, not CourtPulse artifacts.

This rule is about recoverability and authority, not one mandatory hosting platform or directory layout.

It does not imply that retrieving current deployed source alone proves complete deployment reproducibility.

## AC-12 — New methodology is prospective by default

Adopting a stronger reasoning or governance framework does not automatically reopen every previously accepted CourtPulse decision.

Existing accepted or frozen contracts remain evidence and authority within their admitted scope unless:

- new evidence creates a material conflict;
- their scope is intentionally reopened; or
- a later accepted contract supersedes them.

New material work should follow the current accepted framework once that framework itself is accepted.

## Change and acceptance

While this document remains **PROPOSED**, none of the invariants above should be treated as frozen project authority.

Promotion to accepted/canonical authority requires independent review and explicit acceptance. Material later amendments should preserve the distinction between:

- evidence that motivates a change;
- the proposal itself; and
- the acceptance that grants authority.
