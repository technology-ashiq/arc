# Phase 03 — Generator + lints

**Goal (one line):** drafts worth a human's five minutes, and two gates that are honest about what
they cannot catch.
**Appetite:** 1.5 days — blown appetite = cut scope or kill, never extend silently.
**Depends on:** phase-02

Serves **REQ-02**. Also closes pre-kickoff gate row 5 (exemplars), unevidenced at kickoff and
resolved by ADR-1114.

## Exit criteria (Definition of Done)

1. **Exemplars exist:** 2–3 machine-drafted candidates, presented as ONE inbox item, owner-approved,
   versioned at `initiatives/growth/exemplars/`. This is a **one-time setup approval, not a third
   gate** (ADR-1112).
2. `seo-article-writer` **upgraded, and its prescriptive body removed** — the v0 skill's entire
   content is structure prescription ("the same deterministic structure every time", "5–8 H2s"),
   which ADR-1110 forbids. The name and interface survive; the rules do not.
3. Prompt assembly takes the **approved exemplar files as its only style input**. No style rules in
   the prompt beyond them.
4. MDX output with frontmatter `{title, meta, slug, cluster_id, template_id, citations[]}`, and an
   internal-link plan drawn only from the approved cluster.
5. **slop-lint v1** — negative-only, over a versioned marker list. It reports what it found; it never
   reports what is absent and never scores.
6. **citation-lint** — claim-of-fact tagging plus a link-alive check. A dead link is a **WARN**.
7. The **POV floor** is wired as a review-pack checklist line, human-judged. It is never a regex.
8. **Adversarial pass on both lints — two fresh surfaces**, one on the marker/decision logic and one
   on the file/encoding boundary. Neither attacker has seen the implementation. The attacker's
   prompt carries this lane's running defect list with the instruction to check each defect in every
   **other** file. Holes fixed **and pinned as fixtures** before the phase closes.

## Verification plan

**Refined 2026-08-14** from the coarse kickoff one-liner. Suite: `tests/growth-lints.bats`.

| # | What is proven | Expected |
|---|---|---|
| V1 | Green **on CI**, per-JOB, at the branch HEAD | every job `success`, three OS legs |
| V2 | Every versioned slop marker is caught by its own fixture | each `phrases[].id` has a fixture that hits it; the suite **derives the id list from the marker file**, so a marker added without a fixture turns it RED |
| V3 | A claim of fact with no source link **FAILs** | `UNCITED`, exit 5 from the CLI |
| V4 | A dead link **WARNs**, never FAILs | `DEAD_LINK`, exit 0 |
| V5 | A link that could not be checked is its own state | `UNCHECKED_LINK` WARN — not live, not dead (the 429 lesson) |
| V6 | A clean article is green | zero findings, exit 0 |
| V7 | **The honest-limit fixture (mandatory)** | a marker-free sample that is still slop **PASSES** both lints, and the fixture is committed |
| V8 | **The vacuous-pass guard** | a deliberately broken marker file turns the suite RED — a lint that cannot tell "scanned clean" from "could not scan" is the memory lane's 2026-08-12 finding |
| V9 | The assembled prompt carries no style prescription | `assertNoStylePrescription` on the REAL assembled bytes, and a mutant prompt carrying "5-8 H2s" is refused |
| V10 | Frontmatter `citations[]` matches the body's links | derived, never accepted from the caller |

**Correction, 2026-08-14.** The kickoff wording of this plan said *"a claim without a link WARNs"*.
That contradicts REQ-02 (*"every claim-of-fact carries a source link"*) and ADR-1111, which makes
the source link an **E3 law** rather than a suggestion. A law enforced at WARN is not enforced. The
built behaviour is **FAIL for an uncited claim, WARN for a dead link** — a distinction ADR-1110 does
draw explicitly, and the only one it draws.

**The vacuous-pass guard for this phase:** each lint fixture must first prove the lint **ran** — a
deliberately broken lint binary must turn the suite RED — before any fixture's verdict is trusted.
A gate that cannot tell "scanned clean" from "could not scan" is the memory lane's 2026-08-12
finding, repeated.

## Rabbit holes in this phase

Prompt-tuning loops (exemplars are the only input, by ADR) · adding "just one" positive rule because
an article came out short · building a readability score · a general link-checker service · letting
the marker list grow into a style guide by accretion — every addition is a marker for a **bad**
pattern or it does not go in.

## Out of scope for this phase

Publishing, PRs, review packs (Phase 4) · A/B assignment · metrics.

## Your-setup / pending

One inbox decision on the exemplar candidates. If all three are rejected, the fallback is the owner
supplying real writing (ADR-1114) — his call at that point, with three concrete drafts to react to
rather than a blank page.

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
