# PLANOFF-02 — the handoff bench

**Status: DESIGNED & seal-ready (2026-07-14). NOT yet run.** This directory is the pre-registered
design for the second planner bench. Nothing here has been executed — the score table in
`RESULTS.md` is empty and the prediction is written *before* any run, on purpose.

## The one question 02 answers that 01 could not

PLANOFF-01 found that at single-context scope, **planning ceremony had no measurable effect on
correctness** — all five arms (arc, raw, gsd, gstack, superpowers) shipped a perfect app, *raw with
no plan included*, in half the tokens. Planning's real payoff — resumability, handoff, legibility —
was **unpriced**, because one agent finished one app in one context and nobody ever collected on it.

**02 forces the collection.** It splits the build across a **hard agent boundary**:

- **Phase 1** = `snip` (the URL shortener), already built and frozen acceptance-green (15/15).
- **cold handoff** — the Phase-1 builder session is destroyed; only the committed repo crosses.
- **Phase 2** = a `team links` (workspace) extension, built by a continuation agent that sees
  **only the frozen repo** — no transcript, no memory, an empty database rebuilt from committed
  migrations. The extension deliberately reuses every Phase-1 seam, so an agent that never
  understood those seams corrupts them in ways only the cross-phase acceptance run reveals.

Each arm's continuation runs **twice**: (a) a **blind raw stranger** — isolates *what each arm left
committed*; and (b) a **same-family agent with its native toolchain and hooks live** — finally
exercises arc's real moat (a PreToolUse block on a bad ship), which 01 never fired. Both numbers are
reported separately.

## Why it's fair (and can make arc lose)

Scoring is **outcome-only and medium-agnostic**: clean code, a commit message, or a typed schema
count *exactly* as much as a `PLAN.md`. Every scored question is "was the fact in the repo and did
the outsider get it right", never "was there a planning document". Transfer dimensions are **capped
at ~40%**; the two signals that actually discriminated in 01 — review-caught unspecified defects
(D5) and token cost (D6) — carry ~38%. Artifact honesty is a **penalty multiplier ≤ 1.0**, never a
reward. Repos are **neutralized before blind scoring**. The prediction below expects **raw to tie or
win** — arc winning would be a genuine finding, not the default.

> Bench motto (inherited from 01): *"arc losing is a successful bench. The failure mode isn't arc
> losing — it's running a bench rigged so arc can't."*

## Files

| File | What |
|---|---|
| `goal.md` | The frozen Phase-2 goal — pasted verbatim into every continuation. |
| `protocol.md` | Delta vs PLANOFF-01 (the handoff mechanic, dual continuation, pre-registration). Inherits 01's fairness rules. |
| `traps.md` | 🔒 **SEALED** — 8 planted traps (4 plan-catchable, 4 review/test-cheapest). Do not open until every arm has run. |
| `scoring/rubric.md` | 7 dimensions summing to 100 + the honesty multiplier + blinding rule. |
| `acceptance/spec.md` | What the black-box grader checks (specified probes 1–9 + unspecified 10–20). |
| `RESULTS.md` | Pre-registered prediction (sealed) + empty score table + verdict (to be written after the run). |

## Prerequisites before this can run  ⚠️

1. **Frozen Phase-1 repos built with REAL toolchains + Postgres.** PLANOFF-01**A** (the variant that
   actually ran) used `node:sqlite` and methods-as-prompts, so its frozen repos do not satisfy 02's
   Postgres/real-toolchain requirement. Phase 1 must be re-run "proper" (real `/arc-kickoff`, real
   `/gsd-*`, etc., against Postgres) and re-frozen 15/15 for each arm — *then* 02's handoff runs on
   those repos.
2. **The acceptance grader is a spec, not yet code.** `acceptance/spec.md` defines every probe;
   the `acceptance/*.mjs` implementation (adapt 01's harness) is the next build.
3. **Seal + hash + attest.** Per the protocol, `goal.md`, `traps.md`, and `RESULTS.md § Prediction`
   are hashed and sealed *before* any frozen repo is opened, with an auditor attesting the trap
   author never inspected the arms' repos pre-seal.

## Provenance

Designed 2026-07-14 by a 7-agent workflow: recon of PLANOFF-01 → parallel design (goal candidates ·
traps · scoring) → an adversarial **rig-check** ("can this flatter arc? can raw still tie?") → a
synthesis that applied **all ten** rig-check fixes (F1–F10). One deliberate deviation: the judge
favored a fresh `depot` build; synthesis chose `team links` extending the **already-frozen snip**
because it reuses 01's real output as Phase 1 — a truer handoff test with no new Phase-1 build. See
`RESULTS.md` for the honest prediction (it expects arc *not* to win).
