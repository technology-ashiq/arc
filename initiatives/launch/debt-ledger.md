# launch — debt ledger (LOW leftovers after the attack rounds; each with the trigger that pulls it in)

| # | From | Debt | Trigger |
|---|---|---|---|
| D1 | attack 3b48ed1 B10 | `lockHolder` treats an unparseable lock file, or a pid reused by an unrelated live process, as a live apply, so every later apply exits 3 until the file is removed by hand | the first exit-3 report that no running apply explains |
| D2 | attack 3b48ed1 B7 | the slot timeout kills the worker but not its descendants; closed for now only because the scanner refuses `node:child_process` in adapters | the first adapter that needs a subprocess (`pg_dump`, Phase 03): it gets a `ctx.run` that kills the process tree, before it lands |
| D3 | attack 3b48ed1 B1 | `ctx.fetch` returns a 3xx to the adapter; there is no helper that follows a redirect through the allowlist | the first real provider that answers with a redirect |
| D4 | attack 405007a B5 | a verify probe longer than ten minutes is past `withLock`'s stale window; mitigated today because `underLock` refuses a LIVE holder before `withLock` can judge age, so nothing breaks the lock while the pid lives | the first slot whose verify probe is measured above five minutes |
| D5 | attack 405007a B9 | the evidence manifest hashes committed bytes; an eol-normalising checkout could report a mismatch | the first `arc-evidence verify` that fails on a checkout whose bytes match the commit after CRLF folding |
| D6 | attack e37494d L6 | a verify worker killed by something other than the slot timeout is reported by exit code, which cannot tell a kill from a crash on Windows | the first verify failure whose reason is "worker ended without an answer" with no timeout in sight |
| D7 | attack e37494d L8 | `verify --all` picks its slots before the per-slot lock, so a slot verified by a concurrent apply mid-run is not probed in that run | the next `verify --all` covers it; revisit if the weekly job (REQ-10) ever runs while an apply does |
| D8 | attack 7722041 B3 | the adapter sanitiser skips the bidi, zero-width and line-break classes but not every Unicode format (Cf) character, e.g. tag characters U+E0000 block | the first board line where a provider string renders differently from its bytes |
| D9 | attack 7722041 B5 | `launch-lint` reads a valueless `depends_on:` key as "not a list" rather than empty | the first catalog row that wants an explicit empty dependency list |
| D10 | attack 7722041 B6 | state resources accumulate across attempts; a provider that returns a new id per attempt would leave two `dns-target`s and dns refuses (UPSTREAM_MISSING, never a wrong record) | the first hosting adapter whose dns-target is not stable across attempts |
| D11 | attack 7722041 logic | the logic surface timed out once at 420 s and then could not emit from the worktree; slice 2 merged on boundary rounds + CI only | the next launch PR runs logic first; if it times out twice, GLM fallback per the attack-model note |
