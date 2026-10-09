# Web 0.3B — Recovery A: Game Detail Summary Evidence Resolution — Admission

**Status:** ADMITTED  
**Admission date:** 2026-10-09  
**Admitted proposal:** `71fb36c57658714bddf59a011a4f93d513fce428`  
**Proposal date:** 2026-10-09  
**Repository baseline:** `45ce4b27282443fdfccb2e51b980e3a92f4dc623`  
**Authority:** project-owner admission; implementation not yet IMPLEMENTED, validation not yet VALIDATED, release not yet RELEASE-ACCEPTED

## Admitted decision and minimum sufficient contract

This admission authorizes a **client-only, Game Detail > Summary-specific** recovery of already-acquired team statistics during partial Stats hydration. Compatible field evidence must be preserved and resolved before missing values are converted to zero, and only evidence-backed numbers may be presented. Scope is **the Summary Team Comparison and single-team Team Stats views**. The existing shared `homeTeamStats` / `awayTeamStats` numeric contracts and their Matchup/analytics consumers are not redefined.

The independently reviewed behavior in RA-01 through RA-06 is **ADMITTED** for implementation only within the boundaries below. This admission does not itself mean implementation has occurred, validation has passed, or release acceptance has been granted.

## Observed problem and evidentiary limits

On 2026-10-08, the live SAC @ LAL game `0012600036` displayed score SAC 70 / LAL 80, while Summary showed POINTS 0/0, conventional percentages and totals 0, and PTS OFF TOV 8/16. Independent live read-only hydration inspection found game/headline evidence for the same third-quarter state: LAL 80/SAC 70, rebounds 28/33, assists 21/15, FG fractions .473/.394, 3PT fractions .292/.167, and several other populated totals. Traditional V3 had empty/null statistical fields, zero player rows and placeholder team IDs, while PBP had zero actions. The matching points-off-turnovers evidence demonstrates that selected headline/misc fields already survived normalization.

BOS @ CLE `0012600011` subsequently appeared fully populated when final; independently observed later hydration contained player rows and PBP. This does **not** establish an NBA publication guarantee or that CDN access recovered.

**Provenance:** the live SAC–LAL values in this proposal are *selected observations reported from read-only responses and screenshots*, not an archived byte-exact upstream payload. Any fixture reconstructed from them must say `reconstructed characterization`, identify its selected fields, and must not purport to be a complete upstream capture. The final BOS–CLE comparison is a later observation, not evidence that its live and final states were retrieved from a single immutable response. Tests must be deterministic and local, not rely on re-querying changing NBA endpoints.

At baseline, `expo/services/nbaDataProxy.ts`:
- `extractTeamStats()` invokes `pickNumber()` and `pickPercentage()`, which default missing Traditional fields to numeric zero.
- `extractStatsTeamStats()` combines that lossy Traditional object with **selected** Summary/postgame/headline and misc fields. It does not resolve the ordinary headline team-stat fields per field.
- `normalizeStatsHydrationBoxscore()` creates shared `GameDetailData.homeTeamStats/awayTeamStats` after the loss of missingness.
- `findTeamStats()` may fall back from a nonmatching team ID to home/away designation.
- The Summary UI defaults many absent numbers to zero in *both* viewing modes. Its `StatBar` already supports nullable displayed values, but comparison geometry can still imply zero when one side is unavailable.
- Shared normalized team stats also feed `MatchupRealDataTab` and related drivers; they cannot be globally made nullable under Recovery A.

**Authority limit:** HTTP success, `sourceStatus:"ok"`, `hasTeamBoxScore:true`, or a team-shell record is not proof that a particular statistic is available. Recovery A does not redefine any of those backend statuses.

## Admitted behavior

### RA-01 — Preserve evidence before lossy numeric normalization

Recover Summary-only values from source-specific evidence **before** default-zero normalization, or preserve enough uncollapsed source-specific evidence alongside existing records to resolve accurately afterward. A resolver operating only on existing `Record<string, number>` shared team stats is insufficient. Reusing the existing hydration acquisition is preferred; Recovery A does not authorize an additional network request solely to reacquire information already in that response.

The result for each supported field must distinguish **explicit numeric zero**, **compatible numeric value**, and **unavailable**, with its source identity. It need not prescribe a specific TypeScript shape. Optional Summary-only records on `GameDetailData` are a permissible mechanism, not a prescribed architecture.

### RA-02 — Game, team, and source compatibility

