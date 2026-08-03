# Phase 03 — the real runs

## What REQ-08 asked for, and what happened

> `commit-msg-draft` runs via `arc-run` on a **non-`claude-code`** driver **≥3 times on real
> work**, each rated trivial/typical/hard, with `run.completed` receipts confirmed present in
> `events/` and absent from `_quarantine/`.

**That criterion is NOT MET, and it is not close.** No non-Claude driver exists on this
machine: `codex` is not installed, and `ARC_LLM_ENDPOINT` / `ARC_LLM_API_KEY` /
`ARC_LLM_MODEL` are unset. The phase spec anticipated exactly this and said what to do:

> *"At least one non-`claude-code` driver must be genuinely runnable for this phase to mean
> anything; if none is, that is a blocking finding to report, not a phase to close."*

So it is reported as a blocking finding. **The cycle's central claim — that a process runs
on more than one model family with identical contract compliance — remains UNPROVEN.**
Everything below is the substitute that was actually available, and it is labelled as such.

## What was run instead: 2 real runs on `claude-code`

Real work, real CLI, real tokens — a genuine end-to-end exercise of `arc-run`, just not of
model-agnosticism.

| # | Budget | Outcome | Rating | What it showed |
|---|---|---|---|---|
| 0 | `min=4` | **stopped** | — | The wall-clock budget **killed a live subprocess**. REQ-05 enforcement proven outside a fixture. |
| 1 | `min=12` | **failed** | hard | The model answered with a ` ```json ` fence; `JSON.parse` died. **A real bug no fixture caught.** |
| 2 | `min=12` | **succeeded** | typical | Produced a valid commit message for a real repo change, schema-clean, receipt sealed. |

Run 2's output, unedited:

```json
{"commits":[{"sha":"76e846fdc7ad762e4d2fb4dabfcbc38f0e285a08",
             "subject":"docs: record the 2026-08-03 session-log entry from the exit hook"}]}
```

## The finding that justifies this phase existing

**Run 1 failed on something twenty green fixture tests could not see.** Every fake returned
bare JSON; a live model returned a fenced code block. The suite was green against an input
shape real models do not reliably produce.

That is the entire argument for dogfooding, demonstrated on the first attempt: *the first
thing tested outside its own fixtures broke immediately.* All three drivers now parse
tolerantly (`parseModelJson`), with the tolerant-detection / strict-grammar split the ledger
parsers already use.

Run 0 is the second-most useful result: a budget killing a real subprocess is the only way to
know the bound is real, and it is what exposed that the kill did not reach a **grandchild**
process — found by the adversarial pass immediately afterwards.

## Honest reading

Two runs is not three, one of the two failed, and both were on the driver whose
interchangeability was never in question. Reporting this as "the engine has been used for
real" would be the fourth-fixture-wearing-a-costume this phase spec warns about.

What IS supported: `arc-run` works end to end on real work, budgets bite, receipts seal, and
the schema gate catches a real model's real mistake.

What is NOT supported: any claim about running on a second model family.

## What would close it

One of: `codex` installed, or a funded LLM endpoint with `ARC_LLM_ENDPOINT` /
`ARC_LLM_API_KEY` / `ARC_LLM_MODEL` exported. Then three runs of `commit-msg-draft` on that
driver, rated, with receipts verified. Carried as the lane's first retro input.
