# Runbook — `bench`, the model market

The command form is a flat script (ADR-0901). There is no `arc engine bench`; there is no `arc`
binary at all, and inventing one is engine's question, not this lane's.

```bash
node .claude/scripts/engine/arc-bench.mjs --driver DRIVER --budget inr=N,min=M [--model ID] [--out DIR]
```

Run it **from the main clone**, never from a linked worktree: `.claude/state/` is gitignored, so a
worktree has its own spine and an event written there is valid, real and invisible to every reader
— including `arc-inbox`, which would print "no open approvals" while one sat there.

---

## The closed flag set

| Flag | Meaning |
|---|---|
| `--driver NAME` | **required.** The driver to bench. `mock` replays pinned bytes at ₹0. |
| `--budget inr=N,min=M` | **required.** `inr` is a ceiling passed down; `min` is wall-clock and genuinely decrements. Only these two dimensions exist — `--budget rupees=1` is refused, because a bound nothing reads is not a bound. |
| `--model ID` | Records the candidate model **requested**. See the warning below: it is not applied. |
| `--out DIR` | Where the scorecard, the provenance and the capture bundle are written. Required for `--propose`. |
| `--replay DIR` | Re-score a capture bundle. Invokes nothing, spends nothing, emits nothing. |
| `--champion DIR` | A previous run's `--out` directory. **Alone → the drift guard. With `--propose` → a routing proposal.** |
| `--propose` | Write the three proposal artifacts and request approval. Needs `--champion` and `--out`. |
| `--dry-run` | Print the plan. Invokes nothing, emits nothing. |

Anything else is **exit 2**, naming the flag.

### Exit codes

| Code | Meaning |
|---|---|
| `0` | The run completed and every selected fixture was scored. |
| `1` | Partial: an attempt was not scored, a group was refused for budget, a replay **mismatched**, the router changed, or an attempt left no `arc-run` receipt. |
| `2` | Operator error: a bad flag, an unknown driver, an unreadable fixture, a malformed ceiling file. |
| `3` | **Stale-format**: the stored scorecard was written by a different normalizer. Not a mismatch — a normalizer bump invalidates every stored scorecard by construction. |

---

## ⚠ `--model` does not reach the driver, and the report says so

`arc-run` rebuilds the driver's environment (`arc-run.mjs:378-381`) and overwrites
`ARC_DRIVER_MODEL` with `pinnedModel ?? ""`. With an explicit `--driver` there is no tier, so
`pinnedModel` is null and the driver is handed the empty string. **A model can only be pinned
through `--driver auto` plus a `classes.NAME` row in `engine/router.yaml`**, and that file is
do-not-touch for this lane, permanently.

So every report reads `applied: NONE`, `subject.model_id` is an **absent key**, and
`request_settings` is absent too — bench has no channel to set temperature either. This is
measured, not assumed (`tests/bench-steel-probe.mjs`), and it is why Phase 03's real-model half
is blocked on an **engine** change rather than a bench one.

The same rebuild overwrites `ARC_ROOT`, so the fixture-repo harness **cannot reach a real driver**
either. `commit-msg-draft` holds `git.op: add:*` and `commit:*` — a real driver run today would
stage and commit **inside the arc repo**. Use `--driver mock` until that seam exists.

---

## The monthly drift guard

**Cadence: monthly, first working day, owner-started** (ADR-0910). Nothing schedules it; a guard
that ran itself would be a guard nobody notices has stopped.

```bash
cd /path/to/the/main/clone
node .claude/scripts/engine/arc-bench.mjs --driver mock --budget inr=500,min=30 \
  --out initiatives/bench/evidence/guard/$(date +%Y-%m) \
  --champion initiatives/bench/evidence/guard/PREVIOUS-MONTH
```

Read the report top to bottom:

- **`quality NOT comparable`** — a driver version, process version, eval-pack revision, model id or
  request setting moved. The quality tiers are **suppressed**, and the baseline becomes a re-pin
  candidate. This is not a bug: the same output change is "the champion drifted" or "you benched a
  different thing", and only this field separates them.
- **`cost NOT comparable`** — a token count or a cost source is absent on one side. Tier 3 is
  suppressed; the quality tiers are unaffected. The two axes fail independently on purpose.
- **`MUTED`** — the class ships fewer than 5 fixtures, so a movement there is noise. This cycle
  that is `review-diff` and `kickoff-plan`. Silence that looks like "no drift" is worse than no
  report, so a muted class is always named.

**The three tiers:**

| Tier | Condition | Consequence |
|---|---|---|
| 1 | A **new** schema failure in a **previously-clean** champion | inbox item (`approval.requested`, gate `drift`) |
| 2 | assertion drop **≥ 10pp** **AND** **≥ 2** fixtures failing — both, never either | inbox item |
| 3 | cost increase **> 20%** | **REPORT-ONLY, never an inbox item** — at any size |

**A clean guard run emits ONLY `run.completed`.** No approval event exists for a no-drift run,
because the spine never carries no-op approvals. The report says so explicitly, so "no approval
appeared" and "the guard did not run" never look the same in a log.

**Record the NEXT-CHECK date in `initiatives/bench/PROGRESS.md`.** Bench prints it and does not
write it: bench is a runner and has no write path to a tracker. Absence is never inferred from
nobody having looked.

### When a baseline may be re-pinned

Exactly two causes, and the list is closed:

1. a quality-compatibility component changed, or
2. a routing change was merged.

