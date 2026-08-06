# PLAN (design source) — absorb: the technique refinery

> **Freeze log:** BRIEF-absorb.md (2026-08-04, owner-approved) analysed 2026-08-05
> against the live tree (PORTFOLIO.md, PLAN-develop §7.1, `capability-lock.json`,
> `arc-inbox` kinds, `docs/evidence/planner-bench/`) → v0.5 2026-08-05 → v0.6
> 2026-08-06: the owner-settled **two-speed model** folded in (fourth trigger arm —
> load-bearing installed capability; two-speed operating note; threshold assumption
> row) → **v1.0 2026-08-06, full plan — decisions ABS-A..F locked; ABS-G
> deliberately open until kickoff; real ADR numbers assigned at kickoff from the
> claimed century.** Drafted in Cowork chat sessions 08-05/08-06 over owner review
> rounds; landed in the tree on the owner's approval, uncommitted — the owner
> branches/commits/PRs; the sandbox never touches git. This drop also moves
> `BRIEF-absorb.md` to `docs/archive/` (evolve/leads/policy precedent) and updates
> both READMEs (plans ordering row + strategy file map/correction #14).
>
> **Scope honesty:** this cycle delivers the **technique loop** — study → extraction
> report → arc-native rebuild → A/B evidence → proposed adoption. It is NOT artifact
> acquisition (`/arc-capability`, DEV-B/C, ADR-0110 — installables), NOT runtime hiring
> (`BRIEF-executor.md` — INTEGRATE verdicts route there), NOT model routing (ROUTE →
> `engine/router.yaml`), NOT scoring infrastructure (bench sleeps; it inherits ABS-D
> when its own trigger fires), and NOT promotion machinery (evolve owns it; ABS-F keeps
> EVO-G undisturbed).
>
> **Trigger (pull, any one — evidence is the gate, A8):** a task class arc already runs
> **demonstrably loses** to an external agent's approach (owner-run A/B or bench-off,
> receipted — the `evidence/planner-bench/` PLANOFF format is the house precedent) · a
> develop Capability Proposal concludes "the gap is a **technique**, not an installable
> artifact" · the owner names a measured weakness and asks for an absorb · an
> **installed capability turns load-bearing** (fourth arm, owner-settled 08-06): a
> skill/MCP/agent-definition installed via the DEV-B/C path (manual owner install,
> vet + lock row) shows **receipted use across ≥2 cycles** (directional threshold —
> confirmed at kickoff) or a lane's brief/retro names it as required for the lane to
> function; the lock row + REQ-05's per-slice use receipts ARE the detection
> machinery — no radar, no scheduled scanning (that no-go stands). **As of
> 2026-08-06 no arm has fired.** The kickoff prompt requires naming the evidence.
> **Prerequisites (state 2026-08-06):** spine live ✓ · lanes live ✓ · develop C6 closed
> ✓ (capability machinery — re-verify what shipped, at kickoff) · engine C6 closed ✓
> (`arc-run` + router.yaml) · **do not start while another lane holds the live slot
> (A9) — leads holds it as of 08-04, and the policy cycle is reported running per
> owner session notes 08-06; read the board at kickoff** · **venture clock (ADR-0071
> → 2026-08-11) resolves first; §10: venture outweighs OS on ties.**
>
> **Relationship to existing plans:** develop's DEV-B/C pulls in *artifacts* during
> builds — absorb internalizes *techniques* as edits to arc's own files (standing loop,
> cross-lane); REQ-05 lands develop's team-leader addendum here (EVO-H0 precedent:
> enablement lands in the client's cycle). executor is the twin brief — one study, two
> destinations: technique → absorb rebuild, capability → executor INTEGRATE; its
> router `judge:` field consumes ABS-D's grammar. bench compares candidates on
> fixtures — absorb *produces* variants for judging, never scores itself; bench's
> brief gains its one inheritance line at bench's own kickoff, not now. discover mines
> the venture market; absorb mines the technique market. evolve owns promotion
> machinery — absorb proposes through the inbox and ABS-F (default: bench-style A/Bs)
> leaves evolve's first-client seat (EVO-G: growth) untouched.
>
> **Two-speed operating model (owner-settled 2026-08-06):** integration and
> absorption are a relay, not rivals. **Speed 1 — install and use:** market
> skills/MCPs/agent-definitions pulled in when needed (manual owner action; for
> arc-cycle use the existing DEV-B/C law already applies — `capability-vet.sh`
> content scan + `capability-lock.json` row, so the install receipt and the
> permission look cost nothing new). Market velocity, zero build cost, original
> full power. **Speed 2 — absorb the proven winners (this plan):** technique
> portions rebuilt arc-native on the ABS-C allowlist; service portions stay
> installed per the INTEGRATE verdict — Figma/Slack-class integrations are
> services, not techniques; there is nothing to rebuild. **Speed 1 is Speed 2's
> evidence supply**: what agents demonstrably lean on in receipted daily work is
> what earns a rebuild — the trigger queue builds itself from work, never from
> scanning. ADR-0110 unchanged: `/arc-capability` installs nothing; install stays
> a manual owner action.

