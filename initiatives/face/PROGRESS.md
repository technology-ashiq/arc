# PROGRESS.md — Cycle 15 · arc-face "The Working HQ"

status: LIVE
cycle: arc-face (Cycle 15, opened 2026-08-19)
phase: 06
appetite: 32d
burn: 14d
blocked-on: nothing structural — the design gate is DISCHARGED. The owner supplied the design himself rather than picking from the explore rounds, so the PICK is moot and block A can no longer take its second BELOW-BAR strike. Two items remain and neither blocks the build: one `hq.policy.yaml` row for face-ask (edit-denied to the machine by design, and not useful until the engine-lane empty-allowlist seam exists), and one owner ruling on the reference brain’s approve/reject action (see `docs/design/reference/face-hq/SOURCE.md`).
depends-on: nothing external — L3 moved IN-REPO to `face/` (ADR-1316 supersedes ADR-1300 on placement). A new repo could not be given CI from this session, and an ungated layer is not a layer that ships.

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
| 01 | Explore ×3 + design system — **superseded by the owner’s reference**: he supplied a running eleven-room HQ instead of picking from the rounds, and `tokens.css` is now extracted from it | 5d | **tokens CANONICALISED** from `docs/design/reference/face-hq/`; explore rounds kept for the record, no longer an input; PICK moot |
| 03 | L2 `arc dash` — read door + spine-health reader + `arc-inbox` function extraction + decision door (parity fixture) + ask proxy + sim/replay + request journal; two fresh attackers | 4d | built, attacked twice, local green; CI verdict pending |
| 04 | Shell — `face/` L3 born IN-REPO (ADR-1316); Today · Inbox on the live L2 doors; five-ring shell; keyboard model | 4d | **BUILT and proven — a real `decision.recorded` written from the face** |
| 05 | Map + template + birth-rule + coverage — `face:` ×16 manifests + planned-rooms registry + `KNOWN_FIELDS` + generic renderer + `face-coverage` (mutant control) + Map with live dots | 5d | **BUILT** — 33 stations, gate squares, coverage gate now watches 11 inventories |
| 06 | Rooms — bespoke panels wave 1 (Council · Money · Leads · Growth · Engine · Evolve · Board · Spine) → wave 2 (rest); honest states verified by a fresh agent | 5d | **BUILT** — all 33 rooms render: 22 generic · 2 index · 9 bespoke; swept and looked at |
| 07 | Ask arc — `face-ask` process + router row + `hq.policy.yaml` row + 20 golden questions + drafts-to-stamp; zero write tools | 3d | deterministic half BUILT and proven through the face (VERIFIED, citations resolved); model half waits on the engine seam |
| 08 | Dogfood — 5 real days from the main clone; journal↔receipt match; retro; HISTORY entry | 5d | pending (needs L3 + 5 real days) |

**Appetite burn: 7 of 32 days used (22%) — recomputed 2026-08-23.** Block A (6d): Phase 00
1d + Phase 01 v1 ~2d + the v2 open-brief round ~1d + reference intake and token extraction
~1d = **5d of 6d (83%)**. It closes INSIDE its appetite and its kill condition can no
longer fire: that kill needed two BELOW-BAR owner scores, and the owner ended the round by
supplying the design instead of scoring a third one. Block A is spent, not blown. Block B (8d): Phase 03 built
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
- 2026-08-23 — **the owner supplied the design, and the explore loop stepped aside.** After
  scoring v1 18/100 and finding the v2 round no better, he brought his own: a running
  Vite + React app — `arc — Speak To The Company (v0.4)` — with a persistent particle face
  and **eleven rooms**, every panel a derived view over an in-browser event spine, and
  `GET /api/spine` already reading a real spine directory read-only. Landed at
  `docs/design/reference/face-hq/` (a new tier: not a candidate, not judged, not gated —
  the target). 70 source files committed; the 197 MB of `node_modules`, the prebuilt
  `dist/` and two superseded rounds stayed out. `.env.local` was read BEFORE staging: a
  filesystem path, no key. Two generations had been copied together with Windows `(2)`
  suffixes; the `(2)` set is the NEWER eleven-room HQ and was promoted to canonical names
  after reading BOTH entry points — the older six-section landing is archived beside it.
