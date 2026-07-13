# Suggestions log

> Append-only. Every suggestion that arrives from an outside session (Windows Claude, Codex,
> a human) gets validated here **before** it becomes a Round in `docs/kickoff-upgrade-plan.md`.
> Verdicts are checked against the actual code — not against the suggestion's own summary.
> Verdict = **Keep** (as proposed) · **Modify** (right problem, wrong fix) · **Drop** · **Needs-info**.

---

## Batch 001 — 2026-07-12 · "Round 5: semantics hardening" (source: Windows Claude session)

**Premise of the batch:** kickoff-lint enforces *shape*, not *substance* — a plan can pass every
check and still be confident fiction. Round 5 should attack content without violating the
anti-slop rule "no LLM self-assessment".

**Premise verdict: VALID.** Confirmed against `.claude/scripts/kickoff-lint.mjs` — the script's
own header already concedes it (`A pass is structural, not a quality guarantee`, lines 5–6). The
batch is attacking a gap the tool documents about itself. Accepted as the Round 5 theme.

### Verdicts

| # | Suggestion | Verdict | Evidence checked | Notes |
|---|---|---|---|---|
| 0 | *(added in review)* Test coverage for `kickoff-lint.mjs` | **Keep — promoted to first** | `tests/` has 18 bats suites (scan, gates, evidence, rls, suppress…); **zero** cover kickoff-lint. `find . -iname "*fixture*"` → nothing. Rounds 1–3 "Verification" sections reference fixtures that do not exist in the repo. | The deterministic gate that guards every plan is the one unverified script in arc. Round 5 adds ~6 checks to it. Ships blind otherwise. Blocks #2, #3, #5, #6. |
| 1 | Plan red-team (fresh-context adversary before STOP) | **Keep** | `arc-second-opinion.md` reviews the **diff** only. `arc-kickoff.md` step 9 = "STOP, show me PLAN.md" — the sole reviewer of the highest-leverage artifact is the human. | Reasoning holds: bad diff = hours, bad plan = weeks. Fresh context ≠ self-assessment — same principle already accepted in `/arc-second-opinion`. **Add:** findings archive to `docs/reviews/<date>-plan-redteam.md` (mirror second-opinion), and each finding must end `fixed` or `accepted:<reason>` — an unresolved finding blocks step 9. |
| 2 | Anti-generic pre-mortem lint (row must cite a plan token) | **Modify** | Confirmed: lint §6 (lines 144–149) checks row-count ≥ 5 and a non-empty mitigation cell. Nothing else. Horoscope rows pass today. | Right target. But **all-rows-must-cite** will false-FAIL legitimate plan-external risks ("key person unavailable", "market moves"). **Modify to: ≥4 of the rows must contain a plan token** (REQ-NN · phase N · a dep name from the deps table · ADR NNNN). Kills horoscope (scores 0) without forcing token-stuffing. Also: this raises the floor, it does not guarantee substance — say so in the script header, next to the existing heuristic disclaimer. |
| 3 | Appetite arithmetic gate | **Keep** | Confirmed: lint §9 (line 176) is `/kill\|50%\|scope-cut/i` against the Appetite section. Pure vibes. `phase-spec-template.md` does carry `**Appetite:**` per phase, so the operands exist. | Parse `**Appetite:** <N> <unit>` from each `phases/phase-NN-spec.md`, normalise (1 week = 5 working days, constant documented in the script), sum, compare to PLAN's appetite. **Unparseable either side → WARN, never FAIL** (as proposed — "3 weeks part-time" must not hard-block). **Add:** `sum > total` → FAIL; `sum > 80% of total` → WARN. Zero slack is its own fiction. |
| 4a | Retro-log backfill from arc's own history | **Modify — highest caution in this batch** | `docs/retro-log.md` confirmed empty (header only, zero pattern rows). | An LLM mining `session-log.md` / `suppressions.md` / git log for "patterns" is *precisely* the invented-content failure Round 5 exists to kill — and a fabricated row is worse than an empty file, because it then poisons every future pre-mortem while wearing the costume of history. **Only accept rows that cite a checkable source** (commit SHA, session-log date, CHANGELOG entry). Cap 10. You approve each row individually. Anything unsourced → don't write it. |
| 4b | Add `tags` column to retro-log now | **Keep** | Format is `YYYY-MM-DD \| project \| pattern \| prevention` in `docs/retro-log.md`, `docs/templates/retro-log.md`, and `arc-retro.md` step 3. | Correct — schema change is free at n=0 and painful later. Touches 4 files (both retro-logs, `arc-retro.md` step 3, `arc-kickoff.md` step 5 "match by tag"). Tag match is a token match, not an LLM judgement call — consistent with the anti-slop rule. |
| 5 | Low-confidence ADR → forced assumptions row | **Keep** | `adr-template.md` emits `**Confidence:** high \| medium \| low`. Nothing in the repo reads it. Confirmed orphan. | Deterministic: lint scans `docs/adr/*.md` for `**Confidence:** low` → PLAN assumptions table must contain a row citing that ADR number, else FAIL. **Note the interaction:** assumptions cap is 7. Enough low-confidence ADRs will blow the cap — that is a *feature* (research it or accept it), but call it out in the template comment so it isn't discovered as a surprise. `medium` stays unconsumed on purpose. |
| 6a | Architecture: mermaid + `flowchart` required, `C4Context` banned | **Keep** | Confirmed: the C4Context ban is prose-only (`arc-kickoff.md` step 4, `PLAN-template.md` comment). Lint never looks at the Architecture body beyond `hasContent()`. | Cheap and deterministic: fence must be ` ```mermaid `, body must contain `flowchart`, `C4Context`/`C4Container` → FAIL. It checks the diagram's *syntax family*, not its correctness — don't oversell it. |
| 6b | REQ phase cell: reject multi-phase | **Keep** | Confirmed bug: line 101 is `phase.match(/\d+/)` — first integer only. `"1, 3"` passes today and silently maps to phase 1. The "exactly one phase" rule (PLAN-template + step 4) breaks **silently**. | Real bug, not a tightening. Fix: `match(/\d+/g)` → none = FAIL "no phase mapping"; `length > 1` = FAIL "REQ maps to N phases — exactly one". |
| 6c | Grow the VAGUE ban-list from retros | **Modify** | Lint line 78 has a fixed VAGUE list. | This is a *process*, not a code change — there's nothing to implement in the script. Land it as one line in `arc-retro.md` step 2: "a vague word that escaped kickoff-lint → add it to `VAGUE` in `kickoff-lint.mjs`". Then it actually compounds instead of being an intention. |
| 7 | Tool-neutral brain / thin adapter split | **Keep — defer execution** | Accurate: `playbook + templates + kickoff-lint.mjs` (zero-dep Node) are already tool-neutral; `arc-kickoff.md` is the only Claude-Code-shaped binding. Aligns with the public/SaaS + multi-AI-tool direction. | The *statement* is cheap and worth making now → **ADR-0014, brain/adapter separation**. The *directory move* is not Round 5 work: it rewrites every path in `CLAUDE.md`, the commands, and the lint's `root` assumptions. Do the move at the packaging phase, with the ADR already written. |

### Flagged during review

- **"Rounds 1–4" — Round 4 does not exist.** `docs/kickoff-upgrade-plan.md` contains Rounds 1, 2, 3
  only. The batch claims to have read four. Either Round 4 lives somewhere else, or it was
  confabulated. **Needs-info before Round 5 is numbered.** Noting it here because it is a live,
  unprompted instance of the exact failure mode this batch is trying to gate — which strengthens
  the batch's premise rather than weakening it.
- **Step 1 (appetite) before step 2a (premise check).** Agreed with the batch's own read: it's the
  Shape Up order, it's defensible, and swapping it is churn. Left alone. Recorded so it isn't
  re-litigated next round.

### Agreed implementation order

1. **#0** — `tests/kickoff-lint.bats` + plan fixtures. No new check ships against an untested gate.
2. **#6b, #6a, #2, #3, #5** — lint edits, each with its fixture from step 1.
3. **#1** — plan red-team (`arc-kickoff.md` step 8.5 + archive).
4. **#4b** — retro-log `tags` column (4 files).
5. **#6c** — one line in `arc-retro.md`.
6. **#4a** — sourced backfill, row-by-row human approval.
7. **#7** — ADR-0014 only. No file moves.

**Status: validated, awaiting Ashiq's go. Nothing implemented.**

---

## Batch 002 — 2026-07-12 · "Competitive borrows, anti-slop-safe" (source: second outside session)

**Premise of the batch:** every item must be a gate, a cap, or a one-line rule — no new planning
universe, no LLM-judged scoring. **Premise verdict: VALID**, and it self-polices: the batch
pre-rejects GSD ambiguity scoring, the edge-probe engine, and gstack question-tuning hooks for
exactly the right reasons. Nothing here violates anti-slop rule #2.

### Verdicts

| # | Suggestion | Verdict | Evidence checked | Notes |
|---|---|---|---|---|
| 1 | Lint fixture tests (`tests/kickoff-lint.bats`, mutation style) | **Keep — duplicate of Batch 001 #0, independently confirmed** | Two unrelated sessions surfaced the same gap from the same evidence. | Merged. Mutation style is the right shape: good fixture passes; each broken fixture FAILs **its named check** (not just "exit 1"). Order stands: this ships first. |
| 2 | `[adr-wired]` — every ADR in the index referenced by ≥1 phase spec | **Keep — modify the satisfaction rule** | **Dogfooded against arc's own repo:** ADRs **0001, 0002, 0003, 0008** are referenced in **zero** phase specs. The check finds real wiring holes on the very first run. | Strongest-evidenced item in either batch. **But** 0008 (block-by-default) and 0001 (SARIF single format) are *global* decisions — they have no single phase to live in, and forcing a citation would be busywork. **Modify: an ADR is satisfied by a reference in ≥1 phase spec OR in PLAN's `## Non-negotiables`.** That gives global decisions a legitimate home instead of a fake one. FAIL (not WARN) — and fix arc's own 4 orphans as part of the work. ~15 lines, confirmed. |
| 3 | Non-negotiables copied **verbatim** into each phase spec | **Keep — but only with a drift check** | Confirmed: `phase-spec-template.md` has no such block; **zero** of arc's 13 phase specs mention non-negotiables. The Superpowers finding (verbatim text reaches a context-isolated implementer, a cross-reference does not) is credible. | Raw verbatim copy is a **rot machine**: PLAN's non-negotiables change, 13 copies silently go stale, and now the plan lies in 13 places instead of 0. **Only accept with the sync gate attached:** lint normalises whitespace and byte-compares each phase spec's block against PLAN's `## Non-negotiables` → mismatch = FAIL `[nonneg-drift]`. The copies are then *generated/synced*, never hand-maintained, and `/arc-change` must re-sync on edit. With the gate: keep. Without it: **drop** — a stale verbatim copy is worse than a reference. |
| 4 | Question-coverage taxonomy behind the max-5 rule | **Keep — relocate the taxonomy** | `arc-kickoff.md` is 64 lines; step 2 is already the densest block in it. | Right idea, and cost really is zero *if placed correctly*. An 11-category table inlined into the command blows the one-screen rule the command is built around. **Land the taxonomy in `docs/build-playbook.md` §9; kickoff step 2 gets one line:** "pick the 5 by checking coverage against the playbook's category list — don't ask 5 questions from one category." Prompt-side, no gate. Agreed. |
| 5 | `## Current state` → 4 mandated sub-headings (Stack · Entry points · Conventions · Danger zones) | **Keep** | Confirmed: lint §10 (lines 180–182) only WARNs that the section isn't a placeholder. No structure enforced. | Deterministic and cheap. **Enforce only when the section exists** — greenfield deletes it per kickoff step 0, so absence must stay legal. Present-but-missing-a-subheading → FAIL. Correctly scoped: structure borrowed, GSD's 4-parallel-agent machinery rejected. |
| 6 | Banned-exits line at STOP (step 9) | **Keep** | Step 9 currently forbids "product code" only — `/arc-change`, `/arc-ship`, and friends are not named, so the gate has a door in it. | Zero cost, closes a real hole. One line. |
| 7 | Package-legitimacy line in the research gate (step 2b) | **Keep** | `adr-template.md` has an `**Evidence:**` line but nothing that requires the package actually *exists*. | Slopsquatting (hallucinated package names that squatters then register) is a live supply-chain vector, and arc is a *security* tool — this is on-brand, not paranoia. One sentence in step 2b + a hint on the ADR Evidence line. |

