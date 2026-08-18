# growth — the weekly ritual

Two loops. The publish loop runs when there is a draft; the ingest loop runs once a week.
Everything here is a command plus the one thing only a human can do.

**Updated 2026-08-16.** The Search Console Domain property now exists and Phase 01 is un-parked, so
the ingest loop has a clock — but **not yet data**: the site is `noindex` until arc-site PR #3
merges, and Google accrues no impressions before then. The ingest stays unrunnable for a different
reason than when this file was written, and the distinction matters: it used to be *no property*,
now it is *no indexability*.

---

## Closing Phase 00's steel thread, once arc-site PR #2 is merged

Written out in full because the alternative is re-deriving it at the moment of the merge, which is
where a wrong value gets typed into a receipt that cannot be edited afterwards.

**The receipt carries the PERMANENT host, not the preview host.** Phase 00 criterion 10 says the
preview host, and that was written when no domain existed. One now does, and the article is served
at `arc.automemory.ai` — so a receipt naming the preview host would assert something untrue purely
to give Phase 01 criterion 5 something to correct. **E3 forbids that.** Criterion 5 closes as *not
applicable*; see `evidence/phase-01/exit-criteria.md`.

```bash
# 1. From the MAIN clone -- never a worktree. The spine is gitignored, so a worktree has its own
#    and an event written there is valid, real, and invisible to every reader including arc-inbox.
cd E:/Work_Hub/01_Automemory/arc

# 2. Pull first. A stale checkout rejects a newly merged kind as UNKNOWN_KIND, and the emitter
#    exits 0 while quarantining, so the failure is silent.
git pull --ff-only

# 3. content_sha is sha256 over the RAW BYTES of the .mdx in the SITE repo's MERGED tree.
#    Not a git blob sha (that prefixes a header), not the rendered HTML, and read from the merged
#    tree rather than a local working copy -- arc-site pins eol=lf so the two now agree, which
#    they did not before 2026-08-16.
cd E:/Work_Hub/01_Automemory/arc-site && git checkout main && git pull --ff-only

# Uses contentShaOfFile -- THE definition. Never hash it another way here: a runbook that computes
# this value independently is a second implementation of the field the receipt is keyed on, and
# that exact class already bit us across a BOM on 2026-08-16.
node E:/Work_Hub/01_Automemory/arc/.claude/scripts/growth/content-sha-of.mjs src/pages/blog/the-author-cannot-be-the-attacker.mdx
```

Then write the payload to a REAL FILE and emit from it. Two things here are not stylistic, and both
were wrong in the first draft of this procedure:

- **`bash`, not `node`.** `arc-event.sh` is `#!/usr/bin/env bash`; running it under node throws a
  `SyntaxError` on line 2. Every other invocation in this file uses `bash`.
- **A real file, not `<(process substitution)`.** Process substitution yields `/dev/fd/N`, which
  **native Windows node cannot open** — and this procedure runs on `E:/`. It would fail at the one
  moment it must not.

```bash
cd E:/Work_Hub/01_Automemory/arc

# The host comes from site.json, never typed here. Criterion 4 exists because a hand-typed host is
# one typo away from a receipt claiming an article lives somewhere it does not -- and since `site`
# is in the idem preimage, that typo is ACCEPTED as a distinct publication rather than refused as a
# mistake. A runbook that hardcodes the host reintroduces exactly the defect the config removed.
SITE="$(node -p "require('./initiatives/growth/site.json').site")"
echo "site = $SITE"

# Fill in the sha from step 3 and the merge PR number, then write the file.
cat > /tmp/steel-thread.json <<JSON
{"site":"$SITE",
 "slug":"the-author-cannot-be-the-attacker",
 "url":"https://$SITE/blog/the-author-cannot-be-the-attacker/",
 "title":"The person who wrote the check is the worst person to break it",
 "template_id":"title-a",
 "cluster_id":"c-000",
 "content_sha":"PASTE_THE_SHA_FROM_STEP_3",
 "pr_ref":"#2"}
JSON

# Refuse to emit a placeholder. This is an append-only log; a receipt carrying the literal
# PASTE_THE_SHA_FROM_STEP_3 could not be edited afterwards, only superseded.
grep -q PASTE_THE_SHA /tmp/steel-thread.json && { echo "sha not filled in -- STOP"; false; }

bash .claude/scripts/hq/arc-event.sh emit content.published --payload-file /tmp/steel-thread.json --strict
```

**Then LOOK.** Exit 0 is not evidence — `retro-log.md:36` records an emitter that exited 0 while
every receipt it wrote was quarantined:

```bash
grep -rl content.published .claude/state/hq/events/*.jsonl        # must find it
find .claude/state/hq/events/_quarantine -name "*.jsonl" -newermt "-10 minutes" | head   # must be empty
```

`cluster_id` is `c-000`, the reserved literal for pre-cluster content — the miner never mints it,
so no real cluster can collide. `template_id` is `title-a`, a real versioned file, so it survives
REQ-04's closed-set check rather than being a sentinel that needs superseding later.

---

## The weekly ingest

**Step 1 is yours and the tool cannot do it.** Search Console reports in **Pacific time**. Set the
date range to the exact seven Pacific days of the target ISO week, then export the **Pages** view.

