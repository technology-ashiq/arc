# Extraction report -- gstack /review (the post-build review pass)

<!-- REQ-08, the cycle's proof-of-life. ADR-0606 named this target: PLANOFF-01 (2026-07-12) has arc
     at the TOP composite (94.5 vs gstack's 90.8) and still records that gstack's post-build review
     pass "found the only real defect anyone caught (malformed percent-escape -> 500) -- a defect no
     plan predicted and no acceptance test probed." arc neither found nor survived it.
     Every line of studied content reached this report through `study.mjs --read`, never through a
     direct file read: confined to the study root, returned inside a nonce-sealed envelope, and
     never executed. -->

## Source

- **Identity:** gstack's `/review` skill, `SKILL.md` -- the only file in the study root
  (`~/.claude/skills/review/`), confirmed by `study.mjs --inventory`: 1 readable file, 0 refused,
  0 quarantined.
- **Pin:** `sha256 92ee16af71d5e0088326869b0a211c50f94b9261eeae75656bc21f9bcfae2031`, 105802 bytes,
  1853 lines, read 2026-08-09. The file declares `version: 1.0.0` at `SKILL.md:3` and is marked
  `AUTO-GENERATED from SKILL.md.tmpl` at `SKILL.md:31`, so the template is upstream of what was read.
  There is no git checkout here to take a commit from, so the content hash IS the pin.
- **License:** **NOT FOUND, and that is a finding rather than a formality.** No `LICENSE`, `LICENCE`
  or `COPYING` exists in the study root, in `~/.claude/skills/`, or at any depth searched. The file
  itself carries no license header. **No license means all rights reserved**, so the honest
  consequence is recorded in the refusal log below: **zero copying, re-expression only.** This is
  exactly what ADR-0601 forbids assuming from the ecosystem -- "MIT, probably, it is a dotfile skill"
  would have been an assumption, and the field says what was actually looked for and not found.

## Study scope

- **Read:** `SKILL.md` in slices via `study.mjs --read --lines`: 1-70 (frontmatter and preamble),
  the heading index across 1-1853, and 1251-1295 in full (the pre-emit verification gate). Every
  read came back inside the envelope with the whole-file sha256 attached, and slices declare
  themselves as slices so a citation from one is not mistaken for a citation of the whole file.
- **Not read:** roughly 1600 lines -- the AskUserQuestion formatting rules, artifact sync, telemetry,
  voice and writing-style sections, the Greptile integration, and the plan-drift machinery. Skipped
  deliberately: none of them bear on the question ADR-0606 asked, which is *how does this pass find a
  defect no plan predicted*.
- **Archaeology budget spent:** ~0.4 hours, well inside the 1-day SKIP threshold.
- **`--lines` was added to `study.mjs` during this study**, because a study surface that can only read
  whole files cannot study a 105 KB source without swallowing it. Confinement, classification and the
  envelope are unchanged; the slice narrows what is quoted, never how safely.

## Technique inventory

| id | name | what it does | why it wins | citation | verdict | reason | license note | risk note |
|---|---|---|---|---|---|---|---|---|
| T-01 | pre-emit finding verification | A finding is UNVERIFIED unless the reviewer can quote the source line that motivated it. Unquotable findings are forced to low confidence and suppressed from the main report, kept only in an appendix for calibration audit -- and inventing a high confidence to dodge the gate is called out as defeating it | It moves verification BEFORE emission. arc verifies findings after the fact, by hand, one at a time -- which is precisely what this cycle did across three adversarial passes, with no mechanism at all. It also names the false-positive CLASSES it kills rather than claiming general accuracy | `SKILL.md:1251` heading, `1252-1256` the rule and the anti-workaround clause, `~1275-1281` the measured FP-class table | ABSORB | Re-expressible as a requirement on arc's review surface. No new dependency, no runtime, no install. **BUT THE REBUILD IS BLOCKED and the first version of this cell was wrong** -- it named `.claude/commands/arc-review.md`, which is a GENERATED file, and the process it compiles from is one of engine Cycle 6's three pinned fidelity pilots. See the refusal log: ADR-0602 Amendment 1 | Nothing copied. The idea is re-expressed in arc's own words against arc's own surfaces; no license permits copying here, and none is needed to re-express a practice | The gate can suppress a TRUE finding whose motivating line is genuinely hard to quote. gstack mitigates with an appendix plus a calibration-learning loop; arc must keep the appendix or it converts false positives into false negatives |
| T-02 | specialist hit-rate adaptive gating | Tracks which review specialists historically find real issues, and gates future dispatch on that measured hit rate | Turns reviewer selection into a measured feedback loop instead of a fixed panel | `SKILL.md:1324` and `SKILL.md:1347` | SKIP | Needs a persistent hit-rate store and enough review history to be non-noise. arc has neither, and building the store is bench's territory (ADR-0605), not a technique rebuild. Recorded so it is not re-studied | Nothing copied | A hit rate computed over a handful of runs would gate on noise and quietly stop dispatching a specialist that simply had not been needed yet |
| T-03 | conditional red-team dispatch | A red-team pass dispatched conditionally rather than always | arc already does better here: the two-surface adversarial pass is MANDATORY per phase, not conditional, and this cycle's three passes found 18, 21 and (pending) findings after fully green CI | `SKILL.md:1475` | SKIP | arc's existing practice is stronger than the studied one. Recorded as studied-and-rejected so a future cycle does not re-open it as a gap | Nothing copied | None -- nothing changes |
| T-04 | cross-review finding dedup | Deduplicates findings across multiple review passes before classification | Directly relevant: this cycle ran three adversarial passes whose findings I deduplicated by hand | `SKILL.md:1505` | ROUTE | This is orchestration of review agents, which is engine/executor territory rather than a technique absorb rebuilds. Referred, not absorbed | Nothing copied | None |

## Verdict summary

| verdict | count |
|---|---|
| ABSORB | 1 |
| INTEGRATE | 0 |
| ROUTE | 1 |
| SKIP | 2 |

## SKIP and refusal log

- **T-01's ABSORB verdict stands, and its REBUILD IS BLOCKED — recorded here because a verdict
  without a landing site is not a finished absorb.** The rebuild was written into
  `processes/review-diff.process.yaml`, recompiled cleanly and passed `rebuild-lint` with 0
  warnings — then turned CI red on 7 of 19 jobs. `review-diff` is one of **three PILOT processes
  that are engine Cycle 6's proof its compiler is faithful**: the engine asserts all three compile
  byte-identical to their hand-written baselines and round-trip byte-for-byte out of their block
  scalars, against committed pre-flip fixtures. Editing the body destroys that proof, and
  "regenerating the baselines" would have deleted another lane's evidence while reporting a clean
  absorb. **Reverted; engine is back to 3/3 byte-identical.** Recorded as ADR-0602 Amendment 1:
  `processes/**` excludes the three pilots, and changing one needs an engine-side ruling.
  The technique's real home is the review METHOD in `.claude/agents/code-reviewer.md`, which is
  **not on the allowlist** — reaching it is an allowlist widening, which ADR-0602 says is an
  amendment and never a convenience edit. **Proposed, not taken: it is the owner's call, not a
  mid-phase decision by the lane that wants the room.**

- **LICENSE REFUSAL, recorded first because it constrains everything above.** No license was found
  for the studied source, so **all rights are reserved by default and nothing may be copied.** The
  single ABSORB verdict is therefore a **re-expression** -- the practice, rewritten in arc's terms
  against arc's own surfaces -- and not a port. `rebuild-lint --license` is run as `none`, not
  `permissive`, because `permissive` would assert a license that was never found. Attribution is
  given anyway, in the rebuilt file and in the registry row: it costs nothing and the source deserves
  the credit even where no license compels it.
- **T-02 SKIPped** -- specialist hit-rate gating needs a persistent store and a review history arc
  does not have; the store is bench's territory (ADR-0605).
- **T-03 SKIPped** -- arc's mandatory two-surface adversarial pass is stronger than the studied
  conditional one. Studied and rejected, recorded so it is not re-opened as a gap.
- **T-04 ROUTEd** -- review-agent orchestration is engine/executor territory (ADR-0604).
- **~1600 lines not read**, listed in Study scope with the reason. An omission recorded is honest; an
  omission inferred later is not.
