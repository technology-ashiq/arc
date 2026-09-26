# Phase 05 — spec fidelity (2026-09-23)

A fresh `spec-fidelity` agent read ONLY `phases/phase-05-spec.md` and `git diff 0b2ec0cb 2fba48f7` (PRs #252 to #263)
and answered per exit criterion. **Verdict: `FIDELITY: drift found`.** Every item is dispositioned below, and in the
spec's current-phase notes (2026-09-23, the close) for the owner.

## Exit criteria, as the agent read them

| criterion | agent | disposition |
|---|---|---|
| Day-1 CLI probe | MET | -- |
| Owning-lane changes additive and measured | PARTLY | DECLARED: legal's and evolve's pinning fixtures were rewritten (ADR-1344; an attacker-proven math fix, ADR-0311 correction); five 250-320 line CLIs are thicker than "thin" |
| Registry, realpath main guard | MET | -- |
| Binding table per op | MET | -- |
| plan / apply routes | MET | apply streams by polling (a PR 1 note) |
| No-second-path per op | PARTLY | RECORDED + debt row: proven as identical refusal for CI-refusing ops; hand-run built from the registry row |
| `main`-untouchable | MET for `touchesFiles` | DECLARED: `develop.slice` writes the ledger in place, never commits (ADR-1341 §1) |
| Refusal verbatim | PARTLY | debt row: first line compared; shown verbatim on the live tree in `live-demo.md` |
| `ops.mjs` + coverage op half, arms > 93 | PARTLY | **FIXED**: `tests/face-coverage.bats` asserts > 93 selftest arms PASS (117) |
| `flows.mjs`, frozen strings | PARTLY | debt row: two buttons frozen; placeholders and hooks not |
| Decide parity + route enumeration | MET (structure) | parity suite green on every leg (`ci-jobs.json`) |
| Block C gate / tripwire | MET, not triggered | -- |
| Every work verb (REQ-07) | MET | `residue.md`: none |
| Proposals stay proposals | MET | -- |
| Human-run ops click-only | PARTLY | **FIXED**: all four held to the door's click rule under real ids and flags (`tests/face/work-door.mjs`) |
| Live rooms (REQ-11) | PARTLY | debt row: receipt-in-room not timed; mutant host is a unit check. Spine-append timing IS measured (5 s cap) |
| Attackers, CI per job, the close | NOT MET yet | met by this close: `attackers.md`, `ci-jobs.json` |

## Non-negotiables

- No merge from the UI: respected (two mutating routes; git plumbing only).
- No direct write to `engine/router.yaml` or `hq.policy.yaml`: respected (byte-identity and UNGRANTABLE fixtures).
- SESSION verbs: not shipped (31 work ops only).
- Zero new spine kinds: respected.
- Branch-only writes: **widened by ADR-1341** for the develop ledger and design scaffold -- DECLARED above.
- "The work door has no logic of its own": strained by the toolbelt pin and council question built in the registry
  over `arc-event` (ADR-1341: no owning-lane CLI exists for either).

## Scope creep the agent named

ADRs 1341-1343 carry PRs 4, 5a, 5b departures (now listed in the spec's notes); the evolve interval correction;
attacker-driven hardening outside the ops (`validate.mjs` rejects invisible characters in decision reasons, `arc-inbox`
forces the scan engine, `redact.mjs` gains `joinFrom`) -- each fixed a reproduced hole and is pinned.

## User-visible change (the agent's words, condensed)

The owner can plan and run all 31 work verbs from their rooms. Each shows its command, diff and cost first; a verb that
changes files leaves a `feat/face-*` branch plus an inbox approval; the four human-run verbs need a confirming click.
Open rooms refresh on their own when the spine or a read file changes. Past experiment verdicts may read differently,
because the evolve interval math was corrected.
