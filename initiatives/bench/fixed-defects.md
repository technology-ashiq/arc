# bench — fixed defects (carried by every attacker, ADR-0226)

Each line is a hole that was found and fixed. An attacker checks every OTHER file for its twin.

- **Last line of stderr taken as the reason** (2026-10-14, a59752e). arc-run prints bookkeeping
  after the real failure, so the router note was reported as the reason. Any "take the last line"
  reader of a child's stderr has this twin. Fix: skip continuation lines, bookkeeping and Node's
  version trailer, and prefer the line-start-anchored reason.
- **Unanchored text match on mixed stderr** (2026-10-14, B5). A reason matched anywhere in a line
  can be posed by model or driver text. Anchor it to the emitter's own prefix.
- **A trial run acting on the production route** (2026-10-14). `--trial-model` failures filed
  `engine-escalation` approvals about a route the trial never used. Any trial path that emits a
  route-level receipt has this twin.
- **Asking for a contract that was never shown** (2026-10-14, ADR-0915). Prompts said "match this
  process's output contract" without including it. Any prompt that names a schema it does not
  carry has this twin.
- **A benched CLI loading the operator's own setup** (2026-10-14, ADR-0915). `claude -p` read
  user hooks, plugins and MCP servers. Any spawned CLI that reads user-level config has this twin.
- **A CLI driver spawned in ARC_ROOT, not the work root** (2026-10-14, ADR-0916). arc-run keeps
  `ARC_ROOT` pointed at arc and passes the work root as `ARC_WORK_ROOT` plus the cwd; two drivers
  read `ARC_ROOT`, so the benched model committed into arc. Any reader of `ARC_ROOT` that means
  "where the work happens" has this twin. Fix: read `ARC_WORK_ROOT`, and bench checks the arc
  checkout after every attempt.
- **A failed read folded into a comparison as a constant** (2026-10-14, a522a4e L1/B3). A git read
  that threw became the string `(unreadable)` inside a digest, so a transient lock voided a clean
  run and a broken baseline matched a broken later read. Any "compare before and after" check with
  a catch-all fallback has this twin. Fix: retry once, then report "could not be checked" as its own
  outcome.
- **A guard scoped wider than what it guards** (2026-10-14, 680e889 B4). The checkout fingerprint
  hashed every branch, tag and worktree of the shared repository, so any sibling session's commit
  or fetch would have voided a paid run. Any "nothing changed" check over shared state has this
  twin. Fix: scope it to what the run could have touched.
- **The same over-wide scope, one layer down: the shared config file** (2026-10-14, the first
  champion re-run after #424). `git config --local` reads the one config file every worktree
  shares, and `checkout -b X origin/main` in a sibling worktree writes `branch.X.remote/merge`
  there. The tripwire stopped a paid run two attempts in, on the building session's own branch.
  Fix: keep only this worktree's `branch.<name>.` section; every other config line still counts.
  Twin: any per-worktree check that reads a repository-wide file.
