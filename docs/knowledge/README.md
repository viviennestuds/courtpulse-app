# CourtPulse Knowledge Layer

**Status:** PROPOSED knowledge semantics  
**Authority:** Descriptive/evidentiary; this file does not itself authorize production behavior

## Purpose

The knowledge layer exists so CourtPulse can recover important project state without depending on chat history, operator memory, or the current implementation being self-explanatory.

Knowledge captures:

- evidence;
- current-state topology;
- historical investigation baselines;
- provenance;
- unresolved conflicts and unknowns;
- the semantic role of validation artifacts where that role has actually been established.

Knowledge is not a substitute for the Architecture Contract, Roadmap, Non-Goals, or an exact implementation admission.

## Evidence labels

Use these labels when the distinction matters:

### ESTABLISHED

Directly supported by sufficiently strong repository, runtime, deployment, provider, or other evidence.

### OBSERVED

Actually seen in a specific environment or at a specific time.

An observation should identify the relevant environment/date when staleness could matter.

### INFERRED

A reasonable conclusion from evidence that is not directly established.

### UNKNOWN

Available evidence is insufficient.

### CONFLICT / TENSION

Two or more supported observations do not currently reconcile.

Do not silently resolve the conflict to make the documentation cleaner.

### EXTERNAL ASSERTION

Known from operator, deployment, or manual operational knowledge but not independently recoverable from the artifact currently under review.

## Repository facts versus control-plane observations

A Git commit can pin repository state. It cannot pin every external system.

Use forms such as:

```text
Repository baseline:
e92dc3dcbf15c2ff4ce6681fa87e18022766d4c2

Control-plane observation date:
2026-09-27
```

for documents that combine Git evidence with Supabase, GitHub settings, hosted runtime, Sentry, or other external observations.

Do not imply that checking out a commit recreates branch protection, deployment status, environment variables, secret values, provider state, or hosting configuration.

## Historical baseline versus living knowledge

A historical evidence report should preserve what was established at that investigation boundary, including tensions that were unresolved at the time.

A living knowledge document can be updated as current state changes.

Do not rewrite historical evidence solely to make it match later state. Add a follow-up observation instead.

## Test roles

Test-role labels are semantic claims.

Possible roles include:

- **probe** — asks an evidence question;
- **characterization** — records current behavior without accepting it;
- **contract / conformance** — checks an explicitly named contract;
- **acceptance** — demonstrates an accepted requirement;
- **regression** — protects an already accepted behavior from recurrence.

Do not infer a test's role merely from:

- its filename;
- its age;
- whether it passes;
- whether it runs in CI;
- or whether it covers a bug.

A test can change roles when project authority changes, but that transition should be explicit.

## Terminology notes

Current CourtPulse usage has shown that the following words need local precision:

- canonical;
- fallback;
- live;
- source;
- validated;
- trusted.

The knowledge layer should expose ambiguity rather than silently normalizing it.

In material new work, distinguish where relevant among:

- canonical representation;
- source authority for a fact;
- accepted semantic contract.

## Knowledge write discipline

A useful knowledge entry should answer at least one retrievable question a future contributor is likely to have.

Prefer one durable document that resolves a real recovery problem over multiple ceremony-driven registries.

When a finding has implementation implications, record the finding here and take the proposed behavior through the normative lane separately.
