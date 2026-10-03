# launch — fixed defects (handed to every /arc-attack)

Every defect fixed in this lane, as a PATTERN to check in every OTHER file — a fix is not applied until it has been
attacked somewhere it was never made (CLAUDE.md, the twin-fix rule).

| # | Phase | Pattern | Where it was fixed | Check it in |
|---|---|---|---|---|
| 1 | 00 | Blanking comments before strings reads the `//` inside `"https://…"` as a comment and eats the rest of the line, braces included | `lib/scan.mjs` `verifyBody` (one-pass tokenizer) | any other source scanner in the lane (`specifiers`, `defaultWordHits`) |
| 2 | 00 | A value-equality rule (`slot names a provider`) fired on the slot's own `id` that happens to equal a provider id | `launch-lint.mjs` (`id` exempt) | every rule that compares a field's VALUE against another file's ids |
| 3 | 00 | A crashed runner's attempt never got a receipt — "every attempt ends with exactly one receipt" was true only for workers, not for a runner killed holding the lock | `lib/runner.mjs` orphan close on takeover | every exit path of `runAttempt` (approval pause, refusal) |
| 4 | 00 | Windows reports a SIGKILL'd child as plain exit 1, so a reason built from the exit code named the wrong cause | `lib/runner.mjs` (reason = "ended without a result") | any code that infers a cause from `status`/`signal` |
| 5 | 00 | `withLock` treats a holder older than ten minutes as a reused pid and breaks it; a 15-minute apply is legitimate | `lib/runner.mjs` refuses on a LIVE holder before waiting | any other caller of `withLock` with a long critical section |
| 6 | 00 | Paths printed by node on Windows carry backslashes that bash reads as escapes | `tests/launch/make-fixture.mjs` (forward slashes, quoted exports) | every helper whose output bats `eval`s or globs |
| 7 | 00 | `VAR=x run cmd` in bats never exports VAR to the child | `tests/launch-runner.bats` (`run env VAR=x`) | every `run` in every launch suite |
