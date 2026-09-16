# Phase 06 evidence — what this bundle does NOT contain, and why

Phases 04 and 05 set the pattern and it is kept: a bundle that quietly shortens its own
expected-files list has stopped being evidence. Everything REQ-02 and REQ-03 name that this bundle
cannot produce is named here, with the reason, as a finding rather than an omission.

## 1. ~~There is no scrubbed transcript for ANY Phase 06 dispatch~~ — WRONG, AND CORRECTED THE SAME DAY

**Exit criterion:** *"A scrubbed transcript per dispatch is stored at
`initiatives/engine/evidence/phase-06/`, scrubbed with the spine's own `scanSecrets()` and
`DENY_RULES` rather than a second scanner."*

**THIS SECTION SAID THE CRITERION WAS NOT MET. IT WAS MET.** The transcripts were on disk the whole
time, in the **main clone**, untracked: ten of them, dated 2026-08-17 and 2026-08-18, including three
`attempt2` files — the retry-ladder second attempts this section called unrecoverable. They carry the
container's own boot output (`s6-overlay`, `preinit`), so they are runtime bytes rather than arc's
banners. **They are committed here now**, verified free of every secret shape `DENY_RULES` names.

**How the wrong answer was reached, because that is the reusable part.** The check run was
`git log --all` on the path, plus `git check-ignore` to rule out an exclusion. Both returned exactly
what they were asked and both answers were correct — *this path has never been committed*. That is a
fact about the **repository**. The criterion is about the **disk**. Reading one as the other, and
then writing the conclusion into the evidence under a strike-through and the word FALSE, produced a
correction more confident than the claim it replaced.

`ls` on the main clone answers it in one command. Neither the original claim nor its correction ran
one, and this file's own §"look at the artifact" lesson was three sections away while I did it.

**What was genuinely wrong, and what the fix actually fixed.** Storage was opt-in on
`ARC_RUN_TRANSCRIPT_DIR`, and a run that set nothing discarded its transcript **in silence** — so
whether a dispatch kept a trail depended on whether someone remembered a flag. That is what took the
three Phase 08 round-1 dispatches on 2026-08-18: the dispatch script did not set it, and **those**
transcripts exist nowhere, which is why that round's near-miss JSON shape is still unrecoverable.
`arc-run` now takes `--transcript-dir PATH`, stores BOTH streams, and announces a discard when no
destination is configured.

**What this bundle still cannot show:** which of the ten transcripts belongs to the certification
dispatch `01M07FX9ZAY3EHCQFKVVKA2RT7` specifically. The filenames carry the process, the driver, the
attempt, a pid and a timestamp — deliberately, and it is enough to count dispatches and to read one.
It is not enough to join a transcript to a receipt id. That join is a real gap and is named here
rather than guessed at from clock skew.

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

**~~Two branches are unreachable and therefore untested.~~ WRONG, and a code review reached both in
one command.** The claim was that the empty-transcript marker and the absence warning's `text.length`
condition need a driver producing nothing on *either* stream, and that no driver in the tree does —
hermes writes banners to stderr, mock names its missing recording there.

`--budget min=0.00002` kills the driver before it writes a byte. Both streams empty, the sentinel
written, the warning correctly silent. **Proved in one command**, against a claim asserted from
reading the drivers rather than from trying to reach the state — which is the same shape as the
transcript directory nobody ran `ls` on, recorded four sections up in this very file.

**Both branches are now covered** by two tests in `tests/engine-hermes-secrets.bats`: the empty
marker is named `.empty.transcript.txt` and is NOT announced as a stored transcript, and the absence
warning does not fire for a run that produced nothing to discard. The mutant that removes the
`text.length` guard no longer survives.

**The lesson is the one this cycle keeps paying for:** an unreachability claim is a claim about
behaviour, and it belongs in a fixture or in a measurement. Writing "no driver in the tree does this"
after reading the drivers is exactly as strong as writing "the transcript was stored" after writing
the storage code.

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
