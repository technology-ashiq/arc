# Phase 02 — Registry-aware core

**Goal (one line):** targets carry an `arc-registry.json` ground truth and core scripts (ledger, toolcheck, /arc) read it instead of guessing from file presence.
**Appetite:** 1 week — blown appetite = cut scope or kill, never extend silently.
**Depends on:** phase-01

## Exit criteria (Definition of Done)

- [ ] Sync writes `.claude/arc-registry.json` into **every** target (bare + `--products`), conforming to the v1 schema below; re-sync **overwrites** it to match the current install (REQ-08)
- [ ] REQ-02 stays green: the golden-output gate **excludes** `.claude/arc-registry.json` from its byte-identical comparison (the file carries a per-install-volatile `source.commit`); a dedicated registry bats asserts the file's shape/content instead — golden proves the *payload* tree unchanged, the registry test proves the *registry* correct
- [ ] review-ledger.sh derives VALID_KINDS + command hints from the registry when present; today's hardcoded list remains the no-registry fallback (old installs unbroken)
- [ ] ~~per-product toolcheck tags~~ CUT (no REQ requires them — REQ-05 needs only INSTALLED/HEALTH from the registry); route through `/arc-change` post-Phase-4 if still wanted
- [ ] `/arc` INSTALLED column reads the registry — zero file-presence guessing (REQ-05)
- [ ] CI tree-diff invariant: install every product (enumerated via `--list`) into a temp dir → diff its `.claude/` payload vs the mold's own checkout (`$ARC_ROOT`, the job's own workspace — never an unrelated worktree) → any divergence fails. **Implemented as a bats test** (`tests/sync.bats`) riding the existing 3-OS selftest matrix rather than a bespoke single-OS job — broader coverage, locally runnable, still red-gates CI. ("all products" via `--list`, not a new `--products all` token — avoids resolver/golden churn.)
- [ ] tests added & green; live demo run + output checked; tracker updated (PROGRESS.md row ✅ + done-log)

## Registry schema (v1 — locked, no creep)

`.claude/arc-registry.json`, written into each target:

```json
{
  "schema": 1,
  "source": { "commit": "<arc mold short SHA at install time>" },
  "products": {
    "core":    { "version": "1.0.0", "files": ["<installed dest path>", "…"] },
    "council": { "version": "1.0.0", "files": ["…"] }
  }
}
```

- `version` per product = that product's `manifest.json` `version` field.
- `files` per product = the resolved **dest** paths the resolver installed for it (docs use their dest, not src).
- v1 fields ONLY: `schema`, `source.commit`, `products.<name>.version`, `products.<name>.files`. Nothing else (PLAN rabbit hole "Registry schema creep"). No timestamps, no host info, no HEALTH — HEALTH is computed live by `/arc`, never stored.
- Deterministic given the mold commit; the only volatile field is `source.commit` (why it's excluded from the REQ-02 golden manifest).

## Verification plan (refined 2026-07-17)

1. **Registry round-trip bats** — `--products council` into a scratch target → assert the file exists, `schema==1`, `products` keys == `{core, council}` exactly, each `files[]` equals the resolver's plan for that product, `source.commit` == mold HEAD short SHA. Re-sync with a different product set → assert the file is **overwritten** to the new set (not appended, no stale products).
2. **Ledger fallback bats** — review-ledger.sh with NO registry → VALID_KINDS == today's hardcoded list (old installs unbroken); WITH a registry → VALID_KINDS derived from `products` keys.
3. **REQ-02 golden still green** — the existing bare-sync golden bats pass unchanged (registry excluded from the manifest) + a new case asserting the registry file IS present in a bare target yet absent from the golden manifest.
4. **Tree-diff invariant** — install every product (via `--list`) into temp → diff its `.claude/` payload vs the mold checkout (`$ARC_ROOT`) → any divergence fails. A bats test on the 3-OS selftest matrix (red-gates CI), not a bespoke job.
5. **Adversarial pass (non-negotiable)** — the registry writer AND the ledger's registry reader are new parsers → construct-a-breaking-input pass (malformed/truncated/empty JSON, unknown product key, missing fields) → reader degrades to the hardcoded fallback or exits cleanly, never crashes or mis-derives kinds; holes pinned as red fixtures before any FAIL promotion.
6. **Live demo** — `/arc` against a council-only target showing `INSTALLED = core, council` sourced from the registry file (zero file-presence guessing).

## Rabbit holes in this phase

Registry schema creep — v1 fields only (PLAN rabbit hole). Mold self-registry — NO: the mold is the source of truth, not an install target.

## Out of scope for this phase

File moves (Phase 3) · external repos (Phase 4).

## Your-setup / pending

Nothing — all local.

## Non-negotiables (verbatim from PLAN)

- Bare `sync-to-project TARGET` output stays byte-identical to pre-initiative — golden-output bats case green on every PR of this initiative (products are additive under the umbrella, ADR-0014); the golden fixture may only be regenerated via a reviewed diff naming the intentional change — silently re-recording it to match new output is a gate failure, not a fix.
- Every new parser (manifest reader, resolver, product-lint) AND the byte-diff/golden-output comparison gates get an adversarial construct-a-breaking-input pass; found holes fixed + pinned as red fixtures BEFORE any FAIL-mode promotion (council v2+v3: 43 holes in gates that passed their own tests).
- Physical re-homing lands only behind the byte-diff gate — defined as: per-file SHA-256 over content with line endings normalized to LF before hashing, executable bit compared separately, symlinks resolved before hashing; installed tree provably unchanged, per product move (ADR-0018).
- Consumer repos: never delete — attic move to `.claude/attic/DATE/` only, report before mutate.
- Every hook/script change ships with a bats test. CI red = no merge on the arc repo.
- Cross-platform: Git Bash (Windows) + ubuntu + macos CI; bash-3.2/POSIX; no new PowerShell logic beyond the dumb copy loop (ADR-0015).
- New lint checks start WARN in the TRIAL set; FAIL promotion only via docs/trial-ledger.md evidence.
- Engine scripts assume no Claude (ADR-0013 writing rule, inherited).
- Every `/arc-phase-done` on this initiative commits an evidence bundle.
