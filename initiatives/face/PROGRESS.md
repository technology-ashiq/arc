# PROGRESS.md — Cycle 15 · arc-face "The Working HQ"

status: LIVE
cycle: arc-face (Cycle 15, opened 2026-08-19)
phase: 00
appetite: 32d
burn: 1d
blocked-on: —
depends-on: arc-face — L3 build (separate repo, born at Phase 04 entry, ADR-1300)

> Tracker for the initiative planned in `PLAN.md`. Rows flip ✅ only via `/arc-phase-done`
> (tests green on CI per job + live demo + exit criteria + evidence). Evidence over
> assertion. This cycle claims **ADR 1300–1399** (1300–1315 written at kickoff; the claim
> was checked across all 18 sibling worktrees on 2026-08-19 — none holds an ADR ≥1300).
> Company organs (`docs/adr/`, `docs/retro-log.md`, `docs/trial-ledger.md`, `tests/`) stay
> at root (ADR-0053); evidence is lane-scoped at `initiatives/face/evidence/phase-NN/`
> (ADR-0055). Design source: `docs/strategy/plans/PLAN-face.md` v1.0 (frozen — the
> decision record, not the cycle). Naming note: the git **worktree** named `arc-face` is
> the arc repo (this tree); the L3 **repo** `arc-face` is separate and not yet created
> (ADR-1300) — do not conflate them.

## Phase table

| Phase | Capability | Appetite | Status |
|---|---|---|---|
| 00 | Brief + coverage contract — four contracts pass `design-lint`; Coverage map frozen as the `face:` schema draft + planned-rooms registry; 8 signature screens named | 1d | pending |
| 01 | Explore ×3 + design system — three theses, isolated variants, blind jury vs reference, owner PICK + PREDICTION → canonical `tokens.css` + core components (design source's Ph 02 folded in; block A = 6d unchanged) | 5d | pending |
| 03 | L2 `arc dash` — read door + spine-health reader + `arc-inbox` function extraction + decision door (parity fixture) + ask proxy + sim/replay + request journal; two fresh attackers | 4d | built — local green; CI + 2 fresh attackers pending |
| 04 | Shell — `arc-face` L3 repo born; Today · Inbox (stamps + needs-you cards) · Spine/Tape on live L2 + sim; keyboard model; ⌘K | 4d | pending |
| 05 | Map + template + birth-rule + coverage — `face:` ×16 manifests + planned-rooms registry + `KNOWN_FIELDS` + generic renderer + `face-coverage` (mutant control) + Map with live dots | 5d | pending |
| 06 | Rooms — bespoke panels wave 1 (Council · Money · Leads · Growth · Engine · Evolve · Board · Spine) → wave 2 (rest); honest states verified by a fresh agent | 5d | pending |
| 07 | Ask arc — `face-ask` process + router row + `hq.policy.yaml` row + 20 golden questions + drafts-to-stamp; zero write tools | 3d | pending |
| 08 | Dogfood — 5 real days from the main clone; journal↔receipt match; retro; HISTORY entry | 5d | pending |

**Appetite burn: 1 of 32 days used (3%) — set 2026-08-19, the day the work happened (the
engine lane twice recorded the cost of setting the clock later).** Three banked blocks (A design 6d · B doors+shell
8d · C map+rooms+brain 13d) + 5 real dogfood days; each block carries its own 50 % tripwire
and kill (PLAN § Appetite). A block that finishes early banks its remainder forward, never
silently extends. Cut order if squeezed: brain LLM → Toolbelt bespoke → Strategy/Org rooms
to generic → Map animation → Tape play (keep as-of).

## Done-log

- 2026-08-19 — **plan APPROVED**: owner's decision recorded as `arc-inbox approve
  01M0B8T5F81RC6V06MRY289B6D --reason "pannu; WIP 6 vs guideline 2 acknowledged"` from
  the main clone, verified landed in `2026-08-19.jsonl`. Owner's standing mandate for
  this cycle (message of 2026-08-19): build all phases to completion; decisions needed
  mid-build are DELEGATED to the session in writing ("ethathu venum na neeye decide
  pannu") — human-only structural gates are batched and surfaced at the end, not
  silently self-approved.
- 2026-08-19 — Phase 00 built: brief `docs/design/briefs/face-hq/brief.md` passes
  design-lint (red transcript then green, both in `evidence/phase-00/`); contracts
  frozen as JSON under `initiatives/face/contracts/` — `expected-set.json` (32 rooms ·
  46 kinds verified against the live `validate.mjs` export · 26 commands · 30 agents ·
  6+1 processes · 7 gates · 7 rules on disk, design source said 6, tree wins · 107
  concepts), `face-schema.json` (ADR-1306 field set), `planned-rooms.json` (ops · trader
  · discover · chat-mcp). OPEN ITEM for phase close: the owner "purinjathu" read of the
  brief (binds to the brief's commit SHA) — batched with the end-of-build keystrokes.
- 2026-08-19 — kickoff: lane born (`/arc-kickoff --lane face`), century 1300 claimed
  (worktree sweep clean), ADR-1300..1315 written, PLAN + 8 phase specs + this tracker
  created. Structure note: design source's Phase 02 folded into Phase 01 (kickoff-lint
  law — every phase serves ≥1 REQ at the 10-REQ cap); numbering 03–08 preserved.
  Question-planner forks resolved: kickoff location (this IS the arc repo — the `arc-face`
  worktree ≠ the future `arc-face` L3 repo), design-first order kept, FACE-J=Vite settled
  by FACE-O (ADR-1309/1314), face-ask local-only v1 (ADR-1307). Awaiting owner approval —
  no product code until then.

## Now

**Position:** kickoff complete, plan awaiting the owner's approval stamp
(`approval.requested{gate: kickoff}` on the canonical spine).
**Next step:** owner approves (`arc-inbox approve <ULID> --reason "..."` from the main
clone — the reason should acknowledge the WIP count 6 vs guideline 2 per the design
source's kickoff-gates table) → then Phase 00 (brief + coverage contract) opens. No
product code, no `/arc-change`, no other command before that approval.
