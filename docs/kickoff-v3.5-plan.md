# Kickoff v3.5 Plan — "Make the gates real"

> **Status: implemented & verified (2026-07-13) — WARN-first trial mode.** All 13 items +
> housekeeping 1–3 landed; the substance gates (G2/G3/G5/G6/G7/G8/G9) run as `[trial]`
> WARNs until a build's retro promotes them (one-line change: remove the group from the
> `TRIAL` set in `kickoff-lint.mjs`). Suite: **35/35 bats tests green** (executed for real
> via `npx bats@1.11.0`); live repo lint: **exit 0, zero FAILs**. Changes uncommitted in
> the working tree — branch before committing. See Implementation notes at the end.
> Continues `docs/kickoff-v3-plan.md` (Round 5 — multi-agent planning engine, implemented
> 2026-07-13). This round closes the **13 items that Round 5 did not touch**, all of them
> validated in `docs/suggestions-log.md` (Batches 001 + 002) and re-verified against the code
> on 2026-07-13.
>
> **Appetite: 1 day.** Kill criterion: not done in a day → the deterministic floor isn't the
> problem, stop and re-scope.
>
> Everything here is a **script check, a template field, or one line of command text.**
> No new agents. No new files beyond fixtures. Nothing in this round needs an LLM to run.

---

## Why this round exists

Round 5's brief was: *shape is already enforced — now enforce **substance**, without LLM
self-assessment.*

Round 5's answer was **four agents** (`codebase-surveyor`, `question-planner`, `plan-attacker`,
`plan-simulator`) — a genuine and correct addition. But its four new lint groups
(`[tier]` `[adr]` `[phase-deps]` `[spike]`) are **structural again**: enum present, file exists,
no cycles. **Not one of them looks at content.**

So the original failure mode — *structurally perfect, substantively hollow* — is now defended by
**LLM charters**, while the v3 doctrine states: *"Scripts GATE (never LLM self-assessment)."*
The `plan-simulator`'s blocker **count** is presented as deterministic, but the count is produced
by an LLM. Fresh context ≠ self-assessment (the `/arc-second-opinion` argument, already accepted)
— so this is **defensible, but the doctrine as written overclaims**.

v3.5 is the deterministic floor **underneath** the agents. It does not replace them. It is what
makes the "scripts gate" claim true.

---

## Verified state as of 2026-07-13 (do not re-derive — this was checked against the code)

- `.claude/scripts/kickoff-lint.mjs` — 291 lines. Check groups: `[plan-exists] [sections] [tier]
  [reqs] [vague] [phases] [phase0] [phase-deps] [assumptions] [pre-mortem] [deps] [adr] [spike]
  [kill-criteria] [current-state] [retro-log] [progress]`.
- The script already has an `isV3` flag (true when `PLAN.md` carries a `**Tier:**` line) and a
  `v3check()` helper that downgrades FAIL → WARN for pre-v3 plans. **Every new check in this
  round must route through `v3check()`**, or the repo's own in-flight plan hard-fails.
- `tests/kickoff-lint.bats` — 10 tests. All target v3 groups only.
  `tests/fixtures/kickoff-lint/good/` — the single good fixture.
- `bats` is **not installed** in the sandbox that implemented Round 5; that suite was run manually.
- `node .claude/scripts/kickoff-lint.mjs .` on arc's own repo → **17 FAIL** + 13 `[adr]` WARN.
- `docs/retro-log.md` — header only, **zero pattern rows** (n = 0).

---

## Items

### G4 — REQ multi-phase bug *(live bug — do this first)*
**File:** `.claude/scripts/kickoff-lint.mjs`, line ~118.
**Now:**
```js
const phase = r[3] || "";
const m = phase.match(/\d+/);
if (!m) fail("reqs", `${id} has no phase mapping`);
else reqPhases.add(Number(m[0]));
```
`match(/\d+/)` takes the **first** integer only — a REQ mapped to `"1, 3"` passes and silently
binds to phase 1. The "every REQ maps to exactly ONE phase" rule (PLAN-template + kickoff step 4)
breaks **without a single warning**.
**Fix:** `match(/\d+/g)` → no match = FAIL `no phase mapping`; `length > 1` = FAIL
`${id} maps to ${n} phases — exactly one`. Plain `fail()`, not `v3check()` — this rule predates v3.
**Fixture:** `req-multi-phase/` → FAIL `[reqs]`.

