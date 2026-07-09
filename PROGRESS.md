# PROGRESS.md — arc v2 "World-Best" Upgrade

> Tracker for the initiative planned in `PLAN.md`. Rows flip ✅ only via `/arc-phase-done`
> (tests green + live demo + exit criteria + evidence). Evidence over assertion.

## Now

**Phase 02 CLOSED ✅ (2026-07-10).** Gate engine v1 shipped — `arc.gates.yaml` + generic gate-runner,
baseline (new-code-only), suppression ledger, **LLM triage v1** (downgrade-only, fail-closed),
per-adapter runtime fallback (native→docker→SKIPPED), committed evidence bundles, macOS CI +
portability. Full suite **79/79 green on 3-OS CI** (PR #8, run 29054053282). Live demo passed every
scenario (baseline / suppression / triage). First dogfooded evidence bundle committed + verified
(`docs/evidence/phase-02/`, verdict=pass, 8 test-fixture secrets justified-suppressed). **The
noise-defense moat (pre-mortem #1) holds.**

Next up: **Phase 03 — Security pipeline** (`phases/phase-03-spec.md`, 1.5-week appetite): Trivy,
trufflehog, CodeQL, RLS harness, ZAP — plus the **pinned arc-tools docker image** (ADR-0006 amendment;
the real backend for #9's docker rung, currently fake-tested) and wiring a docker triage backend.

Setup needed from user: **check `phases/phase-03-spec.md` "your-setup / pending"** — Phase 03 adds
real security tools (some may need local install or CI secrets); the docker image build lands here.

Closed: Phase 00 (steel thread) · Phase 01 (credibility & hygiene) · Phase 02 (gate engine v1). All
3-OS CI-green, evidence-backed.

## Phases

| Phase | Capability | Appetite | Status | Closed |
|---|---|---|---|---|
| 00 | Steel thread: arc-scan skeleton + CI on arc | 1 week | ✅ done | 2026-07-09 |
| 01 | Credibility & hygiene: block-by-default, code-stamp, cross-platform sync | 1 week | ✅ done | 2026-07-09 |
| 02 | Gate engine v1: gates.yaml, baseline, suppression, evidence bundles | 2 weeks | ✅ done | 2026-07-10 |
| 03 | Security pipeline: Trivy, trufflehog, CodeQL, RLS harness, ZAP | 1.5 weeks | ⬜ not started | |
| 04 | QA pipeline: Stryker, Lighthouse CI, visual regression, schemathesis | 1.5 weeks | ⬜ not started | |
| 05 | Phase ratchet + docs gate v2 | 1 week | ⬜ not started | |
| 06 | Measured agent quality: eval corpus, retro→eval loop · **cut-line** | 2 weeks | ⬜ not started | |
| 07 | Adversarial orchestration: saboteur, parallel gates, quorum · **cuttable** | 2 weeks | ⬜ not started | |
| 08 | Distribution | next cycle | ⏸ parked | |

## Done log

- **2026-07-10 · Phase 02 · Gate engine v1.** The moat became a product: gates are declarative data
  (`arc.gates.yaml` + generic gate-runner, zero hardcoded gate logic in hooks) with the three noise
  defenses built in — **baseline** (new-code-only: `--baseline` freezes to `scan-baseline.jsonl`,
  only NEW findings block), **suppression ledger** (`docs/suppressions.md`: fingerprint + justification
  + date; unjustified = block), and **LLM triage v1** (downgrade-only <8/10 → error→note, tagged;
  never upgrades, never invents — rabbit hole #6; pluggable `ARC_TRIAGE_CMD`, deterministic offline
  fake, fail-closed on any backend error). Plus **per-adapter runtime fallback** (native→docker→SKIPPED,
  the permanent semgrep-on-Windows fix), **gitleaks path fidelity** (repo-relative URIs), **committed
  tamper-evident evidence bundles** (`arc-evidence.sh`), and **macOS CI + bash-3.2/POSIX portability**
  (ADR-0007). **79 bats tests** (13 scan + 11 profile + 6 sync + baseline + suppress + evidence + gates
  + portability + 7 runtime + 12 triage), green **on 3-OS CI** (ubuntu + windows + macos; PR #5/#6/#7/#8,
  final run 29054053282, `1..79`). Live demo: new secret → block; baselined → pass; suppress-no-reason
  → block; suppress-justified → pass; triage conf=2/10 → pass (downgraded); garbage backend → block
  (fail-closed). First **dogfooded evidence bundle** (`docs/evidence/phase-02/`): full-repo scan
  verdict=pass with arc's own 8 test-fixture secrets justified-suppressed in the ledger; bundle verified
  tamper-evident. Hook-tier scan measured **15.5s < 30s** (worst-case on a loaded machine). **Actual:
  ~2 sessions vs 2-week appetite — well under, no retro flag.** Decisions (`/arc-change` 2026-07-09):
  triage downgrade→note (not suppressed), pluggable `ARC_TRIAGE_CMD` backend. Carry-forward to Phase 03:
  real pinned arc-tools docker image (ADR-0006) as the live backend for #9's docker rung + docker triage.
- **2026-07-09 · Phase 01 · Credibility & hygiene.** Shipped block-by-default via strictness
  profiles (`arc-profile.sh`: starter/standard/strict, one `arc.profile` key switches coverage+docs+scan
  as a set, per-gate + env overrides); `/arc-review` auto-stamps `code` on ship verdict; cross-platform
  `sync-to-project.sh` (bash twin of .ps1); repo hygiene (5 write-probes removed+gitignored, agent-browser
  SHIPPED, Playwright kept-as-fallback); docs (usermanual/README/how-it-works/CHANGELOG). **30 bats tests**
  (13 scan + 11 profile + 6 sync), green **in CI on ubuntu + windows** (PR #3, run 29021894177, `1..30`).
  Live demo: profile switches all gates; code-stamp gates ledger `require` (BLOCK exit 2 → PASS exit 0);
  sync excludes personal/state. docs-drift dogfood exit 0. **Actual: part of one session vs 1-week
  appetite — well under, no retro flag.** Decisions: default profile `standard`, Playwright kept.
- **2026-07-09 · Phase 00 · Steel thread.** Shipped `arc-scan` spine (diff-scope → semgrep+gitleaks
  adapters → minimal-SARIF normalize/merge → threshold triage stub → review-ledger `scan` stamp),
  offline `arc-min` ruleset, `version-gate`. **13 bats tests** (degrade · normalize · merge · triage ·
  ledger · e2e), all green. CI matrix **green on ubuntu + windows Git Bash** (PR #1, run 29015093526).
  Live demo: seeded repo (planted eval-injection + `ghp_` secret) → `block` exit 2; clean → `pass`
  exit 0, stamps `scan`. **Actual: ~1 session (< 1 day) vs 1-week appetite — well under, no retro flag.**
  CI caught a real Windows/Linux exec-bit split on run 1 (fixed in `e3e9d51`) — cross-platform moat
  proved itself day one. Carry-forward to Phase 2: gitleaks staging-path fidelity (finding URIs show
  the temp stage dir, not the repo-relative path).

## North-star metric

Escaped defect rate (post-gate production bugs) — tracking begins at Phase 02 close.
