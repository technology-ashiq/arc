# Phase 03 — Docs truth + retro

**Goal (one line):** Flip the docs last, same cycle (REQ-05): One Rule rewritten to per-lane law quoting PORTFOLIO.md as the index view (ADR-0051), vocabulary table + truth hierarchy into how-arc-works-simple §1/§3/§8 + usermanual + plans/README ritual, ADR template gains a one-line `Product:` field (ADR-0053), HISTORY entry logged, `/arc-retro` run.

**Appetite:** 0.25 days
**Depends on:** phase-02

## Verification plan

**REFINED 2026-08-01** via `/arc-change`, before any docs edit — the coarse line below the
fold said "refined when the phase starts", and this is that. Owner-decided the same day:
Phase 03 runs **as specified** (0.25d, docs + retro, no code), and RI-1/RI-2 are triaged
**by** the retro into the next cycle rather than absorbed here. Every item is a check that
either passes or the phase does not close. No local runs — CI is the gate.

> Superseded coarse line, kept so the change is legible: *"`/arc-docs` drift gate passes
> with 0 findings; retro run; board shows portfolio IDLE with a `last:` note and develop
> kickoff as the queued next."*

**One correction the refine had to make before anything else.** That coarse line asks the
board to show **develop as the queued next**, and [ADR-0061](../../../docs/adr/0061-board-indexes-born-lanes-only.md)
— accepted 2026-08-01, *after* this spec was written — forbids it: the Active initiatives
table holds a row **iff** `initiatives/<lane>/` exists, and the named alternative (a
`Queued next:` fact line under the table) was **rejected for v1** in that same ADR. Left
unrefined, this criterion would have asked Phase 03 to violate a decision taken mid-cycle,
and the board lint written in Phase 02 would have flagged arc's own board. The criterion is
**corrected in E below, not waived**: the fact that develop is next survives in the HISTORY
entry and the retro output, where no grammar has to parse it.

### A. Docs truth — the seven surfaces REQ-05 names (REQ-05)

Named file plus a content assertion each, so "done" is checkable by someone who did not
write it. Nothing outside this table gets rewritten (see Rabbit holes).

| # | File | What must be true after |
|---|---|---|
| A1 | `docs/how-arc-works-simple.md` §1 *The one rule* | states the per-lane law — exactly ONE plan live **per lane** — and quotes `PORTFOLIO.md` as the **index view, not the truth** (ADR-0051) |
| A2 | `docs/how-arc-works-simple.md` §3 *Folder map* | shows `initiatives/<lane>/` holding `PLAN.md` · `PROGRESS.md` · `phases/`, and marks `docs/evidence/**` + `docs/archive/**` frozen, linked never copied (ADR-0055, ADR-0058) |
| A3 | `docs/how-arc-works-simple.md` §8 *Rules that prevent confusion* | carries the truth hierarchy (`PROGRESS` = where the work is · `PLAN` = what the cycle is · `PORTFOLIO` = index + priority · `HISTORY` = immutable log) and the locked vocabulary table |
| A4 | `docs/usermanual.md` | one lane section in the manual's own register, naming `--lane` as the only way to name a lane and the resolution order (arg → auto → ask) — **synced file, see B2** |
| A5 | `docs/strategy/plans/README.md` | ritual updated: open the session, **state the lane** |
| A6 | `docs/templates/adr-template.md` | gains the one-line `Product:` field (ADR-0053) — **synced file, see B2** |
| A7 | `CLAUDE.md` | command lines carry `--lane` where it applies; file stays under its ~200-line budget (link out, never inline) |

A7 comes from the source REQ-05 in `docs/strategy/plans/PLAN-portfolio.md:236`, which names
`CLAUDE.md` explicitly where the lane `PLAN.md`'s one-line summary compresses it to "ritual
docs updated". Recorded here so the fuller wording governs and the compression does not
quietly drop a surface.

### B. The two gates a docs-only phase actually has to clear (REQ-05)

- **B1 — drift.** `bash .claude/scripts/review/docs-drift.sh` → **0 findings**, then
  `/arc-docs` and `bash .claude/scripts/core/review-ledger.sh stamp docs`. The script runs
  inside the deploy-guard, so this is a ship gate, not a courtesy.
