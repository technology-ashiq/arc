# Phase 04 — Publish path + A/B + GEO

**Goal (one line):** a five-minute human loop that publishes by pull request, and a command with no
path to a merge.
**Appetite:** 1.5 days — blown appetite = cut scope or kill, never extend silently.
**Depends on:** phase-00, phase-03

Serves **REQ-03** (publish = PR, humans hold the merge) and **REQ-04** (the A/B slot). **REQ-06's
brand kit was CUT at kickoff** by the attack panel: it has zero audience and zero effect on the
evolve trigger, and a design-review-then-owner-pick loop has unbounded wait time inside this line —
where it competed directly against E2's safety-critical mutant guard. The Astro default theme ships.

## Exit criteria (Definition of Done)

**The publish path**
1. `arc growth publish <slug>` writes a branch and a PR, captures the preview URL, and has **no
   merge path and no default-branch push path**.
2. The guard is a **parse of the command's own module graph, never a grep** — a grep misses
   `from "fs"`, `fs/promises`, `child_process`, and async exec/spawn, which is exactly how a mutant
   walked past the last propose-only guard arc wrote.
3. A **running mutant** ships with the suite and attempts three distinct escapes: a merge, a
   `git push origin main`, and a direct write to the deploy hook. The suite **REJECTS all three**,
   and **each rejection is attributable to the guard under test** — a mutant that crashes on an
   unrelated fault before reaching its target behaviour is not a passing negative control.
4. **Review pack = ONE inbox item**: preview URL · lint report · citation report · diff · POV line.
   A pack missing the preview URL is an **invalid item**, not a warning.
5. Approve → `decision.recorded` carries the draft `content_sha` → **human merges** →
   `content.published` with the sha read from the **site repo's** merged tree.
6. Re-publishing an existing slug is an **update**, not a duplicate page.
7. **Unedited counter:** sha-equal increments; sha-different neither increments nor resets.

**The A/B slot**
8. Two title templates as versioned files; `sha256(slug) → arm`, **replay-identical** — the
   mechanics are fixed by **ADR-1106**, including why a human may not cherry-pick an arm (it
   confounds the arms at the source) and why random assignment is refused (it does not replay).
9. `template_id` present in every payload; a receipt missing it is rejected — **and a value outside
   the two enumerated template versions is rejected by the same closed-set check. The field is
   validated on its VALUES, not merely on its presence**: an enum enforced on a field's name and
   never its values let a confident wrong value pass as clean in the memory lane on 2026-08-12.
10. **Zero `experiment.*` emissions** — that stream is evolve's, and the two are never summed.

**The template**
11. GEO parts: Article + FAQPage JSON-LD, author entity, disclaimer footer, sitemap auto-update, and
    `llms.txt` — the last a **hedge** ADR-1113 forbids from appearing in any exit criterion as a
    lever. Its criterion is "well-formed", never "improves anything". **The IndexNow ping is CUT.**

## Amendment, 2026-08-14 — the E2 verb ban was over-broad against its own ADR

Phase 02 shipped a test asserting the command registry exposes **no `publish` verb**. Criterion 1
of this phase requires `arc growth publish <slug>`, and **ADR-1102 names that command explicitly**:
*"`arc growth publish <slug>` creates a branch and a PR. It has no merge path and no default-branch
push path."*

So the Phase-02 assertion contradicts the decision it was written to enforce. The banned thing is
never the WORD — it is the **capability**: a merge, a push to the default branch, a direct deploy.
Opening a pull request is the opposite of those; it is the act that puts the decision in front of a
human, which is what E2 asks for.

The banned list becomes `promote · merge · deploy · ship`, and `publish` is permitted **only**
alongside the module-graph guard and its running mutant (criteria 2 and 3). A verb name was never
the control; the guard is. Routed here rather than edited quietly into a test, because the
assertion encodes a Tier E unamendable article and a silent loosening of one is exactly what the
process exists to prevent.

## Verification plan

**Refined 2026-08-14** from the coarse kickoff one-liner.

