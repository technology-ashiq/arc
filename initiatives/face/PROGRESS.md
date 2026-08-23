# PROGRESS.md — Cycle 15 · arc-face "The Working HQ"

status: LIVE
cycle: arc-face (Cycle 15, opened 2026-08-19)
phase: 03
appetite: 32d
burn: 6d
blocked-on: owner — the Phase 01 PICK across the SIX v2 directions (a design-lane human gate, ADR-1308; the v1 round was scored 18/100, which is BELOW-BAR strike 1 of the 2 that kill block A) · one `hq.policy.yaml` row for face-ask (that file is edit-denied to the machine by design)
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
| 01 | Explore ×3 + design system — three theses, isolated variants, blind jury vs reference, owner PICK + PREDICTION → canonical `tokens.css` + core components (design source's Ph 02 folded in; block A = 6d unchanged) | 5d | **v1 round REJECTED by the owner at 18/100 (BELOW-BAR strike 1 of 2)**; brief rewritten open, v2 ran six directions, no pick recorded — owner PICK outstanding |
| 03 | L2 `arc dash` — read door + spine-health reader + `arc-inbox` function extraction + decision door (parity fixture) + ask proxy + sim/replay + request journal; two fresh attackers | 4d | built, attacked twice, local green; CI verdict pending |
| 04 | Shell — `arc-face` L3 repo born; Today · Inbox (stamps + needs-you cards) · Spine/Tape on live L2 + sim; keyboard model; ⌘K | 4d | blocked — needs the owner's PICK (tokens) + the L3 repo |
| 05 | Map + template + birth-rule + coverage — `face:` ×16 manifests + planned-rooms registry + `KNOWN_FIELDS` + generic renderer + `face-coverage` (mutant control) + Map with live dots | 5d | birth-rule + coverage LANDED; Map + generic renderer need L3 |
| 06 | Rooms — bespoke panels wave 1 (Council · Money · Leads · Growth · Engine · Evolve · Board · Spine) → wave 2 (rest); honest states verified by a fresh agent | 5d | pending (needs L3) |
| 07 | Ask arc — `face-ask` process + router row + `hq.policy.yaml` row + 20 golden questions + drafts-to-stamp; zero write tools | 3d | process + router row landed; policy row is the owner's (edit-denied to me) |
| 08 | Dogfood — 5 real days from the main clone; journal↔receipt match; retro; HISTORY entry | 5d | pending (needs L3 + 5 real days) |

**Appetite burn: 6 of 32 days used (19%) — recomputed 2026-08-23 after the v2 design
round, which the 4d figure predated.** Block A (6d): Phase 00 1d + Phase 01 v1 ~2d + the
v2 open-brief round ~1d = **4d of 6d (67%) — past its 50 % tripwire**, and its kill
condition (two BELOW-BAR owner scores) stands at **1 of 2**. Block B (8d): Phase 03 built
in ~1d of its 4, both adversarial passes included. Block C (13d): the Phase 05 birth-rule
+ coverage law and the Phase 07 deterministic half cost ~1d between them. Each block carries its own 50 % tripwire and kill
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
- 2026-08-21 — **CI GREEN per JOB at head SHA `eb760ae`.** All 19 jobs of `arc-ci` report
  success (ci-tier · 3 ubuntu node legs · 12 windows shards · 3 macos shards), and the run
  head SHA was confirmed equal to the local HEAD before this line was written. That was the
  one gate Phases 03, 05-birth-rule and 07-deterministic were still waiting on; each is now
  green-on-CI and eligible for `/arc-phase-done`, which is separately gated on evidence
  being emitted from the MAIN clone (a worktree cannot write spine receipts).
- 2026-08-21 — **the v1 design round was REJECTED by the owner at 18/100** — "very basic,
  LKG design, boring tech". The cause was the BRIEF, not the composers: it spent its words
  specifying the look (cold ink monochrome, dense, one surface, these tokens, this 6-zone
  template) and skimped on meaning, so four composers rendered one person's taste
  faithfully. That is arc's own ADR-0049 BELOW-BAR failure inside the design lane: a gate
  that only asks "did anyone break a rule" cannot detect mediocrity, and `design-lint` did
  exactly that — every v1 variant passed it. **This is BELOW-BAR strike 1 of the 2 that
  kill block A.** The delegated v1 PICK (`docs/design/explore/face-hq-v1/PICK.md`,
  variant-a + two grafts) is superseded in practice by that score and must not be treated
  as the canonical tokens input.
- 2026-08-21 — **v2 round on an open brief: six directions, deliberately NO pick.**
  `docs/design/briefs/face-hq/BRIEF-v2-open.md` constrains only what carries MEANING (a
  machine may never decide · real and simulated are different substances · no number
  without a receipt · never a bare 0 that could mean two things · arc vocabulary verbatim ·
  four signals unmistakable) and hands over the metaphor, the structure, light-or-dark, and
  whether a dashboard is the right answer at all. Six directions came back — subtraction ·
  editorial · sovereign instrument · paper record · operations deck · cockpit — laid out in
  `docs/design/explore/face-hq-v2/COMPARE.html`. The evidence the open brief worked: **two
  designers independently invented "green stays unspent until the first real rupee"** from
  a brief that never mentions it, which a prescriptive brief cannot produce. No pick is
  recorded because the owner is making this one himself after the v1 delegation failed.
- 2026-08-23 — **housekeeping**: six iteration screenshots that landed in the repo ROOT with
  the v2 commit moved under `docs/design/explore/face-hq-v2/shots/iterations/`; this tracker
  recomputed against what is actually built (burn, block A tripwire, strike count).

## Assumptions ledger — adjudicated by running the measurement, not by opinion

Four of seven now have a result. A trigger is scored by executing what it names; the three
without one are named NOT YET EVALUABLE rather than quietly counted as holding.

| # | assumption | verdict | the measurement |
|---|---|---|---|
| 1 | `spine.mjs` serves the read door <1 s p95 on a 10k-event fixture | **HELD** | walked all 10,000 events through the cursor in 20 pages: p50 56 ms, **p95 72 ms**, max 441 ms. The sqlite accelerator path stays unbuilt, correctly. |
| 2 | `/api/decide` can emit a `decision.recorded` byte-identical to the CLI's | **HELD** | same approval, same reason, two doors, two spines: all 16 envelope keys identical except `id`/`ts`/`sha`, `actor` identical by name, and normalising id+ts makes the two shas coincide. The extraction was mechanical, as re-verification predicted. |
| 3 | a `face:` section passes `product-lint` once `KNOWN_FIELDS` is extended | **HELD** | 16 of 16 manifests carry one; `product-lint: all manifests valid`. The `evolve:` precedent held exactly. |
| 4 | three theses can differ ≥3/7 IA dimensions and ≥3/4 art axes | **HELD** | director's post-composition call on the rendered pages: **5 of 7** and **4 of 4**, no reassignment. The 20-line Map legibility half is NOT YET EVALUABLE — the Map needs L3. |
| 5 | the owner will decide through the face on real days | **NOT YET EVALUABLE** | needs Phase 08 and a built L3. Nothing about it is knowable now, and calling it "on track" would be the fiction this column exists to prevent. |
| 6 | `/arc-phase-done` accepts cross-repo evidence | **NOT YET EVALUABLE** | needs the `arc-face` repo, which is Phase 04's entry gate. |
| 7 | file-borne truths have no usable history, so as-of applies to spine views only | **HOLDS, UNFALSIFIED** | no sanctioned file-history source appeared. The door enforces it: file-borne panels carry the `file, not log` badge, and `/api/pnl` refuses a day-granular `asof` with a named 501 rather than inventing one. |

## Now

**Position:** Phase 03, the Phase 05 birth-rule + coverage law, and the Phase 07
deterministic half are built and **green on CI per job at `eb760ae`**. Phase 00 is built
and waits only on the owner read. **Phase 01 is the live blocker**: the v1 round was scored
18/100, the brief was rewritten open, and six v2 directions now sit unranked. Phases 04, 06
and 08 cannot start — 04 needs canonical tokens and the L3 repo, and both descend from the
PICK. Nothing is closed via `/arc-phase-done` yet.

**Next step (mine):** everything that does not descend from the PICK — a written,
evidence-backed read of the six v2 directions so the owner is choosing between two strong
things rather than six adequate ones; and, once a direction exists, the `tokens.css`
canonicalisation that unblocks Phase 04. Phase-closing is queued behind a merge to main,
because a worktree cannot emit the spine receipts `/arc-phase-done` requires.

**Phase 07 status:** unchanged and correctly parked. The deterministic half is BUILT and
answers live-state questions with citations, needing no driver, no key and no spend (36
golden checks, proven non-vacuous by mutation). The model half is blocked on TWO things,
not one: the owner's `hq.policy.yaml` row, and an engine-lane seam for an explicit empty
tool allowlist (`tools: []` is currently refused by the `claude-code` driver, because an
absent `--allowedTools` means UNRESTRICTED and so an empty grant fails closed — ADR-0223
working as designed). The policy row alone would not make it runnable, so it is not urgent.

**Next step (owner's, batched):**
1. The Phase 01 **PICK + PREDICTION** across the six v2 directions, from
   `docs/design/explore/face-hq-v2/COMPARE.html` and the shots beside it. This is the one
   gate the whole back half of the cycle hangs from, and the design lane's law makes it a
   human act. If none of the six clears the bar, saying so is the correct answer and costs
   block A its second strike — but a least-bad pick spends the strike anyway and buys a
   product nobody wants, so the honest verdict is cheaper.
2. The brief's "purinjathu" read, to close Phase 00 against its commit SHA.
3. Deferred, not pending: the `hq.policy.yaml` row for `process:face-ask` — worth doing
   only once the engine-lane empty-allowlist seam exists.
