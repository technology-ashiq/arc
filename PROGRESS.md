# PROGRESS.md — Cycle 3 · arc-design "The Designer"

> Tracker for the initiative planned in `PLAN.md`. Rows flip ✅ only via `/arc-phase-done`
> (tests green + live demo + exit criteria + evidence). Evidence over assertion.
> Predecessor (Cycle 2 · Receipt Spine) CLOSED 2026-07-28: `docs/archive/PROGRESS-2026-07-28.md`.

## Phase table

| Phase | Capability | Appetite | Status |
|---|---|---|---|
| 00 | Steel thread: read-only vision critic + edit-hook scope + spine receipt + warn gate + minimal brief template → one real route inspected e2e | 1.25 days | ✅ 2026-07-28 |
| 01 | Brief mode (4 contracts) + design-lint v0 (adversarially passed) + `products/design/` manifest module | 1 day | ✅ 2026-07-29 |
| 02 | Explore: theses → 3 isolated variants → critique loop → blind ranking → pick + prediction receipt (GATE: spine dedup fix landed, ADR-0044) | 1.5 days | ✅ 2026-07-29 |
| 03 | Intelligence library + LexOS pilot e2e + blind-test launch (evidence may trail, ADR-0041) | 0.75 days | 🟡 OPEN 2026-07-29 |

**Appetite burn:** ~2.0 of 5 days used (Phases 00 + 01 + 02 closed). The kill tripwire
(2.5 days with Phase 01 not done) is PERMANENTLY CLEARED. Phase 02 came in at **~0.4 days
against a 1.5-day appetite** — the widest underspend of the cycle, and worth reading
correctly: the run's own working window was 3h 17m (12:06→14:57 plus 26m of infra the night
before); the 8-hour gap in the commit log is an owner park, not build time. Remaining:
0.75 days of declared appetite for Phase 03 against 3.0 days of wall clock — the cycle now
has real slack it did not have at Phase 01 close.

## Done log

- 2026-07-29 — **Phase 02 CLOSED** (`/arc-phase-done 2`). Shipped: `design-explore.sh`
  (init/check/render/status) · agents `design-director` / `ui-composer` / `design-jury` ·
  and the first real explore run `hq-dashboard-v1` end to end: 3 theses assigned with the
  IA matrix written **at assignment time**, 3 blind composers one variant dir each, one
  shared render command, critique loop, director call **5 of 7**, 3 blind jurors
  (unanimous a > c > b), owner pick sealed as `decision.recorded`
  (`01KYPJ91H7TX0GTKW0J3HA4E53` → variant-a, prediction: daily clear ~10 min → under 4).
  **Tests: 436 across 38 suites, green on 5 CI legs / 3 OS** (run `30440965804`, all 6 jobs
  success incl. windows). **Time: ~0.4 days vs 1.5 appetite.** Evidence bundle written and
  verified at `docs/evidence/phase-02`.
  **amendments: 4** (#57 render determinism · #58 brief declares disclosure for an
  undeclared surface · #59 ADR-0042 retirement due · #60 ADR-0043 kickoff hook due) ·
  **reopened: n**
  - **ADR-0044 satisfied live, not attested:** 7 `review.completed` across 3 routes, every
    idem distinct — variant-b alone carries three rounds. The retro called a merged-PR
    attestation insufficient; this no longer rests on one.
  - **REQ-08 proven in both directions:** variant-c ran FAIL → PASS inside 2 rounds (the
    contract); variant-b exhausted 2 and escalated to the owner, who authorised the third
    (the escape hatch). Critic sessions changed zero product files, verified each round.
  - **Two real defects found by the run itself.** `design-explore check` matched "director
    call" as a substring, so the matrix's own prose saying the call was *deliberately
    absent* satisfied the gate — the gate certified its own absence. Fixed, anchored, 4
    fixtures pinned, sync-golden regenerated. And render non-determinism (same static bytes
    → two hashes, once mid-critique into a sealed receipt) fired the ledger's
    screenshots-are-deterministic assumption.
  - **The instruments disagreed, and that is the keeper:** variant-b holds a design PASS and
    finished last on every ballot; variant-a carries one open VIOLATION and won every
    ballot. Two jurors independently caught a `k`-bound-twice keyboard legend that three
    critique rounds missed. Contract compliance and preference measure different things.
  - **Cost note for /arc-retro:** the Windows CI leg ran bats in ~20 min against ~90s on
    every Linux/macOS leg — an 11× spread, all of it in test execution, not setup (Windows
    setup was 48s). It is the whole reason a green CI takes 20 minutes rather than 3.

- 2026-07-29 — **Phase 01 CLOSED** (`/arc-phase-done 1`). Shipped: `design-lint.mjs` v0
  (4-section strict grammar, fence-stripped structural parsing, live drift gate vs the
  template, real-calendar dates, strict platform values, lorem in briefs + critiqued
  product routes, contrast computed from declared pairs vs the BRIEF-declared floor,
  `--floors` JSON export as the number authority — ADR-0048) · first real brief
  (`docs/design/briefs/docs--strategy--arc-hq-mockup-html/`, closes Phase 00's
  "none declared" gap) · template upgraded to strict grammar · one `design` gate row runs
  both halves (ADR-0046) · module proof (scratch install 9/9, resolver reads registry, old
  surface byte-untouched — ADR-0042). **Adversarial pass: 10 attacks, 4 real holes fixed +
  all 10 pinned** (fenced-heading bypass the worst: delete a section, quote its heading in
  a fence, pass). **Tests: 417 full-suite green on 3 OS, CI run `30390662479`, FIRST
  attempt** — Phase 00's cross-OS lessons (no path-string compares, `-text` fixture
  exemption) paid for themselves. **Time: ~0.5 days vs 1 day appetite.** Evidence bundle
  verified at `c855aee`. REQ-05/06 → validated.
  `amendments: 2` (ADR-0048 contrast-deferral reversal · build-time scoping note: lint owns
  computed contrast + exported floors, browser-measured pixels wait for Phase 2) ·
  `reopened: n`.
  Follow-ups routed at close: freeze-check traversal hole → issue #54 · spine dedup
  (ADR-0044 Phase-2 gate) → issue #55.
