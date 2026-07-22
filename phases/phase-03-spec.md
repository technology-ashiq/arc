# Phase 03 — Inbox + API seal

**Goal (one line):** Approvals become receipts and the reader becomes the sealed, only API.
**Appetite:** 1.5 days
**Depends on:** phase-01

## Exit criteria (Definition of Done)

- [ ] `approval.requested` emission points live (kickoff, phase-done request-OK moments).
- [ ] `arc inbox` lists `approval.requested` via the reader; `arc approve/reject ID
      --reason` writes `decision.recorded`; full request→decision flow replays identically;
      no approval state outside the spine; unknown or already-decided ID → pinned error
      fixture (non-zero exit, no duplicate `decision.recorded`) (REQ-06).
- [ ] Cursor catch-up bats (REQ-09), including the same-millisecond-burst fixture proving
      `--since` resolves ties by append order (file order), never raw ULID string comparison.
- [ ] Reader-only grep-lint enters TRIAL: `mode: warn` row in `arc.gates.yaml`, glob-scan
      over tracked source paths; `brief`/`inbox` code contains zero direct `events/*.jsonl`
      or `state.db` references.
- [ ] Tracker updated · evidence bundle written.

## Verification plan

Coarse (refined via `/arc-change` when the phase starts): inbox flow bats (request →
decision → replay-identical) red-first → green · double-decision + unknown-ID fixtures ·
cursor catch-up + same-ms burst · grep-lint visible in gates output as TRIAL/WARN ·
evidence in `docs/evidence/phase-03/`.

## Rabbit holes in this phase

- Approval UX beyond list + decide — no notification plumbing, no reminders.
- Policy logic of any kind (no-go: no policy ENGINE — approve/reject is human-only).

## Out of scope for this phase

- Dogfood (Phase 4) · auto-approval rules · bus/watcher (ADR-0030) · promoting the new
  grep-lint past WARN · any change to the 8 kickoff-lint trial gates.

## Your-setup / pending

- None.

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
