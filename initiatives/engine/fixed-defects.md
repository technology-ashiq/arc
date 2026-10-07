# Fixed defects — the engine lane's running list

Every attacker prompt for this lane carries this file (`build-attack-input.mjs` reads it), with one instruction:
**check each line in every OTHER file you are shown, not only the file it was fixed in.** Opened 2026-09-27: the first
engine attack round of the out-of-cycle driver-deadline bug found the lane had no list, so its attackers carried none.

Format: **defect** — where it was fixed — *the pattern to check elsewhere*.

## Out-of-cycle — the run's deadline, the attack watch, the nullable pair (attack 415d3a3, round 1)

- **A driver's clock per attempt, not per run** -- generic-api gave each of three transport attempts a fresh 10-minute cap and ignored `ARC_DRIVER_DEADLINE_EPOCH_MS` (2026-09-26, ~1.5 h silent). *Every driver reads the run's deadline through `common.mjs#msUntilDeadline`; no driver starts its own clock.*
- **Digits read as a deadline, Infinity read as none** -- a 40-digit epoch passed `/^\d+$/` and became Infinity, meaning "no deadline" (L2, B9). *A number from the environment must be a safe integer inside its bound, or it is refused; Infinity is never "unbounded".*
- **An exemption by deny-list** -- the credential rule's env-read exemption listed what may NOT follow the name, so `process.env.X || "sk-..."` let the literal fallback through (L1, critical). *An exemption from a secret rule is an ALLOW-list of what may follow, checked in every scanner view: raw, whitespace-stripped, and JSON-escaped.*
- **A watchdog that kills one pid** -- a driver arc-run started outlived it and held the pipes, so `close` never fired (B1). *End the tree (taskkill /T, the process group), and settle on a backstop timer, never only on `close`.*
- **stdin left open by an async spawn** -- spawnSync gave EOF, but spawn's default pipe blocked a reader until the watchdog (B2). *An async spawn replacing spawnSync keeps its stdin semantics: `stdio: ["ignore", ...]`.*
- **A heartbeat quoting a chunk, not a line** -- a write split mid-line was quoted as a fragment (L3). *Buffer to the line end before quoting anything read from a stream.*
- **Bytes dropped silently past a cap** -- output past 64 MiB was discarded and the cut JSON blamed on the model (L4, B10). *A cap names what it cut (`overflowed`); a cut answer is refused, never parsed.*
- **Child text on disk unredacted** -- the heartbeat's quoted line reached the status file without the secret scan the failure path applies (B3). *Every child line that leaves the process -- screen or file -- passes `liveLine`.*
- **EPIPE on a progress write** -- a closed stderr crashed the pass mid-run (B4). *Progress writes are best-effort; the parent's death takes the child's tree with it.*
- **A rename that fails on Windows** -- a watcher holding the status file open made the final "ended" line never land (B5). *Temp + rename, then write-in-place as the fallback; the last word must be the real one.*
- **Blank read as zero, NaN read as a cap** -- `Number("   ")` was 0 (B8), and `ARC_LLM_TIMEOUT_MS` was never validated, so NaN or 0 aborted every attempt (B7). *Trim, refuse blank, bound every numeric env var.*
- **A soft limit a provider ignores, trusted as a cap** -- `reasoning.effort` and `reasoning.max_tokens` were not honoured; the model spent 12000 of 12000 tokens thinking and answered nothing (design Phase 02 logic pass, 2026-09-27). *Measure what the provider does with a limit before relying on it; the only honoured control was reasoning off (ADR-0226 Amendment 3).*
- **generic-api never streamed, so Node fetch dropped every answer slower than 300 s** -- undici waits at most 300 s for response headers whatever the AbortSignal allows; six logic-attack attempts across two models and two input sizes ended at 304-306 s, and a local repro gave `UND_ERR_HEADERS_TIMEOUT` at 305 s. *A per-attempt cap above a transport limit is not a cap: ask for a stream, and fold the chunks back into the one envelope.*
- **The run's deadline read as a per-attempt timeout** -- generic-api aborted on the RUN's clock and declared `transport`, which hops (Cycle 8 attack 27dcf39 B1). *A driver ended by the run's deadline declares budget; only its own attempt cap is transport.*
- **A declaration trusted from a driver that should not declare** -- a sidecar class from a model-driven runtime would have been permission to hop (B2). *Only DECLARING_DRIVERS may declare; the sidecar must be a plain object.*
- **An unbounded value from a sidecar into a warning** -- a ten-megabyte "class" rode the sidecar into stderr (B3). *Write only a short lowercase name; truncate whatever is echoed.*
- **A sidecar write before die() with no guard** -- a throwing write skipped the intended exit code (B4). *Every write inside a failure handler is try-wrapped so the exit code still lands.*
- **A present-but-unreadable spend counted as zero** -- a fractional, negative or blank `inr` on an answer-less hop read as nothing spent (B5, L14). *Keep only a non-negative integer; mark a present invalid figure, and read it as unproven.*
- **A chain mutated and a hop announced before the hop was validated** -- splice and "falling back" ran before the owner-model and selection checks (B6, B10). *Validate, then mutate, then announce.*
- **At the term was both a stop and a start** -- `max_wall_ms` refused at elapsed == term but started a 1 ms hop just before it (L1-L3). *Every clock a hop obeys needs MIN_HOP_MS left, the same rule for each.*
- **A mutant that dies for the wrong reason** -- the policy and exit-2 fixtures carried no spend, so the money rule stopped the mutant before the class rule was tested (self-review, Cycle 8). *A negative-control fixture removes every OTHER reason to stop.*
