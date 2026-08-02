# Learning ledger

> **A company organ — single, never per-lane** (ADR-0053 spirit). Rows may carry `lane:` for
> provenance; the file is one, because a learning that only applies to the lane that found it is a
> note, not a learning.
>
> One row per candidate: what failed · why the existing process missed it · the proposed reusable
> prevention · its type · what it catches · its cost · its verdict. **"We had a retro" is not a
> record.**
>
> Typed links (`area:` `adr:` `rule:` `fixture:` `phase:`) are what make these compound rather than
> accumulate: they encode bug → root cause → area → ADR → rule → fixture → future phases as
> committed markdown, with no graph database and no new owner. The Context Pack follows them one
> hop (ADR-0111).
>
> **Nothing here promotes itself.** A `verdict: promoted` row must carry three recorded inputs —
> computed replay results, a verdict from a fresh agent that never saw the authoring reasoning
> (ADR-0108), and Ashiq's approval. `develop-lint` FAILs a promoted row missing any one, and
> `forward-verified:` stays `no` until a later cycle measures whether the learning generalised
> (ADR-0109). No count, no streak and no score promotes anything alone.

#### learning: L-001

what-failed: a gate's author wrote 26 adversarial inputs for it, all 26 were caught, and an agent that had never seen the parser then found nine holes — including a ledger claiming proof/tier/commit that parsed to zero slices, zero errors, and got "all checks passed"
why-missed: the mandatory adversarial pass named no author constraint, so it was satisfied by the person with the blind spot. All 26 attacked one direction — a slice the parser sees holding bad data — and all nine attacked the other, a slice the parser never sees
prevention: the construct-a-breaking-input pass must be run by a FRESH agent that has not seen the implementation, given the source, the rules the gate claims to enforce, and the existing fixtures so it attacks somewhere new
type: rule
tag: anti-pattern
area: build
adr: 0108
rule: CLAUDE.md
fixture: tests/fixtures/develop-evals/false-confidence/F-003.md
phase: 01
lane: develop
cost: one agent round-trip per gate shipped
verdict: proposed

#### learning: L-002

what-failed: a command reported success while every receipt it emitted was silently quarantined — the spine's kind vocabulary is closed, `develop.started` was rejected with UNKNOWN_KIND, and the emitting command still exited 0
why-missed: the emitter was written fire-and-forget on the correct principle that a spine failure must never change a command's exit code, but nothing distinguished "the receipt landed" from "the receipt was rejected and discarded". Exit 0 was read as evidence of both
prevention: after wiring any new emitter, verify the first receipt actually landed — look in `events/` AND `events/_quarantine/` — and never treat exit 0 from a fire-and-forget writer as evidence that anything was written
type: rule
tag: common-mistake
area: infra
adr: 0107
fixture: tests/fixtures/develop-evals/flailing/F-013.md
phase: 00
lane: develop
check: .claude/scripts/develop/candidates/L-002.mjs
cost: one directory listing per new emitter; no runtime cost
replay: visible caught 1 of 11, false-blocked 2 of 6; withheld caught 1 of 2, false-blocked 0 of 1
evaluated-by: a fresh agent given only the candidate and the replay counts (ADR-0108). Its verdict was REJECT, on the code rather than the counts: the matcher tested two bags of words against a whole document with nothing requiring the success claim and the lost write to be about the same operation, an optional possessive in one clause showed it was covering two remembered sentences rather than a class, one alternative could never fire because of a word boundary before a quote, and a second branch flagged with no success claim at all. It then constructed two inputs that break it; both are now pinned as clean controls F-106 and F-107, and the replay above shows the candidate false-blocking on exactly those two
verdict: rejected

#### learning: L-003

what-failed: a normalisation added to make artifacts comparable destroyed the property being judged — a render pinned `font-family: Arial !important` for hash stability, so every design was scored with its typography deleted, invisible for a whole cycle to every brief, agent prompt and ADR
why-missed: the transform was introduced for determinism and reviewed as a determinism change. Nothing asked what signal it removed, because the question is only obvious once the answer is wrong
prevention: when a gate transforms an artifact to make it comparable, record which signal the transform removes and check that signal is not the one being judged
type: checklist
tag: anti-pattern
area: build
rule: docs/retro-log.md
fixture: tests/fixtures/develop-evals/bad-gate/F-009.md
phase: 00
lane: design
cost: one line in the gate's own header, written when the transform is added
verdict: proposed

#### learning: L-004

what-failed: the rewrite of L-002 keyed on the relation rather than on vocabulary, and stopped firing entirely — it skips any artifact whose text says the rejection was by design, which is precisely the wording a false reassurance uses
why-missed: the skip was added to survive the two clean controls the evaluator constructed, and it survives them by refusing to look at anything that claims to be intentional. A false reassurance and a true one are written the same way; only reconciling the claim against the record tells them apart, and a regex over prose cannot do that
prevention: this failure class needs a check that reconciles a claimed count against a persisted count, not a matcher over prose. Recorded so the next attempt does not start from a regex
type: rule
tag: fix-recipe
area: infra
adr: 0108
phase: 04
lane: develop
check: .claude/scripts/develop/candidates/L-004.mjs
cost: none — it was never promoted
replay: visible caught 0 of 11, false-blocked 0 of 6; withheld caught 0 of 2, false-blocked 0 of 1
evaluated-by: not sent to an evaluator. A candidate that catches nothing needs no unanchored verdict to be rejected — the computed counts settle it, which is what computed counts are for
verdict: rejected
