# PLAN (design source) — Cycle 2 · Receipt Spine — v2.1

> **Status: READY FOR KICKOFF NOW.** v2.1, 2026-07-22 — reground of v2 against the CLOSED
> orchestrator initiative (all 6 phases done 2026-07-22, ~22% burn). Supersedes
> `../arc-cycle2-receipt-spine-PLAN-v2.md` on every point where they differ.
> **Corrections vs v2:** (1) proposed-ADR numbers 0021–0028 COLLIDED with real ADRs
> 0021–0023 — decisions renamed SPINE-A…H, numbered at kickoff from the next free slot
> (0024+ as of 2026-07-22; re-check `docs/adr/`). (2) Tests live in central `tests/`
> per ADR-0021 — NOT `products/hq/tests/`. (3) Dogfood consumers are venturemind
> (upgrade path) + Opportunity-Scout (fresh path) — **InvoiceFly does not exist**
> (ADR-0022). (4) No new slash commands this cycle — `arc brief`/`arc inbox` are CLIs
> under `.claude/scripts/hq/`.

## Goal

For Ashiq, arc gains a **receipt spine** — every factory action and every rupee becomes one
append-only event stream, consumed by everything else only through one read contract,
rendered as a one-screen daily brief and an approval inbox, and proven on real work for
five real days — so the company's day is replayable from receipts and every future module
(engine, evolve, dashboard, policy) plugs into a stable API instead of each other's internals.

## Current state (verified 2026-07-22 — re-verify at kickoff)

- **Orchestrator initiative CLOSED** 2026-07-22: 6 products (core/plan/review/qa/git/council),
  selective install (`--products`), per-target `arc-registry.json`, physical boundaries.
  271/271 bats. 22 commands. ADRs through **0023**.