## Goal

One sentence: `/arc-absorb <source>` turns an external agent/tool's superior
**technique** into native, receipted arc capability — read-only study → deterministic
extraction report → classification (ABSORB / INTEGRATE / ROUTE / SKIP) → arc-native
rebuild on an allowlist → A/B evidence in PLANOFF form → **proposed** adoption through
the inbox — so the market's best ideas keep compounding into arc without runtime
dependencies, supply-chain risk, or license contamination.

## Current state (verified 2026-08-05 — re-verify at kickoff)

- **The brief's century line is stale and this plan supersedes it.** BRIEF-absorb
  (08-04) says "0400–0499"; PORTFOLIO.md (updated 08-04, after the brief) shows
  0400–0499 claimed by **leads** at birth (0400–0413 taken). Next free century =
  **0500–0599 as of the 08-04 board** — expectation only, and already drifting: the
  policy cycle (POL-K century open by design) is reported running per owner session
  notes 08-06 and would take 0500 when its kickoff commit lands, moving absorb's
  expectation to 0600–0699. The rule is "next free per the PORTFOLIO band table,
  confirmed at kickoff" (the 0063–0068 double-claim of 08-02 is why bands exist;
  `kickoff-lint [adr-dup]` is the control).
- Constitution **ADOPTED v1.0 on 2026-08-06** — confirmed in the strategy README file
  map: `CONSTITUTION.md` at repo root, receipt `01KZ9V0QXNNMB3ZH18MSH8DKH3`,
  sha256-pinned. The articles this plan cites are law, not draft.
- Board 08-04: **leads LIVE (Cycle 8** — Phases 00-01 closed, Phase 02 next; Phase 03
  blocked-on offer/domain/ICP). All other lanes IDLE. Mode A = one working tree, one
  session — this kickoff waits for the live slot (A9). Mode B NOT certified.
- `capability-lock.json` is **live** at `.claude/scripts/develop/` with one real row
  (madge 8.0.0: version + sha512 + provenance + publisher-auth + recorded human OK) —
  the lock discipline REQ-04 defers executables to is real, not aspirational.
- PLAN-develop **§7.1** (capability-scout, Capability Proposal table,
  `capability-vet.sh` BLOCK gate) exists; **no team-leader section exists yet** — the
  REQ-05 diff target is confirmed absent, so the addendum is new text, not a merge
  conflict.
- `approval.requested` / `decision.recorded` are live kinds and `arc-inbox` already
  folds them (list OPEN approvals, wrong-kind error path) — ABS-D needs **zero new
  kinds**, payload-profile-only (the POL-E `subject:` profile pattern is the
  precedent).
- PLANOFF precedent is real: `docs/evidence/planner-bench/PLANOFF-01`, `PLANOFF-02`,
  `LEDGER.md` — protocol/scoring/RESULTS layout exists to reuse, not reinvent.
- Spine 08-04: 955 events / 31 kinds live; only 7 kinds ever used — vocabulary
  discipline is cheap to honor and non-negotiable anyway.
- Named threat model: **ToxicSkills-class prompt injection** through studied
  READMEs/prompts/transcripts. Study input is hostile input — parser-class rules
  apply from birth.

## Success requirements