- **B2 — the sync golden, and this is the trap.** `tests/fixtures/sync-golden/tree-manifest.txt`
  stores a **sha256 per synced file**, and **two of A's seven targets are in it**:
  `docs/usermanual.md:154` and `docs/templates/adr-template.md:149`. Editing either changes
  its hash, so `tests/sync.bats` fails **both** golden tests — rsync path and cp-r fallback —
  on **all three legs**. A phase with no code in it can therefore turn CI red six ways, and
  because no tests run locally (owner's standing rule) the first sight of it is CI. The
  golden must be regenerated **in the same commit** as the edit: sync into a throwaway
  target, run `_arc_tree_manifest` (`tests/test_helper.bash:470`) over it, overwrite the
  manifest. `git diff --stat` on that file must show exactly the two touched rows and no
  others — a manifest that moved more than the edit did means the sync surface changed too.

### C. HISTORY entry (REQ-05)

One Cycle-4 entry in `docs/HISTORY.md`, appended **at `/arc-retro` and never mid-cycle**
(HISTORY rule 1), ~8 lines max, numbers taken **verbatim** from the retro stat line (rule 2),
linking the archive bundle rather than duplicating it (rule 3), tagged with the lane. This
entry is where "develop kickoff is next" lives, per the correction above.

### D. The retro, and the three verdicts it must record (REQ-05)

`/arc-retro` runs in lane-mode (`Selected lane:` first, per `.claude/rules/lanes.md`) and
produces a **recorded verdict** — not a mention — for each of:

- **RI-1** — the tenth board-lint class: accept, shrink or reject; plus its generalisable
  question, *which other ADR-mandated artifacts have no gate asserting they exist?*
- **RI-2** — the 5 findings live in shipped `ownership-lint.sh`, the 52 findings still
  carrying an agent's verdict rather than a confirmed one, the reopened spool gap, and the
  question of whether a hand-written markdown-contract parser is the wrong shape.
- **A4** — the assumptions ledger names *the retro* as A4's test venue, and this is the
  cycle's last retro. Record the verdict explicitly (counted lanes = 1, so its trigger
  cannot have fired) instead of letting the row expire unexamined. **A3** gets one line in
  the same pass: not FIRED, but its spool half no longer exists, so what it still claims to
  cover has shrunk.

### E. The close state, corrected (REQ-05 · ADR-0051 · ADR-0061)

- `initiatives/portfolio/PROGRESS.md`'s machine header flips `status: IDLE` at close, and
  the board's portfolio row **derives** IDLE from it — nothing hand-typed (ADR-0051). The
  cycle column carries the closed-cycle note in the shape the `design` row already uses
  (`arc-portfolio (Cycle 4, closed YYYY-MM-DD)`); `Updated:` refreshed.
- **No `develop` row, and no `Queued next:` line** (ADR-0061).
- `bash .claude/scripts/core/board-lint.sh` → **0 WARNs** against the closed board.
- **Stated now so it is not discovered later:** with portfolio IDLE *and* design IDLE,
  **zero lanes are eligible**. Every no-arg lane surface then exits 3 and asks, and
  `--lane portfolio` becomes required for ordinary work. The resolver handles this
  deliberately — it has its own message, "no lane is eligible (LIVE or BLOCKED)" — and the
  path is pinned by `tests/lane-resolver.bats:97`. What is new is that **this phase is the
  first time the real repo enters that state**; the close must show the actual output, not
  cite the fixture.

### Definition of Done for this phase

A1–A7 done · B1 drift 0 findings + ledger stamped · **B2 golden regenerated in the same
commit as the edit** · C entry appended at retro · D verdicts recorded for RI-1, RI-2, A4
(and the A3 line) · E board 0 WARNs with portfolio IDLE derived from the header, no develop
row, and the real zero-eligible output shown · full bats green on ubuntu + macOS +
windows-git-bash in one run with `declared == executed` on every leg · root-mode goldens
unchanged · evidence bundle at `initiatives/portfolio/evidence/phase-03/`.

## Retro inputs — carried in, to be decided BY the retro, not before it

Routed here via `/arc-change` on 2026-08-01 (owner-decided). These are findings with a
tracked home and no code attached; the retro decides what each one becomes.

### RI-1 — a control that ADR-0056 required was never built, and nobody noticed for two phases

**What happened.** ADR-0056 says the board carries a `Mode B: not certified` note until
certification. `PORTFOLIO.md` was born in Phase 01 without it and ran through all of Phase
02 without it — `git log --all -S "Mode B: not certified" -- PORTFOLIO.md` returns nothing.
For the entire window in which Mode B was UNSUPPORTED, the artifact appointed to say so was
silent.

**Why it matters more than it looks.** Nobody was misled: one person, one working tree. That
is a fact about the circumstances, not about the control. The safeguard that would have
caught a second person was absent, not weak — and the absence survived a phase close, a
board lint written in the same cycle, and every `/arc-resume` in between.

