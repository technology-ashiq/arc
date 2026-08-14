# Phase 01 — Name and instrument the site

> **PARKED (ADR-1115), 2026-08-13.** Assumption A-07 fired: growth ships as a standing capability
> and this phase does not run in Cycle 14. **It un-parks unchanged** — nothing below is rewritten,
> because the work is right and only its timing moved.
>
> Entry needs **two** things and has one. `arc.automemory.ai` now resolves and serves (2026-08-13),
> so the domain half is satisfied; the **verified Search Console Domain property is still absent**,
> and that is the half that starts evolve's clock. The domain existing does NOT un-park this phase.

**Goal (one line):** the site gets a permanent name and a Search Console property, because that
date is the earliest moment evolve's four-week clock can begin.
**Appetite:** 1.0 day — of which roughly 2h is this lane's work; the rest is DNS propagation and
Search Console's own verification lag, which this lane does not control and must not book as effort.
Blown appetite = cut scope or kill, never extend silently.
**Depends on:** phase-00

Serves **REQ-11**. It is placed second, not last, for one reason: **Search Console does not
backfill.** Data accrues from the moment a property is added, so every day this phase stays open is
a day subtracted from evolve's trigger, one for one and unrecoverable (ADR-1105).

## Entry gate (owner)

This phase **starts** when the owner names the domain. That is an account action, not a build task,
and it is the leads `_dmarc` precedent: the record only the owner can create is a phase entry gate,
never a kickoff blocker. **If the gate is unmet when this phase opens, the lane does not stall** —
Phases 2–4 proceed on the preview URL and Phase 5 reports zero COMPLETE windows with the reason
recorded (Assumption A-07).

## Exit criteria (Definition of Done)

1. Domain named, and **its own one-way ADR written** and numbered from the 1000 band — options,
   consequences, and a real revisit trigger. It is one-way because URLs, backlinks and Search
   Console history do not survive a move.
2. DNS + TLS green; the site serves over HTTPS at the chosen host.
3. **Search Console property added and verified.** A **Domain** property is preferred so a later
   `www.`/`blog.` decision needs no second property and no second clock. Evidence: the verified
   property, captured in the phase's evidence bundle.
4. `content.published.site` re-pinned to the permanent host in configuration.
5. **Every pre-cutover receipt is corrected by `supersedes`, never edited.** The Phase 0 article was
   published to a preview host, so its receipt carries a `site` that is no longer true; because
   `site` is in the idem preimage, the correction is a new receipt that names the old one.
6. `sitemap.xml` reachable at the permanent host.
7. `llms.txt` generated — shipped as a **hedge**, and ADR-1113 forbids it appearing in any exit
   criterion as a lever. This criterion asserts the file exists and is well-formed, nothing more.
   **The IndexNow ping is CUT** (ADR-1113 amendment): it reaches no Google surface, and Google is the
   only engine this cycle measures.

## Verification plan

**Test command:** `bats tests/growth-site-cutover.bats`

**Expected failure first:** case `"a pre-cutover receipt cannot be corrected by editing it"` must be
**RED** until the supersede path exists — the fixture attempts an in-place rewrite of the Phase 0
receipt and the suite must refuse it, then prove the correct path produces **two** receipts with an
intact `supersedes` link and the original bytes unchanged on disk. A suite that is green before the
supersede path is written is asserting nothing.

**Fixtures:**

| Fixture | Asserts |
|---|---|
| `site-repin-supersedes` | preview-host receipt + permanent-host receipt = two receipts, linked, original untouched |
| `idem-changes-with-site` | the two receipts have **different** idems, since `site` is in the preimage — proving the correction is a new fact and not a collision |
| `sitemap-includes-published-slugs` | every `content.published` slug appears in the sitemap, and nothing else does |

**Live proof:** the Search Console property is verified in the console itself and the verification
captured. **No claim about data is made in this phase** — a property verified today has no data yet,
by Google's own documentation, and reporting otherwise would be an E3 violation.

## Rabbit holes in this phase

Choosing the domain on aesthetics rather than on the ADR-0402/0416 isolation question · setting up
analytics beyond Search Console · redirect maps for URLs that do not exist yet · buying a second
domain "for later" · attempting to backfill Search Console history (it cannot be done; the claim
that aged domains carry it was checked and rejected).

## Out of scope for this phase

Any content work · the ingest itself (Phase 5) · brand assets (Phase 4).

## Your-setup / pending

- **Owner, two actions, both account-level:** name and point the domain (DNS), and add + verify the
  Search Console property. Everything else in this phase is build work that runs without them.
- Domain registration may cost money — that is a purchase decision and belongs to the owner alone.

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
