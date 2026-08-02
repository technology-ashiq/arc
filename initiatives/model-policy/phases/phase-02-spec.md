# Phase 02 — Paired composer A/B: does the creative seat earn the high-judgment tier?

**Goal (one line):** answer the composer-tier question with a fair paired experiment at one
pinned commit — two explore runs sharing one director assignment verbatim — and record
keep-or-revert in a one-page ADR by a formula fixed **before** the results are seen.

> This phase is the **first application of ADR-0064 (MP-B)**: judgment seats get the
> strongest tier by principle, but a *creative* seat earns its tier through a receipted
> A/B rather than through default frugality. Whatever this experiment returns is binding
> for the composer seat — including "workhorse stays", which is a result, not a failure.
**Appetite:** 1.25 days — blown appetite = cut scope or kill, never extend silently.
**Depends on:** phase-00

## Exit criteria (Definition of Done)

**Setup — the fairness conditions (all asserted BEFORE either run starts)**

- [ ] One commit pinned; both arms run against it. The SHA is recorded in both fingerprints
- [ ] Brief is the existing `lexos-case-workspace`. Historic
      `docs/design/explore/lexos-case-workspace-v2` is **context only, never an arm**
- [ ] `design-director` assigns the 3 theses + art directions **exactly once**
- [ ] `design-director`'s own contract (`.claude/agents/design-director.md`) scopes it to ONE
      explore dir (`docs/design/explore/{id}/`); a paired A/B needs TWO dirs (one for run-S,
      one for run-O). Name the exact step and owner that copies the director's three
      `thesis.txt` files byte-for-byte from the assignment dir into the second dir's
      `variant-{a,b,c}/thesis.txt` **before** either composer trio starts — this copy is a
      distinct, currently un-owned action, not covered by "the director assigns… exactly once"
- [ ] The assignment reaches composers via **`thesis.txt`** — `ui-composer` iron law 1
      forbids reading `matrix.md` (verified 2026-08-02). The **content fixture travels in
      `thesis.txt` too**: retro 2026-07-30 records three composers inventing three
      different cases because the fixture was only in `matrix.md`
- [ ] Both arms' `thesis.txt` are **byte-identical** — asserted, not assumed. If they
      differ, the comparison is void and the arm is re-run
- [ ] Renderer recipe identical and typography-preserving: **`PIN_FONT=0`**, recipe string
      `font-true;aa-on`. RECIPE-string **equality asserted before any ranking** — a pinned
      run would judge both arms with their typography deleted (retro 2026-07-30), which is
      plausibly the very signal a stronger composer differs on
- [ ] Same reference screen used in both rankings

**Runs**

- [ ] **run-S** — 3 composers on the balanced-workhorse tier
- [ ] **run-O** — 3 composers on the high-judgment tier
- [ ] Each arm records its **MP-F fingerprint** (ADR-0068): provider · exact model id ·
      agent role · agent-file/prompt commit SHA · input/brief SHA · timestamp · wall-clock
      duration · effort if visible · statusline cost if visible. **An unavailable field
      stays absent — never estimated** (this is a one-way honesty rule, not a nicety)

**Judgement**

- [ ] Owner pre-registers a **one-line PREDICTION** before any output is seen
- [ ] Owner **blind-ranks all 7 items** (6 pages + the reference screen, labels shuffled)
      before any arm identity is revealed — and **opens the pages themselves**. An agent's
      report about a screenshot is not the screenshot (retro 2026-07-30, scored 23/100)