| # | What is proven | Expected |
|---|---|---|
| V1 | Green **on CI**, per-JOB, at the branch HEAD | every job `success`, three OS legs |
| V2 | The publish module's **module graph** carries no merge, no default-branch push, no deploy write | a PARSE of imports and call targets, never a grep — a grep misses `from "fs"`, `fs/promises`, `child_process` and async exec/spawn |
| V3 | The **running mutant** attempts three distinct escapes and each is REJECTED | merge · `push origin main` · direct deploy-hook write — and **each rejection names the escape it caught**, so an incidental crash cannot pass as a negative control |
| V4 | A review pack missing the preview URL is **invalid**, not warned | structural refusal |
| V5 | Arm assignment is `sha256(slug)`, **replay-identical**, through the PRODUCTION function | the fixture calls the real assignment via the real path, never a hash re-implemented in the test (arc-engine 2026-08-03: a fake that swapped the code path let a three-driver suite pass with zero real driver code) |
| V6 | `template_id` is validated on its **VALUES**, not merely its presence | a value outside the two enumerated templates is rejected by the closed-set check (arc-memory 2026-08-12) |
| V7 | The enumerated set and the versioned template FILES agree | a test derives the file list from disk and compares it to the validator's constant — one list, two readers |
| V8 | Re-publishing a slug is an **update**, not a duplicate page | fixture |
| V9 | The unedited counter: sha-equal increments, sha-different **neither increments nor resets** | fixture |
| V10 | **Zero `experiment.*`** emissions from growth | the stream is evolve's and the two are never summed |
| V11 | JSON-LD is well-formed Article + FAQPage | parsed and shape-checked. `llms.txt` is checked "well-formed" and **never** "improves anything" (ADR-1113) |

**The replay fixture must invoke the production assignment function through the real publish path**,
never a hash re-implemented inside the test — a fake that swapped the code path let a three-driver
contract suite pass while zero real driver code ran (arc-engine, 2026-08-03).

**The publish guard and its mutant are never cut.**

## Rabbit holes in this phase

Designing a beautiful review pack when a plain list is faster to read · a general A/B framework
(evolve owns experiments; this is two files and a hash) · perfecting JSON-LD coverage beyond Article
and FAQPage · debugging why IndexNow did not affect Google — it does not reach Google, by design
(ADR-1113) · a brand exploration that becomes its own cycle.

## Out of scope for this phase

Metrics and the ingest (Phase 5) · the real drip week (Phase 6) · any optimization logic on the A/B
slot whatsoever.

## Your-setup / pending

None. The merge of each content PR is the owner's, permanently — that is E2, not a phase task.

## Non-negotiables (verbatim from PLAN)

- **E2 · Human Sovereignty (Tier E, unamendable):** the machine writes branches and drafts; a human merges every publish, every asset swap, every template change. E2 names *"publishing under Ashiq's name"* itself. Enforced in the command by a module-graph parse plus a running mutant — never by convention (ADR-1102).
- **E3 · The Truth Law:** no fabricated numbers, benchmarks, case studies or testimonials; a source link on every claim-of-fact; arc's own results cited only where a receipt exists; simulated always labelled simulated (ADR-1111).
- **A9 · Appetite over estimate:** 10 days is a cap. Blown means cut or kill.
- **A2 · Boring tech before clever tech** — the site choice names the boring alternative it beat (ADR-1104).
- **A5 · One source of truth** — metrics live on the spine as receipts; no metrics database.
- Exactly **two recurring human gates** (ADR-1112). Lints are **negative-only** (ADR-1110).
- Total-preimage idems everywhere · **MISSING ≠ zero** · corrections `supersedes`, never overwrite · no raw URLs or PII on the spine · reader-only spine access · every emit verified in both `events/` and `events/_quarantine/`.
- Official APIs only · **no cold email anywhere in this module** (that is leads', with its own caps and PII law) · no paid ads.
- **Fixture-proven ≠ live-validated** — the tracker records which one each REQ closed as.
- **Shared-organ edits are conflict-checked, never assumed clear:** before any commit touching `KINDS` in `validate.mjs` or `hq.policy.yaml`, run `git log origin/main --oneline -5 -- PATH` — bench, engine and leads are three other LIVE lanes editing these same company organs this week, and `.claude/rules/lanes.md` records two real collisions already. At the merge take the STRONGER version, never the earlier one, and re-derive any measured value (`KINDS.length`) on the merged tree rather than trusting either branch's count.
