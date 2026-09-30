# Web 0.3B Candidate A1 — Playoffs Failure vs Authoritative Empty Admission Proposal

**Status:** PROPOSED  
**Target decision state if accepted:** ADMITTED  
**Proposal date:** 2026-09-30  
**Repository baseline:** `900a0fb5e0c0e4950f479b7a379915f21cb4f307`  
**Control-plane evidence:** deployed `nba-data-proxy` v33 observed 2026-09-30  
**Authority:** proposal only; no A1 production change is ADMITTED

## Decision sought

This document proposes the first exact production admission under the accepted Web 0.3B Candidate A responsibility.

The decision is intentionally narrow:

> For the active Web Beta Playoffs capability, should CourtPulse admit a client-only correction that prevents failed, incompatible, or zero-result playoff-catalog acquisition from being presented as authoritative emptiness when the current backend contract cannot prove that emptiness?

If this proposal is independently reviewed and explicitly accepted by the project owner, the production behavior defined in **Proposed admitted behavior** becomes **ADMITTED** for implementation within the stated scope and non-goals.

Acceptance of this proposal would not itself mean the implementation is IMPLEMENTED, VALIDATED, RELEASE-ACCEPTED, or FROZEN.

## Accepted authority this proposal depends on

Candidate A already establishes that:

- source failure must remain distinguishable from authoritative empty;
- transport success does not establish semantic usability;
- source substitution does not establish semantic equivalence;
- presentation may not overstate acquisition authority; and
- an active capability may intentionally degrade or become unavailable instead of preserving an unsupported presentation.

A1 applies those accepted rules to the active Web Beta Playoffs surface only.

## Evidence established for A1

At the repository baseline above:

1. `PlayoffsScreen` uses React Query with `getPlayoffCatalog` directly as its `queryFn`.
2. `getPlayoffCatalog()` directly returns `requestProxy('playoffCatalog')` without route-specific failure or compatibility classification.
3. `requestProxy()` resolves ordinary non-2xx, network, timeout, invalid-JSON, and empty/invalid-JSON cases as structured `success: false` envelopes rather than rejecting the promise.
4. `buildPlayoffBracket()` does not inspect `success`, `sourceStatus`, or `noGamesConfirmed`; absent or unusable catalog arrays naturally become a zero-round bracket.
5. The Playoffs screen renders `No playoff series found` whenever the query is neither loading nor in React Query's error state and the bracket has zero rounds.
6. Therefore a resolved `success: false` envelope can reach the authoritative-empty presentation path.
7. No current executable test establishes resolved failure envelopes as a permanent repository-wide `requestProxy()` contract, while existing consumers do currently inspect such envelopes and derive route-specific behavior from them.
8. The deployed `playoffCatalog` schedule path can return `success: true`, `sourceStatus: "ok"`, `noGamesConfirmed: true`, and an empty catalog after a parseable upstream response whose expected schedule structure is absent.
9. The deployed Stats fallback can likewise treat a parseable upstream response with no recognized LeagueGameLog result set as successful acquisition with zero games.
10. `noGamesConfirmed: true` is also present for populated successful results; it therefore does not currently mean that the playoff domain is empty.
11. The Stats fallback defaults to a specific season/season-type domain when no client parameters are supplied, so a zero-row Stats fallback is not established as semantically equivalent to a zero-result schedule domain.

The A1 evidence review therefore establishes:

> The current `playoffCatalog` contract cannot positively prove authoritative playoff-domain emptiness.

This proposal does not redefine `noGamesConfirmed` and does not infer source equivalence from zero results.

## Proposed admitted behavior

If accepted, A1 authorizes the following production behavior for the **active Web Beta Playoffs capability only**.

### A1-01 — Classify Playoffs acquisition before bracket construction

The client must establish a Playoffs-specific acquisition state before a catalog is supplied to the existing bracket builder.

The admitted client state boundary must distinguish at least:

