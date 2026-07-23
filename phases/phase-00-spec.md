# Phase 00 — Spine core (emitter · canonical serializer · replay · reader)

**Goal (one line):** The spine exists and cannot be poisoned — dual-mode emitter + canonical
serializer + hostile corpus survive an adversarial pass (ckpt A), then replay + reader +
twin determinism enter CI (ckpt B).
**Appetite:** 5 days (ckpt A ~3d · ckpt B ~2d; **ckpt B starts only after ckpt A's
adversarial pass**)
**Depends on:** none

## Exit criteria (Definition of Done)

Checkpoint A — emitter + corpus:
- [ ] `.claude/scripts/hq/arc-event.sh` — `emit` in hook mode (validate → redact → append;
      invalid input → `events/_quarantine/` + loud SKIP + exit 0) and `--strict` (exit 2 on
      the same inputs) — one validator core (ADR-0031). Secret handling per ADR-0028: HIT →
      refused, stub-only quarantine record (secret bytes never persisted anywhere); scanner
      FAILURE → payload dropped + stub-only `redaction.applied`. Append path: ALL writes go
      through one shared Node helper — acquire `events/.lock` (bounded retry), write the
      full canonical line in a single append call, fsync, release; no direct shell appends
      (assumptions ledger row 6 names the fallback).
- [ ] Canonical serializer defined ONCE (UTF-8, LF, sorted keys, no insignificant
      whitespace) + SHA-256 (`sha` field excluded) + ULID gen — zero-dep, shared by
      emitter/hasher/reader (ADR-0024).
