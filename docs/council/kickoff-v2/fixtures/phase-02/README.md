# phase-02 fixtures — bounded rebuttal + REBUTTAL LOG

The rebuttal round (ADR-0008) records each rebuttal-set id's pre→post rating in a `## REBUTTAL LOG`,
anchored to a persisted `## FIRST-PASS RATINGS` section (ADR-0014). The no-rubber-stamp invariant
(fairness.md #6) is measured on the FIRST-PASS ratings, so a rebuttal that resolved every contested
point still counts as a real cross-examination — while a fabricated contest is rejected.

| Fixture | Targets | Red-first (pre-P2 lint) | Expected |
|---|---|---|---|
| `good-rebuttal-resolved.md` | final ratings all Supported/Plausible, but FIRST-PASS + REBUTTAL LOG show S2/A4 were Contested and re-graded — passes via the first-pass path | 1 | 0 |
| `good-no-rebuttal.md` | a normal verdict, no rebuttal — final ratings carry the contest, no REBUTTAL LOG | 0 | 0 |
| `bad-rebuttal-prose-log.md` | a `## REBUTTAL LOG` of prose ("no Weak moved to Supported") — no structured line; rubber-stamp not laundered (closes phase-0 #9) | 1 | 1 |
| `bad-rebuttal-inconsistent.md` | log `S2: Contested → Supported` while final says Weak — post mismatch | 0 | 1 |
| `bad-rebuttal-fabricated.md` | the Phase-2 adversarial finding: a log line manufactures a contest with **no `## FIRST-PASS RATINGS` to anchor it** — a rubber-stamp that used to pass on a one-word edit | 0 | 1 |
| `bad-rebuttal-multi.md` | two `## REBUTTAL LOG` sections, the second smuggling an unanchored fabricated flip | 0 | 1 |

## The Phase-2 adversarial pass (why FIRST-PASS RATINGS exists)

The workflow proved the original ADR-0008 design (final-only ratings + a `post == final-rating` check)
was a **one-word loophole**: the same author controls the log's `pre`, its `post`, and the final
ratings, so `S1: Contested → Supported` for an already-Supported point manufactured an unfalsifiable
contest and defeated the no-rubber-stamp invariant. ADR-0014 persists the verifier's first-pass grades
as the anchor: the log's `pre` must match them, and no-rubber-stamp is measured on them. A fabricated
contest now requires lying in the persisted first-pass section — an auditable misquote of the verifier's
actual output, not a buried one-liner. The residual single-author fabrication closes only with a second
independent grader (the cross-model juror, v2 backlog) — documented honestly in ADR-0014.