Every adopted field must belong to the requested game and correct team. When a record supplies an explicit non-placeholder team ID, it **must match** the canonical corresponding game-team ID; a contradictory ID is rejected even if `homeAway` matches. Missing/zero/null placeholder IDs convey no affirmative team identity: accepting them by side requires a narrowly justified association established within the same game/hydration assembly, not an unconditional side fallback. An unresolvable association means unavailable for that record.

Stats hydration source evidence must be associated with the same requested game and hydration acquisition assembly as the displayed Summary. A single aggregation does **not** prove that its upstream endpoints reflect exactly the same instant. Do not claim synchronized snapshots merely because their fields were returned together; conflicting publication states must not be silently declared equivalent.

### RA-03 — Deterministic per-field authority and precedence

For each supported field, select the **first present, semantically compatible and identity-matched** source under its admitted field rule. A valid explicitly reported preferred value, including `0`, is retained even when a fallback disagrees; an absent/null/unparseable preferred value grants no authority to overwrite fallback evidence with zero. Fallbacks must never manufacture counts or unsupported rebound splits. Unavailable remains unavailable.

Generic ordering alone is insufficient: **field-specific semantic mapping and units** govern selection. Existing misc mappings may remain where their semantics are independently compatible; do not give `misc` blanket authority over standard Traditional fields.

### RA-04 — Supported Summary fields

| Field | Proposed candidate authority, subject to RA-02/03 | Unavailable condition / caution |
| --- | --- | --- |
| Points | Valid score from the **same game-detail hydration assembly**, with team identity and availability established; alternatively explicit compatible Traditional/Summary team points | Do not borrow a separately fetched scoreboard value without admitted identity/temporal provenance; no fabricated 0 |
| FG%, 3PT%, FT% | Explicit compatible Traditional field, then Summary postgame/headline equivalent | Source-defined fractional values (e.g. `.478`) become 47.8 percentage points; source-defined percentage-point values stay unchanged |
| Total rebounds | Explicit compatible Traditional total, then Summary total | Do not derive from absent OREB/DREB or assume zero splits |
| Offensive / defensive rebounds | Explicit compatible Traditional field only in this admission | Otherwise unavailable, even if headline total is present |
| Assists, steals, blocks | Explicit compatible Traditional field, then Summary equivalent | Missing/null means unavailable, not 0 |
| Paint points, second-chance points, fast-break points, points off turnovers, bench points | Existing compatible Summary/postgame/headline/Misc field-specific evidence | Preserve already-supported mapping where compatible; no implicit zero |
| Turnovers (team total) | **Conservative candidate: only an explicit `turnoversTotal` field with established total-team semantics, from identity-matched Traditional or Summary evidence** | See unresolved semantic evidence below; do not silently equate bare `turnovers` with `turnoversTotal` |

**Turnovers semantic disposition for review:** Live SAC–LAL evidence reported Kings `turnovers:18`, `turnoversTeam:1`, `turnoversTotal:19`. This demonstrates the three keys can disagree; a bare `turnovers` is not proven equal to total team turnovers. Inspection of the current deployed Traditional normalizer confirms it preserves raw normalized team stats rather than proving equivalence of the keys. **The key name `turnoversTotal` alone does not establish total-team-turnover authority:** its total-team semantics must be established for the particular source representation before that field may supply the Summary row. An identity-compatible, explicitly reported `turnoversTotal` with verified source-specific total-team semantics may be used, including an explicit zero; if that semantic evidence is absent or the value is missing/null, display unavailable for that source. The proposal **does not admit** bare `turnovers` as an interchangeable fallback, and no derivation `turnovers + turnoversTeam` is admitted. Insufficient evidence for this one field must not block independently supported Summary recovery.

**Percentage rule:** conversion is determined by the identified source field's documented/observed scale, **not** by the numeric magnitude alone. Genuine `0` remains `0`; `1` in a defined fractional field means 100%; `1` in a defined percentage-point field means 1%. Nonfinite or incompatible input is unavailable. Do not reuse a value-dependent heuristic as the admission's semantic scale contract.

### RA-05 — Both Summary presentation modes must tell the same truth

The two-team comparison and individual-team Team Stats views must render resolved, field-specific values and unavailable marks (such as `—`), not replace missing with zero. When one side of a two-team comparison is unavailable, comparison bar geometry must not visually depict the missing side as zero or imply a meaningful ratio from the other side; use a neutral/suppressed alternative. True zero from a compatible source remains a displayed zero.

