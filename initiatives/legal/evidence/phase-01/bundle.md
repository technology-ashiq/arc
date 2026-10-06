# Evidence bundle — phase 01 · lane legal

**The full set and its receipts: a decision approves bytes, and a re-publish shows what moved
before anyone signs it.**

Phase 01 was built 2026-08-13/14 and left open: the tracker said "in progress" for seven weeks
while Phase 02 was built on top of it. This bundle closes it on 2026-10-06 against every exit
criterion, and names the two that were not met until today.

## The exit criteria, and where each is met

| Criterion | Where | Proof |
|---|---|---|
| Remaining four pages authored | `products/legal/templates/v1/{about,contact,pricing,shipping-delivery}.tmpl.md` | `legal-render.bats` renders all seven for six fixtures |
| Text attack panel on the RENDERED bytes of the four | `text-panel-round-2.md` (this dir) | three stances, two ventures; eight findings left open there, none asserting an untruth |
| Sync golden regenerated as a named step | `tests/fixtures/sync-golden/tree-manifest.txt` | 440 rows before and after; only the three touched legal files moved (PR #341) |
| CI check that `targets.publish` is empty, with a mutant | `legal-publish-gate.bats` | inline, block-list and five attacker YAML shapes all turn it red |
| Route paths from facts, no constant URL | `renderVenture` `effectiveRoutes` | ADR-1210 item-7 defaults; checklist reads `routes` from the run |
| ≥ 8 scenarios, committed first | `products/legal/data/scenarios.json` | `legal-scenarios.bats` |
| Completeness: MISSING and UNANSWERED as two classes, orphan fails | `lib/lints.mjs` | `legal-scenarios.bats` "a template edit that ORPHANS a scenario turns completeness red" |
| `approval.requested` strict profile, unknown keys rejected | `lib/receipts.mjs` `validateApprovalPayload` | `legal-receipts.bats` "an unknown key ... is REJECTED"; the profile gained `previous_published_sha256` today and stays closed |
| Decision only through `arc-inbox`, never the raw emitter | `decisionFromSpine` reads `decision.recorded` that `decides` the request | probe records decisions with arc-inbox's own idem and process |
| Every emit verified in `events/` and `_quarantine/` by id | live demo below | |
| Hash chain: TOCTOU and backdating fixtures | `verifyChain`, `backdatingErrors` | `legal-receipts.bats` TOCTOU x2, BACKDATING, and since today NON_MONOTONIC with BACKDATED ruled out plus its forward-date positive control |
| **Re-publish semantic diff; full-blob re-approval WARNs** | `semanticDiff`, `factsFieldPrints`, `printSemanticDiff` | **NOT MET until 2026-10-06.** `changed_facts` was a constant `[]` and the diff printed only at publish, after the stamp. Now: per-field prints for fields a page prints, the diff shown at propose, `FULL-BLOB` WARN when no field can be named |
| Two-surface adversarial pass on the receipt path | 2026-08-13 (8 holes) and 2026-10-06 (below) | `fixed-defect-list.md` rows 20-27, 33-45 |
| CI green per job | PR #341 | run id recorded at close |

## The live demo, run against the real spine (2026-10-06, canonical clone)

1. `render --venture fixture-gateway-nogst` → 7 pages, `0 FAIL, 0 WARN`, facts `41851921...`.
2. `propose --dry-run` → digest; `propose --expect <digest>` → **`approval.requested 01M46QX0KG8CB77HSX9AEE638E`**.
3. Verified by id: present in `.claude/state/hq/events/2026-10-06.jsonl`, **0** hits in `events/_quarantine/`.
4. `publish --request 01M46QX0...` before any decision → **exit 2**, `NO_DECISION` and `DECISION_UNDATED`.

That request was raised by the pre-PR-341 engine, so its payload lacks
`previous_published_sha256` and the current publish would refuse it as a profile violation. It is
left undecided on purpose. The owner's stamp is taken on a fresh request raised from the merged
engine; its two event ids are recorded at close.

## The 2026-10-06 attack rounds

| Run | Surface | Findings | Fixed |
|---|---|---|---|
| `1f6acdd` r1 | boundary | 1 high · 2 medium · 3 low | the high (a public per-field digest is a guess-and-confirm oracle) and both mediums |
| `cef0d6e` r1 | boundary | 4 medium · 3 low | unreadable ledger read as first publish; forged diff lines; diff not bound to the ledger it was computed on |
| `e28fcf1` r1 | boundary | 3 medium · 8 low | EAGAIN read as refusal; C1/bidi escaping; self-attested PASS unlabelled |
| `3f82dad` r1 | **logic** | 1 high · 7 medium · 2 low | Map/Set and dotted keys refused; WARN on facts alone; one ledger read; page required on checklist rows |
| `3f82dad` r1 | boundary | 2 medium · 8 low | same two, overlapping the logic set |

The logic surface failed three times before it ran (a saturated free model, a model id `arc-run`
refuses, an answer missing a schema field). It ran once, on the final commit. Every low carried is
in `initiatives/legal/debt-ledger.md`.

**One finding came from inside the fix.** The test for the bidi escape had the real U+202E typed
into it by the Edit tool, so input and expectation carried the same invisible character. That is
row 1 of this lane's defect list, eight weeks later, in a test about escaping. Rebuilt from a code
point.

**And the attackers had been running blind.** `build-attack-input.mjs` reads
`initiatives/<lane>/fixed-defects.md` as bullets; this lane kept its list as a table in
`evidence/`. Every attacker before 2026-10-06 ran with "defect patterns: NONE". The bullet file is
now generated from the table (51 rows) and both are updated in the commit that fixes a hole.
