# HISTORY.md — the company logbook

> One page answering **"what has arc actually done so far?"** Append-only, newest first:
> one entry per closed (or parked) initiative, written at `/arc-retro` when the cycle
> closes. This file is a **derived view** (Constitution A5) — the truth lives in
> `docs/archive/` bundles, `docs/evidence/`, `CHANGELOG.md`, and (from Cycle-2 on) the
> receipt spine. Numbers are copied verbatim from the retro stat line, never recomputed.
>
> **Wiring CLOSED 2026-08-10.** `/arc-retro` step 4b now requires the entry, because this page was
> hand-appended three times while a TODO asking for the step sat at the top of it — a note is not a
> mechanism, and the note was the only thing keeping the page current.

## At a glance

| # | Initiative | Dates | Result | Burn | Shipped |
|---|---|---|---|---|---|
| C7 | arc-engine "The Hired Hands" | 2026-08-12 → 2026-08-24 | **CLOSED — 6/6 phases, 8/8 REQ validated. The hire works: three approved dispatches, three receipts, three real drafts, two accepted** | **~79% of 12d** (cap raised 7.5→9.5→12, both times in writing) | one external agent runtime hired as a governed driver: a `router.yaml` row whose `cap`/`hosted`/`judge`/`review_by` are all four mandatory and fail the router LOAD, tenure enforced at load with ONE idempotent rejustify proposal, and a termination step that is now a fixture · a 12-fixture isolation certification against the real runtime — repo unmounted, env structurally clean, egress through an allowlisting proxy with the config hash MOVING between postures on a landed receipt, persistent memory defeated by a private home copy per dispatch (ADR-0222) · a capped credential whose ceiling is **zero**, enforced (403 on a paid model, 200 on a `:free` one) · the data boundary refused ABOVE the driver at exit 5, extended so an UNMARKED input is refused for a capped row — an absence is not a declaration · **ADR-0225: a hired runtime is unreachable without a row that grants it**, after the termination spec was measured false for the second time in its own comment · `--transcript-dir`, both streams, and a loud warning when a dispatch would keep no trail · **six adversarial passes, sixteen agents, 176 findings** — the sixth attacked the fix the fifth produced and found it had reintroduced its own defect at the fallback hop, where a row spelled `./hermes` loaded with ZERO faults and one spelled `../../../outside/evil` executed an arbitrary script · **CI killed three of the author's own assertions and a code review a fourth**, all vacuous, all written the same day inside work whose subject was tests that pass while measuring nothing (ADR-0208..0225) |
| C13 | arc-ledger "the money brain" | 2026-08-12 → 2026-08-13 | **CLOSED — 4/4 phases, 7/8 REQ validated, 1 CUT taken against the cap. Mechanism proven, live value pending** | **88% of 8d** | per-venture P&L derived only from spine receipts, storing nothing · a PII contract wired INTO the emitter so no ingest path can bypass it · integer minor units end to end with BigInt FX · kill lines in a root `ventures.yaml` that cannot move without an approved receipt (an `approval.requested` PROFILE, so the closed vocabulary paid **zero** kinds for it) · ABSENT as a first-class status with a mandatory reason, because a criterion nothing can measure must not read as healthy · a month-close gate that blocks in both directions AND on no-input-at-all, netting refunds through ONE spelling of the link rules · cost trichotomy that no code path can sum · `month.closed` (KINDS 44→45) with its brief group in the same commit · `--simulated` watermarked on every line · **three adversarial passes, six fresh agents, 76 findings, ONE overlap between the pairs** — they found the PII control broken and its guard inert, three ways the kill switch disarmed itself at exit 0, and four ways a month closed GREEN that should not have (ADR-1000..1018) |
| C11 | arc-memory "playbooks + recall" | 2026-08-11 → 2026-08-12 | **CLOSED — 3/3 phases, 7/8 REQ validated, 1 CUT on its own measurement** | **75% of 5d** | one count-verified index over 5 organs (`N_parsed == N_indexed`, every exclusion named with file and line) · `arc-recall` bm25f ranking under 1s on 3 OSes with zero npm deps · `--decisions` reader-only filter with a closed-set grammar (**KINDS still 44 — memory emits nothing**) · write-time near-duplicate check that surfaces and never resolves · a golden-set gate that beats the recorded grep baseline 12/5 and whose bar lives in the fixture · an equivalence contract whose tie-break is ASSERTED, not printed · kickoff AND review both receive recall without being asked, as additive process-file steps (ADR-0700..0709, ADR-0207) |
| C10 | arc-absorb "The Technique Refinery" | 2026-08-09 → 2026-08-10 | **CLOSED — 5/5 phases, 8/8 REQ. The refinery refused its own first candidate and the owner overruled it; all three receipts kept** | **81% of 8d** | read-only study surface (path-segment confinement, per-segment case checks, hardlink quarantine) · 8-family hostile corpus with mutant controls · 4 lints · versioned hash-commitment seal/reveal/verify · owner-judge + adoption payload profiles on `decision.recorded` with **no new spine kind** · `ab-run` A/B harness · one real absorb: T-01 pre-emit finding verification, adopted (ADR-0074, ADR-0600..0606 + two amendments) |
| C9 | arc-policy "Enforced Capability Vectors" | 2026-08-06 → 2026-08-10 | **CLOSED — 5/5 phases; the engine is fixture-proven and NEVER EXERCISED — 4 new spine kinds, 0 production emissions** | **100% of 7d** | `hq.policy.yaml` + `policy-lint` failing from birth · `authorizeAction` / `resolveEffectivePolicy` with everything injected · headless enforcement at `arc-run` AND `runDriver` · money guard reserving under a re-reading lock · 4 authority receipts (KINDS 40→44) · promotion chain + automatic demotion through the inbox · 64-row hostile corpus · birth rule + 53-row cap inventory (ADR-0500..0508) |
| C7 | arc-evolve "The Self-Improvement Engine" | 2026-08-03 → 2026-08-04 | **CLOSED — 5/5 phases; north-star claim fixture-proven, UNEXERCISED** | **100% of 7d** | `evolve` manifest section + money-surface denylist · 9 new spine kinds (KINDS 22→31) with closed payloads and total-preimage idem · reader-only board · deterministic assignment + `newcombe-wilson-difference-v1` pinned to one expression tree · four-hop SHA lineage, propose-only both ways · council self-calibration (ADR-0300..0311) |
| C6 | arc-engine "The Model-Agnostic Foundation" | 2026-08-03 | **CLOSED — 4/4 phases, one REQ partial** | ~14% of 14d | `processes/*.process.yaml` canonical layer + `process-lint` · `arc-compile` proving **3/3 byte-identical** then the flip · `arc-run` + 3 drivers behind one interface, hard budgets, proposal-receipt escalation, secret scrub, `router.yaml` (ADR-0200..0206) |
| C6 | arc-develop "The Developer — the intelligence layers" | 2026-08-02 → 2026-08-03 | **CLOSED — 5/5 phases, REQ-03 carried** | ~30% of 7d | learning ledger + replay corpus + holdout · Context Pack (5 sources, one hop) · capability scout + vet gate + lockfile · pattern annex + approach sketches · six outcome metrics + calibration record (ADR-0108..0111) |
| C5 | arc-develop "The Developer — the execution harness" | → 2026-08-02 | **CLOSED — 4/4 phases** (back-filled 2026-08-03) | ~38% of 5d | `/arc-develop` five lifecycle modes over the ADR-0100 slice ledger · `develop-lint` 3 BLOCKs + 2 trial groups · handoff refusing unscored predictions · `spec-fidelity` agent · stuck backstops (ADR-0100..0107) |
| C4 | arc-portfolio "The Conductor" | 2026-07-30 → 2026-08-02 | **CLOSED — 4/4 phases** | ~112% of 3d | lanes + resolver on 7 surfaces · `PORTFOLIO.md` board + board lint · ownership lint · WIP info line · per-lane One Rule (ADR-0050..0062) |
| C3 | arc-design "The Designer" | → 2026-07-30 | **CLOSED — 4/4 phases** | ~60% | vision-based design review: read-only critic · four-contract brief · thesis-driven exploration + blind ranking |
| C2 | Receipt Spine | 2026-07-22 → 2026-07-28 | **CLOSED — 5/5 phases** (REQ-01 `active`, honestly downgraded) | ~40% of 12.5d | spine core · 7 flows emit · daily brief · approval inbox · reader-only API (ADR-0024..0031, ADR-0032) |
| C1 | Orchestrator (product monorepo) | → 2026-07-22 | **CLOSED — 6/6 phases** | ~22% | 6 installable products · selective install + per-target registry · scripts re-homed · EVENT.d dispatcher · 22 commands · bats 271→334+ |
| — | v2 "world-best" quality engine | → 2026-07-17 | **PARKED (ADR-0017)** | — | arc-scan steel thread (semgrep+gitleaks → SARIF) · strictness profiles · block-by-default gates — banked, not killed |