### Rejections — agreed, no argument

GSD ambiguity scoring (LLM-judged gate → rule #2 violation) · edge-probe engine (maintenance
weight a solo dev won't carry; #4 covers the useful part) · gstack question-tuning hooks (infra
cost vs. kickoff frequency). The batch rejected these itself, on the right grounds.

### Flagged during review

- **Round 5 has no appetite and no phases.** Batches 001 + 002 = ~14 distinct items touching
  `kickoff-lint.mjs`, 3 templates, 3 commands, the playbook, and a new test suite. That is not a
  "round", it's a build — and it is currently being planned in exactly the unbounded style arc's
  own playbook exists to prevent. **Apply arc's rules to arc:** split it, put an appetite on each
  half, and let the kill criteria bite.
  - **Round 5a — gate credibility** (fixtures first, then the checks that make the gate honest):
    B1#0/B2#1 fixtures · B1#6b · B1#6a · B1#2 · B1#3 · B1#5 · B2#2 · B2#5
  - **Round 5b — content + wiring** (prompt-side and cross-artifact): B1#1 plan red-team ·
    B2#3 (with drift gate) · B2#4 · B2#6 · B2#7 · B1#4b · B1#6c
  - **Deferred, not in Round 5:** B1#4a (sourced backfill, row-by-row approval) · B1#7 (ADR-0014 only).

