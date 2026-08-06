# ADR 0506 — E2 binds to grants through a mandatory declaration, and quote drift is caught by parsing the hash-pinned Constitution

**Status:** accepted
**Date:** 2026-08-06
**Product:** `policy`
**Reversibility:** two-way
**Revisit trigger:** the Constitution is amended and re-adopted (a new `constitution.adopted`
receipt). The pinned sha256 in `hq.policy.yaml` must be updated in the same change, and the E2
parse re-checked against the new text — that is a deliberate, loud reopening, which is the point.

## Context

Two defects in the first draft of the schema, both found by the kickoff simulation gate.

**First: nothing connected E2 to a grant.** `ungrantable_actions:` was a flat list of five
English phrases — "moving money", "killing a venture", "changing prices", "unlocking real-money
trading", "publishing under Ashiq's name" — while grants are `(action kind, capability, level)`
triples. There is no derivable mapping between them: five business actions do not correspond to
eight capabilities, and no field said which kind performs which. `policy-lint` could not have
implemented "any E2 entry above L1 fails the file", and the `E2-at-L2` / `E2-at-L3` hostile
fixtures could not have been written.

**Second: the drift check did not check drift.** The spec said the E2 quote is "checked against
the adopted sha256 `233a6496…6ee6`, so a drifted quote is a lint failure". That hash is of the
whole `CONSTITUTION.md` file. Comparing it proves the Constitution has not changed; it says
nothing whatever about whether the five strings copied into `hq.policy.yaml` still match it. The
named failure mode — a drifted copy — would have passed. This is the poster-document failure
class appearing inside the control built to prevent it.

Relevant fact about the source text: E2 is **prose, not a list**. In `CONSTITUTION.md` it reads
`Irreversible actions belong to the human alone: moving money, killing a venture, changing
prices, unlocking real-money trading, publishing under Ashiq's name. No level of proven autonomy
ever includes these.` — one sentence, wrapped across lines.

## Options considered

**For the binding:**
1. **A — a fixed capability-to-E2 map in code** (`spend` means "moving money", etc.). Cons: the
   map is a guess by the implementer about business meaning; "killing a venture" and "changing
   prices" have no capability at all, so most of E2 would be unenforced.
2. **B — each action kind declares which E2 actions its work can perform**, and the lint enforces
   the consequence. Cons: relies on an honest declaration. Mitigated by making the field
   mandatory and adding an unconditional rule for the money case.

**For the drift check:**
3. **C — add a machine-readable fence to `CONSTITUTION.md`** and parse between the markers.
   Cons: changes the file's bytes, which changes its sha256, which **invalidates the adoption
   receipt `01KZ9V0QXNNMB3ZH18MSH8DKH3`** — an editorial convenience would force a re-adoption
   at v1.1.
4. **D — parse the E2 paragraph out of the prose, gated behind the hash check.**

## Decision

**B for the binding, D for the drift check.**

**Binding.** Every kind in `hq.policy.yaml` carries a mandatory `e2:` list naming which of E2's
five actions its work can perform. Then:

1. **A missing `e2:` key is a lint error.** Silence is not consent — an author who has not
   thought about E2 cannot accidentally pass by omitting the field.
2. A kind with a **non-empty** `e2:` may not hold **any** capability above L1.
3. **`spend` above L1 is a lint error unconditionally**, regardless of what `e2:` says. "Moving
   money" is the one E2 action with an exact capability, so the most dangerous case is
   mechanical and needs no honest declaration to work.
4. `publish` or `deploy` above L1 requires `e2:` to be present and to exclude "publishing under
   Ashiq's name" — the author must have stated it, not merely not-mentioned it.

