# Phase 04 — The Learning System: a record that compounds, and a promotion no machine can complete

**Goal (one line):** a failure that escaped once becomes a written, linked, replayable record — and
a proposed safeguard is judged by whether it catches real past failures, by someone who never saw
why it was written.
**Appetite:** 1.5 days
**Depends on:** phase-00

Serves **REQ-01** (the ledger), **REQ-02** (eval fixtures), **REQ-03** (promotion needs three
inputs), **REQ-04** (the withheld holdout).

## Why this phase is first

Everything downstream reads what this defines. Phase 05's Context Pack retrieves learning rows;
any safeguard a later phase proposes must pass through this promotion loop. Building retrieval
before there is anything worth retrieving would be building the pipe first.

## What this phase actually builds

- **`docs/develop/learning-ledger.md`** — a company organ, single, never per-lane (ADR-0053).
  Rows may carry a `lane:` field for provenance, but the file is one.
- **`.claude/scripts/develop/learning.mjs`** — parse, validate and replay. Reuses `ledger.mjs`'s
  hardened `key: value` reader rather than inventing a second markdown contract; that parser
  survived 45 adversarial inputs and a second grammar would start at zero.
- **`tests/fixtures/develop-evals/`** — replay fixtures, five categories, plus `withheld/`.
- **develop-lint additions** — the row-shape checks below.

### The row shape

```
#### learning: L-001

what-failed: the ledger parser accepted a doctored artifact that parsed to zero slices
why-missed: every breaking input was written by the author of the parser, so all 26 attacked one direction
prevention: the adversarial pass must be run by a fresh agent that has not seen the implementation
type: rule
area: build
adr: 0108
rule: CLAUDE.md
fixture: tests/fixtures/develop-evals/false-confidence/author-blind-spot.md
phase: 01
catches: 3 of the 12 seeded fixtures, listed by id
cost: one agent round-trip per gate shipped
verdict: proposed
```

- **`type:`** is one of `rule` / `fixture` / `checklist` / `template` / `skill` / `capability-policy`.
- **`area:`** is a controlled vocabulary — `auth` · `data` · `api` · `ui` · `infra` · `build`. Small
  and closed on purpose: a free-text area field cannot be matched against a slice.
- **`verdict:`** is `proposed` / `promoted` / `rejected` / `rolled-back`.
- **Typed links** (`adr:` `rule:` `fixture:` `phase:`) are what make the record compound rather than
  accumulate. A row with zero links WARNs — it is a note, not a link in a chain.

### The three inputs a promotion needs (REQ-03)

`verdict: promoted` is a FAIL unless the row also carries all three:

1. `replay:` — the computed result of running the candidate against the fixtures: how many it
   catches, and how many unrelated fixtures it breaks. **Both numbers computed, neither asserted.**
2. `evaluated-by:` — a verdict from a fresh agent that received ONLY the candidate and the replay
   results (ADR-0108). Not the failure that motivated it, not the reasoning.
3. `approved-by: ashiq` with a date. No count, no streak, no score promotes anything alone.

### The holdout (REQ-04, ADR-0109)

**Which fixtures are withheld is decided and committed BEFORE any of them is authored** — at
least 3 of the 12, spanning at least 2 of the 5 categories. This ordering is the whole claim: a
fixture the authoring session has already seen cannot be moved into the holdout afterwards, and
choosing after the fact would leave a holdout that looks like one and is not. Cheap to get right
now, unrecoverable later.

`tests/fixtures/develop-evals/withheld/` is excluded from candidate-authoring context, and a lint
FAILs a candidate row citing a withheld fixture id. **It is process-enforced, not blind, and every
place it is reported says so** — the authoring session can read this repo, and a holdout that claims
a blindness it does not have converts a soft signal into a hard-looking one.

## Exit criteria (Definition of Done)

- [ ] `docs/develop/learning-ledger.md` exists with ≥3 real rows drawn from Cycle 5's actual
      findings, each carrying typed links
- [ ] `develop-lint` FAILs an unparseable learning row and names its id and line
- [ ] `develop-lint` WARNs a row with zero typed links
- [ ] `develop-lint` FAILs a `verdict: promoted` row missing `replay:`, `evaluated-by:` or
      `approved-by:` — asserted once per missing field, not once in total
- [ ] `tests/fixtures/develop-evals/` holds ≥12 fixtures across all five categories: spec-drift,
      false-confidence, missing-edge-case, bad-gate, flailing