**Status: validated, awaiting Ashiq's go. Nothing implemented.**

---

## Reconciliation — 2026-07-13 · Batches 001+002 vs. `docs/kickoff-v3-plan.md` (implemented)

Round 5 shipped as "the multi-agent planning engine" (4 new agents, 4 new lint groups, a bats
suite). **Verified against the code, not the doc** — `kickoff-lint.mjs` (291 lines),
`tests/kickoff-lint.bats` (10 tests), `arc-kickoff.md` (88 lines), `docs/retro-log.md`, and a live
`node kickoff-lint.mjs .` run.

### Landed

| Item | v3 mechanism | Status |
|---|---|---|
| B1#0 / B2#1 — lint fixture tests | `tests/kickoff-lint.bats` + `tests/fixtures/kickoff-lint/good/` | **Partial — see gap G1** |
| B1#1 — plan red-team | R5-2 `plan-attacker` ×3 (focus A/B/C) + R5-3 `plan-simulator` + R5-6 second opinion (L) | **Landed, superset.** Findings must mutate an existing section — stronger than the archive-file version proposed. Divergence: rejected findings die silently (anti-slop rule 6) instead of `fixed`/`accepted` — deliberate, accepted. |
| B1 pre-mortem seeding | retro-log read moved into attacker focus-C charter | **Landed** (as a charter, not a gate — see G2) |
| B2#4 — question taxonomy | R5-9 `question-planner` agent (fresh context, ≤5 ceiling) | **Superseded.** An agent picking high-information forks beats a category checklist. Close it. |
| B1#7 — brain/adapter split | Parked to Round 7 (SaaS runway), explicitly | **Correctly deferred** |
| B1#4a — retro backfill | Not attempted | **Correctly deferred** |

