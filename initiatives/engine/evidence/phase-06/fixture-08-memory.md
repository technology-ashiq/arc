# Phase 06 · fixture 8 — persistent memory OFF: **FAIL, measured**

REQ-02 fixture 8: *"a marker planted in run N is unrecallable in run N+1, proving persistent memory
OFF (ADR-0211)."*

**Result: the property is FALSE.** Not unprovable, not partial — measured, and false.

## The run

Image `nousresearch/hermes-agent@sha256:16788311e2fa3035456bdc1bafb8ec2b1777db64ebf020af9bb7eb73c3712c9e`,
`Hermes Agent v0.20.0 (2026.8.3)`, one mounted data volume, 2026-08-16.

**Run N** — `-z "Remember this marker for later: ZEBRAQUARTZ7741. Just acknowledge you have it."`
Exit 0, 144s. The runtime answered:

> *"I've saved the marker as a memory. I can recall it later if needed. What's the first task you'd like me to assist with?"*

**Run N+1** — a separate `docker run --rm`, same volume — `-z "What was the marker I gave you
earlier? …"`. Exit 0, 56s. The marker string did **not** appear in that run's stdout.

## Why the answer is not the evidence, and the disk is

Stopping at run N+1's answer would have recorded a PASS. It would have been wrong. The marker is on
disk, in the volume arc mounts, in two places:

```
memories/MEMORY.md   ->  ZEBRAQUARTZ7741      (the entire file contents)
state.db             ->  matched by content search
```

So the model did not happen to surface it in one prompt. The **state persists**, which is the
property fixture 8 actually cares about — and precisely the failure this lane keeps recording:
*look at the artifact before carrying the verdict*, and *a pass condition that is only an absence
cannot detect the thing being present*.

Had this been asserted the obvious way — "run N+1's output does not contain the marker" — it would
have passed while being false. The assertion must be **the volume does not contain the marker**.

## Why it matters beyond fixture 8

REQ-06 confines what enters a dispatch: an owner-approved `external-ok` context pack, with the
`internal-only` refusal enforced above the driver at arc-run exit 5. That confinement assumes a
dispatch is the unit. **It is not, while the runtime writes memories into a volume the next dispatch
mounts** — content from pack A can reach dispatch B without passing the boundary check at all,
because it never travels as a pack. That is a data-boundary hole with no fixture currently pointed
at it, and it is a strictly worse shape than the carry-over path A-06 already worries about, since
that one at least goes through the pack.

## It cannot be configured off, and the vendor says so

`hermes memory --help`, read off the pinned image:

```
usage: hermes memory [-h] {setup,status,off,reset} ...

Set up and manage external memory provider plugins. Available providers:
honcho, openviking, mem0, hindsight, holographic, retaindb, byterover. Only
one external provider can be active at a time. Built-in memory
(MEMORY.md/USER.md) is ALWAYS ACTIVE.

    off     Disable external provider (built-in only)
    reset   Erase all built-in memory (MEMORY.md and USER.md)
```

So `memory off` disables an **external** provider and leaves the built-in one running. There is no
supported setting that turns built-in memory off. **Fixture 8 cannot be satisfied by configuration**
— it has to be satisfied by how arc mounts the volume, which makes it an arc design decision rather
than a runtime one.

## The three ways out, with what each actually costs

1. **A fresh volume per dispatch.** Closes it completely and provably. Costs a cold boot every time:
   measured **145s–400s+ cold** against **32s–80s warm**. That is not free — REQ-05's class budgets
   come from calibration receipts, and this multiplies them.
2. **A warm template copied per dispatch.** Keeps the boot warm and gives each dispatch a private
   volume. Costs a directory copy of the populated volume (71 bundled skills and their caches) and
   needs a measurement before it is claimed cheap.
3. **Wipe the memory surface between dispatches** (`hermes memory reset`, or deleting
   `memories/MEMORY.md`, `USER.md`). Cheapest, and the least trustworthy: the marker was also found
   in `state.db`, so the surface is wider than the two files the vendor names, and a wipe list that
   is one file short reads GREEN while carrying data across.

**Recommendation: option 2**, with option 1 as the fallback if the copy measures slower than a cold
boot. Not applied here — this is a design fork with a real budget consequence and it belongs in an
ADR routed through `/arc-change`, not in a session that happened to find it.

## What was NOT established here
- **Whether `state.db` holds anything else across runs.** Only the planted marker was searched for,
  so the full extent of what persists is unmeasured. That matters for option 3 above.
- **Whether `sessions/`, `plans/`, `workspace/` or `cache/` also carry content across dispatches.**
  Not tested. The volume has 20+ top-level directories and one marker found two of them.

## Status

`FAIL` — recorded as a fixture result, not a judgement, including the failure. The STOP question
(REQ-02: *"any fixture that cannot be proven without netns/seccomp/VM work is recorded UNPROVABLE and
fires the STOP"*) does **not** apply: this fixture was entirely provable with the tools at hand and
it simply failed. A failing fixture is a defect to close, not an unprovable boundary.
