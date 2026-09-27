# CourtPulse Engineering Reasoning Framework

**Status:** PROPOSED  
**Authority:** Methodology proposal pending independent review and explicit acceptance  
**Proposal baseline:** `e92dc3dcbf15c2ff4ce6681fa87e18022766d4c2`

## Purpose

CourtPulse has accumulated mature application behavior, source-specific contracts, derived analytics, hosted-web behavior, and external deployment state. Material changes increasingly depend on knowing not only how the code works, but what the evidence actually proves and what the project has authorized.

This framework proposes a lightweight discipline for that work. It is adapted to CourtPulse's present assembly pressure; it is not a mechanical copy of another project's document structure.

## 1. Two lanes

### Evidence / epistemic lane

```text
facts + observations
        ↓
interpretation
        ↓
epistemic warrant
        ↓
what can responsibly be concluded?
```

Typical inputs include:

- repository source at a pinned commit;
- deployment/control-plane observations with timestamps;
- runtime traces, HARs, logs, screenshots, and direct probes;
- upstream payloads and fixtures;
- executable tests;
- documented external provider contracts.

### Normative / authority lane

```text
architecture contract
        ↓
roadmap / non-goals
        ↓
responsibility or decision contract
        ↓
exact admission
        ↓
implementation plan
```

The lanes meet only when implementation has both:

1. epistemically established prerequisites; and
2. normatively authorized behavior.

Implementation and validation then generate new evidence that feeds back into the evidence lane.

## 2. Evidence vocabulary

Material findings should use one of these labels when ambiguity would otherwise matter:

- **ESTABLISHED** — directly supported by repository, deployment, runtime, or other sufficiently direct evidence.
- **OBSERVED** — actually seen in a specific environment or point-in-time state.
- **INFERRED** — a reasonable conclusion from evidence, but not directly established.
- **UNKNOWN** — evidence is insufficient.
- **CONFLICT / TENSION** — supported observations do not currently reconcile.
- **EXTERNAL ASSERTION** — known from manual/deployment/operator knowledge but not independently recoverable from the artifact currently under review.

Do not promote `INFERRED`, `UNKNOWN`, or `EXTERNAL ASSERTION` to `ESTABLISHED` merely because the claim is convenient.

## 3. Pin evidence to the authority that can actually support it

Repository claims should identify a commit or other durable repository identity when the exact baseline matters.

External control-plane state should record an observation time. Branch protection, Supabase deployment status, environment variables, third-party provider state, and similar facts are not properties of a Git commit.

A document may therefore contain both:

```text
Repository baseline:
<commit SHA>

Control-plane observation:
<date/time or date>
```

without pretending that checking out the commit recreates the external state.

## 4. Minimum sufficient contract

Before adding a new abstraction or rule, ask:

- What exact failure or ambiguity requires it?
- What is the smallest contract that prevents that failure?
- What does the contract deliberately leave open?
- Is the proposed rule about current-state knowledge or permanent architecture?
- Does the evidence actually support the strength of the rule?

Avoid governance artifacts that have not earned retrieval or decision value.

## 5. Separate representation, source authority, and semantic authority

Material work that uses `canonical`, `source`, `fallback`, `validated`, `trusted`, or similar terms should resolve the intended meaning locally.

In particular:

- a canonical representation can be synthesized from multiple admitted sources;
- a source can be authoritative for one field but not another;
- a semantic contract can constrain interpretation beyond raw source shape;
- a fallback can restore transport without restoring all semantics.

Terminology precision does not require retroactive identifier churn.

## 6. Assembly-first reasoning

For derived analytics, map prerequisites explicitly before changing the final metric.

Example:

```text
event identity
      +
event ordering
      +
lineup identity
      ↓
trusted lineup intervals
      +
possession boundaries
      ↓
player / lineup possession context
      ↓
derived ratings and on/off claims
```

A downstream formula is not an adequate repair for an unresolved upstream semantic dependency.

When multiple independent reconstruction paths exist, identify them rather than assuming one trust check governs all consumers.

## 7. Counterexample discipline

Before accepting a rule or implementation, actively search for evidence that would break it.

Useful questions include:

- Can a successful transport return semantically incomplete data?
- Can a fallback preserve shape but change meaning?
- Can an invalid intermediate state be normalized away before validation?
- Can a passing test prove less than its name implies?
- Can the same label mean two different authority states?
- Can a local fix leave a parallel reconstruction path untouched?

Counterexamples should narrow contracts, not automatically expand scope.

## 8. Test roles

Possible test roles include:

- **probe** — asks an evidence question about an external or uncertain behavior;
- **characterization** — records current behavior without asserting that it should remain;
- **contract / conformance** — checks an explicitly stated schema or semantic contract;
- **acceptance** — demonstrates an accepted product or architecture requirement;
- **regression** — preserves behavior that has already been accepted and whose recurrence would violate that acceptance.

A test's role is not inferred from age, filename, or whether it passes.

One test can provide useful evidence before it becomes regression protection.

## 9. Production/repository recoverability

For CourtPulse-owned production behavior, distinguish:

- source availability;
- exact deployed-source equality;
- database/schema representation;
- documented environment surface;
- actual secret values;
- control-plane configuration;
- deployment history;
- third-party provider state.

Do not use `reconstructible` or `reproducible` as shorthand for all of these unless the evidence actually supports all of them.

## 10. Proposed workflow for material work

For a material phase:

1. **Archaeology / evidence recovery** — pin the baseline and establish current reality.
2. **Independent evidence review** — challenge overclaims, missing counterexamples, and unresolved tensions.
3. **Normative proposal** — draft only the minimum rules or admissions the evidence has earned.
4. **Independent normative review** — test scope, authority, and reversibility.
5. **Explicit acceptance** — grant authority to the accepted proposal.
6. **Implementation** — change production behavior only within the admitted scope.
7. **Validation** — prove the actual acceptance criteria, not a proxy.
8. **Knowledge update** — preserve new evidence and unresolved tensions.

For small reversible work, these steps can be proportionate rather than ceremonial. The framework exists to prevent hidden authority changes, not to maximize paperwork.

## 11. Thread / reviewer separation

When CourtPulse uses an operator/repository thread and an independent reviewer:

- the operator may inspect, branch, implement admitted work, run tests, and present evidence;
- the operator's reasoning is not self-approval;
- the reviewer challenges evidence proportionality, hidden authority changes, counterexamples, assembly debt, test roles, and scope;
- explicit project acceptance remains separate from both analyses.

## 12. Irreversibility budget

Prefer reversible choices while evidence is incomplete.

A new invariant, persistence contract, source-authority claim, public semantic guarantee, destructive migration, or external dependency commitment should require stronger evidence than a local refactor or disposable diagnostic.

The more difficult a decision is to reverse, the more explicit its evidence and admission should be.
