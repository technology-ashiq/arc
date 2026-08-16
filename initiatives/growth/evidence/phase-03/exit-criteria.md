# Phase 03 — exit criteria, checked against the spec

| # | Criterion | Verdict | Evidence |
|---|---|---|---|
| 1 | Exemplars exist: 2–3 machine-drafted candidates, ONE inbox item, owner-approved, versioned | **BUILT, APPROVAL OUTSTANDING** | 3 exemplars in `initiatives/growth/exemplars/`; inbox item `01KZZRVSQJEAVD4YCZ8FDXR0DT` raised and verified on the spine. **The approval is the owner's and has not been given** — recorded as outstanding, not ticked |
| 2 | `seo-article-writer` upgraded, prescriptive body removed | **MET** | the v0 body was 857 bytes of structure prescription ("the same deterministic structure every time", "5–8 H2s"); all of it is gone, the name and interface survive (ADR-1110) |
| 3 | Prompt assembly takes the approved exemplar files as its **only** style input | **MET** | `assemblePrompt` + `assertNoStylePrescription` over the authored template; a mutant carrying "5-8 H2s" is refused |
| 4 | MDX frontmatter `{title, meta, slug, cluster_id, template_id, citations[]}`; internal links only from the approved cluster | **MET** | `renderMdx`; `citations[]` is **derived from the body**, never accepted from a caller; link targets come from the approved cluster rows only |
| 5 | slop-lint v1 — negative-only, versioned marker list, never reports absence, never scores | **MET** | 18 markers in `slop-markers.json`; the suite **derives the id list from the file**, so a marker added without a fixture turns it red |
| 6 | citation-lint — claim-of-fact tagging + link-alive; dead link = WARN | **MET** | uncited claim = FAIL, dead link = WARN, unchecked = its own state |
| 7 | The POV floor is a review-pack checklist line, human-judged, never a regex | **MET** | printed by `lint` and carried in the review pack; no test in this lane measures it |
| 8 | **Adversarial pass — two fresh surfaces**, holes fixed and pinned | **MET, and it is the reason this diff looks as it does** | see below |

## The adversarial pass

Two fresh agents, different surfaces, neither having seen the implementation, each carrying the
lane's running defect list. **35 executed holes** — not hypothesised.

**Two CRITICALs, and they were the same defect twice:**

1. `citation-lint` did **no Unicode folding at all** while `slop-lint`, one directory over, did. A
   zero-width space inside `40%` or `according to` made every figure and attribution invisible to
   the only function enforcing E3's truth law.
2. `slop-lint` matched per **physical line**, so any listed phrase straddling an ordinary markdown
   soft wrap was missed. The same paragraph wrapped at 72/80/100 columns produced 15/15/14 findings
   against 16 unwrapped — **whether the gate went red was decided by the writer's editor.**

Together they shipped an article carrying **21 markers and 5 fabricated figures at exit 0**.

The fix was not twenty patches. `lib/text.mjs` is now the one text layer — folding, blocks, link
extraction — and all three consumers read it. A shared *list of rules* failed to stop the twin-fix
pattern three times in two days; one shared *implementation* leaves no twin to forget.

**Also closed, each pinned as a fixture:** the arg parser skipped every non-`--` token, so
`lint --file *.md` linted the first path, silently dropped the rest and exited 0 clean (and
`-offline` was dropped the same way, sending the run online) · the E2 no-publishing-verb guard was
a grep that a one-line `COMMANDS.publish = fn` mutant walked past · `--out a.mdx:hidden` opened an
NTFS alternate data stream, leaving a zero-byte article at the named path while printing "rendered"
· the prescription control bricked legitimate keywords like `seo faq schema` while missing real
drift under soft hyphens · `bodyLinks` and `linksIn` disagreed about what a link is, so a body cited
entirely with bare URLs passed the citation gate and rendered with `citations: []` · a 500-sentence
guard dropped the tail of a long line without a word · an empty article was reported "scanned clean".

Every breaking input was re-run against the fix: **48 checks, 0 failures.**

## The honest limit, which is the point of the fixture

`tests/fixtures/growth/honest-limit.md` is characterless writing that **passes both lints**. It is
committed so the gate's limits live in the suite rather than in someone's memory. If either lint
ever starts failing it, someone has added a prescriptive rule and the gate got worse, not better.

## Corrected during this phase

The kickoff verification plan said *"a claim without a link WARNs"*. That contradicts REQ-02 and
ADR-1111, which make the source link an **E3 law** — and a law enforced at WARN is not enforced.
Built behaviour is FAIL for an uncited claim, WARN for a dead link, which is the only distinction
ADR-1110 actually draws.

## Not claimed

Owner approval of the exemplars. The inbox item exists; the decision does not.
