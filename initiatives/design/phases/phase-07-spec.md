# Phase 07 — rival integration

**Goal (one line):** rival drafts enter the same blind jury as arc's variants, rendered by arc's
own renderer and unlabelled — and whichever way it lands, the result is a receipt.
**Appetite:** 2 days — blown appetite = cut scope or kill, never extend silently
**Depends on:** phase-06
**Implements:** ADR-1409 · ADR-1410

## Exit criteria (Definition of Done)

- [x] Rival adapter follows the engine lane's driver/adapter pattern
      ([ADR-0200..0206](../../../docs/adr/)) — no new pattern class is invented
- [x] Same brief → one draft per rival → **arc's own renderer** → unlabelled items in one jury
- [x] One blind jury over **arc×3 + ≥1 rival + 1 reference item**, all items indistinguishable
      by filename, ordering or metadata
- [x] Seeded shuffle applied; jurors know nothing of authorship, thesis or item kind
- [x] Standing control in place: a plain-prompt item enters every 3rd run
- [x] **rival-beats-all-arc rate recorded on the spine whichever way it lands.** If a rival
      outranks every arc variant, that fact is receipted — the embarrassment is the point
- [x] A rival win **never becomes a copy**: the director assigns a NEW thesis capturing the
      winning direction, and an arc-authored candidate re-enters critique → jury
- [x] The run degrades to arc-only with a printed source-status line if a provider fails
      mid-cycle — never a silent three-item jury. **Added 2026-10-07 (Phase 06 amendment):** a
      fake-transport test drives Stitch's observed bad-key shape (`UNKNOWN_ERROR` + `isError`)
      and a synthetic rate-limit and quota answer through the adapter, since none of the last two
      was observed live
- [x] The rival draft is vendored at fetch time per
      [ADR-1422](../../../docs/adr/1422-a-rival-draft-is-vendored-at-fetch-and-the-transform-is-declared.md),
      and the composer seat it competes against stays balanced-workhorse per
      [ADR-1421](../../../docs/adr/1421-exp-a1-composer-seat-stays-balanced-workhorse-inside-the-new-regime.md)
- [x] Provenance recorded on every render, so Phase 08's packager can refuse non-arc items
- [x] Two-surface adversarial pass by fresh agents on the blinding mechanism and the
      rival-beats-all-arc recorder — decision logic on the ranking path, shell/OS boundary on
      file naming and directory ordering. The single-agent blind-identification check in the
      verification plan is **not** a substitute for it
- [x] tests added & green **on CI, read per JOB at the branch head SHA**
- [x] live demo run + output checked — the owner opens the renders himself
- [x] contract tests green against the real rival implementation
- [x] tracker updated (PROGRESS.md row ✅ + done-log)

## Verification plan

Refined 2026-10-07 via `/arc-change`. One rival (Stitch, cleared in Phase 06). Five slices, each
red-first on CI; the adapter and the jury change are new code, the rest is a run:

- **S1 -- the Stitch adapter, fake first.** `design-rival.mjs` implements PLAN's
  `rival_draft(brief) -> {html, version}` on the driver/adapter split of ADR-0203: a pure
  function maps the brief to a request and an answer to a result; one transport does I/O. The fake
  transport replays the Phase 06 screen fixture. **Failure test (owed by the Phase 06 amendment):**
  the observed bad-key shape (`UNKNOWN_ERROR` + JSON-RPC `isError`), a synthetic rate-limit and a
  synthetic quota answer each become one printed `rival stitch: COULD-NOT-DRAFT (<reason>)` line,
  never a crash and never a silent skip. A missing `STITCH_API_KEY` is the same line, reason
  `no key`. The key is read through `keys.mjs`, never printed, never in argv.
- **S2 -- the real transport.** `@google/stitch-sdk@0.3.5` pinned after `npm view`, installed once
  into a private directory under `.claude/state/design/` (the shadcn pattern from Phase 05: no
  `npx`, no repo `package.json` change, nothing committed). Contract check against the real
  service: one generate on the LexOS brief returns HTML whose schema matches the Phase 06 receipt.
- **S3 -- vendoring at fetch (ADR-1422).** The adapter downloads every remote asset the draft
  names, from the three allow-listed hosts only, https only, byte-capped, sha256 recorded, and
  rewrites only `src`/`href` targets; the markup diff is recorded. Any other host is left
  unresolved and NAMED, and that draft leaves the jury. Proved on the fake by a draft naming a
  fourth host; proved for real by the offline render hashing the same as the open one (the check
  Phase 06 failed). Vendored copies live under `.claude/state/`, never in git.
- **S4 -- the rival enters the jury blind.** `design-jury.mjs` gains `--rival <path>`: the item is
  rendered by arc's own renderer from the vendored copy, joins the seeded shuffle under the same
  opaque item naming as every variant, and its kind is written only to the sealed key, never to the
  juror's input. Provenance (`arc` / `rival:stitch@<version>` / `reference`) is recorded on every
  render for Phase 08's packager. After `unblind`, **rival-beats-all-arc** is computed and written
  to the spine either way, on an existing kind (`note.logged`, the one the owner score already rides, payload `rival-beats-all-arc`
  with the owner and jury results); the spine's closed kind list is not extended. A provider failure mid-cycle prints the
  status line and runs arc-only. A win routes to the director for a NEW thesis, never a copy.
- **S5 -- the live run.** One LexOS explore: arc x3 + Stitch + 1 pack reference (+ the plain-prompt
  control when the run is every 3rd), N=7 jury, the owner opens every render himself, then
  `unblind` and the rival rate receipted.

**Blindness gate:** after S4, a fresh agent is given only the juror's input directory and asked
which item is the rival; if it names it from filenames, ordering, metadata or EXIF, the phase does
not close. (Pixel style is the thing judged and is not a leak.) Two fresh attackers (logic on the
ranking path and the rate recorder, boundary on file naming, ordering and the vendoring fetch) run
on the S3+S4 PR.

The coarse plan this replaces: Blindness is proved adversarially: a
fresh agent is given the jury's input directory and asked to identify which item is the rival —
if it can, from filenames, ordering, metadata or markup fingerprints, the blinding has failed and
the phase does not close. Degradation is proved by running with the provider's key removed and
asserting a printed status line plus an arc-only jury, not a silent one.

## Rabbit holes in this phase

- **Merging or adapting the winning rival's markup.** Detour: new thesis, arc rebuilds. A copy
  is slop with extra steps and legal risk.
- **Quietly dropping the rival when it wins.** Detour: the rate is recorded either way; that is
  the whole reason the bar exists.
- **Blinding by filename alone.** Markup fingerprints leak authorship too. Detour: the
  adversarial identification test is the gate.

## Out of scope for this phase

The packager and its arc-only lint (Phase 08) · a second rival if the first has not cleared
terms · any outbound blind package.

## Your-setup / pending

Credentials for the cleared provider. If terms clearance was refused in Phase 06, this phase
runs with reference + plain-prompt control only, and REQ-09 is scope-cut rather than faked.

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
