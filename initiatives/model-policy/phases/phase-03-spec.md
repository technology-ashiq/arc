# Phase 03 — Attacker rejections leave a trace; mode-ladder dogfood; retro

**Goal (one line):** a rejected attacker finding stops vanishing — one line, fixed
taxonomy — and the cycle closes with the mode ladder dogfooded and its lessons pinned.
**Appetite:** 0.5 days — blown appetite = cut scope or kill, never extend silently.
**Depends on:** phase-00, phase-01

## Exit criteria (Definition of Done)

**REQ-05 — the reject trace**

- [ ] `.claude/commands/arc-kickoff.md` step 5 changed from "reject → drop silently, no
      log" (currently line 79) to one line per rejected finding:
      `REJECTED: <finding> — <reason>`
- [ ] `<reason>` is drawn from the fixed taxonomy and nothing else:
      `duplicate` · `out-of-appetite` · `unsupported` · `violates-no-go` ·
      `already-covered` · `non-actionable`
- [ ] No rebuttal, no debate, no reply to the attacker — a trace, not a process (ADR-0067)
- [ ] **Scope is `arc-kickoff.md` only.** The `/arc-change` "mirror" named in REQ-05 does
      not exist — `.claude/commands/arc-change.md` has no reject, attacker, panel or
      finding step (verified 2026-08-02). This is assumption **A-05**; its falsification
      trigger is recorded in PLAN.md and it is carried into the retro as a candidate for a
      later cycle, **not** built here
- [ ] Proven on the **next `/arc-kickoff` run of ANY lane** by ≥1 actually-recorded
      rejection — a changed instruction that never produced a line is not proof (retro
      2026-08-02: a stated control is not a control until something asserts it exists).
      **This event is not guaranteed inside the 3-day appetite** — `model-policy`'s own next
      kickoff cannot run until this cycle closes (ADR-0051, one live plan per lane), and no
      other lane's kickoff is scheduled (`portfolio` and `design` are both IDLE). If Phase 3
      reaches its own close with no qualifying kickoff having run, REQ-05 closes as
      **"implemented, unproven"** with assumption **A-06**'s trigger carrying the follow-up —
      this does **not** block `/arc-phase-done` for Phase 3 or the cycle
- [ ] Any lint that learns to look for the line ships **WARN-first** with a
      `docs/trial-ledger.md` row, and gets its adversarial breaking-input pass bound to
      **this** phase (pre-mortem row 5)

**Dogfood + close**

- [ ] One dogfood pass over the mode ladder: `quick` / `standard` / `deep` used as intended
      at least once each across the cycle, and the mix recorded — the input to ADR-0065's
      cannibalisation trigger
- [ ] `docs/retro-log.md` gains any recurring pattern this cycle surfaced (recurring only,
      never one-offs)
- [ ] Trial-ledger rows exist for every WARN-first check introduced this cycle
- [ ] Assumptions A-01..A-05 each marked: held · dead · still open (with its trigger intact)
- [ ] `/arc-retro` run; tracker updated (PROGRESS.md row ✅ + done-log); receipt emitted

## Verification plan

*Coarse at kickoff — refined via `/arc-change` when this phase starts.* The reject-line
change is verified by running the next real kickoff and reading at least one
`REJECTED: … — <taxonomy word>` line out of its attack panel, with the reason word checked
against the closed six-word list. Evidence: the kickoff transcript showing the recorded
rejection, the trial-ledger rows, the mode-mix tally, and the retro-log diff.

## Rabbit holes in this phase

- **Turning the trace into a process.** The moment a rejection invites a reply, the attack
  panel becomes a negotiation and stops being cheap. One line, no rebuttal (ADR-0067).
- **Filing under the nearest available word.** A closed vocabulary makes rejections
  countable only if the word is true. A wrong-but-available word makes the log *look* like
  data, which is worse than no log — this is ADR-0067's actual revisit trigger.
- **Building the `/arc-change` mirror because the text mentions it.** A-05 says it does not
  exist. Inventing new surface on the last day of a 3-day cycle is how appetite gets blown.
- **Editing a command file and leaving it self-contradicting.** Retro 2026-08-02: rewriting
  sections left the same file teaching the superseded law elsewhere. After changing step 5,
  grep the whole of `arc-kickoff.md` for "silently" / "no log" / "drop" before closing — the
  author of a change is structurally blind to the sections that cite it.

## Out of scope for this phase

Any `/arc-change` reject mechanism (A-05, future cycle) · promoting any WARN-first check to
FAIL without trial-ledger evidence · re-opening MP-A..F · anything engine-shaped.

## Your-setup / pending

The owner runs (or approves) one real kickoff after the change so the reject line has a
genuine attack panel to be produced by. Until that run happens, REQ-05 is implemented but
unproven.

## Non-negotiables (verbatim from PLAN)

- **No engine code.** Nothing under `processes/`, no drivers, no `router.yaml`, no budget enforcement, no bench runner — those plans sleep until their own triggers (A8).
- **No auto model switching anywhere.** Every production tier change is a reviewed diff citing MP-A (ADR-0063); the two MP-A carve-outs are the only exceptions and both are human-approved.
- The session-model pin stays personal (`settings.local.json`) — shared settings never gain a `model` key this cycle.
- Council remains additive-only; ADR-0002 (deep default) and the juror contract (ADR-0015..0018) untouched; `standard` never weakens `deep`.
- REQ-03 verdicts follow ADR-0047/0048/0049: blind ordering + owner's own eyes on the artifact; no absolute scores inside the loop; PREDICTION pre-registered before reveal.
- Fingerprints are forward-only and never estimated (MP-F / ADR-0068).
- Every phase close leaves its receipt on the spine (existing kinds only).