### G1 — mutation fixtures for the Rounds 1–4 checks
**Files:** `tests/kickoff-lint.bats`, `tests/fixtures/kickoff-lint/*/`.
Round 5 shipped fixtures for its own checks only. The checks that guard **every plan since
Round 1 are still untested** — and the suite has never actually been executed by `bats`.
**Do:** `npm i -g bats` (or the repo's existing bats setup) and **run the suite for real**. Then add
one mutation fixture per pre-v3 check, each asserting its **named** group (not just exit 1):

| Fixture | Must FAIL |
|---|---|
| `vague-acceptance/` | `[vague]` |
| `req-cap-exceeded/` (11 active) | `[reqs]` or `[tier]` |
| `req-unmapped/` (phase 9, no such phase) | `[reqs]` |
| `req-bad-status/` | `[reqs]` |
| `req-multi-phase/` (G4) | `[reqs]` |
| `assumption-no-trigger/` | `[assumptions]` |
| `assumptions-cap-8/` | `[assumptions]` |
| `premortem-4-rows/` | `[pre-mortem]` |
| `premortem-no-mitigation/` | `[pre-mortem]` |
| `dep-missing-column/` | `[deps]` |
| `no-kill-criteria/` | `[kill-criteria]` |
| `progress-no-now/` | `[progress]` |
| `adr-file-missing/` | `[adr]` |
| `phase-spec-missing/` | `[phases]` |
| `no-phase-zero/` | `[phase0]` |

Keep fixtures minimal — copy `good/` and mutate one thing. **A gate with no tests is a gate on
trust.** Every item below ships with its fixture in the same commit.

### G6 — `[adr-wired]`: decisions must be consumed
**File:** `kickoff-lint.mjs` (~15 lines), via `v3check()`.
Nothing today checks that an ADR is ever *used*. **Dogfood proof:** arc's own ADRs **0001, 0002,
0003, 0008** are referenced by **zero** phase specs.
**Rule:** every ADR number in PLAN's `## Key decisions` index must appear in **≥1
`phases/phase-NN-spec.md`** *or* in PLAN's **`## Non-negotiables`** section. The Non-negotiables
escape hatch is deliberate: global decisions (e.g. "gates block by default") have no single phase
to live in, and forcing a fake citation is busywork.
**Fixture:** `adr-orphan/` → FAIL `[adr-wired]`.
**Follow-up:** wire arc's own 4 orphan ADRs (or move them to Non-negotiables).

### G2 — pre-mortem must be about *this* plan
**File:** `kickoff-lint.mjs` §6 (lines ~208–214), via `v3check()`.
Today the check is: ≥ 5 rows + a non-empty mitigation cell. An LLM satisfies it with the same five
generic rows on every project ("scope creep", "integration breaks"). Round 5 moved pre-mortem
authorship into `plan-attacker` focus C — **an LLM — with no deterministic backstop.**
**Rule:** a row **cites the plan** if it contains any of: `REQ-\d+` · `phase \d+` · an ADR number
(`\d{4}`) · a dep name from column 0 of the External-dependencies table.
**≥ 4 rows must cite the plan** → else FAIL `[pre-mortem] generic — N of M rows reference nothing
in this plan`.
**Why 4, not all 5:** a genuine plan-external risk ("key person unavailable") must stay legal
without token-stuffing. Horoscope pre-mortems score **0** and die; one free row survives.
**Honesty note — add to the script header, next to the existing heuristic disclaimer:** this raises
the floor, it does not guarantee substance. A determined LLM can still write "scope creep on REQ-03".
**Fixture:** `premortem-generic/` (5 rows, 0 citations) → FAIL.

### G3 — appetite arithmetic
**File:** `kickoff-lint.mjs`, new group `[appetite-sum]`, via `v3check()`.
`[kill-criteria]` is still `/kill|50%|scope-cut/i` — a regex against prose. **"1 week appetite,
6 phases" passes today.** Round 5 derives the *tier* from appetite but never does the *arithmetic*.
**Rule:** parse `**Appetite:** <N> <unit>` from each `phases/phase-NN-spec.md`; parse PLAN's
`## Appetite` for the same shape. Normalise with a documented constant: **1 week = 5 working days**.
- `sum(phase appetites) > total` → **FAIL**
- `sum > 80% of total` → **WARN** (zero slack is its own fiction)
- either side unparseable (e.g. "3 weeks part-time") → **WARN, never FAIL**
**Fixtures:** `appetite-overflow/` → FAIL · `appetite-unparseable/` → WARN + pass.

### G5 — architecture diagram syntax
**File:** `kickoff-lint.mjs`, new group `[architecture]`, via `v3check()`.
The C4Context ban lives only in prose (`arc-kickoff.md` step 4 + the PLAN-template comment). Lint
never reads the Architecture body beyond `hasContent()`. `grep -c "C4Context\|flowchart"` → **0**.
**Rule:** the `## Architecture` section must contain a ` ```mermaid ` fence whose body contains
`flowchart`; presence of `C4Context` or `C4Container` → FAIL.
This checks the diagram's **syntax family, not its correctness** — don't oversell it in the message.
**Fixtures:** `arch-c4context/` → FAIL · `arch-no-mermaid/` → FAIL.

### G8 — low-confidence ADR → forced assumption
**File:** `kickoff-lint.mjs`, new group `[adr-confidence]`, via `v3check()`.
`adr-template.md` emits `**Confidence:** high | medium | low`. **Nothing in the repo reads it.**
Round 5's spike (R5-10) only catches forks that are *high-impact* **and** low-confidence — and
"high-impact" is an LLM judgement, not a gate. A low-confidence decision that nobody labelled
high-impact is still a silent orphan.
**Rule:** scan `docs/adr/*.md` for `**Confidence:** low` → PLAN's `## Assumptions` table must
contain a row citing that ADR number → else FAIL.
**Interaction to document in the PLAN-template comment:** the assumptions cap is **7**. Enough
low-confidence ADRs will blow the cap — that is a **feature** (research it, spike it, or accept it),
not a bug. `medium` stays unconsumed on purpose.
**Fixture:** `adr-low-conf-orphan/` → FAIL.

### G7 — non-negotiables verbatim in phase specs **+ drift gate**
**Files:** `docs/templates/phase-spec-template.md`, `kickoff-lint.mjs` (`[nonneg-drift]`),
`.claude/commands/arc-change.md`.
Superpowers' measured finding: **verbatim constraint text reaches a context-isolated implementer;
a cross-reference does not.** Round 5 made this *more* important, not less — `plan-simulator`'s
charter is to read **ONLY** `PLAN.md` + `phase-00-spec.md`, so context-isolated execution is now
baked into the design. Yet **zero** of arc's 13 phase specs carry any constraints.
**The danger:** a raw verbatim copy is a rot machine. PLAN changes, 13 copies go stale, and the
plan now lies in 13 places instead of 0.
**Therefore — ship both halves or neither:**
1. `phase-spec-template.md` gains a `## Non-negotiables (verbatim from PLAN)` block.
2. Lint normalises whitespace and compares each phase spec's block against PLAN's
   `## Non-negotiables` bullets → mismatch = **FAIL `[nonneg-drift]`**.
3. `/arc-change` re-syncs all phase specs whenever PLAN's Non-negotiables change.
Consider a tiny sync helper so the 13 copies are **generated, never hand-maintained**.
**Without the drift gate this item is a DROP** — a stale verbatim copy is worse than a reference.
**Fixtures:** `nonneg-drift/` → FAIL · `nonneg-synced/` → pass.

### G9 — `## Current state` structure
**File:** `kickoff-lint.mjs` §10 (line ~269) — currently WARN-only, no structure check. Also
`.claude/agents/codebase-surveyor.md` (emit these four).
**Rule:** *only when the section exists* (greenfield deletes it per kickoff step 0), it must carry
four non-empty sub-headings: **Stack · Entry points · Conventions · Danger zones**.
Present-but-incomplete → FAIL. Absent → legal, no check.
**Fixture:** `current-state-unstructured/` → FAIL.

### G10 — banned exits at STOP
**File:** `.claude/commands/arc-kickoff.md`, step 9. One line.
Step 9 currently forbids "any product code" — `/arc-change`, `/arc-ship` and every other command
are **unnamed**, so the gate has a door in it.
**Add:** *"Until approval: no product code, no `/arc-change`, no other command. STOP means stop."*

### G11 — package legitimacy (anti-slopsquatting)
**Files:** `.claude/commands/arc-kickoff.md` step 2c · `docs/templates/adr-template.md`.
Hallucinated package names are a live supply-chain vector (squatters register them). arc is a
**security** tool — this is on-brand, not paranoia. The ADR `**Evidence:**` line requires sources
but never that the package **exists**.
**Add (one sentence):** any package or library a researcher cites must be verified against its
**registry entry + official docs**, and that verification recorded on the ADR's Evidence line.

### G12 — retro-log `tags` column *(free while n = 0)*
**Files:** `docs/retro-log.md` · `docs/templates/retro-log.md` · `.claude/commands/arc-retro.md`
step 3 · `.claude/agents/plan-attacker.md` (focus C charter).
The retro-log is the compounding flywheel — and it has **zero rows**. Round 5's R5-7 added a
*metrics* row (different format, different purpose); **tags were never added**.
**Format:** `YYYY-MM-DD | project | pattern | prevention | tags`
Tag matching is a **token match**, not an LLM "does this pattern feel relevant" call — which is
exactly why it belongs here. Schema change costs nothing at n = 0 and hurts later.

### G13 — grow the VAGUE ban-list from retros
**File:** `.claude/commands/arc-retro.md`, step 2. One line.
`kickoff-lint.mjs` line ~94 has a fixed `VAGUE` regex. Words will escape it. There is no route from
"we noticed a weasel word slipped through" to "the gate now catches it".
**Add:** *"a vague word that escaped kickoff-lint → add it to `VAGUE` in `kickoff-lint.mjs`."*
Nothing to build. This is what makes the list compound instead of ossify.

---

## Housekeeping (same round, not optional)

1. **arc's own `PLAN.md` fails its own gate — 17 FAILs.** Missing `## Success requirements`,
   `## Assumptions`, `## External dependencies`; 12 × "phase serves no active REQ"; no kill
   criteria. G6 will add 4 more. The next `/arc-phase-done` blocks on it.
   **Fix it or archive it deliberately** — a security tool that can't pass its own gate is the
   loudest dogfood signal there is.
2. **`docs/build-playbook.md` §9 still documents the v2 kickoff flow.** Sync it to the v3 flow
   (already listed as a known follow-up in `kickoff-v3-plan.md`).
3. **`kickoff-v3-plan.md` doctrine line** — *"Scripts GATE (never LLM self-assessment)"* — add one
   honest sentence: the `plan-simulator` blocker **count** is LLM-produced; it is legitimate
   because the context is **fresh**, not because it is deterministic. Same principle as
   `/arc-second-opinion`. Say it plainly rather than letting the doctrine overclaim.

---

## Implementation order (each step = one commit on `feat/kickoff-v3.5`)

1. **G4** — the live bug (3 lines) + its fixture.
2. **G1** — install `bats`, run the existing suite for real, add the 15 pre-v3 mutation fixtures.
   *No new check ships until the old ones are actually tested.*
3. **Lint checks, each with its fixture:** G6 → G2 → G3 → G5 → G8.
4. **Command text (three lines total):** G10 · G11 · G13.
5. **G7** — non-negotiables **with** `[nonneg-drift]`, or not at all.
6. **G9** + **G12**.
7. **Housekeeping** 1–3.
8. Full suite rerun: **all Rounds 1–5 fixtures still pass.**

## Verification

- `bats tests/kickoff-lint.bats` — actually executed, not asserted. Every new check has a fixture
  that FAILs on **its own named group**, and the `good/` fixture still passes clean.
- `node .claude/scripts/kickoff-lint.mjs .` on the repo → the 17 pre-existing FAILs are resolved or
  the plan is archived; no new FAILs introduced by this round.
- Pre-v3 plans (no `**Tier:**` line) still **WARN, never FAIL** — the grandfather rule holds for
  every check added here.
- Command files stay one screen. Zero new agents. Zero new top-level files beyond fixtures.

## Explicitly deferred — so nothing is silently dropped

- **Retro-log backfill** from arc's own history: only with **sourced rows** (commit SHA /
  session-log date / CHANGELOG entry), cap 10, human-approved row by row. An LLM inventing
  "patterns" is precisely the failure this whole round exists to kill — and a fabricated row is
  worse than an empty file, because it then poisons every future pre-mortem while wearing the
  costume of history.
- **Brain / adapter separation** (tool-neutral core + thin Claude adapter): ADR-0014 records the
  intent; the physical file move belongs to the packaging round (v3-plan Round 7).
- Question-coverage taxonomy — **superseded** by Round 5's `question-planner` agent. Closed.

---

*Provenance: every item traces to `docs/suggestions-log.md` — Batch 001 (#2, #3, #4b, #5, #6a, #6b,
#6c, #0) and Batch 002 (#1, #2, #3, #5, #6, #7), validated against the code and re-verified after
Round 5 landed. Nothing here is new invention.*

---

## Implementation notes (2026-07-13 — what actually shipped)

**Mode:** WARN-first trial (Ashiq's call — answers the over-restriction concern). All
substance groups sit in a `TRIAL` set in `kickoff-lint.mjs`: they WARN with a `[trial]`
suffix even on v3 plans. Promotion to FAIL = remove the group from the set after
`/arc-retro` judges it useful — one line, auditable in git. Deterministic groups shipped
strict as spec'd: G4 (plain `fail`, the rule predates v3), G10/G11/G13 (command text).

**Deviations (all deliberate):**
- Check-group names: `[pre-mortem-cite]` (not an extra rule inside `[pre-mortem]`),
  `[current-state-structure]`, and Round 5's `[phase-deps]` — distinct names keep failures
  unambiguous next to the pre-existing `[pre-mortem]` / `[current-state]` / `[deps]` groups.
- **G9 labels follow the codebase-surveyor charter**: `Stack · Entry points · Conventions ·
  Do-not-touch` (the doc said "Danger zones"; the charter's label won — one contract, no rename).
- **G2 × retro-seed conflict closed**: plan-attacker focus C charter now requires seeded
  rows to cite a REQ/phase/ADR/dep of THIS plan and to match retro rows by tag overlap.
- G1 fixtures = **bats runtime mutations** on the single `good/` fixture (copy + sed per
  test), not 15 physical fixture dirs — same named-group assertions, leaner repo.
- G3 skips phases whose PLAN row says `next cycle`/`parked` — they don't count against
  this cycle's appetite.
- G7 shipped **both halves** (template block + `[nonneg-drift]`); no separate sync helper —
  `/arc-change` carries the resync duty, the gate catches misses. Trial-WARN like the rest.
- `bats` installed via `npx bats@1.11.0` (global `npm i -g` hits EACCES in the sandbox).

**Found & fixed while testing (G1 doing its job):**
- The Rounds-1 pre-mortem mitigation check had a latent hole: `(r[2] || r[1])` fallback
  meant a blanked mitigation cell passed because the CAUSE cell was non-empty. Fixed to
  column-count-aware; fixture test 20 now guards it.
- The good fixture's Appetite prose contained "kill", masking the `[kill-criteria]`
  deletion test — test neutralizes the prose first. (The regex-on-prose weakness G3
  describes, demonstrated live.)

**Housekeeping done:** ① live `PLAN.md` backfilled (not archived): REQ table derived 1:1
from the Phases table + done-log evidence (00–03 → `validated`), assumptions from recorded
carry-forwards, external-deps table = the scanner adapters (real bats files), kill-criteria
line added. **No `Tier:` line on purpose** — the in-flight plan stays grandfathered; only
new kickoffs opt into strict v3. Lint on the live repo: exit 0, 0 FAILs (45 WARNs, 18 of
them `[trial]`). ② playbook §9 synced to the v3/v3.5 flow. ③ doctrine honesty line added
to `kickoff-v3-plan.md` (simulator count is LLM-produced; fresh context is the legitimacy).

**Verification:** 35/35 bats (10 Round-5 + 16 pre-v3 backfill + 9 v3.5) · good fixture
passes with **zero** `[trial]` warnings (it models the practices) · grandfather holds for
every new check · live repo exit 0.
