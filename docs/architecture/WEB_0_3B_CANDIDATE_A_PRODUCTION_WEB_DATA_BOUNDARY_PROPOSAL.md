# Web 0.3B Candidate A — Production Web Data Boundary Responsibility Proposal

**Status:** ACCEPTED  
**Acceptance date:** 2026-09-29  
**Accepted proposal:** `b41ee01e3f9d0e0ee77dfbabaaf42150a8b0bd06`  
**Proposal date:** 2026-09-29  
**Repository baseline:** `abc626e7391ff611fe18ebd1bb151c9382c4fb13`  
**Control-plane observation:** 2026-09-29  
**Authority:** project-owner acceptance; no production change is ADMITTED

## Accepted responsibility

This document establishes the accepted responsibility boundary for Web 0.3B Candidate A.

It governs the scope and semantics of later Candidate A admissions. Acceptance of this responsibility does **not** itself authorize application, backend, Edge Function, deployment, feature-flag, security-policy, or analytics implementation changes.

## Evidence basis

Foundation 0.1 already establishes that:

- fallback success does not imply semantic equivalence;
- failure must not silently become legitimate empty data when the distinction matters;
- provenance must survive far enough to support truthful degradation;
- degradation must be capability-aware; and
- CourtPulse-owned executable logic required by an admitted production contract must be recoverable through governed artifacts.

Candidate A is motivated by a bounded production-web evidence set rather than by a general desire to rewrite networking.

At the repository baseline above, the active Web Beta is already mostly mediated through CourtPulse-controlled Supabase functions. The remaining material evidence includes:

- legacy browser-side NBA access in `expo/services/nbaApi.ts` that can traverse public third-party CORS relays;
- `fetchGameMatchups()` converting acquisition failure into `[]`;
- the standalone Player Detail route independently depending on legacy `usePlayers()` and rendering `Player not found` when that dataset is empty;
- the Playoffs client path receiving resolved `success: false` proxy envelopes in a way that can still reach an apparently legitimate empty-bracket presentation;
- broad client `DataSource.live` classification after materially different retrieval/source paths, including Stats hydration; and
- deployed NBA mediation that already carries richer source/capability/fallback information than many downstream client consumers preserve.

The 2026-09-29 control-plane observation found the CourtPulse Supabase project ACTIVE_HEALTHY, with `nba-data-proxy` v33 and `nba-stats-proxy` v11 active. The deployed `nba-data-proxy` continues to expose source/capability distinctions including source status, source capabilities, Stats-vs-CDN use, and capability-specific quarantine/degradation behavior. Those are external observations, not properties of the repository baseline.

This proposal does not reopen broad Repository Archaeology 0.1. New evidence may refine the scope later, but dormant helpers do not become Candidate A obligations merely because they exist.

## Proposed responsibility

CourtPulse production web must not depend for product correctness on uncontrolled third-party browser relays where correct acquisition or semantics require mediation that the browser cannot reliably provide.

For such capabilities, CourtPulse must use a **CourtPulse-controlled data boundary** or explicitly enter an admitted reduced-capability, unavailable, or retired state.

Across the acquisition boundary and its client adapters, CourtPulse must preserve sufficient source, capability, freshness, and failure authority for downstream consumers to distinguish:

- transport success from semantic usability;
- transport fallback from source substitution;
- source substitution from established semantic equivalence;
- capability degradation from complete success;
- stale/cache reuse from fresh acquisition; and
- source failure from authoritative empty data.

Candidate A governs production-web acquisition, fallback, provenance, capability, freshness, and truthful failure/presentation semantics.

Candidate A does **not** determine analytics trust for lineup reconstruction, on/off, possessions, or other Candidate B derived analytics. It also does not by itself establish authentication, CORS, rate-limit, abuse-prevention, diagnostic-route exposure, or other security sufficiency.

## CourtPulse-controlled data boundary

For Candidate A, a **CourtPulse-controlled data boundary** is a CourtPulse-owned mediation and contract surface used where correct product behavior or source semantics depend on capabilities the browser cannot reliably provide directly, such as:

- required request mediation;
- source selection or fallback;
- normalization;
- provenance preservation;
- capability classification; or
- truthful failure handling.

"Controlled" describes ownership of mediation and contract authority.

It does **not** by itself mean that the boundary is authenticated, private, rate-limited, abuse-resistant, origin-restricted, or otherwise security-approved. Those properties require separate security/abuse-boundary authority.

This definition does not imply that every external NBA resource must be proxied. Browser-safe direct access may remain possible where no admitted product responsibility depends on mediation or source semantics that require CourtPulse ownership.

## Minimum sufficient contract

### CA-01 — Uncontrolled relay dependence may not carry product correctness

An active production-web capability identified as in scope by Candidate A evidence/admission must not depend for correctness on an uncontrolled third-party browser relay when the capability requires CourtPulse-owned mediation or semantic handling.

Removal of such a relay does not by itself require preserving the current feature implementation. The capability must be dispositioned explicitly under CA-06.

### CA-02 — Fallback kind and authority must remain distinguishable

Transport fallback, source substitution, reduced-capability degradation, and stale/cache reuse are not interchangeable states.

A common normalized representation may be used across sources, but normalization does not establish semantic equivalence.

Where downstream behavior depends on the distinction, Candidate A must preserve enough authority to keep those states separable.

### CA-03 — Failure must remain distinguishable from authoritative empty

