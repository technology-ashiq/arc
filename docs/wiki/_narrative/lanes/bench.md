<!-- facts: appetite=c68c3357 blocked-on=a68c9074 burn=96d97217 cycle=ef40fafb depends-on=a68c9074 hasPlan=b5bea41b phase=27491f50 status=8ddd7aee title=b2ca57cd -->

## In plain words

Think of arc as a small company that keeps hiring new AI workers, and think of bench as the room
where a candidate worker sits a timed test before starting on real work. <!-- plain -->

The lane's own goal, in its own words: one command runs every process that ships a fixture pack
against one explicitly-named driver-and-model pair, scores schema-compliance, assertion pass-rate,
cost and latency with deterministic checks, and emits a propose-only router diff whose evidence,
approval and verdict all live on the spine as ordinary receipts — so a new model becomes a
same-day, receipted routing decision instead of a migration project, and a silently-drifting
champion is caught within a month. <!-- src: initiatives/bench/PLAN.md -->

### What it is building

The lane's product is `arc-bench.mjs`, a runner that never joins the company payroll itself: it
tests one candidate model against the fixtures the real processes already ship, and it can only
propose a change to the hiring rota (`engine/router.yaml`) — a human merges every routing change,
and bench has no write path to the router. <!-- src: initiatives/bench/PLAN.md -->

That mattered because, at the moment this lane was born, only one driver had ever produced a real
receipt, no eval fixture anywhere in the repo carried an assertion, the replay driver and a version
check did not exist, and no pricing snapshot existed to bound spend — so the "model market" the
design imagined had no floor under it yet, and kickoff verification falsified five of the design
source's inherited premises. <!-- src: initiatives/bench/PLAN.md; ADR-0900; ADR-0901; ADR-0902; ADR-0904 -->

## arc words → normal words

| arc calls it | It is really |
|---|---|
| champion | The model a candidate is measured against in the eligibility gates, and the one `--champion` re-runs to check for drift. <!-- src: ADR-0906; ADR-0908 -->|
| candidate | The model under test, named explicitly on the command line — never picked automatically and never a sweep of several. <!-- src: initiatives/bench/PLAN.md -->|
| propose-only | Bench never edits `engine/router.yaml` itself; it writes a diff a human reviews and merges, and the router's SHA is checked unchanged after every run, including one that aborts. <!-- src: initiatives/bench/PLAN.md -->|
| K=3 | Every fixture is run three times per candidate, executed sequentially, and the three outcomes are never averaged or majority-voted into one pass or fail — each one contributes on its own to the assertion count. <!-- src: initiatives/bench/PLAN.md -->|
| ceiling | An owner-set placeholder cap on what one invocation may cost, hand-authored with no pricing snapshot behind it, used only to bound spend before a call is made — it never appears in an emitted payload. <!-- src: ADR-0904; initiatives/bench/PLAN.md -->|
| drift guard | The re-run, monthly and started by the owner, that catches a champion quietly getting worse (a new schema failure, or assertions dropping) or more expensive (cost up more than 20%). <!-- src: ADR-0910; ADR-0908 -->|
| real event | The one time a genuinely new model is run all the way through: benched, proposed, and merged or rejected by a human through `arc-inbox`, with a reason recorded either way — both outcomes count as success. <!-- src: initiatives/bench/PLAN.md -->|
| mock driver | A driver that replays pre-recorded bytes instead of calling a real model — built by bench itself, so bench's own tests run offline and cost nothing. <!-- src: ADR-0902; initiatives/bench/PROGRESS.md -->|

## How the work was planned

The lane's success requirements, from its plan: <!-- src: initiatives/bench/PLAN.md -->

