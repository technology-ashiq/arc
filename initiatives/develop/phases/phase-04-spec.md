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
- **`tests/fixtures/develop-evals/`** — replay fixtures in SIX categories (five failure classes
  plus `clean/` controls), plus `withheld/`.
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

### What a candidate IS, as a file

A row is the *record*; for an executable candidate the row also points at the thing that runs:

```
check: .claude/scripts/develop/candidates/L-001.mjs
```

That module exports one function — `check(fixture) -> { flagged: boolean, why: string }` — and
nothing else. It is pure: it reads the fixture it is handed and returns a verdict. `type: rule` and
`type: fixture` candidates MUST carry `check:`; the other four types must NOT, because they are
procedures a person or an agent applies, not code.

### What a fixture IS, as a file

`tests/fixtures/develop-evals/<category>/<id>.md`, and every one carries a header before its body:

```
id: F-007
category: false-confidence
expect: flagged
area: build
adr: 0108
```

The body is the artifact under test — the ledger fragment, the diff, the gate output — whatever the
past failure actually looked like.

**`expect:` is what makes both numbers computable, and it is why there are SIX categories, not five.**
The five failure categories all carry `expect: flagged`. A sixth — **`clean/`** — carries
`expect: clean`: cases a correct candidate must NOT flag. Without them, false-block count has no
basis at all; a candidate that flags everything would score a perfect catch-count. Of the ≥12
fixtures, **at least 4 are `clean/`**.

- **catch-count** = `expect: flagged` fixtures the candidate flagged.
- **false-block count** = `expect: clean` fixtures the candidate flagged.

Both are counted by the runner. Neither is written by hand.

### How a fresh agent is actually invoked

Not a figure of speech — a concrete step, twice in this phase:

1. **The candidate verdict** (`evaluated-by:`): spawn an agent whose entire prompt is the candidate
   file plus the replay output JSON. It receives no failure narrative, no reasoning, no ledger. Its
   returned verdict is written into `evaluated-by:` and its full report is saved to
   `initiatives/develop/evidence/phase-04/candidate-<id>-eval.md`.
2. **The adversarial pass on this phase's own lint**: a separate agent given the lint source, the
   rules it claims to enforce, and the existing fixtures — told to walk past it.

Both are separate invocations with fresh context. Neither may be performed by the session that wrote
the thing being judged; that is the non-negotiable, and it is the whole reason both exist.

### The three inputs a promotion needs (REQ-03)

`verdict: promoted` is a FAIL unless the row also carries all three:

1. `replay:` — the computed result of running the candidate against the fixtures: how many it
   catches, and how many unrelated fixtures it breaks. **Both numbers computed, neither asserted.**
2. `evaluated-by:` — a verdict from a fresh agent that received ONLY the candidate and the replay
   results (ADR-0108). Not the failure that motivated it, not the reasoning.
3. `approved-by: ashiq` with a date. No count, no streak, no score promotes anything alone.

### The holdout (REQ-04, ADR-0109)

**Which fixtures are withheld is decided and committed BEFORE any of them is authored** — at
least 3 of the 12, spanning at least 2 of the 6 categories — and at least one of them a
`clean/` control, so the holdout can measure false blocks and not only catches. This ordering is the whole claim: a
fixture the authoring session has already seen cannot be moved into the holdout afterwards, and
choosing after the fact would leave a holdout that looks like one and is not. Cheap to get right
now, unrecoverable later.

**"Excluded from candidate-authoring context" is an operational step, not an aspiration** — the
first draft of this section left it undefined, which meant it had no meaning beyond the citation
lint. Concretely, three things:

1. **The runner never shows it.** `learning.mjs replay` prints per-fixture results for the five
   visible categories and, for `withheld/`, only the two totals. A withheld fixture's id, category
   and body are never printed by any command, so they cannot arrive in context by accident.
2. **Authoring reads a filtered list.** The candidate-authoring step is handed the fixture inventory
   produced by `learning.mjs list --visible`, which omits `withheld/` entirely. That is the list a
   candidate is written against.
3. **The lint FAILs a candidate row citing a withheld id** — the backstop for when 1 and 2 fail.

