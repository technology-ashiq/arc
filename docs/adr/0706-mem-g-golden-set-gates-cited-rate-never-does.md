# ADR 0706 — MEM-G: the golden query set is the quality gate; the surfaced→cited rate is observational forever

**Status:** accepted
**Date:** 2026-08-11
**Product:** `memory`
**Reversibility:** one-way
**Revisit trigger:** promoting the surfaced→cited rate to a gate requires **overturning this
ADR by name**, with an argument that addresses the Goodhart mechanism below. Retiring the golden
set requires the same. The embeddings trigger has its own numeric condition, stated below.

## Context

Two recorded failures shape this decision, and they pull in opposite directions.

**Without a number, a trigger cannot fire.** 2026-08-03, `arc-model-policy`: a cycle that had
closed five days earlier was still reported LIVE by the company log, so a trigger reading that
log reported itself unfired when it had already fired. The recorded prevention: *when a decision
trigger cites a document as its condition, that document is now a control.* A vaguely-worded
condition like "precision is demonstrably insufficient" is unfireable by construction.

**With the wrong number, the gate trains the wrong behaviour.** `kickoff-lint` already runs a
`pre-mortem-cite` gate that pressures every plan to cite plan tokens. If a cited-rate metric ever
became a gate, that existing pressure would produce ritual citation of whatever recall surfaced,
and the metric would report success precisely as the module stopped being useful. That is
Goodhart's law with a mechanism already in the repo, not a hypothetical.

There is a third recorded lesson that sets the bar for the gate itself. 2026-07-30,
`arc-design-cycle3`: `PASS` was defined as an absence — zero violations — so *compliant
characterless work passed five consecutive runs* and no part of the loop could report that the
output was simply not good enough. A pass condition that is only an absence cannot detect
mediocrity.

## Options considered

1. **Gate on the surfaced→cited rate** — rejected: Goodhart, via a pressure that already exists.
2. **Gate on the golden query set; keep cited-rate observational** — chosen.
3. **No instrument at all, judge by feel** — rejected: this is the module whose entire premise is
   that "nobody could find it" is a measurable condition. It has to measure itself.

## Decision

**The golden query set is the quality contract.** 12 seed queries, each with expected document
ids, asserted **top-3 hit** in CI. Red is a **build failure**, not a dashboard reading. This is a
positive condition — it fails for insufficiency, not merely for rule-breaking, which is what
ADR-0049's lesson requires of a quality gate.

**Phase 0 measures the same 12 queries by grep first** — time and hit-rate, recorded in evidence.
The module must **beat that baseline** by close. This makes the module's own premise falsifiable:
if grep already finds these, the module was not needed, and that is the honest outcome kept
reachable.

**The surfaced→cited log is observational forever**, and is **disqualified from ever gating or
promoting anything**. It lives at `.claude/state/memory/surfaced-cited.jsonl` — instance state,
gitignored, alongside the index, consistent with emitting nothing to the spine (ADR-0703). It
answers "does anyone use what the hook surfaces" as a **trend only**. If after roughly three
hooked kickoffs the trend is ~zero, that is a **retro input questioning the module's premise** —
not a number to improve.

**The embeddings trigger is a number**, settled here from MEM-L: embeddings become discussable
only when golden-set **top-3 precision < 10/12**, **after ≥ 3 alias-iteration fixes**
(ADR-0709), on a corpus **≥ 2× the 2026-08-11 measurement**. All three conditions, together.
Below that bar, a miss is fixed with an alias, which is deterministic and auditable.

**Confidence:** high.

## Consequences

- **Easier:** "is recall good?" has an answer that can come back *no*, in CI, without anyone's
  judgement being involved.
- **Harder:** every golden-set miss must be fixed by an alias or tag edit recorded beside the
  miss it fixes — the fix is never "reword the query until it passes", which would make the set
  measure itself.
- This ADR is one-way because its whole value is that a future cycle cannot quietly promote the
  convenient metric. Overturning it must be deliberate and by name.
