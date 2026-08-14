# ADR 1102 — Publishing is a pull request the machine may never merge, and the article it upholds is E2, not A6

**Status:** accepted
**Date:** 2026-08-12
**Product:** `growth`
**Reversibility:** one-way
**Revisit trigger:** never for the rule itself — E2 is Tier E, unamendable. The *enforcement
mechanism* is revisited if the refusal is ever shown to be bypassable by a mutant that reaches a
merge or a default-branch push by any path the guard does not parse.

## Context

GRO-B says the machine writes branches and drafts and a human merges every publish, and the
design source cites this four times as **"A6 (human merge)"**.

**A6 is not that article.** Read against `CONSTITUTION.md` as adopted (v1.0, 2026-08-06, receipt
`01KZ9V0QXNNMB3ZH18MSH8DKH3`):

| Cited as | `CONSTITUTION.md` actually says | |
|---|---|---|
| A6 "human merge" | **A6 · Measured or it didn't improve** (`:53`) | wrong article |
| A9 "live slot" | **A9 · Appetite over estimate** (`:65`) | wrong article; no live-slot article exists |
| A8 "earn before build" | **A8 · Earn before build** (`:61`) | correct |
| E3 "no fake claims" | **E3 · The Truth Law** (`:26`) | correct |

The article that actually governs publishing is **E2 · Human Sovereignty** (`:21`), which names
*"publishing under Ashiq's name"* in its own list of irreversible acts that belong to the human
alone — and E2 is **Tier E, unamendable**, where A6 is Tier A and amendable with friction. The
design source cited a weaker, amendable article for its single most important rule.

This matters mechanically, not just pedantically: `hq.policy.yaml:33–38` quotes E2's list
verbatim as `ungrantable_actions`, and `policy-lint` verifies that quote against the pinned
constitution sha **before** parsing it. So "publishing" is already un-grantable at the policy
layer, by name. And `CONSTITUTION.md:95` makes kickoff-lint check that a PLAN's non-negotiables
cite the articles they uphold — a PLAN citing A6 here would be citing a real article that says
something else.

## Options considered

1. **Cite E2, and enforce PR-only inside the publish command with a mutant negative control.**
2. Cite E2 and enforce by convention plus review. Con: `retro-log` 2026-08-04 — a propose-only
   guard that was a grep let a mutant overwrite the canonical file, delete the champion, commit
   and spawn a deploy, and passed clean.
3. Keep the A6 citation for continuity with the design source. Con: it is simply false, and E3
   forbids dressing a claim as something it is not.

## Decision

**Option 1.** Everywhere growth asserts human-merge it cites **E2 (Tier E, unamendable)**;
A6 is cited only where growth actually measures an improvement. The deviation is flagged back to
`docs/strategy/plans/PLAN-growth.md` rather than absorbed silently.

Enforcement lives **in the publish command itself**, not in review:

- `arc growth publish <slug>` creates a branch and a PR. It has no merge path and no
  default-branch push path.
- The guard is a **parse of the command's own module graph, never a grep** — the ADR-0910/bench
  standard — because a grep misses `from "fs"`, `fs/promises`, `child_process`, and async
  exec/spawn.
- A **running mutant negative control** ships with it: a variant of the publish module that
  attempts a merge, a `git push origin main`, and a direct write to the deploy hook. The suite
  must REJECT all three, **and each rejection must be attributable to the guard under test** — a
  mutant that crashes on an unrelated fault before reaching its target behaviour is not a passing
  negative control.

**Evidence:** `CONSTITUTION.md:21–29, 53, 61, 65` · `hq.policy.yaml:33–38` (E2 quoted verbatim as
`ungrantable_actions`, sha-verified before parse) · `CONSTITUTION.md:95` (kickoff-lint article
citation rule) · `retro-log.md` 2026-08-04 (grep-shaped guard walked past by a mutant) ·
`PORTFOLIO.md:19` (bench's mutant-attribution standard, adopted this morning).
**Confidence:** high — the misattribution is checkable by reading four numbered lines.
**Rejected because:** option 2 is the exact failure the retro-log records; option 3 asks E3 to
tolerate a false citation.

## Consequences

Easier: the rule is anchored to an article that cannot be amended, and the policy engine already
refuses to grant it. Harder: three other plans in `docs/strategy/plans/` carry the same A6/A9
misattribution — this ADR fixes growth's copy only, and the flag-back is the mechanism for the
rest.
