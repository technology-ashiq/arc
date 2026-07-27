# Phase 01 — Factory wiring

**Goal (one line):** Every factory action leaves a receipt — EVENT.d `NN-emit` fragments +
explicit flow emissions produce the golden dry-run sequence without ever disturbing a session.
**Appetite:** 2.5 days
**Depends on:** phase-00

## Exit criteria (Definition of Done)

- [ ] EVENT.d `NN-emit` fragments (SessionStart/End, PostToolUse summary) dropped via the
      existing dispatcher — hooks themselves untouched; fragments listed in
      `products/hq/manifest.json` (product-lint green).
- [ ] Explicit emissions in the kickoff / phase-done / review / qa / commit / ship / council
      flows, kinds per PLAN Appendix A only.
- [ ] Dry-run golden sequence green (REQ-01): scripted session kickoff → phase-done →
      review → qa → commit → ship produces the expected sequence; every event passes strict
      validation; matches golden — order-insensitive WITHIN one command's own emissions
      only, never across commands.
- [ ] Overhead measured: <1s added per session event, or async append (assumptions ledger).
- [ ] Redaction live on real emissions; guard-chain regression bats green
      (`arc_hook_field` untouched).
- [ ] Durability bats: emitter killed mid-append (SIGKILL/hard-exit) → zero torn lines,
      zero silently-lost acknowledged events; concurrent-emitter interleave fixture green.
- [ ] Tracker updated · evidence bundle written.

## Verification plan

- **Test command:** `npx bats tests/spine-wiring.bats` then `tests/spine-golden-dryrun.bats`
  (one file at a time, foreground).
- **Expected failure first:** the golden dry-run lands RED before each flow's emission
  exists — the missing-kind diff names the gap (this is also assumptions-ledger row 1's
  trigger check: hook fragments alone vs command-level emission).
- **Live demo scenario:** a real session on this repo with fragments live — work normally
  for one session, then `arc brief --date <today>` (Phase-0 renderer) shows the session's
  receipts; `kill -9` an in-flight emit → session unaffected, JSONL intact, no torn line.
- **Real-system check:** SessionStart/SessionEnd timing measured on the owner's Windows
  box — no perceptible session delay (<1s per event); one full working session's events
  strict-validate afterwards.
- **Expected evidence:** `docs/evidence/phase-01/` — golden dry-run output · overhead
  numbers · guard-chain bats · durability bats.

## Rabbit holes in this phase

- Emitting kinds beyond the 18 (vocabulary is closed — ADR-0026; anything else is
  `note.logged` or waits for an ADR).
- Polishing PostToolUse summaries into prose — payload is data, not narrative.
- Async-queue engineering before the >1s trigger actually fires.

## Out of scope for this phase

- Revenue ingest + brief polish (Phase 2) · approvals (Phase 3) · consumer-repo installs
  (Phase 4) · any change to the 8 kickoff-lint trial gates.

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