- **usable populated** — a successful, route-compatible catalog contains usable playoff data;
- **unavailable** — acquisition failed, the route payload is malformed/incompatible, or the current contract cannot establish sufficient authority for a zero-result catalog.

A1 deliberately does **not** admit an authoritative-empty acquisition state.

### A1-02 — Populated compatible catalogs remain usable

A successful, route-compatible playoff catalog containing usable playoff data may continue to the existing bracket builder and presentation flow.

This includes a populated Stats fallback if it satisfies the admitted Playoffs client compatibility contract.

Allowing a populated Stats fallback does not declare the Stats and schedule sources semantically equivalent.

### A1-03 — Failure cannot become authoritative empty

Any of the following must enter the Playoffs unavailable/error state and must not reach the `No playoff series found` presentation path:

- `success: false`;
- client/network failure;
- timeout;
- invalid JSON;
- empty/invalid JSON response;
- HTTP/backend failure represented through a resolved failure envelope;
- route payload that is malformed or incompatible with the admitted Playoffs client contract.

### A1-04 — Zero-result catalogs are unavailable under A1

A zero-result playoff catalog must enter the unavailable/error state even when the current response says `success: true`, `sourceStatus: "ok"`, or `noGamesConfirmed: true`.

This is an intentional reduced-capability disposition under Candidate A CA-06.

A1 does not claim that no playoff series exist because the current controlled backend contract does not positively establish that authority.

Accordingly, under A1:

`No playoff series found` is not an acquisition-empty state for the active Web Beta Playoffs capability.

### A1-05 — Filter-empty behavior remains distinct

Once a usable populated bracket has been established, the existing presentation:

`No series match these filters`

may continue when active conference/round filters remove all otherwise-valid series.

This is a presentation/filter result over already-usable data, not an acquisition-empty claim.

### A1-06 — Unavailable presentation must be explicit

The Playoffs surface must present an explicit unavailable/error state when A1 classifies acquisition as unavailable.

A1 does not prescribe exact visual styling or copy. Reusing or minimally adapting the existing Playoffs acquisition-error presentation is allowed if it truthfully represents unavailability and cannot be confused with authoritative empty.

## Authorized implementation boundary if admitted

A1 authorizes a **client-only, Playoffs-specific** implementation sufficient to satisfy A1-01 through A1-06.

The implementation may:

- add a route-specific Playoffs catalog classifier/adapter around the current `getPlayoffCatalog()` path;
- update the Playoffs query/consumer state handling so unavailable acquisition reaches the explicit error/unavailable presentation;
- introduce the minimum client-side types/helpers needed to represent the admitted A1 states; and
- add focused automated tests/fixtures for the admitted behavior.

The exact TypeScript placement may be `getPlayoffCatalog()`, a Playoffs-specific query adapter/resolver, or another route-specific client boundary if the implementation preserves this admission.

The implementation may **not** use A1 as authority to change generic `requestProxy()` semantics.

## Explicit non-goals

A1 does not authorize:

- changing `nba-data-proxy` or any other Supabase Edge Function;
- deploying or configuring Supabase;
- redefining `noGamesConfirmed`;
- changing schedule-vs-Stats source-selection order;
- declaring schedule and Stats zero-result semantics equivalent;
- creating an authoritative-empty backend contract;
- preserving or restoring the current `No playoff series found` acquisition state;
- changing `buildPlayoffBracket()` series/bracket semantics;
- changing Playoffs conference/round filtering semantics;
- changing unrelated `requestProxy()` consumers;
- changing generic NBA data transport behavior;
- changing Player Detail, Film Room, Matchup league-player requests, or other Candidate A capabilities;
- changing authentication, JWT, CORS, rate limits, abuse controls, diagnostic-route policy, database policy, or other security behavior;
- changing Candidate B lineup/on-off/possession trust behavior; or
- authorizing unrelated cleanup or refactoring.