- 2026-07-28 — **Phase 00 CLOSED** (`/arc-phase-done 0`). Shipped: `design-critic` agent
  (no Edit, scoped receipt Bash) · write boundary (`10-design-critic.sh` +
  `critic-scope-check.sh`, marker-scoped) · deterministic full-page render
  (`design-render.sh`) with blank + stale-duplicate refusals · runner
  (`design-critique.sh begin|finish`, PASS ≡ zero VIOLATION) · `design` warn gate + its
  `arc.gates.yaml` row · minimal brief template · planted-defect fixture (regenerable).
  **Tests: 389 full-suite green on 3 OS** (CI run `30364828766`, the authority — local runs
  are touched-files only). 29 of those are this phase's own `design-steel-thread.bats`.
  **Time: ~1.1 days vs 1.25 appetite** — inside it. Evidence bundle verified at `fa794ea`.
  REQ-02/03/04 → validated. Live proof: critic caught the planted lorem ipsum; the real
  route went 2 VIOLATION → 1 → 0 across three rounds ending in a live PASS with the ledger
  stamped; the hook blocked a real out-of-boundary write.
  `amendments: 2` (ADR-0047 verdict ownership, ADR-0048 agents-judge-scripts-measure —
  both amended phase specs) · `reopened: n` · `t-to-phase0: 0 days` (kickoff and Phase 00
  both 2026-07-28).
  **Cost of the close: 3 CI rounds.** Two cross-OS path bugs that no local run could catch
  (macOS `/var` symlink, Windows 8.3 names + MSYS argv/env conversion). Both were the same
  mistake — comparing path strings instead of resolving them.
- 2026-07-28 — Kickoff complete (`/arc-kickoff`, tier M): Cycle-2 tracker archived;
  ADR-0033..0046 written (8 locked DES decisions + 4 owner forks + 2 auto-decides);
  PLAN.md + 4 phase specs on branch `feat/design-kickoff`. Design source:
  `docs/strategy/plans/PLAN-design.md` (frozen 2026-07-26).

## Now

**PHASE 03 IS OPEN — 2026-07-29.** Both preconditions cleared on the same day: #57 landed and
merged (`d2d8a85`), so the renderer its pilot evidence comes out of is no longer in question;
and a real LexOS lawyer answered the primary-object question — **case, not client** (receipt
`01KYQ9B2BXMXWWADZZYVWXEGRT`). The pre-designed PROVISIONAL fallback was **not** taken; the
brief carries a real answer.

Entry gate done: exit criteria corrected (2 LexOS drafts, not 4 — a kickoff miscount, see the
ledger), Your-setup settled with the confirmed checkout path, and the coarse Verification plan
refined into 5 named steps with per-step evidence. Predecessor phases: 00, 01, 02 all CLOSED.

REQ-07 and REQ-08 are `validated`; 3 of 4 phases done; 2.0 of 5 days burnt with 0.75 days
of appetite left against 3.0 days of wall clock.

**LANDED — issue #57 (render determinism), `b3a961e` → merged `d2d8a85`, CI 6/6 on 3 OS.**
Routed via `/arc-change` and classed a BUG (no new REQ: it restores a guarantee the script
already claimed, it does not add capability). Root cause found and reproduced, not guessed:
`design-render.sh` injects its determinism CSS *after* `_ab open` returns and then captures
**without ever waiting for that CSS to be applied and painted**, so the screenshot can catch
either the pre-injection or the post-injection paint of the same bytes.
- **Proof (variant-b):** injecting the CSS changes pixels — `901e48cc` → `ed1b1100` — with
  **zero layout change** (`scrollHeight` 1528 before and after). Nothing in the pipeline
  forces a settle, so nothing makes the capture wait.
- **Rule-by-rule isolation:** font-pin alone (`ed1b1100`) and antialiasing-off alone
  (`2b102da4`) each change pixels; `animation`/`transition` and `caret-color` change nothing
  (baseline `901e48cc`). The recipe's pixel-moving rules are the two nobody was waiting on.
- **Why only variant-b flipped in the wild:** it is the only variant that already declares
  `font-family: Arial…` itself, so the injection moved its pixels without moving its
  document height. Variants a and c gained height (1387→1402, 1428→1453) and settled.
- **The settle step alone did NOT close it, and that is the useful part.** With settle-only,
  variant-b still drifted once in four runs to a third value (`95e5805d`). Shipping on
  "6/6 green in a probe" would have re-sealed the same class of unreproducible hash with more
  confidence behind it. (That value is since accounted for: it is the injection applied with
  the paint unfinished — an intermediate state, not a fourth cause.)