**It is process-enforced, not blind, and every place it is reported says so.** The authoring session
can `cat` that directory; nothing here prevents it. What these three steps buy is that it will not
happen *by accident*, which is the honest claim. Deliberate contamination is caught only by
mechanism 3 of ADR-0109 — time-forward measurement — and that pays out in a later cycle, which is
exactly why a promoted row carries `forward-verified: no` until one does.

## Exit criteria (Definition of Done)

- [ ] `docs/develop/learning-ledger.md` exists with ≥3 real rows drawn from Cycle 5's actual
      findings, each carrying typed links
- [ ] `develop-lint` FAILs an unparseable learning row and names its id and line
- [ ] `develop-lint` WARNs a row with zero typed links
- [ ] `develop-lint` FAILs a `verdict: promoted` row missing `replay:`, `evaluated-by:` or
      `approved-by:` — asserted once per missing field, not once in total
- [ ] `tests/fixtures/develop-evals/` holds ≥12 fixtures across SIX categories — spec-drift,
      false-confidence, missing-edge-case, bad-gate, flailing, and **`clean/` (≥4 of them)**. Without
      clean controls a candidate that flags everything scores a perfect catch-count and a
      false-block count of zero, which is the same shape as a gate that cannot fail
- [ ] `withheld/` exists, a candidate citing a withheld id FAILs, and no command prints its contents
- [ ] replay computes catch-count (flagged among `expect: flagged`) AND false-block count
      (flagged among `expect: clean`), and the lint rejects a self-declared number
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

## Status of the "one REAL promotion" criterion — UNMET, deliberately not rewritten

The criterion says the promotion "ships as an enforced check". **It did not, and the criterion is
recorded as unmet rather than reworded to match what happened.** Moving a goalpost to where the ball
landed is the exact failure this product exists to prevent, and it would be a strange thing to do
inside the phase that builds the machinery for refusing it.

What actually happened, and why it is not a failure of the loop:

1. **L-002** was authored from a real Cycle-5 finding, replayed (visible: caught 1 of 11, false-blocked
   0 of 4 at the time), and sent to a fresh agent with only the candidate and the counts.
   **The agent rejected it** — on the code, not the counts: two bags of words tested against a whole
   document with nothing requiring the success claim and the lost write to concern the same
   operation; an optional possessive that showed it was covering two remembered sentences rather
   than a class; one alternative that could never fire; a second branch that flagged with no success
   claim at all. It then **constructed two inputs that break it**, which are now pinned as clean
   controls F-106 and F-107 — and the replay against the hardened corpus shows L-002 false-blocking
   on exactly those two.
2. **L-004**, the rewrite, keyed on the relation instead of the vocabulary. It stopped false-blocking
   and also **stopped firing at all** (0 of 11): to survive the controls it skips anything whose text
   claims the rejection was intentional, and a false reassurance is written exactly that way.

Both are recorded as `verdict: rejected` with their evidence. **The loop ran end to end twice and
returned "no" twice, which is the loop working.** A first-try promotion would have been the weaker
result — it is what a rubber stamp also produces.

What the phase therefore delivers: the ledger, the lint, the replay runner with two computed counts,
the six-category corpus hardened by an adversarial pass, the withheld holdout, and **two honest
rejections**. What it does not deliver is a shipped enforced check. That criterion carries forward,
and L-004's own row already names what the next attempt must do differently — reconcile a claimed
count against a persisted count, rather than start from a regex over prose.

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
  writes, not only against fixtures — and assert **the rule, never a snapshot**: that rows parse,
  that links resolve, that WARN and FAIL fire on the shapes they should. Never an exact row count or
  a literal row id. This is the one place Cycle 6 tests against a live file that later cycles will
  grow, and a snapshot assertion there turns CI red on nothing broken (retro-log 2026-08-02).
- **Expected evidence:** bats output on 3 legs, the ledger file, the replay output pasted with its
  two computed numbers, and the fresh agent's adversarial report.

## Rabbit holes in this phase

- **Converting all 43 council holes.** ≥12 across the six categories is the bar. The design source says
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
