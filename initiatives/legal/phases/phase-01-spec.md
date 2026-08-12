# Phase 01 — the full set and its receipts

**Goal (one line):** all seven pages render from one facts file, ≥ 8 pinned scenarios each resolve to
an answering clause id, and no page can change without a `decision.recorded` that binds its bytes.
**Appetite:** 1.5 days — blown appetite = cut scope or kill, never extend silently
**Depends on:** phase-00

## Exit criteria (Definition of Done)

- [ ] The remaining four pages authored: `shipping-delivery` (digital-delivery wording — no provider carve-out exists, ADR-1001), `contact`, `pricing` (one all-inclusive INR figure with tax treatment stated, ADR-1008), `about` (operator identity and trading-as disclosure).
- [ ] **Text-level attack panel (hostile customer · regulator · competitor's lawyer) runs on the RENDERED bytes of these four pages before this phase closes.** Phase 0's panel covered Phase 0's three pages only — `pricing` states a binding all-inclusive figure and `shipping-delivery` carries the one digital-delivery clause, which is exactly the class the panel exists to stress. Findings triaged as in Phase 0.
- [ ] `tests/fixtures/sync-golden/tree-manifest.txt` regenerated as a NAMED step, delta diffed first, for the four new shipped files under `products/legal/`. Phase 0 closed this for its three pages; every phase that adds a shipped file repeats it rather than assuming one closure holds forever (`arc-orchestrator` 2026-07-22: the golden fixture broke across 10 separate commits, twice as a surprise mid-task failure).
- [ ] **A CI check asserts `targets.publish` in `hq.policy.yaml` is empty** on every PR touching `.claude/scripts/legal/**`, proven by a mutant that adds a `legal.publish` target and is asserted to turn the check RED. REQ-06 calls the human gate permanent; until this lands, that permanence is a sentence four specs repeat and nothing tests.
- [ ] Route paths read from FORMAT-tier facts fields with the ADR-1010 item-7 defaults; no page URL is a constant anywhere in the engine or the checklist.
- [ ] Scenario fixture set of ≥ 8 committed **in its own commit, before the completeness lint reads it** (ADR-1009), each row mapping a situation to the clause id that answers it.
- [ ] Completeness lint runs over all seven pages and reports two distinct failure classes: MISSING mandatory clause id, and UNANSWERED scenario. An orphaned scenario after a template edit is a failure.
- [ ] `approval.requested` emitted with the strict payload profile `subject: "legal.publish"`; unknown keys are REJECTED (fixture-pinned, ADR-1003).
- [ ] The owner's decision is taken through `arc-inbox approve|reject --reason …` and lands as `decision.recorded`. The raw emitter is never used for it, and the command handed over carries its `cd` to the canonical clone — the spine is gitignored, so each worktree has its own and a failed approve leaves no trace.
- [ ] Every emit VERIFIED by event id in `events/` and in `events/_quarantine/`; a ULID substring grep is not accepted as proof.
- [ ] Hash-chain enforced: publish refuses any `(facts_sha256, output_sha256[], template_set_sha)` mismatch. **TOCTOU fixture** — approve, edit the facts file, attempt publish → refused. **Backdating fixture** — `effective_date` earlier than the decision timestamp, or non-monotonic for that page → FAIL.
- [ ] Re-publish presents the semantic diff (changed facts values + changed clause ids); a full-blob re-approval emits a lint warning.
- [ ] Two-surface adversarial pass on the receipt/approval path, attacker prompts carrying the running fixed-defect list from Phase 0.
- [ ] tests green **on CI**, per-JOB conclusions read; tracker updated; evidence bundle at `initiatives/legal/evidence/phase-01/`.

## Verification plan

- **Test command:** `bats tests/legal-pages.bats` then `bats tests/legal-scenarios.bats` then
  `bats tests/legal-receipts.bats` — one file at a time, foreground; **CI is the gate**.
- **Expected failure first:** `bats tests/legal-scenarios.bats` fails on
  `@test "every pinned scenario resolves to a clause id present in the rendered set"` with
  `8 scenarios, 0 resolved` — the scenario fixture exists (committed first, by design) and the
  completeness lint cannot yet read it.
  **The red that matters most:** `@test "editing facts after approval refuses the publish"` runs the
  full sequence — render, `approval.requested`, a simulated approve, then a one-character edit to
  `refund_window_days`, then publish — and asserts publish EXITS NONZERO naming the mismatched
  `facts_sha256`. It stays red until the decision binds the triple, and a publish path that
  re-computes the hash at publish time instead of comparing against the receipt passes every other
  test in this file while failing this one.
  **Third red:** `@test "an effective_date before the decision timestamp FAILs"` and its twin
  `@test "a non-monotonic effective_date for the same page FAILs"` — a date law enforced only on the
  first publish is not a date law.
  **Fourth red:** `@test "approval.requested with an unknown payload key is rejected"` adds one
  extra key and asserts rejection naming the key. A profile that ignores unknown keys is not strict.
  **Fifth red:** `@test "a template edit that orphans a scenario fails completeness"` deletes the
  clause that answers the data-deletion scenario and asserts the lint names the orphaned scenario id
  — not merely that a clause count changed.
- **Live demo scenario:** (1) `node .claude/scripts/legal/arc-legal.mjs render --venture fixture-in`
  → seven `.mdx` files. (2) `… propose --venture fixture-in` → prints the `approval.requested` ULID
  and the full page set for reading. (3) In the CANONICAL clone:
  `cd E:/Work_Hub/01_Automemory/arc && bash .claude/scripts/hq/arc-inbox.sh approve <id> --reason "…"`
  → `decision.recorded`. (4) `ls .claude/state/hq/events/` and `ls
  .claude/state/hq/events/_quarantine/` → both events present in the first, absent from the second,
  matched by id. (5) Edit one facts value, re-run publish → refused, naming the hash that moved.
- **Real-system check:** the spine and the inbox are real, not faked — the approval round-trip runs
  against `.claude/state/hq/events/` on the canonical clone. No venture repo and no network.
- **Expected evidence:** `initiatives/legal/evidence/phase-01/` holding the CI run id with per-job
  conclusions, the two event ids with their quarantine check, the TOCTOU and backdating fixture
  outputs, the semantic-diff sample, and the adversarial reports.

## Rabbit holes in this phase

- **Building a legal.updated kind because the tags feel awkward.** ADR-1003 says no; the promotion
  trigger is a real cross-venture query, and it has its own ADR when it arrives.
- **Making the semantic diff pretty.** It must be readable enough that a full-blob re-approval is
  never the easier path. That is the whole bar.
- **Emitting `decision.recorded` from the module.** It cannot compute the welded idem, and a raw
  emit exits cleanly while quarantining.

## Out of scope for this phase

`--verify`, the venture CI guard, `pins.yaml`, `--bump-templates`, the template-edit approval flow,
the checklist renderer and the probe → Phase 2. Any real venture facts → Phase 3.

## Your-setup / pending

**One owner action:** approving the fixture publish through `arc-inbox` in the canonical clone, so
the approval path is proven against the real spine rather than a fake. The command will be handed
over with its `cd` already in it.

## Non-negotiables (verbatim from PLAN)

- Not a lawyer, never pretends to be: no invented legal claims, and no compliance badge without a demonstrable truth plus an evidence link (Constitution E3, ADR-0012). Rendered pages carry no "reviewed by counsel" implication until ADR-1007 fires and it is true, and no page or checklist may imply a DPDP obligation is in force before it commences (ADR-1006).
- The human gate is permanent (REQ-06): every publish is L1, propose-only, and no auto-publish path exists in code. `targets.publish` in `hq.policy.yaml` stays empty (ADR-1003).
- All three lints (value / trace / completeness) are WARN-first in TRIAL, and no promotion to FAIL happens without an adversarial pass first — facts files and templates are hostile input (ADR-1002, ADR-1009).
- Every gate gets TWO fresh attackers with different surfaces (decision logic · shell and OS boundary), and each attacker prompt carries this lane's running fixed-defect list with "check each one in every OTHER file". The negative control is a MUTANT that runs, never a grep.
- The text-level attack panel runs on the RENDERED bytes of the authored set before Phase 0 closes — content is parser-class too, and a transform applied for lint stability must declare what signal it destroys (ADR-1002).
- Hash-chain law (ADR-1004): no publish without a bound receipt; no silent edits; no backdating; the canonicaliser is total and type-tagged; the preimage carries its own version and `--verify` reports stale-format and tamper as different exit codes.
- Emitter and reader discipline: zero new event kinds; every emit verified in `events/` AND `events/_quarantine/` by event id, never by ULID substring; `decision.recorded` only via `arc-inbox`.
- Zero-dep Node and POSIX (A2); central `tests/` (ADR-0021); tests run on CI, never on this box; never delete — superseded template versions and retired pages keep their files (A10).
- Original drafting only: no copied third-party policy text.
- Constitution articles this plan upholds, for kickoff-lint: E3, A2, A5, A8, A9, A10.
