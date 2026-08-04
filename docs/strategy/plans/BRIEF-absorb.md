# BRIEF — absorb (the technique refinery)

> **Added 2026-08-04 (owner-approved from a Cowork session draft) — sleeping until its
> trigger fires.** Self-contained: the team-leader duties, the registry, and the
> owner-judge grammar all land in THIS cycle (EVO-H0 precedent: enablement lands in the
> client's cycle).

> **Trigger (pull, any one):** a task class arc already runs demonstrably loses to an
> external agent's approach (owner-run A/B or bench-off evidence, receipted — the
> `evidence/planner-bench/` PLANOFF format is the house precedent) · a develop
> Capability Proposal concludes "the gap is a **technique**, not an installable
> artifact" · owner names a measured weakness and asks for an absorb.
> **Prereqs (all MET, verified 2026-08-04):** spine live ✓ · lanes live ✓ · develop C6
> closed ✓ (capability machinery per PLAN-develop §7.1 — re-verify what shipped, at
> kickoff) · engine C6 closed ✓ (`arc-run` + router.yaml live).

**Goal:** `/arc-absorb <source>` turns an external agent/tool's superior **technique**
into native, receipted arc capability — study → extraction report → arc-native rebuild →
A/B evidence → **proposed** adoption — so the market's best ideas keep compounding into
arc without runtime dependencies, supply-chain risk, or license contamination.

**Lane:** NEW — born by `/arc-kickoff --lane absorb`, claiming the next free ADR century
(0400–0499 per the PORTFOLIO.md band table, confirmed at kickoff).

**Scope lines (extend, don't duplicate — A5):** develop's DEV-B/C pulls in *artifacts*
during builds; absorb internalizes *techniques* as edits to arc's own files — standing
loop, cross-lane. bench compares candidates on fixtures; absorb *produces* variants for
judging, never scores itself. discover mines the venture market; absorb mines the
technique market. evolve owns promotion machinery — absorb proposes through it, and one
open decision below keeps EVO-G (growth = first experiment client) undisturbed.

**REQs (measurable):**
1. **Study pack:** for a named source (repo/docs/transcripts), a deterministic-template
   **extraction report**: technique inventory · classification per the decision matrix
   (**ABSORB** technique / **INTEGRATE** infra / **ROUTE** model / **SKIP** data-moat)
   with reasons · license note · citations (file/line or transcript). Study is
   **read-only** — studied third-party code never executes here.
2. **Rebuild:** an ABSORB-classified technique lands as a reviewed diff to files on a
   named allowlist (processes / playbooks / command bodies — mirror of evolve's
   `promote_via` discipline). Ideas re-expressed; incompatible-license copy = refused;
   MIT copying carries attribution.
3. **A/B evidence:** old-way vs absorbed-way on ≥3 representative fixtures/tasks of the
   weak class. Deterministic checks where they exist; otherwise the **owner-judge
   receipt** (REQ-6). Results table travels with the proposal — PLANOFF's
   protocol/scoring/RESULTS layout is the format to reuse, not reinvent.
4. **Registry:** one file tracks every candidate: status `candidate|trial|adopted|
   retired` · source · evidence links · review-by date. Cap **≤12 adopted per lane**.
   Executable artifacts keep `capability-lock.json` discipline (pin + hash + provenance).
5. **Team-leader duties land here** (the develop §7.1 addendum, applied as this cycle's
   reviewed diff to PLAN-develop + a freeze-log line): consult registry+lockfile at brief
   time · receipted use per slice · Capability-Proposal verdict gains `technique → refer
   to absorb` · cap ≤12 with displacement (a hire at the cap names its retire) · retro
   retire-review row (unused 2 cycles → propose retire) · adopt/retire propose-only.
   Reusable "Toolbox" template block included for future lane plans. Roles ≠ standing
   agents: duties are harness steps, never a daemon.
6. **Owner-judge receipt grammar:** blind A/B pick + reason, recorded via existing kinds
   (`approval.requested` → `decision.recorded`). Defined once here; bench inherits it
   when its own trigger fires (its brief gains one line then, in its own kickoff).
7. **Propose-only, both directions:** adoption AND retirement each end in the inbox with
   reason. No self-adoption, ever.
8. **One real absorb end-to-end** on a real measured weakness, evidence bundle committed.

**Appetite:** 1.5 weeks. **Tier: M** (≤10 active REQs).
**Kill criteria:** 2 consecutive absorbs fail their A/B → the loop isn't paying; park,
bank report template + registry as documentation. A source needing >1 day of archaeology
→ SKIP, record why.

**Decisions to ADR at kickoff (absorb century, next free 04xx):**

| ID | Decision |
|---|---|
| ABS-A | Registry location + schema (extend `capability-lock.json` vs own file — decided after the Phase-0 DEV-B/C audit); one registry, lane-scoped rows, never per-lane forks |
| ABS-B | Extraction-report template fields — deterministic, lint-checkable |
| ABS-C | Rebuild target **allowlist**; arbitrary paths never allowed |
| ABS-D | Owner-judge receipt grammar (shared: absorb A/Bs now, bench later) |
| ABS-E | Boundary rulings vs DEV-B/C · bench · discover · evolve, recorded so nobody re-litigates |
| ABS-F | Whether absorb's A/Bs run bench-style (owner-judged, PLANOFF format) or exercise evolve's experiment machinery — **default bench-style v1**, because EVO-G names growth as evolve's first client and evolve Cycle 7 is fixture-proven but unexercised; flipping this needs an evolve-side ruling, not an absorb-side convenience |

**Non-negotiables:** emitter/reader discipline; **zero new event kinds** · read-only,
injection-aware study (studied READMEs/prompts are hostile input — parser-class, pinned
red fixtures) · license hygiene per REQ-2 · propose-only everywhere · zero-dep
Node/POSIX · central `tests/` · all new lint WARN-first in TRIAL.

**No-gos:** no marketplace/leaderboard ambitions · no scheduled auto-scanning
(human-started; scheduler is its own sleeping brief) · no absorbing model quality
(that's ROUTE → router.yaml) · no >1 absorb in flight v1 · no standing absorb daemon ·
no touching evolve's EVO-F verdict math or floors.

**Pre-mortem top-3:** (1) absorb becomes tool-hoarding → cap ≤12 + displacement +
retire review + A/B gate; (2) technique misread, plausible-but-wrong rebuild → report
must cite source lines; the A/B is the arbiter; (3) prompt-injection from studied repos
(ToxicSkills-class) → read-only study, quarantine discipline, execution only via vetted
paths.

**Open decisions at kickoff:** first absorb target (from the pilot's losing class) ·
report template depth · registry seeded from pilot notes or empty.

**Kickoff prompt:**
```
/arc-kickoff --lane absorb absorb v1 — the technique refinery
Design source: docs/strategy/plans/BRIEF-absorb.md (trigger fired: <state the
evidence — which task class lost, receipt/PLANOFF refs>). New lane: claim the next free
ADR century per PORTFOLIO.md. Phase 0 starts with the DEV-B/C boundary audit (A5) and
ABS-A. REQ-5 lands the PLAN-develop team-leader addendum as this cycle's reviewed diff.
Decisions ABS-A..F directional — finalize, assign numbers from the claimed century.
Study is read-only and injection-aware; propose-only everywhere. STOP after PLAN.md +
phase specs for my approval.
```