Do not infer data availability from `Object.keys(homeTeamStats).length` or the presence of a team shell when that would permit fabricated fields. Point display must not contradict a validated same-assembly game score just because Traditional normalization supplied a manufactured zero. Do not imply both sides' fields are temporally synchronized beyond observed provenance.

### RA-06 — Shared contract isolation and bounded implementation

Recovery A may introduce a Summary-specific evidence extractor/resolver, minimal data plumbing, and Summary-only presentation adjustments with focused tests. It must **not** change the semantics, types, or values of shared `GameDetailData.homeTeamStats/awayTeamStats` delivered to Matchup/analytics, nor affect lineup metrics or other derived consumers. No generic `extractTeamStats()` contract change is authorized unless it is proven entirely internal to and isolated from the shared output; preserving existing shared behavior is the acceptance criterion.

Any need for Edge Function changes, new source acquisition, global data contract changes, or a broader freshness policy exceeds this proposed admission and must return for separate authorization.

## Deterministic validation contract

The future implementation must produce executable fixtures and evidence for:

1. Reconstructed **live partial-hydration** SAC–LAL shape: score/headline values present, Traditional absent/null or team placeholders, no player/PBP availability; supported Summary fields recover without invented OREB/DREB or zeros.
2. **Completed populated Traditional** fixture (e.g., BOS–CLE): preferred explicit Traditional fields remain authoritative and current full-data Summary presentation is not regressed.
3. Explicit zero from preferred source against conflicting fallback: zero wins.
4. Present nonzero preferred field against conflicting fallback: preferred wins.
5. Both sources absent/null/incompatible: display unavailable, not zero.
6. Correct team-ID match; contradictory non-placeholder ID even with matching side is rejected; placeholder/missing identity accepted only under proven same-game side association, otherwise rejected.
7. Both fractional and percentage-point source scales, including exact zero and one, preserve intended displayed units.
8. Total rebounds present while OREB/DREB absent: total renders, splits remain unavailable.
9. Team-turnover variants (bare `turnovers`, `turnoversTeam`, `turnoversTotal`) demonstrate no silent semantic substitution or arithmetic invention.
10. One team's field missing: visible value and comparison geometry do not imply the missing opponent's value is zero.
11. Single-team Team Stats selection uses the same resolver behavior as Both-team mode.
12. Score identity/consistency; differing score and headline evidence within one assembly does not silently imply one synchronized instant.
13. Shared Matchup and analytics inputs/output remain unchanged, including where the Summary-only resolver has more complete field evidence.
14. No new request, generic proxy change, backend change, or source-selection change.

Use deterministic sanitized local fixtures. Label captured upstream bytes **only if actually archived**; otherwise use `reconstructed characterization` and cite observation scope. Do not make time-sensitive network fixtures the sole regression authority.

## Non-goals and deferred work

Recovery A does not admit: changes to deployed `nba-data-proxy` or `nba-stats-proxy`; CDN reachability, new endpoints or PBP sources; global `sourceStatus`, `coreSources`, capability or freshness semantics (Recovery B); live PBP/shot/lineup recovery (Recovery C); Matchup 2.0 data or calculations; derived analytics trust (Candidate B); authentication, security, deployment, or CI; source-synchronization machinery; a global numeric-nullability conversion; new data-provider semantics; or automatic reinterpretation of historical source statistics.

Recovery B (capability truthfulness) and Recovery C (live PBP acquisition) remain independent. A validated Recovery A improvement must not wait for their resolution. A future backend change must separately satisfy accepted AC-10 release recoverability requirements.

## Admission boundary and retained review questions

The exact reviewed proposal retained the following implementation-evidence questions; they do not expand this admission:

1. Is the Summary-specific, pre-loss evidence resolver the minimum sufficient implementation boundary while preserving shared numeric team records?
2. Are the proposed identity/placeholder association rules and per-source percentage scales sufficiently constrained for implementation?
3. **Turnovers:** Is explicit `turnoversTotal` sufficient to admit a total-team-turnover row, or must turnover recovery remain deferred pending source-specific semantic evidence? Do **not** infer equivalence from similar field names.
4. Are score provenance and non-synchronized hydration semantics appropriately narrow?
5. Are both Summary viewing modes and incomplete comparison geometry covered without a broader UI redesign?
6. Is fixture provenance represented truthfully?

**Recovery A production behavior is ADMITTED under RA-01 through RA-06 only. Recovery A implementation is NOT YET IMPLEMENTED, validation is NOT YET VALIDATED, and release is NOT YET RELEASE-ACCEPTED.**