The tool can CHECK that range and refuses on a mismatch, naming both — but it cannot SET it, and a
mis-set range is the failure that does not error. It produces plausible numbers attributed to the
wrong week, which is worse than a gap because a gap is visible.

```bash
# 2. What are the seven Pacific days of the week you want?
node .claude/scripts/growth/arc-growth.mjs ingest --help 2>/dev/null || true
node --input-type=module -e 'const I = await import("./.claude/scripts/growth/lib/ingest.mjs");
  console.log(I.isoWeekDays("2026-W36").join(" "))'

# 3. Ingest. --range-start/--range-end are the range the EXPORT declares, not the one you meant.
#    Passing what you meant defeats the guard: it would be verifying a value against itself.
node .claude/scripts/growth/arc-growth.mjs ingest ./export.csv \
  --week 2026-W36 --range-start 2026-08-31 --range-end 2026-09-06 \
  --receipts ./content-published.json

# 4. It PRINTS the emit commands; it does not emit. arc-event is the one writer to the spine.
#    Run them from the MAIN CLONE, never a worktree.
cd E:/Work_Hub/01_Automemory/arc && bash .claude/scripts/hq/arc-event.sh emit metric.observed --payload '...'

# 5. VERIFY. Exit 0 from the emitter is not evidence -- this lane has had an emitter exit 0 while
#    every receipt it wrote sat in quarantine.
grep -l "<the ULID>" .claude/state/hq/events/*.jsonl
grep -l "<the ULID>" .claude/state/hq/events/_quarantine/ || echo "not quarantined"
```

**The window is MISSING until every receipt is confirmed present in `events/` and absent from
`_quarantine/`.** A partial window is MISSING, never zero. A zero claims the week had no traffic;
MISSING is the truth, which is that nobody knows.

### When the numbers change on a re-read

Expected, not exceptional — Search Console backfills for days, which is why the lag floor is three
days and why it is a floor rather than a completeness guarantee.

Re-run with `--revision 2` (then 3, …). That gives the corrected receipt a distinct `source_id`
and therefore a distinct idem, so it LANDS instead of colliding as `DUP_IDEM`, and it carries
`supersedes` pointing at the receipt it replaces. Re-ingesting the *same* export at the *same*
revision stays idempotent, which is the point of keeping the two operations on different keys
(ADR-1117).

**Never overwrite a receipt.** Corrections supersede.

---

## The publish loop

```bash
# 1. Draft, behind gate 1. Refuses unless a human approved THAT EXACT PLAN (bound by plan_sha).
node .claude/scripts/growth/arc-growth.mjs generate --cluster-id c-001 \
  --plan initiatives/growth/clusters/c-001.json --keyword "ai coding" --out ./prompt.txt
# ...draft it with the seo-article-writer skill...
node .claude/scripts/growth/arc-growth.mjs render --draft ./draft.json \
  --plan initiatives/growth/clusters/c-001.json --out ./article.mdx

# 2. The review pack. INVALID without a preview URL -- without it you are reviewing a diff,
#    not a page, and "looks fine in the diff" is how a broken render ships.
node .claude/scripts/growth/arc-growth.mjs publish ai-coding \
  --article ./article.mdx --plan initiatives/growth/clusters/c-001.json \
  --preview https://<the per-PR preview URL>
```

**Step 3 is yours, permanently.** The machine writes the branch and opens the PR. **A human merges
every publish** — E2, Tier E, unamendable. There is no merge verb, no default-branch push path, and
a running mutant in `tests/growth-publish.bats` proves all three escapes are refused by name.

The POV floor is the line no lint can answer: *name the one original practitioner insight in this
draft.* If you cannot name it, the draft does not pass, and neither lint above can tell you that.

---

## Known limits, so nobody rediscovers them at 2am

- **Per-PR preview URLs do not exist** until `arc-site` is connected to the deploy provider in
  Vercel's settings. Until then the review pack refuses, correctly.
- **Cluster `c-001` contains `yc s23`** — a headline fragment that survives every selection rule.
  Killing that class needs a blocklist (fragile) or token-level attestation (unevidenced). It is a
  known limit handled at gate 1, which is a human reading the proposal (ADR-1116).
  **RULED 2026-08-18: no article is written for `yc s23`.** The search behind it is a directory
  lookup — who was in that batch — which arc cannot answer without writing about YC instead of
  about arc, and neither the POV floor nor E3 would pass that. Gate 1 fired for exactly the case it
  was left open for. The cluster file is deliberately **not** edited: it is the mined record of what
  was found, and an approved plan rewritten to match a later editorial call is the same attribution
  hole that sourcing `cluster_id` from the plan exists to prevent. Cluster-complete is unaffected —
  REQ-09 needs pillar + ≥5 spokes and 6 spokes remain.
- **This cycle cannot earn an L2 promotion.** The bar is 20 unedited approvals and ten articles
  yields at most 10 (ADR-1107).
- **The A/B slot produces no verdict.** Five articles per arm against evolve's ~1,900-per-arm floor
  is a collectable stream and nothing more. Anyone reading a CTR difference between the arms during
  this cycle is reading noise (ADR-1106).
