# PLANOFF — T-01 pre-emit finding verification · PROTOCOL

> **WRITTEN AND COMMITTED BEFORE THE HARNESS RAN.** That ordering is the point of this file, and it
> is checkable: this document lands in its own commit, the harness and `RESULTS.md` land in the next
> one. A metric chosen after the numbers are visible is not a metric, and the fixture author warned
> about exactly this — *"write the weighting down before you look at the numbers, or the metric gets
> chosen after the result."*

## What is being compared

| | Rule |
|---|---|
| **OLD** | A finding enters the main report because the reviewer stated it. `cite` is optional and nobody resolves it. |
| **NEW** | A finding enters the main report **iff** `quote` is non-null **and** byte-matches the text at `cite`. Otherwise it goes to `## Appendix -- unverified` with a provisional severity. Nothing is deleted. |

NEW is `docs/playbooks/finding-verification.md` as shipped, reduced to the one part a script can
decide. The parts a script cannot decide — whether a quote *supports* its claim, whether verification
happened *before* emission — are out of this measurement by construction, and §"Not measured" says so
rather than letting the number stand in for them.

## Fixtures

`tests/fixtures/absorb/finding-verification/` — three fixtures, 22 candidates, built by an agent that
was held blind to the rebuild diff (it did not open the playbook, the caller, the branch diff, or the
rebuild's test suite). Ground truth in that directory's `INDEX.md`. Its own caveats are reproduced in
`RESULTS.md` unedited.

The A/B runs on these fixtures and **never on this cycle's own diff** — the rebuild edits arc's review
surface, so measuring it against its own change would be the author grading the author.

## The metrics, fixed now

**Primary — the class the technique claims to remove.**
`unresolvable-false-in-main` = false findings reaching the main report whose `cite` does not resolve
or whose `quote` does not byte-match. **Lower is better.** This is the bounded, checkable class the
playbook claims and the only one a byte-match can decide.

**Secondary — the cost the playbook admits.**
`true-in-appendix` = true findings demoted out of the main report. **Lower is better, and it is a
cost rather than a loss** — the appendix keeps them readable, which is the whole reason the appendix
is mandatory.

**Integrity condition — not a metric, a gate.**
`true-lost` = true findings present under OLD and absent from **both** sections under NEW. **Must be
zero.** A non-zero value means the rule converts false positives into false negatives, which is the
failure the appendix exists to prevent, and it fails the run outright regardless of every other
number.

**Reported separately and explicitly NOT counted for or against NEW.**
`supported-false-in-main` = false findings that quote a real line byte-exactly, where the line simply
does not say what the claim says. **A byte-match cannot catch these and the playbook does not claim
to** ("Does not claim: general accuracy"). Folding them into the primary metric would score the
technique against a claim it refuses; omitting them entirely would hide the size of what it leaves
open. So: counted, named, and excluded from the verdict.

**Third bucket, per the fixture author's caveat 3.**
`near-miss-demoted` = true findings with an exact quote and an off-by-N `cite`. These are reviewer
error, not rule error, and are one re-cite away from verified. Own bucket, not counted as a cost of
NEW.

## Pass condition, fixed now

NEW **wins** iff **all three** hold:

1. `true-lost` = 0.
2. `unresolvable-false-in-main` is **strictly lower** under NEW than under OLD.
3. Every `true-in-appendix` entry is present in the appendix output — demoted, never dropped.

NEW is **BELOW-BAR** — not a tie, and not an adoption — if `true-lost` = 0 but the reduction in (2)
is zero. A technique that removes nothing has not earned a rebuild, and "broke no rule" is not a
pass condition (ADR-0049: a gate whose PASS is only an absence cannot detect insufficiency).

NEW **fails** if `true-lost` > 0.

## What this run does NOT establish

- **It does not measure the production rate.** The 4-of-14 unquotable-true rate in the fixtures is
  the fixture author's construction, stated as such; there is no data on arc's real review output.
  This is a discrimination test, not a forecast.
- **It does not test the appendix's protective effect in practice.** Nothing in arc reads the
  appendix back; the calibration loop the source paired with it is not rebuilt. The fixtures prove
  a demoted true finding is still *written down*, not that anyone acts on it.
- **It does not test the ordering claim.** "Verification happens before emission" leaves no artifact.
- **It does not test the enforcement path.** On `/arc-audit` the findings are produced by the
  `security-auditor` subagent, whose definition is off the ADR-0602 allowlist; the only enforcement is
  the caller forwarding the requirement into its Task prompt. This measures the rule, not whether the
  rule reaches the writer.

## Known hole in the rule, from the fixture author, recorded before the run

`03/F3`: the claim is about the `unit` job, the `cite` lands on the `lint` job, and both
`    runs-on: ubuntu-latest` lines are **byte-identical** — so the quote check passes on a
mis-located finding. Duplicate lines are ordinary in YAML and shell. No quote check closes this, and
it belongs in the playbook's limits rather than in a footnote after the fact.

## Then, and only then

The owner judges blind per ADR-0603: labels drawn from the fixed information-free pool, the
label-to-variant mapping sealed by hash commitment before the request is raised, revealed only after
`decision.recorded` carries a pick and a reason. The registry row moves on that decision ref or not
at all.
