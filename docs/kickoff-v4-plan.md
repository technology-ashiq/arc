# Kickoff v4 Plan — "Make the substance floor real"

> **Status: PROPOSED (2026-07-14, trimmed) — not started.** Continues `docs/kickoff-v3.5-plan.md`.
> Round 5 built the multi-agent planning engine; v3.5 built the deterministic substance floor
> underneath it — but shipped every substance gate in **WARN-first TRIAL mode**, so the floor
> **does not actually gate yet**. This round does the one mandatory thing: **make the floor real**,
> plus close one small verifiable gap. Two items only.
>
> **Scope was cut deliberately.** The 2026-07-14 gap analysis proposed 5 items; on review, only
> **F1 + H1** are mandatory. **P1 (premise gate), P2 (prior-art), F2 (retro-log flywheel) are
> deferred** — see "Explicitly deferred" for the reasoning. The honest verdict: more gates raise the
> floor, they do not win "world's best." That is proven by outcome evidence (the Round 6 benchmark),
> not by check count — so v4 stays small and the energy goes to the benchmark next.
>
> **Appetite: 1 day.** Kill criterion: not done in a day → the deterministic floor isn't the
> problem; stop and go straight to Round 6 (benchmark). Everything here is a **script check, a
> template field, a command-text line, or a ledger file.** No new agents. No LLM needed to run any gate.
>
> **Doctrine (unchanged):** anchored creation · unanchored verification · deterministic gates. F1 is
> the item that finally makes "scripts GATE" literally true instead of advisory.

---

## Why this round exists

arc already beats GSD / gstack / Superpowers on the thing that matters most — a **deterministic gate
on the PLAN artifact** (kickoff-lint), which none of them have. v3.5 pushed that gate from *shape*
to *substance* (`[pre-mortem-cite]` `[appetite-sum]` `[architecture]` `[adr-wired]`
`[adr-confidence]` `[nonneg-drift]` `[current-state-structure]`). But it shipped all of them in a
`TRIAL` set: they **WARN, never FAIL**. Promotion to a real gate is currently *"remove the group from
the `TRIAL` set when a retro judges it useful — one line"*: subjective, unlogged, no criteria.

So the entire substance floor is **advisory in perpetuity** unless someone makes a judgement call —
which is the exact LLM-self-assessment the doctrine exists to avoid, moved up one level. **F1 fixes
that** with deterministic, logged promotion criteria. **H1** closes the one remaining checkable gap
from Round 2 (expected-fail-first was never made a gate). That is the whole round.

Everything else the gap analysis surfaced (premise teeth, prior-art, the flywheel) is real but **not
mandatory** — deferred with reasons below, so nothing is silently dropped.

---

## Verified state as of 2026-07-14 — do NOT re-plan these (already shipped)

Checked against the live tree, not memory:

- **Agents** (`.claude/agents/`): `codebase-surveyor`, `question-planner`, `plan-attacker`,
  `plan-simulator`, `product-challenger` — all present.
- **`arc-kickoff.md`**: full v3 flow (0 → 9) — tier derivation (S/M/L), surveyor, premise block +
  question-planner, parallel research + slopsquatting check + spike, reversibility ADRs, attack
  panel ×3, phase `Depends on:` + no-cycles, simulation gate 8.5, second opinion 8.75, banned-exits STOP.
- **`kickoff-lint.mjs`** (~291 lines): groups include `[tier] [reqs] [vague] [phases] [phase0]
  [phase-deps] [assumptions] [pre-mortem] [pre-mortem-cite] [deps] [adr] [adr-wired] [adr-confidence]
  [appetite-sum] [architecture] [nonneg-drift] [spike] [kill-criteria] [current-state]
  [current-state-structure] [retro-log] [progress]`. The v3.5 substance groups sit in a `TRIAL`
  set → WARN with a `[trial]` suffix even on v3 plans.
- **Tests**: 35/35 bats green; live repo lint exit 0.
- **retro-log.md**: header only, **0 pattern rows**.

If an item below duplicates any of the above, it is a bug in this plan — delete it.

---

## Items (mandatory — 2)

Legend per item: **File · Now · Rule · Fixture · Honesty**. Every gate ships with its fixture in the
same commit. Anything that touches an LLM-produced signal routes through `v3check()` (grandfather rule).

### F1 — Trial-gate promotion protocol *(the mandatory item — make the floor real)*
**File:** `.claude/scripts/kickoff-lint.mjs` (the `TRIAL` set + a `[trial-status]` summary line) ·
`.claude/commands/arc-retro.md` · new `docs/trial-ledger.md` (+ a template row).
**Now:** promotion of a TRIAL gate to a real FAIL is *"remove the group from the `TRIAL` set after
`/arc-retro` judges it useful — one line."* No criteria, no log, no evidence bar. The entire v3.5
substance floor is advisory until a subjective call is made — the LLM-self-assessment the doctrine
forbids, one level up.
**Rule (deterministic promotion criteria):** a TRIAL gate is **promotable** only when both hold —
1. its bats fixture proves it **FAILs on the mutation** and the `good/` fixture passes clean, **and**
2. it has fired **zero false-positives across ≥ 3 recorded dogfood kickoffs** logged in
   `docs/trial-ledger.md` — schema `date | gate | run-ref | fired? | false-positive?`.
