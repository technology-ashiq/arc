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

## Verification plan (concrete — refined at phase start 2026-07-23, owner-approved)

Red-first Golden Loop, risk-ordered; **W8 is the reserved second scope-cut** (drop first
under appetite pressure — W6 alone still closes DoD-3).

- **W1** — `arc-inbox.mjs` (NEW, reader-only) `inbox`/`approve`/`reject`: bats proves list-open
  → approve/reject writes exactly ONE `decision.recorded`; open-set recomputed via the reader.
- **W2** — refusal path: unknown-ID → `UNKNOWN_APPROVAL`, wrong-kind → `WRONG_KIND`,
  already-decided (incl. DIFFERENT reason) → refused, decision count stays 1, empty/non-ULID
  → `BAD_ARGS`, concurrent → exactly one. Guard = app read-check **+** `(kind|decides)` `--idem`.
- **W3** — replay-identical: `rm derived && arc-replay` → inbox+brief byte-identical; rebuilt
  idem index still blocks re-decide; only new bytes in `events/`+`derived/` (no state outside spine).
- **W4** — `approval.requested` emission points live: kickoff plan-approval + phase-done sign-off
  (hook-mode, never blocks); brief routes them to needs-you; manifest + tree-manifest updated.
- **W5** — reader-only grep-lint enters TRIAL: `.claude/scripts/review/spine-reader-lint.sh`
  glob-scans tracked hq source; `mode: warn` `tier: hook` row in `arc.gates.yaml`; gates.bats 5→6.
  **MUST-SHIP — never the cut.**
- **W6** — same-ms-burst fixture (`tests/fixtures/spine/same-ms-burst/`) + `--since` catch-up walk
  + a mutation test proving append-order, never ULID string compare. **Closes DoD-3 on its own.**
- **W7** — **mandatory adversarial** construct-a-breaking-input pass over the decision/inbox
  parser path (6 lenses, skeptic-reproduces-before-CONFIRMED); holes fixed + pinned in BOTH modes
  BEFORE FAIL-mode promotion; report in `docs/evidence/phase-03/adversarial-report.md`.
- **W8** — per-consumer cursor store (`spine cursor get/set <consumer>` at
  `.claude/state/hq/cursors/`). **CUT — the pre-planned reserved cut, taken 2026-07-24
  (owner-informed).** REQ-09's measurable acceptance and DoD-3 are fully met by W5 (grep-lint)
  + W6 (catch-up-from-cursor via `--since` + same-ms-burst); a persistent store would only serve
  future dashboard/evolve modules (this-cycle no-gos), so building it now is speculative infra
  no current consumer uses. Banked; drops no REQ and no DoD checkbox.

**Decisions locked at phase start (owner-approved 2026-07-23):**
- Decision payload validated at the spine core (`assertDecision()` in `validate.mjs`) — a malformed
  decision can never be sealed (REQ-02 alignment). **[owner: yes]**
- `arc-inbox.mjs` is a NEW dedicated reader-only script, not bolted onto emitter/reader. **[owner: yes]**
- No-duplicate = read-check + `(kind|decides)` idem key · `payload.decides` is the fold key ·
  grep-lint lives at `.claude/scripts/review/`. **[locked defaults]**

**CI tripwires handled on every synced edit:** `gates.bats` count 5→6 · sync-golden `tree-manifest` regen.

DoD mapping: W4→DoD-1 · W1+W2+W3→DoD-2 · W6(+W8)→DoD-3 · W5→DoD-4 · W7+packaging→DoD-5.
Evidence in `docs/evidence/phase-03/` (red/green logs, replay-identity, cursor-burst, adversarial
report, golden-regen diff, scan verdict).

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