## Milestone tracker

| Milestone | Status |
|---|---|
| Two real consumer repos installed (venturemind · Opportunity-Scout) | ✅ Cycle-1 era |
| Company runs on receipts (spine live on real work) | ✅ 2026-07-24 — dogfood day 1+ |
| Constitution adopted (first `constitution.adopted` event) | ✅ 2026-08-06 — v1.0, receipt `01KZ9V0QXNNMB3ZH18MSH8DKH3` |
| Venture chosen for Cycle-3 | ⏳ pending — decision overdue |
| First real ₹ (`revenue.received`) | ⏳ target Sep 2026 |

## Entries (newest first)

### C11 · arc-memory "playbooks + recall" — CLOSED 2026-08-12 · lane `memory`

- **Goal:** make every lesson this company has already recorded findable in under a second, and put it in front of the two moments where it would otherwise be re-learned — a kickoff and a review
- **Result:** 3/3 phases · **75% burn (3.75 of 5d)**, every phase under its own line · REQ-01..06 and REQ-08 validated, **REQ-07 dropped** · ADRs 0700–0709, plus ADR-0207 written into the `engine` band with the owner's approval
- **Stat line (verbatim):** `M | rework 0/3 | amendments 0 (/arc-change) + 11 ADR | FIRED 0/7 (3 not evaluable) | burn 75% | sim-blockers-r1 5 | t-to-phase0 0d`
- **The cut, with its reason:** REQ-07's sqlite engine was **funded in the morning and cut the same afternoon**, on the measurement the ADR itself asked for — Phase 01 measured the search at **0.42ms of a 199ms wall clock**, so the accelerator would have accelerated 0.2% of the elapsed time. What shipped instead is the equivalence **contract and harness**, so a second engine plugs into a gate that already exists rather than one written afterwards to justify it. Build trigger written down: `index.json` past 25MB, or a load over 500ms — about 72× today's corpus
- **What this cycle actually taught, and it is not about recall:** **six adversarial passes, 94 findings, and the ones that mattered were all gates that could not see their own failure.** A 60-line stub reading no organ passed fifteen assertions of the recall suite *including its determinism proof*. `TIE_BREAK` was a string a gate exported and printed and nothing ever compared against, so inverting the comparator left two gates green at exit 0. The golden gate could be passed by **deleting the row that failed**. `spine-reader-lint` could not tell *scanned clean* from *could not scan*. Every one of them was green, and every one was measuring nothing
- **Twin-fix recurred three times in two days** — P2-1, P2-2 and P2-7 each came back in the file next door — which is why the lane's running fixed-defect list is now handed to every attacker with the instruction to check each entry against every *other* file, and why the last fix pass was applied by grepping the pattern rather than the file
- **Open, recorded rather than hidden:** `debt-ledger.md` **D-01** (REQ-06's named CI job deferred — `.github/workflows/**` is denied on purpose; the gate still bites through the suite, what is deferred is per-JOB legibility) and **D-02** (phase 02 has no `develop.started`/`slice.done` receipts and they were **not backfilled**: emitting at `ts=now` would put a ~0-minute span into a company metric whose plausibility guard has a ceiling and no floor, and pinning the clock to write a past timestamp into an append-only log is forging a receipt)
- Full record: `initiatives/memory/` (PLAN · PROGRESS · 3 phase specs · debt ledger) · evidence bundles at `initiatives/memory/evidence/phase-{00,01,02}/` · stat line in `docs/retro-log.md`

### C7 · arc-evolve "The Self-Improvement Engine" — CLOSED 2026-08-04 · lane `evolve`

- **Goal:** give arc a machine that can propose an improvement to one of its own modules, measure whether the improvement is real, and refuse to promote it when the evidence is thin — with every hop on a SHA chain a human has to merge
- **Result:** 5/5 phases · **100% burn (7.0 of 7d)** · 53/53 slices proven · REQ-01..06 validated against their written acceptance · ADRs 0300–0311
- **Stat line (verbatim):** M | rework 0/5 | amendments 1 | FIRED 1/7 | burn 100% | sim-blockers-r1 not-recorded | t-to-phase0 ~0.2d
- **Shipped:** the `evolve` manifest section with a from-scratch money-surface denylist that refuses `lib/stripe/webhook-handler.ts` on no keyword at all · eight experiment receipts + `council.outcome` taking the closed vocabulary 22 → 31, each with a closed payload and a total-preimage idem · `arc-evolve board` folded from the reader alone, `PENDING`/staleness/`MISSING`/`insufficient evidence` each fixture-proven · deterministic arm+cohort assignment, canonical seal, TTL, concurrency cap · `newcombe-wilson-difference-v1` · the four-hop SHA lineage with a negative control on every hop · council calibration from receipts, `unresolved` excluded rather than scored a miss
- **The claim that is NOT proven, stated the way ADR-0300 promised at kickoff:** the engine is **fixture-proven and unexercised**. There is no client, no surface, no traffic and no `metric.observed` receipt anywhere — that kind is not even in `KINDS`, so four weeks of receipts are technically impossible rather than merely absent. Phase 03's "first real experiment OPENED on the chosen surface" was **cut and banked, not delivered**. The whole cycle was built ahead of its own trigger with all five pre-kickoff gate rows unevidenced, shown to the owner, and directed forward twice
- **The appetite told the truth and nobody got to test it:** Phase 04 was named at kickoff as the designated cut and was **built rather than cut**, so the cycle's only slack was spent as work. `appetite-sum` warned on every single run that zero slack is its own fiction. The cycle finished at exactly 100% — no overrun, and no buffer either. It closed because nothing went badly wrong for long
- **What the adversarial passes cost and bought:** 5 fresh agents, **58 real holes**, every one in code that had already passed every test its author wrote. In three of five phases one of those tests was itself wrong in a way that hid a severe defect — and in Phase 03 the wrong test was the one guarding this lane's single most important rule: the propose-only guard was a `grep` that a mutant overwriting the canonical file, deleting the champion, committing and spawning a deploy walked past clean
- **The acceptance criterion that could not be met as written:** REQ-04 asked for reference vectors reproduced **bit-for-bit**. Two independent derivations of Newcombe/Wilson disagreed on 6 of 8 cases, and against 60-digit exact arithmetic neither form was correctly rounded — one returns a *negative probability* at zero successes, which is what decided the pinning. ADR-0311 records that bit-for-bit across independent implementations is unachievable, and re-words acceptance as bit-for-bit against ONE pinned expression tree plus absolute agreement with the independent derivation
- **Carried:** six debt rows, each with a named pay-down trigger. The one that matters: `lineage.mjs` has **no production caller**, so every default in it is one the first caller inherits without choosing it — and `requiresDeploy` defaulted fail-open, which is the proof rather than the hypothetical
- Full record: `initiatives/evolve/` · evidence at `initiatives/evolve/evidence/phase-0{0,1,2,3,4}/` · patterns in `docs/retro-log.md`

### C6 · arc-develop "The Developer — the intelligence layers" — CLOSED 2026-08-03 · lane `develop`

- **Goal:** finish the design source — the harness stops merely running a phase with discipline and starts retrieving what past work knows, acquiring capabilities it lacks, mining decisions for prior art, and measuring whether any of it helped
- **Result:** 5/5 phases · ~30% burn (2.1 of 7d) · 54 of 55 slices proven · **REQ-03 still `active`** · ADRs 0108–0111
- **Corrected 2026-08-03:** this line first read "ADRs 0106–0111". It was wrong, and the way it
  went wrong is worth more than the fix. C5's plan indexed 0100–0105, so at C6's close the gap was
  filled by assuming ADR numbers run contiguously between cycles. `git log --diff-filter=A` says
  0106 and 0107 were created on 2026-08-02 in PR #95 — **C5's own kickoff commit**, a day before
  C6 opened. Both are cited in C6's PLAN prose and indexed in **neither** plan's Key decisions
  table, which is how they were free to be mis-credited: `kickoff-lint`'s `[adr]` check walks the
  plan's index and confirms each row has a file, never the ADR directory confirming each file has
  a row. Five phase closes passed clean over it. Making that check bidirectional is a tracked
  change, not part of this correction.
- **Stat line (verbatim):** M | rework 0/5 | amendments 11 | FIRED 0/5 | burn ~30% | sim-blockers-r1 n/a-prior-session | t-to-phase0 ~0.8d
- **Shipped:** learning ledger with typed links + 18 replay fixtures + a withheld holdout · Context Pack (five sources, one hop per ADR-0111, every source recorded) · `capability-vet.sh` refusing on seven conditions + `capability-scout` + `capability-lock.json` · decision-triggered Pattern Annex and risk-triggered approach sketches · `develop-lint --metrics` deriving six outcome metrics and a calibration record
- **The claim that is NOT proven:** REQ-03's promotion loop ships and is lint-enforced, but **no real promotion has ever run through it**. Two candidates were authored and both were rejected — L-002 by an unanchored evaluator on its code, L-004 on its own computed counts. The exit criterion was deliberately not reworded to match where the ball landed, because moving a goalpost inside the phase that builds the machinery for refusing moved goalposts would be a strange thing to do
- **What the adversarial passes cost and bought:** 7 fresh agents, **77 real holes**. The capability gate lost **all seven of its checks** to two of them — a candidate carrying `child_process`, `curl | sh`, env exfiltration and an `/etc/cron.d` write got `PASS — read-only`, exit 0. One newline in a package name walked past the allowlist, the one control ADR-0110 names as the anti-slopsquatting defence. One NUL byte in a comment turned three BLOCKs into a PASS. A backslash in the candidate path — the ordinary native form on one leg — silently voided the entire scan
- **The one only running it could find:** Phase 07's sketches feature was not buggy, it was **unusable**. Approach fields collided with the slice ledger's own namespace, so any ledger carrying two sketches was blocked by seven `brief repeats key` errors. No test exercised it end to end, and the design error survived until an agent tried to use it
- **The failure this cycle kept committing:** a test that PASSES while executing nothing — three times, twice inside the suites written to prevent exactly that. Recorded as the cycle's first retro pattern
- **The gate refused the candidate it was built for:** madge was fetched, its integrity verified byte-for-byte, and BLOCKed as write-capable. Admitted 2026-08-03 on Ashiq's recorded OK, and arc gained a lock row and **no dependency** — ADR-0110's separation exercised end to end for the first time
- Full record: `initiatives/develop/` · evidence at `initiatives/develop/evidence/phase-0{5,6,7,8}/` · patterns in `docs/retro-log.md`

### C5 · arc-develop "The Developer — the execution harness" — CLOSED 2026-08-02 · lane `develop`

- **Back-filled at Cycle 6's close (2026-08-03).** The cycle closed with a retro stat line and an archived plan but never got its entry here — the same wiring gap C3 was back-filled for, and arc-develop had appeared **zero times** on this page until now. Recorded late rather than left missing.
- **Stat line (verbatim):** M | rework 2/4 | amendments 14 | FIRED 0/4 | burn ~38% | sim-blockers-r1 9 | t-to-phase0 ~0.2d
- **4/4 phases CLOSED:** 00 steel thread · 01 the proof floor · 02 earned judgment · 03 controlled escalation
- **Shipped:** `/arc-develop`'s five lifecycle modes over the ADR-0100 slice-ledger grammar · `develop-lint` with three structural BLOCKs and two WARN-first groups (ADR-0101) · handoff that refuses an unscored prediction block · `spec-fidelity` as an agent whose whole information set is the spec and the diff · fingerprint and attempt backstops emitting `slice.stuck`
- **The lesson it is remembered for:** the author of a gate wrote 26 breaking inputs for it and all 26 were caught — then an unanchored agent that had never seen the parser found **9 real holes**, including a four-slice ledger claiming `proof: it works` that parsed to zero slices, zero errors, and got "all checks passed ✔". Every adversarial rule in Cycle 6 descends from that
- **Decisions:** ADR-0100..0107 · archived plan at `initiatives/develop/archive/PLAN-cycle5-2026-08-02.md`
  — **0106 and 0107 corrected onto this cycle 2026-08-03** (created in PR #95, this cycle's kickoff
  commit; they extend the spine's receipt vocabulary to 21 then 22). The archived plan indexes only
  0100–0105 and is left exactly as it was: it is the record of what that cycle wrote down, not a
  place to retrofit what it should have.
- Full record: `initiatives/develop/` · evidence at `initiatives/develop/evidence/phase-0{0,1,2,3}/`

### C6 · arc-engine "The Model-Agnostic Foundation" — CLOSED 2026-08-03 · lane `engine`

- **Goal:** arc's processes stop being Claude-Code-dialect prisoners — a canonical model-neutral process layer plus an engine that runs any process on any driver
- **Result:** 4/4 phases · ~14% burn (~2.0 of 14d) · **REQ-08 PARTIAL** · ADRs 0200–0206
- **Shipped:** `processes/` format + `process-lint` (19 checks, 84-row two-class fixture corpus) · `arc-compile` **3/3 byte-identical**, source-of-truth flipped for 3 pilots · codex target + goldens · `arc-run` headless, 3 drivers, budgets, ADR-0204 escalation, 4-class secret scrub · `engine/router.yaml` mapping tier→model
- **The claim that is NOT proven:** no non-Claude driver was runnable here (`codex` absent, no endpoint), so REQ-08's ≥3 real runs on a second model family **did not happen**. Model-agnosticism remains untested end-to-end. Reported as a blocking finding, not waived — `initiatives/engine/evidence/phase-03/real-runs.md`
- **What the adversarial passes cost and bought:** 6 fresh agents, ~90 real holes. Four criticals in one pass alone, including that the routed tier reached NOTHING (`high-judgment` and `balanced-workhorse` invoked identically), making "escalation never changes a tier" vacuously true. Frontmatter injection could forge an `allowed-tools:` grant. `permissions: declared` with only `ask.human` silently meant unrestricted
- **The one only a real run could find:** the first live run failed on a ` ```json ` fence against 20 green fixture tests. Every fake returned bare JSON
- Full record: `initiatives/engine/` · evidence at `initiatives/engine/evidence/phase-0{0,1,3}/` · patterns in `docs/retro-log.md`

### C4 · arc-portfolio "The Conductor" — CLOSED 2026-08-02 · lane `portfolio`

- **Kickoff:** 2026-07-30 · design source `docs/strategy/plans/PLAN-portfolio.md` · appetite 3d Tier S
- **4/4 phases CLOSED:** 00 dual-mode machinery · 01 self-host + link history + board v1 · 02 parallel-safety floor · 03 docs truth + retro
- **Stat line (verbatim):** S | rework 1/4 | amendments 8 | FIRED 1/5 | burn ~112% | sim-blockers-r1 n/a-tier-S | t-to-phase0 1d
- **Shipped:** `initiatives/<lane>/` lanes + resolver on 7 surfaces (root-mode byte-identical, a permanent consumer contract) · `PORTFOLIO.md` board + strict-grammar board lint · ownership lint · WIP info line · the per-lane One Rule in the five docs that teach it
- **Mode B NOT certified** — granted for three hours on 2026-08-01 and withdrawn at Phase 02's close when section F's spool was reverted; ADR-0056 makes certification a fixture result, so removing the fixture removes the certification
- **Decisions:** ADR-0050..0062 (PORT-A..J, plus the three mid-cycle settlements 0060, 0061, 0062)
- **First cycle to finish over appetite:** 3d declared, ~3.35d actual. `appetite-sum` warned every run that 100% allocation left zero slack; Phase 02 overran 0.35d and there was nothing to absorb it. The gate was right, and this is the first firing on arc's own plan the outcome confirms.
- Full record: `initiatives/portfolio/` (PLAN · PROGRESS · phases) + `initiatives/portfolio/evidence/phase-0*`

### C3 · arc-design "The Designer" — CLOSED 2026-07-30 · lane `design`

- **Back-filled at Cycle 4's retro (2026-08-02).** The cycle closed with a retro stat line and an archive bundle but never got its entry here — precisely the wiring gap this page's own ⚠ TODO names. Recorded late rather than left missing: a company log with a hole cannot also be the truth hierarchy's immutable log.
- **Stat line (verbatim):** M | rework 0/4 | amendments 12 | FIRED 3/7 | burn ~60% | sim-blockers-r1 not-recorded | t-to-phase0 ~0.6d
- **Shipped:** vision-based design review that judges rendered pixels rather than reports about them — read-only critic, four-contract brief, thesis-driven exploration with blind ranking
- Full record: `docs/archive/PLAN-2026-07-30.md` · `docs/archive/PROGRESS-2026-07-30.md` · `docs/archive/phases-design-2026-07-30/` · index at `initiatives/design/HISTORY-INDEX.md`

### C2 · Receipt Spine — CLOSED 2026-07-28

- **Kickoff:** 2026-07-22 · design source `docs/strategy/plans/PLAN-cycle2-receipt-spine-v2.1.md` · appetite 2.5w Tier M
- **Phases 00–03 CLOSED** well under appetite (~40% burn): 00 spine core (25 adversarial holes fixed) · 01 factory wiring (7 flows emit, ~2s overhead → async) · 02 money+brief (REQ-08 cost CUT — owner's call) · 03 inbox + API seal (W8 cursor-store cut)
- **Phase 04 live dogfood** ran 2026-07-24 → 2026-07-28, host = arc itself · 3 real working days, every brief inside one screen and under the 5s budget (day 1: 10 lines / 306 ms)
- **Closed 2026-07-28 via `/arc-phase-done 4`** (`7e89a3a`), tracker archived the same day (`38b84e0`), retro recorded and its end-of-cycle scoreboard row written to `docs/retro-log.md`
- **REQ-01 closes `active`, not validated — the honest outcome, kept honest.** The dogfood proved *"every factory action leaves a receipt"* false in real use: the idem preimage carries no timestamp, so repeat hook emissions collided and **100 real receipts were silently discarded**. Rather than let a green tracker outrank a red instrument, REQ-01 was **downgraded `validated` → `active` at the retro**. Carried forward: the idem fix, and the still-unexplained 2026-07-26 silence (a second cause, recorded as a known unknown in `gap-audit.md` §5).
- **Decisions:** ADR-0024..0031 (SPINE-A..H) · ADR-0032 · revenue stays `revenue.simulated` until a venture ships
- Full record: `docs/archive/PLAN-2026-07-28.md` · `docs/archive/PROGRESS-2026-07-28.md` · `docs/archive/phases-spine-2026-07-28/` · `docs/evidence/phase-0*`

> **Correction (2026-08-03).** This row read **"LIVE — Phase 04 dogfood"** for five days after
> the cycle had closed. The work finished 2026-07-28 and three independent records said so —
> the archived tracker (*"Phase 04 CLOSED ✅ via `/arc-phase-done 4` — and with it Cycle 2"*),
> two git commits, and the retro-log's end-of-cycle scoreboard row, which is written only at
> close. Only this file, the company log, was never updated.
>
> **It cost a real decision.** `PLAN-cycle3-venture-launch.md` triggers on *"Cycle 2 closed …
> first money must not wait past ~2 weeks after it"*, and [ADR-0071](adr/0071-a-cycle-is-closed-when-history-says-closed.md)
> makes **this row** the thing that says whether a cycle is closed. So for five days the log
> reported the venture trigger as unfired when it had already fired on 2026-07-28 — the
> two-week clock runs to **2026-08-11**. Council session 002 debated the sequencing question
> against that wrong state, and this session repeated it to the owner twice before checking.
>
> Recorded here rather than quietly fixed, because the lesson is the point: *a trigger that
> reads a document is only as live as the document.*

### C1 · Orchestrator — CLOSED 2026-07-22

- **Goal:** turn arc into a manifest-driven product monorepo with physical boundaries
- **Result:** 6/6 phases · ~22% burn · rework 1/6 · 10 amendments · 1/8 gates FIRED
- **Shipped:** 6 products (core/plan/review/qa/git/council) · selective install (`--products`) + per-target `arc-registry.json` · scripts re-homed to `.claude/scripts/<product>/` · EVENT.d hook dispatcher · 22 commands · bats 271→334+
- **Decisions this era:** ADR-0014..0023 (incl. 0021 tests stay centralised · 0022 InvoiceFly does not exist · 0023 attic ≠ ownership)
- Full record: `docs/archive/PLAN-2026-07-22.md` · `docs/archive/evidence-orchestrator-2026-07-22/` · stat line in `docs/retro-log.md`

### v2 "world-best" quality engine — PARKED 2026-07-17 (ADR-0017)

- **What it was:** the pre-cycle-numbering initiative for a world-best quality engine — arc-scan pipeline (diff-scope → semgrep/gitleaks adapters → minimal-SARIF merge → triage), strictness profiles (`starter`/`standard`/`strict`), block-by-default gates (ADR-0008); phases 00–01 landed per `CHANGELOG.md` [Unreleased]
- **Why parked:** deliberate scope call, not failure — banked per A10; learnings fed ADR-0018 (incremental rehoming) and the orchestrator initiative
- Full record: `docs/archive/PLAN-2026-07-17.md` · `docs/archive/phases-v2-2026-07-17/`

## Rules

1. Append at `/arc-retro`, never mid-cycle (the live row may only flip status).
2. One entry per initiative, ~8 lines max; numbers from the retro stat line verbatim.
3. Always link the archive bundle — this page never duplicates evidence (A5).