- [ ] `design-jury` ranks the same 7 blind, independently — **note:** `.claude/agents/design-jury.md`
      is contracted and hard-coded for exactly FOUR items (3 variants + 1 reference; its
      machine-readable output line is literally `- ranked: item-c > item-a > item-d > item-b`,
      "one line, four entries, exactly this form", and `reference-position` is a 1–4 field).
      Phase 2 must state, **before either run starts**, which of these it is doing: **(a)** a
      per-invocation prompt-only override to `item-a`…`item-g` + a 1–7 `reference-position`,
      logged in evidence as a documented deviation from the agent file (never an edit to
      `design-jury.md` — the 3-variant tooling stays untouched per no-go), or **(b)** two
      separate 4-item panels (each arm's 3 pages + the shared reference) with the keep/revert
      ADR stating plainly that no single 7-item blind ordering was ever produced. Left
      undecided, this surfaces mid-run, inside the 1.25d that has zero slack
- [ ] No absolute scores anywhere inside the loop (ADR-0047/0048/0049)

**Verdict**

- [ ] One-page ADR records keep or revert by the **fixed formula**: keep the high-judgment
      tier **only if** the blind ordering shows a material, owner-visible quality gain
      **AND** the owner explicitly accepts the recorded cost/time delta. **"Slightly
      better" alone reverts**
- [ ] The ADR carries both fingerprints, both durations, both visible costs, and the
      PREDICTION alongside the outcome — whether or not the prediction held
- [ ] If the arms interleave (neither dominates), assumption **A-01 is recorded dead** and
      workhorse stays — that is a real result, not a failed phase
- [ ] tracker updated (PROGRESS.md row ✅ + done-log) · receipt emitted on the spine

## Verification plan

*Coarse at kickoff — refined via `/arc-change` when this phase starts.* Fairness is
verified by asserting the four setup equalities (pinned commit · byte-identical
`thesis.txt` · identical RECIPE string · same reference screen) before either run, and the
verdict is verified by the owner's own eyes on all 7 rendered pages under shuffled labels,
with the PREDICTION written down first. Evidence: both fingerprints, both rankings, the
recipe-equality check output, the pre-registered prediction, the keep/revert ADR.

## Rabbit holes in this phase

- **Benchmarking temptation.** This is ONE paired experiment with receipts, not a paper. No
  sample-size expansion, no third model, no second brief — that is `BRIEF-bench.md`.
- **Fixing the tooling mid-experiment.** The explore tooling is 3-variant-shaped and
  rewriting it is a no-go. The design is 3-variant-shaped *because of that*, deliberately.
- **Rescuing a confound with a note.** If theses drift, the recipe differs, or the content
  fixture diverges, the arm is **re-run** — never "noted and continued". A confounded A/B
  that ships a verdict is worse than no A/B, because the verdict gets cited.
- **Reading the labels early.** Once arm identity is known the blind ranking is spent and
  cannot be recovered on this brief.

## Out of scope for this phase

Re-tiering any seat other than the composer arm · changing the design pipeline beyond these
paired runs · rewriting `design-render.sh` · the attacker reject-log (Phase 3) · building
any fingerprint collector (no-go).

## Your-setup / pending

The owner personally: writes the PREDICTION before seeing output, performs the 7-item blind
ranking with their own eyes on the rendered pages, and makes the explicit accept-or-reject
call on the cost/time delta. None of these three is delegable to an agent — the formula
depends on *owner-visible* gain.

## Non-negotiables (verbatim from PLAN)

- **No engine code.** Nothing under `processes/`, no drivers, no `router.yaml`, no budget enforcement, no bench runner — those plans sleep until their own triggers (A8).
- **No auto model switching anywhere.** Every production tier change is a reviewed diff citing MP-A (ADR-0063); the two MP-A carve-outs are the only exceptions and both are human-approved.
- The session-model pin stays personal (`settings.local.json`) — shared settings never gain a `model` key this cycle.
- Council remains additive-only; ADR-0002 (deep default) and the juror contract (ADR-0015..0018) untouched; `standard` never weakens `deep`.
- REQ-03 verdicts follow ADR-0047/0048/0049: blind ordering + owner's own eyes on the artifact; no absolute scores inside the loop; PREDICTION pre-registered before reveal.
- Fingerprints are forward-only and never estimated (MP-F / ADR-0068).
- Every phase close leaves its receipt on the spine (existing kinds only).
