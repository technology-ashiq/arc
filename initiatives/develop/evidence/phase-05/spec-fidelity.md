# Spec-fidelity pass — phase 05 · lane develop

Run 2026-08-03 through the **registered `spec-fidelity` agent type** (not a general-purpose
agent carrying the contract inline). That is what pays down the Cycle-5 debt row: the shipped
agent definition had never been loaded by the runtime that loads it.

Its information set was `initiatives/develop/phases/phase-05-spec.md` and
`git diff 0691e97..HEAD`. It recorded refusing to open the slice ledger, PLAN as a source of
intent, or any ADR body — the isolation held.

**Verdict: `FIDELITY: drift found`.**

## What it cleared

Seven of the nine exit criteria, each checked against the diff rather than against a claim:
the five sources, the named retrieval path in both directions, one neighbourhood contract run
against both adapters, the one-hop boundary in all three arms (present via `L-101`, absent at
two hops, present again via `L-102` — the same ADR-0901 in each), churn's top-3 with the
negative that delta must not appear, `sources:` carrying a zero-count source, and the
grep-fallback assertion with no `.codegraph/` present.

It verified `tree-manifest.txt` rather than trusting it — the four recorded sha256 values were
recomputed against the shipped files.

On the non-negotiables it found no violation, and was explicit about the two it could not
settle from a spec and a diff: who typed the code, and whether the adversarial agents were
genuinely fresh. Both are asserted in commit messages, and a commit message is the author's own
claim about the author. Recorded as such rather than cleared.

## What it found — and what was done

**1. "tracker updated" was absent.** True when the pass ran: `PROGRESS.md` still read
`phase: 05 — not started`. Fixed before close — phase table, machine header, burn, done-log
and `## Now` all updated, and REQ-05/REQ-06 flipped to `validated` in PLAN.

**2. `adr:` links were not existence-checked while `rule:` and `fixture:` were.** A real hole,
and the sharpest finding: `adr: 9999` printed as a governing decision with nothing saying it
had never been written. That is the one remaining place where "appears in the pack" and "is a
real thing" could diverge in silence. Fixed and pinned — `adrExists()` plus a test asserting
the unwritten ADR is labelled and the real one is not.

**3. Retrieval is broader than the spec's source table.** Learning rows also match on words in
the slice title; the retro corpus is widened by each matched row's own `area:` and `tag:`.
Deliberate and disclosed in the code, but not what the table says. Recorded in the debt ledger
rather than quietly kept, with a pay-down trigger.

**4. Scope creep into a gate.** `tests/shard-tests.bats` had its balance threshold changed
inside a phase whose spec never mentions sharding. The reasoning is written down and the new
bound is derived rather than picked, but the pass is right that it should have been routed
through `/arc-change`. Recorded in the debt ledger for Ashiq's read at cycle close: ratify, or
revert and re-do it properly.

**5. Churn is narrower than the criterion read literally** — a renamed file's commits split
across two names and may miss the top 3. The pass noted the omission is printed and pinned,
"which is the right way to narrow something". Carried forward in `## Now`.
