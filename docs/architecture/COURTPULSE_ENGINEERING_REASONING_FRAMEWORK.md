# CourtPulse Engineering Reasoning Framework

**Status:** ACCEPTED  
**Acceptance date:** 2026-09-28  
**Accepted proposal:** `70724d8cca219f860ade9d8de9c37eed6626db5e`  
**Authority:** project-owner acceptance  
**Proposal baseline:** `e92dc3dcbf15c2ff4ce6681fa87e18022766d4c2`

## Purpose

CourtPulse has accumulated mature application behavior, source-specific contracts, derived analytics, hosted-web behavior, and external deployment state. Material changes increasingly depend on knowing not only how the code works, but what the evidence actually proves and what the project has authorized.

This framework establishes the accepted lightweight discipline for that work. It is adapted to CourtPulse's present engineering needs; it is not a mechanical copy of another project's document structure.

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

## 3. First-principles lens

For material work, begin from the smallest facts and responsibilities that can be established rather than from the shape of the current implementation.

Useful questions include:

- What is the user-visible or system responsibility we are actually trying to satisfy?
- Which facts are directly established, and which are interpretations?
- Which current implementation choices are essential to that responsibility?
- Which choices are historical accidents, conveniences, or unproven assumptions?
- What must remain true even if the implementation changes?
- What is the smallest contract that would satisfy the responsibility without creating unnecessary future obligations?
- What counterexample would prove the current framing too broad?

First-principles reasoning is not permission to ignore existing contracts. Accepted constraints remain authoritative within their scope unless explicitly reopened.

## 4. Authority Budget

Possessing data does not mean inheriting every possible authority associated with that data.

For a material data or analytics decision, reason through four levels:

```text
SOURCE EVIDENCE
What facts were actually received?
        ↓
EPISTEMIC WARRANT
What may responsibly be concluded from them?
        ↓
COURTPULSE SEMANTIC AUTHORITY
What does an accepted CourtPulse contract permit
this subsystem to normalize / derive / represent?
        ↓
PRESENTATION AUTHORITY
What may the product actually claim?
```

Practical questions:

- What facts do we possess?
- What may we normalize?
- What may we derive?
- What may we **not** claim?
- What provenance, uncertainty, or attribution distinction must survive?
- Which accepted decision grants any new semantic authority?

Example:

```text
official matchup evidence associates Brown → Peavy
+
same-event PBP credits Queen with the steal
        ↓
CourtPulse may preserve both facts
        ↓
CourtPulse may not infer "Peavy forced the turnover"
without separate authority for that causal claim
```

The Authority Budget is a reasoning tool. It does not automatically create a new contract.

## 5. Pin evidence to the authority that can actually support it

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

## 6. Minimum sufficient contract

Before adding a new abstraction or rule, ask:

- What exact failure or ambiguity requires it?
- What is the smallest contract that prevents that failure?
- What does the contract deliberately leave open?
- Is the proposed rule about current-state knowledge or permanent architecture?
- Does the evidence actually support the strength of the rule?

Avoid governance artifacts that have not earned retrieval or decision value.

## 7. Separate representation, source authority, and semantic authority

Material work that uses `canonical`, `source`, `fallback`, `validated`, `trusted`, or similar terms should resolve the intended meaning locally.

In particular:

- a canonical representation can be synthesized from multiple admitted sources;
- a source can be authoritative for one field but not another;
- a semantic contract can constrain interpretation beyond raw source shape;
- a fallback can restore transport without restoring all semantics.

Terminology precision does not require retroactive identifier churn.

## 8. Assembly-first reasoning

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

### Assembly Debt

**Assembly Debt** exists when a higher-level capability depends on a lower-level semantic component that remains unresolved.

```text
Capability B depends on semantic component A
+
A remains unresolved
        ↓
B may be researched
but B must not silently define A
through implementation accident
```

Examples:

```text
trusted on/off
requires
trusted lineup state
+
accepted possession semantics
```

and:

```text
player possession ownership
requires
trusted lineup intervals
+
accepted possession boundaries
```

Research and probes at the higher layer are allowed. Production semantics at the higher layer must not silently settle the unresolved prerequisite.

### Assembly Pressure

**Assembly Pressure** is evidence that a reusable abstraction may be warranted because the same semantic requirement appears independently in multiple assemblies and continues to hold after relevant counterexamples are considered.

Repeated code shape, naming similarity, or two functions that happen to look alike are not enough.

Assembly Pressure should be used to justify a shared abstraction only when the repeated need is semantic, not merely syntactic.

## 9. Counterexample discipline

Before accepting a rule or implementation, actively search for evidence that would break it.

Useful questions include:

- Can a successful transport return semantically incomplete data?
- Can a fallback preserve shape but change meaning?
- Can an invalid intermediate state be normalized away before validation?
- Can a passing test prove less than its name implies?
- Can the same label mean two different authority states?
- Can a local fix leave a parallel reconstruction path untouched?

Counterexamples should narrow contracts, not automatically expand scope.

## 10. Test roles

Possible test roles include:

