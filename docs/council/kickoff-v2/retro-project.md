# arc-council v2 — project retro (final, all 4 phases)

> Scoped/self-contained (council-files-only). **On merge to main, port the scoreboard row + the two
> retro-log lines below into root `docs/retro-log.md`, and the trial-ledger note into
> `docs/trial-ledger.md`** — not done on-branch, mirroring the v1 council retro convention.

## Scoreboard (counted from PROGRESS done-log + PLAN ledgers, not estimated)
```
2026-07-16 | arc-council-v2 | M | rework 0/4 | amendments 1 | FIRED 1/5 | burn 95% | sim-blockers-r1 4 | t-to-phase0 0
```
- **rework 0/4** — 0 phases reopened after close; 4 closed (0–3).
- **amendments 1** — one post-STOP plan change: **ADR-0014** (persist first-pass ratings to anchor the
  REBUTTAL LOG), added mid-P2 to close a fabrication loophole, superseding ADR-0008's "final-only" aspect
  (+ REQ-06/07 wording resynced). Every other spec held from kickoff.
- **FIRED 1/5** — pre-mortem **row 2 materialized**: the verifier-rubber-stamp / ADR-0008-first-pass-rule
  loophole became a real code hole, caught by the P2 adversarial pass and fixed via ADR-0014. Rows 1/3/4/5
  did not fire (rebuttal content-leak prevented by the fixed template; calibration friction n/a; lint
  false-fails caught by red-first fixtures; fixture drift n/a).
- **burn 95%** — 9.5 of 10 appetite-days; 0.5d slack unspent; no scope cut, no overrun.
- **sim-blockers-r1 4** — plan-simulator round 1 raised 4 blockers (DISPUTED parse rule, session-001 line
  format, grep/commit scope, verdict schema block); all fixed; round 2 = 1 (no-rubber-stamp doc gap) → fixed.
- **t-to-phase0 0** — Phase 0 (steel thread) closed the same day as kickoff (2026-07-15).

## Project-level findings
| # | Pattern | Prevention | Recurring? |
|---|---|---|---|
| F1 | An adversarial "construct a concrete breaking input and RUN it" workflow found real holes in **every** freshly-built lint/gate — P0: 11, P1: 16, P2: 1 high-sev — in code that read as correct and passed its own fixtures. The passing fixtures only prove the gate works on inputs I *imagined*. | For any hand-authored gate/lint/parser, an adversarial breaking-input pass is **mandatory verification before close**, not optional review. The fixtures cover the known; the adversarial pass covers the unknown. | **yes** |
| F2 | The same markdown-contract **parsing-bug class** recurred across phases: (a) first-match where a section legitimately repeats (append-only `## OUTCOME` / `Review-by:` in P1, multi `## REBUTTAL LOG` in P2) → stale data wins; (b) case-insensitive match then exact `=== "HIT"`/bucket-key compare (lowercase `RESULT`/`CONFIDENCE`) → silent mis-score or crash; (c) `$` under `/m` used as end-of-string → truncated capture. | For a markdown-contract linter: normalize case before compare, take **last-of / all** repeated sections (never first-match when append-only), anchor line regexes without `$` under `/m`, and validate **real calendar dates** not just `\d{4}-\d{2}-\d{2}` shape. | **yes** |
| F3 | **The retro loop worked (meta-win).** v1's retro-log line said "seed the pre-mortem with orchestration/loophole risks, not only strategy." v2 did — and pre-mortem row 2 correctly *predicted* the P2 fabrication loophole, so the adversarial pass had a place to look. Contrast v1, where the pre-mortem missed all real friction (FIRED 0/5 but 3 real findings surfaced outside it). | Keep seeding pre-mortems from `docs/retro-log.md` by tag overlap — it is now empirically paying off, not decoration. | n/a (win) |

## Retro-log lines to port to root `docs/retro-log.md` on merge
```
2026-07-16 | arc-council-v2 | an adversarial "construct a concrete breaking input and run it" pass found real holes in every freshly-built lint/gate each phase (P0 11, P1 16, P2 1 high-sev fabrication loophole) — code that looked correct and passed its own fixtures | for any hand-authored gate/lint/parser, run an adversarial breaking-input workflow BEFORE close; mandatory verification, not optional review | lint,gate,parser,verification,adversarial
2026-07-16 | arc-council-v2 | the same markdown-contract parsing bugs recurred across phases: first-match where a section legitimately repeats (append-only OUTCOME/Review-by, multi REBUTTAL LOG), case-insensitive-match-then-exact-compare (lowercase CONFIDENCE crash / RESULT mis-scored), and $ under /m as end-of-string | markdown-contract linter checklist: normalize case before compare, take last-of/all repeated sections, anchor line regexes (no $ under /m), validate real calendar dates not just shape | lint,regex,parsing,markdown
```

## Trial-gate ledger (port to root `docs/trial-ledger.md` on merge)
The council-v2 kickoff exercised the v3.5 substance gates once (commit c036e63): none fired on the plan
(0 `[trial]` WARNs; the plan was well-formed), i.e. **1 clean run, 0 false-positives**. **Nothing is
promotable** — promotion needs a bats fixture proving each gate FAILs on its own mutation AND ≥3 clean
runs; this is a single run and the fixtures are unverified here. No `TRIAL`-set diff proposed.

## What went right (worth keeping)
- **Adversarial-workflow-per-phase was the highest-leverage practice of the build** — it caught the one
  thing that would actually have broken the product (the P2 fabrication loophole defeating the flagship
  no-rubber-stamp invariant). Same role the verifier played in v1: the honest backstop against
  confident-but-wrong self-assessment.
- **Red-first fixtures held every phase** — proving each new lint check fails before it exists made
  "verified" real, and the negative fixtures still bite (they caught my own DISSENT-regex regression in P0).
- **Scoped-kickoff-into-a-folder** (`docs/council/kickoff-v2/`) kept arc's root tracker untouched while
  giving full `/arc-kickoff` rigor — proven a second time.
- **Live dogfood + live eval probes** turned "the honesty machinery works" from an assertion into evidence
  (four-hop rebuttal chain clean; 6/6 seeded lies caught; 2/2 framing holds; sessions/ isolation clean).

## Steps not applicable
- **Trial-gate promotion:** single kickoff run, no bats fixtures verified — nothing promotable (logged above).
