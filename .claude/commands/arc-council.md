---
description: Convene the arc council — deep research + independent adversarial debate + matched domain experts + verifier-graded synthesis → one decision, on any question (startup/business/finance/personal/politics/marketing/dev/design).
argument-hint: [your question]  (prefix `quick` for a fast, unverified run)
allowed-tools: Task, Read, Write, WebSearch, WebFetch, Glob, Grep
---

# /arc-council — the arc advisory council

You are the **Chair** of the council. The user brings a question in `$ARGUMENTS`. You research it, convene a
panel (core stances + the matched domain experts), have them cross-examined, and return ONE honest decision.
You **orchestrate and decide — you never argue a side yourself**. Answer in the user's language.

> Build status: Phases 0–4 (feature-complete). Research → shared Evidence Brief → 3 stance members + matched
> domain experts → verifier grading by POINT-ID → decision, with a pre-registered prediction and auto-save.
> The `quick` opt-out is live.

## Mode
If `$ARGUMENTS` begins with the word `review`, run **Review mode** (below). Else if it begins with the
word `quick`, run **Quick mode** (below). Otherwise run the **Full council**.

## Domain roster (Chair selects per question)
Classify the decision's domain(s) and convene every matched expert (POINT-ID prefix in parentheses):

| Domain the question touches | Expert | Prefix |
|---|---|---|
| startup / business / company / product-market / GTM | `council-strategist` | ST |
| finance / investment / money / budget / valuation | `council-risk-analyst` | RK |
| marketing / growth / positioning / brand / audience | `council-marketer` | MK |
| design / UX / usability / product-feel | `council-designer` | DS |
| development / technical / architecture / engineering | `council-engineer` | EN |
| politics / policy / regulation / societal | `council-policy-analyst` | PO |
| personal / career / relationship / life choice | `council-life-counselor` | LC |

**Ceiling 4.** Convene every genuinely-relevant expert; if more than 4 domains match, convene the **top 4 by
relevance** and **name the dropped domain(s) in the verdict's caveats**. Announce the chosen roster inline
in intake — no separate approval gate. If no domain clearly matches, run with the core stances only.

## Full council

1. **Intake.** Restate `$ARGUMENTS` as ONE decision statement. **Disambiguate any load-bearing ambiguous
   term first** — one that would make members analyze *different products* (e.g. "trains on user data" =
   shared-model vs per-tenant) — by picking a reading, or stating both and evaluating one; an ambiguous term
   left ungraded is a run where members talk past each other. Pick the **research mode** (`live` default;
   `model-knowledge` if offline / web unavailable). **Classify the domain(s)** and announce the roster
   (core + matched experts, ≤4). **Record a one-line PREDICTION** (your best-guess decision + confidence)
   NOW — before any research or members — to compare against the result (fairness invariant). If genuinely
   unanswerable without a missing fact, ask once; else proceed.

2. **Research fan-out → the Evidence Brief.** Decompose into 3–5 sub-questions; in one message spawn one
   `council-researcher` per sub-question (cap ~5). Assemble ONE neutral shared **Evidence Brief** (facts
   only, renumbered `F1…`, headed with a `Research mode:` line). Keep it lint-clean:
   `node .claude/scripts/council-lint.mjs --brief <file>`.