**A score movement alone NEVER re-pins.** If it did, a champion that quietly got worse would
become its own new standard and the guard would report no drift forever after — measuring the
thing against itself.

---

## Reading `NO PROPOSAL`

`NO PROPOSAL` is a **first-class result, not an error**, and it always names the gate that
produced it. The gates run in order and the **first** failure is the one reported.

| Reason you will see | Gate | What it means |
|---|---|---|
| `incomplete evidence (N fixture(s) never ran: …)` | 1 completeness | A skip, budget-abort, transport failure or timeout. A **schema** failure does not count — a candidate that reliably breaks the contract is information. |
| `schema regression (−Xpp vs champion)` | 2 | The candidate broke the output contract more often than the incumbent. |
| `schema pass-rate is ABSENT on one side` | 2 | Not a pass — an impossible comparison. |
| `the candidate lost on assertions (−Xpp)` | 3 | It was measured, and it lost by more than the 2pp band. |
| `evidence insufficient (N of 5 fixtures)` | 4 | Too few **declared** fixtures. **Different from losing.** Strengthen the owning process's eval pack — never bench. |
| `evidence insufficient (N declared but only M of 5 could be posed)` | 4 | Declared enough, but some declare no `repo_state`. |
| `cost is reported on one side only` | 5 | Not comparable. Two absences **are** comparable; the cost tiebreak simply does not run. |
| `eval-pack revision differs` | 6 | The two ran different exams. |

A class at `NO PROPOSAL` produces the evidence table and the manifest **and no diff at all** —
never an empty or commented-out one, which would read as a proposal that happens to be blank.

---

## Proposing a routing change

```bash
node .claude/scripts/engine/arc-bench.mjs --driver CANDIDATE --budget inr=500,min=30 \
  --out DIR --propose --champion PREVIOUS-DIR
```

Three artifacts land in `DIR/proposal/`:

1. `evidence.md` — the human table. **This is the interface.**
2. `manifest.json` — machine-readable; a later reader consumes this, never the prose.
3. `CLASS.router.diff` — a stable unified diff **pinned to the router SHA the run read**, with no
   timestamp anywhere in the body.

**Bench has no write path to `engine/router.yaml`, ever.** The SHA is asserted unchanged after
every run including aborts, and it is **re-read at proposal-emit**: if the router moved mid-run,
the run aborts with its own reason and writes **no diff**, rather than handing a reviewer a patch
for a file that no longer exists in that form.

Applying the diff is a human editing the router in a reviewed commit citing ADR-0069. Approve or
reject the request from the **main clone**:

```bash
cd /path/to/the/main/clone
bash .claude/scripts/hq/arc-inbox.sh approve ULID --reason "..."   # or: reject
```

---

## Replay: re-checking a number without spending anything

```bash
node .claude/scripts/engine/arc-bench.mjs --replay DIR            # the bundle root
node .claude/scripts/engine/arc-bench.mjs --replay DIR/capture    # or the capture dir
```

Either path works, deliberately: a live run writes captures to `<out>/capture/` and its scorecard
to `<out>/`, so pointing `--replay` at the only directory that holds the attempts could never find
the baseline beside them. It looked in one place and the comparison was skipped on every honestly
produced bundle.

Re-scoring the captured bytes produces a **byte-identical** scorecard. That is what makes a
disputed figure re-checkable for free. It works because the scorecard is a function of the
captured bytes alone — timings, costs, temp paths and the router SHA live in `provenance.json`,
which replay is not expected to reproduce.

- `MATCHES byte for byte` → **exit 0**.
- `MISMATCH` → **exit 1**. Something changed that should not have.
- `STALE-FORMAT` → **exit 3**. The normalizer moved; re-score the champion before comparing.
- **no `scorecard.json` to compare against** → **exit 2**. *"I could not compare"* does not share
  an exit code with *"it matched"* — otherwise deleting one file converts a detected mismatch into
  a pass.
- **the bundle holds no captured attempts** → **exit 2**. An empty directory is not a passing
  replay.

A capture bundle is also **validated before it is believed**: attempt files must be exactly
`0.json … n-1.json`, with no gaps, duplicates or leading zeros (`00.json` sorted to rank 0 as a
distinct file and silently made K=4), and a record claiming `schema: true` on an attempt that
produced no output is refused outright.

---

## When something goes wrong

| Symptom | Cause | Fix |
|---|---|---|
| `refusing to use the spine inside a linked git worktree` | You ran it from a worktree. | `cd` to the main clone. |
| `NO receipt was sealed` | The emitter refused. | Read its stderr; the receipt is **not** written and the run is not clean, whatever it scored. |
| `receipt … was QUARANTINED` | The payload failed spine validation. | Quarantine is **not** enforcement success (ADR-0032). Read `events/_quarantine/`. |
| `no ceiling is declared for this driver and model` | `initiatives/bench/ceilings.json` has no row for the pair. | Add one, hand-authored, with the `as_of` date. A missing ceiling is a refusal, never a default. |
| `N attempt(s) left NO arc-run receipt` | Something bypassed `arc-run` (M1). | Every attempt goes through `arc-run` — a direct driver spawn has no run-level budget remainder, no receipt and no retry ladder. |
| `the router SHA CHANGED across this run` | Something wrote `engine/router.yaml` mid-run. | The run is not evidence of anything. Find the writer. |
| `--budget has no dimension …` | A typo like `inrr=10`. | Only `inr` and `min` exist. |
