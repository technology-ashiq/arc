# Handoff — discover Cycle 1, next session (written 2026-10-06)

Start with: `/arc-resume --lane discover`, then read this file.

## State
- **Merged to main:** birth #343 (`8d296874`) and Phases 01–03 #350 (`e959e0b1`). Both read 19/19 green per job.
- **This branch, `feat/discover-close`** (pushed, NO PR yet): the phase-01/02 evidence READMEs plus tracker and board rows at day 1. Open its PR together with the `/arc-phase-done` commits, so that everything goes through ONE CI run.
- **Canonical spine (main clone `E:/Work_Hub/01_Automemory/arc`):**
  - `kickoff.done` `01M47ZCQMHWB54E808DEZXGJH6`
  - ruling `approval.requested` `01M47ZCQW6XF5ZEWF4QGS1XFRH`, **OPEN** and waiting on the owner's stamp
  - live mini-hunt "invoice reminders": 45 `idea.captured`, `run.completed` `01M48H6KPAVQQZ5PGJKHVM1FTC` (hunt) and `01M48H6ZJMKB0A8B0320E5J0KP` (judge), 0 quarantined
  - the hunt's artifacts are in `.claude/state/discover/mini-hunt-2026-10-06/` in the main clone

## Owed, in order
1. **The owner stamps the ruling:** `node .claude/scripts/hq/arc-inbox.mjs approve 01M47ZCQW6XF5ZEWF4QGS1XFRH --reason "..."`. Confirm the `decision.recorded` id lands in `events/`, then run `/arc-phase-done 00 --lane discover` and `/arc-phase-done 01 --lane discover` from the main clone.
2. **Phase 02 live half:** this is a PAID council run. Ask the owner ONCE for the spend amount, and never run it unasked. Then `node .claude/scripts/discover/arc-discover.mjs judge --in .claude/state/discover/<hunt> --run --driver <name>` gives two `council.verdict`; run `verdicts --in` to join them back. With no OK, the plan says one juror + skeptic, recorded as such.
3. **Phase 03 / REQ-07:** a real hunt on the owner's niche (`hunt --emit`, `score`, `judge`, `propose --emit`). The owner then approves or rejects the request. On approve, run `export --in <dir>`, which writes `products/launch/ventures/<slug>.venture.yaml` + `.hunt.md` and needs a PR. Time it for the <60 min target, with the owner's latency recorded separately. Then the retro.
4. **Face:** paste `handoffs/face-discover-room.md` into the face session (the planned `money/discover` room → live).

## Gotchas this cycle paid for
- Every synced-file edit needs the golden regenerated. Park `.claude/.headroom_wrap_*` first, and the diff must show only your files.
- CI has a Node 18 leg, so `toWellFormed` and newer built-ins are out. No negated `[^a-z]` ranges (portability.bats).
- CLAUDE.md "The other N commands" must match `.claude/commands` minus the 3 generated ones.
- Do not retire a planned face room: face's module reads it.
- A decision emitted through `arc-event` needs `--idem sha256("decision.recorded|"+decides)`. `arc-inbox` does this itself.
- The worktree refuses the spine, so every live run and every close happens from the main clone.
- `arc-attack` logic: deepseek-v4-flash with `ARC_LLM_REASONING=off`. Round 2 on the build failed with no printed cause.
- The CI runner queue is shared and slow (30–70 min). Watch it with `Monitor` + `ci-digest`, never with a foreground sleep.