| REQ | What it demands |
|---|---|
| REQ-01 | One command runs every fixture-shipping process for one named candidate, reporting schema pass-rate and assertion pass-rate separately, over three runs (K=3) per fixture executed sequentially; re-scoring captured outputs must come back byte-identical, fixture-proven on all three CI operating systems. <!-- src: initiatives/bench/PLAN.md -->|
| REQ-02 | `--propose` emits three artifacts — a human evidence table, a machine-readable manifest, and a stable diff pinned to the exact router SHA the run read — and any failing gate yields `NO PROPOSAL` with its reason instead of a diff; the router's SHA is asserted unchanged after every run, including one that aborts. <!-- src: initiatives/bench/PLAN.md -->|
| REQ-03 | `--champion` re-runs the champion on two separate axes, quality and cost, with every cost change classified into one of three causes; the baseline is re-pinned only for an enumerated cause, never for a score movement alone. <!-- src: initiatives/bench/PLAN.md; ADR-0908 -->|
| REQ-04 | Money is reserved before a fixture group starts, against both a whole-run cap and a per-process cap, and a group the remaining budget cannot cover is never started at all. <!-- src: initiatives/bench/PLAN.md; ADR-0909 -->|
| REQ-05 | The whole loop is proven once on a real model: reached, benched, proposed, and taken to a recorded human accept or reject through `arc-inbox`, with both outcomes counting as success. <!-- src: initiatives/bench/PLAN.md; ADR-0914 -->|
| REQ-06 | `commit-msg-draft` ships 5 real, assertion-bearing fixtures under a closed set of checks, enough to actually tell a candidate apart from a champion; a fixture with no assertions counts as absent, never as a pass. <!-- src: initiatives/bench/PLAN.md -->|
| REQ-08 | The runner survives hostile input and two planted mutants — one that tries to write the router directly, one that tries to spawn a driver outside the policy gate — and the suite rejects both, each for a reason traceable to the specific guard that caught it. <!-- src: initiatives/bench/PLAN.md -->|

The appetite was set at eight days, a hard cap raised from the design source's original four
because kickoff verification found the lane's prerequisites did not exist yet and the missing road
itself became part of the scope. <!-- src: initiatives/bench/PLAN.md; ADR-0900 -->

## The phases, one by one

| Phase | Set out to prove | What shipped, and what it cost |
|---|---|---|
| 0 — the road + steel thread | `drivers/mock`, a `version` verb, the assertion schema, a fixture-repo harness, `commit-msg-draft` armed, one fixture end to end | Closed 2026-08-13: `commit-msg-draft` ended up armed with six fixtures rather than the five planned, each carrying real assertions; a fixture with no assertions key scores as absent, never as a pass; and four separate defects were found in the engine's own runner by running it, reported rather than fixed here, since `arc-run.mjs` is a one-line-only path for this lane. <!-- src: initiatives/bench/PROGRESS.md -->|
| 1 — bench core | a full run across every fixture-shipping process, K=3 kept separate, admission control against both spend caps, a replay-proof scorecard | Closed 2026-08-13: replayed captured outputs came back byte-identical on all three CI operating systems, on top of a canonical encoder that refuses to hash values like `NaN` or `±Infinity` rather than silently coercing them. <!-- src: initiatives/bench/PLAN.md; ADR-0907; initiatives/bench/PROGRESS.md -->|
| 4 — seal + retro | a mutant that attempts to write the router directly, a mutant that spawns a driver outside the policy gate, a redaction sweep, a runbook | Closed 2026-08-13: the real work of this phase was the adversarial pass itself, which returned twenty-three confirmed holes from two fresh adversarial surfaces with almost no overlap between them — among them a bug that let one run overspend its cap 2.16 times over, and a drift guard that reported no drift on a run where every attempt had failed. <!-- src: initiatives/bench/PLAN.md; initiatives/bench/PROGRESS.md -->|

## What it decided

The lane holds ADR century 0900–0999, locked at ADR-0900 through ADR-0914: <!-- src: initiatives/bench/PROGRESS.md -->

