# PLAN — face v3 · "Hands First" — v1.0

> **STATUS: kickoff-grade — landed owner-instructed from a Cowork session, 2026-10-21,
> disk-only, git untouched.** The owner branches/commits/PRs this drop himself (no machine git).
> Decisions are letters (**FV3-A…H**); real ADR numbers are assigned at kickoff from the
> **face band 1300–1399** (next free swept at kickoff per the band law) — never here.
> `PLAN-face-v2.md` (Cycle 16's frozen record) is **NOT superseded**; this is a revision
> cycle of the existing `face` lane, no new lane.
>
> **Provenance:** a live audit, not a read of renders — the face run from `main` @ `17c07a5`
> over a copy of the owner's canonical spine (2,679 receipts, 73 days), driven room by room
> in a headless Chromium at 1440×900, 1366×768 and 1024×700: page heights measured, every
> door read route called (all 200), all 32 ops planned through `/api/op/:id/plan`, all 15
> session verbs listed through `/api/sessions`. Every number below is from that run.
>
> **Trigger: FIRED by owner ruling, 2026-10-20.** "neraya functions miss aaguthu… forms la
> keela irukum, scrolling irukum… org la paaru innum confused ah irukumo, oru org chart
> ila… ella pages pathu understand panni fix pananum." Fourth instance of the standing
> operable-application expectation: the verbs exist, but the surface hides them.
>
> **Appetite: Tier S — one 30-minute timeboxed build (owner's call, 2026-10-21) run by
> parallel agents, then the owner's review.** Kill line in §9.

## 0. One-liner

The workroom already has its hands — 32 ops and 15 sessions that really shell arc's CLIs —
but it draws them last, under thousands of pixels of records. v3 puts the hands first: every
room opens on what you can DO, records go behind a tab, the org becomes a chart, and no
button pretends to work when its process does not exist.

## 1. Current state this plan rides on (verified 2026-10-21)

- **Reads are healthy.** Every door read route answers 200 on the live spine; the ops plan
  path is real (`today.capture-idea` plan = `arc-event emit … --dry-run`, sealed, nothing written).
- **Verbs are buried — one root cause.** `face/src/shell/RoomFrame.tsx` renders the module
  `View`, THEN `OpsDock`, THEN `SessionDock`, in one column. Measured page heights: org 7,732 px
  (its forms start ~6,000 px down), ventures 8,973, money 8,634, story 8,053, today 7,648,
  toolbelt 6,716, develop 6,089, bench 5,830. Fixing the frame fixes all 37 rooms at once.
- **The org has the data for a chart and draws two lists.** `/api/org` serves `chart.departments`
  (10 depts, 71 roles: 37 staffed · 3 partial · 7 human · 24 vacant) with `reports_to` /
  `escalate_to` per card and a scorecard per seat; `org/View.tsx` renders a roster column and
  a scorecard column, 71 rows each.
- **Six session buttons are dead.** `processReady: false` for `develop.close-phase`,
  `review-ship.qa`, `review-ship.ship`, `executor.hire`, `absorb.adopt`, `growth.draft` —
  the process does not exist, yet the Start button draws like a live one.
- **Forms teach the wrong input.** 13 of 32 ops reject their own placeholder as input
  (placeholders are descriptions — "the venture's slug, lowercase" — not examples).
- **Shell papercuts.** The Ask answer card survives a room change and covers the next room;
  the floating ask bar covers the last ~80 px of every room; the rail clips at 768 px height
  (Factory onward needs a second, nested scroll); bench's "per task class" cell is a text wall.

## 2. Scope

**In:** the room frame (tabs + action-first layout), OpsDock/SessionDock compact drawer
presentation, the org chart, honest not-ready sessions, placeholders-as-examples, the four
shell papercuts, the bench table, a re-run of the audit as the exit proof.

**Out (deferred, §12):** door-served pickers (venture/model/month dropdowns), per-room
polish of all 37 rooms, the audit as a CI gate, agent-tier data, a discover hunt verb, the
six missing processes themselves (they belong to their own lanes).

## 3. Decision record — FV3-A … H

- **FV3-A · Hands first.** A room with ops or sessions opens on an action strip under its
  header: one button per op and session. A click opens a right-side drawer holding exactly
  that one form (plan → run, output) — no scroll to reach a verb, ever.
- **FV3-B · Three tabs, frame-owned.** `RoomFrame` draws `Overview · Work · Records` only
  where it has something for each: Overview = the module View; Work = every op and session as
  cards (the full docks); Records reserved for modules that split their View later. The tab resets to Overview on a
  room change (an address-borne tab is deferred, §12). The module contract (four files) is untouched.
- **FV3-C · No branch in a View.** Every new decision (tab list, chart layout, state colour,
  truncation) lives in a `.mjs` node can import with no install; `face-pure` stays green.
- **FV3-D · Org is a chart first.** The org room opens on a tree — Owner → CEO → departments
  (head = the role others in that dept report to) → role chips coloured by seat state
  (staffed agent / script / human / partial / vacant dashed). A chip opens its card: binds,
  reports-to, scorecard verdict. The roster and scorecards stay, below, as records.
- **FV3-E · A dead button is a lie.** A session whose `processReady` is false renders
  disabled with the reason inline: "needs process `<name>` — not built yet". Never hidden.
- **FV3-F · A placeholder is a valid example.** Every op field's placeholder must pass its
  own pattern; the hint text keeps the description.
- **FV3-G · The shell gets out of the way.** The Ask answer closes on a room change; the room
  pads past the ask bar; rail rings collapse (state per viewer, try/catch storage).
- **FV3-H · Proof is the re-run audit.** The same harness that found the faults is the exit:
  page heights, first-verb position, plan on every op with its own placeholders, 0 console
  errors, before/after shots.

## 4. REQ table (S-tier cap: 6)

| REQ | Delivers | Measured by |
|---|---|---|
| REQ-01 | Verbs above the fold in every room with ops/sessions | audit: first action button `top < 768` at 1366×768 in 37/37 rooms that have one |
| REQ-02 | Org chart | org room opens on the tree; 71/71 roles drawn, 10/10 depts, vacant visibly distinct; chip click opens the card |
| REQ-03 | No dead buttons | 6/6 not-ready sessions disabled with the named process |
| REQ-04 | Placeholders pass | 32/32 ops plan 200 with their own placeholders as input |
| REQ-05 | Shell papercuts gone | ask card absent after a room change; last panel not covered; rail usable at 768 px |
| REQ-06 | Nothing regressed | `tsc --noEmit` + `vite build` green; `face-pure`, `face-coverage`, `face-colour-literal`, `face-facts` green; 0 console errors across 37 rooms |

## 6. Phases (one 30-minute timebox, parallel)

| Phase | Work | Owner |
|---|---|---|
| P00 | Plan lands, branch `feat/face-hands-first` (owner) | owner |
| P01 | Frame: action strip + drawer + tabs (FV3-A/B), not-ready sessions (FV3-E) | agent |
| P02 | Org chart (FV3-D) | agent |
| P03 | Placeholders (FV3-F) | agent |
| P04 | Shell papercuts + rail + bench table (FV3-G) | agents |
| P05 | Verify: build, lints, re-run audit, shots (FV3-H) | lead |

## 9. Kill criteria

- At minute 25, any part whose build, lint or audit check is red is dropped from the drop,
  not patched further. Untested code never reaches the owner's disk.
- A change that needs a new door route or a new spine kind is out of this cycle by definition.

## 12. Deferred (consciously)

Door-served pickers · tab in the address (`&tab=`) · per-room polish of all 37 rooms · audit as a CI gate (3-OS) ·
agent tiers on `/api/roster` · discover hunt verb · the six missing processes
(`phase-close`, `qa-run`, `ship-run`, `hire-certify`, `absorb-adopt`, `growth-draft`).

## 14. KICKOFF PROMPT (paste-ready)

```
/arc-kickoff --lane face face v3 "Hands First" — every room opens on what you can do: an action strip and a one-form drawer above the records, Overview/Work/Records tabs owned by the frame, the org drawn as a chart, and no button that pretends to work.

Ground rules for this kickoff:
- Read docs/strategy/plans/PLAN-face-v3.md FIRST. FV3-A…H are adjudicated and LOCKED — assign ADR numbers from the face band's next free number, do not re-litigate. PLAN-face-v2.md stays as Cycle 16's frozen record.
- Revision cycle of the existing face lane; archive the Cycle 16 PROGRESS per preflight rules.
- Non-negotiables: the module contract stays four files · no branch in a View (face-pure) · zero new spine kinds · zero new door routes · branch-only writes, main untouchable.
- Appetite: Tier S, owner's 30-minute timebox; the exit is the re-run audit (REQ-01…06).
Emit kickoff.done + approval.requested{gate: kickoff} and STOP.
```