### Still open — verified absent from the code

| ID | Item | Evidence (2026-07-13) | Cost |
|---|---|---|---|
| **G1** | **Fixture suite covers only v3 checks** | All 10 bats tests target `[tier]` `[adr]` `[phase-deps]` `[spike]` + grandfather. **Zero mutations for Rounds 1–4 checks** — `[vague]`, REQ cap, missing trigger, unmapped REQ, pre-mortem < 5, deps columns, `[kill-criteria]`, `[progress]`. The original gap (Rounds 1–3 promised fixtures, never committed) is ~40% closed. Also: `bats` was not installed in the implementing sandbox — the suite was run *manually*, per the v3 notes. | Low |
| **G2** | B1#2 — anti-generic pre-mortem lint | Lint §6 (lines 208–214) unchanged: row-count ≥ 5 + non-empty mitigation cell. Horoscope rows still pass. v3 hands pre-mortem quality entirely to an LLM charter (attacker focus C) with **no deterministic backstop**. | Low |
| **G3** | B1#3 — appetite arithmetic | `[kill-criteria]` (line 264) is still the `/kill\|50%\|scope-cut/i` regex. Tier now *derives* from appetite, but nothing sums the phase appetites. "1 week, 6 phases" still passes. | Low |
| **G4** | **B1#6b — REQ multi-phase bug** | **Line 118 is still `phase.match(/\d+/)`.** `"1, 3"` passes and silently maps to phase 1 only. This is a shipped bug in a gate, not a missing feature. | 3 lines |
| **G5** | B1#6a — mermaid / `flowchart` / `C4Context` check | `grep -c "C4Context\|flowchart"` in the lint → **0**. Ban is still prose-only. | Low |
| **G6** | **B2#2 — `[adr-wired]`** | v3's `[adr]` group checks Reversibility + Revisit trigger only. Nothing checks that a decision is *consumed*. arc's own ADRs **0001, 0002, 0003, 0008** are still referenced by zero phase specs. | ~15 lines |
| **G7** | B2#3 — non-negotiables verbatim + drift gate | `grep -c "nonneg"` → 0. **v3 made this *more* important, not less:** `plan-simulator`'s charter is to read **only** `PLAN.md` + `phase-00-spec.md` — the context-isolated-executor argument is now baked into the design, and phase specs still carry no constraints. | Low |
| **G8** | B1#5 — low-confidence ADR → assumption | v3's spike (R5-10) covers *high-impact* **and** low-confidence forks. A low-confidence ADR that isn't judged high-impact is still an orphan — no assumption row, no trigger. And "high-impact" is an LLM judgement, not a gate. The deterministic version was dropped. | Low |
| **G9** | B2#5 — `## Current state` sub-headings | `codebase-surveyor` returns ≤30 lines, but lint §10 (line 269) is still WARN-only with no structure check. | Low |
| **G10** | B2#6 — banned exits at STOP | Step 9 still reads "…before any product code". `/arc-change`, `/arc-ship` and friends remain unnamed — the door in the gate is still open. | 1 line |
| **G11** | B2#7 — package legitimacy (slopsquatting) | Step 2c has no registry / official-docs verification requirement. arc is a security tool; this one is on-brand. | 1 sentence |
| **G12** | B1#4b — retro-log `tags` column | R5-7 adds a *metrics* row (different format, different purpose). Tags never added; `docs/retro-log.md` still has **zero** pattern rows. n = 0, so the schema change is still free — and still not taken. | Low |

