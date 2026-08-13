# Phase 00 — Contract + the road + steel thread

**Goal (one line):** publishing exists as law, the site exists at all, and one real article travels
the entire path end-to-end on a preview URL — behind three owner account actions and no more.
**Appetite:** 2.0 days — blown appetite = cut scope or kill, never extend silently.
**Depends on:** none

Serves **REQ-00** (publishing exists on the spine) and **REQ-10** (the site exists and serves one
real article). This is the walking skeleton: input → core flow → output → deployed. It is
deliberately the largest phase, because ADR-1103 folded the road into it.

## Exit criteria (Definition of Done)

**The contract**
1. `content.published` added to `KINDS` (44 → 45) in `.claude/scripts/hq/lib/validate.mjs`, as
   `...CONTENT_KINDS` spread beside `...LEADS_KINDS`, with the transition recorded in a comment the
   way `ADR-0310` and `ADR-0508` record theirs. **ADR-0107's derived-count rule, in one line:** any
   count a validator *prints* is derived from `KINDS.length` at runtime and never hand-typed — a
   literal `18` in an error message went stale the moment the next kind landed.
2. **`assertContent` lives in a NEW file, `.claude/scripts/hq/lib/validate-content.mjs`**, mirroring
   `validate-leads.mjs`: it exports `CONTENT_KINDS`, `assertContent(event)` and `contentIdem(kind, p)`,
   and is dispatched from `validate.mjs` exactly as `assertLeads` is. It is a new file rather than an
   addition to `validate.mjs` because that file is a company organ three other LIVE lanes are editing
   this week, and a new module collides only on the one `KINDS` line.
   Closed key set `{site, slug, url, title, template_id, cluster_id, content_sha, pr_ref}`; an unknown
   payload key **throws** a `SpineError`, it is never ignored.
3. Idem implemented as a **total preimage over every identity-bearing field** — `site`, `slug`,
   `content_sha`, `title`, `template_id`, `cluster_id`, `url` — and deliberately NOT `pr_ref`, which
   stamps our process rather than the publication. Under a `site+slug+content_sha` preimage a
   metadata-only correction (a wrong `template_id`, an unchanged body) would collide and be dropped
   as DUP_IDEM: the exact ~100-receipt loss class of C2. `slug` and `site` grammars **exclude the
   join delimiter**, so no field value can forge one.
   **`content_sha` is lowercase-hex `sha256` over the raw bytes of the published `.mdx` file** as it
   exists in the site repo's merged tree — **not** a git blob sha (which prefixes a header), and
   **not** the rendered HTML (which changes whenever the layout does, so an unedited article would
   appear edited and the REQ-03 unedited counter would silently stop counting).
4. **No `hq.policy.yaml` row is added, and none is needed** (ADR-1101): POL-I governs authorization
   *subjects* (`session:*`, `process:*`), and a spine event kind is not one. What this criterion
   asserts instead is that **growth is not a policy bypass** — `arc growth publish` runs under
   `session:interactive`'s existing ceiling and introduces no subject of its own.
5. `products/growth/manifest.json` created with the same shape as `products/core/manifest.json` —
   `{name, version, commands[], agents[], scripts[]}`, each array holding repo-relative paths that
   must exist — and `node .claude/scripts/core/product-lint.mjs` exits 0 against it.

**The road**
6. `arc-site` repository created: Astro, MDX, static output, `/blog/<slug>` renders.
7. Deploy provider behind the ADR-1104 interface: `deploy preview <dir> → {url}`, with the local
   static-server **fake** used by every test. No `promote` verb exists in the interface.
8. `sitemap.xml` generated at build.

**The thread**
9. `initiatives/growth/templates/title-a.md` is created here, not in Phase 4. Phase 4 adds
   `title-b` and the `hash(slug)` assignment; Phase 0 needs `title-a` to exist so the steel thread's
   `template_id` is a **real value that survives REQ-04's closed-set check**, not a sentinel that
   would have to be superseded later.
10. **One real article** — hand-written for this phase, not generated — goes: branch → PR → preview
    URL → human merge → `content.published` emitted with `content_sha` read from the **site repo's**
    merged tree. Its three otherwise-unsourceable payload values are fixed here:
    - `template_id: "title-a"` — real from criterion 9.
    - `cluster_id: "c-000"` — a **reserved literal for pre-cluster content**. REQ-01's cluster check
      accepts it and the miner never mints it, so no real cluster can collide with it.
    - `site` — the preview host. It is legitimately not the permanent one yet; Phase 1 corrects it
      **by `supersedes`** (REQ-11), which is the specified path, not a workaround.
