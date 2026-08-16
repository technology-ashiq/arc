# Phase 06 · fixture 8 — persistent memory OFF: **FAILED as measured, then CLOSED by ADR-0222**

> **STATUS UPDATE 2026-08-17 — the fixture now PASSES, and it passes on a property that is actually
> true.** The runtime's memory is still always-on and still uncloseable by configuration; what
> changed is what arc mounts. Under **ADR-0222** each dispatch runs against a **private copy of a
> warm template**, made immediately before the container starts and removed after it exits, so two
> dispatches cannot share a memory file, a session or a `state.db` — regardless of which of the
> volume's 20+ directories the runtime decides to persist into next.
>
> **Copying beats wiping because it needs no knowledge of the runtime's storage layout.** The marker
> below turned up in `state.db` as well as the `MEMORY.md` the vendor names, so a wipe list one file
> short would read green while carrying data across.
>
> **Measured cost: 2,235 ms** to copy 36 MB / 1,171 files, against a **145–400s+** cold boot for an
> empty volume. The cheap option and the safe option are the same one, which is unusual enough to
> say out loud.
>
> Proven by `tests/engine-hermes-workspace.bats` (6 tests) — dispatch N+1 sees nothing dispatch N
> wrote, the template is never mutated, the copy is removed afterwards, and the driver states which
> mode ran on the transcript. **A mutant that mounts the template directly reddens 3 of the 6.** The
> negative control seeds the marker into the template and asserts the reader DOES see it, so the
> empty result in the main test is a finding rather than a fixture that writes nothing.
>
> **Still open, and not closed by this ADR:** the carry-over path assumption A-06 names — accepted
> drafts riding a later pack — is a different route into the same hole.

---

## The original measurement, kept because it is the reason any of the above exists

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