- [ ] `withheld/` exists, a candidate citing a withheld id FAILs, and no command prints its contents
- [ ] replay computes catch-count AND false-block count, and the lint rejects a self-declared number
      in any learning row
- [ ] **one REAL promotion runs end to end** — a genuine Cycle-5 finding ("verify a receipt
      actually landed rather than trusting exit 0") goes candidate -> replay -> fresh-agent verdict
      -> Ashiq approval, and ships as an enforced check **inside `.claude/scripts/develop/develop.mjs`
      (the receipt-emitting path) — a Cycle-5 file, named here because editing shipped code is exactly
      the self-modification the non-negotiables require a recorded promotion for, and "What this phase
      actually builds" lists only new files**. A loop proven only on demonstration candidates is proven
      on nothing, which is the self-graded evidence ADR-0108 exists to refuse.
      **This is the phase's only step needing Ashiq in real time: if the tripwire fires before that
      review lands, the promotion carries forward as Phase 05's first slice — never a stub approval**
- [ ] every new check has a negative control proving it can fail
- [ ] the adversarial pass on this lint is run by a **fresh agent that has not seen the code**, and
      every hole is pinned as a fixture
- [ ] tests green on all 3 CI legs
- [ ] `tree-manifest.txt` regenerated as a named step
- [ ] tracker updated (PROGRESS.md row ✅ + done-log)

## Verification plan

- **Test command:** `bash tests/develop-learning.bats`
- **Expected failure first:** `not ok 1 the learning ledger parses into rows` — fails before any
  code with `Error: Cannot find module '.claude/scripts/develop/learning.mjs'`. The load-bearing
  red is the promotion pair: `not ok promoted row without replay FAILS` and `not ok a complete
  promoted row passes` must BOTH be red first, because a validator that rejects everything would
  satisfy the first alone.
- **Live demo scenario:** take a real Cycle-5 finding — the author-blind-spot one — write it as a
  candidate row, run the replay against the seeded fixtures, and show the computed catch/false-block
  counts. Then mark it `promoted` without `approved-by:` and watch the lint refuse it.
- **Real-system check:** run the lint against the real `docs/develop/learning-ledger.md` this phase
  writes, not only against fixtures.
- **Expected evidence:** bats output on 3 legs, the ledger file, the replay output pasted with its
  two computed numbers, and the fresh agent's adversarial report.

## Rabbit holes in this phase

- **Converting all 43 council holes.** ≥12 across five categories is the bar. The design source says
  the first batch covers what the records preserve in reproducible detail — the rest is archaeology.
- **A quality score for candidates.** Catch-count and false-block count, both computed, both shown.
  No weighted index. That is the invented-number trap this product bans.
- **A second markdown parser.** Reuse `ledger.mjs`. It survived 45 adversarial inputs; a new one
  starts at zero and will be attacked the same way.
- **Automating promotion.** The loop proposes and evaluates. A human promotes. This is a
  non-negotiable, not a preference.

## Out of scope for this phase

- Retrieval of these rows → Phase 05.
- The suggestion engine and outcome metrics → they read this ledger, and land with Phase 07.
- Time-forward holdout measurement — it needs phases *after* a promotion to exist, so it is defined
  here and measured next cycle.

## Your-setup / pending

Nothing. Offline, fixtures plus one committed ledger file.

**Tripwire:** at 1.2 days inside this phase — 0.3d before the 1.5d appetite is spent, ship the ledger, the lint and the promotion checks, and
cut the fixture count from 12 to the 5 that cover one category each. The loop with few fixtures is
still a loop; fixtures without the loop are a folder.

## Non-negotiables (verbatim from PLAN)

- The main session writes the code — develop supplies context, discipline, checkpoints and evidence; there is no coder subagent, ever.
- develop never modifies its own policies, gates, skills or capabilities without a recorded, Ashiq-approved promotion — this cycle builds the promotion machinery and is bound by it.
- Nothing is installed from the internet without a pinned version, a hash, recorded provenance and a content scan; a write-capable capability additionally needs Ashiq's recorded OK.
- A learning candidate is never graded by the context that authored it.
- Every number is computed by a tool or earned from a scored outcome — a self-declared score in any ledger row is a lint finding.
- Any gate, lint or parser this cycle ships gets an adversarial construct-a-breaking-input pass run by a FRESH agent that has not seen the implementation, with every hole pinned as a fixture.
- Every retrieval states which source it actually used, including when it fell back to grep.