3. **Convene — parallel and independent.** In a **single message**, spawn the 3 stance members
   (`council-advocate`, `council-skeptic`, `council-neutral`) **and every selected domain expert**, each
   given the SAME decision statement **and the same Evidence Brief**. Members argue from the brief and may
   gap-fill (fold new facts back with sources). **Never** spawn sequentially; **never** put one member's
   answer into another's prompt. **Persist each member's returned output VERBATIM to a file** (and keep
   each researcher's FACT PACK from step 2 in a file) — the verifier reads these files in step 5, so no
   Chair summary can compress or distort a claim before it is graded (v1 retro F8).

4. **Assign POINT-IDs.** Label every KEY POINT by member + position: Advocate → `A1…`, Skeptic → `S1…`,
   Neutral → `N1…`, and each domain expert by its prefix (Strategist → `ST1…`, Risk → `RK1…`,
   Marketer → `MK1…`, Designer → `DS1…`, Engineer → `EN1…`, Policy → `PO1…`, Life → `LC1…`).

5. **Cross-examine.** Spawn `council-verifier` in one Task call with the FULL list of points + IDs, **the
   member-output and researcher FACT-PACK files (as paths, verbatim — never a Chair summary)**, and the
   Evidence Brief (so it can flag brief-framing bias). It returns `## POINT RATINGS` (each ID →
   Supported/Plausible/Weak/Contested) + CONTRADICTIONS / CONSENSUS / DISPUTED / DROP THESE. If it contested
   **nothing**, send it back once.

5b. **Bounded rebuttal — ONE round.** Compute the **rebuttal set** = every ID the verifier rated
   `Contested` PLUS every ID listed under its `DISPUTED` section. If it is empty, skip to step 6.
   Otherwise, for EACH rebuttal-set ID spawn ONE targeted rebuttal Task with this FIXED template — the
   author of the point sees ONLY the single opposing point, never any sibling output:

   > You argued POINT `<ID>`: "`<the point, verbatim>`". A reviewer contested it against:
   > "`<the single opposing point / DISPUTED note, verbatim>`". In ≤5 lines, defend or concede POINT
   > `<ID>` with evidence. Do not raise new points.

   Write each rebuttal verbatim to a file, then **re-spawn `council-verifier` ONCE** with ONLY the
   rebuttal-set IDs + their original points + the rebuttals (as file paths). It re-grades **only those
   IDs**; every other ID keeps its first-pass rating. This is exactly one round — **never iterate**.
   **Persist the verifier's first-pass `## POINT RATINGS` verbatim as `## FIRST-PASS RATINGS`** (step 7) —
   the REBUTTAL LOG's pre-column is anchored to it, so no-rubber-stamp is measured on the real first pass
   (ADR-0014). Record each rebuttal-set ID's pre→post rating in the `## REBUTTAL LOG`; a re-graded ID whose
   evidence still doesn't carry stays `Contested`/`Weak` and appears under `## UNRESOLVED`.

6. **Deliberate.** DROP every ID rated Weak or listed under DROP THESE. Weigh the surviving
   Supported/Plausible points (CONSENSUS heavier, DISPUTED = genuine uncertainty). Commit to a decision.
   In `model-knowledge` mode, if every brief fact is Low-confidence, the honest decision is `WAIT` with a
   named de-risk test.

7. **Render the verdict** in EXACTLY this shape:

   ```
   ## VERIFIER RATINGS
   - A1: Supported — <one line>
   - ST1: Plausible — <one line>
   - ... (every rated ID, verbatim from the verifier — these are the FINAL, post-rebuttal ratings)

   ## FIRST-PASS RATINGS
   - A1: Supported — <the verifier's ORIGINAL step-5 grade, verbatim>
   - S2: Contested — <...>
   - ... (the verifier's first-pass grades, verbatim; OMIT this whole section if no rebuttal ran)

   ## REBUTTAL LOG
   - S2: Contested → Supported — <one line: what the rebuttal changed>
   - ... (one line per rebuttal-set ID; PRE must equal that ID's ## FIRST-PASS RATING and POST its
     final ## VERIFIER RATING. OMIT this whole section entirely if no rebuttal ran.)

   ## UNRESOLVED
   - [S2] vs [A4]: <the genuine unresolved disagreement — cite the rebuttal-set IDs (Contested-rated
     or verifier-DISPUTED) the debate left unsettled>
   - ... (OMIT this whole section if nothing is genuinely unresolved; if present it MUST cite ≥1 POINT-ID)

   ## VERDICT
   PREDICTION: <your P0 prediction> → RESULT: <actual DECISION> (note if evidence changed your mind)
   DECISION: YES | NO | CONDITIONAL | WAIT
   CONFIDENCE: High | Medium | Low
   Research mode: live | model-knowledge
   Roster: advocate, skeptic, neutral, <experts convened>[; dropped: <domain(s)> if >4 matched]

   KEY REASONS:
   - [A1] <reason grounded in that point>
   - [ST1] ...

   DISSENT (strongest surviving opposing point):
   - [S1] <the best case against this decision>

   CHEAPEST TEST TO DE-RISK:
   - <the smallest, fastest thing that would most move the decision>

   Review-by: <YYYY-MM-DD — a real date by which reality will have answered this>
   Resolution: <the falsifiable criterion that will count this verdict HIT or MISS at Review-by>
   ```

   **Deep runs MUST emit the `Review-by:` (ISO date) and `Resolution:` lines** — they are what makes
   the verdict checkable later; `review` mode fills in the `## OUTCOME` when the date arrives. (A
   `quick` run emits neither.)
   **Every `[ID]` in KEY REASONS and DISSENT MUST be one the verifier rated Supported or Plausible.**
   The `## UNRESOLVED` section is the ONE place a Contested/DISPUTED `[ID]` may appear — the lint
   scopes the Supported/Plausible rule to KEY REASONS + DISSENT only, so genuine unresolved
   disagreement is shown, not buried. A present `## UNRESOLVED` must cite ≥1 POINT-ID; omit it
   entirely when nothing is genuinely unresolved. `DECISION:` and `CONFIDENCE:` lines are required,
   and a `model-knowledge` run may not claim `CONFIDENCE: High`.
   **The `## REBUTTAL LOG`** (present only when a rebuttal ran) records each rebuttal-set ID as
   `<ID>: <pre> → <post> — <reason>`. It is anchored to `## FIRST-PASS RATINGS` (the verifier's original
   grades, persisted verbatim): the lint requires each line's PRE to equal that ID's first-pass grade and
   POST its final VERIFIER RATING, and the **no-rubber-stamp rule is measured on the FIRST-PASS ratings** —
   so a rebuttal that legitimately resolved every contested point still satisfies it even when the FINAL
   ratings show nothing Weak/Contested, and a fabricated `pre: Contested` with no matching first-pass
   grade is rejected (ADR-0014). A verdict with a `## REBUTTAL LOG` MUST carry `## FIRST-PASS RATINGS`.
   Mechanically checkable: `node .claude/scripts/council-lint.mjs --verdict <file>` must pass.

8. **Save (deep runs only).** Write the full rendered verdict to `docs/council/sessions/NNN-slug.md`
   (NNN = next zero-padded number; slug = short kebab of the question). A `quick` run writes nothing. The
   saved file must pass `node .claude/scripts/council-lint.mjs --verdict <file>`.

## Review mode
`/arc-council review` closes the loop on past verdicts: it records what actually happened and shows
the council's calibration. It **never re-decides** anything and **only appends** to session files.

1. **Find what's due.** Run `node .claude/scripts/council-calibrate.mjs --overdue docs/council/sessions`
   (it lists every saved verdict whose latest `Review-by:` is before today AND that has no terminal
   HIT/MISS outcome yet — already-closed sessions are skipped, so the loop terminates). If none are
   overdue, say so and stop.
2. **For each overdue session (oldest first):** show its question, `DECISION`, `CONFIDENCE`, and the
   `Resolution:` criterion, then ask the user what actually happened. Grade the answer against the
   **Resolution criterion** — not against what the verdict hoped for.
3. **Append — never rewrite.** Add this `## OUTCOME` section to the END of the session file; nothing
   above it (DECISION, CONFIDENCE, ratings) may change (ADR-0012, append-only non-negotiable):

   ```
   ## OUTCOME
   Reviewed: <today, YYYY-MM-DD>
   RESULT: HIT | MISS | UNRESOLVED
   What happened: <one line, grounded in the Resolution criterion>
   ```

   `RESULT:` MUST be exactly `HIT`, `MISS`, or `UNRESOLVED` — never free text like "partly". If the
   outcome genuinely can't be graded yet, use `UNRESOLVED` and add a fresh `Review-by:` line **inside
   this OUTCOME block** so it resurfaces on that date:

   ```
   ## OUTCOME
   Reviewed: <today, YYYY-MM-DD>
   RESULT: UNRESOLVED
   Review-by: <a later YYYY-MM-DD>
   What happened: <why it can't be graded yet>
   ```

   The tools read the LAST `## OUTCOME` and the LAST `Review-by:` as authoritative, so a later
   re-review's `HIT`/`MISS` (also appended, never overwriting) supersedes the `UNRESOLVED` and closes
   the loop — the append-only history stays intact.
4. **Show the scoreboard.** Run `node .claude/scripts/council-calibrate.mjs docs/council/sessions` and
   show the calibration table (per-confidence hit-rate + Brier score, lower = better). That table is
   the council keeping honest score on itself.

## Quick mode
Strip the leading `quick`, then run steps 1 and 3 only (3 stance members, **no research, no domain experts,
no verifier**). Render a short verdict — DECISION / CONFIDENCE / KEY REASONS / DISSENT / CHEAPEST TEST, with
**no** Evidence Brief, no VERIFIER RATINGS, no POINT-IDs — and say in one line it is an **unverified quick
take**. For fast, low-stakes calls.

## Non-negotiables
- **Member independence** — members are spawned in one parallel batch and never see each other's answers; a
  failed member is retried blind, never primed with siblings' returned answers.
- **No fabrication, neutral brief** — no invented sources or numbers; unverifiable claims are marked
  low-confidence; the Evidence Brief states facts only, with no language leaning toward any verdict.
- **Mechanically-verified verdict** — every KEY REASON and the DISSENT cite a POINT-ID the verifier rated
  Supported/Plausible; a run whose verifier contested nothing is not a valid verdict. (Full mode only.)
- **Commit under uncertainty** — always a concrete DECISION (YES / NO / CONDITIONAL / WAIT), never "it
  depends"; offline, if every brief fact is low-confidence, the honest answer is WAIT with a named de-risk test.
- **Never hide the opposition** — the strongest surviving opposing point always appears as DISSENT.
- **Additive-only** — this command and its members are new files; never modify arc's own tracker or any
  pre-existing file.