- **So the fix is layered, and only the last layer is the guarantee:**
  1. *rules applied* — **fail-closed**. A silently failed injection used to leave the render
     running with no determinism rules at all and nothing said so.
  2. *paint settled* — **best-effort, deliberately not fail-closed**. `requestAnimationFrame`
     is throttled in headless Chromium about 1 run in 10 here, and those runs still produced
     the correct identical hash; refusing them would trade a wrong number for a command that
     randomly does not work.
  3. *stable shutter* — **the actual guarantee**. Shoot twice, publish only a hash both
     captures agree on, retry ×3, refuse otherwise. This holds for causes nobody has
     enumerated — and enumerating paint races in a browser is not a finishable task, while
     "this number is reproducible" is exactly what the receipt needs.
- **Rejected, not untried:** `agent-browser open --init-script` (inject before first paint) is
  the cleaner shape; the style never appeared on this transport across 12 runs.
- **Rejected, not untried:** `agent-browser open --init-script` (inject before first paint) is
  the cleaner shape; the style never appeared on this transport across 12 runs.
- **Evidence:** 24 consecutive renders across 5 routes (3 variants, the mockup, the defect
  fixture) — one hash each, zero refusals. 10 new cases in `design-steel-thread.bats` §7 drive
  a **fake agent-browser** (`tests/fixtures/design/fake-agent-browser.sh`) because CI installs
  no browser at all, so a browser-only test would skip on every leg and guard nothing.
  **Red-first: 5 fail against the pre-fix script.** The real-browser render case is the
  weakest — it *passed* against the buggy script more than once, which is the intermittency
  that made #57 hard to see and the reason the faked cases carry the guard.
- **The committed reproducer needed two attempts, and that is the lesson worth keeping.** The
  first `57-repro.html` was measured byte-identical under the pin — a page on which #57 cannot
  happen, behind a case that therefore could not fail while reading as a passing guard. The
  property is two-sided: layout-neutral pin AND at least one element whose font the pin still
  changes (`button`/`kbd`/`code`/`input`, none of which inherit the body font). A case now
  asserts the fixture still moves pixels, proven by stripping its controls and watching it go
  red. A fixture nobody checks is a fixture that decays.
- **Landed:** settle + measured-applied + stable-shutter + refusal cleanup + signal traps +
  SHA-256 shape guard; `recipe` now ends `;settle-paint`; sync-golden regenerated (delta was
  exactly the one intended path). Old recorded hashes are non-comparable across the recipe
  change — the designed meaning of a recipe bump.
- **Reviewed over 4 rounds** (`docs/reviews/2026-07-29-2024-feat-render-determinism.md`).
  Three rounds found a defect in the previous round's fix, and **two of those were in the
  verification method rather than the code** — a gate that measured the wrong thing, and a
  reproducer that reproduced nothing. Worth remembering next time "I verified it" is the claim.
  Standing gap: **`shellcheck` is not installed** and was skipped in all four rounds; for a
  shell-only diff it is the scanner most likely to catch what reading did not.

**#57 is CLOSED (above). Two FIRED ADR triggers remain routed but NOT actioned — both are
owner decisions, neither is a code task I can take unilaterally:**

- **#59 — ADR-0042 retirement due.** Two clean explore-critique runs fired it. Whether
  "retire the old `/arc-design` + design-reviewer" means retire or repoint-and-keep is
  unresolved: the old reviewer *fixes and commits*, the new critic is read-only by
  construction (ADR-0034). Different jobs.
- **#60 — ADR-0043 kickoff hook due.** One clean brief→critique→receipt run fired it. The
  condition for *considering* the wiring is met; the shape of the wiring is not designed.

**Phase 03's own blocker, fired at this close:** the ledger row "a real Stream-B contact
(LexOS lawyer) is identified and reachable before Phase-3 opens" is **FIRED 2026-07-29** —
no contact is named anywhere in the plan, the specs or the tracker. The consequence is the
one the trigger already wrote: Phase 03 opens with its pilot-brief upgrade blocked. The
fallback is pre-designed and legitimate (case-primary marked PROVISIONAL, per PLAN's
External dependencies row) but taking it is a deliberate owner decision on the record, not
a default.

**Also still owed by the owner before Phase 03 (`phases/phase-03-spec.md` Your-setup):**
LexOS repo checked out locally with its `docs/design/` drafts current, and ₹0 recruiting
channels identified for Stream A (design peers) and Stream B (LexOS lawyer contacts).

**Sealed receipt — settled by the owner 2026-07-29, correction appended.** Variant-b's round-2
`review.completed` (`01KYPE05Y416G5RVP65CEWN9D4`) seals `52e507ee`, a pre-injection capture the
hardened renderer will never reproduce. Owner chose to correct rather than leave it: a
`note.logged` receipt-correction is on the spine (`01KYPWJNK45E17ETJG1GSV7ZW1`) naming the
corrected event, its idem, the unreproducible hash and why. Phase 02's finding stands — the
critic judged real pixels and the FAIL is real — but that hash must never be a regression
baseline. **Worth knowing what this is and is not:** `.claude/state/` is gitignored, so both the
bad receipt and its correction live only in local spine state, and the Phase-02 evidence bundle
attests only the scan files. The durable, in-git record of this is issue #57, the ledger row,
and this tracker.

