# ADR 0073 — Constitution adoption is a hashed receipt, not a status field

**Status:** proposed
**Date:** 2026-08-05
**Product:** `company` — the Constitution and the spine vocabulary are both company organs (ADR-0053)
**Reversibility:** one-way
**Revisit trigger:** a Tier-A amendment needs to record more than *which text became law* (per-article
status, partial adoption), or the Constitution is split across several files so that one path plus one
hash no longer identifies the adopted law.

## Context

The Constitution (`docs/strategy/arc-CONSTITUTION-draft.md`) has outranked every ADR, PLAN and line of
code since it was written, and is still DRAFT. Its own adoption clause names the mechanism it needs:
*"becomes law on Ashiq's explicit sign-off, recorded as the spine's first `constitution.adopted`
event."* That kind does not exist.

Verified 2026-08-05 against live exports rather than docs:

- `KINDS.length = 39` (`.claude/scripts/hq/lib/validate.mjs`) and contains no `constitution.*`.
  Emitting it today fails `UNKNOWN_KIND` and quarantines — so the adoption clause is currently
  un-executable.
- **Zero** occurrences of "constitution" across the whole canonical spine — 11 event files plus
  `_quarantine/` and `derived/idem.index`.
- `docs/HISTORY.md:32` — adoption ⏳ pending.

So "the Constitution is law" is today an assertion with no receipt, which A1 and E1 both forbid.

This has stopped being tidiness. The policy cycle (`docs/strategy/plans/PLAN-policy.md`, POL-B and
REQ-01) requires Constitution E2's five un-grantable items **quoted verbatim from the adopted
constitution**, with `policy-lint` FAILing from birth. A validator that quotes a document must be able
to prove *which bytes* it quoted — otherwise the strictest gate in the company is anchored to a file
that can be edited afterward with nothing noticing. Pre-mortem row 3 of that plan names this exact
failure: the file drifts into a poster.

ADR-0026 froze the event vocabulary as a closed set, extended only by ADR (+3 ADR-0106, +1 ADR-0107,
+8 ADR-0309, +1 ADR-0310, +8 ADR-0400). This is the next such extension, and the smallest one yet.

## Options considered

1. **No new kind — adopt via `approval.requested` → `decision.recorded`** — pros: zero vocabulary
   change, and that pair already *is* a human sign-off. cons: `decision.recorded`'s payload is closed to
   `decides|verdict|reason` and its idem is welded to `sha256("decision.recorded|"+decides)`, so it has
   nowhere to carry a document, a version, or a hash; adoption would survive only as prose in `reason`,
   making every consumer that asks *which text is law* a string-scraper — the failure ADR-0400 rejected.
2. **`note.logged` with a convention tag** — pros: nothing to build at all. cons: no shape whatsoever;
   the company's highest-precedence fact recorded as untyped prose.
3. **A first-class `constitution.adopted` with a closed, hashed payload** — pros: which-text-is-law
   becomes machine-checkable, so `policy-lint` can verify its verbatim E2 quote against the receipt.
   cons: +1 to a deliberately closed set, and the adopted file can never be edited casually again.

## Decision

**Option 3.** `KINDS` goes 39 → 40 with exactly one kind: `constitution.adopted`.

Payload is a first-party closed shape (the `assertDecision` pattern — unknown keys are hard errors),
three keys:

| Key | Meaning |
|---|---|
| `document` | repo-relative path of the adopted text |
| `version` | the adopted version string, e.g. `"1.0"` |
| `sha256` | lowercase hex sha256 of the adopted bytes |

**The hash is the whole point.** Without it the event says *a* document was adopted and cannot say
which bytes, and REQ-01's "verbatim from the adopted constitution" degrades from a check into a claim.
With it, adoption is evidence (A1) and the policy engine's E2 quote is falsifiable against the spine.

**Idempotency is total-preimage**, following ADR-0400 and the welded idem of `assertDecision`:

```
idem = sha256("constitution.adopted|" + <the payload sha256>)
```

Re-adopting byte-identical text is then impossible by construction (`DUP_IDEM`), while amended text
hashes differently and earns its own idem for free.

**Option 1 is subsumed, not discarded.** The human sign-off still happens as `approval.requested` →
`decision.recorded`; `constitution.adopted` records the *resulting law*. That is the same
two-truth-source split as `council.verdict` (the call) versus `council.outcome` (what happened) —
ADR-0310 — under ADR-0304's one-kind-per-lifecycle-step rule.

**Amendment re-uses existing machinery.** Tier E is unamendable; Tier A is amendable with friction. A
later adoption is a second `constitution.adopted` whose **event-level `supersedes`** names the prior
one. No payload field, no "current" flag: a status field on an append-only receipt is a field that
learns to lie.

**The document is renamed at adoption** — `docs/strategy/arc-CONSTITUTION-draft.md` →
`docs/strategy/arc-CONSTITUTION.md` — and the rename happens **before** the hash is taken. The path
sits inside the hashed receipt permanently; baking `-draft` into the filename of adopted law is the
poster-drift failure in miniature.

**The count stays derived** (ADR-0107): the `UNKNOWN_KIND` message reads `KINDS.length`, never a typed
total. Per ADR-0106's rule the unknown-kind hostile fixture is re-run —
`tests/fixtures/spine/hostile/16-unknown-kind.json` uses `revenue.imagined`, so it does not collide
with the new kind and keeps asserting what it was written to assert.

**Confidence:** high — verified against the live `KINDS` export, the canonical spine directory, and the
existing ADR-0026 extension precedent. Nothing here rests on an external claim.

**Rejected because:** Option 1 — `decision.recorded` has no room for a hash and its idem is already
bound to something else. Option 2 — records the company's highest-precedence fact as unparseable prose.

## Consequences

**Easier.** `policy-lint` can verify the E2 text it quotes against a hash on the spine, so REQ-01's
"verbatim from the adopted constitution" becomes a check rather than an assertion. The brief and inbox
can answer "is arc under law yet, and which version?" from a typed reader instead of a human's memory.
The policy cycle's prerequisite gate becomes machine-verifiable — which is how this ADR was triggered.

**Harder.** The adopted file can no longer be edited casually: any edit invalidates the hash, and once
the policy engine lands, the strictest gate in the company notices. That is the intended cost. It makes
a Tier-A amendment a deliberate act — rename nothing, edit the text, emit a superseding
`constitution.adopted` — rather than a quiet commit.

**Not decided here.** The spine has no notion of a *human* actor, so the validator cannot assert that
adoption came from Ashiq rather than an agent. v1 leans on the `approval.requested` →
`decision.recorded` pair as the human gate and on the repo-diff review of the text itself. An
actor-class grammar is a larger change than this micro-extension should carry, and the policy cycle is
the natural place for it if it is ever wanted.

**Deliberate non-scope.** This ADR adds one kind and its shape. It does not adopt the Constitution —
that is Ashiq's sign-off, and it happens after this lands. It also decides nothing about the policy
engine itself; POL-A..K remain the policy lane's to record from its own century.

**Revisit if:** an amendment needs partial or per-article adoption — that is a new ADR, never a quiet
widening of this payload.
