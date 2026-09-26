# Phase 02 — registry + curator

**Goal (one line):** one owner-born, lint-guarded `design.sources.yaml` exists, and a
`design-curator` agent builds a per-brief reference pack of real screens whose images stay out
of git and whose provenance goes in.
**Appetite:** 1.5 days — blown appetite = cut scope or kill, never extend silently
**Depends on:** phase-00
**Implements:** ADR-1404 · ADR-1408 · ADR-1412 · ADR-1414

## Exit criteria (Definition of Done)

- [ ] `design.sources.yaml` exists with the grammar of
      [ADR-1408](../../../docs/adr/1408-dsv-i-one-source-registry-owner-born-lint-guarded.md):
      `id` · `kind[]` · `access` · `allowed_use[]` · `auth` · optional `credential_ref` · `cost`
      · `status` · `availability` · `approved_by` · `added`. Arrays are arrays
- [ ] Initial rows match [ADR-1412](../../../docs/adr/1412-gallery-eligibility-is-decided-by-robots-and-terms-not-by-taste.md)
      exactly: Lapa Ninja + SaaSFrame `active`; Awwwards `link-only`; Godly, Dribbble, Behance,
      Land-book, Page Collective `off`
- [ ] Registry lint exits 0 on the real file, and **fails** on: a singular `kind`, an unknown
      `access`, a hand-set `availability`, and an entry added by anyone but the owner
- [ ] `design-curator` agent exists at **balanced-workhorse** per
      [ADR-1414](../../../docs/adr/1414-the-curator-sits-at-balanced-workhorse-and-one-juror-at-high-judgment.md),
      shipped as a reviewed diff citing ADR-0069
- [ ] Per [ADR-1420](../../../docs/adr/1420-the-curator-bash-and-webfetch-are-bounded-by-the-composer-boundary-hook.md),
      the curator holds `Read, Grep, Glob, WebFetch, Bash`, bounded in `composer-bash-check.sh`:
      its Bash runs only `design-refpack.mjs` with its own flags, and its WebFetch runs only on
      an `active` registry row's host with `design-robots.mjs` answering ALLOW inside a 40 s cap.
      Red-first on CI, through the real dispatcher: a curator `cat` and a curator `refpack … ;
      rm` refused, a well-formed refpack call allowed, a WebFetch to an off-registry host and to
      a DISALLOW path refused, one to an allowed gallery path allowed, and the main session and
      `ui-composer` unchanged. *(`/arc-change` 2026-09-26, owner "Hook-la scope")*
- [ ] Curator performs a **robots.txt preflight per fetch** and refuses on `Disallow` — the
      refusal is recorded, never a silent skip
- [ ] A real pack of 5–8 screens exists for one brief at
      `.claude/state/design/refpacks/<brief>/`, from ≥2 `active` sources
- [ ] `sources.md` committed with URL · timestamp · content sha · **adaptable principle** ·
      avoid-this — one row per screen
- [ ] A PNG planted in the refpack dir is proven ignored by `git check-ignore` — asserted, not
      assumed from the gitignore's text
- [ ] An explore output under `docs/design/explore/lexos-*/` (HTML and PNG) is proven ignored
      by `git check-ignore -v`, naming the `.gitignore` rule that did it. This enforces the
      owner's 2026-09-16 ruling that LexOS evidence is committed as text only, instead of
      relying on nobody running `git add -A`. The same case runs two negative controls, and
      both must NOT be ignored: a non-LexOS explore path, and a trailing-slash nonsense path.
      The second pins the #228 regression, a UTF-16 line that made every trailing-slash path
      read as ignored. The rule does not untrack the four `lexos-case-workspace-*` dirs
      committed before the ruling. *(`/arc-change` 2026-09-18)*
- [ ] Carried from Phase 01, per [ADR-1419](../../../docs/adr/1419-the-composer-read-and-write-boundaries-bind-only-a-ui-composer-caller.md):
      the composer read and write checks enforce only for `agent_type` `ui-composer`, using the
      Bash check's identity parser. Red-first on CI, four cases: the main session reads and writes
      a sibling while a marker is armed (allowed), a composer reads and writes a sibling (refused),
      a payload naming `ui-composer` with an unreadable identity (refused), and two armed markers
      refuse a composer only. Composition stays serial. *(`/arc-change` 2026-09-26)*
- [ ] A source with `status: off` produces **zero** fetch attempts
- [ ] Two-surface adversarial pass by fresh agents on the registry lint and the preflight
- [ ] tests added & green **on CI, read per JOB at the branch head SHA**
- [ ] live demo run + output checked
- [ ] contract tests green against the gallery fakes
- [ ] tracker updated (PROGRESS.md row ✅ + done-log)

## Verification plan

Coarse — refined via `/arc-change` when the phase starts. Registry lint proved by a mutant
registry per invalid-field class; curator proved by one real pack built against the two `active`
galleries with a robots.txt refusal exercised on a third; "no images in git" proved by planting
a PNG and asserting `git check-ignore` resolves it, and by `git status --porcelain` staying
empty. The adaptable-principle column is read by a human on at least two rows — a principle that
describes appearance rather than a transferable idea fails the phase.

## Rabbit holes in this phase

- **Making the blocked galleries work.** Godly, Dribbble, Behance and Land-book are the
  prettiest and all are excluded on permission grounds. Detour: two sources, ship, move on.
- **Building a scraper framework.** Detour: one fetch interface, one preflight, two adapters.
- **Treating the gitignore as proof.** Detour: plant the file and assert the ignore.

## Out of scope for this phase

Live MCP wiring and per-run availability lines (Phase 05) · pack-anchored BELOW-BAR (Phase 03) ·
Mobbin, Figma and any paid or login source · 21st.dev's credit-gated `generate` mode.

## Your-setup / pending

Nothing blocking. No credential is needed for the two `active` galleries.

## Non-negotiables (verbatim from PLAN)

- **Look at the artifact before carrying its verdict.** No ranking, score, receipt or package
  is produced from a report about pixels that nobody in the session opened.
- **Zero new spine event kinds.** This cycle rides `review.completed {lens:design}`,
  `decision.recorded` and `note.logged` only.
- **Agents judge, scripts measure — ADR-0048.** A gate never asks an agent for a number it
  can compute.
- **Every new gate, lint and parser gets a two-surface adversarial pass by fresh agents that
  did not write it** — one on decision logic, one on the shell/OS boundary — and that pass runs
  against the PR THAT SHIPS THE GATE, never batched into the phase-close PR that comes after
  all of them. The attacker prompt carries this lane's running list of already-fixed defects.
- **A test that passes proves the assertion held, not that the code ran.** Every gate ships with
  a negative control that actually fails.
- **No reference image, rival draft or third-party screenshot is ever committed to git or
  placed in an outbound package.**
- **A `model:` frontmatter change is a governed tier change** citing ADR-0069 in a reviewed
  diff, never a quiet edit.
- **Shared organs are edited under the shared-file protocol.** Agent contracts under
  `.claude/agents/`, `.mcp.json`, `hq.policy.yaml` and `tests/**` belong to no lane:
  `git log origin/main -5` on the file runs BEFORE the edit, the stronger version is taken at
  merge, and a change to a contract another LIVE lane reads gets a cross-lane note first.
- **Closing a phase moves the lane's bookkeeping in the same commit as the merge, or the one
  right after it.** PROGRESS.md's row, its `## Now`, and `docs/HISTORY.md` move together — a
  lane whose HISTORY says CLOSED while PROGRESS still says LIVE is a failure, not a follow-up.
- **Tests are green on CI, per JOB, at the branch head SHA** — never on this box.
