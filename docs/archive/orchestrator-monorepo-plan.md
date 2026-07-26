# arc Orchestrator — Product Monorepo Plan

> **Status: PROPOSED — awaiting Ashiq's "go".** No code has been written against this plan.
> On approval this document is the input to `/arc-change` → `/arc-kickoff` (which will produce
> the formal PLAN.md, phases/phase-NN-spec.md and PROGRESS.md per the build playbook).
>
> **Provenance:** produced 2026-07-17 from a 12-agent analysis workflow — 7 readers mapped the
> full repo (21 commands, 23 agents, all scripts/hooks/docs), 3 independent architectures were
> designed (plugin suite / product monorepo / registry-in-place) and scored by 2 judges.
> Decision: **Product Monorepo** — physical product boundaries NOW, one repo, extraction later
> on demand. Rationale: Ashiq wants per-product development, and the option to open-source or
> SaaS a single product; the product-strategy judge independently picked this architecture.

## Goal

Restructure arc from one monolithic build system into an **orchestrator umbrella over 6
products** — each with its own manifest, tests and boundary, individually installable
(`sync-to-project --products council`), all visible in a read-only `/arc` dashboard — while
staying **one repo, one CI, one test suite**, with every existing arc command working
unchanged throughout.

Explicitly **not** in scope now (demand-triggered, see Phase 6): separate repos per product,
plugin/marketplace packaging, per-product versioning, SaaS builds.

## Product lineup

| Product | Commands | Agents | Scripts | Notes |
|---|---|---|---|---|
| **arc-core** | arc (new), arc-toolcheck, arc-freeze, arc-unfreeze, arc-resume | log-analyzer, researcher | arc-gates.sh, arc-profile.sh, review-ledger.sh, toolchain-health.sh, freeze-check.sh, statusline.sh, all 6 hooks, sync twins, lib/common.sh (relocated out of arc-scan/) | Always installed; the umbrella spine |
| **arc-plan** | arc-kickoff, arc-change, arc-phase-done, arc-retro, arc-diagram | question-planner, plan-attacker, plan-simulator, codebase-surveyor, product-challenger (+ future saboteur, phase-07-spec) | kickoff-lint.mjs, arc-evidence.sh | The Golden Loop product |
| **arc-review** | arc-review, arc-audit, arc-second-opinion, arc-docs | code-reviewer, security-auditor | arc-scan/ full tree (adapters, lib, rules), docs-drift.sh, coverage-gate.sh, rls-gate.sh, version-gate.sh, arc-tools-image.sh | The moat: SARIF pipeline + SHA-keyed ledger |
| **arc-qa** | arc-qa, arc-design, arc-canary | qa-tester, design-reviewer | — | External dep: agent-browser CLI (Playwright MCP fallback) |
| **arc-council** | arc-council | 12 council-* agents | council-lint.mjs, council-juror.mjs, council-calibrate.mjs | Already clean (16 runtime files, zero coupling) — extraction pilot |
| **arc-git** | arc-commit, arc-pr, arc-fix-issue, arc-ship | — | — | Thin git/deploy rail |

## New pieces to build (6)

1. **`products/<name>/manifest.json`** — the product's identity card: explicit lists of
   commands/agents/scripts/docs/env blocks/hook fragments/state dirs. Zero-dep JSON; no globs in v1.
2. **`arc-products.mjs`** — the **single resolver**: reads manifests, emits a COPY/MKDIR/ENVBLOCK
   plan as a line protocol. **Both sync twins (sh + ps1) consume this plan as dumb copy loops** —
   kills the twin-drift bug class at the root (the .ps1 state/ leak proved it is real).
3. **`product-lint.mjs`** — registry police: every synced file maps to exactly one product,
   no orphans, manifests valid. WARN-first TRIAL mode; promoted to FAIL only via
   docs/trial-ledger.md evidence (v4 F1 protocol).
4. **`/arc` command + `arc-status.sh`** — read-only orchestrator dashboard: per-product
   INSTALLED / HEALTH / ledger stamps / last activity + exact command to install what's missing.
   "The script is the gate" — arc-resume style.
5. **`sync-to-project --list / --products <x,y>`** — selective install built INTO the existing
   twins (standing rule: extend, never a parallel installer). Bare invocation stays
   **byte-identical** to today, guarded by a golden-output bats test.
6. **Target-side `.claude/arc-registry.json`** — written at sync time: installed products,
   versions, file lists, source commit. Ground truth for `/arc` and version-aware re-sync.

## Phases (risk-ordered — stopping at any phase banks real value)

### Phase 0 — Manifest steel thread + council-only install (zero file moves) · ~1 week
- `/arc-kickoff` formalities: tracker, phase specs, ADR ("product monorepo + demand-triggered extraction rule")
- Write all 6 manifests against the **current** layout (nothing moves)
- Build `arc-products.mjs` + `product-lint.mjs`
- **Adversarial red fixtures pinned:** path traversal (`"../../settings.json"`), duplicate
  product names, CRLF/BOM manifests, Windows case-colliding paths, empty fields — all must FAIL
  the lint (council v2+v3 43-holes lesson; CLAUDE.md build non-negotiable)
