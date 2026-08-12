# ADR 0905 — quality is assertion pass-rate, and bench builds the substrate for exactly one class

**Status:** accepted
**Date:** 2026-08-12
**Product:** `bench`
**Reversibility:** one-way
**Revisit trigger:** a second class needs arming, or an assertion op proves insufficient to
express a real check — the schema is versioned from birth (`pack.json.revision`) so a change is
a migration, not a rewrite.

> **Amendment 1, same kickoff session, before approval.** The first draft assumed fixtures are
> distinguished by their JSON `input`. Reading the three process files disproved that:
> `commit-msg-draft` declares `inputs: []`. Five fixtures sharing an empty input are five
> samples of ONE case — which is the K dimension, not five cases. The armed class is unchanged;
> the distinctness MECHANISM changed, and the evidence for the class choice is recorded below.

## Context

BEN-G pins v1 quality to **assertion pass-rate, nothing more** — no LLM judges, no human
panels. REQ-01 requires schema pass-rate and assertion pass-rate to stay **separate**.

Verified 2026-08-12: **no fixture contains an assertion.** All three eval fixtures are
`{note, input, expected}`, and the only scoring that exists is `expected` validated against the
process's output schema (`arc-run.mjs:184-186`). The fixture's own note says: *"WRITTEN, NEVER
EXECUTED this cycle. A bench runner is a declared no-go."* There is no eval-pack revision field
and no task-class tag, and `process-lint.mjs:65-67` freezes the process YAML's top-level keys
with no slot that could hold either. Fixture counts are **1 per class against a floor of 5**.

**Which class to arm, on the evidence rather than on convenience:**

| Class | Input | Output schema | Verdict |
|---|---|---|---|
| `kickoff-plan` | `goal` (string) — **the only varyable declared input** | `{what, gate, lane}` — a 3-field approval payload whose `gate` is a **single-value enum**; the PLAN/ADR files it authors are outside any receipt payload by design | **Rejected.** Highest cost per call (`high-judgment`) for almost no discriminating signal. Easy to vary, pointless to score |
| `review-diff` | `base` (branch name) — real input is the ambient diff | `verdict` (3-value enum) + `findings[]` with `severity` (3-value enum), `where`, `what` — **the richest scoreable output**: a planted defect can be asserted found, classified and located | **Rejected for v1, named as the first class to arm next.** `high-judgment` tier against a ₹100 process sub-cap makes 5 fixtures × K=3 × 2 models a real budget risk |
| `commit-msg-draft` | `inputs: []` — real input is ambient git state | `{commits: [{sha, subject}]}` — `subject` is a genuine natural-language artifact with an assertable grammar (conventional-commit prefix, scope, length), `sha` a pattern | **Armed.** `balanced-workhorse` tier, small output, and the thing it produces is exactly what a model can be better or worse at |

## Options considered

1. **Ship machinery only, write no fixtures** — every class reads `NO PROPOSAL` forever and
   REQ-05 cannot close; the "fixture-proven, unexercised" shape evolve and policy both shipped.
2. **Arm all three classes to the floor** — ~12 new fixtures; most of the appetite becomes
   fixture-writing, and the plan assigns eval strengthening to the OWNING process.
3. **Arm exactly one class** — the plan's own kill-criteria escape valve, taken deliberately at
   kickoff instead of discovered at the 2-day tripwire.

## Decision

**Option 3, owner-confirmed 2026-08-12.** `commit-msg-draft` is armed to `MIN_FIXTURES = 5`.
`review-diff` and `kickoff-plan` keep their single fixture and read `NO PROPOSAL — evidence
insufficient (1 of 5 fixtures)` **by design**.

**The substrate, pinned here so Phase 0 does not invent it:**

- **Pack manifest** — `tests/fixtures/engine/evals/<class>/pack.json`:
  `{ "revision": "<semver>", "task_class": "<name>" }`. The revision lives here, **not** in the
  process YAML, because `TOP_LEVEL_KEYS` is frozen and changing it is engine territory. Phase 0
  proves `process-lint` still passes unchanged rather than asserting it does.
- **Fixture** gains one optional key: `assertions` — a list of
  `{ "id": "A-01", "path": "<json path>", "op": "<op>", "value": <literal> }`.
- **Ops are a closed, deterministic set**: `equals` · `matches` (regex) · `contains` ·
  `absent` · `length_between`. No op may call a model, read the clock, or touch the network.
- **Fixture distinctness comes from prepared repo state, not JSON input.** Each fixture pins a
  synthetic git state (files, staged changes) that bench materializes in a temp directory and
  points the driver at by setting `ARC_ROOT` — the driver reads `ARC_ROOT || process.cwd()`
  (`claude-code.mjs:25`) and execs the CLI with `cwd: ROOT` (`:54`). This is why the harness is
  Phase 0 work and not an afterthought.
- A fixture with **no** `assertions` key is scored for schema only and contributes **0** to the
  assertion denominator. It is never counted as a pass. Silence is not credit.

**Both pass-rates are always reported, never merged**, even where the assertion denominator is
zero — in which case assertion pass-rate is **absent**, not 100%.

## Consequences

**Easier:** one class can genuinely discriminate a champion from a candidate, and REQ-05 has a
real class to close against.

**Harder:** the fixture-repo harness is real machinery that the design source never anticipated,
and it is the reason Phase 0 carries 3.0d of an 8d cycle. Two of three classes cannot propose
this cycle, so every report must make "no proposal because the evidence is thin" visibly
different from "no proposal because the candidate lost" (ADR-0906).

**The trap this closes:** `docs/retro-log.md` 2026-07-30 — *"PASS defined as an absence (zero
VIOLATION) meant compliant characterless work passed five runs running."* An assertion-free
fixture that scored as a silent pass would rebuild exactly that: a bench where adding no
assertions is the easiest way to look good.
