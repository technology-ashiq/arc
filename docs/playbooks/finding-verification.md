# Playbook — verify a finding before you emit it

**Who reads this:** any arc surface that emits findings a human will act on. Today that is
`/arc-audit` (which routes HIGH and CRITICAL findings into tracked issues) and the two-surface
adversarial pass every phase runs. `/arc-review` is next, and is not wired yet — see *Where this
does not apply yet*.

**Provenance.** This practice was found by studying an external review agent read-only
(`initiatives/absorb/evidence/phase-04/extraction-report.md`, technique **T-01**, source pinned by
sha256, **license NOT FOUND**). Nothing is copied. The rule below is arc's own re-expression against
arc's own surfaces, which is the only thing an absent license permits and the only thing worth
having: a practice you can restate in your own terms is a practice you understood.

---

## The rule

**A finding is UNVERIFIED until you can quote the source line that motivated it.**

Verification happens **before** emission, not after. That single word is the whole technique. arc
already verifies findings — by hand, one at a time, after they are written down, which is exactly
what this cycle did across four adversarial passes with no mechanism at all. Moving the check
upstream costs the reviewer one field and costs the reader nothing.

Every finding carries three fields, and a finding missing any of them is not a finding yet:

| Field | What it holds | Why it is separate |
|---|---|---|
| `claim` | one sentence: what is wrong | forces the defect to be stated, not gestured at |
| `cite` | `path:line` or `path:from-to` | a location, so a reader can go there |
| `quote` | the verbatim text at `cite` | **the load-bearing one** — a citation nobody resolved is a coordinate, not evidence |

`cite` without `quote` is the failure this catches. A plausible-looking `path:line` is the cheapest
thing in a review to invent and the most expensive thing to check, so the reviewer who made the
claim resolves it, once, instead of every reader resolving it forever.

## What happens to an unverified finding

**It goes to an appendix. It is never deleted.**

Write it under `## Appendix -- unverified` in the same report, with whatever partial evidence exists
and one line on what was missing. It does not go in the main report, it does not open a tracked
issue, and it does not get a severity.

**The appendix is not politeness — it is the thing that stops this rule from making the review
worse.** A gate that suppresses unverifiable findings converts false positives into false negatives
the moment a true finding is genuinely hard to quote, and true-but-hard-to-quote is a real category:
a defect that lives in the *absence* of a line, an interaction between two files, a behaviour that
only appears at runtime. Those are often the findings worth the most. Suppressing them silently
would trade a noisy review for a confident one, which is a downgrade wearing an improvement's
clothes. The appendix keeps them readable and keeps the main report clean, and the reader decides.

An appendix nobody reads is the failure mode here. So: if the appendix is non-empty, the report's
first paragraph says how many entries it holds. A count in the summary is what makes an appendix a
place rather than a drawer.

## The clause that stops the obvious workaround

**Raising a finding's confidence, or asserting a severity, to make it look verified defeats this
rule, and is worse than the finding it protects.**

The gate is on the *quote*, not on the reviewer's stated certainty. There is no confidence level
that substitutes for a resolved citation, and there is no "clearly" or "obviously" that does either.
A reviewer who cannot quote the line and emits the finding anyway with a raised severity has not
worked around a bureaucratic step — it has laundered an unverified claim into a tracked issue
someone will spend a day on.

This clause exists because the workaround is the natural next move for anything optimising to look
thorough, and because it is invisible in the output: a laundered finding and a verified finding read
identically. The only place it shows is the missing `quote`.

## What this claims, and what it does not

**Claims:** it removes findings whose motivating line does not exist or does not say what the claim
says. That is a bounded, checkable class.

**Does not claim:** general accuracy. A finding can be fully quotable and still wrong — the quote
proves the line exists and says what was claimed, not that the conclusion drawn from it holds. This
rule is not a substitute for the adversarial pass, and a surface that adopts it has not thereby
earned fewer reviewers.

**Measured, not asserted:** the A/B behind this playbook is at
`initiatives/absorb/evidence/planoff/` — three fixtures, old rule versus this rule, including a
true-but-hard-to-quote finding specifically to test whether the appendix catches it rather than the
gate eating it. Read the RESULTS before believing the paragraph above. If the numbers ever stop
supporting it, this file is wrong and should be retired through the registry, not quietly softened.

## How to apply it, concretely

1. Draft the finding: what is wrong, in one sentence.
2. Open the file. Find the line that made you write that sentence.
3. Paste it verbatim into `quote`, with its `path:line` in `cite`.
4. **Cannot find it?** Then either the claim is about something else — restate it against the line
   that IS there — or you cannot resolve it, in which case the finding goes to the appendix with one
   line saying what was missing. Both outcomes are fine. Emitting it anyway is not.
5. Before publishing, count the appendix and put the number in the summary.

## Where this does not apply yet

`/arc-review` runs through `.claude/agents/code-reviewer.md`, which is where arc's review *method*
lives and is the right long-term home for this rule. It is **not on the ADR-0602 allowlist**, and
reaching it needs either an engine-side ruling on the three fidelity pilots or an allowlist widening
decided on its own merits — ADR-0602 Amendment 1 routes 1 and 3. The owner ruled DO NOT WIDEN on
2026-08-09 and that stands. So this playbook is deliberately one surface away from where it belongs,
and `products/absorb/registry.json` records T-01 as a **trial** rather than an adoption for exactly
that reason. A playbook plus one caller is the honest v1, not the destination.
