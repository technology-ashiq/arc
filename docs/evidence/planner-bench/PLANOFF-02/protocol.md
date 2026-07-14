# PLANOFF-02 — Protocol delta vs PLANOFF-01

PLANOFF-02 inherits **every** PLANOFF-01 fairness rule and changes only what is listed here.

## Inherited verbatim from 01 (unchanged)
- Verbatim goal prompt between `PROMPT` markers; no per-arm rewording.
- Randomized arm order, **written down before the first run**.
- Fresh session per arm, **no memory carry-over** between arms.
- Fixed `continue`-only nudge; one hard cap per session; **don't-fix-its-bugs**.
- Traps **sealed** until the last arm finishes; opened only afterward.
- Blind, letter-mapped rubric scoring on the judgement half.
- Composite is still comparable to 01 (AUTO + BLIND signals), so the two benches can be read
  against each other. A pattern **promotes only if it appears in this second bench too** — 02
  re-tests 01's findings, it does not assume them.

## What changes

### 1. Two-phase build with a sealed **cold handoff** at the phase boundary (the whole point)
01 ran one agent, one app, one context — so resumability/handoff went **unpriced**. 02 splits the
build: Phase 1 (snip) is already frozen acceptance-green for all five arms. At the freeze, the
builder session is **destroyed**; only the committed repo crosses the boundary (no transcript, no
memory, no warm DB). Phase 2 ("team links") is then built by a continuation agent that sees only
the repo. The boundary is the **identical stop point for every arm** — the instant Phase-1
acceptance goes green — so no arm is stopped at an arm-relative "50%".

### 2. Each arm's continuation is run **twice**, under identical conditions
- **(a) Blind stranger** — a fresh **raw** agent (empty `.claude/`, no toolchain, no memory),
  same agent + same prompt for all five arms, given only the frozen repo + Phase-2 goal. This
  isolates the one variable: *what did each arm leave committed.* It is also the honest floor that
  lets **raw win** — if raw's clean code + README carry the stranger as far as arc's PLAN.md does,
  the ceremony is proven to be overhead.
- **(b) Same-family, native toolchain LIVE** — a fresh agent of the *same* system resumes with its
  **full real toolchain and hooks firing** (`/arc-resume` with arc's PreToolUse ship-blocks live,
  `/gsd-resume-work`, gstack, superpowers; raw's "resume" is defined identically as *a fresh raw
  agent reads the repo* — no ceremony credit). **Both numbers are reported.** This is the fix for
  01's blind spot that arc's real moat (deterministic block-a-bad-ship enforcement) never fired.

### 3. Pre-registration is now **mandatory and broader** (hard constraint)
01's single biggest hole was a verdict that could have been retro-fitted. In 02, the Phase-2 goal,
`traps.md`, and `RESULTS.md § Prediction` are **authored, hashed, and sealed BEFORE anyone —
including the trap author — opens any frozen repo.** The hashes are committed now; an auditor
attests the trap author never inspected the arms' repos pre-seal. Pre-registration covers **trap
and extension selection**, not only the prediction.

### 4. Real toolchains, real datastore, real cost
- Products, not methods-as-prompts: probe (b) runs each arm's actual loop with hooks live.
- **Postgres, not SQLite** — the uniqueness/concurrency trap is exercised against a real unique
  index under concurrent load, which 01A's `node:sqlite` never tested.
- **`cost_usd` is captured per continuation** (01 recorded only tokens/wall-clock) and becomes an
  explicitly weighted dimension, so raw's proven efficiency edge can actually move the score.

### 5. Scoring hardened against the "congratulating planners for planning" flaw
- **Outcome-only re-derivation ledger** (F1): a fact is *Recovered* if the continuation agent got
  it right on first use from **any** committed source — clean code, a commit message, a typed
  schema, a README, or a PLAN.md, all equal. No half-credit for prose over code.
- **Transfer dimensions capped** at ~40% combined; the two signals that actually discriminated in
  01 (review-caught unspecified defects + token cost) raised to ~38% combined (F2, F7).
- **Artifact honesty is a penalty multiplier ≤ 1.0**, not a positive bucket (F8) — you cannot earn
  points by writing more true prose, only lose them by writing false prose; lean-but-correct code
  shares the same ceiling.
- **Repos are neutralized before blind scoring** (F6): repacked into an identically named
  directory, planning docs renamed to `NOTES-1.md`/`NOTES-2.md`, arm-identifying headers stripped;
  the blind judge sees only the neutralized tree + the continuation transcript, letter-map applied
  after. The ledger is computed primarily from AUTO first-action-correctness, not live operator
  judgement.
- **Extension chosen by external realism** (F4): "team links" is the obvious next feature a real
  product owner would ask for, confirmed by an independent reviewer who had not seen the frozen
  repos; choosing an extension by *counting how many frozen seams it steps on* is forbidden and the
  rationale was recorded before sealing.
- **Trap suite rebalanced ~1:1** catchable-vs-review-only (F5), with at least one trap whose
  cheapest reliable catch is a written test/probe, so TDD/review arms are credited symmetrically.