- [ ] Hostile corpus pinned in `tests/fixtures/spine/` — ≥15 fixtures: missing field ·
      bad ULID · bad ts · dup idem · oversize payload (canonical event > 64 KiB — the
      schema-level cap, PLAN Appendix B) · plain secret · obfuscated secrets
      (split-line, base64, whitespace-varied — pre-mortem #5) · CRLF/BOM · non-UTF8 ·
      nested quotes · evidence path traversal · unknown kind · schema-version mismatch ·
      duplicate-key object · case-varied enum value · embedded-newline-mid-value ·
      torn/partial-line (kill mid-append) · concurrent-append interleave. **Each fixture
      asserted in BOTH modes** (REQ-02).
- [ ] Idem uniqueness has a source at ckpt A (blocker fix, 2026-07-22): the emitter checks
      `idem` against `.claude/state/hq/derived/idem.index` — an append-only sidecar of
      `idem<TAB>event-id` lines, DERIVED not truth (`arc-replay` rebuilds it whole from the
      spine at ckpt B). A missing index on a fresh instance is an empty set, never an error;
      a duplicate within one run AND a duplicate across days both reject (strict) /
      quarantine (hook). Index writes happen under the same lock as the append.
- [ ] Adversarial construct-a-breaking-input pass run against emitter/validator/serializer;
      every hole fixed + pinned as a red fixture; report committed (43-hole rule).

Checkpoint B — replay + reader + CI:
- [ ] `.claude/scripts/hq/arc-replay.mjs` — JSONL → derived state at
      `.claude/state/hq/derived/state.db`; whole-spine idem index rebuilt every replay;
      `node:sqlite` accelerator behind the sqlite-vs-scan equivalence gate; JSONL scan
      stays the canonical path (ADR-0024).
- [ ] `spine` reader v1 at `.claude/scripts/hq/spine.mjs` (lib + CLI in one file) —
      `--kind` `--since <ulid>` `--venture` + cursor helpers, nothing more (ADR-0030).
- [ ] Minimal `arc brief --date D` renderer at `.claude/scripts/hq/arc-brief.mjs`
      (JSONL-scan render only — REQ-04's acceptance invokes it before Phase 2 exists;
      grouping/noise budget stay Phase 2).
- [ ] Twin determinism bats in CI (REQ-04 a+b): (a) `rm state.db && arc-replay &&
      arc brief --date D` byte-identical to golden; (b) no-sqlite leg byte-identical via
      the JSONL-scan path. CI matrix gains the Node 18 leg + a Node 22+ leg (PLAN external
      dependencies).
- [ ] sqlite-vs-scan equivalence gate defined and green (blocker fix, 2026-07-22):
      `tests/spine-equivalence.bats` runs `arc-replay` + `arc brief --date D` twice over the
      SAME spine — once with the `node:sqlite` accelerator (`ARC_SPINE_ENGINE=sqlite`), once
      forced onto the canonical JSONL-scan path (`ARC_SPINE_ENGINE=scan`) — across both the
      golden fixture spine and the 90-day synthetic spine. Pass = byte-identical stdout AND
      identical derived-state dumps; the (empty) diff is the committed evidence artifact.
- [ ] Volume check operationalized (blocker fix, 2026-07-22 — assumptions ledger row 2):
      `tests/fixtures/spine/gen-synthetic.mjs` generates a deterministic 90-day synthetic
      spine (seeded PRNG, timestamps passed in — no wall-clock, no `Math.random`);
      `arc brief` is timed against it on the owner's Windows box. <5s → assumption holds,
      the measured number goes in the evidence bundle; ≥5s → the trigger fires, the sqlite
      accelerator is promoted to recommended (equivalence-gated) and the ledger row updated.
- [ ] Module registered: `products/hq/manifest.json` lists every hq file
      (`node .claude/scripts/core/product-lint.mjs` green — blocking CI step);
      `.claude/scripts/core/arc-products.mjs` `CATALOG` gains `hq`; manifest declares
      NO `.claude/state/**` path (bats-asserted). Golden `tests/fixtures/sync-golden/
      tree-manifest.txt` regenerated ONCE with a reviewed diff — every added line must be a
      `.claude/scripts/hq/**` path and nothing else; rsync-path vs cp-path output stays
      byte-identical; no `.claude/state/**` line ever appears (it is under the `state`
      exclude — the real SPINE-B gate).
- [ ] All fixtures green on 3-OS CI · tracker updated · evidence bundle written.

## Verification plan

- **Test command:** `bats tests/spine-emit.bats` then `tests/spine-replay.bats` then
  `tests/spine-reader.bats` then `tests/spine-equivalence.bats` (one file at a time,
  foreground — the globally installed `bats`, which is what CI runs; `npx bats` mis-resolves
  the loader path on Windows) + `node .claude/scripts/core/product-lint.mjs` + `node
  .claude/scripts/plan/kickoff-lint.mjs`.
- **Expected failure first:** every hostile fixture lands RED before its guard exists
  (write fixture → watch strict mode wrongly accept / hook mode wrongly append → fix →
  green); the twin-determinism case lands RED before canonical serialization is wired into
  the reader path.
- **Live demo scenario:** on the owner's Windows box — `arc-event emit note.logged …`
  appends one valid event to `.claude/state/hq/events/<today>.jsonl`; feed the plain-secret
  fixture in hook mode → loud SKIP, exit 0, stub-only quarantine record, nothing on the
  spine; same input with `--strict` → exit 2; `rm state.db && arc-replay && arc brief
  --date <today>` reproduces the byte-identical brief.
- **Real-system check:** a real Claude Code session on this repo with the emitter installed
  but NOT yet wired (wiring is Phase 1) — session behaves normally; `arc_hook_field`
  guard-chain bats still green; bare `sync-to-project.sh` output still matches the golden.
- **Expected evidence:** `docs/evidence/phase-00/` — adversarial report · fixture list ·
  3-OS CI run link · equivalence-gate output (empty diff) · measured brief time against the
  90-day synthetic spine · bare-sync golden diff (empty).

## Rabbit holes in this phase

- ULID library shopping — zero-dep rule: implement Crockford base32 inline (one-page spec);
  no npm package, ever.
- Perfect redaction pattern set — start from gitleaks-class basics + the pinned fixtures;
  the corpus grows via the adversarial pass and dogfood, not speculation.
- Windows Unicode chase — canonical form + pinned CRLF/BOM/non-UTF8 fixtures only.
- Reader features beyond `kind`/`since`/`venture` — the sqlite3 CLI answers ad-hoc questions.

## Out of scope for this phase

- Factory wiring (EVENT.d fragments, flow emissions) — Phase 1.
- Revenue ingest, one-screen brief polish, cost — Phase 2. Inbox/approvals — Phase 3.
- Promoting the sqlite accelerator to recommended (only if the <5s assumption fires).
- Any spine data in the sync payload; any change to the 8 kickoff-lint trial gates.

## Your-setup / pending

- None — all decisions locked (ADR-0024..0031). Node ≥18 confirmed on the owner's box;
  a local Node 22+ is optional (only to exercise the sqlite accelerator locally).

## Non-negotiables (verbatim from PLAN)

- Append-only forever; corrections supersede (ADR-0029).
- Emitter/validator/replayer/reader are parser-class code → **mandatory adversarial
  construct-a-breaking-input pass, holes fixed + pinned as red fixtures, BEFORE FAIL-mode
  promotion** (council v2+v3: 43-hole history).
- Twin determinism cases (REQ-04 a+b) enter CI at Phase 0-B and never leave.
- No secrets on the spine — redaction fail-safe, stub-only, never fail-open (ADR-0028).
- Hook-mode emitter can never block or fail a session; `arc_hook_field` guard chain
  untouched. Appends are durable and atomic: an emitter killed mid-append (SIGKILL/hard-exit)
  leaves zero torn lines and zero silently-lost acknowledged events, and two concurrent
  emitters never interleave a torn/partial line — pinned fixtures (Phase 0 corpus + Phase 1
  bats; exit-timing-race class, `docs/retro-log.md`).
- No module reads `events/*.jsonl` or `state.db` directly except the spine reader —
  grep-lint WARN-first (ADR-0030), wired as a `mode: warn` row in `arc.gates.yaml` (same
  schema as the existing gate rows — unregistered, it never runs), scanning by glob over
  tracked source paths (not a hardcoded file list) so consumers added after this cycle are
  covered without a lint edit.
- `products/hq/manifest.json` never declares a `.claude/state/**` path in `files`/`scripts`/
  `docs`: `arc-products.mjs`'s `assertSafe` has no state-tree rule, so a `--products hq`
  selective install would copy spine data into a consumer's payload — the golden bare-sync
  gate only covers the full-sync path (ADR-0025). Asserted by a Phase 0 bats case.
- Canonical serialization defined ONCE, shared by emitter/hasher/reader (ADR-0024).
- Inherited whole: zero-dep Node · bash-3.2/POSIX · no GNU-only constructs (macOS BSD leg)
  · every script ships bats (central `tests/`, ADR-0021) · CI red = no merge · golden
  bare-sync byte-identical · new lints WARN in TRIAL · evidence bundle per phase-done.
- The 8 existing kickoff-lint trial gates stay WARN this cycle (escape-hatch precondition,
  council session 001) — this initiative does not touch them.