**Phase 03 step 1 — intelligence library: BUILT, not yet closed.** Schema (`--library` mode
added to the existing `design-lint.mjs`, not a parallel script) · entry template, now a synced
product doc · 4 first entries, all drawn from the Phase-02 explore run's own receipted
observations rather than invented references. **Adversarial passes run THREE times — mine, then
two reviewer rounds — and every round found something the previous round's fix had created.**
- **Round 1 (mine), 16 attacks, 2 holes.** Both required headings inside an HTML comment
  satisfied the section check (reader sees an entry with no principle, machine sees two met
  contracts — the twin of the brief lint's fenced-heading hole, same root cause: structure
  parsed on two different texts). And gate mode discovered only date-named files, so an untagged
  `notes.md` sat in the library and passed in silence.
- **Round 2, 15 more attacks, 6 more bypasses — three of them in MY FIX.** An *unterminated*
  `<!--` runs to end of document, so deleting the closing delimiter restored the exact hole just
  closed; same for an unterminated fence. The **brief lint carried the identical comment hole**
  and nobody had looked, because its own pass had only ever attacked fences — a whole section
  could be commented out and the brief called complete. The shipped template passed when copied
  and given only prose (four of its eight tags ship pre-filled with valid values), so the rule
  fell to copy-paste rather than to attack. Plus reference-style links and bare digits clearing
  the prose floor.
- **Round 3, and the worst one was mine again.** The unterminated-fence fix was not
  line-anchored, so a single inline ``` mention blanked the rest of a document — and the shipped
  template mentions it once in its own guidance. **Filling that template in correctly produced
  TEN errors about tags and headings plainly visible on the page**, on the exact path
  `docs/design/library/README.md` tells every author and every consumer project to walk. My
  fixture missed it because it reproduced the template's tag block but not its comment.
- **Round 4: the opener grammar was right and the CLOSER grammar was wrong**, which reopens the
  same hole from the other end. CommonMark forbids an info string on a closing fence and requires
  a closer at least as long as its opener, so ` ```md … ```js ` and ` ````md … ``` ` both run to
  end of document for a reader while the lax matcher ended the block early and read the headings
  below as real. Three variants, all confirmed by hand before fixing. The mirror is pinned too —
  equal-length, longer and tilde closers must still close, or the fix would just be a stripper
  that never closes anything.
- **The lesson is the ratio, and it is not flattering.** Round 1 found 2. Each later round
  attacked the *fixed* code and found more, most of them created by the previous fix. One
  adversarial round is a first pass, not a pass. Two of my own test artifacts were also broken
  in the same way — a fixture that quoted the closing delimiter inside backticks and so
  terminated its own comment, and a sed-patched case that mutated one of two prose lines. Both
  looked like guards and guarded nothing.
- **Now pinned against recurrence:** a case reads the REAL shipped template, fills it, and
  asserts it lints clean — closing the "fixture does not represent the path" class that caused
  this twice. Red-first verified on every HOLE case; false-POSITIVES pinned too (prose with `<`
  and `>` is prose; `<https://…>` in `source:` is an autolink, not an unfilled prompt), because
  a gate that rejects correct work trains authors to pad.

