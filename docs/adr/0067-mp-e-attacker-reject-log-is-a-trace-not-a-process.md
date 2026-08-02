# ADR 0067 — MP-E: the attacker reject-log is a trace, not a process — one line, fixed taxonomy, no rebuttal

**Status:** accepted
**Date:** 2026-08-02
**Product:** `company` — arc-wide (ADR-0053); produced by the `model-policy` lane
**Reversibility:** two-way
**Revisit trigger:** the six-word taxonomy cannot classify ≥2 rejections in a single
kickoff without stretching a word past its meaning — that is the signal the vocabulary is
wrong, not that the rejecter is careless.

## Context

`/arc-kickoff` step 5 currently reads: "accept → apply its exact mutation · reject → drop
silently, no log" (verified at `.claude/commands/arc-kickoff.md:79`, 2026-08-02). The
attack panel is the plan's main adversarial gate, and every finding it raises that the
session declines vanishes without a trace. Nothing records what was attacked, what was
waved off, or why — so a rejection that was wrong is unrecoverable, and a pattern of
rejections ("we keep dismissing scope findings") is invisible to retro.

The reason it was built that way is sound and still applies: a reject-log that invites
argument turns a bounded attack panel into a debate, and the panel's value comes from being
cheap. Any fix has to add memory without adding process.

## Options considered

1. **Keep dropping silently** — pros: zero cost. Cons: the one gate designed to catch a bad
   plan keeps no record of what it caught and lost; retro cannot see patterns.
2. **Full rebuttal log** — the session writes a reasoned reply per rejection. Pros: richest
   record. Cons: turns a cheap panel into a negotiation, and the attacker is not present to
   read the reply — it is writing for nobody.
3. **One line per rejection, reason drawn from a fixed closed vocabulary** — pros: leaves a
   greppable trace at near-zero cost; a closed vocabulary makes the record countable across
   kickoffs. Cons: a fixed vocabulary occasionally fits badly, and a wrong-but-available
   word is easier to reach for than an honest "this doesn't fit".

## Decision

Option 3. Exactly one line per rejected attacker finding:

```
REJECTED: <finding> — <reason>
```

`<reason>` comes from the fixed six-word taxonomy and nothing else:
`duplicate` · `out-of-appetite` · `unsupported` · `violates-no-go` · `already-covered` ·
`non-actionable`.

No rebuttal, no debate, no reply to the attacker. It is a **trace, not a process**. Any
lint that later learns to look for the line starts WARN-first, per the trial-ledger
discipline.

## Consequences

Easier: retro gains a countable record of what the attack panel produced and what the
session declined, which is the input a "we keep dismissing X" pattern needs to become
visible at all. Harder: the taxonomy is now a thing to maintain, and a closed vocabulary
invites the failure where a rejection gets filed under the nearest available word rather
than the true one — which would make the log worse than nothing, because it would look like
data. The revisit trigger above is deliberately about that failure and not about volume.
Recording a rejection never obliges anyone to defend it.
