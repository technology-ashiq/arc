# Phase 02 — Miner + cluster gate

**Goal (one line):** the targets are real evidence, and a human chooses them before any generation
can run.
**Appetite:** 1.0 day — blown appetite = cut scope or kill, never extend silently.
**Depends on:** phase-00

Serves **REQ-01**. This phase also closes pre-kickoff gate row 6 (keyword sources named), which was
found unevidenced at kickoff.

## Exit criteria (Definition of Done)

1. `arc growth mine` reads a **named, written-down list of real sources** (communities, search
   suggest, competitor pages) and emits candidates as JSONL:
   `{keyword, evidence_url, intent, gap_note}`. The source list is a versioned file, not a prompt.
2. **Own-pages exclusion** read from the site's own sitemap, so the miner never proposes a keyword
   the site already targets.
3. **Gap column filled from real evidence, one URL per row.** *(Narrowed 2026-08-14 via `/arc-change`.
   Originally "competitor-gap column filled from real SERP evidence".)* The narrowing is forced, not
   chosen: the `competitor-pages` source is **disabled pending the owner's fair-game list**, which
   this spec's own Your-setup item asks for, and there is no SERP source that satisfies the
   official-APIs-only non-negotiable — the autocomplete and results endpoints everyone reaches for
   are undocumented. What ships is the column, the one-URL-per-row rule, and real attestation
   evidence from the enabled source. **Competitor-gap notes remain manual-entry rows in
   `sources.json`, unfilled, and this is recorded as a gap in the phase close rather than ticked.**
4. Cluster-plan builder emits **ONE inbox item**: 1 pillar + ≥5 spokes + 2–3 BOFU pages, every row
   carrying its evidence link.
5. **A candidate whose `evidence_url` is missing or does not resolve cannot enter the proposal** —
   structurally, not by warning.
6. **Generation invoked against an unapproved cluster is refused.** This is gate 1 of the two
   recurring gates (ADR-1112) and it must be enforced in code, not in the runbook.
7. **One REAL mining run** produces a real cluster proposal for the arc site — not a fixture run.

## Verification plan

**Refined 2026-08-14** (it was the coarse kickoff one-liner until this phase closed). Every row is
a command whose result is checked, not a description of an intention.

| # | What is proven | How, exactly | Expected |
|---|---|---|---|
| V1 | The suites are green **on CI**, per-JOB | `gh run view <id> --json jobs`, run head SHA == branch HEAD | every job `success`, all three OS legs. Never a local run (`.claude/rules/testing.md`) |
| V2 | A fixture source-set yields exactly ONE approvable inbox item | `tests/growth-cluster-gate.bats` — shape test | 1 pillar + 5–8 spokes + 2–3 BOFU, one item |
| V3 | An evidence-less candidate cannot enter the proposal | `growth-cluster-gate.bats` "an evidence-less candidate cannot enter" | structural refusal, not a warning |
| V4 | A dead-link candidate cannot enter | `growth-mine.bats` resolver partition | row lands in `dead`, never in the written file |
| V5 | Generation against an unapproved cluster is refused, by name | `growth-cluster-gate.bats` ×26, incl. the CLI-level case | refusal names the cluster and the reason |
| V6 | **A spoke may not restate the pillar** (ADR-1116, A-05) | `growth-cluster-gate.bats` residue tests | an empty-residue candidate and a duplicate-residue candidate are both skipped; the mutant that restores overlap-ordering turns the suite RED |
| V7 | The own-pages exclusion runs against the REAL sitemap, and the number reported is the number measured | `arc-growth mine --sitemap https://arc.automemory.ai/sitemap-0.xml` | prints `own pages read N; candidates excluded as own M` as two separate counts |
| V8 | One REAL mining run produces a real proposal | the run above, live against HN's API | ≥13 attested candidates, a plan_sha, every row evidence-linked |

**Red-first requirement, and how it was actually met — stated rather than smoothed.** CI is the only
place tests run in this repo and its queue is hours deep, so refusals were not each observed RED
before existing. What ran instead is the **mutant pass**: the guard is deleted and the suite must go
red. That is weaker than red-first and is recorded as such, here and in `PROGRESS.md`.

**Not verifiable by machine, and therefore not ticked:** the real run's proposal being *read* by a
human before Phase 3 opens. That is an owner action; the phase records it as outstanding rather than
asserting it happened.

**Red-first requirement carried forward:** the refusal tests are written before the refusal exists,
so each is observed RED. A guard whose test was written after it passed proves nothing about the
guard.

## Rabbit holes in this phase

Building a keyword-volume estimator · scraping anything that forbids it in its terms · a general
SERP-scraping framework when a written source list and manual evidence links are enough · ranking
or scoring candidates (the human chooses; the machine only evidences) · inventing keywords because
the miner returned few — **no invented keywords, ever**.

## Out of scope for this phase

Article text of any kind · lints · publishing · the exemplars (Phase 3).

## Your-setup / pending

The source list needs the owner's sign-off on **which** communities and competitors are fair game,
since some sources forbid automated access. One short list, once.

## Non-negotiables (verbatim from PLAN)

- **E2 · Human Sovereignty (Tier E, unamendable):** the machine writes branches and drafts; a human merges every publish, every asset swap, every template change. E2 names *"publishing under Ashiq's name"* itself. Enforced in the command by a module-graph parse plus a running mutant — never by convention (ADR-1102).
- **E3 · The Truth Law:** no fabricated numbers, benchmarks, case studies or testimonials; a source link on every claim-of-fact; arc's own results cited only where a receipt exists; simulated always labelled simulated (ADR-1111).
- **A9 · Appetite over estimate:** 10 days is a cap. Blown means cut or kill.
- **A2 · Boring tech before clever tech** — the site choice names the boring alternative it beat (ADR-1104).
- **A5 · One source of truth** — metrics live on the spine as receipts; no metrics database.
- Exactly **two recurring human gates** (ADR-1112). Lints are **negative-only** (ADR-1110).
- Total-preimage idems everywhere · **MISSING ≠ zero** · corrections `supersedes`, never overwrite · no raw URLs or PII on the spine · reader-only spine access · every emit verified in both `events/` and `events/_quarantine/`.
- Official APIs only · **no cold email anywhere in this module** (that is leads', with its own caps and PII law) · no paid ads.
- **Fixture-proven ≠ live-validated** — the tracker records which one each REQ closed as.
- **Shared-organ edits are conflict-checked, never assumed clear:** before any commit touching `KINDS` in `validate.mjs` or `hq.policy.yaml`, run `git log origin/main --oneline -5 -- PATH` — bench, engine and leads are three other LIVE lanes editing these same company organs this week, and `.claude/rules/lanes.md` records two real collisions already. At the merge take the STRONGER version, never the earlier one, and re-derive any measured value (`KINDS.length`) on the merged tree rather than trusting either branch's count.