No backend recoverability change is required by this client-only admission. If implementation later discovers that satisfying A1 requires CourtPulse-owned backend behavior to change, that is outside this admission and requires separate authority.

## Validation criteria

An A1 implementation is not VALIDATED merely because the UI appears reasonable. Validation must exercise the admitted state boundary directly.

At minimum, tests or equivalent reproducible evidence must establish:

| Case | Required A1 result |
|---|---|
| Valid successful populated schedule catalog | usable → existing bracket flow |
| `success: false` response | unavailable/error; never authoritative empty |
| Network failure | unavailable/error; never authoritative empty |
| Timeout | unavailable/error; never authoritative empty |
| Invalid or empty JSON | unavailable/error; never authoritative empty |
| HTTP-200 route payload that is structurally incompatible | unavailable/error; never authoritative empty |
| `success: true` zero-result schedule catalog | unavailable/error under A1 |
| `success: true` zero-result Stats fallback | unavailable/error under A1 |
| Valid successful populated Stats fallback | usable if route-compatible; no source-equivalence claim |
| Valid bracket whose active filters remove every series | existing filter-empty presentation remains distinct |

Validation must also show that the admitted implementation does not change generic `requestProxy()` behavior or other current consumers.

The exact automated-test framework/file placement is an implementation choice, but the evidence must be reproducible and sufficient to distinguish the cases above.

## Counterexamples the implementation must reject

The implementation is not conforming if any of these still reaches the acquisition-empty presentation:

```text
success:false
→ resolved query
→ zero rounds
→ "No playoff series found"
```

```text
HTTP 200 + parseable object
+ incompatible playoffCatalog structure
→ zero catalog
→ "No playoff series found"
```

```text
success:true
+ current noGamesConfirmed:true
+ zero catalog
→ "No playoff series found"
```

The third counterexample is intentional: A1 does not grant current `noGamesConfirmed` authoritative-empty meaning.

## Alternative considered and deferred — restore authoritative empty

A stronger future capability could preserve a legitimate acquisition-empty UX by strengthening the CourtPulse-controlled backend contract.

A future proposal may consider source-specific validation such as:

- schedule acquisition must establish the expected schedule-domain structure before a zero-playoff result can become authoritative empty;
- Stats acquisition must establish a recognized LeagueGameLog result set, explicit season/domain identity, and any other required contract semantics;
- zero results from one source must not automatically inherit the empty authority of another source; and
- invalid upstream structure must remain incompatible/unavailable rather than empty.

That future direction may eventually support a state model such as:

```text
validated schedule domain + playoff games
→ populated

validated schedule domain + zero playoff games
→ authoritative empty

schedule unavailable + valid populated Stats fallback
→ populated source-substituted

schedule unavailable + zero Stats rows
→ unavailable unless separately admitted

invalid upstream structure
→ incompatible / unavailable
```

This alternative is **deferred**. It is not part of A1.

Because it would modify CourtPulse-owned backend behavior, a future admission would also have to resolve the accepted AC-10 recoverability requirement before RELEASE-ACCEPTED.

## Proposed implementation state sequence

If this proposal is accepted:

```text
A1 evidence / investigation
COMPLETE

A1 production behavior
ADMITTED

implementation
not yet IMPLEMENTED

validation
not yet VALIDATED

release
not yet RELEASE-ACCEPTED
```

Implementation should begin only after the repository contains the durable admission promotion.

## Admission boundary

If explicitly accepted, this proposal admits only the behavior in A1-01 through A1-06 and the client-only implementation boundary above.

It does not grant authority to broaden A1 during implementation for convenience.

Any material need to modify backend source semantics, generic proxy behavior, source selection, bracket semantics, security policy, or another Candidate A capability must return to the appropriate evidence/authority cycle.

Until project-owner acceptance is recorded durably in the repository:

**No A1 production change is ADMITTED.**
