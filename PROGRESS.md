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

**Phase 03 step 3 — explore run `lexos-case-workspace-v1`: BUILT AND CRITIQUED, jury blocked.**
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

**BLOCKED, and it is an environment limit rather than a build problem:** the remaining steps are
2 round-2 critiques and 3 blind jurors — 5 subagent dispatches — and subagent dispatch is
currently being refused by the permission classifier (two consecutive denials, so retrying was
stopped rather than hammered). Earlier in the same run the API also returned 529 four times on
the director before succeeding on the fifth attempt.
**These steps cannot be done by the main session instead, by construction, and that is the point
of the design:** a critic must have no Edit tool (ADR-0034 enforces read-only mechanically, not
by prose) and this session has one; a blind juror must be a fresh context with no knowledge of
the theses, and this session wrote them. Doing either here would produce an artifact that looks
like evidence and is not. Resume by re-dispatching those five agents.

**The jury already ran once and was blocked mid-write — the rankings are NOT evidence.** All
three jurors read the renders, reached a verdict, and were refused the write by the critic scope
marker. They reported their reasoning back, and it **split three ways** (unlike Phase 02's
unanimous jury), which is interesting but is not on the record and must be re-derived by fresh
jurors. Their reports are not being transcribed into ranking files: a "blind juror" artifact
written by this session would be a fabrication.

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

**Recommended next action: re-dispatch the 5 blocked agents** (round-2 critique of B, round-2
critique of C — serial, they need the marker — then 3 blind jurors once it is clear). Then the
**owner's pick + falsifiable prediction**, which is REQ-07 and is not a call this session may
make. Step 4 (blind-test launch) still needs the Stream-A channel and the lawyer's willingness to
sit the test.

**Untouched and unstaged in the working tree, deliberately:** `docs/strategy/plans/PLAN-portfolio.md`
plus edits to `docs/strategy/README.md` and `docs/strategy/plans/README.md` — the owner's own
frozen 431-line portfolio plan from a separate session, nothing to do with this phase. Not
committed here rather than swept into a design commit.

**Owner items — neither blocks starting, both block finishing:**
- **Stream-B recruit.** The lawyer answered the brief question; whether they will also *sit the
  blind test* is a different ask and is not yet established. Needed at step 4 (launch), not now.
- **Stream-A channel** — ₹0 route to design peers. Also step 4.

#59 and #60 stay routed for `/arc-retro`.
