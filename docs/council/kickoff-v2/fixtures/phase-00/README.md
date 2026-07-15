# phase-00 fixtures — tightened `--verdict` gates

Run each against `node .claude/scripts/council-lint.mjs --verdict <file>`. `good-*` must exit 0,
`bad-*` must exit 1 naming its check. The **red-first** column is the proof the check tests
something: it is the exit code on the UNMODIFIED (pre-phase-0) lint — a new-check `bad-*` wrongly
passes there, and the two `good-*` that exercise the scoping/exemption fixes are wrongly failed
there. Phase 0 flips every RED to the Expected column.

| Fixture | Targets | Red-first (v1 lint) | Expected (v2 lint) |
|---|---|---|---|
| `good-full.md` | baseline valid verdict, no UNRESOLVED | 0 | 0 |
| `good-wait-allweak.md` | WAIT + zero Supported/Plausible → DISSENT-cite exemption | 1 (v1 fails: nothing cited) | 0 |
| `good-mk-medium.md` | model-knowledge + Medium is allowed | 0 | 0 |
| `good-unresolved.md` | Contested IDs shown under `## UNRESOLVED` (scoped citation fix) | 1 (v1 fails: cites Contested) | 0 |
| `bad-nodecision.md` | decision-core: missing `DECISION:` | 0 | 1 |
| `bad-noconfidence.md` | decision-core: missing `CONFIDENCE:` | 0 | 1 |
| `bad-nodissent.md` | decision-core: no DISSENT section citing a surviving ID | 0 | 1 |
| `bad-mk-high.md` | model-knowledge confidence cap: offline + `CONFIDENCE: High` | 0 | 1 |
| `bad-unresolved-empty.md` | `## UNRESOLVED` present but cites no POINT-ID | 0 | 1 |
| `bad-weak-in-reasons.md` | regression re-pin: a Weak ID cited in KEY REASONS (v1 rule survives scoping) | 1 | 1 |

## Hardening fixtures (from the Phase-0 adversarial pass)

An adversarial workflow attacked the three new checks and found 11 holes, all fixed before close.
These fixtures pin the six highest-value ones so they cannot silently reopen. Each is the exact
verdict markdown that broke (or was wrongly rejected by) the pre-hardening gate.

| Fixture | Hole it pins | Expected |
|---|---|---|
| `bad-template-unfilled.md` | an unfilled step-7 template (`DECISION: YES \| NO \| …`) passing as a decided YES/High — now needs exactly one filled DECISION + CONFIDENCE line | 1 |
| `bad-mk-offline.md` | model-knowledge cap dodged via the synonym `Research mode: offline` — High now requires an explicit `Research mode: live` (also closes `model knowledge` space + U+2011 hyphen + omitted line) | 1 |
| `bad-dissent-in-prose.md` | the word "dissent" in PREDICTION prose satisfying the DISSENT requirement — header now anchored to line-start | 1 |
| `bad-decoy-wait.md` | a decoy `DECISION: WAIT` above a real `DECISION: YES` stealing the all-Weak exemption — multiple DECISION lines now rejected | 1 |
| `bad-unresolved-prose.md` | `## UNRESOLVED` satisfying its ≥1-POINT-ID check with a prose token (`Q4`, `CO2`) — now needs a bracketed rebuttal-set id | 1 |
| `good-dissent-inline.md` | a valid DISSENT whose citation sits on the header line being wrongly rejected (false-fail) — now accepted | 0 |

Deferred to phase-2 (correctly out of phase-0 scope): the `## REBUTTAL LOG` no-rubber-stamp
acceptance path — it lands with its own fixtures when the rebuttal round is built.

