# BRIEF — dashboard (the HQ face)

> **Trigger (pull):** the CLI brief repeatedly overflows one screen, OR portfolio ≥3
> earning ventures makes visual scanning genuinely faster. **Prereqs:** spine reader
> stable · brief/inbox/pnl CLIs proven (the dashboard is a SKIN over the same reader —
> zero new truth). Design target already exists: `../arc-hq-mockup.html`.

**Goal:** a local read-only web dashboard rendering the spine — Today feed, pipeline,
portfolio cards with kill-distance, money strip, approvals view — visually per the
existing mock, with approve/reject as the ONLY write path (via the same inbox CLI events).

**REQs (measurable):**
1. Local server (single zero-dep node file) renders: brief groups, event feed (filterable
   by kind/venture), portfolio cards (MRR, kill-distance), pipeline counts — all via the
   spine reader; `grep`-lint proves zero direct file/db access.
2. Approve/reject buttons call the same code path as `arc approve/reject` (decision
   events identical byte-for-byte to CLI-made ones — fixture).
3. Refresh = re-read (poll); no websockets/daemons; page loads <1s on a 90-day spine.
4. Visual language follows the committed mock (dark, receipts-first, no slop-glow);
   works offline/localhost only — NO public exposure, no auth ambitions.
5. `rm state.db && replay` → dashboard renders identically (derived-only proof extends
   to the UI).

**Appetite:** 1 week.
**Phases sketch:** 0 server + feed + brief groups (reader-only, lint) → 1 portfolio +
pnl integration → 2 approvals write-path parity + polish-to-mock → real week of daily
use + retro.

**Non-negotiables/no-gos:** read-only except approvals · localhost only · zero-dep (no
React build chain — server-rendered HTML + vanilla JS is enough) · dataviz discipline
(accessible palette, no chart junk) · no user accounts, no cloud hosting, no realtime
push, no mobile app.

**Pre-mortem top-3:** (1) dashboard becomes a UI hobby → appetite cap + mock-is-the-spec;
(2) second truth sneaks in (UI-side state) → derived-only REQ-5 + reader lint; (3) write
paths multiply → REQ-2 parity fixture keeps ONE decision code path.

**Open decisions at kickoff:** port/launch ergonomics · which mock panels ship v1 vs later.

**Kickoff prompt:**
```
/arc-kickoff dashboard v1 — the HQ face
Design source: docs/strategy/plans/BRIEF-dashboard.md + docs/strategy/arc-hq-mockup.html
(trigger: brief overflow / portfolio scale). Expand to full PLAN; reader-only + approvals-
parity locked. STOP after PLAN + specs for my approval.
```
