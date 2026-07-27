# Phase 04 — Live dogfood

**Goal (one line):** The spine proven on ≥3 real working days with honest money
(amended from ≥5 consecutive, 2026-07-28 — see Amendment below).
**Appetite:** 3 days effort (≥5 elapsed calendar days) — unchanged and MET (07-24 → 07-28 = 5 elapsed)
**Depends on:** phase-02, phase-03

## Exit criteria (Definition of Done)

- [ ] ≥3 real working days (arc's own development): real events flowing, brief read daily,
      ≤ one screen held all 3 days (REQ-07, REQ-05 north-star). **Amended 2026-07-28 from
      "≥5 consecutive" — see Amendment #1 below.**
- [ ] Honest revenue rules held: `revenue.received` = real money only; pre-revenue →
      `revenue.simulated`, and REQ-07 closes "mechanism proven, live value pending" —
      never fake P&L truth.
- [ ] Weekly gap audit run (session-log vs spine — pre-mortem #2): every factory action in
      the session log has a receipt, or the gap is named and fixed.
- [ ] Evidence bundle: the days' JSONL + briefs + the gap audit (REQ-07).
- [ ] `/arc-retro` run + TRIAL review for the NEW grep-lint gate only — the 8 existing
      kickoff-lint trial gates stay WARN regardless (locked this cycle).

## Verification plan

Refined at phase entry (2026-07-24) via `/arc-change` — host confirmed, coarse plan made
concrete + checkable. In-scope refinement of REQ-07; no REQ added/dropped.

**Host (confirmed at entry): arc itself.** Spine live at `.claude/state/hq/`; receipts already
captured 2026-07-23 + 24 (proof-of-life). Venture repos deferred — venturemind / Opportunity-Scout
carry the arc *framework* but NOT the receipt-spine (no `scripts/hq/` emitter, `hq` unregistered),
so each would need a one-time install; not taken this cycle. Assumptions row 4 holds via its
arc-self branch — no FIRED.

**Window:** ≥3 real working days (amended 2026-07-28). Day N = Nth day real arc work happens (≥1
real factory action); Day 1 = first working day on/after entry (2026-07-24). Calendar span ≥5
elapsed — unchanged and met (07-24 → 07-28). **Days captured: 07-24, 07-25, 07-28** — NOT
calendar-consecutive, which is why "consecutive" was dropped rather than quietly assumed:
07-26 was a real arc working day whose receipts are MISSING (the open gap, still to be audited)
and 07-27 was Lexos work, outside this cycle's host scope.

**Each working day (1..5):**
1. Work normally — receipts auto-emit to `.claude/state/hq/events/DATE.jsonl` (Phase 1/3 wiring;
   no manual "make a receipt" step).
2. `arc brief` once → confirm it renders ≤ one screen (REQ-05); save output to
   `docs/evidence/phase-04/brief-DATE.txt`.
3. Copy that day's receipts → `docs/evidence/phase-04/events-DATE.jsonl` (live `hq/` is gitignored
   — SPINE-B — so the bundle must hold the copies to persist).
4. Log any `events/_quarantine/` entry (expected hook-mode reject) on the day's line.

**Revenue (honest money):** arc earns nothing real → ZERO `revenue.received`; exercise the money
path only via `revenue.simulated` (clearly practice). REQ-07 closes "mechanism proven, live value
pending." A real `revenue.received` requires a provider export — fabrication forbidden.

**Gap audit (pre-mortem #2, at window end):** diff `docs/session-log.md` (window dates) vs spine
receipts. Every logged factory action has a receipt, OR the gap is named + filed as `note.logged`
/ a post-cycle ADR — NO new emission points this phase (out of scope; vocabulary closed, ADR-0026).
Write → `docs/evidence/phase-04/gap-audit.md`.

**Quarantine review (ADR-0031):** review `events/_quarantine/` at close; explain each entry in
the bundle.

**Close:** bundle complete (per-day briefs + JSONL copies + gap-audit + quarantine note + summary)
→ `/arc-retro` → TRIAL review of the NEW reader-only grep-lint gate ONLY (8 existing kickoff-lint
trials stay WARN, locked this cycle) → `/arc-phase-done 4`.

**Checkable acceptance:** 3 working-day briefs each ≤ one screen · every working day's JSONL in the
bundle · zero unbacked `revenue.received` · gap-audit shows full coverage or named+filed gaps ·
quarantine explained · retro + grep-lint trial decision recorded.

## Amendment #1 — dogfood window 5 → 3 working days (2026-07-28)

Routed through `/arc-change`; owner's call. Recorded openly so no later reader mistakes this for
a 5-day proof.

**What changed:** REQ-07's bar drops from "≥5 consecutive real working days" to "≥3 real working
days", and "consecutive" is dropped as inaccurate (see Window). Nothing else in the DoD is cut —
the gap audit, quarantine review, evidence bundle, retro and grep-lint trial decision all stand.
The 3-days-effort / ≥5-elapsed appetite line is unchanged and was already met.

**Why, honestly:**
- NOT appetite-forced. Burn at the time of the cut was **~40% (~5 of 12.5 days)**; the 50%
  (~6.25d) kill tripwire was never reached, and its condition (REQ-02 + REQ-04 green) had been
  satisfied since Phase 0. The plan's two pre-planned cuts (REQ-08, then REQ-09's cursor demo)
  were already spent/reserved — this is an unplanned third cut, and calling it anything else
  would be false.
- NOT an assumption failure. Ledger row 4's trigger ("none mid-build at Phase 4") did not fire —
  arc-self work existed. The row is recorded as *strained*, not FIRED, in PLAN.md.
- The actual reason: **owner reprioritization toward the Lexos venture** (revenue/time pressure).
  Real work moved to a repo with no spine installed, so extending the window would have bought
  thin arc-self days, not richer evidence.

**What this costs, stated plainly:** a 3-day window has less chance of surfacing rare/intermittent
defects than 5. The known example is already in hand — the 2026-07-26 receipt gap surfaced only
because the window ran past Day 2. REQ-07 therefore closes as "mechanism proven on 3 real days,
live value pending", never as "proven on 5".

## Rabbit holes in this phase

- Chasing 100% coverage by inventing kinds mid-dogfood — vocabulary is closed (ADR-0026);
  gaps become `note.logged` or a post-cycle ADR.
- Making the brief "nicer" during the window — read what ships; polish is Cycle-3+ evidence.

## Out of scope for this phase

- Promotion of the 8 kickoff-lint trial gates · dashboard · Cycle-3 venture work ·
  any new emission points (wiring closed at Phase 1/3).

## Your-setup / pending

- ✅ RESOLVED 2026-07-24 — Phase-4 host = **arc itself** (owner's call). Entry re-verification
  found venturemind / Opportunity-Scout carry the arc framework but NOT the spine, so they're
  deferred (would need a one-time install); the arc-self spine is live and already capturing.
- If any real money lands in the window: provide the provider export (else the
  `revenue.simulated` path closes the mechanism).

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
