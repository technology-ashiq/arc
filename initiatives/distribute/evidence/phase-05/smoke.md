# distribute Phase 05 — the live smoke and the 50% tripwire

**Tripwire question:** did one wrapped OpenCode run of the rendered `arc-commit` land one `commit.done` stamped
`harness: opencode`, found by id on the main clone's spine, for ≤ $0.10? **YES** (run 4, 2026-10-13).

## The receipt

```
id        01M4S4V92YACPXF1V08XXWR04B
kind      commit.done
model     openrouter/deepseek/deepseek-v4-flash-0731
evidence  initiatives/distribute/evidence/phase-05/transcripts/smoke-arc-commit-4.jsonl
payload   {"harness":"opencode","sha":"cfddacdc","subject":"docs: correct Cycle 1 PROGRESS owner items in archive"}
ts        2026-10-13T04:18:31+05:30
```

Found with `grep -h 01M4S4V92YACPXF1V08XXWR04B .claude/state/hq/events/*.jsonl` in `E:/Work_Hub/01_Automemory/arc`
(the main clone). `events/_quarantine/` holds `2026-10-01.jsonl`, `2026-10-07.jsonl`, `2026-10-09.jsonl` and no file
for 2026-10-12/13; 0 lines in it mention `opencode`.

The model wrote neither `harness` nor `evidence`: the payload it typed was `{"sha","subject"}`, and `arc-event.mjs`
stamped the rest from the wrapper's environment (ADR-2020). The commit `cfddacdc` is on
`feat/distribute-c2-oc-session` in `E:/Work_Hub/01_Automemory/wt-oc-req03`; it is the session's own change (A-11).

## Spend

Run 4: `spent=0.001930096` — parent $0.000821, subagent `ses_ecdb2b638ffet1AcaWaXkqiCMJ` $0.001109 (4 steps), read
through `opencode export` (ADR-2022). Cycle ledger after run 4: **$0.0351 of $0.50**, which charges each of the three
unwrapped probes its full $0.01. probe-deny's subagent ($0.00045, measured by export) predates subagent charging and is
inside that margin.

## The four runs and three probes

| Transcript | Result | What it taught |
|---|---|---|
| smoke-arc-commit | CHILD-FAILED, $0 | OpenCode ran in the wrong checkout: it reads its project from an inherited `PWD`. Fixed: the wrapper sets `PWD` (fixed-defects cd). |
| smoke-arc-commit-2 | TIMEOUT 900 s, $0 | `git branch --show-current` hit the fence's `ask` and the headless run waited forever. |
| probe-ask-auto / -primary / -server / -unwrapped-* | — | `--auto` approves every ask under a primary agent and does not reach a subagent; `--port` and `OPENCODE_PERMISSION` change nothing. |
| smoke-arc-commit-3 | TIMEOUT 900 s, $0 | Without `--auto` the subagent's ask still hangs. |
| probe-deny | ok, 18 s | With `"*": deny` the call is refused at once and the run finishes; the subagent's cost is not in the stream. |
| smoke-arc-commit-4 | **ok, $0.0019** | Deny fences (ADR-2022) and subagent charging: the receipt above. |