| # | Decision |
|---|---|
| 0900 | The owner's build-out ruling is what fires this lane, superseding the earlier plan to wait for a pull trigger. <!-- src: ADR-0900 -->|
| 0901 | Bench's command line is a flat script; whether arc ever gets a `noun verb` dispatcher is left as the engine lane's question. <!-- src: ADR-0901 -->|
| 0902 | Bench builds the replay test driver and its version verb itself, amending an earlier no-go. <!-- src: ADR-0902 -->|
| 0903 | A run's driver identity is recorded beside the existing fingerprint, never folded inside it. <!-- src: ADR-0903 -->|
| 0904 | Cost eligibility is decided with no pricing snapshot: a ceiling bounds spend without ever claiming to report a true price. <!-- src: ADR-0904 -->|
| 0905 | Quality is defined as assertion pass-rate, and this cycle builds the substrate for exactly one task class. <!-- src: ADR-0905 -->|
| 0906 | Candidate selection is gates-first, with no single composite score standing in for the evidence. <!-- src: ADR-0906 -->|
| 0907 | A run keeps a per-fixture record, plus up to three proposal artifacts — a class at `NO PROPOSAL` gets only the first two and no diff. <!-- src: ADR-0907 -->|
| 0908 | Drift is measured on two separate comparability axes, in three alert tiers, with a floor set per task class. <!-- src: ADR-0908 -->|
| 0909 | Budget is admission control at the fixture-group level, and execution stays sequential in this version. <!-- src: ADR-0909 -->|
| 0910 | The drift guard runs monthly and only when the owner starts it; a clean run leaves no open approval behind. <!-- src: ADR-0910 -->|
| 0911 | Bench rides the spine's existing event kinds only, and adds none of its own. <!-- src: ADR-0911 -->|
| 0912 | Bench adds no new policy subject, and must never become a way around the policy gate. <!-- src: ADR-0912 -->|
| 0913 | Reproducibility means replay-determinism, with variance reported honestly rather than hidden. <!-- src: ADR-0913 -->|
| 0914 | The real event's candidate is a second model run under an already-proven driver, not an unproven one. <!-- src: ADR-0914 -->|

## Where it stands now

The tracker reads status live, on phase 04, having burned seven and a quarter of its eight-day
appetite. <!-- src: fact:lanes/bench.status; fact:lanes/bench.phase; fact:lanes/bench.burn; fact:lanes/bench.appetite -->

Four of the five phases are fully closed; the drift guard is built, and the real event is the one
piece left. By 2026-08-17 it was buildable and simply not started — waiting only on money and an
owner keystroke. By 2026-09-15 it was blocked again, from outside the lane: engine's hermes row
had expired, and since then every run naming a model on a model-capable driver has thrown an error
before ever reaching a provider, with the owner having deferred the hire decision. <!-- src: initiatives/bench/PROGRESS.md -->

Bench's production `run.completed` count, read directly off the canonical spine, was zero at its
close, across all 17 day files — every run this cycle used a throwaway spine root instead, and
that absence was written down rather than left to be assumed. <!-- src: initiatives/bench/PROGRESS.md -->

## The bigger loop

### What went wrong and what was learned

### How it connects to the rest of arc

Bench reads the engine lane's process files, its fixture packs, and `engine/router.yaml`, but
never writes to that file itself — every routing change it produces is a diff a human merges by
hand, and every run it makes still travels through the engine's own policy gate rather than around
it. <!-- src: initiatives/bench/PLAN.md; ADR-0912 -->

Its runs and its proposals land on the same append-only spine every other lane writes to, as
ordinary `run.completed`, `approval.requested` and `decision.recorded` receipts, which is also how
the owner reviews and answers a proposal through the existing inbox rather than through anything
bench built for itself. <!-- src: ADR-0911 -->

## Glossary

- **bench** — the runner that tests one named model against a process's fixtures and can only
  propose a routing change, never make one. <!-- src: initiatives/bench/PLAN.md -->
- **champion** — the model a candidate is measured against in the eligibility gates, and the one
  `--champion` re-runs to check for drift. <!-- src: ADR-0906; ADR-0908 -->
- **candidate** — the model under test, named explicitly, never swept or guessed. <!-- src: initiatives/bench/PLAN.md -->
- **driver** — a script that takes a process, JSON input and a budget and returns output JSON plus
  a cost sidecar (`drivers/NAME.sh run PROCESS INPUT-JSON BUDGET`); bench may add only the mock
  replay driver and a version verb, never a new provider integration.
  <!-- src: initiatives/bench/PLAN.md; ADR-0902 -->
- **propose-only** — bench's rule that it may only emit a reviewable diff, never merge one. <!-- src: initiatives/bench/PLAN.md -->
- **mock driver** — the replay driver, built by bench in phase 0, that bench's own tests run
  against at zero cost. <!-- src: ADR-0902; initiatives/bench/PROGRESS.md -->
