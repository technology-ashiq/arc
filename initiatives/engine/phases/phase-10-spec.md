# Phase 10 — Chain terms, refuse before spend, and real drivers that say what failed

**Goal (one line):** every route declares its attempt, wall and money terms or the router will not load, no hop
starts past them, and each real driver declares the failure classes it can actually observe.
**Appetite:** 1.25 days — blown appetite means cut or kill, never a silent extension.
**Depends on:** phase-09

Serves **REQ-10** and **REQ-11** (PLAN). Decision: **ADR-0228** (items 6, 7, F3, F4).

## Exit criteria (Definition of Done)

- [ ] `router-row.mjs` faults a class row or `default:` whose `max_attempts` / `max_wall_ms` / `max_cost` is absent,
      `null`, empty, non-integer, negative, or (for `max_attempts`) below 1 — every fault reported, file named.
- [ ] `engine/router.yaml`: every row carries the three terms, with the values and the reason written beside them;
      every fixture router under `tests/` (14 files counted at kickoff) carries them too.
- [ ] `nextHop` refuses a hop when attempts would pass `max_attempts`, when elapsed ≥ `max_wall_ms`, or when spend
      so far ≥ `max_cost` — and on any absent prior spend under a finite `max_cost` (F3). A started hop's timeout is
      `min(run remaining, max_wall_ms − elapsed)`.
- [ ] Invariant (c): a breaching hop is refused before its driver starts (counter 0, positive control 1), the
      receipt reads `failure_class: budget` for the refusal, and `nextHop` over the same recorded hops is identical twice.
- [ ] `generic-api` declares `transport` / `provider-unavailable`; `claude-code` and `codex` declare
      `provider-unavailable` (CLI not installed) and `transport` (their own timeout kill), everything else `unknown`;
      `hermes` unchanged (exit 2 → `budget`).
- [ ] `/arc-attack` two surfaces on the branch; findings fixed and pinned (max 2 rounds); CI green per job.
- [ ] tracker updated (PROGRESS.md row ✅ + done-log)

## Verification plan

- **Test command:** `node tests/engine-failure-class.mjs` (sections C and R) plus `tests/engine-router-row.bats`
  term fixtures; CI only.
- **Expected failure first:** a router fixture without the three terms loads clean before the change; after it,
  arc-run exits 2 with `will not load` naming `max_attempts`.
- **Live demo scenario:** one coarse line — a chain with `max_attempts: 1` refuses its first hop; the second driver's
  counter stays 0.
- **Real-system check:** n/a — fakes (local endpoint, fake CLI).
- **Expected evidence:** CI per-job logs; the attack evidence files.

## Rabbit holes in this phase

- Regex-classifying CLI stderr → declare only structural signals; the rest is `unknown` (PLAN rabbit hole 1).
- Estimating a driver's cost so `max_cost` works → no-go.

## Out of scope for this phase

A ledger reader for fallback prices; any tier or provider change.

## Your-setup / pending

None.

## Non-negotiables (verbatim from PLAN)

- ENG-D's driver exit map stays `0` ok, `1` driver-fail, `2` budget-declined; the failure class travels in the cost sidecar and this cycle adds no exit code (ADR-0219, ADR-0228).
- Zero new event kinds; `run.completed` gains payload fields only, its `reason` values are unchanged, and every emit is VERIFIED to have landed in `events/` and not in `_quarantine/`.
- No component changes a model tier at run time; a hop keeps the routed tier, and every routing change is a reviewed `router.yaml` diff citing ADR-0069.
- One module owns the class set and the hop decision; no second copy of the rule exists in arc-run, bench, the face or a driver ("validate one read, compare another" is this lane's recorded twin).
- Every gate ships with a negative control that actually runs and proves the check can fail; the classifier-drop mutant is invariant (d)'s negative control, and a probe asserts it RAN before asserting what it printed.
- An unavailable cost, duration or class stays absent or `unknown` — never estimated, never inferred from a stderr guess (ADR-0069 b5).
- Every gate and parser this cycle ships gets the two-surface adversarial pass (`/arc-attack`: logic and boundary) before its PR merges, carrying this lane's fixed-defect list (`initiatives/engine/fixed-defects.md`).
- Tests run on CI only, read per job; nothing is reported done on local evidence.
- Before editing a shared root organ — `engine/router.yaml`, `docs/adr/`, `tests/`, `.github/` — run `git log origin/main --oneline -5 -- PATH`, and at a merge take the STRONGER version.
- A program embedded in a shell string carries no apostrophes, no single quotes, and — inside double quotes — no backtick and no dollar sign; such a program goes in its own file.
