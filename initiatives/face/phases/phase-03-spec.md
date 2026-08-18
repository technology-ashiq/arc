# Phase 03 — L2 `arc dash` (the steel thread of the doors)

**Goal (one line):** one zero-dep node server in the arc repo (product `hq`): ONE read
door + ONE decision door + ask proxy, fixture-proven, attacked by two fresh agents.
**Appetite:** 4 days (day-2 checkpoint: spine-health reader landed + `arc-inbox`
function extracted, else the remaining deliverables — decision door, hostile-payload
fixtures, ask proxy, sim/replay modes, journal, two attacker passes — do not fit days
3–4 and Phase 03 splits at day 2; block B tripwire at day 4: parity + reader lint +
<1 s fixture green, else Tape cut to a day picker; parity not green → L3 does not
start, ship L2 alone)
**Depends on:** phase-00

## Exit criteria (Definition of Done)

- [ ] read door: `/api/spine?since=<ULID>` · `/api/health` · `/api/brief` · `/api/inbox` ·
      `/api/pnl` · `/api/board` · `/api/lane/:x` · `/api/registry` · `/api/file/:id`
      (allow-listed sanctioned ids only, through the lints' imported parsers — ADR-1301)
- [ ] spine-health reader (quarantine counts by refusal code, idem-index size, torn lines)
      added to `spine.mjs` itself **via `/arc-change`** — no consumer opens `_quarantine/`
      or `derived/`
- [ ] the read door refuses to serve **live mode** from inside a linked worktree —
      `assertNotLinkedWorktree` extended to `arc dash`'s live-mode boot path; a worktree
      instance exits with a named refusal instead of serving an empty/stale spine as
      current (retro 2026-07-28: a day with zero receipts read as "no work happened");
      fixture/sim/replay modes with an explicitly named spine path stay allowed —
      labelled, never as live
- [ ] decision door: `arc-inbox` approve/reject extracted into an importable function
      (via `/arc-change`), `/api/decide` calls it; **byte-parity fixture** green
      (CLI vs door → every envelope key identical except `id`/`ts` — the LIVE envelope
      carries 16 keys, counted off a real line 2026-08-19; the design source's "15" was a
      stale doc count, and the fixture derives the key list from the emitted event itself,
      **`actor` named and asserted identical** — the fixture states both callers'
      actor values explicitly and fails if the door substitutes its own); route-
      enumeration fixture proves no other mutating route
- [ ] ask proxy: `/api/ask` shells to `arc-run --process face-ask` (stub acceptable until
      Phase 07 lands the process — refusal is the honest response before that)
- [ ] security — the full auth/origin matrix, not three words (second-opinion finding
      4): bind the literal `127.0.0.1` (an IPv6 `::1` instance only if explicitly
      configured, same rules); per-session token travels in the `Authorization` header
      ONLY — never a cookie, never a query string — so a hostile page cannot ride
      ambient credentials; requests with an absent, `null`, or non-matching `Origin`
      are rejected on EVERY route with a named refusal; zero CORS allowances (no
      preflight approval ever); a hostile-local-page / DNS-rebinding fixture proves a
      browser page on another origin can neither read nor decide
- [ ] output contract: JSON values are served display-safe (HTML-escaped at the
      serializer per the design source) and that representation contract is WRITTEN
      into the door's docs — byte-parity (REQ-03) is about the spine WRITE, never the
      read representation; hostile-payload fixtures green at the door (`<script>`,
      RTL/bidi, 64 KB body → escaped, capped)
- [ ] cursor fixture: 10k-event fixture spine, `since=` pagination, **<1 s p95**, plus a
      torn-line / mid-write day-file case (a truncated last line in the currently-open
      day-file, the same class the spine-health reader counts) — the door skips or
      quarantines it without breaking the cursor or hanging the page (assumption row 1)
- [ ] cursor CONTRACT written and fixture-tested (second-opinion finding 6): `since=` is
      ULID-exclusive with stable total ordering; page cap + `next` cursor named in the
      response; a malformed or unknown cursor is a named refusal, never an empty 200;
      mid-read appends to the open day-file cannot skip or duplicate events (line-
      boundary reads; sealed days are the immutable replay boundary per REQ-05)
- [ ] as-of REPLAY contract on the read door (second-opinion finding 3): every
      spine-derived endpoint (`spine` · `brief` · `inbox` · `pnl` · `board` · `lane`)
      accepts an `asof=` day parameter and re-derives from the log ≤ that day; one
      replay-identical fixture PER endpoint (full log vs replay → same JSON bytes on
      sealed days) — written here so Phase 04's Tape consumes a contract, not a hope
- [ ] sim + replay modes served and labelled (ADR-1310); local request journal written
      (evidence for REQ-10, not truth)
- [ ] reader-only lint (extended to L2) green; **two fresh attackers** run — one on the
      decision logic, one on the HTTP/shell boundary — attacker prompt carries the lane's
      fixed-defect list; found holes fixed + pinned as fixtures
- [ ] tests green on CI per job; tracker updated

## Verification plan

One coarse line, refined at phase start via `/arc-change`: all fixtures in the PLAN's
fixture set for REQ-09 green on CI per job (parity · hostile payloads · cursor <1 s ·
route enumeration · replay-identical), each asserting it RAN before what it printed —
**the parity fixture's CLI-side run targets a non-canonical fixture spine path**, since
`assertNotLinkedWorktree` refuses any `arc-inbox` emit from this lane's worktree
(`arc-face`) or from a CI runner, neither of which is the main clone.

## Rabbit holes in this phase

Endpoints beyond the sanctioned set · websockets/daemon (no-go) · a sqlite cache before
the fixture demands it (assumption row 1 decides, not taste).

## Out of scope for this phase

All L3 UI (Phase 04) · `face:` manifest sections (Phase 05) · the real `face-ask` process
(Phase 07) · hosting/tenancy (ADR-1314).

## Your-setup / pending

None — localhost only.

## Non-negotiables (verbatim from PLAN)

- One write path, mandatory reason, byte-parity with the CLI (E2, E1, ADR-1302).
- Reader-only over the spine; no second truth in the UI (SPINE-G/ADR-0030, A5, ADR-1301).
- Every number has *Why?* precedents; no invented numbers, ETAs, health emoji (A1, E3).
- Real vs simulated/rehearsal/drill never mixed or summed; MISSING ≠ 0; ABSENT with reason (E3, ADR-1313, ADR-1018, ADR-0416).
- Kinds, gates, lanes, ADR ids verbatim (A5); unknown kinds/profiles render generically — nothing dropped silently (E1, ADR-1306).
- Seals for every forever-human action; no button ever exists for them (E2, ADR-1303, ADR-0069 b1, ADR-0305, ADR-0110, ADR-1203).
- Localhost + token; no PII; escaped serializer (ADR-1312, ADR-0410, LED-C, SPINE-E).
- Design lane law: three theses, blind jury with reference, owner pick + prediction, two critique rounds max (ADR-1308, ADR-0034…0049).
- Every new face lint starts WARN-first in the TRIAL set and earns FAIL through the trial ledger (A1) — `face-coverage` excepted (a validator over the tree, FAIL from birth like policy-lint, ADR-1311).
- The Engine room's unlock-ladder rung indicator reads evidence only — the rung is never a control (E2).
- Tests green on CI per job; two fresh attackers per gate (decision logic + shell/HTTP boundary); attacker prompt carries the lane's fixed-defect list; vacuous-pass rule (assert it RAN before asserting what it printed).
- Zero product-code writes before explicit owner approval of this plan; L3 stack never enters the arc repo (ADR-1300, ADR-1309).
