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
  Fix: drop other branches' `branch.<name>.*` and every `remote.<name>.*`, matched exactly by
  subsection, read with `-z`; section-level keys and every other line still count.
  Twin: any per-worktree check that reads a repository-wide file.
- **A per-attempt check priced as if a process were free** (2026-10-14, PR 426 CI). The checkout
  fingerprint spawned seven git processes after every attempt; at 0.1-0.4 s per process on
  Windows, a ~28-attempt mock run pushed the face's `bench.run-model` flow past its 30 s CDP
  timeout on one Windows shard. Fix: three processes per check, the toplevel and git dir cached
  per root, the HEAD reflog read as a file. Twin: any check added inside a per-attempt loop.
- **A twin-fix left behind across drivers: the non-JSON answer** (2026-10-15, `champion-sonnet4`).
  generic-api declared a prose answer `model-invalid` (ADR-0228) and claude-code did not, so sonnet's one
  prose answer read `failure_class: unknown`, `reason: driver`, and bench's completeness gate refused the
  whole champion. Fix: claude-code declares it too; bench reads `model-invalid` as a schema failure, with an
  undeclared failure as the control (ADR-0917). Twin: every driver's answer-parse catch, and every reader
  that copies `reason` without looking at `failure_class`.
- **A diff that can only say one of the two things a route is** (2026-10-15). `buildRouterDiff` rewrote
  `driver:` only, so ADR-0914's same-driver candidate produced NO DIFF and no approval. Fix: a tier-line
  diff to the single tier that pins the model, refused when none or several do (ADR-0917). Twin: any
  artifact keyed on the driver where the subject is driver AND model (the `--from` identity already had
  this, PR 3b round 4).
- **Money read from one of the two places it lives** (2026-10-15). The receipt's rupee cost block is null
  for claude-code; its spend rides `payload.spend` in USD. Bench read only the first, so cost never decided.
  Fix: read the spend, sum all-or-nothing, compare only same currency and basis (ADR-0917). Twin: the drift
  guard's `classifyCostDelta`, still rupee-only (debt).