### The pattern behind the gaps

Round 5's brief was: *shape is enforced, now enforce substance — without LLM self-assessment.*
v3's answer is **four agents**. Its four new lint groups (`[tier]` `[adr]` `[phase-deps]` `[spike]`)
are all **structural again** — enum present, file exists, no cycles. Not one of them looks at
content quality.

So the original failure mode ("structurally perfect, substantively hollow") is now defended by
**LLM charters**, while the doctrine line claims *"Scripts GATE (never LLM self-assessment)."*
The `plan-simulator` blocker **count** is presented as deterministic — but the count is produced
by an LLM. Fresh context ≠ self-assessment (the `/arc-second-opinion` argument, already accepted),
so this is defensible — **but the doctrine as written overclaims, and it should say so.**

G2–G8 are exactly the checks that would make the "scripts gate" claim true. Every one is cheap.
They are the deterministic floor **under** the agents, not a replacement for them.

### Live debt (from the v3 notes, confirmed)

`node .claude/scripts/kickoff-lint.mjs .` on arc's own repo → **17 FAIL** (missing `## Success
requirements`, `## Assumptions`, `## External dependencies`; 12 × phase-serves-no-REQ; no kill
criteria) + 13 `[adr]` WARNs. arc's own plan cannot pass arc's own gate, and the next
`/arc-phase-done` will block on it. G6 would add 4 more. **Fix or archive that PLAN deliberately —
it's the loudest possible dogfood signal.** Also open from the v3 notes: `build-playbook.md` §9
still documents the v2 flow.

### Recommended next round (Round 5.5 — "make the gates real")

Appetite: **1 day.** Kill criterion: if it isn't done in a day, the deterministic floor isn't the
problem — the agents are.

1. **G4** — the multi-phase bug (3 lines, it's live).
2. **G1** — mutation fixtures for the Rounds 1–4 checks; install `bats` and actually run the suite.
3. **G6, G2, G3, G5, G8** — the deterministic-floor checks, each with its fixture.
4. **G10, G11** — two lines of command text.
5. **G7** — verbatim non-negotiables **with** the drift gate (`[nonneg-drift]`), or not at all.
6. **G9, G12** — structure check + retro-log `tags` while n = 0.
7. Fix or archive arc's own PLAN.md; sync `build-playbook.md` §9.

**Status: reconciled. Nothing implemented.**
