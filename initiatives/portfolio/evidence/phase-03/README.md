# Phase 03 evidence — Docs truth + retro (REQ-05)

Cycle 4 · lane `portfolio` · closed 2026-08-02. Bundle contents:

| File | Proves |
|---|---|
| `close-state.txt` | section E — board-lint 0 WARNs, and the real zero-eligible resolver output |
| `golden-regen.txt` | section B2 — the sync golden, regenerated, with the control that validates the method |
| `ci-run.txt` | the DoD's "full bats green on 3 OS in one run, `declared == executed` on every leg" |
| this file | section A — where each of A1–A7 is satisfied, and who checked |

## Section A — the seven surfaces, and where each assertion lands

| # | File | Satisfied by |
|---|---|---|
| A1 | `docs/how-arc-works-simple.md` §1 | the per-lane law as the section's opening bold line, plus the clause naming `PORTFOLIO.md` "the index view, not the truth (ADR-0051)" and the derive-from-`PROGRESS.md` / lane-files-win rule |
| A2 | `docs/how-arc-works-simple.md` §3 | the folder tree showing `initiatives/<lane>/` with `PLAN.md` · `PROGRESS.md` · `phases/`, and `docs/evidence/**` + `docs/archive/**` marked FROZEN with the link-never-copy rule (ADR-0055, ADR-0058) |
| A3 | `docs/how-arc-works-simple.md` §8 | the four-level truth hierarchy in `PORTFOLIO.md`'s own wording, plus the locked four-term vocabulary table (lane · module · company layer · venture) |
| A4 | `docs/usermanual.md` §9a | one new section in the manual's Tanglish register: `--lane` as the only way to name a lane, bare tokens never lanes, the four-row resolution order, exit codes, creation rights, and the truth hierarchy |
| A5 | `docs/strategy/plans/README.md` | the ritual is now five steps, step 3 being "state the lane"; the opening blurb matches |
| A6 | `docs/templates/adr-template.md` | one line, `**Product:**`, placed between `Date:` and `Reversibility:` (ADR-0053) |
| A7 | `CLAUDE.md` | `[--lane <name>]` on exactly the five commands that take it — membership derived from `grep -rl -- '--lane' .claude/commands/`, not from the brief — plus the per-lane One Rule in Build process. 140 → 151 lines, inside the ~200 budget |

## How this was checked, and why that matters here

The five files were written by five agents in parallel from one canonical block, then read
back by **three independent agents that did not write them**, each holding the file against
the spec's assertion table and required to quote the satisfying line with its number rather
than summarise it. Every finding was then confirmed by hand before anything was changed.

That separation earned its cost. All three verifiers independently reported the same defect
none of the five writers could see: **rewriting §1/§3/§8 left `how-arc-works-simple.md`
contradicting itself.** §5 still routed `/arc-phase-done` evidence to `docs/evidence/` — the
path §3 now marks frozen — and still stated phases "always live at root `phases/`", a flat
negation of the new §8 rule 2; §2's PRESENT row and §7's read order still taught the
root-only law; and `docs/usermanual.md:111` still placed the tracker at the root behind a
cross-reference pointing at the wrong section.

Six line-level repairs followed, deliberately and outside the sections REQ-05 names. The
phase's Rabbit hole forbids *rewriting* docs beyond those sections; these are corrections to
contradictions this phase's own edits created, and a docs-truth phase that ships a
self-contradicting orientation page has failed its own goal. The alternative — filing them as
follow-up — would have left the repo's orientation page teaching two incompatible laws for
however long Cycle 5 takes to start.

**The generalisable finding, logged to `docs/retro-log.md`:** the author of a rewritten
section is structurally blind to the sections that cite it. The check has to be a different
reader or a whole-document search for the superseded claim — never the author.

## What this bundle does not prove

- The 52 adversarial findings from Phase 02 still carry an agent's verdict rather than a
  confirmed one. Nothing here re-verifies them; they carry into Cycle 5 as named work.
- `A4` (advisory-only WIP is enough at solo scale) is recorded NOT FIRED, but its trigger
  needs counted lanes above 2 and this repo counted 1 all cycle. The retro was its designated
  test venue and could only record that it could not test it. Untested, not validated.