**Phase 03 step 2 — LexOS pilot brief: DONE.** Both drafts re-read fresh; brief written at
`docs/design/briefs/lexos-case-workspace/brief.md`; **`design-lint` green on the first attempt**,
and green in gate mode alongside the library. Primary object recorded as **case** with the lawyer
receipt cited — not the PROVISIONAL fallback. Every number, quote and hex in it is read out of the
two drafts or out of LexOS's `tailwind.config.ts`, never recalled.
- **It also carries the two debts the shipped review escalated to the owner and refused to fix as
  polish** — the content column stuck at 416px from 1024px to infinity ("dropping the sidebar is a
  product decision, not polish… the biggest remaining design debt"), and an actions panel offering
  all four actions on every tab. Both are IA calls, which makes them exactly what three variants
  can disagree about. The brief deliberately does NOT declare how the disclosure split is arranged.
- **Self-check caught five invented items before the brief was committed.** In the one section
  whose rule is *never invented labels*, a first draft declared the verbs *close* / *reschedule* /
  *reopen* and the terms *cause title* / *adjournment*. All five appear in **zero** LexOS files —
  real Indian court vocabulary, but words this product's users have never met here. Every term and
  verb in the committed brief was grepped in the repo first. Same failure class as the library
  entry that stated the five states in the losing variant's vocabulary: **plausible-sounding is not
  sourced**, and it is the failure this system exists to catch.

**Phase 03 step 3 — explore run `lexos-case-workspace-v1`: COMPLETE except the owner's pick.**
Commit `1968a23`. Base `7f65ab0`. `design-explore check` OK; all three variants render clean.

- **Director call: 7 of 7 dimensions differ.** Not the same case arranged three ways — the three
  disagree about what the primary object *is* (a ledger row · a dated entry · a step in a run),
  and it propagates: **40 action affordances on A's page, 13 on B's, exactly 1 on C's.** Two
  theses were rejected BEFORE composing (canvas requires position to encode a date, i.e.
  `reschedule` — a verb in zero LexOS files; ambient assistant contradicts the brief's own voice
  line "a court record, not an assistant") and one held as reserve. Rejecting at assignment time
  is what stops a post-build reassignment burning the appetite.
- **Critique round 1: A PASS (0 violations), B and C each FAIL on 1 — and they broke the SAME
  floor two different ways.** The brief says the always-visible quartet is "always visible, never
  behind a click". B built a real sticky strip and truncated the party names inside it with no
  recovery; C kept the names whole and never made the strip sticky at all, on a page 2.4× the
  viewport. **"Always visible" is two requirements wearing one sentence** — it must stay on
  screen AND stay complete. Worth carrying into the next brief as two lines, not one.
- **Both fixed in round 1 of 2** (REQ-08 / ADR-0034: creation side fixes, critic re-verifies).
  B: parties promoted to its own wrapping full-width block, `Record outcome` given a distinct
  treatment, the five-item filter rebuilt as inline text so it reads as a lens not a rail.
  C: a genuinely sticky status strip, its printed keys actually wired, voice drift removed, the
  two foot disclosures de-overlapped. **Neither re-critique has run** (see BLOCKED).
- **Renderer confirmation:** variant-a produced the identical hash across **three independent
  render invocations**; B's and C's hashes each changed exactly when their bytes changed. The #57
  hardening holds in real use, not only in its own fixture.

**UNBLOCKED AND COMPLETED 2026-07-30.** The five refused dispatches were re-issued and all five
succeeded on the first attempt — the earlier refusal was transient classifier behaviour, not a
permission rule (no deny entry for subagent dispatch exists in either settings file). Nothing was
worked around and nothing was done by the main session in their place.

**Round-2 critiques — both PASS, 0 VIOLATION each.** Boundary armed and released by the runner
each time; the ledger stamped `design` for `5871f9c` on both.
- **variant-b** `a45af2c8` → `6e790f32` (pixels genuinely moved). Round-1 VIOLATION resolved: the
  parties fact now sits on its own full-width row, matching the H1 verbatim, so the mandated
  identity is complete rather than ellipsis-clipped. 2 WEAKNESS / 2 POLISH remain — the sharpest
  is that the **Overdue** count, the one fact the brief names as required pre-action knowledge,
  carries less visual weight than the less time-critical Status badge beside it.
- **variant-c** → `68b2e14c`. 0 VIOLATION / 3 WEAKNESS / 2 POLISH. Confirmed from pixels: the
  quartet's completeness half holds, the breadcrumb no longer duplicates the case name, and the
  return-state line was reworded out of reviewer-facing voice into plain fact.
- **variant-a** re-rendered unchanged for a same-session jury capture → `5e4cf063`.

**The method cannot verify what C actually failed on, and that is the finding of this run.**
C's round-1 VIOLATION was that its identity strip was **not sticky**. `design-render.sh` produces
one flattened full-page capture and has no scrolled or viewport-clipped mode (`--viewport` resizes
the viewport; the capture is still full-page). A sticky element in a flattened capture occupies
exactly the position a static one would, so **no render this pipeline can produce distinguishes
"now pinned" from "still static."** The critic was told this up front and correctly recorded it as
a **run gap — neither a pass nor a fail** — rather than claiming a fix it could not see. The same
applies to C's "keyboard keys now wired" claim: a static image shows a legend, not a binding.
- Weaker, separately-labelled evidence, gathered by the runner and **not** by the critic: C's
  `.status-strip` does declare `position: sticky; top: 0; z-index: 20`, and that selector is the
  identity strip. **A declaration is not an observation** — it says the intent is in the source,
  not that the behaviour survives on screen. It is recorded here at that strength and no higher.
- Consequence to carry: **"always visible" is two requirements wearing one sentence** (on screen
  through scroll AND complete) and this pipeline can only judge the second. Either the renderer
  gains a scrolled frame or that half of the floor is verified some other way. Routed to
  `/arc-retro` with the marker findings below — it is a renderer capability change, not a fix.

**Blind jury — 3 fresh contexts, no cross-talk, 2–1 for variant-b.** Each juror was blocked from
`matrix.md`, every `thesis.txt`, every other `ranking-*.md`, all variant source and all critiques.
- juror 1 — `variant-b > variant-a > variant-c`
- juror 2 — `variant-c > variant-b > variant-a`
- juror 3 — `variant-b > variant-a > variant-c`

**B is the only variant no juror ranked last**; A placed 2nd/2nd/3rd, C is the polarising one
(1st once, 3rd twice). The earlier blocked jury's three-way split is *not* what this is — those
reports were never transcribed and this panel re-derived its verdict from scratch, as intended.
- **Caveat the owner should weigh before picking, because it inflates B's margin:** juror 1's
  lead reason for b > a is that A opens with a grey caption explaining the `max-w-shell` width
  departure *above* the H1. That is true — it sits inside A's sticky header, before the case name
  — but it is a **mockup-convention artifact**: the brief required the departure be declared, and
  the note would not exist in the shipped product. Juror 3's b > a reason is a genuine
  product-structure one (B puts a distinct "Record outcome" action directly on the one row flagged
  Unrecorded). So B's win survives the caveat; A's *margin of loss* is partly an artifact.

## Tooling findings from this run — all three about the critic scope marker

The marker (`.claude/state/design/critic-session`) armed by `design-critique.sh begin` works
exactly as ADR-0034 intends and was **not** bypassed. Four separate agents hit it, correctly
diagnosed it, and refused to route around it — one wrote "that's the permission system speaking".
The boundary is sound. Its *diagnostics* are not:

1. **It is a global repo write lock, not a critic-scoped one.** While armed, nothing can write
   outside `docs/design/critique/` — not a composer fixing its own variant, not a juror writing a
   ranking, not the tracker. So explore mode is strictly serial end-to-end, not merely its
   critiques. The phase's appetite arithmetic did not account for this.
2. **Nothing distinguishes "legitimately held" from "stale".** Four agents all concluded stale
   while the run was genuinely in flight.
3. **The `pid` field is actively misleading.** It records the arming script's pid, and
   `design-critique.sh begin` exits immediately — so the one field that looks like a liveness
   check is *guaranteed* to report dead. It misled four agents and one check I ran myself.
   Worse than having no pid at all.

Finding 3 is the dangerous one: sooner or later someone will read "process gone" as licence to
delete a marker that is doing its job, and the critic will be unbounded at exactly that moment.
Routing to `/arc-retro`, not fixed here — changing an ADR-0034 mechanism is an owner call.

**Phase 03 step 3 — CLOSED. Owner picked `variant-b` 2026-07-30 and the prediction is sealed.**
`approval.requested` `01KYRX33C27326BSZJAWVEVR3E` → `decision.recorded`
`01KYRX3HYM2BYMHKEZZD1RDHN9`, verdict `approve`, reason 850 bytes. REQ-07's last acceptance clause
("owner decision + falsifiable prediction emitted as `decision.recorded`") is satisfied on the
spine, not in prose.

**The prediction, and why it is shaped this way.** It predicts a *disagreement between the two
streams*, not a winner: lawyers (Stream B) rank variant-b first, design peers (Stream A) do not —
Stream A puts variant-c first, because c's one-action restraint reads as craft to a design eye and
as a withheld case record to someone who has to work the file. **Falsified if** Stream B ranks a
or c first, **or** Stream A ranks b first. A secondary, non-falsifying claim names the *reason*
lawyers will reject a — action density, not looks. Two properties were deliberate: it survives
n=1 on Stream B (no "majority of N" clause, because the recruit may be a single lawyer), and
**being wrong is informative rather than fatal** — if designers also pick b, the divergence claim
dies but arc's loop looks better, not worse. A prediction whose refutation teaches nothing is not
worth sealing.

**Receipt-shape constraints discovered while sealing, worth knowing before the next one:**
`decision.recorded` has a CLOSED payload (`decides` | `verdict` | `reason` only), `decides` must
be the ULID of a real `approval.requested`, `reason` is capped at 2000 bytes and **rejects control
characters — so the whole pick and prediction must be one single line**. And a second decision on
the same approval collides as `DUP_IDEM`: **an owner decision can be recorded exactly once, and
cannot be re-worded.** That is why the wording was confirmed with the owner before emission rather
than after.

**Found while sealing, unrelated and unactioned:** approval `01KYPNSS1DRN8E07TSPQ7QBR1R` ("approve
moving past phase 02", phase-done) is **still OPEN on the spine** — Phase 02 was closed in the
tracker without its approval ever being decided. Not fixed here: deciding a phase-02 gate after
the fact is an owner call, and the same one-shot rule applies to it.

**Exit criterion 4 is CLOSED (both halves).** The pick + prediction are on the spine (above), and
the outcome-evidence path is documented at `docs/design/blind-test/README.md`. **The documented
`note.logged` command was verified by running it, not by reading it** — executed verbatim against a
throwaway spine via the `ARC_SPINE_ROOT` test door, exit 0, event landed with the right kind,
evidence pointer and payload; the real spine was then checked and took zero leaked events. A
documented path nobody walked is not documented, and this project has already shipped two fixtures
that guarded nothing for exactly that reason.

The README pins three distinctions that were easy to collapse and expensive to get wrong:
`result` (did the stream clear ITS own bar) is a different question from `prediction` (was the
owner's claim right) — a stream can PASS while the prediction is FALSIFIED, and collapsing them
would make a wrong prediction look like a failed design; the two streams get **two receipts, never
one merged receipt** (ADR-0038's two ledgers); and an outcome receipt without `scores` (the pick's
decision ULID) leaves the prediction unsettleable forever.

**Both blind-test evidence files exist and are deliberately EMPTY** —
`docs/design/blind-test/lexos-case-workspace-v1/stream-a-designers.md` and `stream-b-users.md`.
Each carries its own ADR-0040 PASS bar (A: ≥2 of 3 directions taken seriously · B: task completed
without intervention), the verbatim prediction clause it scores, the three render hashes, and empty
response tables. Nothing in them may be filled by anyone but a real respondent. Stream B's file
records the distinction the ledger row already narrowed to: the lawyer answering the brief question
is **not** the same ask as sitting the test.

**Step 4 (blind-test launch) is the only build step left.** The evidence-file half of criterion 3
is done; the "requests actually SENT" half is not, and that is the half the criterion is really
about. Owner items still outstanding: the Stream-A channel and the lawyer's willingness to sit
the test.

**WIDTH-NOTE CALL — decided by the owner 2026-07-30: STRIP.** Routed via `/arc-change`, classed
**trivial & in-scope** (no capability added, no REQ created — it is a packaging step already
implied by criterion 3's "3 directions packaged blind"). Recorded as AMENDMENT 2 in
`phases/phase-03-spec.md`. No assumption-ledger trigger fires: the nearest row is about
*recruiting* the streams at ₹0, not about what gets packaged. Appetite position at the decision:
**2.0 of 5 days = 40% burnt**, kill tripwire is 2.5 days with Phase 1 not done and Phase 1 IS
done — so no tripwire, and this change does not move the position.
- **What it costs, recorded rather than absorbed:** the artifact external judges see is **no
  longer byte-identical to the artifact the critic passed.** So variant-a and variant-b get
  **re-critiqued after the strip** — a PASS on pre-strip bytes is not a PASS on what gets sent,
  and sending un-verified artifacts to the one external evidence stream REQ-01 depends on is
  exactly the "looks like evidence and is not" failure this cycle exists to prevent. variant-c is
  untouched and is not re-critiqued.
- **Not proven either way:** whether the notes would actually have changed a respondent's ranking.
  Stripping removes a *suspected* bias. It does not measure one, and this run must not claim it did.

**STRIP DONE, and it is clean — 22 deletions, only the two intended files moved.** variant-a lost
3 lines (the `<p class="width-note">` above its H1 plus its two now-dead CSS rules); variant-b lost
19 (the `.measure-note` block and its CSS); variant-c untouched. `design-explore check` still OK.
`matrix.md` describes the pages AS BUILT and was deliberately NOT rewritten — erasing the notes
from the director's record would falsify what was built; a dated pointer to AMENDMENT 2 was
appended instead. The token declarations are untouched and still carry their comments in each
`tokens.css`; only on-page prose went. Remaining `max-w-shell` mentions live in `matrix.md`,
`tokens-reference.md`, a ranking and CSS comments — none render, so none reach a respondent.

**variant-a re-critiqued post-strip: PASS, 0 VIOLATION** (1 WEAKNESS, 1 POLISH), ledger stamped
for `258533c`, hash `5e4cf063` → `b69d9d17`. The critic checked the seam specifically and found
**no artifact** — no collapsed margin, no orphaned wrapper, no stretched gap downstream; the H1 is
now simply the first element under the header's own padding.

**🔴 BLOCKED — variant-b cannot currently be packaged, and this is a real finding, not a retry
problem.** The picked variant does not render reproducibly after the strip. Measured, not guessed:

| Variant | Renders | Result |
|---|---|---|
| a (stripped) | 4 | `b69d9d17` on 4/4, zero refusals |
| c (untouched) | 2 | `68b2e14c` on 2/2 — unchanged from before the strip, which also re-confirms determinism |
| **b (stripped)** | ~11 | `ad50b562` ×6 · **`295dd98e` ×1** · **REFUSED ×4** |

So the strip did not break rendering in general — **variant-b is specifically fragile**, and it was
already the uniquely-sensitive variant in #57 (the only one declaring its own `font-family`, so the
injection moved its pixels without moving its document height).

**The part that matters beyond this run: `295dd98e` PASSED the #57 stable shutter.** The shutter
shoots twice and publishes only a hash both captures agree on — so it guarantees *two captures
within one run agree*, which is **not** the same as *runs are reproducible*. A page that settles
into a second consistent state clears the shutter and gets a receipt that no later run will
reproduce. That is a residual hole in the #57 fix, found in real use rather than in a fixture, and
it is the same class of defect the tracker already warned about: "shipping on 6/6 green in a probe
would have re-sealed the same class of unreproducible hash with more confidence behind it."

**Not done, deliberately:** variant-b's post-strip critique was NOT run and no receipt was sealed
on it. Sealing a hash that a later run will not reproduce is exactly the Phase-02 mistake this
cycle already made once (`52e507ee`, corrected on the spine). The marker was released cleanly after
each refusal — `begin` un-arms on render failure, as designed, and that path is now confirmed in
the wild.

**Owner chose to package rather than fix the renderer (2026-07-30), and the reasoning is worth
keeping.** The blind test does not need a *reproducible* hash — it needs the exact bytes a human
looked at. So the three PNGs are archived at
`docs/design/blind-test/lexos-case-workspace-v1/package/` and each is pinned by the sha256 of the
archived file itself (`68b2e14c` · `b69d9d17` · `ad50b562`, matching their renders). **No claim of
render reproducibility is made for variant-b anywhere.** That is the difference from the Phase-02
mistake: `52e507ee` was sealed into a `review.completed` *as if* reproducible; this is recorded as
explicitly not. Fixing the renderer is an `/arc-fix-issue` job the size of #57 (four review
rounds), and 0.75 days of appetite cannot absorb it.

**variant-b re-critiqued post-strip: PASS, 0 VIOLATION** (3 WEAKNESS, 3 POLISH), ledger stamped for
`bbbf760`. The seam where the `.measure-note` sat is clean — no collapsed gap, no leftover rule,
and "Add entry" still reads as its own region rather than running into the record. The quartet is
still complete, so the original violation has not regressed. **All three directions now carry a
post-strip PASS.**

**One tell survives, deliberately.** The critic caught that all three pages end with a reference
section rendering the five declared states, carrying process-facing prose ("Shown here together for
review…") — the same category of tell the strip removed, on a section far larger than the note was.
It is left in because **all three carry it**, so unlike the width note (2 of 3) it biases no
comparison, and the framing now names these as mockups outright, which makes the appendix expected
rather than a giveaway. Recorded rather than absorbed: it does mark the artifacts as mockups, and
a respondent may weight that.

**PACKAGE IS READY TO SEND** — `package/README.md` holds the internal direction→variant mapping and
the two verbatim SEND THIS blocks (Stream A: rank + which would you take seriously; Stream B: a
ten-minute, three-image, no-prep ask in the lawyer's own words). **Send order is deliberate:
variant-b is the owner's pick and the jury's 2–1 winner, so it goes out LAST as `direction-3` — if
it still wins, it won against position rather than with it.** Both evidence files now carry the
sent-file hashes, the framing pointer, and their own PASS bars; every placeholder is gone.

**🔴 STOP — BLIND TEST NOT LAUNCHED, AND IT SHOULD NOT BE. The owner looked at the output and
scored it 23/100, and he is right.** This is the finding of the whole cycle and it outranks every
receipt above it.

**Two owner corrections, both of them mine to own:**
1. **Recommending a public Reddit post was wrong.** It publishes the product concept externally and
   irreversibly — indexed, cached, unrecoverable. ADR-0040 requires only that *arc's authorship* be
   undisclosed and says nothing about **product confidentiality**; I followed the ADR and never
   raised the confidentiality question, when a hard-to-reverse outward-facing act is exactly the
   thing to put to the owner first. The streams are fine — the CHANNEL was wrong. Confidential
   routes exist: 1:1 DMs, invite-only communities, a screen-share walkthrough.
2. **I ran this entire evidence pipeline without ever looking at the renders.** Critiques, rankings,
   receipts, hashes — all read as agent reports, never as pixels. Everything downstream was
   verification of things I had not seen.

**The claim was tested rather than argued about.** Owner's claim: "a plain prompt would score ~60;
this pipeline produced 23." Three `general-purpose` agents built the same screen from the same
content with **the arc pipeline entirely off** — no brief, no token freeze, no tokens-only-colour
rule, no critic, no jury (`docs/design/experiments/2026-07-30-plain-prompt-baseline/`). Renders:
`63ba6635` · `aa98c4b3` · `e9e3e69a`.

**Result: the plain prompt wins, clearly, and it is not close.** Judged by looking at them, not by
report. What the baselines have that all three pipeline variants lack:

| | Pipeline output | Plain-prompt baselines |
|---|---|---|
| Colour | Effectively none | Used as signal — one accent, only where work is outstanding |
| Type | One near-flat scale, bold vs regular | Real hierarchy; the case name reads as the case name |
| Primary action | A plain link among links | One solid button, the only one on the page |
| The blocking fact | Buried in the stream | Hoisted, with its consequence stated ("the case cannot move until…") |
| Surface | Flat white, hairline boxes | Warm ground, depth, deliberate rhythm |
| Page budget | 40–60% spent on an internal "declared states" grid | 100% product |

**So arc's design cycle is currently NET-NEGATIVE on visual quality — the same model produces
better design with the pipeline switched off.** That is the single most important thing this cycle
established, and no amount of green receipts changes it.

**Root cause is three rules I wrote, not a bug:**

| # | Rule | What it guaranteed |
|---|---|---|
| 1 | Explore is constrained to the product's existing token set, tokens-only colour, no raw hex | Visual identity was **frozen**. The only axis left to vary was IA — so three "genuinely different directions" were three structures in one flat visual language. They look the same because they were built to |
| 2 | The critic judges the brief's four contracts | "0 VIOLATION" means *did not break the brief*. **There is no axis for "is this any good"** — characterless-but-compliant passes every time, and did, five times |
| 3 | ADR: no absolute scores, ever | Nothing in the system can say "this is 23/100". The jury ranks the three against **each other**, so it reliably finds the best of three mediocre options and can never report that all three are mediocre |

The ADR-3 reasoning is still sound (agents optimising a number converge on safe-average). The fix
is not a score — it is to **put a genuinely world-class reference screen into the blind ranking as
a fourth item**. If all three variants rank below the reference, that is a FAIL, produced
comparatively, with no absolute number anywhere and the ADR intact.

**Consequences for this phase, decided:** REQ-01 is **NOT** validated and must not be recorded as
though it were. The blind test does not launch on artifacts the owner rates 23/100 — the Stream-B
lawyer can be asked exactly once, and spending that on this version would waste the only recruit.
Phase 03 closes **honestly, on this finding**, not on its receipts. Everything above — library,
brief, pick, prediction, outcome path, package — is real and stands; it is the *design quality* the
cycle failed at, and the machinery that failed to notice is the thing worth fixing.

**Separately, and worth keeping: LexOS itself now has two genuinely good case-workspace
directions** (`baseline-2`, `baseline-3`). Those are usable product work today, independent of
arc's method problem.

**Open question that must be answered BEFORE packaging, raised 2026-07-30:** variant-a and
variant-b each carry an on-page note declaring their `max-w-shell` departure; **variant-c carries
none** (it stays inside 48rem). A's note sits *above the H1* — the first thing on the page — and
juror 1's lead reason for ranking b over a was exactly that. Human judges in both streams will see
these same renders, and `max-w-shell` is meaningless jargon to a lawyer and internal scaffolding to
a designer. So two of three variants carry a handicap the third does not. Either package as-is and
accept the contamination (evidence chain stays clean: humans judge exactly what the critic judged),
or strip the notes for the blind-test package, re-render, record the new hashes and state plainly
that the human-judged artifact differs from the critiqued one by exactly this deletion. Route
through `/arc-change` — it modifies a packaged artifact and is not a session call.

**Untouched and unstaged in the working tree, deliberately:** `docs/strategy/plans/PLAN-portfolio.md`
plus edits to `docs/strategy/README.md` and `docs/strategy/plans/README.md` — the owner's own
frozen 431-line portfolio plan from a separate session, nothing to do with this phase. Not
committed here rather than swept into a design commit.

**Owner items — neither blocks starting, both block finishing:**
- **Stream-B recruit.** The lawyer answered the brief question; whether they will also *sit the
  blind test* is a different ask and is not yet established. Needed at step 4 (launch), not now.
- **Stream-A channel** — ₹0 route to design peers. Also step 4.

#59 and #60 stay routed for `/arc-retro`.
