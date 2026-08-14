# growth — the weekly ritual

Two loops. The publish loop runs when there is a draft; the ingest loop runs once a week.
Everything here is a command plus the one thing only a human can do.

**Nothing in this file runs yet.** The site is `noindex` and there is no Search Console property,
so the ingest loop has nothing to read (Phase 01 is parked, ADR-1115). It is written now because
the phase spec is explicit that the runbook line matters as much as the code — a ritual invented
later, under time pressure, is where a range gets mis-set.

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
- **This cycle cannot earn an L2 promotion.** The bar is 20 unedited approvals and ten articles
  yields at most 10 (ADR-1107).
- **The A/B slot produces no verdict.** Five articles per arm against evolve's ~1,900-per-arm floor
  is a collectable stream and nothing more. Anyone reading a CTR difference between the arms during
  this cycle is reading noise (ADR-1106).