- 2026-08-23 — **`tokens.css` re-canonicalised from the reference; v1 variant-a is out.**
  Reading `src/ui/kit.jsx` found **three reserved-hue collisions where reading the
  screenshots had found one**, two of them invisible in a render because they only appear
  on a screen carrying both meanings at once: `SimBadge` wore **amber** (needs-you),
  `KIND_FAMILY.council` wore **violet** (the non-real family), and both the live status dot
  and the Money room's simulated-revenue stat wore **green** (real money, which is still 0).
  All three are corrected in the token file, not in the owner's drop. A fourth defect no
  eye can catch: `COLOR.faint` carries real text at **3.94:1**, below arc's own 4.5:1 floor
  — raised to the first alpha that clears it (4.56:1). Every ratio in the file is computed,
  none asserted. The structural finding is that the reference's fifth hue — cyan, carrying
  no meaning — is what lets the four reserved hues survive untouched.
- 2026-08-23 — **Phase 04 opened; L3 flipped in-repo (ADR-1316).** ADR-1300 put L3 in its own
  `arc-face` repo. That is now wrong for one narrow reason: this session cannot author
  `.github/workflows/**`, so a new repo would be the ONE layer of the product with no CI at
  all — the layer with the most code, the only build step, and the only place a rendering
  bug can hide. The owner's rule for this cycle is that nothing is proven locally, so
  "complete all phases" and "everything on CI" cannot both be true through a repo whose CI
  cannot be written. FACE-A's cons for the in-repo option were re-measured rather than
  assumed: `sync-to-project.sh` is an ALLOWLIST, so `face/` is excluded by construction
  (the byte-identity golden moved by exactly one row, the new generator, 342 → 343), and
  `ci.yml` never runs `npm install` at the repo root.
- 2026-08-23 — **L3 scaffolded with the split kept cheap.** `face/` holds its own
  `package.json`, Vite config and strict-TS setup, and imports NOTHING from `.claude/**` —
  its only contract with arc is the L2 door's HTTP routes. The architecture rule that makes
  the CI mandate real: **every decision lives in `face/src/lib/*.mjs`, dependency-free ESM,
  and the `.tsx` files carry no branch worth asserting.** CI cannot install packages, so a
  branch inside a component is a branch nobody tests. `tests/face/l3-logic.mjs` imports the
  app's own modules directly and runs **39 checks with no install and no build**, in the
  same three-OS matrix as everything else. Two bats tests assert the rule mechanically: no
  `face/src/lib` module may import a package, and no arc script may import from `face/`.
  `face-tokens.mjs` copies the canonical tokens into the app with a `--check` drift gate and
  five mutant arms (a copy with no gate is drift with extra steps).
- 2026-08-23 — **Phase 04 built, and the write path is PROVEN, not asserted.** The app runs:
  five-ring shell over the persistent particle face, Today, Inbox, the Map, the generic and
  index renderers. Opened it against a 2,000-event fixture, typed a reason, pressed approve,
  and read the log back — `decision.recorded 01M0Q01KDCARYDDD0B6XSA0GFC` with the reason
  verbatim. An empty reason first surfaced `BAD_REASON` with the door's own sentence. That
  is REQ-03 end to end, through `/api/decide`, which IS `arc-inbox`'s own `decide()`.
  Four agents built the layers in parallel; **every defect that mattered was found by
  integrating and by opening the page**, never by a green suite:
  the door client was dead on arrival in a browser (`fetch` stored unbound — Node does not
  care, `window` does); the dev proxy sent the wrong Host and would have sent the wrong
  Origin, which would have left every READ working and every STAMP refused; `modeChip`
  claimed `real: true` for a mode nobody stated, directly under a comment saying that is the
  mistake; and `Review & Ship` rendered as `Review &amp; Ship` in the rail, the Map labels
  and all 33 accessible names. Two agents had each written their own decoder — 26 call sites
  — and each left a comment saying a twin existed and must not drift. Folded to one, and the
  registry is now decoded ONCE where it enters. Suites: L3 **123 checks**, doors **50**, both
  with no install and no build.
