# Code review — arc orchestrator / product-monorepo Phase 00

- **Date:** 2026-07-17 13:03
- **Branch:** claude/arc-orchestrator-design-758d70
- **Reviewed commit:** c7561c4 (`git diff main...HEAD`, 11 commits)
- **Reviewer:** code-reviewer subagent (opengrep + gitleaks + osv-scanner + knip + 4-pass OWASP)
- **Verdict:** **fix-first**

## Scanner summary

| Tool | Result |
|---|---|
| opengrep | Clean — 203 rules on the 4 changed scripts, 0 findings |
| gitleaks | Clean scoped to main..HEAD (8 pre-existing history hits out of scope) |
| osv-scanner | SKIPPED — zero-dep .mjs, no lockfile |
| knip | SKIPPED — not an npm project |
| bats | 197/197 (author); reviewer independently reproduced the hostile corpus omits 2 attack classes |

**Blast radius:** `arc-products.mjs` stdout is executed as file ops by both twins with zero
re-validation in the consumer (single-parser design). Any plan defect = direct file-op defect on
every consumer running `--products`. The default full-sync path (golden-gated) is unaffected — both
holes live only in the new resolver path.

## CRITICAL

### C1 — Backslash `..\` traversal bypasses path-safety; PowerShell twin writes outside target
`product-lint.mjs:46` (checkPath) and `arc-products.mjs:59` (assertSafe) detect traversal with
`p.split("/").some(s => s === "..")` — split on `/` only. A path `..\..\..\pwned.txt` has no
`/`-delimited `..`, no control char, no `/` prefix, no `X:` drive → passes the linter clean; resolver
emits `COPY docs/real.md ..\..\..\pwned.txt`. On PowerShell, `Join-Path $Target "..\..\..\pwned.txt"`
resolves via .NET GetFullPath to a path **above** the target; `sync-to-project.ps1:63-65` Copy-Items
there = arbitrary write outside the target repo. The `traversal` fixture only tests forward-slash.
**Fix:** reject any backslash in checkPath/assertSafe before the split, in both files; harden the
absolute check for leading `\` (drive-relative) and `\\` (UNC). Add a `traversal-backslash` fixture.
**Resolved in 421d6df.**

### C2 — `envSentinel` never validated; a newline injects arbitrary protocol lines, escapes on BOTH twins
`arc-products.mjs:160-163` emits `ENVBLOCK\t${envBlock}\t${envSentinel}` with envSentinel raw;
`product-lint.mjs:129` checks only envBlock. A manifest with
`"envSentinel": "^J=\nCOPY\t.claude/settings.json\t../../../pwned.json"` passes the linter and the
resolver emits a real injected `COPY` line with forward-slash `../` — which escapes on the bash twin
(`cp "$SRC/..." "$TARGET/../../../pwned.json"`) AND PowerShell. Arbitrary file placement outside
target on both platforms.
**Fix:** validate envSentinel (forbid control chars; restrict to a simple anchored token) in both
product-lint.mjs and arc-products.mjs. Add an `envblock-injection` fixture.
**Resolved in 421d6df.**

## WARNING

- **W1** — `arc-products.mjs` `for (const d of m.docs ?? [])` throws an uncaught TypeError (stack
  trace, exit 1) if `docs` is a non-array; the resolver is the only consumer-side guard and should
  `die(exit 2)` cleanly. Type-check arrays before iterating. **Resolved in 421d6df.**
- **W2** — envSentinel flows into `grep -q "$sentinel"` (sh) and `Select-String -Pattern $sentinel`
  (ps1) as an unanchored regex — regex-injection / ReDoS surface. Restrict the sentinel to a simple
  anchored token (closes it together with C2). **Resolved in 421d6df.**

## NIT

- **N1** — skeletonDirs + the MKDIR verb inherit the C1 backslash blind spot; the C1 fix covers it —
  confirm a fixture exercises a skeletonDirs backslash. **Resolved in 421d6df** (traversal-backslash fixture includes a `skeletonDirs` backslash).
- **N2** — `printf | while` partial-install has no rollback; consider a "partial install" warning. **Deferred** — filed as a Phase-5 follow-up (attic/prune phase is where partial-install safety lands); non-exploitable, cosmetic-robustness.
- **N3** — `padEnd(10)` misaligns product names >10 chars in `--status`. Cosmetic. **Accepted** — all product names ≤7 chars; revisit if a longer product name is ever added.

## Re-review (adversarial, commit 421d6df) — verdict: SHIP

A second code-reviewer pass ran ~25 hostile manifests through the real scripts + an end-to-end
Win32 `Copy-Item`: **both Criticals verified hole-free**, all bypasses failed, all 6 real manifests
resolve clean, scanners + bats green. It surfaced two non-blocking same-class follow-ups, now closed:

- **W3** — envBlock-without-envSentinel linted clean but died in the resolver (broke
  lints-clean⇒resolves-clean). product-lint now requires envSentinel when envBlock is present.
  **Resolved in deb41a5** (fixture: envblock-no-sentinel).
- **W4** — the `..` segment check was exact-string, so `.. `/`...` (Windows trailing-dot/space
  normalization, same class as C1) slipped both gates. Both parsers now reject `/^\.\.[.\s]*$/`.
  **Resolved in deb41a5** (fixture: traversal-dotspace).
- **N4** — dropped `.` from ENV_SENTINEL_RE (regex any-char over-matched the twins' grep probe).
  **Resolved in deb41a5.**

Final verdict: **ship** (all Criticals + all Warnings closed; N2 deferred to Phase 5, N3 accepted).

## Verdict

**fix-first** — the phase's headline promise (the adversarial gate rejects any manifest that would
write outside the target) is false on two attack classes the corpus doesn't cover. Each is a ~3-line
fix plus the two hostile fixtures the "pin the found holes" rule requires. Everything else is solid.
