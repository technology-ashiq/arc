# Fixed defects — the launch lane's running list

Every attacker prompt carries this file, with one instruction: **check each line in every OTHER
file you are shown, not only the file it was fixed in.** Every attacker pass adds its fixed holes
here, one line each.

Format: **defect** — where it was fixed — *the pattern to check elsewhere*.

- **Blanking comments before strings read the `//` inside `"https://..."` as a comment and ate the rest of the line, braces included, so verify-is-probe found no verify at all** — `lib/scan.mjs` `verifyBody` blanks strings and comments in one pass, Phase 00 — *any other source scanner in the lane (`specifiers`, `defaultWordHits`) that treats a token inside a string as code*
- **The slot-names-provider rule fired on the slot's own `id` (`ledger-source`), which happens to equal its provider's id** — `launch-lint.mjs` exempts `id`, Phase 00 — *every rule that compares a field VALUE against another file's ids*
- **A runner killed while holding the lock left its attempt with no receipt, so "every attempt ends with exactly one receipt" held only for workers** — `lib/runner.mjs` closes the orphaned attempt as failed, with a receipt, on takeover, Phase 00 — *every exit path of `runAttempt`, including the approval pause and refusals*
- **Windows reports a SIGKILLed child as plain exit 1, so a reason built from the exit code named the wrong cause** — `lib/runner.mjs` reason says the worker ended without a result, Phase 00 — *any code that infers a cause from `status` or `signal`*
- **`withLock` treats a holder older than ten minutes as a reused pid and breaks its lock, while a hosting apply may run fifteen** — `lib/runner.mjs` refuses on a LIVE holder before waiting, Phase 00 — *any other caller of `withLock` with a long critical section*
- **Paths node prints on Windows carry backslashes that bash reads as escapes when a helper's output is eval'd or globbed** — `tests/launch/make-fixture.mjs` prints forward slashes in quoted exports, Phase 00 — *every helper whose output bats evals or globs*
- **`VAR=x run cmd` in bats never exports VAR to the child, so an env-steered fixture ran unsteered** — `tests/launch-runner.bats` uses `run env VAR=x`, Phase 00 — *every `run` in every launch suite*
- **`ctx.write` resolved symlinks only on the ancestors, so a LEAF link (`root/evil -> /outside`) carried a write out of the venture root** — `lib/ctx.mjs` `confinedPath` lstats every component to the leaf and refuses any link, attack 06cbc03 L1 — *every path check that validates one resolution and then writes through another (validate one read, use another)*
- **A rehearsal's gate-3 refusal was terminal on the first run but a re-run read the recorded approval id as pending and answered "awaiting" (exit 5)** — `lib/runner.mjs` `gate()` refuses from the record, attack 06cbc03 L2 — *every state the runner treats as terminal: does every re-entry path honour it?*
- **`typeof null === "object"` let `"slots": null` past the state shape guard into a TypeError** — `lib/state.mjs` `check()`, attack 06cbc03 L3 — *every `typeof x === "object"` guard in the lane*
