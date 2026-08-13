# ADR 1001 — `content.published` joins the closed kind set, and growth adds no policy subject

**Status:** accepted
**Date:** 2026-08-12
**Product:** `growth`
**Reversibility:** one-way
**Revisit trigger:** a second publishing surface (a venture site under Appendix A) needs a field
this payload does not carry — then the payload is extended by a new ADR, never widened silently,
and the idem preimage is re-derived in the same change.

## Context

The spine's kind vocabulary is closed (ADR-0026): an unknown kind does not error loudly, it
**quarantines** while the emitting command still exits 0. `retro-log.md:36` records exactly that
— `develop.started` was rejected as `UNKNOWN_KIND` and the first sign of it was listing the spine
directory by hand. So "every publish emits a receipt" is not true until the kind exists.

Verified today: `KINDS.length` is **44** (`validate.mjs:33–53`), and **no `content.*` kind
exists**. Of those 44, only 11 have ever been emitted across 1,024 events.

The design source's GRO-A carries an instruction repeated in every draft of this plan: *"`hq.policy.yaml`
rows for the new action kinds land in the same change (POL-I)"*. **It does not apply here, and the
reason is a word collision.**

**ADR-0504 defines an "action kind" as the authorization SUBJECT** — and the live `kinds:` map holds
exactly four, all of them subjects: `session:interactive`, `process:kickoff-plan`,
`process:review-diff`, `process:commit-msg-draft` (`hq.policy.yaml:104-137`). A **spine event kind**
like `content.published` is a different thing wearing the same word. `kickoff-lint`'s own
`[birth-rule]` check confirms it: it reconciles `processes/*.process.yaml` against
`hq.policy.yaml`, and reports "N process(es) … 0 ungoverned".

Two lanes have already hit this and recorded the same answer: **ADR-0703** (memory) — *"Memory needs
no `hq.policy.yaml` rows. POL-I is not applicable"* — and **ADR-0912** (bench, this morning) —
*"bench adds no policy subject, and must not become a policy bypass"*. Growth is the third.

## Options considered

1. **One kind, `content.published`, closed payload, rows in the same change.**
2. **A lifecycle pair — `content.drafted` + `content.published`.** Con: the draft is already
   fully described by the PR and by `decision.recorded` carrying `draft_sha`; a second kind would
   record a fact that is not independently observable off the spine.
3. **Reuse `ship.done`.** Con: it means a deploy, not an article; one kind would then answer two
   different questions and the board could not tell them apart (ADR-0304's one-kind-per-step rule).

## Decision

**Option 1.** `content.published` is added to `KINDS` (44 → 45), stated against the live count
per the ADR-0107 derived-count rule. Its validator is `assertContent`, built in the
`assertDecision`/`assertMoney`/`assertLeads` pattern: a **closed** key set where an unknown
payload key throws rather than being ignored.

Payload (closed — unknown field = exit 2):

```json
{
  "site": "<host>", "slug": "receipts-driven-os", "url": "https://…/blog/…",
  "title": "…", "template_id": "title-a", "cluster_id": "c-001",
  "content_sha": "<sha256 of the published MDX>", "pr_ref": "#12"
}
```

**Idem = total preimage over every identity-bearing field:** `site`, `slug`, `content_sha`, `title`,
`template_id`, `cluster_id`, `url` — and deliberately **not** `pr_ref`.

That exclusion and that inclusion are the same rule, read from the two comments this codebase
already carries. `outreach.sent` (`validate-leads.mjs:165-180`) records that omitting an
identity-bearing field collapsed two real sends into one receipt; `outreach.replied` (`:181-187`)
records the opposite error, that a field stamping *our processing* split one fact into two receipts
on re-ingest. `pr_ref` is the second kind: two pull requests publishing identical bytes are not two
publications.

**A first draft of this ADR had the preimage at `site|slug|content_sha` alone, and an adversarial
pass killed it.** Under that formula a metadata-only correction — a wrong `template_id`, a fixed
title, body bytes untouched — hashes identically to the original and is refused as DUP_IDEM. The
correction would be silently dropped, which is precisely the ~100-receipt C2 loss class this rule
exists to prevent, reproduced inside the rule meant to prevent it. `slug` and `site` additionally
carry grammars that **exclude the join delimiter**, so no field value can forge one.

`email.sent` is **not** added. It was conditional on the lifecycle slot opening, and ADR-1103
spends that slot on the site — so the kind that would have been ungoverned vocabulary is simply
not written.

**Growth adds NO `hq.policy.yaml` row, and that is the correct outcome, not an omission.** Its
commands are scripts invoked inside `session:interactive`, so they inherit that subject's ceiling;
they are not `processes/*.process.yaml` and therefore introduce no subject. This ADR was drafted the
other way — asserting rows for `content.published` — and the simulation gate broke it by asking the
only question that mattered: *what does a row actually contain?* There is no shape a spine event kind
could take in that file.

**The obligation this replaces it with (ADR-0912's shape): growth must not become a policy bypass.**
`arc growth publish` shells out to `git` and `gh`, both of which `argv0_classes` classes as general
machines. It must run under `session:interactive`'s existing ceiling and never acquire a subject of
its own as a way to widen it. **If growth ever adds a `processes/growth-*.process.yaml`, that process
is born with its row in the same change** — that is POL-I, correctly scoped.

Publishing remains Constitution **E2** territory regardless: "publishing under Ashiq's name" is an
*ungrantable* action, so the merge step is unreachable at any level by construction (ADR-1102).

**Evidence:** `validate.mjs:33–53` (KINDS=44, no `content.*`) · `validate.mjs:60–64`
(REQUIRED_KEYS) · `validate-leads.mjs:242–283` (the closed-key + per-field assert pattern this
copies) · `hq.policy.yaml:104-137` (the four subjects — all `session:` or `process:`, no spine kind) ·
`docs/adr/0504-an-action-kind-is-the-authorization-subject.md` · `docs/adr/0703-*` and
`docs/adr/0912-*` (two lanes recording POL-I as not-applicable) · `retro-log.md:36` (silent
quarantine) · spine scan 2026-08-12: 1,024 events, 11 distinct kinds, zero `content.*`.
**Confidence:** high — every element is transcribed from a validator that is on disk and from a
policy file that FAILs from birth on a violation.
**Rejected because:** option 2 records a fact the PR already carries; option 3 collapses two
questions into one kind.

## Consequences

Easier: every publish is answerable off the spine, and re-publishing the same bytes is provably
idempotent. Harder: `KINDS` is a company organ two other live lanes also edit this week — the
band-collision rule in `.claude/rules/lanes.md` applies to `validate.mjs` exactly as it does to
ADR numbers, so this edit checks `git log origin/main -- .claude/scripts/hq/lib/validate.mjs`
before it lands.