For active Web Beta consumers identified as in scope by Candidate A evidence/admission, source unavailability, transport failure, invalid response, incompatible capability, or acquisition that does not satisfy the applicable admitted source/capability contract must not be represented as a legitimate empty-domain result unless the relevant contract establishes that the queried domain is genuinely empty.

Examples from the evidence baseline include states such as an existing player being rendered as `Player not found` solely because an acquisition path failed, or a failed playoff catalog being rendered as though no playoff series exist.

The examples motivate the rule; they do not pre-authorize a particular fix.

### CA-04 — Preserve outcome-relevant authority to the downstream decision point

Candidate A must preserve enough normalized provenance, capability, freshness, and failure information to the downstream decision point that depends on it.

Current fields such as source identity, source status, capability maps, partial-state indicators, data-availability indicators, attempt metadata, and cache/freshness metadata are evidence of available inputs. This contract does not freeze those field names or require every current field to survive unchanged.

Adapters may consolidate or replace metadata if the resulting contract preserves the distinctions required by the consumer.

### CA-05 — Transport success is not sufficient product authority

A successful HTTP request, parseable payload, normalized shape, rendered surface, or passing transport-layer check does not by itself establish that the result is semantically usable for every downstream purpose.

A consumer may use only the claims and capabilities supported by its admitted source/capability contract.

Candidate A establishes acquisition/capability authority. It does not establish Candidate B analytics-trust thresholds.

### CA-06 — Existing active capabilities require explicit disposition, not automatic preservation

Candidate A evidence about current active product behavior does not convert that behavior into permanent architecture.

Each active Web Beta capability identified as in scope by a later admission must be explicitly dispositioned through one of the following outcomes:

1. preserve it through an admitted CourtPulse-controlled source/contract;
2. replace it with an admitted replacement capability that satisfies the accepted product requirement;
3. intentionally reduce capability or make it unavailable; or
4. explicitly retire it through product authority.

Archaeology or current reachability alone does not create a feature-retention mandate.

Known evidence candidates include scheduled pre-game player enrichment, verified Film Room pairing support, standalone Player Detail acquisition, and Playoffs failure/empty handling. Their final disposition remains open.

### CA-07 — Presentation may not overstate source or capability authority

Presentation may use simplified user-facing source/status language, but it must not claim stronger authority than the preserved acquisition state supports.

A broad internal classification such as `live` is not, by itself, sufficient authority for a user-facing claim that implies freshness, completeness, source identity, or semantic equivalence.

Candidate A does not prescribe a particular badge, enum name, vocabulary migration, or UI redesign.

### CA-08 — Candidate A stops at the derived-analytics trust boundary

Candidate A may preserve and expose that a game, box score, play-by-play stream, matchup dataset, or other input came through a particular source/fallback path with particular capabilities.

It may not decide whether that evidence is trustworthy enough for:

- lineup reconstruction;
- on/off;
- possession ownership;
- lineup-dependent ratings;
- player-possession analytics; or
- other Candidate B derived-analytics claims.

Those decisions require separate Candidate B responsibility and admission.

## Recoverability relationship

Candidate A and Foundation AC-10 interact, but they are not the same responsibility.

This proposal does not require a particular repository directory, deployment tool, Supabase migration strategy, or one-time wholesale import of every deployed Edge Function.

However, before a Candidate A implementation can become RELEASE-ACCEPTED, CourtPulse-owned executable logic required to satisfy the admitted Candidate A production contract must meet AC-10's governed-recoverability requirement.

A later admission must determine whether repository backing is:

- a prerequisite to a specific implementation;
- a parallel admitted recovery dependency; or
- a required condition before RELEASE-ACCEPTED.

This proposal intentionally does not decide that sequencing in advance.

## Security boundary

Candidate A does not establish:

- whether Edge Function JWT verification must be enabled;
- which CORS origins are allowed;
- rate-limit thresholds;
- anonymous-client abuse controls;
- economic/resource abuse controls;
- diagnostic-route exposure policy;
- secret-management policy beyond accepted Foundation constraints; or
- database grants/RLS changes.

Evidence discovered during Candidate A may inform a separate security/abuse-boundary proposal, but Candidate A does not inherit authority to resolve those questions.

## Explicit non-goals

This proposal does not:

- change production code or deployment state;
- authorize removal of any relay, route, feature, or source;
- authorize a new client or server contract implementation;
- require every NBA request to traverse Supabase;
- require current metadata field names to become permanent architecture;
- require every current active capability to be preserved;
- define a Player Detail replacement;
- define a Matchup Film Room replacement;
- define a Playoffs adapter fix;
- define a new `DataSource` enum or badge vocabulary;
- redefine possession semantics;
- define lineup trust thresholds;
- repair lineup reconstruction;
- change authentication, CORS, JWT, rate-limit, or abuse policy;
- define the final repository location of NBA Edge Function source; or
- create a production ADMISSION.

## Acceptance boundary

The accepted authority is limited to the Candidate A responsibility and minimum contract above.

It establishes what a later Candidate A implementation must respect, but leaves the following unresolved until separate admission:

- the first exact active Web Beta capability to change;
- whether one admission may cover several related false-empty/provenance paths or whether they should be sequenced separately;
- the exact controlled-source replacement, if any, for each legacy browser dependency;
- the exact normalized provenance/capability client contract;
- presentation design;
- Edge Function repository/deployment recovery mechanics;
- validation evidence required for a specific implementation; and
- release acceptance.

No production change is ADMITTED by this acceptance.
