# Phase 00 — exit criteria, checked against the spec

**CLOSED 2026-08-17**, when the owner merged arc-site #2 and #3 and the steel thread finally ran
end to end. The phase had been open since 2026-08-12 — not because anything was unbuilt, but
because criterion 10 needs a human merge (E2) and the deploy provider had to be connected first.

## The criteria

### The contract

| # | Criterion | Verdict | Evidence |
|---|---|---|---|
| 1 | `content.published` added to `KINDS`, transition recorded, counts derived not hand-typed | **MET** | `validate.mjs`; the UNKNOWN_KIND message derives from `KINDS.length` (pinned in `growth-vocabulary.bats`) |
| 2 | `assertContent` in a NEW `validate-content.mjs`, closed key set, unknown key throws | **MET** | New module, so it collides with three other live lanes on one `KINDS` line rather than on a function body |
| 3 | Idem = total preimage over every identity-bearing field, `pr_ref` excluded, delimiter unforgeable | **MET** | And hardened twice since: a lone-surrogate collision (ADR-1119) and the invisible-character class (ADR-1120) |
| 4 | No `hq.policy.yaml` row, and growth is not a policy bypass | **MET** | ADR-1101; matches memory (ADR-0703) and bench (ADR-0912) |
| 5 | `products/growth/manifest.json` created, `product-lint` exits 0 | **MET** | And it caught two unmapped files this cycle — a synced script belonging to no product |

### The road

| # | Criterion | Verdict | Evidence |
|---|---|---|---|
| 6 | `arc-site` created: Astro, MDX, static, `/blog/<slug>` renders | **MET** | Both articles serve 200 at `arc.automemory.ai` |
| 7 | Deploy provider behind the ADR-1104 interface, fake used by tests, no `promote` verb | **MET** | `lib/deploy.mjs` |
| 8 | `sitemap.xml` generated at build | **MET** | Astro emits `sitemap-index.xml` + `sitemap-0.xml`; `/sitemap.xml` serves via a 308 (Phase 01 criterion 6) |

### The thread

| # | Criterion | Verdict | Evidence |
|---|---|---|---|
| 9 | `templates/title-a.md` exists here, so `template_id` is a real value | **MET** | `initiatives/growth/templates/title-a.md` |
| 10 | **One real article travels branch → PR → preview URL → human merge → `content.published`** | **MET 2026-08-17** | See below |
| 11 | That receipt verified present in `events/` and absent from `_quarantine/` | **MET** | See below |

## The steel thread, run for real

```
receipt id : 01M05XS2B71NNXNE5ADRAR7CRT
kind       : content.published
site       : arc.automemory.ai
url        : https://arc.automemory.ai/blog/the-author-cannot-be-the-attacker/
content_sha : 72dec45f86725ccb...  (sha256 of the raw .mdx bytes in the MERGED tree)
pr_ref     : #2
supersedes : null
present in events/2026-08-17.jsonl : yes
present in _quarantine/            : no
```

Every leg of the path was exercised: branch → arc-site PR #2 → Vercel preview build → **the owner's
merge** → receipt emitted from the main clone. Not one step simulated.

**`content_sha` was cross-checked against an independent hasher** (`sha256sum`) and agreed
byte-for-byte, which is what confirms the value is a plain sha256 of raw bytes rather than anything
git-flavoured. The merged file carries **0 CR bytes**, so the `.gitattributes` LF pin added this
cycle is holding — before it, this hash differed between a Windows checkout and the Linux build
host.

**The receipt carries the PERMANENT host, not the preview host.** Criterion 10 as written says the
preview host, with Phase 01 correcting it by `supersedes`. That was written when no domain existed.
One does, and the article is served at `arc.automemory.ai` — so naming the preview host would have
meant writing down something untrue purely to give Phase 01 criterion 5 something to correct. E3
answers that. Phase 01 criterion 5 therefore closes as NOT APPLICABLE, recorded in its own bundle.

## A real gap found by this phase's own tooling, on its first production use

`checkSitemapCoverage` (built in Phase 01) was run against the live sitemap and the spine. It
reported:

```
extra: ["receipts-driven-os"]
```

**The first article is live and indexable right now and has no receipt.** It was pushed directly in
the arc-site skeleton commit `90517b7` — verified against the GitHub API: **no PR was ever opened
for it**. So a `content.published` receipt for it cannot honestly carry `pr_ref`, which the closed
key set requires and which the grammar constrains to `#<number>`. **A receipt was not fabricated.**

The operational consequence, stated because it is easy to miss: `resolveSlugUrl` joins Search
Console rows to the receipt that heads a supersede chain, so **every click that article earns will
be reported UNJOINED and will never reach the EVO-H0 feed.** That is the loud failure rather than
the silent one — it prints per row — but it is still one of two live articles contributing nothing
to the metric that wakes evolve.

Three honest ways out, none taken here because this is the owner's call:

1. **Re-publish it through the path.** A trivial PR touching the article gives it a real `pr_ref`,
   after which the receipt is honest. Costs one merge click.
2. **Make `pr_ref` nullable for pre-publish-path content**, via its own ADR. A vocabulary change to
   a closed key set on a company organ.
3. **Accept the gap** and record that arc's own site has one page the spine does not know about —
   which is a strange thing for a project whose subject is receipts.

## What this phase cost, honestly

Opened 2026-08-12, closed 2026-08-17. The build was finished on day one of that span; the rest was
owner-gated (repo creation, branch protection, Vercel authorization, Vercel↔Git connect, and the
final merge). The 2026-08-14 tracker recorded three of those as still-blocking after they were
already done, which is its own lesson and is corrected in `PROGRESS.md`.
