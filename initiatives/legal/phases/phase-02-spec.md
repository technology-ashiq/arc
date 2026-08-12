# Phase 02 — guards and governance

**Goal (one line):** a page that drifts from its receipt is detectable without arc present, a template
edit cannot reach a venture silently, and the launch checklist asks the live site rather than the
render artifacts.
**Appetite:** 0.5 days — blown appetite = cut scope or kill, never extend silently
**Depends on:** phase-01

> **This is the designated-cut zone.** The cut order (probe automation → `--verify` polish →
> checklist renderer) is pre-decided in PLAN's Appetite section. If this phase passes 0.5 days, the
> cut fires INSIDE the phase — it does not borrow from Phase 3 and never from the attack panels.

## Exit criteria (Definition of Done)

- [ ] `arc-legal --verify` re-renders and diffs the venture's committed pages, exiting nonzero on drift, and reporting **stale-format** and **tamper** as different outcomes with different exit codes — where the classification is derived by re-deriving the canonical form under the CURRENT canonicaliser and comparing content, **never by trusting a version field the committed file itself declares** (ADR-1004 — `arc-absorb` 2026-08-09 shipped a verifier that called a format migration TAMPERING; the inverse, trusting a rolled-back version tag, would call tampering a migration).
- [ ] Mutant negative controls for `--verify`, both asserted RED: a page edited by one byte, and a page edited **with its declared preimage version rolled back**, which must classify as **tamper**.
- [ ] A ~10-line venture-side CI guard snippet compares committed-page hashes to the latest publish receipt, and is **GENERATED from the same comparison function `--verify` calls** rather than hand-duplicated — otherwise a future canonicaliser or preimage-version fix lands in `--verify` while the venture-side copy silently keeps the old logic, in a repo no twin-fix sweep of this repo can ever reach (the twin-fix pattern has recurred FOUR times: 2026-08-03, 08-04, 08-09, 08-10). The snippet carries a version marker asserted to match `arc-legal --version` at each `--bump-templates`, and is proven by the same 1-byte-edit mutant.
- [ ] `legal/pins.yaml` per venture; venture A on template set v3 and venture B on v5 both render correctly in one fixture run.
- [ ] `--bump-templates` forces per-venture re-approval, and a publish attempted against a moved `template_set_sha` without a bump is REFUSED.
- [ ] Template-edit approval flow: a template diff goes to the inbox as its own approval, never a silent commit (ADR-1005, REQ-07).
- [ ] Launch-checklist renderer emits rows from facts plus the pinned `products/legal/data/provider-pages.json` — 5 `provider-required`, 2 `provider-conditional`, each carrying its `source_url` (ADR-1001). No checklist row is hardcoded, and a row missing `source_url` FAILs.
- [ ] **All checklist rows are MANUAL, recorded-evidence rows in v1.** The URL-fetch probe arm, its `file://`-refusal assertion and its real-`node:fetch` contract test are **CUT — designated cut #1 (PLAN § Appetite), taken at kickoff rather than left to fire mid-phase**, because six deliverables plus an adversarial pass do not fit 0.5 days and LexOS stays PAUSED all cycle, so there is no live site to probe. A named backlog row records what returns when a venture is actually live.
- [ ] Every row records exactly one of four outcomes — `PASS` · `FAIL` · `NOT-CHECKED` · `NOT-APPLICABLE (reason)` — and a renderer that emits a BLANK row FAILs, fixture-pinned. An unchecked row and a clean row are the one thing a broken check and a healthy one otherwise agree on (`arc-memory` 2026-08-12: a scanner that could not tell SCANNED CLEAN from COULD NOT SCAN).
- [ ] A reachability row's recorded evidence includes an excerpt of the SERVED body matched against the committed page's `output_sha256`. A `200` with a placeholder body, a soft-404, or a redirect resolving to the homepage FAILs that row — status alone is not the check, and the row's subject is always a URL or a UI, never a local render artifact.
- [ ] Where the operator is not the merchant, activation rows render as `NOT-APPLICABLE` with their reason, not as green (ADR-1011).
- [ ] `tests/fixtures/sync-golden/tree-manifest.txt` regenerated as a NAMED step, delta diffed first, for the files this phase adds under `products/legal/` (the provider page-list and the CI-guard snippet template).
- [ ] Two-surface adversarial pass on `--verify` and the CI guard, attacker prompts carrying the running fixed-defect list from Phases 0–1.
- [ ] tests green **on CI**, per-JOB conclusions read; tracker updated; evidence bundle at `initiatives/legal/evidence/phase-02/`.

## Verification plan

- One coarse line at kickoff, refined via `/arc-change` when the phase starts: drift, pin and
  checklist behaviour are each proven by a mutant that RUNS — an edited page, a page whose declared
  preimage version was rolled back, a moved `template_set_sha` published without a bump, and a
  checklist row rendered blank.

## Rabbit holes in this phase

- **Probe automation depth.** Designated cut #1, and it has already been TAKEN at kickoff rather
  than left to fire mid-phase. Rebuilding it here because it feels close is the rabbit hole.
- **A pretty checklist.** The rows must be verifiable and sourced; formatting is post-ship.
- **Guarding with a grep.** `--verify` and the CI guard each get a mutant negative control.

## Out of scope for this phase

Any real venture facts, the LexOS render and the integration handoff → Phase 3.

## Your-setup / pending

Nothing required from the owner. The probe's real-fetch contract test runs against a throwaway
static fixture served locally, not against any live venture site.

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
