# Phase 00 — every reader of `model_source` (attack finding F6)

`git grep -ln model_source -- .claude tests face` on 2026-10-05 → **12 files**. Each was opened.

| File | What it does with `model_source` | `profile` |
|---|---|---|
| `.claude/scripts/engine/arc-run.mjs` | writes it (this change adds `profile`) | handled |
| `.claude/scripts/engine/arc-bench.mjs` | writes its own receipt `trial`/`none` (`:1787`) | indifferent — bench names its driver, so no tier, so no profile |
| `.claude/scripts/engine/narrative-verify.mjs` | writes its own verifier receipt `trial`/`mock` (`:344`) | indifferent — not routed |
| `.claude/scripts/docs/narrative-anchors.mjs` | accepts a VERIFIER receipt only if `trial`/`router` (`:443`) | indifferent — reads narrative-verify's own receipts, never an arc-run routed one |
| `.claude/scripts/engine/arc-attack.mjs` | comments: logic surface is `trial` | indifferent — named driver |
| `.claude/scripts/engine/drivers/hermes.mjs` | runtime-reported source | indifferent — not generic-api |
| `.claude/commands/arc-attack.md` | prose | indifferent |
| `tests/bench-steel-probe.mjs` | asserts bench runs are `none` | indifferent — bench names its driver |
| `tests/engine-model-seam.bats` | asserts `none` / `trial` on named-driver runs | unchanged, no edit (non-negotiable) |
| `tests/engine-hermes-secrets.bats` | hermes runtime source | indifferent |
| `tests/fixtures/engine/hermes/fake-docker.mjs` | fixture | indifferent |
| `tests/fixtures/face/gen-spine.mjs` | fixture spine generator | indifferent |

No reader fails closed on an unknown value. The spine does not constrain `model_source`, and `run.completed`'s payload
is open (`validate.mjs` closes only `cost` and the envelope), so `profile` and `gateway_host` validate as they are.