**Rule 4's honest limit, because an adversarial pass found it and it must not be discovered
later as a surprise:** rule 2 already caps *every* capability at L1 for any non-empty `e2:`, so
rule 4 is only ever reachable when `e2:` is the **empty list**. It therefore collapses to
"`publish` or `deploy` above L1 requires `e2: []`", and **nothing mechanically verifies that the
empty list is true.** A kind that really does publish under Ashiq's name, declared `e2: []`,
passes. This is the one place the model rests on an honest declaration with no backstop, and it
is the E2 item this project has already nearly violated for real (product mockups almost reaching
a public subreddit). Consequences: `e2: []` on any kind granted `publish` or `deploy` above L1 is
a **claim requiring explicit sign-off in the PR description**, never a default to skim past; and
"a kind with `publish: L2` and `e2: []` whose work publishes" is a standing REQ-08 attack row.

The one reason that carried the most weight: **E2 is about business meaning, and business
meaning cannot be inferred from a capability name.** Only a human knows whether a given process
can kill a venture. So the model asks the human, makes the asking mandatory, and then makes the
one inferable case (money) unconditional so the honest-declaration surface is as small as
possible.

**Drift.** `hq.policy.yaml` carries `constitution: { version, sha256, receipt }`, and
`policy-lint` runs two separate checks in order:

1. **Version pin.** sha256 of the live `CONSTITUTION.md` must equal the pinned value. Failure
   means the Constitution changed without a new adoption receipt — exit 2, loudly.
2. **Quote match.** Only then, locate the paragraph beginning `**E2 · Human Sovereignty.**`,
   collapse the line wrapping to single spaces, take the text between
   `belong to the human alone: ` and `. No level`, split on `, `. It must yield exactly five
   items, and they must equal `ungrantable_actions:` element-wise. Any mismatch is exit 2.

A strict parser over prose is normally brittle. **Here it is not, and the reason is the
ordering:** step 1 gates step 2, so the input to the parser is a file whose bytes are pinned. If
anyone reformats E2 — even by rewrapping a line — the hash check fails first and by name.
Brittleness only hurts when the input can drift silently, and this input provably cannot. That
also removes the need for option C, so the just-adopted Constitution is not disturbed to make a
tool's life easier.

That argument depends on the bytes being **platform-invariant**, which an adversarial pass
correctly flagged as a live risk for a repo developed on win32 and tested on ubuntu runners. It
was checked rather than assumed: `.gitattributes` pins `* text=auto eol=lf` repo-wide,
`CONSTITUTION.md` holds **zero CR bytes** on the Windows working copy, and it hashes to exactly
the pinned `233a6496…6ee6`. So the invariance holds today — but it holds *because of one line in
`.gitattributes`*, not by nature. A future `-text` or `eol=crlf` override covering markdown would
break the hash check on a file nobody edited, so `policy-lint`'s failure message for check 1
names `.gitattributes` as the first thing to look at. Both checks also read the file **once**
into a single buffer — hash that buffer, parse that buffer — so there is no TOCTOU gap between
them.

**Evidence:** `CONSTITUTION.md:21-24` (the E2 paragraph as quoted above, read at kickoff);
adoption receipt `01KZ9V0QXNNMB3ZH18MSH8DKH3` pinning sha256
`233a64961dc0a028ceca6b113405ead699f9185b39342924c32c05f9786b6ee6`; both defects raised by the
kickoff simulation gate against PLAN.md and `phases/phase-00-spec.md` alone.
**Confidence:** high.
**Rejected because:** A — most of E2 has no capability to map to, so it would leave three of five
items unenforced. C — invalidates a receipt that was just written, to save a parser five lines.

## Consequences

Easier: `E2-at-L2` and `E2-at-L3` become concrete, writable hostile fixtures (a kind with
`e2: ["moving money"]` and any capability at L2 → exit 2); the spend rule needs no declaration
at all; and the two drift checks fail with two different, specific messages instead of one
misleading one. Harder: every kind in the file carries an `e2:` line forever, including the
boring ones, and adding a kind means making an E2 judgement — which is the intended friction.
Amending the Constitution now also requires updating the pin in `hq.policy.yaml` in the same
change, and that is a feature: it is the amendment noticing every downstream control that
quotes it.