- Extend both sync twins with `--list` + `--products` via the resolver line protocol
- **Fix known sync bugs while in there:** .ps1 leaks `.claude/state/` into targets (sh excludes
  it correctly); both twins leak `.claude/scheduled_tasks.lock`
- **Prove:** `--products council` into a scratch repo → a council session runs end-to-end
- **Exit:** full bats green + golden-output test (default sync byte-identical) + council-only install evidence
- ✅ Safe stopping point: selective install + registry already valuable

### Phase 1 — Composable hooks + stable settings.json · ~1 week
- Split the 6 monolithic hooks into `<event>.d/` fragments (NN- ordering); missing product
  script → **loud SKIP, exit 0**
- settings.json becomes the stable core template (per-product registrations guard-safe)
- **Exit:** hook overhead measured before/after on the actual Windows box — **<30s budget
  (ADR-0006) must hold**; a partial install (core+council only) runs session hooks cleanly

### Phase 2 — Registry-aware core · ~1 week
- review-ledger.sh reads VALID_KINDS from the registry (hardcoded list stays as no-registry
  fallback — old installs keep working)
- toolchain-health.sh rows tagged per-product
- Sync writes `arc-registry.json` into targets
- **CI invariant job:** install `--products all` into a temp dir → tree-diff vs the mold's
  `.claude/` — manifest/reality divergence turns CI red
- **Exit:** `/arc` dashboard INSTALLED column reads the registry (no file-presence guessing)

### Phase 3 — Physical re-homing (THE BIG DIFF) · ~1–2 weeks
- `git mv`: scripts → `.claude/scripts/{core,plan,review,qa,council}/`; tests + fixtures →
  `products/<name>/tests/` (council's ~60-fixture corpus + eval harness move here)
- Update every path reference: command frontmatter `allowed-tools`, council-lint pinned agent
  paths, bats greps, hook fragments
- **Gate:** the Phase-2 byte-diff CI job — installed shape must be byte-identical or the
  commit is red. This is the daily-driver protection net.
- **Exit:** full bats green (one file at a time, foreground — Windows rule) + byte-diff green
  + one real kickoff/review/council command run recorded as evidence

### Phase 4 — Real dogfood (second-consumer evidence) · ~1 week
- Install **council alone** into a real external project → run a real council session
- Install **core+plan** into another project → run a small kickoff
- Record evidence bundles in docs/evidence/ — this manufactures the ADR-0013 "second concrete
  consumer" proof
- **Exit:** 2 real installs + real usage evidence; issues found → fixed with regression tests

### Phase 5 — Polish + docs + retro · ~1 week
- `--prune-report` (report-only stale-file listing) → then attic pattern (**MOVE** to
  `.claude/attic/<date>/`, never delete)
- Rewrite README / usermanual / blueprint / how-it-works for the product model; fix known doc
  drift (gstack-comparison "PowerShell-only installer" line)
- Promote product-lint TRIAL checks to FAIL via trial-ledger evidence
- `/arc-retro` — final scoreboard

### Phase 6 — DEFERRED, demand-triggered 🔒
- **Trigger (write into the ADR verbatim):** the first real external user/buyer of a product
- Then: `product-lint --paths <product>` emits the git-mv/export list → separate repo /
  plugin packaging / SaaS engine split (ADR-0013 engine-vs-adapter seam; council is the first
  SaaS candidate)
- Until the trigger fires, this phase is not touched

## Safety rails (non-negotiable)

1. Default `sync-to-project <target>` stays **byte-identical forever** — golden-output test guards it
2. Every new parser gets a mandatory **adversarial breaking-input pass** with pinned red fixtures
3. Physical re-homing lands only behind the **byte-diff CI gate**
4. Nothing is ever deleted from consumer repos — **attic move** only
5. **Kill criterion:** any phase blowing 2× its appetite → stop with banked wins, run the retro
6. cp-r-fallback tripwire: a sync.bats case forces the no-rsync Git Bash path so selective
   install never silently requires rsync

## Appetite

**Total: 6 weeks part-time** (realistically 4–5 with Claude doing the typing; the appetite
prices the risk, not the keystrokes). Phase 0 alone ships usable value — if everything after
it failed, selective install + registry + `/arc` dashboard remain.

## Judge scores (for the record)

| Architecture | Pragmatist judge | Product judge |
|---|---|---|
| Plugin suite (packages/, generated .claude/, settings-merge) | 22/40 | 23/40 |
| **Product monorepo (this plan)** | 27/40 | **30/40 — winner** |
| Registry-in-place (no moves) | **31/40 — winner** | 29/40 |

The split decision: registry-in-place is safest, monorepo is the best product architecture.
This plan is the monorepo with the registry plan's safety ideas grafted on (WARN-first TRIAL
lints, `/arc` read-only dashboard spec, prune-report before attic, demand-triggered extraction
rule) and the plugin suite's protections (hostile-manifest fixtures, scoped-down `--self`
byte-diff, banked-win kill criterion, real-repo dogfood bar).