- **Scripts re-homed:** `.claude/scripts/{core,council,plan,review}/` (qa/git no-op).
  kickoff-lint at `.claude/scripts/plan/kickoff-lint.mjs` (v4; **8 substance gates WARN**
  in TRIAL — `docs/trial-ledger.md`; promotion blocked on a governed escape hatch that
  doesn't exist yet — do NOT promote gates in this cycle).
- **EVENT.d dispatcher live** (Phase 01): `.claude/hooks/<Event>.d/NN-*.sh` fragments —
  hq drops `NN-emit` fragments without touching hooks. Advisory events always exit 0.
- **Two real consumers exist:** venturemind (upgrade path — pre-Phase-02 install, 21 stale
  files known via `--prune-report`) and Opportunity-Scout (fresh install, council).
- **Attic deferred** (ADR-0023: "registry is not ownership"; implementation parked at
  `e2b3646`) — spine's append-only/never-delete stance aligns; nothing here revives attic.
- v2 world-best initiative stays parked (~13%, ADR-0017) — this cycle answers PROGRESS.md's
  open question with "receipt spine", not the v2 resume.
- **Hot zones:** `arc_hook_field` guard chain (jq→python→RAW fail-safe) — emitter must not
  disturb it · SessionStart/End timing (emitter never blocks) · Windows CRLF/locale ·
  golden bare-sync gate (spine files must never enter the sync payload).

## Success requirements

| REQ | User outcome | Measurable acceptance | Phase | Status |
|---|---|---|---|---|
| REQ-01 | Every factory action leaves a receipt | Scripted dry-run session (kickoff → phase-done → review → qa → commit → ship) produces the expected event sequence; every event passes strict validation; sequence matches a golden fixture (order-insensitive within a step) — bats green | 1 | draft |
| REQ-02 | The spine cannot be silently poisoned — in either mode | **Strict mode** (`--strict`: CI/ingest/tests): every pinned hostile fixture (missing field, bad ULID, bad ts, dup idem, oversize payload, secret pattern, CRLF/BOM, non-UTF8) exits 2. **Hook mode**: the SAME inputs never block — quarantined to `events/_quarantine/` + loud SKIP + exit 0. Both asserted per fixture | 0 | draft |
| REQ-03 | Money reaches the spine exactly once | `arc-event ingest revenue.received --json FILE` records a real provider payload; the same payload delivered twice — **including across days** — yields ONE event (idem index, fixture-proven); amount/currency/venture validated | 2 | draft |
| REQ-04 | State is derived, never truth — twice over | (a) `rm state.db && arc-replay && arc brief --date D` byte-identical to golden; (b) on a **no-sqlite runner** (Node 18 leg) the same brief byte-identical via the canonical JSONL-scan path — both bats cases in 3-OS CI | 0 | draft |
| REQ-05 | The day is readable in ONE screen | `arc brief` renders from the **spine reader only**: ≤ 40 lines, grouped needs-you / money / progress / background; overflow collapses to counts (+ `--full`); golden-fixtured; <5s on the owner's Windows box | 2 | draft |
| REQ-06 | Approvals are receipts too | `arc inbox` lists `approval.requested` via the reader; `arc approve/reject ID --reason` writes `decision.recorded`; full request→decision flow replays identically; no approval state outside the spine | 3 | draft |
| REQ-07 | Proven on real work with honest money | ≥5 consecutive real working days (arc's own development and/or one consumer repo): real events, brief read daily. **`revenue.received` = real money only**; pre-revenue → `revenue.simulated` (separate kind) and REQ-07 closes "mechanism proven, live value pending" — never fake P&L truth. Evidence bundle = the days' JSONL + briefs | 4 | draft |
| REQ-08 (stretch) | Runs know their cost honestly | `run.completed` may carry `cost: null` or `{tokens_in, tokens_out, inr_estimate, source: measured\|estimated\|manual}`; brief shows daily spend when present. **First cut under pressure** | 2 | draft |
| REQ-09 | The spine is the ONLY api | `brief`/`inbox` code contains zero direct `events/*.jsonl` or `state.db` references — all access via the `spine` reader lib/CLI (grep-lint, WARN-first per trial culture); each consumer keeps its own **cursor** (last ULID) and demonstrates catch-up-from-cursor in bats | 3 | draft |

## Appetite

**2.5 weeks part-time, hard cap.** Tier: **M**.
**Kill criteria:** at 50% burnt (~6 days), REQ-02 + REQ-04 not green → cut to spine+replay
only (bank; brief/inbox next cycle). Any phase at 2× appetite → stop, bank, `/arc-retro`.
First cut REQ-08, second cut REQ-09's cursor demo (lint stays). 100% → cut or kill, never extend.

## Decisions to ADR at kickoff (assign next free numbers; SPINE-A…H)

| ID | Decision |
|---|---|
| SPINE-A | Append-only JSONL is truth in **canonical serialization** (UTF-8, LF, sorted keys, no insignificant whitespace); `sha` = SHA-256 over the canonical event excluding the sha field. Canonical read path = JSONL scan (Node ≥18 everywhere); `node:sqlite` (Node 22+) is an optional accelerator behind an equivalence gate. Native-dep sqlite banned |
| SPINE-B | Spine lives in the INSTANCE at `.claude/state/hq/` — never in the mold's payload, never synced, excluded like `state/` (golden gate untouched) |
| SPINE-C | Closed event-kind vocabulary v1 (18 kinds, Appendix A) — extensions only via ADR |
| SPINE-D | Brief + inbox are CLI-first (`.claude/scripts/hq/`); the HTML dashboard is a later cycle's consumer of the same reader API |
| SPINE-E | Secret redaction at emit, fail-safe: scanner failure → payload dropped, **stub-only** `redaction.applied` (no field names, values, or lengths) |
| SPINE-F | Immutability windows: active day append-only; closed day immutable forever (`day.closed` carries file sha). Corrections only via `supersedes` |
| SPINE-G | **The spine is arc's only public API**: one reader lib/CLI (kind/since/venture filters) + per-consumer cursors + `consumes:` manifest declarations; direct file/db access = lint violation. NO pub/sub daemon/bus/watcher — polling cursors now; a future scheduler makes the same contract event-driven with zero consumer changes |
| SPINE-H | Emitter dual-mode: hook mode never blocks (quarantine + SKIP + exit 0); strict mode exits 2. One validator core |

## Non-negotiables

- Append-only forever; corrections supersede (SPINE-F).
- Emitter/validator/replayer/reader are parser-class code → **mandatory adversarial
  construct-a-breaking-input pass, holes fixed + pinned as red fixtures, BEFORE FAIL-mode
  promotion** (council v2+v3: 43-hole history).
- Twin determinism cases (REQ-04 a+b) enter CI at Phase 0-B and never leave.
- No secrets on the spine — redaction fail-safe, stub-only, never fail-open (SPINE-E).
- Hook-mode emitter can never block or fail a session; `arc_hook_field` guard chain untouched.
- No module reads `events/*.jsonl` or `state.db` directly except the spine reader —
  grep-lint WARN-first (SPINE-G).
- Canonical serialization defined ONCE, shared by emitter/hasher/reader.
- Inherited whole: zero-dep Node · bash-3.2/POSIX · no GNU-only constructs (macOS BSD leg)
  · every script ships bats (central `tests/`, ADR-0021) · CI red = no merge · golden
  bare-sync byte-identical · new lints WARN in TRIAL · evidence bundle per phase-done.
- The 8 existing kickoff-lint trial gates stay WARN this cycle (escape-hatch precondition,
  council session 001) — this initiative does not touch them.

## No-gos

- No pub/sub daemon/bus/file-watcher — cursors + polling only.
- No dashboard UI · no scheduler/cron (every run human-started) · no policy ENGINE.
- No engine module (Claude Code is the implicit driver) · no `processes/` canonicalization.
- No discover/growth/leads/ops modules · no ledger MODULE (revenue events only).
- No new slash commands (CLIs only) · no Postgres · no HTTP listener · no MCP endpoint.
- No hash chaining beyond per-event sha + day-close file sha.
- No native-dependency sqlite. No attic revival (ADR-0023 stands).

## Rabbit holes

Event-taxonomy bikeshedding (18 kinds, full stop) · reader feature creep (kind/since/venture,
nothing more — sqlite3 CLI answers ad-hoc questions) · bus temptation (re-read SPINE-G) ·
dashboard temptation · perfect cost accounting (nullable + `source`) · Windows Unicode chase
(canonical form + pinned CRLF/BOM fixtures only).

## Assumptions ledger

| Assumption | Trigger it's wrong | Phase |
|---|---|---|
| Hook fragments capture enough factory actions | dry-run golden shows a gap → add command-level emission | 1 |
| JSONL-scan brief <5s at realistic volume | ≥5s on owner's box with 90-day synthetic spine → promote sqlite accelerator to recommended (equivalence-gated) | 0-B |
| Emitter overhead negligible | >1s added per session event → async append | 1 |
| Real work available for the 5-day dogfood | none mid-build at Phase 4 → dogfood arc's own development (mold factory actions are events too) | 4 |
| File-drop/manual ingest sufficient for revenue | provider is webhook-push-only → manual entry from dashboard export until a later cycle | 2 |

## External dependencies

None new (zero-dep). Phase-4 real-work host: arc itself and/or venturemind /
Opportunity-Scout (both already carry arc installs — access confirmed at Phase 4 entry).
Revenue source: fixture payloads (incl. same-day AND cross-day duplicate pairs) → provider
export or manual CLI.

## Pre-mortem (top 6)

| # | Failure cause | Mitigation |
|---|---|---|
| 1 | Parser holes in emitter/validator/reader (43-hole class) | Adversarial pass + pinned corpus at Phase 0-A, before anything consumes the spine |
| 2 | Silent wiring gaps — "replayable day" is a lie | Dry-run golden sequence + weekly gap audit (session-log vs spine) at Phase 4 exit |
| 3 | Write-only noise — nobody reads | One-screen brief (REQ-05) + 5/5 daily reads (REQ-07) + kill criteria |
| 4 | Windows breaks determinism | Canonical serialization + pinned fixtures + twin determinism CI from 0-B |
| 5 | Session blocked by its own telemetry | Dual-mode emitter (SPINE-H), guard-chain regression bats |
| 6 | Consumers couple to internals | SPINE-G reader-only rule + grep-lint + REQ-09 cursor demo |

## Phases (risk-ordered, step-by-step)

**Phase 0 — Spine core (5 days, TWO checkpoints; ckpt B starts only after A's adversarial pass):**
- *Ckpt A (~3d):* `arc-event.sh` — `emit` (hook mode: validate→redact→append; invalid →
  `events/_quarantine/` + SKIP + exit 0) and `--strict` (exit 2) · canonical serializer +
  SHA-256 (sha excluded) · ULID gen · redaction (deny-patterns, fail-safe stub) · hostile
  corpus pinned (≥12 fixtures: missing field · bad ULID · bad ts · dup idem · oversize ·
  secret-in-payload · CRLF/BOM · non-UTF8 · nested quotes · evidence path traversal ·
  unknown kind · schema-version mismatch) · **adversarial pass, holes fixed + pinned.**
- *Ckpt B (~2d):* `arc-replay.mjs` (JSONL → derived state; whole-spine idem index rebuilt
  every replay; node:sqlite accelerator + JSONL canonical path) · `spine` reader v1
  (`--kind --since <ulid> --venture` + cursor helpers) · twin determinism bats in CI ·
  sqlite-vs-scan equivalence gate.
- DoD: all fixtures green 3-OS · adversarial report committed · twin determinism in CI.

**Phase 1 — Factory wiring (2.5d):** EVENT.d `NN-emit` fragments (SessionStart/End,
PostToolUse summary) + explicit emissions in kickoff/phase-done/review/qa/commit/ship/
council flows · dry-run golden sequence (REQ-01) · overhead measured (<1s or async) ·
redaction live · guard-chain regression bats.

**Phase 2 — Money + brief (2.5d):** strict-mode revenue ingest with cross-day idem dedupe
(REQ-03) + `revenue.simulated` path · `arc brief` via reader only, one-screen noise budget
(REQ-05) · nullable cost (REQ-08 stretch).

**Phase 3 — Inbox + API seal (1.5d):** `approval.requested` emission points (kickoff,
phase-done request-OK moments) · `arc inbox` / `arc approve/reject` → `decision.recorded`
· cursor catch-up bats · reader-only grep-lint enters TRIAL (REQ-06, REQ-09).

**Phase 4 — Live dogfood (3d effort / ≥5 elapsed):** 5 consecutive real days · daily brief
reads (≤ one screen held) · honest revenue rules · weekly gap audit · evidence bundle
(days' JSONL + briefs + audit) · `/arc-retro` + TRIAL promotion review.

**North-star:** 100% of factory actions + revenue with receipts during dogfood · briefs
read 5/5 days and ≤ one screen · twin replay determinism green in CI from 0-B onward.

## Appendix A — event kinds v1 (18, closed)

`idea.captured` · `council.verdict` · `approval.requested` · `decision.recorded` ·
`kickoff.done` · `phase.closed` · `review.completed` · `qa.completed` · `commit.done` ·
`ship.done` · `revenue.received` *(real only)* · `revenue.simulated` *(never in P&L)* ·
`cost.incurred` · `run.completed` · `incident.raised` · `redaction.applied` ·
`day.closed` · `note.logged`

## Appendix B — event schema v1 (normative)

```json
{ "id": "ULID", "v": 1, "ts": "RFC3339+05:30", "idem": "sha256(source:natural-key)",
  "actor": "arc-phase-done | human:ashiq | ingest:revenue", "process": "phase-done@x.y.z",
  "model": "driver:model-id | null", "venture": "slug | arc", "run_id": "r-…",
  "kind": "Appendix A", "payload": { "no secrets — redacted at emit" },
  "outcome": "ok | fail | partial",
  "cost": null,
  "cost_alt": { "tokens_in": 0, "tokens_out": 0, "inr_estimate": 0, "source": "measured|estimated|manual" },
  "evidence": "path | null", "supersedes": "id | null",
  "sha": "SHA-256 over canonical form, sha field excluded" }
```

---

## KICKOFF PROMPT — paste into Claude Code in the arc repo

```
/arc-kickoff Cycle 2 — Receipt Spine

Design source: docs/strategy/plans/PLAN-cycle2-receipt-spine-v2.1.md — approved, grounded
against the closed orchestrator initiative (2026-07-22). Read it fully; context in
docs/strategy/plans/README.md. This answers PROGRESS.md's open question: next initiative =
Receipt Spine; the v2 world-best initiative stays parked (ADR-0017).

Instructions:
- Archive the closed orchestrator PLAN.md + PROGRESS.md to docs/archive/ per the ADR-0017
  pattern, then write the new tracker FROM the design source.
- Its decisions are locked (9 REQs, SPINE-A..H, 18-kind vocabulary, schema v1, appetites,
  no-gos). Do not re-litigate; assign SPINE-A..H the next free ADR numbers (0024+ — verify
  against docs/adr/). If anything contradicts current repo state, STOP and flag it to me.
- Tests go in central tests/ (ADR-0021). New module = hq: products/hq/manifest.json +
  .claude/scripts/hq/. No new slash commands. Spine data = instance .claude/state/hq/,
  never in the sync payload.
- The 8 kickoff-lint trial gates stay WARN — untouched this cycle.
- STOP after PLAN.md + phases/phase-00..04-spec.md are written and kickoff-lint passes —
  I review and approve before any Phase 0 code.
```
