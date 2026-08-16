# Phase 04 — exit criteria, checked against the spec

| # | Criterion | Verdict | Evidence |
|---|---|---|---|
| 1 | `arc growth publish <slug>` writes a branch and a PR, captures the preview URL, **no merge path, no default-branch push path** | **MET** | the command assembles the pack and prints the exact branch/PR commands; it spawns nothing itself |
| 2 | The guard is a **parse of the module graph, never a grep** | **MET** | `guard.mjs` tokenises first (comments and string literals blanked), walks local imports transitively, handles static/bare/dynamic/`require`, and FLAGS a non-literal specifier rather than missing it |
| 3 | A **running mutant** attempts three escapes; all three REJECTED and **each attributable** | **MET** | three separate fixtures, three named rules — see below |
| 4 | Review pack = ONE inbox item; **missing preview URL = invalid**, not a warning | **MET** | `NO_PREVIEW_URL` is a structural refusal, at the library AND through the CLI |
| 5 | Approve → `decision.recorded` carries draft `content_sha` → human merges → `content.published` with the sha from the **site repo's** merged tree | **MECHANISM BUILT, LIVE HALF BLOCKED** | `content-sha.mjs` is the single definition both paths use, so `unedited := draft_sha == content_sha` compares one function. The merged-tree read needs arc-site PR #1 merged — the owner's, and Phase 00's open item |
| 6 | Re-publishing a slug is an **update**, not a duplicate page | **MET** — evidence corrected 2026-08-16 | `classifyPublication` returns `update` naming the superseded **event ULID** (`supersedesEventId`). **This row previously read "with the superseded sha", and that was wrong**: the spine's `supersedes` is a ULID, and after a site re-pin both receipts carry one `content_sha`, so a sha could not have identified which event it meant even had the grammar allowed it. The criterion itself was and is met — update-vs-duplicate is decided by slug — but the evidence described a mechanism that would have been refused at emit (ADR-1119) |
| 7 | Unedited counter: sha-equal increments; sha-different **neither increments nor resets** | **MET** | the asymmetry is the rule — an edited article is not evidence about the drafting, and zeroing on an edit would make the number a measure of the last article rather than of the twenty |
| 8 | Two title templates as versioned files; `sha256(slug) → arm`, **replay-identical** | **MET** | proven by invoking the **real command twice** and comparing what it printed, never a hash re-implemented in the test |
| 9 | `template_id` validated on its **VALUES**, not merely its presence | **MET** | closed set, plus a drift test deriving the list from the FILES on disk |
| 10 | **Zero `experiment.*`** emissions | **MET** | absence check with a positive control |
| 11 | GEO: Article + FAQPage JSON-LD, author entity, disclaimer footer, sitemap auto-update, `llms.txt` | **PARTIAL — see below** | generators built and tested; the sitemap auto-updates already; `llms.txt` is not deployed |

## The guard, and the design problem it had to solve

**"No merge path" cannot mean "no subprocess"** — opening a pull request requires git and gh. A
module graph can only prove a capability ABSENT, so the capability is confined instead:
`exec-allowlist.mjs` is the one module that may spawn, and the guard proves two checkable facts
rather than one vague one:

1. exactly one module in the graph can spawn, and it is the declared choke point;
2. that module's allowlists contain no merge, no default-branch push, no deploy.

**The three escapes, each refused by a named rule:**

| escape | caught by |
|---|---|
| `git merge` and `gh pr merge` | `BANNED_VERB` |
| `push origin main`, **bare `git push`**, `feat/x:main`, `--force` | `PROTECTED_BRANCH` / `UNSAFE_PUSH` |
| deploy hook | `NETWORK_CALL` + `SPAWN_OUTSIDE_CHOKE_POINT` |

**The third escape broke the first version of this guard**, and that is worth recording: a deploy
hook needs **no import at all** — `fetch` is a global — so an audit walking only import specifiers
reported a clean graph while the escape sat in plain sight. That is "grep the pattern, not the
file" in a new costume: the audit was looking at the one surface the escape did not use.

The allowlist tables are audited separately, because a mutant that adds `merge` to `GIT_ALLOWED`
changes no import and no call site and the graph walk alone would report clean.

## The amendment, routed rather than slipped in

Phase 02 shipped a test asserting the registry exposes **no `publish` verb**. ADR-1102 names
`arc growth publish <slug>` verbatim, so the assertion contradicted the decision it was written to
enforce. The banned thing is the **capability**, never the word — opening a pull request is the act
that puts a human in the loop. Banned list is now promote/merge/deploy/ship; the capability is
proven absent by the guard and its mutant, which is a far stronger control than a name check.
Written into the phase-04 spec as an amendment, and applied in **both** test files.

## Criterion 11, stated rather than ticked

Article + FAQPage JSON-LD, the author entity and the disclaimer footer are built and tested. The
sitemap already auto-updates (Astro, live at `arc.automemory.ai/sitemap-0.xml`). **`llms.txt` is
generated but not deployed to `arc-site`** — that is a second PR in a repo whose first PR is still
awaiting the owner's merge, and stacking one under it would be worse than waiting. Recorded as a
follow-up, not as done.

`llms.txt` is asserted **well-formed** and nothing else. ADR-1113 forbids it from appearing in any
exit criterion as a lever, and no test in this lane measures an effect from it. The IndexNow ping
is CUT.

## Not claimed

The live half of criterion 5 — a real merge producing a real `content.published` from the site
repo's merged tree. That is Phase 00's open item and the owner's click.
