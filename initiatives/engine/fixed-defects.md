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
- **generic-api never streamed, so Node fetch dropped every answer slower than 300 s** -- undici waits at most 300 s for response headers whatever the AbortSignal allows; six logic-attack attempts across two models and two input sizes ended at 304-306 s, and a local repro gave `UND_ERR_HEADERS_TIMEOUT` at 305 s. *A per-attempt cap above a transport limit is not a cap: ask for a stream, and fold the chunks back into the one envelope.*
