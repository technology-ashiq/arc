# PROGRESS.md — Cycle 15 · arc-face "The Working HQ"

status: LIVE
cycle: arc-face (Cycle 15, opened 2026-08-19)
phase: 03
appetite: 32d
burn: 4d
blocked-on: owner — the Phase 01 blind PICK + PREDICTION (a design-lane human gate, ADR-1308) · one `hq.policy.yaml` row for face-ask (that file is edit-denied to the machine by design)
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
| 00 | Brief + coverage contract — four contracts pass `design-lint`; Coverage map frozen as the `face:` schema draft + planned-rooms registry; 8 signature screens named | 1d | built; owner "purinjathu" read outstanding |
| 01 | Explore ×3 + design system — three theses, isolated variants, blind jury vs reference, owner PICK + PREDICTION → canonical `tokens.css` + core components (design source's Ph 02 folded in; block A = 6d unchanged) | 5d | explore GREEN; reference + jury + owner PICK outstanding |
| 03 | L2 `arc dash` — read door + spine-health reader + `arc-inbox` function extraction + decision door (parity fixture) + ask proxy + sim/replay + request journal; two fresh attackers | 4d | built, attacked twice, local green; CI verdict pending |
| 04 | Shell — `arc-face` L3 repo born; Today · Inbox (stamps + needs-you cards) · Spine/Tape on live L2 + sim; keyboard model; ⌘K | 4d | blocked — needs the owner's PICK (tokens) + the L3 repo |
| 05 | Map + template + birth-rule + coverage — `face:` ×16 manifests + planned-rooms registry + `KNOWN_FIELDS` + generic renderer + `face-coverage` (mutant control) + Map with live dots | 5d | birth-rule + coverage LANDED; Map + generic renderer need L3 |
| 06 | Rooms — bespoke panels wave 1 (Council · Money · Leads · Growth · Engine · Evolve · Board · Spine) → wave 2 (rest); honest states verified by a fresh agent | 5d | pending (needs L3) |
| 07 | Ask arc — `face-ask` process + router row + `hq.policy.yaml` row + 20 golden questions + drafts-to-stamp; zero write tools | 3d | process + router row landed; policy row is the owner's (edit-denied to me) |
| 08 | Dogfood — 5 real days from the main clone; journal↔receipt match; retro; HISTORY entry | 5d | pending (needs L3 + 5 real days) |

**Appetite burn: 4 of 32 days used (13%) — set 2026-08-19, the day the work happened (the
engine lane twice recorded the cost of setting the clock later).** Block A (6d): Phase 00
spent 1d, Phase 01 ~2d to the owner gate. Block B (8d): Phase 03 built in ~1d of its 4,
both adversarial passes included. Each block carries its own 50 % tripwire and kill
(PLAN § Appetite); a block that finishes early banks its remainder forward, never silently
extends. Cut order if squeezed: brain LLM → Toolbelt bespoke → Strategy/Org rooms to
generic → Map animation → Tape play (keep as-of).

## Done-log

- 2026-08-19 — **kickoff**: lane born (`/arc-kickoff --lane face`), century 1300 claimed
  (18-worktree sweep clean), ADR-1300..1315 written, PLAN + 8 phase specs + this tracker
  created. Three attackers returned 21 findings (20 applied, 1 rejected `already-covered`);
  the simulation gate went 5 → 1 blockers; the codex second opinion returned
  DISAGREE-CRITICAL and all 7 of its findings were routed into the specs. Structure note:
  the design source's Phase 02 folded into Phase 01 (kickoff-lint law — every phase serves
  ≥1 REQ at the 10-REQ cap); numbering 03–08 preserved.
- 2026-08-19 — **plan APPROVED**: `arc-inbox approve 01M0B8T5F81RC6V06MRY289B6D --reason
  "pannu; WIP 6 vs guideline 2 acknowledged"` run from the main clone and verified landed
  in `2026-08-19.jsonl` — "he ran it" and "it landed" checked as separate facts. Owner's
  standing mandate for this cycle: build all phases; mid-build decisions are delegated to
  the session in writing; human-only structural gates are batched and surfaced, never
  silently self-approved.
- 2026-08-19 — **Phase 00 built (1d).** `docs/design/briefs/face-hq/brief.md` passes
  `design-lint` — the RED transcript was captured before authoring and the green after,
  both in `evidence/phase-00/`. Contract frozen as JSON under `contracts/`:
  `expected-set.json` (32 rooms · **46 kinds imported from the live `validate.mjs` export,
  never copied** · 26 commands · 30 agents · 7 gates · **7 rules counted on disk, where the
  design source said 6 — the tree wins** · 107 concepts), `face-schema.json` (the ADR-1306
  field set), `planned-rooms.json` (ops · trader · discover · chat-mcp).
  OPEN for close: the owner's "purinjathu" read, bound to the brief's commit SHA.
