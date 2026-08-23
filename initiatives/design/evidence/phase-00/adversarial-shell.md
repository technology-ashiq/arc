# Phase 00 — adversarial pass, surface 2: SHELL AND OS BOUNDARY

**Agent:** fresh, had not seen the implementation, and was told not to re-derive business rules —
surface 1 had those. Given the source, the suite (as a **suspect**), `.claude/rules/testing.md`,
and this repo's already-fixed defect list.
**Ran against:** the PR that ships the gate (#222).
**Returned:** 12 findings, every one verified by execution rather than by reading.

Overlap with surface 1: **one finding**, the argument-loop hang, found independently by both.
That is the expected shape — Cycle 6 and bench both measured two surfaces sharing a root cause
and almost none of the findings.

| # | Finding | Disposition |
|---|---|---|
| 1 | Trailing flag with no value → **infinite loop**; exit 124 under `timeout 5` on all five flags. The fix already existed in `tests/fixtures/design/fake-agent-browser.sh:24` with a comment naming this exact failure — applied to the fixture, never carried to the script it drives. Third recurrence of that twin shape. | **FIXED** (same as surface 1 #1). |
| 2 | Route round-trips through JSON escaping on write and raw `sed` on read, so the guard misclassifies **in both directions**: a backslash route deletes a correct render, and two routes truncating to the same prefix compare equal, turning the guard silently off. Backslash routes are live on the Windows leg (`[ -f "$ROOT/docs\one.html" ]` is TRUE in Git Bash). | **FIXED** — parsed reads. |
| 3 | The `printf` meta branch emits invalid, **injectable** JSON for the same inputs; `$ROUTE` is the one field with no grammar check upstream. | **FIXED** — refuses what it cannot escape; shape brought to parity. |
| 4 | `--media` is asserted but never measured and its failure is discarded (`|| true`) while `RECIPE` hardcodes `media-$MEDIA` into every receipt — a `--media dark` render whose browser ignored the command was sealed as "judged in dark". | **FIXED** — fail-closed like the viewport. Exactly the class CLAUDE.md names: a gate that transforms what it measures must declare what the transform destroys. |
| 5 | The duplicate guard could not tell SCANNED CLEAN from COULD NOT SCAN — grep exit 2 and exit 1 both took the same silent `continue`. | **FIXED** — status read; unreadable is a named refusal. |
| 6 | No negative control proved the `FAKE_AB_SHOTS` channel reaches the child. Every payload in the suite was behaviourally identical to the fixture's own default, so if propagation ever broke, all 17 tests would keep passing while the suite stopped driving the fixture. (Tested: it *does* propagate on bats 1.13 / bash 5.3 — the defect is that nothing would notice if it stopped.) | **FIXED** — one test asserts a payload only the variable can produce: two differing captures must trip the #57 stable-shutter refusal. |
| 7 | `session_less_meta_is_refused` passed on **glob ordering luck** — two metas matched and `legacy` sorts before `s1`. Renaming the session broke it. | **FIXED** — the competing meta is removed so only the intended path is reachable. |
| 8 | The meta write was the only refusal path leaving an orphan: `|| exit 1` with no cleanup, while every other refusal removes both files. | **FIXED** — both branches clean up. |
| 9 | The `file://` URL is built by concatenation and never percent-encoded: `#` truncates at a fragment, `?` starts a query. | **ACCEPTED** — see below. |
| 10 | Missing-vs-empty in the session read, plus a torn read: a meta caught mid-write yields empty and hard-refuses a *legitimate* render, blaming a sibling. | **FIXED** — the parsed reader distinguishes absent (exit 3) from present-but-empty from malformed (exit 1). |
| 11 | `. common.sh 2>/dev/null \|\| true` mislabels its own failure — a broken `common.sh` surfaces later as "no sha256 tool on this box", a true statement about the wrong cause. | **ACCEPTED** — see below. |
| 12 | `TEXT_LEN` counts bytes (`wc -c`) and does not strip `\r`, so the blank-page threshold means something different per encoding and per leg. | **ACCEPTED** — see below. |

## Explicitly accepted, not fixed

All three are **pre-existing** and none is caused or worsened by this phase's change. Recording
them here rather than fixing them keeps REQ-01's blast radius to session and iteration safety;
each is a one-line change whenever its own phase touches that code.

- **#9 URL percent-encoding.** Real, and its symptom is a blank-page refusal blaming the page —
  which fails loudly rather than silently. A route containing `#` is not currently produced by
  any caller.
- **#11 `common.sh` sourcing.** Fails loudly, so the cost is diagnosis time, not a wrong result.
- **#12 `wc -c` vs `wc -m`.** For the ASCII fixtures in the suite the two are identical, so
  changing it now would alter a guard's semantics mid-phase for no observable gain.

## Categories the attacker probed and found clean — stated, not padded

**bash-3.2 compliance** (no arrays, `+=`, `${var^^}`, `[[ =~ ]]`, `mapfile`, `shopt` — zero hits)
· **`sed` portability** (every expression BRE, no `-i`, no `-E`; identical on BSD sed) ·
**already-fixed defect 4** — no shell variable is interpolated into a `sed` script anywhere in
the file, so the `D:daarcarc` class is structurally absent · **unquoted `for f in $FILES`** —
the only loop is a quoted glob · **empty/missing glob directory** — verified to iterate once
with the literal pattern, absorbed by `[ -f "$m" ] || continue`, with `UNCHANGED` pre-initialised
and the loop running in the current shell · **`printf` arity** — 8 conversions, 8 arguments ·
**background-job statuses** in the concurrency test are read individually, no bare `wait` ·
**injection through session / viewport / sha** — all three grammar-validated before use.
