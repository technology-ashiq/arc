# Phase 06 evidence — what this bundle does NOT contain, and why

Phases 04 and 05 set the pattern and it is kept: a bundle that quietly shortens its own
expected-files list has stopped being evidence. Everything REQ-02 and REQ-03 name that this bundle
cannot produce is named here, with the reason, as a finding rather than an omission.

## 1. There is no scrubbed transcript for ANY Phase 06 dispatch

**Exit criterion:** *"A scrubbed transcript per dispatch is stored at
`initiatives/engine/evidence/phase-06/`, scrubbed with the spine's own `scanSecrets()` and
`DENY_RULES` rather than a second scanner."*

**What exists:** the scrub half, fully. `arc-run` runs the spine's own scanner over the driver's
stdout, its transcript and its cost sidecar, and a planted key stops the run before anything is
written — four artifact classes with a negative control, in `tests/engine-hermes-secrets.bats`.

**What is missing:** the stored files. `initiatives/engine/evidence/phase-06/transcripts/` does not
exist and never has — `git log --all` on the path returns nothing, and `.gitignore:30` un-ignores
`initiatives/*/evidence/**`, so this is not an artifact written and then excluded.

**Why:** `storeTranscript` is opt-in on `ARC_RUN_TRANSCRIPT_DIR`, and none of the Phase 06 dispatches
set it. The opt-in itself was a correct decision — `arc-run` belongs to no lane, ten suites and five
lanes drive the binary, and a hard-coded engine path would put bench's transcripts in engine's
bundle. **The defect is that opting out was indistinguishable from having nothing to store.** A run
that discarded its transcript said nothing at all.

**What it cost, twice.** `certification-run-01M07FX9ZAY3EHCQFKVVKA2RT7.md` asserted the transcript had
been stored, and that claim stood for six days: the storage code had been written that session, the
destination was in the plan, and nobody ran `ls`. Then the identical miss took the three Phase 08
round-1 dispatches the next day, where two runs returned JSON the schema rejected for **one missing
property** and the exact shape is now unrecoverable — the one artifact that would have said whether
the fix was a prompt change or a schema change.

**Fixed forward, not backfilled.** No transcript is reconstructed, because reconstructing one would
be manufacturing the evidence this file exists to say is absent. `arc-run` now takes
`--transcript-dir PATH`, and a dispatch producing a transcript with no destination configured
**announces it on stderr**. Six tests pin both halves, including a negative control proving the
warning is bound to the absence rather than printed unconditionally.

## 2. Fixture 5 has no real-container arm

**Exit criterion:** the twelve fixtures run green *"against the real runtime"*.

**What exists:** `tests/engine-hermes-secrets.bats` proves a planted key is absent from all four
named artifact classes on the **real driver** — the real spawn, the real capture, the real scrub.
Only the `docker` binary is substituted.

**What is missing:** a planted-key run against the pinned image itself.

**Why:** the scrub happens in `arc-run`, above the container boundary, so the container is not part
of the code path under test. Substituting it changes nothing the fixture asserts.

**What that costs:** very little, and it is still worth writing down. The blanket sentence *"all
twelve stand on the real runtime"* is one word stronger than this row supports, and this cycle has
already paid twice for a tracker narrative that ran slightly ahead of its artifacts.

## 2b. Three findings from the 2026-08-23 pass are recorded rather than fixed

**The transcript is a lossy re-encoding when a driver forwards non-UTF-8 bytes.** `spawnSync`
decodes the child as utf8, so a driver relaying a Windows console codepage or CP-1252 smart quotes
arrives at `storeTranscript` with U+FFFD already substituted — three source bytes became three
replacement characters, proven. ADR-0215 keeps this trail because injection shows in trails, and a
silently re-encoded trail is not that artifact. **Partially closed:** the stored file now carries a
header line saying the bytes were lost at capture, so the reader is never shown a substitution as if
it were the driver's output. **Not closed:** the bytes themselves. Fixing that means capturing the
child as a Buffer through every driver, which is a change to the capture path rather than to the
storage path, and it is not this phase's business.

**Two branches are unreachable and therefore untested.** The empty-transcript marker, and the
absence warning's own `text.length` condition, both require a driver that produces nothing on
*either* stream. Once both streams are stored, no driver in the tree does: hermes writes banners to
stderr on every dispatch and mock names its missing recording there even when it fails. Both are
kept as defensive code and both are labelled in the source as unreachable, so that a later reader
neither deletes them as dead nor writes a test that cannot pass. The mutant that removes the
`text.length` guard therefore survives the suite — recorded rather than papered over with a test
that would assert nothing.

**A `wx` collision across PID namespaces is a warning, not a failure.** The filename carries the pid
and a millisecond stamp; two arc-run processes in separate containerised CI legs sharing one
bind-mounted evidence directory can produce the same pid and the same stamp, and the `EEXIST` from
`wx` lands in the same catch as every other storage failure: one WARN line, exit 0, transcript lost.
The `wx` flag is doing its job — the collision is detected rather than silently overwriting — but the
loss is reported at a volume the phase close is explicitly told not to read. No such collision has
been observed; it is written down because the code comment above it calls the collision impossible,
and it is not.

## 3. Fixture 9's proposal-receipt arm was not read off the spine for the real dispatches

**Exit criterion:** *"hostile outputs produce a schema failure, one same-tier retry, then a proposal
receipt."*

**What exists:** the fixture, in `tests/engine-isolation-cert.bats` *cert 9*, plus the ladder observed
unprompted on the hosted runtime — the Phase 08 round-1 dispatches ran **two attempts each** and
ended on a schema rejection (`$.draft: required property is absent`).

**What is missing:** confirmation that those three real dispatches each also emitted the rung-2
proposal receipt. The `run.completed` receipts were verified present and un-quarantined; the
`approval.requested` proposals were not separately counted.

**Why:** the dispatches were being read for REQ-07's draft outcome, and the ladder's own receipts
were not the question anyone was asking that day.

**What that costs:** the strong form of fixture 9 — *hostile output on the real runtime produces a
proposal* — rests on the fixture plus a partial real-path observation, rather than on a receipt count.
The 2026-08-16 599-second run did produce schema-failure → one same-tier retry → proposal receipt,
but that was a weak model answering badly rather than a **planted** hostile output, which is why it
was recorded at the time as evidence and not as the fixture.
