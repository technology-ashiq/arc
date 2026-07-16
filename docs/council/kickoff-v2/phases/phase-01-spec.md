# Phase 01 — Calibration loop

**Goal (one line):** Every deep verdict names when and how it will be judged, `review` records what actually happened, and the council's track record renders as a computed number.
**Appetite:** 3 days
**Depends on:** phase-00

## Exit criteria (Definition of Done)
- [ ] `arc-council.md` `## Mode` dispatcher gains the `review` branch (ADR-0013) — zero-arg `review` lists sessions whose `Review-by` is strictly past today, excludes future-dated ones, and prints a named no-sessions-overdue message on an empty list
- [ ] Deep-run template emits `Review-by:` (ISO `YYYY-MM-DD`) + `Resolution:` lines; `--verdict` accepts both
- [ ] `review` appends a `## OUTCOME` section whose `RESULT:` line is exactly HIT, MISS, or UNRESOLVED — append-only per ADR-0012, nothing above it rewritten
- [ ] `council-calibrate.mjs` (new, zero-dep) renders per-bucket hit-rate + Brier using ADR-0009 buckets (High=0.85 / Med=0.65 / Low=0.5); malformed sessions (no `CONFIDENCE:`, no `RESULT:`) skip with a named WARN; `DECISION: WAIT` + `RESULT: UNRESOLVED` counted separately, excluded from scoring; absent/empty sessions dir → named message, exit 0 (synced-consumer contract)
- [ ] Fixtures under `docs/council/kickoff-v2/fixtures/phase-01/`: 3-session set with precomputed expected table values + an ambiguous free-text-OUTCOME red fixture the script must reject
- [ ] tracker updated (PROGRESS.md row ✅ + done-log)

## Verification plan

- **Test command:** `node .claude/scripts/council-calibrate.mjs docs/council/kickoff-v2/fixtures/phase-01/sessions`
- **Expected failure first:** the script does not exist yet — node exits 1 with a module-not-found error (RED). After the phase, the command prints the fixture set's precomputed expected table exactly (expected values authored into the fixture README alongside the fixtures) and exits 0.
- **Live demo scenario:** `/arc-council review` with one overdue fixture session → lists exactly it, records `RESULT: HIT`, and the calibrate table reflects the new outcome; run again with nothing overdue → named message, exit 0.
- **Real-system check:** `node .claude/scripts/council-calibrate.mjs docs/council/sessions` on this repo — session 001 (no `Review-by:`) skips with a named WARN, exit 0; the same command against a non-existent directory exits 0 with the named no-sessions message.
- **Expected evidence:** calibrate output for the fixture run + the real-repo run, the ambiguous-OUTCOME rejection line, and the appended `## OUTCOME` diff — pasted into the PROGRESS done-log.

## Rabbit holes in this phase
- No statistics beyond counts, per-bucket hit-rate, and Brier (PLAN rabbit hole).
- `OUTCOME` grammar never loosens to free text — reject, don't guess.

## Out of scope for this phase
- Rebuttal + REBUTTAL LOG → phase-2. Probes → phase-3.

## Your-setup / pending
None.

## Non-negotiables (verbatim from PLAN)

- Member independence holds through rebuttal — a rebutting member sees ONLY the single opposing point it answers, never sibling outputs; failed members retried blind (fairness.md invariant 1).
- Rebuttal is bounded: ONE round, rebuttal-set IDs only — the rebuttal set = IDs rated Contested plus IDs listed under the verifier's DISPUTED section — and the verifier re-grades only those IDs (ADR-0008).
- First-pass contest evidence is never erased — when a rebuttal ran, `## REBUTTAL LOG` records every pre→post rating with a one-line reason; no rebuttal ran → no REBUTTAL LOG section (ADR-0008).
- Past verdicts are append-only — review appends `## OUTCOME`; nothing rewrites DECISION, CONFIDENCE, or ratings. Sole sanctioned exception: the one dated ADR-0010 correction to session 001.
- No fabrication extends to eval assets — seeded errors are labeled as seeded inside eval files, probes run only in non-saving modes (quick + verifier-only, never a deep run), and OUTCOME entries record what actually happened (ADR-0011).
- Quick-mode output stays exempt from every `--verdict`/`--brief` check — quick writes no file and carries no POINT-IDs, VERIFIER RATINGS, or Research-mode line; no council-lint invocation targets a quick transcript.
- Council-files-only — changes touch `.claude/commands/arc-council.md`, `.claude/agents/council-*.md`, `.claude/scripts/council-*.mjs`, `docs/council/**`, and new council-scoped files; arc's root tracker and every non-council file stay untouched.
