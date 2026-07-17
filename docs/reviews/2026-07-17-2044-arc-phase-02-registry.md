# Code review — arc orchestrator Phase 02: registry-aware core

- **Date:** 2026-07-17 20:44
- **Branch:** claude/arc-phase-02-registry
- **Reviewed:** uncommitted working-tree diff (`git diff` / `git status`)
- **Reviewer:** code-reviewer subagent (opengrep + gitleaks + osv-scanner + knip + 4-pass OWASP)
- **Verdict:** **ship** — all findings Low/Nit, fixed fix-first before close

## What shipped

Targets carry `.claude/arc-registry.json` ground truth (REQ-08); consumers read it instead of
guessing from file presence. Resolver `--registry` mode + registry-backed `--status` (REQ-05);
both twins write the registry in bare **and** `--products` paths; `review-ledger.sh` derives
`VALID_KINDS` from the registry (hardcoded fallback preserved); a tree-diff invariant proves
manifests never diverge from reality.

## Scanner summary

| Tool | Result |
|---|---|
| opengrep (semgrep fork) | Clean — 203 rules on the 4 changed code files, 0 findings |
| gitleaks (protect, uncommitted) | Clean — 0 leaks in this diff |
| osv-scanner | N/A — no dependency manifests changed |
| knip | N/A — no modules removed/moved |
| shellcheck | Not installed (would have flagged Finding 2 as SC2086) |

## Adversarial pass (the non-negotiable) — PASS

Every reader (`review-ledger.sh` + resolver `--status`) degrades to the hardcoded fallback or a
loud "unreadable" on malformed / empty / `products`-as-array / `__proto__`-key / `null`-products /
non-hex `ARC_SOURCE_COMMIT` — exit 0, no crash, **no `Object.prototype` pollution**, no mis-derive
into an escalation. The writer's version (`^[\w.+-]+$`), path (`assertSafe`), and hex-commit guards
hold. Verified live by the reviewer. Golden-gate exclusion is one exact path, compensated by
dedicated registry + tree-diff tests.

## Findings & resolutions (fix-first)

- **Low 1 — sh twin truncate-on-failure + twin divergence.** `node --registry > file` under
  `set -euo pipefail` truncates the destination *before* node runs, so a bad-version manifest
  (plan tolerates, registry rejects) left a 0-byte registry + half-install; the ps1 twin already
  captured-checked-wrote. **Fixed** — the sh twin now captures to `$_reg`, checks exit, then writes
  (both paths), mirroring ps1. (`sync-to-project.sh`)
- **Low 2 — ledger glob expansion.** `for p in $prods` was unquoted; a hand-edited registry with a
  `"*"` product key could glob against CWD filenames and wrongly grant kinds. **Fixed** — `set -f`
  around the derivation loop; **pinned** by an adversarial red fixture (`gates.bats`: `*` key +
  a `review` file → `code` still rejected). (`review-ledger.sh`)
- **Nit 3 — registry not gitignored in the mold.** Excluded from the golden + tree-diff gates by
  design, so a stray one in the mold's own `.claude/` would go unnoticed. **Fixed** — `.gitignore`
  now ignores `.claude/arc-registry.json` (consumers still choose to commit theirs).
- **Nit 4 — ps1 `Out-String` latent line-wrap.** **Fixed** — `-Width 4096` on both writes.
- **Informational** (no change): `--status` HEALTH `existsSync` over registry `files[]` is an
  owner-run, count-only existence oracle (negligible); a `__proto__` product dir is silently
  dropped from the registry object but blocked upstream by product-lint's `NAME_RE`, no pollution.

## Tests at review time

98 green / 0 fail / 0 skip across every touched + ledger-coupled file (products, sync, gates,
arc-profile, suppress, arc-scan), incl. the live-pwsh ps1 registry case. Golden fixture
regenerated twice, each a proven diff of only the intentionally-changed synced scripts
(`arc-products.mjs`, `review-ledger.sh`).
