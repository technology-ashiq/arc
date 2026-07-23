# Phase 02 — Money + brief

**Goal (one line):** Money reaches the spine exactly once and the day reads in one screen.
**Appetite:** 2.5 days
**Depends on:** phase-00

## Exit criteria (Definition of Done)

- [ ] Strict-mode revenue ingest (REQ-03): `arc-event ingest revenue.received --json FILE`
      validates amount/currency/venture; the same payload twice — same-day AND cross-day —
      yields ONE event (idem index, fixture pairs pinned).
- [ ] `revenue.simulated` path — separate kind, never mixed into P&L truth (ADR-0026).
- [ ] `arc brief` via the reader ONLY (REQ-05, CLI-first per ADR-0027): ≤40 lines,
      needs-you / money / progress / background grouping, overflow collapses to counts
      (+ `--full`), golden-fixtured, <5s on the owner's Windows box.
- [ ] REQ-08 (stretch, first cut under pressure): `cost` union (null | object — PLAN
      Appendix B clarification); brief shows daily spend when present.
- [ ] Tracker updated · evidence bundle written.

## Verification plan

**Revenue payload schema (defined at phase start — arc is pre-revenue, so manual/simulated):**
`revenue.received` / `revenue.simulated` payloads carry `amount` (**positive integer, minor
units** e.g. paise — integers avoid float-aggregation error, `1 ≤ amount ≤ 1e12`), `currency`
(**ISO-4217**, three uppercase letters), and any provider metadata; `venture` is the envelope
slug (already validated). Ingest idem is content-derived (Phase 0), so an identical payload —
same-day OR cross-day — dedupes to ONE. The validator (`validate.mjs`) is EXTENDED with a
per-kind revenue check; no parallel validator.

- **Test command:** `bats tests/spine-ingest.bats` then `tests/spine-brief.bats` (one file at
  a time, foreground; global `bats`, not `npx`).
- **RED-first:** a `revenue.received` with a bad `amount`/`currency` is currently ACCEPTED —
  the payload is validated only as "an object" (validate.mjs:144) — so the reject cases land
  RED before the per-kind revenue check exists. The same-day/cross-day dedupe pairs
  characterise the Phase-0 idem mechanism (green from the start).
- **Adversarial pass (parser-class non-negotiable):** construct-a-breaking-input on the revenue
  check — missing / zero / negative / non-integer / float / unicode-digit / oversize amount;
  missing / lowercase / non-string / wrong-length currency — holes fixed + pinned as red
  fixtures in `tests/fixtures/spine/` BEFORE FAIL-mode promotion.
- **Live demo:** ingest a manual revenue payload twice → ONE event; `arc brief --date <today>`
  shows the money line; <5s on the owner's Windows box.
- **Evidence:** `docs/evidence/phase-02/` — ingest red/green, brief golden + noise-budget cases,
  timing.

## Rabbit holes in this phase

- Perfect cost accounting — nullable + `source`, stop (PLAN rabbit hole).
- Brief layout polish beyond the noise budget; reader feature creep.

## Out of scope for this phase

- Approvals/inbox (Phase 3) · provider webhook integration (assumptions row 5 fallback =
  manual entry) · dashboard (no-go) · any change to the 8 kickoff-lint trial gates.

## Your-setup / pending

- A real provider export sample (or confirm the manual-entry path) before phase close —
  fixture payloads carry the tests either way.

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
