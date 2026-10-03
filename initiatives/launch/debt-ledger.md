# launch — debt ledger (LOW leftovers after the attack rounds; each with the trigger that pulls it in)

| # | From | Debt | Trigger |
|---|---|---|---|
| D1 | attack 3b48ed1 B10 | `lockHolder` treats an unparseable lock file, or a pid reused by an unrelated live process, as a live apply, so every later apply exits 3 until the file is removed by hand | the first exit-3 report that no running apply explains |
| D2 | attack 3b48ed1 B7 | the slot timeout kills the worker but not its descendants; closed for now only because the scanner refuses `node:child_process` in adapters | the first adapter that needs a subprocess (`pg_dump`, Phase 03): it gets a `ctx.run` that kills the process tree, before it lands |
| D3 | attack 3b48ed1 B1 | `ctx.fetch` returns a 3xx to the adapter; there is no helper that follows a redirect through the allowlist | the first real provider that answers with a redirect |
