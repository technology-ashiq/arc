---
description: Turn an approved phase into small, spec-anchored, independently proven increments — start, next, status, checkpoint, handoff.
---

# /arc-develop `<mode>` [phase] [--lane NAME]

The execution harness. `plan` owns intent, `review`/`qa` own the audit; this owns the stretch
between them. **You write the code** — develop supplies context, discipline, checkpoints and
evidence. There is no coder subagent, ever.

Modes: `start <n>` · `next` · `status` · `checkpoint` · `handoff <n>`

> **Router:** a new build or milestone → `/arc-kickoff`. A mid-build idea or scope change →
> `/arc-change`. Closing a phase → `/arc-phase-done`. develop never does those three jobs.

## Lane first (`.claude/rules/lanes.md`)

`--lane NAME` is the ONLY way to name a lane. The mode and the phase number are this command's
own arguments and are never read as a lane. The script resolves the lane itself, via the shared
resolver — exit `3` ambiguous, `4` unknown lane, `5` invalid name. On a non-zero exit, print what
it printed and STOP; never improvise a lane, and never create one.

Lane-mode prints `Selected lane:` first, then the PORTFOLIO board summary, then the report below.
Root-mode prints no lane line at all — that is the permanent contract for venture repos.

## Run it

```bash
node .claude/scripts/develop/develop.mjs <mode> [phase] [--lane NAME]
```

The script owns the verdict and the receipt (ADR-0047). Print its output as-is — do not
paraphrase it, and do not re-derive any number it computed.

## The slice loop — what you do between `next` and `next`

`next` hands you one slice. For that slice, in this order:

1. **Micro-plan, 2-3 lines.** Ask the standing questions every time: is there a simpler solution ·
   can this reuse existing code · does this need to exist at all? (A question about whether a REQ
   itself should exist goes to `/arc-change`, not here.)
2. **Declare the acceptance proof BEFORE writing code.** Fill the slice's `proof:` and `tier:`.
   Tiers, weakest to strongest: `static` · `unit` · `contract` · `integration` · `e2e-visual` ·
   `verified-real`. **`proof: none` is not a slice** — if you cannot say how it will be proven,
   it is not ready to build.
3. **Implement it.** You, in this session — anchored to the plan context that makes it correct.
4. **Run the proof and paste the real output** into `result:`. Evidence over assertion; never
   describe a passing test you did not run.
5. **Commit the slice locally** and put the SHA in `commit:`. develop never runs git for you
   (ADR-0102) — push cadence stays yours.
6. **`next` again.** It emits the `slice.done` receipt for what you just proved, then hands you
   the next one.

## Rules that hold even when the schedule slips

- Every number is computed by a tool or earned from a scored outcome. A confidence score the model
  invents about itself is not evidence — the lint rejects it in ledger rows.
- Intentional shortcuts get a debt-ledger row: what · where · why accepted · cost of leaving it ·
  pay-down trigger. An unrecorded shortcut is forgotten forever.
- Any gate, lint or parser you build here gets an adversarial construct-a-breaking-input pass in
  the same change that ships it — not at phase close, where it gets skipped.
- develop never modifies its own policies, gates or skills without a recorded, approved promotion.

## At handoff

`handoff <n>` scores the Build Brief's predictions against what actually happened, runs the
`spec-fidelity` pass (fresh context, spec + diff only), and assembles the evidence pack for
`/arc-phase-done`. **develop never closes a phase** — it hands over the evidence and stops.
