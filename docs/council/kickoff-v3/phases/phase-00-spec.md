# Phase 00 — Steel thread: juror script (fake impl) + lint contract

**Goal (one line):** `council-juror.mjs` runs end-to-end against the fake with a parseable artifact + run-record, and the three Juror lint checks ship red-fixture-first.
**Appetite:** 1 day
**Depends on:** none

## Exit criteria (Definition of Done)
- [ ] `.claude/scripts/council-juror.mjs` (zero-dep): `--points <file> --out <artifact>`; with `JUROR_FAKE=<fixture>` it reads the canned provider response (no network) and writes the artifact: a `## JUROR RATINGS` section (`<ID>: <Supported|Plausible|Weak|Contested> — <reason>` per rebuttal-set id; empty points file → body exactly `(no rebuttal ran — nothing to grade)`) + a `## JUROR RUN-RECORD` block (UTC time, base-url host or `fake`, model, latency, sizes — NEVER the key); malformed fixture/response → exit 1 naming the defect (parse taxonomy); `JUROR_FAKE` set together with `JUROR_BASE_URL`/`JUROR_API_KEY` is a named misconfiguration — exit 1 naming the conflict, never a silent fake-wins-over-real choice
- [ ] Four lint checks in `council-lint.mjs --verdict`, red-fixture-first under `docs/council/kickoff-v3/fixtures/phase-00/`: (a) `Juror:` line naming a model ⇔ `## JUROR RATINGS` present+parseable, both directions — with TOLERANT detection (bulleted/bolded/odd-spacing variants a human reads as an attribution are enforced as one) and a STRICT value grammar (`MODEL @ HOST` or `unavailable (REASON)`, near-misses fail closed); (b) when configured, every id in the **anchor set** — ids rated Weak/Contested in FIRST-PASS RATINGS plus every REBUTTAL LOG id, i.e. the no-rubber-stamp fabrication surface (ADR-0017) — must appear in JUROR RATINGS, and the empty-set marker cannot stand in when anchors exist; (c) >1 `Juror:` line or >1 JUROR-RATINGS-heading (any cosmetic variant) → fail (multiplicity guard, v2 idiom); (d) `Juror: unavailable (REASON)` with no artifact passes — every `bad-*` (incl. `bad-two-juror-lines.md`, `bad-two-juror-ratings-sections.md`, and the adversarial pins `bad-juror-line-bold.md` / `bad-juror-unavailable-fake-section.md` / `bad-juror-unavailable-noreason.md` / `bad-juror-empty-marker-with-anchors.md`) exits 1 naming its check, every `good-*` (incl. `good-empty-rebuttal-set.md`) exits 0
- [ ] No regression: session 001, the v2 dogfood verdict, and every v2 fixture behave exactly as before (no `Juror:` line ⇒ no new requirement)
- [ ] Key-leak grep: no `JUROR_API_KEY`-shaped value in any written artifact/fixture
- [ ] Adversarial breaking-input pass on the three checks; found holes fixed + pinned as fixtures (v2 retro F1)
- [ ] tracker updated (PROGRESS row ✅ + done-log)

## Verification plan

- **Test command:** `node .claude/scripts/council-lint.mjs --verdict docs/council/kickoff-v3/fixtures/phase-00/bad-juror-missing-artifact.md`
- **Expected failure first:** run BEFORE the phase is built this exits 0 (the shipped lint knows no Juror checks) — RED; after the phase it exits 1 naming the Juror⇔artifact consistency check. Same red-first pattern for `bad-artifact-no-juror-line.md` and `bad-rebuttal-id-not-in-juror.md`. For the script: `node .claude/scripts/council-juror.mjs` is module-not-found before the phase (RED), then the fake fixture sweep passes.
- **Live demo scenario:** `JUROR_FAKE=docs/council/kickoff-v3/fixtures/phase-00/fake-response-good.json node .claude/scripts/council-juror.mjs --points <v2 dogfood rebuttal-set points> --out <tmp>` → artifact contains ratings for exactly the rebuttal-set ids + a run-record with no secrets.
- **Real-system check:** n/a — fakes only this phase (real providers are Phase 1 by design).
- **Expected evidence:** fixture-sweep transcript (named check per bad fixture) + the demo artifact, pasted into the PROGRESS done-log.

## Rabbit holes in this phase
- No provider-network code in Phase 0 — the fake is the only impl.
- The run-record schema stays minimal (time/host/model/latency/sizes) — no request/response body dumps.

## Out of scope for this phase
- Real providers, the arc-council.md juror step, dogfood, fabrication probe → phase-1.

## Your-setup / pending
None — Phase 0 needs no keys.

## Non-negotiables (verbatim from PLAN)

- Council-files-only (as v2): changes touch `.claude/commands/arc-council.md`, `.claude/scripts/council-*.mjs`, `docs/council/**`, and new council-scoped files; `.env.example` and every other root file stay untouched on this branch.
- Secrets: `JUROR_API_KEY` is read from env only — never committed, never echoed into artifacts, run-records, fixtures, or logs (pre-mortem row 4 carries the grep check).
- Offline-first: the fake impl + its contract test are green (Phase 0) before any real provider call exists (Phase 1); an unconfigured deep run always completes with a named `Juror: unavailable` line (ADR-0016).
- The juror never modifies ratings — it is an append-only independent grader; disagreement is surfaced under `## UNRESOLVED`, and agreement is never required (ADR-0018).
- Required-when-configured is mechanical: a configured juror that failed is a named lint failure, never a silent skip (ADR-0016).
- Every new lint check ships red-fixture-first AND gets an adversarial breaking-input pass before its phase closes (v2 retro F1 — mandatory verification, not optional review).