- 2026-08-19 — **Phase 01 explore done; PICK pending (owner gate).** Three isolated
  variants of the 8 signature screens — own dir, own `tokens.css`, same base SHA, zero
  colour literals outside tokens — rendered deterministically to distinct hashes.
  `design-explore check` GREEN. Director's post-composition call: **5 of 7 IA dimensions ·
  4 of 4 art axes**, no reassignment ordered. A shared `fact-pack.md` freezes the real
  company data so the jury compares design, not content. OPEN: the reference item, three
  blind rankings, then the owner's PICK + falsifiable PREDICTION as `decision.recorded`.
- 2026-08-19 — **Phase 03 built — L2 `arc dash`.** One read door + one decision door, zero
  deps. `/api/decide` IS `arc-inbox`'s own `decide()`, so byte-parity holds by
  construction, proven on the live **16-key** envelope: only `id`/`ts`/`sha` differ,
  `actor` asserted identical by name, and normalising id+ts makes the two shas COINCIDE.
  Full auth/origin/Host matrix, HTML-escape at the serializer, cursor contract with named
  refusals, `?asof=` replay, sim/replay modes, request journal (REQ-10's evidence).
  `spineHealth()` added to `spine.mjs` — quarantine by refusal code, idem size, torn
  lines, `kindsSeen` — so no consumer opens `_quarantine/`. Suites: doors 41 · parity 11 ·
  perf 4 (10k events walked, p95 72 ms) · health 6, all vacuous-pass guarded.
- 2026-08-19 — **two fresh adversarial passes on Phase 03, 9 findings, all fixed + pinned.**
  The confidentiality contract held under every attack; the gaps were structural. The two
  that matter: **`arc-event.mjs` was the fifth sibling with no unguarded-main guard — and
  the only one whose `main()` writes** (guarded with realpath on both sides, the cheap
  `endsWith` form being what silently no-ops behind a symlink); and **the route-enumeration
  gate was circular**, reading back the flag it asserted on, with a live instance
  (`/api/ask` proxies `arc-run`, which emits `run.completed`). Every route now declares an
  explicit `spineEffect` and the fixture fails closed on one that declares none.
- 2026-08-19 — **Phase 05 birth-rule + coverage law landed.** `face-coverage` validates the
  frozen contract against the live tree and **fails closed on a mutant naming both the
  ghost lane and the ghost kind**. All 16 manifests carry a `face:` section GENERATED from
  the contract — `face-sections.mjs --check` turns a hand-edit into a named CI failure —
  and `product-lint` `KNOWN_FIELDS` was extended in the same change, discharging
  assumption row 3 (the `evolve:` precedent held).
- 2026-08-19 — **CI red a second time, and my row was breaking OTHER lanes.** The face-ask
  router row carried `hosted: local` alone. `cap`/`hosted`/`judge`/`review_by` are one
  group — carry any, carry all four — so the router refused to load with 3 faults and
  `arc-run` was dead for every lane; five engine-suite jobs failed on my row, not their own
  code. The fix was to DROP the field, not complete it: those four describe a HIRED external
  runtime under tenure (ADR-0216/0217), and face-ask runs in-house, so inventing a judge and
  a review date would fabricate a hire. Local-only still holds — ADR-1307 plus the driver
  choice — and `data-boundary.mjs` only special-cases `hosted: cloud`.
- 2026-08-19 — **Phase 07 capability gap, found by running it rather than reviewing it.**
  `face-ask` declares `tools: []` (the brain has no hands). The `claude-code` driver
  refuses it: an absent `--allowedTools` means UNRESTRICTED, so an empty grant fails closed
  — ADR-0223 working as designed. There is no way yet to say "zero tools" explicitly. The
  wrong fix is to give the brain a token tool to get a green run; the right one is an
  engine-lane seam for an explicit empty allowlist. Recorded in the phase spec, raised
  cross-lane, and Phase 07's bar is met on the offline deterministic path meanwhile.
- 2026-08-19 — **CI red once, on the Windows leg only**, exactly as the no-local-tests rule
  predicts: a bats test built an import path by interpolating `$ARC_ROOT` through `sed` and
  produced `D:\d\a\arc\arc`. Moved to a real `.mjs` resolving from `import.meta.url`. That
  rewrite then caught a genuine gap — `spineHealth` exposed no `kindsSeen`, so the face's
  headline honesty number would have been copied from a doc rather than derived.

## Now

**Position:** Phases 00, 01 (to the owner gate), 03 and the Phase 05 birth-rule are built
and locally green; CI verdict on the latest push is the gate that counts. Nothing is
closed via `/arc-phase-done` yet — closing needs CI per-job green plus the owner acts below.

**Next step (mine):** the jury reference item + three blind rankings, then re-verify CI
per JOB against the head SHA.

**Next step (owner's, batched — three keystrokes):**
1. The Phase 01 **PICK + PREDICTION** after opening the three renders yourself
   (`.claude/state/design/renders/…variant-{a,b,c}…png`) — the design lane's law makes this
   a human act, and Cycle 3 is the record of what happens when pixels are judged by report.
2. The `hq.policy.yaml` row for `process:face-ask` — that file is edit-denied to me by
   design (the two-key model), so a machine cannot grant itself a subject.
3. The brief's "purinjathu" read, to close Phase 00 against its commit SHA.
