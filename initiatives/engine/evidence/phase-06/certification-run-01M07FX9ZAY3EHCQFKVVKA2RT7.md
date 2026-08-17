# Phase 06 — the first REAL dispatch receipted on the canonical spine, 2026-08-17

Run from the **main clone** (`E:/Work_Hub/01_Automemory/arc`) at `4cc73fd`, after PR #194 merged.
Human-started. This is the run the previous attempt could not be: a worktree has its own gitignored
spine and `arc-event` refuses it by design, so the receipt had nowhere real to land.

## The receipt

```
id       01M07FX9ZAY3EHCQFKVVKA2RT7
kind     run.completed
process  commit-msg-draft@1.0.0
outcome  fail        (reason: driver)
driver   hermes
```

**Verified present in `.claude/state/hq/events/2026-08-17.jsonl` and ABSENT from `_quarantine/`**,
by grepping the landed file for the ULID in both places — not by reading the emitter's exit code,
which is the check this cycle has twice recorded as insufficient.

The scrubbed transcript was stored at
`initiatives/engine/evidence/phase-06/transcripts/`, which is REQ-03's storage half running for the
first time on a real dispatch.

## What the run proves

- The container-backed runtime starts, runs and exits on its own, from the main clone, with every
  2026-08-17 change in the invocation.
- **The ADR-0222 private workspace ran**: `hermes: workspace is a PRIVATE copy of … at …-ws-…`.
- **The egress mode is on the trail**: `hermes: egress mode UNCONFINED — no network configured,
  the runtime reaches any host`. Unconfined is correct here and is stated rather than implied — the
  model is local `ollama` behind `host.docker.internal`, which an `--internal` network cannot reach
  by construction. The confined arm needs the hosted-model path and therefore the capped key.
- The receipt is on the append-only spine and is not quarantined.

## THE DEFECT IT FOUND, which no fixture could have

The landed receipt read **`runtime: undefined`, `model_source: none`**.

ADR-0221's criterion is that `run.completed` carries the runtime identity in its own `runtime`
payload field. It did not, and the reason is a clean chain:

1. `cost` was constructed only **inside** the usage-report block in `drivers/hermes`.
2. `arc-run` reads the runtime identity off the **cost sidecar**.
3. The vendor's `--usage-file` is pinned as a **no-op** — it has never written a report on this
   image, which `tests/engine-usage-flag-probe.mjs` exists to pin.

So the one field naming *which contractor ran* was absent from every real receipt, while
**every fixture test passed** — because they all PLANT a usage report. The suite proved the enriched
path; nothing proved the ordinary one, and the ordinary one is every real run.

**Fixed**: the identity needs no report to be known. `versionString()` is the pinned image digest
plus the config hash, computed offline, so it now rides every receipt. No cost is manufactured
alongside it — `common.mjs`'s `writeCost` already writes `runtime` independently of any figure, and
an empty cost record still gets no `source`. Verified end to end: the receipt now carries
`runtime: hermes@sha256:16788311e2fa+cfg.9c642d0847ca` with `cost: null`.

Pinned by `engine-hermes-secrets.bats`, which asserts both halves — the identity is present **and**
the spend stays absent (ADR-0069 b5).

## The answer was wrong again, and the record is now three for three

```
hermes: no line of the runtime output parsed as a JSON object or array
        (last lines: To provide better assistance, I need to unde…)
```

The model answered in prose. Counting the earlier sessions: **1 of 5** correct on 2026-08-16 before
the config fix, **0 of 1** after it, **0 of 1** today. An 8B local model does not produce a real arc
process's schema, and this is now measured rather than suspected.

That is a REQ-07 fact, not a REQ-02 one. Certification asks whether the boundary holds; the boundary
held on every arm this run touched. Whether the hire can do the job is Phase 08's question, and
`runtime-answer-reliability.md` already names the answer: dispatch against a hosted model.