`/arc-retro` reads the ledger and promotes (removes the group from `TRIAL`) **only** gates that clear
the bar — one auditable line per promotion in git. `kickoff-lint.mjs` prints a `[trial-status]`
footer: `N gates live, M in trial (see docs/trial-ledger.md)`. Promotion becomes evidence-driven, not vibe.
**Fixture:** none needed for the protocol itself; `docs/trial-ledger.md` ships with one filled
example row so the schema is unambiguous.
**Honesty:** "3 clean runs" is a threshold, not a proof of correctness — it bounds false-positive
risk, which is exactly what WARN-first was protecting against. Say so where the criteria are documented.

### H1 — Expected-fail-first, gated *(close Table-1 #12)*
**File:** `docs/templates/phase-spec-template.md` (Verification block) · `.claude/scripts/kickoff-lint.mjs`
(new group `[verify-red]`, TRIAL/WARN-first via `v3check()`).
**Now:** the Phase 0–1 "Verification plan" must be *detailed* (already gated), but nothing checks it
names a **failing test first**. Expected-fail-first shipped as prose doctrine in Round 2; it was never
made checkable. `plan-simulator` verifies executor information-completeness, not red-first.
**Rule:** the `phase-00` / `phase-01` spec Verification block must name a concrete **test id or
command** and state its **expected-RED-before-implementation** status. Absent → WARN `[verify-red]`.
**Fixture:** `verify-no-red/` → WARN `[verify-red]`; `good/` still passes clean.
**Honesty:** presence of a red-test line is structural — it proves the author *declared* a failing
test, not that the test is meaningful. Don't oversell it in the message.

---

## Housekeeping (same round)

1. **Wire arc's 4 orphan ADRs** (0001/0002/0003/0008 — v3.5 flagged, still orphan) into a phase spec
   or Non-negotiables, so `[adr-wired]` can clear its own dogfood and become promotable via F1.
   *(Without this, arc's flagship substance gate can never leave TRIAL on its own repo.)*
2. **`docs/build-playbook.md` §9** — add the `trial-ledger` promotion protocol to the documented
   flow (one or two lines). Command files stay one screen.

---

## Implementation order (each step = one commit on `feat/kickoff-v4`)

1. **F1** — `docs/trial-ledger.md` + template row + `[trial-status]` footer in `kickoff-lint.mjs` +
   the promotion criteria wired into `/arc-retro`. *(The mandatory item; do it first.)*
2. **H1** — `[verify-red]` group + phase-spec-template Verification block + `verify-no-red/` fixture.
3. **Housekeeping 1–2.**
4. **Full bats rerun** — all Rounds 1–5 + v3.5 + the new `[verify-red]` fixture green; `good/` still
   zero `[trial]` on its own practices; grandfather (pre-`Tier:` plans) still WARN-never-FAIL.

---

## Verification

- `npx bats@1.11.0 tests/kickoff-lint.bats` — executed for real, not asserted. `[verify-red]` has a
  fixture that WARNs on its own named group; `good/` passes clean.
- `node .claude/scripts/kickoff-lint.mjs .` on the live repo → exit 0, no **new** FAILs; the
  `[trial-status]` footer prints the live-vs-trial count.
- `/arc-retro` dry-run: given a `trial-ledger.md` with a gate at ≥3 clean runs, it promotes exactly
  that gate (one-line diff) and no other. A gate with <3 runs or a logged false-positive stays in TRIAL.
- Zero new agents. One new file (`docs/trial-ledger.md`) + one fixture. Doctrine unchanged.

---

## Explicitly deferred — so nothing is silently dropped

**Cut from this round on review (2026-07-14) — real, but not mandatory:**

- **P1 — Premise verdict gate** (`product-challenger` fresh-context verdict: proceed/reshape/kill,
  `kill` → STOP). The sharpest idea in the whole analysis, but its value is high only when arc is used
  by **other people on new-product bets** — for a solo builder on his own tools, the premise is
  already known and the gate is mostly ceremony (cf. the Step-2-overload finding in FRICTION-REPORT).
  Revisit when arc goes multi-user / product (aligns with Round 7 packaging). It is also the riskiest,
  most LLM-ish item — keeping it out is what lets v4 stay a certain 1-day round.
- **P2 — Prior-art / incumbent verification.** Feeds P1; deferred with it.
- **F2 — Retro-log flywheel ignition** (forward-only sourced rows + `[retro-seed]` WARN). Genuinely
  important long-term — the retro-log is the compounding memory F1's promotion and step-5 pre-mortems
  both consume. But at **n = 0 and a solo cadence** the flywheel spins slowly, so it is low-urgency,
  not mandatory. Do it the moment real builds start closing phases (it must never backfill by invention).

**Already parked (unchanged):**

- **Round 6 — self-tuning + planner benchmark as a gate + agent evals.** *This is the real
  "world's best" lever* — promoting the `PLANOFF` head-to-head (`docs/evidence/planner-bench/`) into
  a repeatable acceptance gate proves arc's plans **win real builds**, which no amount of lint can. v4
  deliberately stays small so this gets the attention next.
- **Round 7 — brain / adapter separation** (tool-neutral core + thin Claude adapter, ADR-0014) +
  SaaS headless + marketplace packaging.
- **Retro-log bulk backfill from history** — stays deferred; forward-only sourced rows only, never invented.

---

*Provenance: F1 + H1 trace to the 2026-07-14 gap analysis (session Table 1) reconciled against the
live code, and the "Explicitly deferred" list of `docs/kickoff-v3.5-plan.md`. Scope trimmed to
mandatory-only on Ashiq's review the same day. Nothing here is new invention.*