- **probe** — asks an evidence question about an external or uncertain behavior;
- **characterization** — records current behavior without asserting that it should remain;
- **contract / conformance** — checks an explicitly stated schema or semantic contract;
- **acceptance** — demonstrates an accepted product or architecture requirement;
- **regression** — preserves behavior that has already been accepted and whose recurrence would violate that acceptance.

A test's role is not inferred from age, filename, whether it passes, or whether it currently runs in CI.

A characterization or probe can later become regression protection when the corresponding behavior is explicitly accepted. That transition must be intentional.

## 11. Decision states and durable authority

CourtPulse should use decision-state labels precisely enough that future contributors do not need chat history to infer what a document authorizes.

| State | Meaning |
|---|---|
| **Evidence / investigation** | Descriptive. Establishes, challenges, or preserves facts and interpretations. No normative authority. |
| **PROPOSED** | Candidate normative decision. No authority yet. |
| **ACCEPTED** | Governs scope, semantics, or methodology within its stated boundary. It does not implicitly authorize production implementation. |
| **ADMITTED** | An exact production behavior or change is authorized for implementation within stated scope and non-goals. |
| **IMPLEMENTED** | The identified code/artifact exists. This does not prove acceptance criteria passed. |
| **VALIDATED** | The stated validation or acceptance criteria were satisfied against an identified implementation/evidence set. |
| **RELEASE-ACCEPTED** | A validated implementation is accepted for release/use within the stated boundary. |
| **FROZEN** | The accepted contract or implementation boundary is considered closed unless concrete evidence or explicit reopening authority reopens it. |

An **ACCEPTED** artifact may contain an explicit **ADMISSION** only when that authorization is stated unambiguously. Otherwise production implementation requires a separate admitted artifact or section.

### Durable acceptance mechanism

A decision must not depend on a historical chat message as its only durable authority.

After independent review and explicit project-owner acceptance, the repository should record the transition in a promotion commit that updates the applicable document with at least:

```text
Status: ACCEPTED
Acceptance date: <date>
Accepted proposal: <reviewed proposal commit SHA>
Authority: project-owner acceptance
```

If acceptance also grants a specific production admission, that must be recorded separately and explicitly as `ADMITTED`, with its scope and non-goals.

Implementation, validation, release acceptance, and freezing should likewise identify the artifact or commit they apply to when ambiguity would otherwise be possible.

Repository history is the durable record of the authority transition; chat can carry the human decision, but it must not remain the only place where the decision exists.

## 12. Production/repository recoverability

For CourtPulse-owned production behavior, distinguish:

- source availability;
- exact deployed-source equality;
- database/schema representation;
- application-specific environment documentation;
- platform-provided runtime environment;
- actual secret values;
- control-plane configuration;
- deployment history;
- third-party provider state.

Do not use `reconstructible` or `reproducible` as shorthand for all of these unless the evidence actually supports all of them.

## 13. Workflow for material work

For a material phase:

1. **Archaeology / evidence recovery** — pin the baseline and establish current reality.
2. **Independent evidence review** — challenge overclaims, missing counterexamples, and unresolved tensions.
3. **Normative proposal** — draft only the minimum rules or admissions the evidence has earned.
4. **Independent normative review** — test scope, authority, and reversibility.
5. **Explicit acceptance** — grant normative authority and record it durably in the repository.
6. **Admission** — identify the exact production behavior/change authorized for implementation when production work is required.
7. **Implementation** — change production behavior only within the admitted scope.
8. **Validation** — prove the actual acceptance criteria against the identified implementation, not a proxy.
9. **Release acceptance / knowledge update** — record the release decision where applicable and preserve new evidence and unresolved tensions.

For small reversible work, these steps can be proportionate rather than ceremonial. The framework exists to prevent hidden authority changes, not to maximize paperwork.

## 14. Thread / reviewer separation

When CourtPulse uses an operator/repository thread and an independent reviewer:

- the operator may inspect, branch, implement admitted work, run tests, and present evidence;
- the operator's reasoning is not self-approval;
- the reviewer challenges evidence proportionality, hidden authority changes, counterexamples, Assembly Debt, Assembly Pressure, test roles, and scope;
- explicit project acceptance remains separate from both analyses.

## 15. Irreversibility budget

Prefer reversible choices while evidence is incomplete.

A new invariant, persistence contract, source-authority claim, public semantic guarantee, destructive migration, or external dependency commitment should require stronger evidence than a local refactor or disposable diagnostic.

The more difficult a decision is to reverse, the more explicit its evidence and admission should be.

## 16. Methodology evolution and anti-ceremony

A stronger methodology does not automatically reopen every previously accepted CourtPulse decision.

Existing accepted or frozen contracts remain authoritative within their admitted scope unless:

- new evidence creates a material conflict;
- their scope is intentionally reopened; or
- a later accepted contract explicitly supersedes them.

New material work should follow this accepted methodology unless it is later amended or superseded through the decision process defined here.

Methodology artifacts should be created only when they solve a recurring recovery, reasoning, review, or authority problem. Do not create registries, schemas, templates, or governance layers merely because the framework has a name for a concept.

Architecture terminology does not itself justify code churn. A clearer word can improve future contracts without forcing historical identifiers to be renamed.