11. That receipt is **verified present in `events/` and absent from `events/_quarantine/`.**

## Verification plan

**Test command:** `bats tests/growth-vocabulary.bats tests/growth-publish-thread.bats`

**Expected failure first:** `tests/growth-vocabulary.bats` case
`"content.published is rejected as UNKNOWN_KIND before the ADR-1101 edit lands"` must be **RED
before the `KINDS` edit and GREEN after** — and its inverse, `"an unknown payload key exits 2"`,
must be **RED until `assertContent` exists**. Both are written and run before the implementation.
This ordering is the phase's negative control: `retro-log.md:36` records an emitter that exited 0
while every receipt was silently quarantined, so a suite that is green from the start proves the
test never ran, not that the kind works.

**Fixtures that must be green (hostile corpus, inheriting the C2 shapes):**

| Fixture | Asserts |
|---|---|
| `unknown-kind-pre-adr` | emitting `content.published` before the KINDS edit lands it in `_quarantine/` with `UNKNOWN_KIND` — **and the emitter's exit code is captured**, so the "exit 0 while quarantined" failure is observed rather than assumed |
| `unknown-payload-field` | an extra key → exit 2, naming the key and the closed set |
| `same-content-republish` | identical bytes twice → **one** receipt; the second is a DUP_IDEM no-op |
| `changed-content-supersedes` | edited article → a **new** receipt whose `supersedes` names the first; the first is byte-identical on disk afterwards |
| `missing-required-key` | each of the eight keys omitted in turn → eight distinct refusals |
| `crlf-and-oversize` | a payload string carrying `\r` is REJECTED — `CR` is a C0 control character and `validate.mjs` refuses control characters by code point rather than normalizing them, because normalizing is how a validator becomes a suggestion. An event whose canonical form exceeds **`MAX_EVENT_BYTES` = 64 KiB** (`canonical.mjs:26`) is refused, as is one nested past **`MAX_DEPTH` = 64** (`:31`) — the depth ceiling exists because without it "is this valid?" is answered by the V8 stack size and the same input passed on one runner and crashed on another |
| `metadata-only-correction` | a wrong `template_id` fixed with the body unchanged produces a **NEW** receipt with a different idem and a `supersedes` link — never a DUP_IDEM drop |
| `delimiter-forgery` | `site="a\|b", slug="c"` and `site="a", slug="b\|c"` must NOT hash identically; the grammars refuse the delimiter outright |
| `sha-from-site-repo` | `content_sha` equals the sha of the file in the **site** repo's merged tree, and **not** any file in the arc repo |
| `no-policy-bypass` | `node .claude/scripts/hq/policy-lint.mjs` exits 0 on the tree after this phase — growth added no subject — **and** a mutant that adds `processes/growth-publish.process.yaml` without an `hq.policy.yaml` row is REJECTED by `kickoff-lint`'s `[birth-rule]`, proving the rule still bites the case it actually governs |

**Live proof (not a fixture):** the preview URL is opened and the article is confirmed to render.
An agent's report about a page is not the page — the artifact is looked at before its verdict is
carried.

**Emit verification:** after the real emit, `events/` **and** `events/_quarantine/` are both listed
and the receipt located by id. Exit 0 from the emitter is not evidence that anything was written.

## Rabbit holes in this phase

Designing the site's visual identity (that is REQ-06, Phase 4 — this phase ships unstyled HTML
that renders) · a general MDX component library · perfecting the sitemap before there are three
pages · building the deploy interface's `promote` verb because symmetry feels right (ADR-1102
forbids it existing at all) · moving `metric.observed`'s validator out of `validate-leads.mjs`.

## Out of scope for this phase

Any keyword mining · any generation · any lint · the domain and the Search Console property
(Phase 1) · A/B templates · the brand kit · anything touching metrics.

## Your-setup / pending

- **Entry gate (owner, account actions):** create the `arc-site` repository, protect its default
  branch, and authorize **Vercel** against it. Vercel is the root `CLAUDE.md` deploy target and it
  gives a preview URL per pull request natively — which is the one feature the review pack cannot do
  without (REQ-03). The adapter still sits behind ADR-1104's interface, so the host is replaceable;
  naming it here removes the guess, it does not weld it on. These are this phase's entry gate — the earlier claim that
  Phase 0 needs "zero owner keystrokes" was false, and the deploy host is needed **here**, not at
  Phase 1, because this phase's own exit proof runs against it.
- If the gate is unmet, the fake deploy provider carries every test and criterion 9 moves to Phase
  1's entry — recorded as a **named deferral**, never dropped.
- No DNS, no domain purchase and no Search Console access is needed here. That is Phase 1.

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