- 2026-08-23 — **Phases 05 and 06 built; all 32 openable rooms swept and looked at.** Zero
  failures. The generic renderer earns its keep: Bench is built entirely from derivation —
  stations, what it records, lanes, vocabulary — and closes with its own receipt
  (`rooms.generated.json · 5 declared · 3 zones drawn · status built`), which is the
  no-number-without-a-receipt rule turned on the room itself. Ask arc answered a real
  question through the deterministic reader with no model, no key and no spend, and came
  back **VERIFIED**: "every one of 3 citations was put to the door and resolved". Its
  no-hands panel COMPUTES its verdict from the handle the page holds — "0 write routes ·
  call, decide withheld" — and the audit walks the prototype chain, because
  `Object.keys(door)` returns no methods at all and an own-keys audit would clear a
  fully-armed client.
- 2026-08-23 — **two defects only looking could find, and one vacuous fix.** The non-real
  hatch rendered at full violet over body text and made the Money room's simulated panel
  unreadable — fixed in the TOKEN so it holds everywhere, at a measured opacity rather than
  a guessed one. And a room opened at the scroll position of the last one, so leaving Money
  half-read and opening Bench showed Bench's footer: every room here leads with a sentence
  that is the point of the screen, and arriving from the bottom loses it. **The first fix
  for that was a no-op whose check passed vacuously** — I reset the room column, but nothing
  constrains its height so the WINDOW scrolls, and 0 === 0 read as success. Asserting the
  precondition (that something had actually been parked away from the top) is what caught
  it; the fix is now measured at 3388px of page overflow, parked at 700, zero after.

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

**Position:** the design gate is **discharged** — not by a pick, but because the owner
supplied the design. `tokens.css` is canonical and derived from a product that already
runs. Phase 03, the Phase 05 birth-rule + coverage law and the Phase 07 deterministic half
are built and **green on CI per job** (`8274f65`, 19/19). Phase 00 waits only on the owner
read. Nothing is closed via `/arc-phase-done` yet.

**What the reference changes about the plan.** Phase 04 was "design and build the shell";
it is now "wire an existing shell to L2's real doors" — the reference already reads a spine
over an HTTP endpoint, so the seam exists and the work is substitution, not construction.
Phase 06's bespoke wave-1 rooms (Council · Money · Portfolio · Engine · Spine · Law ·
Learn) are **designed already**. What the reference does NOT contain is **REQ-04's Map** —
there is no transit map in it, and that is still to be built. Recording that now so it is
not a surprise at Phase 05.

**Next step (mine):** extract the core components from the reference the way the tokens
were extracted, then Phase 04 — point the shell at L2's `/api/inbox` and `/api/decide`
instead of the in-browser simulator. Phase closing stays queued behind a merge to main: a
worktree cannot emit the spine receipts `/arc-phase-done` requires.

**Phase 07 status:** unchanged and correctly parked. The deterministic half is BUILT and
answers live-state questions with citations, needing no driver, no key and no spend (36
golden checks, proven non-vacuous by mutation). The model half is blocked on TWO things:
the owner's `hq.policy.yaml` row, and an engine-lane seam for an explicit empty tool
allowlist (`tools: []` is refused by the `claude-code` driver, because an absent
`--allowedTools` means UNRESTRICTED and an empty grant fails closed — ADR-0223 working as
designed). The policy row alone would not make it runnable, so it is not urgent.

**Next step (owner's) — one ruling, and it is not a blocker:** the reference brain's action
protocol lets the model emit `approve` / `reject` on a real inbox id. It is told in the
prompt not to auto-approve money or kill decisions, but a prompt is not a tool contract,
and REQ-07 requires ZERO write tools proven by a fixture. Recommended: drop those two
actions and keep `open_room` / `set_speed` / `enter_hq`. Reasoning in
`docs/design/reference/face-hq/SOURCE.md`. The brief's "purinjathu" read for Phase 00 rides
along with it.