**How it surfaced.** Section G's job was to REMOVE that note. It was found by trying to
delete something that was not there. No amount of reading the code produces this; only
acting on the artifact does. Same shape as CLAUDE.md's "look at the artifact before carrying
its verdict".

**The candidate upgrade, for the retro to accept, shrink or reject.** A tenth board-lint
class asserting the execution-mode section exists and that its Mode B line matches one of
two known grammars. Deliberately NOT "matches the certification state": no machine-readable
source of truth for certification exists, inventing one is a bigger change than the problem,
and the failure that actually happened was silent absence — which a presence check catches.

**Why it is not being built in this phase.** Phase 03 is docs + retro at 0.25d and its own
spec puts any code change out of scope. The change is also not one line: the WARN registry
is pinned at exactly nine classes and `tests/warn-shape.bats` asserts them by name, so a
tenth needs the registry, the class-obligation guard, and its own fixtures — and none of the
nine existing classes can carry it, since all nine are about board rows, lanes and
ownership, not about a required section being absent.

**The generalisable question for the retro, which is the real prize here.** This is the
second time this cycle that a stated control turned out not to exist or not to work
(the other: section E's control passed six legs by luck before the certification run caught
it). Both were found by exercising the artifact, neither by review. Worth asking: **which
other ADR-mandated artifacts have no gate asserting they exist?**

### RI-2 — 52 unconfirmed adversarial findings, and the spool gap section F left open

Routed here 2026-08-01, owner-decided, when `/arc-phase-done 2` refused and the missing
adversarial pass was finally run. Full record:
`../evidence/phase-02/adversarial-report.md`.

**What is carried in.** 61 findings across `board-lint.sh`, `lane-resolve.{sh,mjs}`,
`ownership-lint.sh` and the spool. Nine were verified by hand; one (the lock) was fixed and
pinned, three were removed by reverting section F, and **five remain live in shipped code**:
the `--base` typo that silently disables `ownership-lint`, its `--lane` duplicate-flag and
empty-value bugs, and its blindness to renames and to non-ASCII filenames. The other **52
carry an agent's verdict and not a verified one** — each needs its reproduction re-run
before it is believed. That re-verification is itself part of what this input asks for.

**The spool gap is open again.** Section F was reverted, so a hook-mode lock timeout once
more lands in `events/_quarantine/` beside malformed payloads — the gap Phase 02 set out to
close. The design reasoning is preserved in Phase 02's `## Now`; what it lacked was any
re-validation of the file the drain picked up. Whatever replaces it must run the same
validate → scan → seal path the front door runs, because "only our emitter writes to that
directory" is a claim about provenance that no code established.

**Two questions for the retro, worth more than the finding list.**

1. **`board-lint.sh` has 24 reported defects and passes its own 41 fixtures.** Four are
   silently-wrong verdicts. It is a hand-written strict-grammar markdown parser — the exact
   bug class PLAN risk 3 names, and the class the council found 43 holes in. Is the answer
   to fix them one by one, or is a hand-written markdown-contract parser the wrong shape?
2. **The pass was skipped on three gates in one phase, by a process that requires it.**
   `docs/retro-log.md:10` has mandated it since 2026-07-16, and this phase's own DoD names
   it. Nothing stopped those sections merging without it and nothing noticed until close —
   a rule only a phase close can enforce gets skipped for a whole phase.

## Rabbit holes in this phase

- Rewriting docs beyond the sections REQ-05 names. Retro scope creep — findings route
  through the normal retro promotion path.

## Out of scope for this phase

- Any code change. The develop kickoff itself (next cycle, first native lane).

## Your-setup / pending

- None.

## Non-negotiables (verbatim from PLAN)

- Philosophy untouched: Golden Loop, gates, receipts, change discipline — a lane is a namespace for tracker state, nothing more (ADR-0050, ADR-0053).
- No history rewrite and no history duplication: frozen paths stay frozen as sole canonical copies; lanes link, never copy (ADR-0055, ADR-0058).
- Root-mode green at every commit — byte-identical when no `initiatives/` dir exists; the bare-root fixture is a permanent consumer contract (ADR-0054).
- feat/* branch + PR, never main.
- All new lints WARN-first, and every WARN prints Expected / Found / Example (ADR-0057).
- Spine receipts for kickoff / phase-done / retro as usual; no silently lost receipts — degrade visibly, never lose, never block (ADR-0056, REQ-04).
- Never guess a lane: explicit `--lane` beats auto-resolve beats ask; destructive commands confirm the selected lane (ADR-0054).
