# CourtPulse Non-Goals

**Status:** ACCEPTED  
**Acceptance date:** 2026-09-28  
**Accepted proposal:** `70724d8cca219f860ade9d8de9c37eed6626db5e`  
**Authority:** project-owner acceptance

These non-goals are intended to stop Foundation 0.1 from becoming a disguised implementation phase.

## Foundation 0.1 does not

- change production application behavior;
- import or redeploy `nba-data-proxy` or `nba-stats-proxy`;
- fix Lineup Swing Value;
- rewrite lineup reconstruction;
- define or implement an analytics trust-gate algorithm;
- redefine possession semantics;
- change CORS, JWT, authentication, or rate-limit policy;
- remove diagnostic routes;
- delete or repurpose the checked-in Python backend;
- rename `DataSource.live` or perform vocabulary-driven code churn;
- standardize every existing use of `canonical`;
- add required CI or branch-protection gates;
- reclassify all existing tests as acceptance or regression tests;
- reopen frozen Matchup contracts merely because a new methodology is being proposed;
- claim that a deployed function is fully reproducible because its current source can be retrieved;
- require secrets or credentials to be committed to source control.

## The Foundation is not a rewrite mandate

CourtPulse already has functioning product surfaces and mature local contracts. The purpose of Foundation 0.1 is to make future material work recoverable and reasoned, not to replace working code for aesthetic consistency.

Current implementation accidents should not be frozen automatically, but neither should every inconsistency trigger refactoring.

## The Foundation is not a universal vocabulary migration

Archaeology established that words such as `canonical`, `fallback`, `live`, `source`, `validated`, and `trusted` are overloaded.

The accepted response is to require precision in material new decisions, not to rename every historical identifier.

## The Foundation is not evidence that future phases are accepted

A roadmap entry or identified assembly debt does not grant implementation authority.

Later phases must still establish:

- the exact problem being solved;
- the relevant evidence;
- the minimum sufficient contract;
- explicit non-goals;
- acceptance criteria;
- and the project's authorization to implement.

## The knowledge layer is not a second architecture contract

Knowledge documents record evidence, current state, provenance, and unresolved tensions.

They do not become normative simply because they are durable or well organized.

The project should resist creating permanent registries or documents that have not earned retrieval, review, or decision value.
