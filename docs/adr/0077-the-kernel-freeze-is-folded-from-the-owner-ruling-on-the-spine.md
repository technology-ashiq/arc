# ADR 0077 — The kernel freeze is folded from the owner ruling on the spine, never hardcoded

**Status:** accepted
**Date:** 2026-10-14
**Product:** `portfolio`
**Reversibility:** two-way
**Revisit trigger:** a second freeze-shaped ruling is written whose `what` the grammar below cannot read, or the owner records exemptions as a structured payload field

## Context
On 2026-10-14 the owner ruled (receipt `01M4VP8AMYJPMT1MZNQRB0FYY6`, `approval.requested`, `gate:
owner-ruling`, approved by `decision.recorded` `01M4VPVKGNX9DMNWFEEZ57ZGJX`): *"kernel freeze: no
/arc-kickoff on a kernel lane until revenue.received >= 1 on the canonical spine; launch, leads, growth,
portfolio, engine (metered runs only) and distribute Cycle 3 are exempt; ventures are out of scope."*
Nothing enforces it. The exemptions live only in that prose `what`; the receipt is append-only and
cannot gain a structured field. "Kernel lane" is defined nowhere in code, PORTFOLIO.md or `lanes.md`.

## Options considered
1. **Fold the ruling from the spine and read its `what` with a strict, closed grammar; fail closed when it does not parse** — the ruling stays the single source; a typo'd ruling refuses rather than exempts.
2. **Hardcode the exempt list in kickoff-lint** — rejected by the cycle's own lock ("never hardcoded"): the next ruling would need a code change.
3. **Ask the owner to re-emit the ruling with a structured `exempt: []` field** — cleaner data, but an owner keystroke before any value, and the existing ruling would still need reading.

## Decision
Option 1, in `kickoff-lint.mjs`, applied only to a new-cycle plan (ADR-0076):
- **The ruling:** every `approval.requested` with `payload.gate == "owner-ruling"` whose `what` starts `kernel freeze:`, read through the sanctioned reader `.claude/scripts/hq/spine.mjs` from the canonical spine (`dirname(git common dir)/.claude/state/hq`, so a linked worktree reads the main clone's spine).
- **It stands** unless (a) a `decision.recorded` with `payload.decides == <its id>` has `verdict: reject`, or (b) a later `owner-ruling` request carries `supersedes == <its id>`, or (c) its own lift clause `until <kind> >= <n>` is met — `<n>` or more receipts of `<kind>` on the spine. Pending and approved both stand: only a decision *against* it lifts it.
- **Exemptions** come from the clause `; <list> (is|are) exempt`. `<list>` splits on `,` and a final ` and `; each item is `<lane>`, `<lane> (<note>)` or `<lane> Cycle <N>`. A `Cycle <N>` item exempts only a new cycle whose `cycle:` header names `Cycle <N>`; a `(<note>)` item exempts and prints the note so the condition is read by a human. Any item that is not one of the three shapes, or a `what` with no exempt clause, is **unparseable → FAIL closed** naming the ULID.
- **A kernel lane** is any born lane (`initiatives/<lane>/`) not exempted. Ventures never have lanes (ADR-0059).
- **Refusal:** `FAIL [kernel-freeze] lane <lane> is frozen by owner ruling <ULID> — lifts when <kind> >= <n>, a decision rejects it, or a ruling supersedes it`.
- **No spine** (CI, a consumer repo) → `WARN [kernel-freeze-unread]`, gate skipped. A spine that exists but cannot be read → FAIL. The merge-time twin is therefore *none*, by necessity: the spine is instance state and never reaches CI; recorded in `engine/enforcement.yaml` with that reason (ADR-2002).

## Consequences
Easier: the owner lifts or narrows the freeze with a receipt, not a PR. Harder: a ruling written in new
prose may stop parsing — which refuses, the safe direction, and fires the revisit trigger.