| REQ | User outcome | Measurable acceptance | Phase | Status |
|---|---|---|---|---|
| REQ-01 | A named source becomes a study pack I can trust without reading the source myself | `/arc-absorb <source>` (repo / docs / transcripts) produces `extraction-report.md` per the ABS-B template: technique inventory · per-technique classification (**ABSORB / INTEGRATE / ROUTE / SKIP**) with reason · license note per source · citation per claim (file:line or transcript ref). `report-lint` checks required headings/fields deterministically (WARN-first in TRIAL). Study is **read-only**: studied third-party code never executes (no install, no import, no eval — fixture-proven); hostile-content red corpus (injection strings in READMEs, prompts posing as instructions, path-traversal in "docs") lands as **pinned fixtures with the adversarial pass before any FAIL promotion** (parser-class rule). A source needing >1 day of archaeology → SKIP row with reason, not a longer study | 1 | active |
| REQ-02 | An ABSORB verdict becomes a reviewed diff, never a dependency | Rebuild lands only on the **ABS-C allowlist** (processes / playbooks / command bodies — mirror of evolve's `promote_via` discipline); out-of-allowlist rebuild path = lint warning from birth (WARN-first in TRIAL, promotion via retro). Ideas are re-expressed; incompatible-license copy = **refusal recorded in the registry** (status + reason); permissive-license copying (MIT/BSD/Apache) carries **attribution in two places**: the registry row's `attribution:` field and a source-comment in the rebuilt file. Zero new runtime dependencies — fixture greps the diff for imports/installs | 2 | active |
| REQ-03 | Adoption claims are evidence, not vibes | Old-way vs absorbed-way on **≥3 representative fixtures/tasks of the weak class**; deterministic checks where they exist, else the owner-judge receipt (REQ-06). Results land in **PLANOFF layout** (protocol / scoring / RESULTS) under `docs/evidence/absorb/` with a ledger line; the results table travels **with** the adoption proposal — a proposal without its table is lint-invalid | 4 | active |
| REQ-04 | One honest ledger of every technique arc has looked at | One registry file (ABS-A) tracks every candidate: status `candidate\|trial\|adopted\|retired` · source · evidence links · review-by date. **Cap ≤12 adopted per lane**; at the cap, a new adoption names its displacement (the retire proposal rides with it). Adopt/retire status transitions require a `decision.recorded` ref — transition without a decision ref = lint warning (WARN-first). Executable artifacts stay under `capability-lock.json` discipline (registry rows reference lock entries, never duplicate pin/hash data — A5) | 2 | active |
| REQ-05 | develop's team leader learns to use the toolbox, in this cycle | The PLAN-develop **§7.1 addendum lands as this cycle's reviewed diff + a freeze-log line** (EVO-H0 precedent): consult registry + lockfile at brief time · receipted use per slice · Capability-Proposal verdict set gains `technique → refer to absorb` · cap ≤12 with displacement · retro retire-review row (unused 2 cycles → propose retire) · adopt/retire propose-only. A reusable **"Toolbox" template block** is included for future lane plans. Roles ≠ standing agents: every duty is a harness step, never a daemon. Cross-lane edit discipline: the diff is reviewed like any other, and ABS-E records the boundary ruling so it is never re-litigated | 3 | active |
| REQ-06 | A human judgement is a receipt, not a memory | **Owner-judge grammar (ABS-D), defined once here:** blind A/B — variant labels randomized, the label→variant mapping sealed in the evidence bundle and revealed only after the decision is recorded; `approval.requested` carries a strict `subject: "absorb.ab-judgement"` payload profile (candidate id, fixture list, blind labels, evidence path, correlation — unknown keys rejected, `assertDecision`-style) → owner picks via the existing inbox → `decision.recorded` carries **pick + reason, both mandatory**. **Zero new event kinds** (POL-E profile pattern). bench inherits this grammar when its own trigger fires — its brief gains one line then, in its own kickoff | 3 | active |
| REQ-07 | Nothing adopts itself, in either direction | Adoption AND retirement each end as an inbox item with reason; no self-adoption path exists. Fixture: a registry transition to `adopted` or `retired` without its `decision.recorded` ref trips the REQ-04 lint; the harness offers no code path that writes those statuses directly | 3 | active |
| REQ-08 | One real absorb, end-to-end, on a real weakness | The trigger's named losing class goes through the whole loop: study → extraction report → classification → rebuild diff → ≥3-fixture A/B (PLANOFF layout) → adoption proposal in the inbox → owner decision recorded. The complete evidence bundle is committed. This REQ is the cycle's proof-of-life: mechanics without one real absorb = cycle not done | 4 | active |

## Appetite

**1.5 weeks (8 working days) hard cap.** **Tier: M** (8 active REQs ≤ 10). Planned
allocation **6.5d, leaving ~1.5d slack** — portfolio C4's 112% overrun on a
100%-allocated plan is the standing lesson; slack is never taken from the adversarial
day. **Kill criteria:** 2 consecutive absorbs fail their A/B → the loop isn't paying;
park the lane, bank the report template + registry as documentation (they remain
useful standalone). A source needing >1 day of archaeology → SKIP, record why. The
read-only study boundary cannot be fixture-proven in Phase 1 → **STOP** — an
unprovable boundary is a no (executor's isolation rule, applied here).

## Decisions to ADR at kickoff (absorb century — next free per PORTFOLIO.md, expected 05xx)

| ID | Decision (candidate text — locked at v1.0 freeze, numbered at kickoff) |
|---|---|
| ABS-A | **Registry = one absorb-owned file** (lean: `products/absorb/registry.json` — machine-checkable JSON, schema in-file via `$comment`), decided finally after Phase 0's DEV-B/C audit confirms `capability-lock.json`'s actual shape. One registry, lane-scoped rows, never per-lane forks (A5). Registry rows **reference** lock entries for anything executable; pin/hash/provenance data lives only in the lock (no duplication). Row shape: id · name · status (`candidate\|trial\|adopted\|retired`) · lane · source (+license) · classification ref (report path) · evidence links · attribution (nullable) · decision refs (adopt/retire) · review-by date |
| ABS-B | **Extraction-report template — deterministic, lint-checkable.** Fixed headings: Source (identity + pin: commit/URL/date · license) · Study scope (what was and was not read; archaeology budget spent) · Technique inventory (per row: id · name · what it does · why it wins · evidence citation file:line/transcript ref · classification verdict + reason · license note · risk note) · Verdict summary (counts per bucket) · SKIP/refusal log. **Attribution rule lives here:** permissive-license copying records attribution in the registry row AND a source-comment in the rebuilt file; incompatible license = refusal, logged. `report-lint` validates headings + required fields per row (WARN-first in TRIAL) |
| ABS-C | **Rebuild target allowlist** (arbitrary paths never allowed), mirror of evolve's `promote_via`: `processes/**` · `docs/playbooks/**` · `.claude/commands/**` (command bodies) · plus `tests/**` fixtures that accompany a rebuild. Explicitly OUT: engine code, spine/hq scripts, `.claude/settings.json`, workflows, anything executable-by-hook. Allowlist lives in one place (the ADR + a lint-readable list); widening it is an ADR amendment, never a convenience edit |
| ABS-D | **Owner-judge receipt grammar (shared: absorb now, bench later).** Blind A/B: randomized variant labels; label→variant mapping sealed in the evidence bundle until the decision is recorded. `approval.requested` with strict profile `subject: "absorb.ab-judgement"` (candidate id · fixture list · blind labels · evidence path · correlation; unknown keys rejected) → `decision.recorded` with **pick + reason mandatory**. Zero new kinds; profile-only (POL-E precedent). Defined once, here; bench's brief gains its inheritance line at bench's own kickoff |
| ABS-E | **Boundary rulings, recorded so nobody re-litigates:** vs **DEV-B/C** — installable artifact = develop's vet+lock; technique-as-edit = absorb; a Capability Proposal returning "technique" refers here. vs **bench** — bench scores, absorb produces; absorb never scores itself. vs **discover** — markets differ (ventures vs techniques). vs **evolve** — evolve owns promotion machinery and experiment kinds; absorb proposes via inbox only. **Cross-lane diffs** (REQ-05's develop addendum) are legitimate absorb-cycle work when the receiving plan gets a freeze-log line — ruling recorded here so the retro question is pre-answered |
| ABS-F | **absorb's A/Bs run bench-style (owner-judged, PLANOFF format) in v1** — NOT through evolve's experiment machinery, because EVO-G names growth as evolve's first client and evolve C7 is fixture-proven but unexercised; absorb jumping the queue would spend that first-client slot on OS-side work. Flipping this needs an **evolve-side ruling**, never an absorb-side convenience |
| ABS-G | **OPEN — decided at kickoff, recorded with the kickoff ADR set:** century number (next free per PORTFOLIO.md — expected 05xx, or 06xx once the policy lane lands; the band table at kickoff is the truth) · code home (`products/absorb/` docs+registry with scripts at `.claude/scripts/absorb/`, develop-lane symmetry — lean only) · registry seeded empty vs from pilot notes · **first absorb target** (from the trigger's losing class — the kickoff prompt requires naming it) |

## Non-negotiables

- **Read-only, injection-aware study**: studied READMEs/prompts/transcripts are
  hostile input — parser-class discipline, pinned red fixtures, adversarial pass
  before any FAIL promotion; studied code never executes (no install/import/eval);
  execution happens only via vetted paths after rebuild.
- Emitter/reader discipline everywhere; **zero new event kinds** — ABS-D is
  payload-profile-only.
- License hygiene per REQ-02/ABS-B: re-express ideas; refuse incompatible copies;
  attribute permissive copies in registry + file.
- **Propose-only, both directions** — adoption and retirement end in the inbox; no
  self-adoption path exists (REQ-07).
- Zero-dep Node/POSIX (A2) · central `tests/` (ADR-0021) · all new lint WARN-first in
  TRIAL (promotion via retro only).
- Never delete — SKIPped sources and retired techniques keep their rows/reports
  (attic spirit, A10).
- Constitution articles this plan upholds, for kickoff-lint: E3, A2, A5, A8, A9, A10.

## No-gos (this cycle)

Marketplace/leaderboard ambitions · scheduled auto-scanning (human-started only; the
scheduler is its own sleeping brief behind policy) · absorbing model quality (ROUTE →
router.yaml, engine territory) · >1 absorb in flight · any standing absorb daemon ·
touching evolve's EVO-F verdict math, floors, or experiment kinds · new event kinds ·
installing/executing studied artifacts (that path is DEV-B/C's vet+lock or executor's
INTEGRATE, never absorb's) · editing files outside the ABS-C allowlist.

## Rabbit holes (named detours)

- **Perfect report template** — v1 fields are the ones with live consumers
  (classification, citations, license, attribution); taxonomy elegance is stale slop
  on arrival.
- **Source archaeology** — >1 day = SKIP with reason. The refinery processes ore; it
  does not excavate mines.
- **Building a scoring engine** — deterministic checks reuse existing test patterns;
  anything fancier is bench's territory when bench wakes.
- **Absorbing frameworks whole** — the unit is a *technique* (one registry row, one
  rebuild diff); "rebuild their whole pipeline" is several candidates or a SKIP.
- **Studying without a named weakness** — no trigger, no study (A8); curiosity-driven
  scanning is the auto-scan no-go wearing a costume.

## Assumptions ledger

| Assumption | How we'd know it's wrong (trigger) | Phase that tests it |
|---|---|---|
| The 4-bucket decision matrix classifies real findings cleanly | A finding fits no bucket honestly during the real study | 4 (recorded in the report; matrix extended by ADR, never shoehorned) |
| Blind owner-judging is cheap (minutes per A/B, not hours) | Judging one candidate exceeds ~30 min or gets skipped/delegated | 4 + dogfood |
| ≤12 adopted per lane is the right cap size | Displacement fires immediately (too small) or the registry never nears it (moot) | dogfood/retro |
| The develop addendum is an uncontroversial cross-lane diff | Review objects to absorb editing PLAN-develop | 3 (ABS-E ruling pre-answers it; objection = retro input) |
| Read-only study is fixture-provable | P1 cannot prove the no-execution boundary | 1 (kill criterion — STOP) |
| "Load-bearing" = receipted use across ≥2 cycles (or named by a lane brief/retro) is the right fourth-arm threshold | The arm fires on a fad tool nobody misses later, or never fires despite obvious daily dependence | 4 + retro (threshold re-tuned by ADR note, never by vibes) |

## Pre-mortem (top 5 — seeded from history first)

| # | Failure cause | Mitigation or accepted |
|---|---|---|
| 1 | Prompt injection from studied content (ToxicSkills-class is the named threat; engine's adversarial pass forged `allowed-tools:` via frontmatter — same class) | Read-only study, parser-class red fixtures pinned from birth, quarantine discipline, execution only via vetted paths; P1 kill criterion if unprovable |
| 2 | Technique misread → plausible-but-wrong rebuild | Citations mandatory per claim (file:line); the A/B is the arbiter, not the report's prose; 2-consecutive-fail kill criterion parks the lane |
| 3 | absorb becomes tool-hoarding (every org's default failure) | Cap ≤12 + displacement-names-its-retire + retro retire-review (unused 2 cycles) + the A/B gate in front of every adoption |
| 4 | Century collision (precedent: model-policy and develop both took 0063–0068 on 08-02; this brief's own 0400 line went stale in days) | Claim at birth from the live PORTFOLIO band table; numbers in this plan are expectations, never law; `kickoff-lint [adr-dup]` is the control |
| 5 | Cross-lane addendum lands as an untracked side-door edit | REQ-05 is a named REQ with a reviewed diff + freeze-log line in PLAN-develop; ABS-E records the ruling; nothing lands "while we're in there" |

## External dependencies

None. Studied sources are read-only local clones/docs/transcripts; zero-dep Node
throughout (A2); no network beyond fetching the source itself, which happens before
study begins and is pinned (commit/date) in the report.

## Phases (risk-ordered)

| Phase | Capability | Appetite |
|---|---|---|
| 0 | **Steel thread = the matrix and its paperwork.** DEV-B/C boundary audit (what develop C6 actually shipped — lock shape, vet gate, proposal table) · ABS-A registry decision finalized · ABS-B template + `report-lint` (WARN-first) · century claimed, ADS numbered, ABS-A..G recorded | 1d |
| 1 | **Study harness, hostile-input-first.** `/arc-absorb <source>` read-only pipeline → extraction report; classification wiring; injection red corpus pinned + **adversarial pass (untouchable within this phase)**; no-execution boundary fixture-proven or STOP | 2d |
| 2 | **Registry + guards.** Registry live with status lint (cap ≤12, displacement, decision-ref transitions) · ABS-C allowlist lint · license/attribution gate · `docs/evidence/absorb/` PLANOFF-layout skeleton + ledger | 1d |
| 3 | **Governance drop.** ABS-D owner-judge profile + blind-mapping mechanics + inbox chain fixtures (REQ-06, REQ-07) · REQ-05 PLAN-develop team-leader addendum as the reviewed diff + freeze-log line + Toolbox template block | 1d |
| 4 | **The real absorb (REQ-08).** The trigger's losing class end-to-end: study → report → rebuild diff → ≥3-fixture A/B → sealed-blind owner judgement → adoption proposal + decision · evidence bundle committed · retro | 1.5d |

**North-star:** the day an external agent demonstrably beats arc at something arc
does, the losing receipt becomes a study, the study becomes a diff, the diff becomes
an A/B win, and the win becomes an owner-approved adoption — all receipted, with zero
new runtime dependencies. Compounding without contamination.

---

## KICKOFF PROMPT — paste into Claude Code in the arc repo (only after the trigger fires)

```
/arc-kickoff --lane absorb absorb v1 — the technique refinery

Design source: docs/strategy/plans/PLAN-absorb.md (v1.0, approved; trigger fired:
<state the evidence — which task class lost, receipt/PLANOFF refs; or the develop
Capability Proposal returning "technique"; or the load-bearing installed capability:
lock row + ≥2 cycles of use receipts>). Read it fully.
Gates before anything: the live slot is free (A9 — no other lane mid-cycle) · the
venture-clock ruling (ADR-0071, 2026-08-11) is resolved · the trigger evidence above
is receipted, not remembered.
New lane: claim the NEXT FREE ADR century per PORTFOLIO.md (expected 05xx, or 06xx
if the policy lane landed first — the brief's 0400 line is stale; the band table is
the truth). Decisions ABS-A..F are
locked; decide ABS-G (century, code home, registry seed, first target) NOW and record
it with the kickoff ADR set.
Phase 0 starts with the DEV-B/C boundary audit and ABS-A. Phase 1's read-only study
boundary is fixture-proven or the cycle STOPs. REQ-05 lands the PLAN-develop
team-leader addendum as this cycle's reviewed diff + freeze-log line.
Study is read-only and injection-aware (parser-class, pinned red fixtures);
propose-only everywhere; zero new event kinds (ABS-D is a payload profile).
STOP after PLAN.md + phase specs + kickoff-lint pass — I approve before Phase 0 work.
```
