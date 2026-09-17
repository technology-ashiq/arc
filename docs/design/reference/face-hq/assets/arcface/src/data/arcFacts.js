// GENERATED from the arc repo (READ-ONLY) on 2026-08-25 by scratchpad/trim-facts.mjs.
// Every value is a repo fact with a src pointer; nothing here is typed by hand. Regenerate, never edit.
// eslint-disable
export const FACTS = {
 "meta": {
  "generated": "2026-08-25T07:04:56.539Z",
  "repo": "E:\\Work_Hub\\01_Automemory\\arc (read-only)",
  "lanes": 16,
  "note": "every row is a repo fact; src = file:line in the arc repo"
 },
 "lanes": [
  {
   "id": "absorb",
   "room": "absorb",
   "ring": "kernel",
   "status": "idle",
   "cycle": "arc-absorb (Cycle 10, closed 2026-08-10)",
   "currentPhase": "— (cycle closed, merged as 30dc9a9 / PR #138 and 6850250 / PR #151, 8 of 8 REQ)",
   "phasesTotal": 5,
   "phasesClosed": 5,
   "waitingOn": null,
   "dependsOn": null,
   "appetite": {
    "value": "8d",
    "burn": "6.5d",
    "unit": "days (as stated; not weeks)"
   },
   "plan": "PLAN.md — absorb: the technique refinery",
   "goal": "/arc-absorb turns an external agent or tool's superior technique into native, receipted arc",
   "next": "CLOSED 2026-08-10 — 5/5 phases, 8/8 REQ, 1.5d unspent. The technique loop ran end to end on a real source: read-only st…",
   "position": "— (cycle closed, merged as 30dc9a9 / PR #138 and 6850250 / PR #151, 8 of 8 REQ)",
   "phases": [
    {
     "phase": "00",
     "capability": "Steel thread: the matrix and its paperwork — DEV-B/C boundary audit, registry shape …",
     "appetite": "1d",
     "status": "✅ CLOSED 2026-08-09",
     "closed": true
    },
    {
     "phase": "01",
     "capability": "Study harness, hostile-input-first — read-only pipeline, injection red corpus, adver…",
     "appetite": "2d",
     "status": "✅ CLOSED 2026-08-09",
     "closed": true
    },
    {
     "phase": "02",
     "capability": "Registry and guards — status lint (cap 12, displacement, decision-ref), allowlist li…",
     "appetite": "1d",
     "status": "✅ CLOSED 2026-08-09",
     "closed": true
    },
    {
     "phase": "03",
     "capability": "Governance drop — ADR-0603 owner-judge profile + blind mechanics + inbox chain, REQ-…",
     "appetite": "1d",
     "status": "✅ CLOSED 2026-08-09, one row open by owner decision",
     "closed": true
    },
    {
     "phase": "04",
     "capability": "The real absorb — ADR-0606's target end-to-end, 3-fixture A/B, sealed-blind judgemen…",
     "appetite": "1.5d",
     "status": "✅ CLOSED 2026-08-10",
     "closed": true
    }
   ],
   "src": "initiatives/absorb/PROGRESS.md:3"
  },
  {
   "id": "bench",
   "room": "bench",
   "ring": "kernel",
   "status": "awake",
   "cycle": "arc-bench (Cycle 13, opened 2026-08-12)",
   "currentPhase": "04",
   "phasesTotal": 5,
   "phasesClosed": 4,
   "waitingOn": null,
   "dependsOn": null,
   "appetite": {
    "value": "8d",
    "burn": "7.25d",
    "unit": "days (as stated; not weeks)"
   },
   "plan": "PLAN.md — bench runner v1: \"the model market\"",
   "goal": "node .claude/scripts/engine/arc-bench.mjs --driver DRIVER --model PROVIDER/MODEL --budget inr=CAP",
   "next": "",
   "position": "04",
   "phases": [
    {
     "phase": "00",
     "capability": "The road + steel thread — drivers/mock, version verb, assertion schema, fixture-repo…",
     "appetite": "3.0d",
     "status": "✅ done 2026-08-13",
     "closed": true
    },
    {
     "phase": "01",
     "capability": "Bench core — full run, K=3 sequential, K-group admission control, provenance, total …",
     "appetite": "1.5d",
     "status": "✅ done 2026-08-13",
     "closed": true
    },
    {
     "phase": "02",
     "capability": "Router proposal — three artifacts, gates-first eligibility, NO PROPOSAL with reason,…",
     "appetite": "0.75d",
     "status": "✅ done 2026-08-13",
     "closed": true
    },
    {
     "phase": "03",
     "capability": "Drift guard + the real event — split axes, three tiers, enumerated re-pin causes, on…",
     "appetite": "1.0d",
     "status": "⚠️ guard done · real event PENDING (unblocked 2026-08-14)",
     "closed": false
    },
    {
     "phase": "04",
     "capability": "Seal + retro — two mutants, two adversarial surfaces, redaction sweep, runbook, prod…",
     "appetite": "1.0d",
     "status": "✅ done 2026-08-13",
     "closed": true
    }
   ],
   "src": "initiatives/bench/PROGRESS.md:3"
  },
  {
   "id": "design",
   "room": "design-studio",
   "ring": "factory",
   "status": "idle",
   "cycle": "arc-design (Cycle 3, closed 2026-07-30)",
   "currentPhase": "— (no live cycle)",
   "phasesTotal": 0,
   "phasesClosed": 0,
   "waitingOn": null,
   "dependsOn": null,
   "appetite": null,
   "plan": null,
   "goal": null,
   "next": "/arc-kickoff --lane design when a new cycle starts",
   "position": "— (no live cycle)",
   "phases": [],
   "src": "initiatives/design/PROGRESS.md:3"
  },
  {
   "id": "develop",
   "room": "develop",
   "ring": "factory",
   "status": "idle",
   "cycle": "arc-develop (Cycle 6, closed 2026-08-03)",
   "currentPhase": "— (cycle closed, merged as 17473e7 / PR #100)",
   "phasesTotal": 9,
   "phasesClosed": 6,
   "waitingOn": null,
   "dependsOn": null,
   "appetite": {
    "value": "7d",
    "burn": "2.1d",
    "unit": "days (as stated; not weeks)"
   },
   "plan": "PLAN.md — arc develop · Cycle 6: the intelligence layers",
   "goal": "Finish The Developer: an execution harness that not only runs a phase with discipline, but",
   "next": "/arc-kickoff --lane develop when a new cycle pulls it",
   "position": "— (cycle closed, merged as 17473e7 / PR #100)",
   "phases": [
    {
     "phase": "00",
     "capability": "Steel thread — parked, shipped in Cycle 5",
     "appetite": "—",
     "status": "✅ done 2026-08-02",
     "closed": true
    },
    {
     "phase": "04",
     "capability": "The Learning System — ledger with typed links, eval fixtures, withheld holdout, prom…",
     "appetite": "1.5 days",
     "status": "✅ done 2026-08-03 (12 of 13 slices; slice 08 carried)",
     "closed": true
    },
    {
     "phase": "05",
     "capability": "Context Pack — code-graph neighbourhood with stated grep fallback, churn, tagged hit…",
     "appetite": "1.0 days",
     "status": "✅ done 2026-08-03 (9 of 9 slices)",
     "closed": true
    },
    {
     "phase": "06",
     "capability": "Capability — scout, vet gate that BLOCKs on provenance, pinned lockfile",
     "appetite": "0.75 days",
     "status": "✅ done 2026-08-03 (15 of 15 slices)",
     "closed": true
    },
    {
     "phase": "07",
     "capability": "Quality intelligence — decision-triggered pattern mining, risk-triggered approach sk…",
     "appetite": "0.75 days",
     "status": "✅ done 2026-08-03 (9 of 9 slices)",
     "closed": true
    },
    {
     "phase": "08",
     "capability": "The feedback half of layer 5 — outcome metrics, calibration record, tags, suggestion…",
     "appetite": "1.5 days",
     "status": "✅ done 2026-08-03 (9 of 9 slices)",
     "closed": true
    }
   ],
   "src": "initiatives/develop/PROGRESS.md:3"
  },
  {
   "id": "engine",
   "room": "engine-room",
   "ring": "kernel",
   "status": "blocked",
   "cycle": "arc-engine (Cycle 7, opened 2026-08-12)",
   "currentPhase": "08",
   "phasesTotal": 9,
   "phasesClosed": 5,
   "waitingOn": "external — REQ-07: three real dispatches, which need the MAIN CLONE and an owner pack approval",
   "dependsOn": null,
   "appetite": {
    "value": "12d",
    "burn": "8.5d",
    "unit": "days (as stated; not weeks)"
   },
   "plan": "PLAN.md — arc engine · Cycle 7: \"The Hired Hands\"",
   "goal": "arc-run --process X --driver hermes executes an arc process on ONE external agent runtime under the",
   "next": "PHASES 06 AND 07 CLOSED 2026-08-23, CI 19/19 read per JOB at 67991185 with the head SHA confirmed. 6 of 8 REQs validate…",
   "position": "08",
   "phases": [
    {
     "phase": "00",
     "capability": "Steel thread — parked, shipped in Cycle 6 (canonical process layer, arc-run, driver …",
     "appetite": "—",
     "status": "✅ done 2026-08-03",
     "closed": true
    },
    {
     "phase": "04",
     "capability": "The law, and proof the hands exist — mandate receipt, ADR-0212 merged, runtime insta…",
     "appetite": "1 day",
     "status": "✅ done 2026-08-16",
     "closed": true
    },
    {
     "phase": "05",
     "capability": "The shim — drivers/hermes on the real 3-code contract, drivers/mock replay, two-surf…",
     "appetite": "1.5 days",
     "status": "✅ done 2026-08-17",
     "closed": true
    },
    {
     "phase": "06",
     "capability": "Certification or STOP — 12 fixtures green against the real runtime with receipts, pl…",
     "appetite": "2 days",
     "status": "✅ done 2026-08-23",
     "closed": true
    },
    {
     "phase": "07",
     "capability": "The hire — ONE reviewed router.yaml diff carrying the policy row and termination spe…",
     "appetite": "1 day",
     "status": "✅ done 2026-08-23",
     "closed": true
    },
    {
     "phase": "08",
     "capability": "The job — draft process authored, context-pack flow, ≥3 real runs with per-draft ver…",
     "appetite": "1.5 days",
     "status": "pending",
     "closed": false
    }
   ],
   "src": "initiatives/engine/PROGRESS.md:3"
  },
  {
   "id": "evolve",
   "room": "evolve",
   "ring": "kernel",
   "status": "idle",
   "cycle": "arc-evolve (Cycle 7, closed 2026-08-04)",
   "currentPhase": "— (cycle closed, merged as 8e80927 / PR #108; fixture-proven, unexercised)",
   "phasesTotal": 5,
   "phasesClosed": 5,
   "waitingOn": null,
   "dependsOn": null,
   "appetite": {
    "value": "7d",
    "burn": "7.0d",
    "unit": "days (as stated; not weeks)"
   },
   "plan": "PLAN.md — evolve v1: the self-improvement engine",
   "goal": "For arc's module surfaces: weekly scoreboards derived from the spine, bounded",
   "next": "/arc-kickoff --lane evolve when a real client names a surface",
   "position": "— (cycle closed, merged as 8e80927 / PR #108; fixture-proven, unexercised)",
   "phases": [
    {
     "phase": "00",
     "capability": "Contract + steel thread — manifest schema, product-lint extension, 8 kinds + validat…",
     "appetite": "1.5 days",
     "status": "✅ closed 2026-08-04",
     "closed": true
    },
    {
     "phase": "01",
     "capability": "Board — reader-only reducer; PENDING / staleness / MISSING / insufficient evidence; …",
     "appetite": "1.0 days",
     "status": "✅ closed 2026-08-04",
     "closed": true
    },
    {
     "phase": "02",
     "capability": "Runner + verdict math — assignment, seal, floors, TTL, the pinned test + reference v…",
     "appetite": "1.5 days",
     "status": "✅ closed 2026-08-04",
     "closed": true
    },
    {
     "phase": "03",
     "capability": "Promotion safety — four-hop SHA lineage, evidence table, inbox, watch, freeze, rever…",
     "appetite": "1.5 days",
     "status": "✅ closed 2026-08-04",
     "closed": true
    },
    {
     "phase": "04",
     "capability": "Council bridge — the designated cut, BUILT rather than cut",
     "appetite": "1.5 days",
     "status": "✅ closed 2026-08-04",
     "closed": true
    }
   ],
   "src": "initiatives/evolve/PROGRESS.md:3"
  },
  {
   "id": "face",
   "room": "toolbelt",
   "ring": "factory",
   "status": "awake",
   "cycle": "arc-face (Cycle 15, opened 2026-08-19)",
   "currentPhase": "06",
   "phasesTotal": 8,
   "phasesClosed": 0,
   "waitingOn": "nothing structural — the design gate is DISCHARGED. The owner supplied the design himself rather than picking from the explore rounds, so the PICK is moot and …",
   "dependsOn": "nothing external — L3 moved IN-REPO to face/ (ADR-1316 supersedes ADR-1300 on placement). A new repo could not be given ",
   "appetite": {
    "value": "32d",
    "burn": "14d",
    "unit": "days (as stated; not weeks)"
   },
   "plan": "PLAN.md — arc face v1: the working HQ",
   "goal": "One surface that IS arc operating — every product, lane, pipeline, gate, receipt kind and",
   "next": "The face RUNS, and the write path is PROVEN — a real decision.recorded written from the app through L2's /api/decide, w…",
   "position": "06",
   "phases": [
    {
     "phase": "00",
     "capability": "Brief + coverage contract — four contracts pass design-lint; Coverage map frozen as …",
     "appetite": "1d",
     "status": "built; owner \"purinjathu\" read outstanding",
     "closed": false
    },
    {
     "phase": "01",
     "capability": "Explore ×3 + design system — superseded by the owner’s reference: he supplied a runn…",
     "appetite": "5d",
     "status": "tokens CANONICALISED from docs/design/reference/face-hq/; explore rounds kept for the reco",
     "closed": false
    },
    {
     "phase": "03",
     "capability": "L2 arc dash — read door + spine-health reader + arc-inbox function extraction + deci…",
     "appetite": "4d",
     "status": "built, attacked twice, local green; CI verdict pending",
     "closed": false
    },
    {
     "phase": "04",
     "capability": "Shell — face/ L3 born IN-REPO (ADR-1316); Today · Inbox on the live L2 doors; five-r…",
     "appetite": "4d",
     "status": "BUILT and proven — a real decision.recorded written from the face",
     "closed": false
    },
    {
     "phase": "05",
     "capability": "Map + template + birth-rule + coverage — face: ×16 manifests + planned-rooms registr…",
     "appetite": "5d",
     "status": "BUILT — 33 stations, gate squares, coverage gate now watches 11 inventories",
     "closed": false
    },
    {
     "phase": "06",
     "capability": "Rooms — bespoke panels wave 1 (Council · Money · Leads · Growth · Engine · Evolve · …",
     "appetite": "5d",
     "status": "BUILT — all 33 rooms render: 22 generic · 2 index · 9 bespoke; swept and looked at",
     "closed": false
    },
    {
     "phase": "07",
     "capability": "Ask arc — face-ask process + router row + hq.policy.yaml row + 20 golden questions +…",
     "appetite": "3d",
     "status": "deterministic half BUILT and proven through the face (VERIFIED, citations resolved); model",
     "closed": false
    },
    {
     "phase": "08",
     "capability": "Dogfood — 5 real days from the main clone; journal↔receipt match; retro; HISTORY ent…",
     "appetite": "5d",
     "status": "pending (needs L3 + 5 real days)",
     "closed": false
    }
   ],
   "src": "initiatives/face/PROGRESS.md:3"
  },
  {
   "id": "growth",
   "room": "growth",
   "ring": "money",
   "status": "blocked",
   "cycle": "arc-growth (Cycle 14, opened 2026-08-12)",
   "currentPhase": "06",
   "phasesTotal": 7,
   "phasesClosed": 6,
   "waitingOn": "elapsed time — 7 days of a CRAWLED site. Google first discovered it 2026-08-19 (the 2026-08-16 flip started nothing: no sitemap was submitted and the site was …",
   "dependsOn": null,
   "appetite": {
    "value": "10d",
    "burn": "8.0d",
    "unit": "days (as stated; not weeks)"
   },
   "plan": "PLAN.md — growth v1: the content engine and evolve's first feed",
   "goal": "One command per channel on ONE site: arc growth mine finds real keyword evidence, a human",
   "next": "growth v1 — the content engine and evolve's first feed. BUILD WORK RESUMED 2026-08-16; Phase 01 is UN-PARKED. Cycle 14'…",
   "position": "06",
   "phases": [
    {
     "phase": "00",
     "capability": "Contract + the road + steel thread",
     "appetite": "2.0d",
     "status": "✅ DONE 2026-08-17 — all 11 criteria met. The steel thread ran for real: branch → PR #2 → p",
     "closed": true
    },
    {
     "phase": "01",
     "capability": "Name and instrument the site",
     "appetite": "1.0d (~2h lane work; rest is DNS + GSC lag)",
     "status": "✅ DONE 2026-08-19 — 6 criteria MET, criterion 5 NOT APPLICABLE (no pre-cutover receipt eve",
     "closed": true
    },
    {
     "phase": "02",
     "capability": "Miner + cluster gate",
     "appetite": "1.0d",
     "status": "✅ DONE 2026-08-14 — 6 criteria met, criterion 3 narrowed and its gap recorded; A-05 fired ",
     "closed": true
    },
    {
     "phase": "03",
     "capability": "Generator + lints",
     "appetite": "1.5d",
     "status": "✅ DONE 2026-08-14 — 7 of 8 criteria met; the exemplar APPROVAL is outstanding (owner). 35 ",
     "closed": true
    },
    {
     "phase": "04",
     "capability": "Publish path + A/B + GEO",
     "appetite": "1.5d",
     "status": "✅ DONE 2026-08-14 — guard is a parse, 3-escape mutant refused by name; criterion 5 live ha",
     "closed": true
    },
    {
     "phase": "05",
     "capability": "The EVO-H0 feed",
     "appetite": "1.5d",
     "status": "✅ DONE 2026-08-14 — FIXTURE-PROVEN, not live-validated: no GSC property, so no real CSV an",
     "closed": true
    },
    {
     "phase": "06",
     "capability": "Real week",
     "appetite": "1.25d",
     "status": "UN-PARKED 2026-08-17, blocked on ELAPSED TIME, and the clock was RESET on 2026-08-19. INDE",
     "closed": false
    }
   ],
   "src": "initiatives/growth/PROGRESS.md:4"
  },
  {
   "id": "leads",
   "room": "leads",
   "ring": "money",
   "status": "awake",
   "cycle": "arc-leads (Cycle 8, opened 2026-08-04)",
   "currentPhase": "03",
   "phasesTotal": 6,
   "phasesClosed": 4,
   "waitingOn": null,
   "dependsOn": null,
   "appetite": {
    "value": "11d",
    "burn": "7.5d",
    "unit": "days (as stated; not weeks)"
   },
   "plan": "PLAN.md — leads v1: the outbound engine",
   "goal": "arc-leads research ICP.json turns an ICP definition into a small, deeply-researched, evidence-backed",
   "next": "00, 01, 02 and 04 CLOSED. Phase 04 — arc sends its own mail (ADR-0415): 9 live messages through the real vendor, 9 deli…",
   "position": "03",
   "phases": [
    {
     "phase": "00",
     "capability": "Foundations — ADR-0410 store + secret + tripwire FIRST, ADR-0400 vocabulary + valida…",
     "appetite": "1.5d",
     "status": "✅ closed 2026-08-04",
     "closed": true
    },
    {
     "phase": "01",
     "capability": "Sequencer — caps, suppression, breakers, receipt-derived state, spine-first reconcil…",
     "appetite": "2.0d",
     "status": "✅ closed 2026-08-04",
     "closed": true
    },
    {
     "phase": "02",
     "capability": "Replies — ingestion, parser, triage, calendar drafts, auto-stop",
     "appetite": "1.0d",
     "status": "✅ closed 2026-08-05",
     "closed": true
    },
    {
     "phase": "03",
     "capability": "Rehearsal campaign (ADR-0416) — real provider bound to Resend, rehearsal mode allowl…",
     "appetite": "4.5d",
     "status": "⏳ in progress — 11 slices, 01–05 proven, 06 repaired on PR #150 across eleven adversarial ",
     "closed": false
    },
    {
     "phase": "04",
     "capability": "arc's own mail — ADR-0415 mailer interface + fake + Resend impl, owner allowlist + c…",
     "appetite": "1.0d",
     "status": "✅ closed 2026-08-08 — 9 live sends, 9 delivered, 74 tests. Closed with ONE row open by the",
     "closed": true
    },
    {
     "phase": "05",
     "capability": "Real campaign — dedicated cold domain, cold-outbound vendor, ≥25 sends to real ICP l…",
     "appetite": "1.0d",
     "status": "🚫 BLOCKED → PARKED to the next cycle 2026-08-08, taking its 1.0d with it",
     "closed": false
    }
   ],
   "src": "initiatives/leads/PROGRESS.md:3"
  },
  {
   "id": "ledger",
   "room": "money",
   "ring": "money",
   "status": "idle",
   "cycle": "arc-ledger (opened 2026-08-12, closed 2026-08-13)",
   "currentPhase": "03",
   "phasesTotal": 4,
   "phasesClosed": 4,
   "waitingOn": null,
   "dependsOn": null,
   "appetite": {
    "value": "8d",
    "burn": "7d",
    "unit": "days (as stated; not weeks)"
   },
   "plan": "PLAN.md — ledger · the money brain",
   "goal": "For Ashiq, arc gains its money brain: per-venture P&L truth derived only from spine receipts —",
   "next": "CYCLE CLOSED 2026-08-13 — 4/4 phases, 7/8 REQ validated, REQ-07 (--explain) CUT against the cap rather than after an ov…",
   "position": "03",
   "phases": [
    {
     "phase": "00",
     "capability": "Money math core — payload contract + PII validator, normalization, pnl math on pinne…",
     "appetite": "3d",
     "status": "✅ CLOSED 2026-08-13",
     "closed": true
    },
    {
     "phase": "01",
     "capability": "Kill-distance — ventures.yaml schema + parser, distance / warning / crossing render,…",
     "appetite": "2d",
     "status": "✅ CLOSED 2026-08-13",
     "closed": true
    },
    {
     "phase": "02",
     "capability": "Close and costs — reconciliation gate, month.closed (44 to 45), cost trichotomy + Ov…",
     "appetite": "2d",
     "status": "✅ CLOSED 2026-08-13",
     "closed": true
    },
    {
     "phase": "03",
     "capability": "Proof — real-spine replay rendering honest-empty, --simulated demo view, evidence bu…",
     "appetite": "1d",
     "status": "✅ CLOSED 2026-08-13",
     "closed": true
    }
   ],
   "src": "initiatives/ledger/PROGRESS.md:3"
  },
  {
   "id": "legal",
   "room": "legal",
   "ring": "money",
   "status": "awake",
   "cycle": "arc-legal (Cycle 14, opened 2026-08-12)",
   "currentPhase": "00",
   "phasesTotal": 4,
   "phasesClosed": 1,
   "waitingOn": null,
   "dependsOn": null,
   "appetite": {
    "value": "5d",
    "burn": "0d",
    "unit": "days (as stated; not weeks)"
   },
   "plan": "PLAN.md — legal pack: customer-facing policies per venture",
   "goal": "/arc-legal --venture NAME turns a per-venture facts file plus one pinned template set into seven",
   "next": "Born 2026-08-12 under the owner's Build-out Mandate (ADR-1000), receipt 01KZTM348858PDH44K4HA64CVA verified on the cano…",
   "position": "00",
   "phases": [
    {
     "phase": "00",
     "capability": "Steel thread — three core pages end to end: schema, render, three lints, hash fixtur…",
     "appetite": "2d",
     "status": "✅ 2026-08-13",
     "closed": true
    },
    {
     "phase": "01",
     "capability": "The full set and its receipts — remaining four pages, scenario fixtures, completenes…",
     "appetite": "1.5d",
     "status": "in progress",
     "closed": false
    },
    {
     "phase": "02",
     "capability": "Guards and governance — --verify, generated venture CI guard, pins + --bump-template…",
     "appetite": "0.5d",
     "status": "pending",
     "closed": false
    },
    {
     "phase": "03",
     "capability": "The real render — LexOS real facts, approval, commit into its tree, integration hand…",
     "appetite": "1d",
     "status": "pending",
     "closed": false
    }
   ],
   "src": "initiatives/legal/PROGRESS.md:3"
  },
  {
   "id": "memory",
   "room": "memory",
   "ring": "kernel",
   "status": "idle",
   "cycle": "arc-memory (Cycle 11, closed 2026-08-12)",
   "currentPhase": "— (cycle closed 2026-08-12, 3/3 phases, 7/8 REQ validated + 1 cut; merged to main 2026-08-12 as 9581011)",
   "phasesTotal": 3,
   "phasesClosed": 3,
   "waitingOn": null,
   "dependsOn": null,
   "appetite": {
    "value": "5d",
    "burn": "3.75d",
    "unit": "days (as stated; not weeks)"
   },
   "plan": "PLAN.md — arc-memory \"playbooks + recall\"",
   "goal": "arc-recall \"how did we get burned by this before\" gives any session — human or process, in arc",
   "next": "CLOSED 2026-08-12 — 3/3 phases, 7/8 REQ validated, REQ-07 CUT on its own measurement, 75% of 5d with every phase under …",
   "position": "— (cycle closed 2026-08-12, 3/3 phases, 7/8 REQ validated + 1 cut; merged to main 2026-08…",
   "phases": [
    {
     "phase": "00",
     "capability": "The index exists and is honest — 5 adapters, count-verified, named exclusions, atomi…",
     "appetite": "1.5d",
     "status": "✅ closed 2026-08-11",
     "closed": true
    },
    {
     "phase": "01",
     "capability": "Recall people can trust — CLI, sanitization, aliases, citations, <1s on 3 OSes, root…",
     "appetite": "1.75d",
     "status": "✅ closed 2026-08-11",
     "closed": true
    },
    {
     "phase": "02",
     "capability": "Decisions, conflicts, proof — --decisions, write-time conflict check, review hook, g…",
     "appetite": "1.25d",
     "status": "✅ closed 2026-08-12",
     "closed": true
    }
   ],
   "src": "initiatives/memory/PROGRESS.md:3"
  },
  {
   "id": "model-policy",
   "room": "model-policy",
   "ring": "kernel",
   "status": "idle",
   "cycle": "model-policy (Cycle 5, closed 2026-08-02)",
   "currentPhase": "— (cycle closed)",
   "phasesTotal": 4,
   "phasesClosed": 4,
   "waitingOn": null,
   "dependsOn": null,
   "appetite": {
    "value": "3d",
    "burn": "0.7d",
    "unit": "days (as stated; not weeks)"
   },
   "plan": "PLAN.md — Balanced Model Policy (pre-engine model discipline)",
   "goal": "One sentence: arc's model usage stops being taste-encoded-in-frontmatter — a written,",
   "next": "/arc-kickoff --lane model-policy when a new cycle pulls it",
   "position": "— (cycle closed)",
   "phases": [
    {
     "phase": "00",
     "capability": "Steel thread — the Balanced Model Policy ADR-0069 written (blocks a–g), linted, merg…",
     "appetite": "0.5 days",
     "status": "✅ done 2026-08-02",
     "closed": true
    },
    {
     "phase": "01",
     "capability": "Council standard mode + one real run; session-001 retrofit + honest grade-or-UNRESOL…",
     "appetite": "0.75 days",
     "status": "✅ done 2026-08-02",
     "closed": true
    },
    {
     "phase": "02",
     "capability": "Paired composer A/B at one pinned commit; blind 7-item rankings; keep/revert ADR (RE…",
     "appetite": "1.25 days",
     "status": "✅ done 2026-08-02",
     "closed": true
    },
    {
     "phase": "03",
     "capability": "Attacker reject-log with fixed taxonomy (REQ-05) + mode-ladder dogfood + retro",
     "appetite": "0.5 days",
     "status": "✅ done 2026-08-02",
     "closed": true
    }
   ],
   "src": "initiatives/model-policy/PROGRESS.md:3"
  },
  {
   "id": "policy",
   "room": "policy",
   "ring": "kernel",
   "status": "idle",
   "cycle": "arc-policy (Cycle 9, closed 2026-08-10)",
   "currentPhase": "— (cycle closed, merged as 677b67e / PR #130, closed by e594d6e / PR #147)",
   "phasesTotal": 5,
   "phasesClosed": 5,
   "waitingOn": null,
   "dependsOn": null,
   "appetite": {
    "value": "7d",
    "burn": "7.0d",
    "unit": "days (as stated; not weeks)"
   },
   "plan": "PLAN.md — Policy Engine: enforced capability vectors",
   "goal": "One sentence: autonomy stops being human discipline — hq.policy.yaml becomes machine-enforced",
   "next": "CLOSED 2026-08-10 — 5/5 phases, and the engine is FIXTURE-PROVEN, UNEXERCISED. Counted on the canonical spine at close:…",
   "position": "— (cycle closed, merged as 677b67e / PR #130, closed by e594d6e / PR #147)",
   "phases": [
    {
     "phase": "00",
     "capability": "Steel thread — the law, its parser and the decision: schema, canonical L0–L3 table, …",
     "appetite": "2 days",
     "status": "✅ done 2026-08-06",
     "closed": true
    },
    {
     "phase": "01",
     "capability": "Headless enforcement — wire the Phase-0 decision into arc-run before any driver call…",
     "appetite": "1.25 days",
     "status": "✅ done 2026-08-07",
     "closed": true
    },
    {
     "phase": "02",
     "capability": "Receipts and interactive — vocab ADR (+4 kinds), promotion chain end-to-end through …",
     "appetite": "1.25 days",
     "status": "✅ done 2026-08-07",
     "closed": true
    },
    {
     "phase": "03",
     "capability": "Birth-rule and cap inventory, migration deferred by evidence",
     "appetite": "0.25 days",
     "status": "✅ done 2026-08-08",
     "closed": true
    },
    {
     "phase": "04",
     "capability": "Adversarial security pass — two full days, untouchable",
     "appetite": "2 days",
     "status": "✅ done 2026-08-10",
     "closed": true
    }
   ],
   "src": "initiatives/policy/PROGRESS.md:3"
  },
  {
   "id": "portfolio",
   "room": "board",
   "ring": "command",
   "status": "idle",
   "cycle": "arc-portfolio (Cycle 4, closed 2026-08-02)",
   "currentPhase": "— (no live cycle)",
   "phasesTotal": 4,
   "phasesClosed": 4,
   "waitingOn": null,
   "dependsOn": null,
   "appetite": {
    "value": "3d",
    "burn": "3.35d",
    "unit": "days (as stated; not weeks)"
   },
   "plan": "PLAN.md — Cycle 4 · arc-portfolio \"The Conductor\"",
   "goal": "For Ashiq, arc gains The Conductor — multi-lane workspaces (initiatives/{lane}/ per",
   "next": "/arc-kickoff --lane portfolio when a new cycle starts",
   "position": "— (no live cycle)",
   "phases": [
    {
     "phase": "00",
     "capability": "Dual-mode machinery (steel thread): root goldens, resolver on 7 surfaces, creation/S…",
     "appetite": "1.25 days",
     "status": "✅ done 2026-07-31",
     "closed": true
    },
    {
     "phase": "01",
     "capability": "Self-host + link history + board v1 (rehearsed rollback; close in lane-mode)",
     "appetite": "0.75 days",
     "status": "✅ done 2026-07-31",
     "closed": true
    },
    {
     "phase": "02",
     "capability": "Parallel-safety floor: WIP info line, board lint, ownership lint, spine spool (rever…",
     "appetite": "0.75 days",
     "status": "✅ done 2026-08-01",
     "closed": true
    },
    {
     "phase": "03",
     "capability": "Docs truth + retro",
     "appetite": "0.25 days",
     "status": "✅ done 2026-08-02",
     "closed": true
    }
   ],
   "src": "initiatives/portfolio/PROGRESS.md:3"
  },
  {
   "id": "scheduler",
   "room": "scheduler",
   "ring": "kernel",
   "status": "blocked",
   "cycle": "arc-scheduler (Cycle 12, opened 2026-08-12)",
   "currentPhase": "03",
   "phasesTotal": 4,
   "phasesClosed": 3,
   "waitingOn": "elapsed time — the proving week RESTARTED 2026-08-17 (a defect made every run after the first a no-op), and the fire-drill armed 2026-08-23 needs its THIRD mis…",
   "dependsOn": null,
   "appetite": {
    "value": "3d",
    "burn": "2.5d",
    "unit": "days (as stated; not weeks)"
   },
   "plan": "PLAN.md — arc-scheduler \"the heartbeat\"",
   "goal": "Turn every daily arc chore into a receipted, budgeted, policy-checked headless run — a jobs file",
   "next": "Phases 00, 01 and 02 CLOSED; merged as 4b7410b (PR #163). The heartbeat is INSTALLED: both v1 jobs registered on the re…",
   "position": "03",
   "phases": [
    {
     "phase": "00",
     "capability": "Steel thread — hq.jobs.yaml + jobs-lint (hostile corpus + adversarial pass) + wrappe…",
     "appetite": "1.0d",
     "status": "✅ done 2026-08-12",
     "closed": true
    },
    {
     "phase": "01",
     "capability": "The attended heartbeat — run / catchup / list --next 7, read-only SessionStart nudge…",
     "appetite": "0.5d",
     "status": "✅ done 2026-08-12",
     "closed": true
    },
    {
     "phase": "02",
     "capability": "The cron flip — register/unregister with ADR-0803's five explicit settings, next-min…",
     "appetite": "0.75d",
     "status": "✅ done 2026-08-13",
     "closed": true
    },
    {
     "phase": "03",
     "capability": "Proving week + retro — ≥2 jobs unattended ≥7d, zero manual starts by actor query, fi…",
     "appetite": "0.5d",
     "status": "⏳ running — clock RESTARTED 2026-08-17, fire-drill armed 2026-08-23, earliest close 2026-0",
     "closed": false
    }
   ],
   "src": "initiatives/scheduler/PROGRESS.md:3"
  }
 ],
 "portfolioBands": [
  {
   "band": "0001–0099",
   "owner": "company / core / hq — model-policy's Cycle 5 holds 0063–0071 inside this range"
  },
  {
   "band": "0100–0199",
   "owner": "develop"
  },
  {
   "band": "0200–0299",
   "owner": "engine — claimed at birth, 2026-08-03 (0200–0219 taken). 0207 was written by me…"
  },
  {
   "band": "0300–0399",
   "owner": "evolve — claimed at birth, 2026-08-03 (0300–0310 taken)"
  },
  {
   "band": "0400–0499",
   "owner": "leads — claimed at birth, 2026-08-04 (0400–0413 taken)"
  },
  {
   "band": "0500–0599",
   "owner": "policy — claimed at birth, 2026-08-06 (0500–0508 taken)"
  },
  {
   "band": "0600–0699",
   "owner": "absorb — claimed at birth, 2026-08-09 (0600–0606 taken)"
  },
  {
   "band": "0700–0799",
   "owner": "memory — claimed at birth, 2026-08-11 (0700–0709 taken); merged to main 2026-08…"
  },
  {
   "band": "0800–0899",
   "owner": "scheduler — claimed at birth, 2026-08-12 (0800–0806 taken). Pushed as feat/arc-…"
  },
  {
   "band": "0900–0999",
   "owner": "bench — claimed at birth, 2026-08-12 (0900–0914 taken)"
  },
  {
   "band": "1000–1099",
   "owner": "ledger — claimed at birth, 2026-08-12 (1000–1018 taken — 1016 refunds-are-linke…"
  },
  {
   "band": "1100–1199",
   "owner": "growth — renumbered from 1000–1099 on 2026-08-13, having originally claimed 100…"
  },
  {
   "band": "1200–1299",
   "owner": "legal — reserved by the growth lane's merge, and CONFIRMED + RENUMBERED by the …"
  },
  {
   "band": "1300–1399",
   "owner": "face — claimed at birth, 2026-08-19 (1300–1315 taken; the claim swept all 18 si…"
  },
  {
   "band": "1400–1499",
   "owner": "next lane to be born"
  }
 ],
 "policy": {
  "file": "hq.policy.yaml",
  "version": "version: 1",
  "preamble": [
   "hq.policy.yaml -- the human-declared CEILING (POL-A, ADR-0500..0507).",
   "This file is law. policy-lint FAILS FROM BIRTH on any violation: it is a validator, not an",
   "Changing a ceiling here is a REPO EDIT in a reviewed diff -- never an agent action. The other",
   "key, the event-earned cap, is folded from the spine and can only rise by a human",
   "policy.level.changed citing trial-ledger evidence. effective = min(ceiling, cap).",
   "Every pair is born at L1. Nothing in this file grants execution by itself."
  ],
  "ladder": {
   "L0": "denied -- the capability is unavailable; no call is attempted",
   "L1": "propose -- prepared and recorded, never executed; the birth level of every pair",
   "L2": "bounded -- executes only within the bound declared in this grant",
   "L3": "unbounded within the capability; human-granted only; never on a kind with a non-empty e2"
  },
  "twoKeys": [
   {
    "key": "ceiling",
    "text": "Changing a ceiling here is a REPO EDIT in a reviewed diff -- never an agent action. The other",
    "src": "hq.policy.yaml:7"
   },
   {
    "key": "cap",
    "text": "The other key, the event-earned cap, is folded from the spine and can only rise by a human policy.level.changed citing trial-ledger evidence.",
    "src": "hq.policy.yaml:8-9"
   },
   {
    "key": "effective",
    "text": "effective = min(ceiling, cap)",
    "src": "hq.policy.yaml:9"
   },
   {
    "key": "birth",
    "text": "Every pair is born at L1. Nothing in this file grants execution by itself.",
    "src": "hq.policy.yaml:11"
   }
  ],
  "defaults": [
   {
    "key": "denyByDefault",
    "text": "here is read-only at L1 and nothing else (POL-B). Nothing is granted above L1 today: the",
    "src": "hq.policy.yaml:93"
   },
   {
    "key": "noJobWithoutRow",
    "text": "Deny-by-default: no row in the policy file, no job.",
    "src": "hq.jobs.yaml:18"
   },
   {
    "key": "shellCeiling",
    "text": "L1 for a kind whose write, network and spend are ALL already that high. Since spend can",
    "src": "hq.policy.yaml:100"
   }
  ],
  "ungrantableActions": [
   "moving money",
   "killing a venture",
   "changing prices",
   "unlocking real-money trading",
   "publishing under Ashiq's name"
  ],
  "ungrantableResources": [
   ".claude/settings.json",
   ".claude/settings.local.json",
   ".claude/hooks/**",
   "hq.policy.yaml",
   ".claude/scripts/hq/lib/policy/**",
   ".claude/scripts/hq/policy-lint.mjs",
   ".claude/scripts/hq/policy-matrix.mjs"
  ],
  "targets": {
   "note": "message/publish/deploy targets are closed enums, EMPTY: no live consumer yet",
   "items": [
    "message: []",
    "publish: []",
    "deploy: []"
   ]
  },
  "subjects": [
   {
    "subject": "session:interactive",
    "ceiling": "L3 (read only)",
    "notes": "the one reserved non-process subject (ADR-0504)",
    "e2": [],
    "capabilities": {
     "read": {
      "level": "L3",
      "roots": null,
      "note": null
     },
     "write": {
      "level": "L2",
      "roots": [
       "initiatives/**",
       "docs/**",
       "tests/**"
      ],
      "note": null
     },
     "shell": {
      "level": "L1",
      "roots": null,
      "note": null
     },
     "network": {
      "level": "L1",
      "roots": null,
      "note": null
     },
     "message": {
      "level": "L0",
      "roots": null,
      "note": null
     },
     "publish": {
      "level": "L0",
      "roots": null,
      "note": null
     },
     "deploy": {
      "level": "L0",
      "roots": null,
      "note": null
     },
     "spend": {
      "level": "L0",
      "roots": null,
      "note": null
     }
    },
    "src": "hq.policy.yaml:104"
   },
   {
    "subject": "process:kickoff-plan",
    "ceiling": "L3 (read only)",
    "notes": "processes/kickoff-plan.process.yaml",
    "e2": [],
    "capabilities": {
     "read": {
      "level": "L3",
      "roots": null,
      "note": null
     },
     "write": {
      "level": "L2",
      "roots": [
       "initiatives/**",
       "docs/adr/**"
      ],
      "note": null
     },
     "shell": {
      "level": "L1",
      "roots": null,
      "note": null
     },
     "network": {
      "level": "L1",
      "roots": null,
      "note": null
     },
     "message": {
      "level": "L0",
      "roots": null,
      "note": null
     },
     "publish": {
      "level": "L0",
      "roots": null,
      "note": null
     },
     "deploy": {
      "level": "L0",
      "roots": null,
      "note": null
     },
     "spend": {
      "level": "L0",
      "roots": null,
      "note": null
     }
    },
    "src": "hq.policy.yaml:115"
   },
   {
    "subject": "process:review-diff",
    "ceiling": "L3 (read only)",
    "notes": "processes/review-diff.process.yaml",
    "e2": [],
    "capabilities": {
     "read": {
      "level": "L3",
      "roots": null,
      "note": null
     },
     "write": {
      "level": "L1",
      "roots": null,
      "note": null
     },
     "shell": {
      "level": "L1",
      "roots": null,
      "note": null
     },
     "network": {
      "level": "L1",
      "roots": null,
      "note": null
     },
     "message": {
      "level": "L0",
      "roots": null,
      "note": null
     },
     "publish": {
      "level": "L0",
      "roots": null,
      "note": null
     },
     "deploy": {
      "level": "L0",
      "roots": null,
      "note": null
     },
     "spend": {
      "level": "L0",
      "roots": null,
      "note": null
     }
    },
    "src": "hq.policy.yaml:126"
   },
   {
    "subject": "process:commit-msg-draft",
    "ceiling": "L3 (read only)",
    "notes": "processes/commit-msg-draft.process.yaml",
    "e2": [],
    "capabilities": {
     "read": {
      "level": "L3",
      "roots": null,
      "note": null
     },
     "write": {
      "level": "L0",
      "roots": null,
      "note": null
     },
     "shell": {
      "level": "L1",
      "roots": null,
      "note": null
     },
     "network": {
      "level": "L1",
      "roots": null,
      "note": null
     },
     "message": {
      "level": "L0",
      "roots": null,
      "note": null
     },
     "publish": {
      "level": "L0",
      "roots": null,
      "note": null
     },
     "deploy": {
      "level": "L0",
      "roots": null,
      "note": null
     },
     "spend": {
      "level": "L0",
      "roots": null,
      "note": null
     }
    },
    "src": "hq.policy.yaml:137"
   },
   {
    "subject": "process:brief-materialize",
    "ceiling": "L3 (read only)",
    "notes": "processes/brief-materialize.process.yaml",
    "e2": [],
    "capabilities": {
     "read": {
      "level": "L3",
      "roots": null,
      "note": null
     },
     "write": {
      "level": "L2",
      "roots": [
       ".claude/state/hq/**"
      ],
      "note": null
     },
     "shell": {
      "level": "L1",
      "roots": null,
      "note": null
     },
     "network": {
      "level": "L0",
      "roots": null,
      "note": null
     },
     "message": {
      "level": "L0",
      "roots": null,
      "note": null
     },
     "publish": {
      "level": "L0",
      "roots": null,
      "note": null
     },
     "deploy": {
      "level": "L0",
      "roots": null,
      "note": null
     },
     "spend": {
      "level": "L0",
      "roots": null,
      "note": null
     }
    },
    "src": "hq.policy.yaml:164"
   },
   {
    "subject": "process:day-close-roll",
    "ceiling": "L3 (read only)",
    "notes": "processes/day-close-roll.process.yaml",
    "e2": [],
    "capabilities": {
     "read": {
      "level": "L3",
      "roots": null,
      "note": null
     },
     "write": {
      "level": "L2",
      "roots": [
       ".claude/state/hq/**"
      ],
      "note": null
     },
     "shell": {
      "level": "L1",
      "roots": null,
      "note": null
     },
     "network": {
      "level": "L0",
      "roots": null,
      "note": null
     },
     "message": {
      "level": "L0",
      "roots": null,
      "note": null
     },
     "publish": {
      "level": "L0",
      "roots": null,
      "note": null
     },
     "deploy": {
      "level": "L0",
      "roots": null,
      "note": null
     },
     "spend": {
      "level": "L0",
      "roots": null,
      "note": null
     }
    },
    "src": "hq.policy.yaml:175"
   },
   {
    "subject": "process:build-in-public-draft",
    "ceiling": "L3 (read only)",
    "notes": "processes/build-in-public-draft.process.yaml",
    "e2": [],
    "capabilities": {
     "read": {
      "level": "L3",
      "roots": null,
      "note": null
     },
     "write": {
      "level": "L0",
      "roots": null,
      "note": null
     },
     "shell": {
      "level": "L0",
      "roots": null,
      "note": null
     },
     "network": {
      "level": "L1",
      "roots": null,
      "note": null
     },
     "message": {
      "level": "L0",
      "roots": null,
      "note": null
     },
     "publish": {
      "level": "L0",
      "roots": null,
      "note": null
     },
     "deploy": {
      "level": "L0",
      "roots": null,
      "note": null
     },
     "spend": {
      "level": "L0",
      "roots": null,
      "note": null
     }
    },
    "src": "hq.policy.yaml:186"
   }
  ],
  "docsRules": [
   "Irreversible actions belong to the human alone: moving money, killing a venture,",
   "changing prices, unlocking real-money trading, publishing under Ashiq's name. No level",
   "Every automation can be stopped, rolled back, and demoted. An incident demotes autonomy",
   "LLM output is a draft until a deterministic check or a human verifies it. Gates promote",
   "ADR 0504 — An action kind is the authorization subject: process:NAME or session:interactive",
   "ADR 0507 — No capability may be used to exceed another capability's grant; shell is capped at the min of what its programs can reproduce",
   "ADR 0502 — Un-grantable resources: settings, the policy file and the hook dir are excluded from every write grant"
  ],
  "adrs": [
   {
    "adr": "0500",
    "title": "POL-K: lane policy, ADR century 0500, policy library lives in hq (an optional policy product is an install-ti…",
    "status": "accepted"
   },
   {
    "adr": "0501",
    "title": "Fail-closed at the interactive surface is two layers — hooks decide, permissions.deny is the floor that holds…",
    "status": "accepted"
   },
   {
    "adr": "0502",
    "title": "Un-grantable resources: settings, the policy file and the hook dir are excluded from every write grant, regar…",
    "status": "accepted"
   },
   {
    "adr": "0503",
    "title": "MCP tools are in-scope capability surfaces, scoped to the four servers in this repo's .mcp.json",
    "status": "accepted"
   },
   {
    "adr": "0504",
    "title": "An action kind is the authorization subject — process:NAME from processes/, plus one reserved session:interac…",
    "status": "accepted"
   },
   {
    "adr": "0505",
    "title": "Authority is keyed per (action kind, capability) pair everywhere, and a demotion bites only the capability in…",
    "status": "accepted"
   },
   {
    "adr": "0506",
    "title": "E2 binds to grants through a mandatory e2: declaration per kind (plus an unconditional spend rule), and quote…",
    "status": "accepted"
   },
   {
    "adr": "0507",
    "title": "No capability may be used to exceed another capability's grant — shell is capped at the minimum of every capa…",
    "status": "accepted"
   },
   {
    "adr": "0508",
    "title": "The four authority receipts extend the closed vocabulary 40 -> 44 (POL-E). Two kinds per direction, because a…",
    "status": "accepted"
   }
  ]
 },
 "modelPolicy": {
  "routerFile": "engine/router.yaml",
  "notes": [
   "THIS FILE IS THE IMPLEMENTATION OF A POLICY, NOT A POLICY.",
   "NO AUTO-UPDATING (a declared no-go). Nothing writes to this file at run time. Every change",
   "rather than letting an environment variable escalate a run silently.",
   "codex and generic-api have no entry on purpose: ADR-0069's implementation v1 is a CLAUDE"
  ],
  "tiers": [
   "cheap-scan",
   "balanced-workhorse",
   "high-judgment",
   "independent-family-verifier"
  ],
  "models": [
   {
    "tier": "cheap-scan",
    "model": "haiku",
    "src": "engine/router.yaml:33"
   },
   {
    "tier": "balanced-workhorse",
    "model": "sonnet",
    "src": "engine/router.yaml:35"
   },
   {
    "tier": "high-judgment",
    "model": "opus",
    "src": "engine/router.yaml:37"
   }
  ],
  "tierDefs": [
   {
    "tier": "cheap-scan",
    "meaning": "Mechanical enumeration and retrieval. Reads a lot, decides nothing. A wrong answer is visibly wrong and cheap to redo."
   },
   {
    "tier": "balanced-workhorse",
    "meaning": "Bounded, structured production: research, drafting, critique against a given standard, tool-driving. Judgment inside a frame someone else set."
   },
   {
    "tier": "high-judgment",
    "meaning": "Grades other work, gates a decision, or makes a call that is expensive to reverse. The seat where being under-powered is invisible until it is costly."
   },
   {
    "tier": "independent-family-verifier",
    "meaning": "Checks work produced by a *different model family*, specifically to break same-model correlation. The tier exists because agreement between two instances of on…"
   }
  ],
  "unmapped": {
   "tier": "independent-family-verifier",
   "text": "no model mapping in router.yaml; ADR-0069 table says: no default — see below"
  },
  "classes": [
   {
    "cls": "commit-msg-draft",
    "tier": "balanced-workhorse",
    "driver": "claude-code",
    "fallback": [
     "codex",
     "generic-api"
    ],
    "cap": null,
    "hosted": null,
    "judge": null,
    "review_by": null,
    "src": "engine/router.yaml:57"
   },
   {
    "cls": "review-diff",
    "tier": "high-judgment",
    "driver": "claude-code",
    "fallback": [
     "codex"
    ],
    "cap": null,
    "hosted": null,
    "judge": null,
    "review_by": null,
    "src": "engine/router.yaml:64"
   },
   {
    "cls": "kickoff-plan",
    "tier": "high-judgment",
    "driver": "claude-code",
    "fallback": [],
    "cap": null,
    "hosted": null,
    "judge": null,
    "review_by": null,
    "src": "engine/router.yaml:72"
   },
   {
    "cls": "build-in-public-draft",
    "tier": "balanced-workhorse",
    "driver": "hermes",
    "fallback": [],
    "cap": "L1-drafts",
    "hosted": "cloud",
    "judge": "ashiq",
    "review_by": "2026-08-31",
    "src": "engine/router.yaml:143"
   },
   {
    "cls": "face-ask",
    "tier": "balanced-workhorse",
    "driver": "claude-code",
    "fallback": [],
    "cap": null,
    "hosted": null,
    "judge": null,
    "review_by": null,
    "src": "engine/router.yaml:193"
   }
  ],
  "default": {
   "tier": "balanced-workhorse",
   "driver": "claude-code"
  },
  "egressHosts": [
   "openrouter.ai:443"
  ],
  "egressRules": [
   "EXACT host:port ONLY. No wildcards, no suffix rules, no bare hostnames:",
   "CHANGING THIS FILE CHANGES THE CONFIG HASH, which is the point. A widened allowlist is a reviewed"
  ],
  "adr0069": {
   "title": "ADR 0069 — the Balanced Model Policy",
   "oneLiner": "This ADR is the policy the engine inherits. It defines tiers, states what must never"
  },
  "lane": null
 },
 "scheduler": {
  "file": "hq.jobs.yaml",
  "ceiling": "monthly_ceiling_inr: 0",
  "defaults": "catchup: skip",
  "grammar": [
   "Cadences are IST and the grammar is closed to two forms, daily@HH:MM and weekdays@HH:MM.",
   "BLOCK STYLE ONLY. This file is parsed by the SAME frozen subset the engine uses",
   "policy_kind names a SUBJECT in the live hq.policy.yaml, not an action. ADR-0504 closes",
   "Deny-by-default: no row in the policy file, no job."
  ],
  "heartbeat": [
   "The heartbeat's first duty is sealing the books. At 00:15 the previous day's events are",
   "PLAN.md — arc-scheduler \"the heartbeat\"",
   "| REQ-04 | The heartbeat runs unattended, and turns itself off rather than run unpoliced | register/unregister drive the ScheduledTasks module with all 5 power…",
   "record: a dead heartbeat is only visible when a brief renders; mitigation is Task",
   "| 0804 | the laptop is never woken; missed slots are caught on next wake | accepted |",
   "| 0803 | register via the PowerShell ScheduledTasks module, every power setting explicit | accepted |"
  ],
  "jobs": [
   {
    "name": "brief-materialize",
    "type": "script",
    "entry": ".claude/scripts/hq/jobs/brief-materialize.mjs",
    "budgetMin": 2,
    "level": "process:brief-materialize",
    "schedule": "weekdays@06:00",
    "enabled": true,
    "catchup": null,
    "notes": "The morning read, made zero-effort. Renders today's brief into instance state, never into the repo: a brief is a view of the spine at a moment, and committing …",
    "src": "hq.jobs.yaml:34"
   },
   {
    "name": "day-close-roll",
    "type": "script",
    "entry": ".claude/scripts/hq/jobs/day-close-roll.mjs",
    "budgetMin": 2,
    "level": "process:day-close-roll",
    "schedule": "daily@00:15",
    "enabled": true,
    "catchup": "run",
    "notes": "The heartbeat's first duty is sealing the books. At 00:15 the previous day's events are complete, and catchup: run plus an idempotent multi-day roll means a sl…",
    "src": "hq.jobs.yaml:50"
   }
  ],
  "stateFiles": {
   "jobLogs": [
    ".claude/state/hq/job-logs/brief-materialize.log",
    ".claude/state/hq/job-logs/day-close-roll.log"
   ],
   "briefs": [
    ".claude/state/hq/briefs/2026-08-17.txt",
    ".claude/state/hq/briefs/2026-08-18.txt",
    ".claude/state/hq/briefs/2026-08-19.txt",
    ".claude/state/hq/briefs/2026-08-21.txt"
   ],
   "closedDays": {
    "count": 26,
    "note": "events/<day>.closed markers written by day-close-roll"
   }
  },
  "phases": [
   {
    "phase": "00",
    "capability": "Steel thread — hq.jobs.yaml + jobs-lint (hostile corpus + adversarial pass) + wrappe…",
    "appetite": "1.0d",
    "status": "✅ done 2026-08-12",
    "closed": true
   },
   {
    "phase": "01",
    "capability": "The attended heartbeat — run / catchup / list --next 7, read-only SessionStart nudge…",
    "appetite": "0.5d",
    "status": "✅ done 2026-08-12",
    "closed": true
   },
   {
    "phase": "02",
    "capability": "The cron flip — register/unregister with ADR-0803's five explicit settings, next-min…",
    "appetite": "0.75d",
    "status": "✅ done 2026-08-13",
    "closed": true
   },
   {
    "phase": "03",
    "capability": "Proving week + retro — ≥2 jobs unattended ≥7d, zero manual starts by actor query, fi…",
    "appetite": "0.5d",
    "status": "⏳ running — clock RESTARTED 2026-08-17, fire-drill armed 2026-08-23, earliest close 2026-0",
    "closed": false
   }
  ]
 },
 "memory": {
  "retro": [
   {
    "date": "2026-08-12",
    "lane": "arc-memory",
    "kind": "pattern",
    "correction": "Deleting a hook whole git subprocess left its suite byte-identical: all nine tests passed --paths while the compiled co…",
    "lesson": "the suite drives the argument the COMPILED command actually passes, checked by reading the generated command …",
    "tags": "testing,vacuous-pass,hook,generated",
    "promoted": false,
    "src": "docs/retro-log.md:96"
   },
   {
    "date": "2026-08-12",
    "lane": "arc-memory",
    "kind": "pattern",
    "correction": "A closed enum was enforced on the field NAME and never on the field VALUES, so verdict:Reject returned a confident zero…",
    "lesson": "a filter term that can never match ANY member of a closed set is refused at parse time and enumerates the set…",
    "tags": "filter,closed-set,silent-failure",
    "promoted": false,
    "src": "docs/retro-log.md:97"
   },
   {
    "date": "2026-08-12",
    "lane": "arc-memory",
    "kind": "pattern",
    "correction": "A backtick inside a DOUBLE-quoted shell string ran as a command -- and it landed in the comment written to explain the …",
    "lesson": "a program embedded in a shell string carries no BACKTICK and no dollar sign either, not only no apostrophe: a…",
    "tags": "shell,quoting,tooling,ci",
    "promoted": false,
    "src": "docs/retro-log.md:99"
   },
   {
    "date": "2026-08-12",
    "lane": "arc-memory",
    "kind": "pattern",
    "correction": "A push created no CI run at all: the commit became the draft PR head and no arc-ci run was ever generated, while every …",
    "lesson": "before waiting on CI, confirm a run EXISTS whose headSha is your HEAD -- waiting on a run that was never crea…",
    "tags": "ci,verification,tooling",
    "promoted": false,
    "src": "docs/retro-log.md:100"
   },
   {
    "date": "2026-08-12",
    "lane": "arc-memory",
    "kind": "pattern",
    "correction": "A tracker burn figure read 55% while the true figure was 75%: it was set before the last phase was built, never re-deri…",
    "lesson": "a derived number is re-derived at the close that reads it, never carried forward -- and when it moves, the co…",
    "tags": "measurement,tracker,counts-rot",
    "promoted": false,
    "src": "docs/retro-log.md:101"
   },
   {
    "date": "2026-08-12",
    "lane": "arc-memory",
    "kind": "pattern",
    "correction": "A retro edited a file INSIDE a sealed evidence bundle: the artifact is the running fixed-defect list, so amending it fe…",
    "lesson": "a retro amends the DECISION that defines a practice (the ADR), never the sealed evidence bundle that recorded…",
    "tags": "tail` reported exit 0 over the word TAMPERED",
    "promoted": false,
    "src": "docs/retro-log.md:102"
   },
   {
    "date": "2026-08-12",
    "lane": "arc-memory",
    "kind": "pattern",
    "correction": "A suite pinned its registered-test count as a literal 71 and went red for adding a test, while the suite next door DERI…",
    "lesson": "derive a count from the file and compare the two numbers against each other, never pin a snapshot; and when t…",
    "tags": "testing,snapshot,sweep,twin-fix",
    "promoted": false,
    "src": "docs/retro-log.md:103"
   },
   {
    "date": "2026-08-13",
    "lane": "arc-bench",
    "kind": "pattern",
    "correction": "A Node main guard compared process.argv[1] to import.meta.url and the CLI EXITED 0 DOING NOTHING behind a symlink -- ma…",
    "lesson": "realpath BOTH sides of a main guard, or use the suffix-regex form lane-resolve/learning/stuck/spine already u…",
    "tags": "node,esm,symlink,twin-fix,silent-failure",
    "promoted": true,
    "src": "docs/retro-log.md:104"
   },
   {
    "date": "2026-08-13",
    "lane": "arc-bench",
    "kind": "pattern",
    "correction": "Two fresh adversarial surfaces returned 23 confirmed holes with almost NO overlap between them -- 15 on decision logic,…",
    "lesson": "this is the second measurement of the same claim (Cycle 6 was the first), so treat it as settled: a single at…",
    "tags": "adversarial,verification,blind-spot,ci,matrix",
    "promoted": false,
    "src": "docs/retro-log.md:105"
   },
   {
    "date": "2026-08-13",
    "lane": "arc-bench",
    "kind": "pattern",
    "correction": "A weigh-tests pass measured five files at 14-22s while they were CRASHING at startup, and their real weights are 32-80s…",
    "lesson": "a measurement pass is only valid on a tree where the thing measured PASSES: read the rc of every sample, reta…",
    "tags": "measurement,ci,shard,merge,silent-failure",
    "promoted": false,
    "src": "docs/retro-log.md:106"
   },
   {
    "date": "2026-08-13",
    "lane": "arc-bench",
    "kind": "pattern",
    "correction": "A JSON payload carrying a Windows path was rejected BAD_JSON -- invalid escape \\U after spawnSync -> Windows command li…",
    "lesson": "the rule is not about three characters, it is about ARGV: JSON built from any value a machine produced goes t…",
    "tags": "shell,quoting,argv,windows,receipt",
    "promoted": true,
    "src": "docs/retro-log.md:107"
   },
   {
    "date": "2026-08-13",
    "lane": "arc-ledger",
    "kind": "pattern",
    "correction": "A fix landed in one file and its TWIN was left open THREE times in one cycle, by the lane whose own CLAUDE.md carries \"…",
    "lesson": "do not rely on remembering the rule at the moment of the fix -- before pushing a change to any shared binary,…",
    "tags": "arc-brief' tests/*.bats`, `git grep -l <the-symbol>`) and o…",
    "promoted": true,
    "src": "docs/retro-log.md:109"
   },
   {
    "date": "2026-08-13",
    "lane": "arc-ledger",
    "kind": "pattern",
    "correction": "CI stopped creating runs for five consecutive pushes and I wrote a plausible cause -- the PR is a draft -- into a perma…",
    "lesson": "this is 2026-07-28's anomaly-explained-away class in a new instrument: when a signal goes SILENT, test the st…",
    "tags": "ci,silent-failure,anomaly,verification,docs",
    "promoted": true,
    "src": "docs/retro-log.md:110"
   },
   {
    "date": "2026-08-13",
    "lane": "arc-ledger",
    "kind": "pattern",
    "correction": "A test asserted that the string needs-you did not appear AT ALL, which was true only while this lane was the sole write…",
    "lesson": "an absence assertion names the LINE that must be absent, never the GROUP that must be empty; on any surface m…",
    "tags": "testing,cross-lane,absence-assertion,shared-organ",
    "promoted": false,
    "src": "docs/retro-log.md:111"
   },
   {
    "date": "2026-08-13",
    "lane": "arc-ledger",
    "kind": "pattern",
    "correction": "File CONTENT was built inside a shell string (node -e \"...\" rewriting a markdown section) and every backticked span in …",
    "lesson": "narrow the rule so it is obeyable: file CONTENT never travels through a shell string -- use Write/Edit, and a…",
    "tags": "shell,quoting,silent-failure,docs",
    "promoted": true,
    "src": "docs/retro-log.md:112"
   },
   {
    "date": "2026-08-14",
    "lane": "arc-bench",
    "kind": "pattern",
    "correction": "A tripwire stayed GREEN through the exact change it was written to catch: two checks asserted arc-run overwrites ARC_DR…",
    "lesson": "pin a claim to the thing that would have to change for the claim to stop holding, not to the mechanism that h…",
    "tags": "test,tripwire,staleness,seam,cross-lane",
    "promoted": false,
    "src": "docs/retro-log.md:115"
   },
   {
    "date": "2026-08-17",
    "lane": "arc-bench",
    "kind": "pattern",
    "correction": "EVERY check on the model seam drove the FAKE, whose correct answer is \"nothing applied\", so the suite could prove a non…",
    "lesson": "when a fake's correct answer is the same as the failure's answer, the suite needs a check on the REAL side or…",
    "tags": "test,fake,positive-control,seam,silent-failure",
    "promoted": false,
    "src": "docs/retro-log.md:116"
   },
   {
    "date": "2026-08-17",
    "lane": "arc-bench",
    "kind": "pattern",
    "correction": "A capability probe read only the subprocess EXIT STATUS, so \"this PROCESS is not runnable\" came back as \"this DRIVER ca…",
    "lesson": "a probe classifies the ANSWER, not the exit code -- a CLI that spends one code on several refusals cannot be …",
    "tags": "probe,exit-code,fail-closed,cross-lane,silent-failure",
    "promoted": false,
    "src": "docs/retro-log.md:117"
   },
   {
    "date": "2026-08-17",
    "lane": "arc-bench",
    "kind": "pattern",
    "correction": "REMOVING rows from a hashed record is a format change exactly as adding a field is, and the docstring stating that rule…",
    "lesson": "bump the format version on any change to the SHAPE of a hashed record, deletions included; and when a diff wr…",
    "tags": "replay,hash,format,version,silent-failure",
    "promoted": true,
    "src": "docs/retro-log.md:118"
   },
   {
    "date": "2026-08-17",
    "lane": "arc-bench",
    "kind": "pattern",
    "correction": "Filtering a shared list DISARMED a test whose only subjects were the filtered items: bench-core-probe's zero-fixture gu…",
    "lesson": "a test whose subject is whatever a shared directory happens to contain is a test another lane can delete: BUI…",
    "tags": "test,vacuous,fixture,cross-lane,shared-organ",
    "promoted": false,
    "src": "docs/retro-log.md:119"
   },
   {
    "date": "2026-08-19",
    "lane": "arc-face",
    "kind": "pattern",
    "correction": "A shared content fixture was CORRECTED between composition and judging, and two of three blind jurors then credited the…",
    "lesson": "a fixture handed to a jury is FROZEN at composition time -- if it must be corrected, either rebuild the items…",
    "tags": "jury,fixture,confound,confirmation-bias,design",
    "promoted": false,
    "src": "docs/retro-log.md:120"
   },
   {
    "date": "2026-08-19",
    "lane": "arc-face",
    "kind": "pattern",
    "correction": "A coverage gate checked that contract KEYS existed and never that their values meant anything, and its FAIL message nam…",
    "lesson": "when a generator MIRRORS a contract, regenerating is both the sanctioned fix and the universal bypass, so the…",
    "tags": "gate,mirror,bypass,counts-rot,validation",
    "promoted": false,
    "src": "docs/retro-log.md:121"
   },
   {
    "date": "2026-08-19",
    "lane": "arc-face",
    "kind": "pattern",
    "correction": "I applied the realpath-both-sides main guard to arc-event.mjs -- the fifth sibling missing it, and the only one whose m…",
    "lesson": "the twin-fix rule keeps failing at the moment of AUTHORSHIP rather than the moment of the fix: after fixing a…",
    "tags": "node,main-guard,twin-fix,silent-failure,gate",
    "promoted": true,
    "src": "docs/retro-log.md:122"
   },
   {
    "date": "2026-08-19",
    "lane": "arc-face",
    "kind": "pattern",
    "correction": "A design fixture asserted approval.requested 49, decision.recorded 41 and \"the ONLY two\" open -- three numbers that can…",
    "lesson": "numbers quoted from a report drift apart and eventually contradict each other in public, while derived ones r…",
    "tags": "measurement,derived-vs-quoted,fixture,reader-authority",
    "promoted": false,
    "src": "docs/retro-log.md:123"
   },
   {
    "date": "2026-08-19",
    "lane": "arc-face",
    "kind": "pattern",
    "correction": "A router row carried ONE field of a four-field tenure group (hosted: without cap/judge/review_by), the validator refuse…",
    "lesson": "a shared config is a shared organ: adding one field to it is a change to every lane that reads it, so run the…",
    "tags": "shared-organ,config,cross-lane,validation,router",
    "promoted": false,
    "src": "docs/retro-log.md:124"
   }
  ],
  "trial": [
   {
    "date": "2026-07-30",
    "capability": "appetite-sum",
    "runRef": "every run, cycle-long",
    "outcome": "yes, every run",
    "falsePositive": "arguable — see below",
    "streak": null,
    "src": "docs/trial-ledger.md:353"
   },
   {
    "date": "2026-07-30",
    "capability": "pre-mortem-cite",
    "runRef": "every run",
    "outcome": "no",
    "falsePositive": "—",
    "streak": null,
    "src": "docs/trial-ledger.md:354"
   },
   {
    "date": "2026-07-30",
    "capability": "adr-wired",
    "runRef": "every run",
    "outcome": "no",
    "falsePositive": "—",
    "streak": null,
    "src": "docs/trial-ledger.md:355"
   },
   {
    "date": "2026-07-30",
    "capability": "adr-confidence",
    "runRef": "every run",
    "outcome": "no",
    "falsePositive": "—",
    "streak": null,
    "src": "docs/trial-ledger.md:356"
   },
   {
    "date": "2026-07-30",
    "capability": "architecture",
    "runRef": "every run",
    "outcome": "no",
    "falsePositive": "—",
    "streak": null,
    "src": "docs/trial-ledger.md:357"
   },
   {
    "date": "2026-07-30",
    "capability": "current-state-structure",
    "runRef": "every run",
    "outcome": "no",
    "falsePositive": "—",
    "streak": null,
    "src": "docs/trial-ledger.md:358"
   },
   {
    "date": "2026-07-30",
    "capability": "nonneg-drift",
    "runRef": "every run",
    "outcome": "no",
    "falsePositive": "—",
    "streak": null,
    "src": "docs/trial-ledger.md:359"
   },
   {
    "date": "2026-07-30",
    "capability": "verify-red",
    "runRef": "every run",
    "outcome": "no",
    "falsePositive": "—",
    "streak": null,
    "src": "docs/trial-ledger.md:360"
   },
   {
    "date": "2026-08-02",
    "capability": "appetite-sum",
    "runRef": "every run, cycle-long",
    "outcome": "yes, every run",
    "falsePositive": "no — and this one is outcome-confirmed",
    "streak": null,
    "src": "docs/trial-ledger.md:387"
   },
   {
    "date": "2026-08-02",
    "capability": "pre-mortem-cite",
    "runRef": "every run",
    "outcome": "no",
    "falsePositive": "—",
    "streak": null,
    "src": "docs/trial-ledger.md:388"
   },
   {
    "date": "2026-08-02",
    "capability": "adr-wired",
    "runRef": "every run",
    "outcome": "no",
    "falsePositive": "—",
    "streak": null,
    "src": "docs/trial-ledger.md:389"
   },
   {
    "date": "2026-08-02",
    "capability": "adr-confidence",
    "runRef": "every run",
    "outcome": "no",
    "falsePositive": "—",
    "streak": null,
    "src": "docs/trial-ledger.md:390"
   },
   {
    "date": "2026-08-02",
    "capability": "architecture",
    "runRef": "every run",
    "outcome": "no",
    "falsePositive": "—",
    "streak": null,
    "src": "docs/trial-ledger.md:391"
   },
   {
    "date": "2026-08-02",
    "capability": "current-state-structure",
    "runRef": "every run",
    "outcome": "no",
    "falsePositive": "—",
    "streak": null,
    "src": "docs/trial-ledger.md:392"
   },
   {
    "date": "2026-08-02",
    "capability": "nonneg-drift",
    "runRef": "every run",
    "outcome": "no",
    "falsePositive": "—",
    "streak": null,
    "src": "docs/trial-ledger.md:393"
   },
   {
    "date": "2026-08-02",
    "capability": "verify-red",
    "runRef": "every run",
    "outcome": "no",
    "falsePositive": "—",
    "streak": null,
    "src": "docs/trial-ledger.md:394"
   },
   {
    "date": "2026-08-04",
    "capability": "appetite-sum",
    "runRef": "every run, cycle-long",
    "outcome": "yes, every run",
    "falsePositive": "unadjudicated — see below",
    "streak": null,
    "src": "docs/trial-ledger.md:430"
   },
   {
    "date": "2026-08-04",
    "capability": "7 other kickoff-lint substance gates",
    "runRef": "every run",
    "outcome": "no",
    "falsePositive": "n/a — not counted (author-written plan; silence, not accuracy)",
    "streak": null,
    "src": "docs/trial-ledger.md:431"
   },
   {
    "date": "2026-08-04",
    "capability": "spine-api",
    "runRef": "evolve board joins the scan (b103d7a); spine-reader-lint.sh…",
    "outcome": "no",
    "falsePositive": "no",
    "streak": null,
    "src": "docs/trial-ledger.md:432"
   },
   {
    "date": "2026-08-06",
    "capability": "appetite-sum",
    "runRef": "arc-policy kickoff, then every run cycle-long",
    "outcome": "yes, every run",
    "falsePositive": "no — outcome-confirmed TRUE positive",
    "streak": null,
    "src": "docs/trial-ledger.md:484"
   },
   {
    "date": "2026-08-09",
    "capability": "appetite-sum",
    "runRef": "arc-absorb kickoff, then every run cycle-long",
    "outcome": "yes, every run",
    "falsePositive": "no — outcome-confirmed TRUE positive",
    "streak": null,
    "src": "docs/trial-ledger.md:485"
   },
   {
    "date": "2026-08-09",
    "capability": "pre-mortem-cite · adr-wired · adr-confidence · architecture…",
    "runRef": "arc-absorb kickoff + 5 phase closes",
    "outcome": "no",
    "falsePositive": "n/a — silent runs, no evidence either way",
    "streak": null,
    "src": "docs/trial-ledger.md:486"
   },
   {
    "date": "2026-08-12",
    "capability": "appetite-sum (zero-slack branch)",
    "runRef": "arc-memory Cycle 11, every run cycle-long",
    "outcome": "yes, every run — 4.5d = 90% of 5d",
    "falsePositive": "leaning false — the cycle closed at 75% of 5d, so the slack it warned was missing was in …",
    "streak": null,
    "src": "docs/trial-ledger.md:523"
   },
   {
    "date": "2026-08-12",
    "capability": "appetite-sum (over-commit branch)",
    "runRef": "arc-memory Cycle 11, every run cycle-long",
    "outcome": "no — 4.5d <= 5d, correctly silent",
    "falsePositive": "no — a clean run",
    "streak": null,
    "src": "docs/trial-ledger.md:524"
   },
   {
    "date": "2026-08-12",
    "capability": "birth-rule(kickoff-lint)",
    "runRef": "arc-memory Cycle 11, every run",
    "outcome": "no — 3 processes checked against hq.policy.yaml, 0 ungoverned",
    "falsePositive": "no — a clean run",
    "streak": null,
    "src": "docs/trial-ledger.md:525"
   }
  ],
  "plan": {
   "h1": "PLAN.md — arc-memory \"playbooks + recall\"",
   "goal": "arc-recall \"how did we get burned by this before\" gives any session — human or process, in arc",
   "phases": [
    {
     "phase": "00",
     "capability": "The index exists and is honest — 5 adapters, count-verified, named exclusions, atomi…",
     "appetite": "1.5d",
     "status": "✅ closed 2026-08-11",
     "closed": true
    },
    {
     "phase": "01",
     "capability": "Recall people can trust — CLI, sanitization, aliases, citations, <1s on 3 OSes, root…",
     "appetite": "1.75d",
     "status": "✅ closed 2026-08-11",
     "closed": true
    },
    {
     "phase": "02",
     "capability": "Decisions, conflicts, proof — --decisions, write-time conflict check, review hook, g…",
     "appetite": "1.25d",
     "status": "✅ closed 2026-08-12",
     "closed": true
    }
   ]
  },
  "playbook": [
   "- No playbooks/ directory and no migration of any organ's content (ADR-0700).",
   "| MEM-A | Index-in-place. Organs stay where they live; memory indexes, never migrates/duplicates. playbooks/ NOT created v1. | The brief (07-22) predates the l…",
   "| Migrate organs into playbooks/ | Breaks live consumers (kickoff step 5, retro, trial flow); dual truth; brief predates the organs |"
  ],
  "recallCost": {
   "absent": true,
   "reason": "no 'recall cost' phrase in initiatives/memory/PLAN.md or docs/strategy/plans/PLAN-memory.md"
  }
 },
 "evolve": {
  "plan": {
   "h1": "PLAN.md — evolve v1: the self-improvement engine",
   "goal": "For arc's module surfaces: weekly scoreboards derived from the spine, bounded",
   "goalLines": [
    "champion/challenger experiments on declared files, and evidence-threshold promotion proposals",
    "with statistical floors and ONE pinned verdict test — so a module improves on evidence and"
   ],
   "phases": [
    {
     "phase": "00",
     "capability": "Contract + steel thread — manifest schema, product-lint extension, 8 kinds + validat…",
     "appetite": "1.5 days",
     "status": "✅ closed 2026-08-04",
     "closed": true
    },
    {
     "phase": "01",
     "capability": "Board — reader-only reducer; PENDING / staleness / MISSING / insufficient evidence; …",
     "appetite": "1.0 days",
     "status": "✅ closed 2026-08-04",
     "closed": true
    },
    {
     "phase": "02",
     "capability": "Runner + verdict math — assignment, seal, floors, TTL, the pinned test + reference v…",
     "appetite": "1.5 days",
     "status": "✅ closed 2026-08-04",
     "closed": true
    },
    {
     "phase": "03",
     "capability": "Promotion safety — four-hop SHA lineage, evidence table, inbox, watch, freeze, rever…",
     "appetite": "1.5 days",
     "status": "✅ closed 2026-08-04",
     "closed": true
    },
    {
     "phase": "04",
     "capability": "Council bridge — the designated cut, BUILT rather than cut",
     "appetite": "1.5 days",
     "status": "✅ closed 2026-08-04",
     "closed": true
    }
   ]
  },
  "rules": [
   {
    "text": "Every improvement has a hypothesis, a sample floor, and a holdout. Winners land as",
    "src": "CONSTITUTION.md:54"
   },
   {
    "text": "reviewed diffs; nothing changes silently — prompts included.",
    "src": "CONSTITUTION.md:55"
   },
   {
    "text": "REQ-03 — Experiments are bounded, deterministic, sealed — Same unit_id replayed → identical arm AND cohort across 3 runs; split fixed at config; both arms tagg…",
    "src": "initiatives/evolve/PLAN.md:60"
   },
   {
    "text": "REQ-04 — Verdicts only exist above honest floors, via ONE pinned test — newcombe-wilson-difference-v1 reference vectors — sourced independently of this lane's …",
    "src": "initiatives/evolve/PLAN.md:61"
   },
   {
    "text": "Fixed-horizon, compute-once — verdict computed at most once, when BOTH arms ≥ per-arm floor; no sequential peeking (fixture: early compute refused). Verdict re…",
    "src": "docs/strategy/plans/PLAN-evolve.md:82"
   },
   {
    "text": "Baseline rate + minimum meaningful lift → n per arm — derivation, not vibes. Honest example: CTR 3% → 4.5% at 80% power ≈ ~1,900 per arm (thousands, not hundre…",
    "src": "docs/strategy/plans/PLAN-evolve.md:67"
   },
   {
    "text": "allocation · no sequential or peeking analysis · no second verdict formula · no auto-created",
    "src": "initiatives/evolve/PLAN.md:177"
   },
   {
    "text": "ADR 0305 — EVO-E: rollback is propose-only, in both directions",
    "src": "docs/adr/0305-evo-e-rollback-is-propose-only-in-both-directions.md:1"
   },
   {
    "text": "ADR 0306 — EVO-F: one pinned verdict test, newcombe-wilson-difference-v1",
    "src": "docs/adr/0306-evo-f-verdict-test-pinned-to-newcombe-wilson-difference-v1.md:1"
   }
  ],
  "registry": {
   "text": "evolve contract = JSON section in manifest.json: metrics[] (name, source event, aggregation, direction, primary\\",
   "fields": [
    "metrics[] (name, source event, aggregation, direction, primary|guardrail)",
    "experiments[] (surface file, variant grammar, fixed split, excluded categories)",
    "evals (holdout rule, per-arm floor, minimum-effect rule, test id + α + effect_floor)",
    "promote_via (exact canonical-target file allowlist)"
   ],
   "src": "docs/strategy/plans/PLAN-evolve.md:108"
  }
 },
 "develop": {
  "plan": {
   "h1": "PLAN.md — arc develop · Cycle 6: the intelligence layers",
   "goal": "Finish The Developer: an execution harness that not only runs a phase with discipline, but",
   "phases": [
    {
     "phase": "00",
     "capability": "Steel thread — parked, shipped in Cycle 5",
     "appetite": "—",
     "status": "✅ done 2026-08-02",
     "closed": true
    },
    {
     "phase": "04",
     "capability": "The Learning System — ledger with typed links, eval fixtures, withheld holdout, prom…",
     "appetite": "1.5 days",
     "status": "✅ done 2026-08-03 (12 of 13 slices; slice 08 carried)",
     "closed": true
    },
    {
     "phase": "05",
     "capability": "Context Pack — code-graph neighbourhood with stated grep fallback, churn, tagged hit…",
     "appetite": "1.0 days",
     "status": "✅ done 2026-08-03 (9 of 9 slices)",
     "closed": true
    },
    {
     "phase": "06",
     "capability": "Capability — scout, vet gate that BLOCKs on provenance, pinned lockfile",
     "appetite": "0.75 days",
     "status": "✅ done 2026-08-03 (15 of 15 slices)",
     "closed": true
    },
    {
     "phase": "07",
     "capability": "Quality intelligence — decision-triggered pattern mining, risk-triggered approach sk…",
     "appetite": "0.75 days",
     "status": "✅ done 2026-08-03 (9 of 9 slices)",
     "closed": true
    },
    {
     "phase": "08",
     "capability": "The feedback half of layer 5 — outcome metrics, calibration record, tags, suggestion…",
     "appetite": "1.5 days",
     "status": "✅ done 2026-08-03 (9 of 9 slices)",
     "closed": true
    }
   ]
  },
  "progress": {
   "header": "IDLE",
   "currentSlice": "Every phase of Cycle 6 is closed on green CI (run 30782174344, 19 of 19 jobs at head 27cb7ce). The cycle is ready to merge — PR #100, still open by instruction."
  },
  "debt": {
   "rule": "> Intentional shortcuts are debts; unrecorded debts are forgotten forever. Every deliberate",
   "entries": [
    {
     "item": "Risk globs are declared inline in develop.mjs rather than read from .claude/rules/security-sensitive.md",
     "status": "open"
    },
    {
     "item": "Checkpoint health checks ship without the public-API surface diff, the complexity delta, or the circular-dependency check",
     "status": "open"
    },
    {
     "item": "spec-fidelity was exercised through a general-purpose agent carrying its contract inline PAID DOWN 2026-08-03, Phase 05",
     "status": "paid-down"
    },
    {
     "item": "capability-scout was exercised through a general-purpose agent carrying its definition inline, not through its own registered agent type",
     "status": "open"
    },
    {
     "item": "The Context Pack retrieves slightly wider than the spec's source table describes",
     "status": "open"
    },
    {
     "item": "The CI shard-balance assertion was changed inside a phase whose spec never mentions sharding SETTLED 2026-08-03 BY THE MERGE, PR #100",
     "status": "paid-down"
    },
    {
     "item": "The duplicate-ADR-number check exists as a convention only PAID DOWN 2026-08-02, PR #97",
     "status": "paid-down"
    },
    {
     "item": "Design-critic checkpoints are not built, so design-source layer 4 is complete except for them",
     "status": "open"
    }
   ]
  },
  "dod": {
   "source": "docs/build-playbook.md §8",
   "enforcer": "> /arc-phase-done <n> enforces the §8 Definition of Done · the SessionStart hook prints",
   "rules": [
    "- Never code without a written plan. Even a paragraph beats nothing.",
    "- A phase isn't \"done\" until tests are green AND you've seen it run. \"Should work\" ≠ done.",
    "- Ship something runnable each phase. No 3-week branches with nothing to show.",
    "- [ ] <capability> works end-to-end",
    "- [ ] tests added & green",
    "- [ ] live demo run + output checked",
    "- [ ] verified against the real system (if applicable)",
    "- [ ] tracker updated (PROGRESS.md row ✅ + done-log)"
   ]
  }
 },
 "toolbelt": {
  "commands": {
   "note": "26; (G) = generated from a process file, never hand-edited",
   "items": [
    {
     "name": "arc",
     "room": "toolbelt",
     "oneLine": "arc orchestrator — read-only per-product install/health dashboard"
    },
    {
     "name": "arc-toolcheck",
     "room": "toolbelt",
     "oneLine": "Full toolchain health report — every tool's status (ready / missing / s…"
    },
    {
     "name": "arc-resume",
     "room": "lane",
     "oneLine": "Reconstruct where we left off — position, health, scoreboard, risks, ne…"
    },
    {
     "name": "arc-freeze",
     "room": "toolbelt",
     "oneLine": "Lock edits to one or more directories -- a deterministic edit-boundary …"
    },
    {
     "name": "arc-unfreeze",
     "room": "toolbelt",
     "oneLine": "Remove the /arc-freeze edit-boundary."
    },
    {
     "name": "arc-kickoff (G)",
     "room": "lane",
     "oneLine": null
    },
    {
     "name": "arc-change",
     "room": "lane",
     "oneLine": "Intake a mid-build change, idea, or suggestion and route it THROUGH the…"
    },
    {
     "name": "arc-phase-done",
     "room": "lane",
     "oneLine": "Close a phase per the build playbook's Definition of Done — or refuse."
    },
    {
     "name": "arc-retro",
     "room": "learn",
     "oneLine": "End-of-phase retro — turn repeated corrections into permanent setup upg…"
    },
    {
     "name": "arc-diagram",
     "room": "toolbelt",
     "oneLine": "English -> committed Mermaid diagram, saved into the tracker/docs so it…"
    },
    {
     "name": "arc-review (G)",
     "room": "review-ship",
     "oneLine": null
    },
    {
     "name": "arc-audit",
     "room": "review-ship",
     "oneLine": "Deep security audit (OWASP + STRIDE) via the security-auditor subagent …"
    },
    {
     "name": "arc-second-opinion",
     "room": "review-ship",
     "oneLine": "Independent cross-model review of the current diff (OpenAI Codex CLI or…"
    },
    {
     "name": "arc-docs",
     "room": "review-ship",
     "oneLine": "Detect and fix documentation drift against the diff (README/ARCHITECTUR…"
    },
    {
     "name": "arc-qa",
     "room": "review-ship",
     "oneLine": "Browser QA loop -- qa-tester finds bugs, you fix each with an atomic co…"
    },
    {
     "name": "arc-design (legacy)",
     "room": "design-studio",
     "oneLine": null
    },
    {
     "name": "arc-canary",
     "room": "review-ship",
     "oneLine": "Post-deploy watch loop -- monitor console errors, 5xx responses, Core W…"
    },
    {
     "name": "arc-commit (G)",
     "room": "review-ship",
     "oneLine": null
    },
    {
     "name": "arc-pr",
     "room": "review-ship",
     "oneLine": "Open a GitHub PR for the current branch."
    },
    {
     "name": "arc-fix-issue",
     "room": "review-ship",
     "oneLine": "Investigate and fix a GitHub issue by number."
    },
    {
     "name": "arc-ship",
     "room": "review-ship",
     "oneLine": "Lint, build, test, then deploy — in one shot."
    },
    {
     "name": "arc-council",
     "room": "council-chamber",
     "oneLine": "Convene the arc council — deep research + independent adversarial debat…"
    },
    {
     "name": "arc-develop",
     "room": "develop",
     "oneLine": "Turn an approved phase into small, spec-anchored, independently proven …"
    },
    {
     "name": "arc-capability",
     "room": "develop",
     "oneLine": "Find a tool the harness lacks, and vet it. Reports and refuses — it nev…"
    },
    {
     "name": "arc-design-critique",
     "room": "design-studio",
     "oneLine": "Read-only vision critique of one route -- deterministic render, design-…"
    },
    {
     "name": "arc-absorb",
     "room": "absorb",
     "oneLine": "Study an external source read-only and produce a classified extraction …"
    }
   ]
  },
  "agents": {
   "note": "30; every card shows its ADR-0069 tier; census in model-policy",
   "items": [
    {
     "name": "council-advocate",
     "room": "council-chamber",
     "oneLine": "Council member — builds the strongest evidence-based case FOR the decis…"
    },
    {
     "name": "council-skeptic",
     "room": "council-chamber",
     "oneLine": "Council member — builds the strongest evidence-based case AGAINST the d…"
    },
    {
     "name": "council-neutral",
     "room": "council-chamber",
     "oneLine": "Council member — takes NO side and weighs the decision dispassionately …"
    },
    {
     "name": "council-researcher",
     "room": "council-chamber",
     "oneLine": "Council fact-finder — takes ONE sub-question, researches it (live web o…"
    },
    {
     "name": "council-verifier",
     "room": "council-chamber",
     "oneLine": "Council cross-examiner — grades the EVIDENCE behind each member's point…"
    },
    {
     "name": "council-strategist",
     "room": "council-chamber",
     "oneLine": "Council domain expert for business & startup questions — a VC + operato…"
    },
    {
     "name": "council-risk-analyst",
     "room": "council-chamber",
     "oneLine": "Council domain expert for finance & investment questions — a risk/retur…"
    },
    {
     "name": "council-marketer",
     "room": "council-chamber",
     "oneLine": "Council domain expert for marketing & growth questions — a positioning …"
    },
    {
     "name": "council-designer",
     "room": "council-chamber",
     "oneLine": "Council domain expert for design & UX questions — a user + craft lens (…"
    },
    {
     "name": "council-engineer",
     "room": "council-chamber",
     "oneLine": "Council domain expert for technical & product-build questions — a feasi…"
    },
    {
     "name": "council-policy-analyst",
     "room": "council-chamber",
     "oneLine": "Council domain expert for politics & policy questions — a stakeholder +…"
    },
    {
     "name": "council-life-counselor",
     "room": "council-chamber",
     "oneLine": "Council domain expert for personal & life decisions — a values + wellbe…"
    },
    {
     "name": "question-planner",
     "room": "lane",
     "oneLine": "Designs the kickoff fork questions for /arc-kickoff step 2. Fresh conte…"
    },
    {
     "name": "product-challenger",
     "room": "lane",
     "oneLine": "Pre-kickoff product interrogation. Challenges the framing with forcing …"
    },
    {
     "name": "plan-attacker",
     "room": "lane",
     "oneLine": "Adversarial reviewer for /arc-kickoff step 5. Fresh context attacks the…"
    },
    {
     "name": "plan-simulator",
     "room": "lane",
     "oneLine": "Executor simulation gate for /arc-kickoff step 8.5 (tiers M/L). Fresh c…"
    },
    {
     "name": "codebase-surveyor",
     "room": "lane",
     "oneLine": "Brownfield preflight survey for /arc-kickoff. Maps an existing codebase…"
    },
    {
     "name": "researcher",
     "room": "lane",
     "oneLine": "Researches a topic (competitors, libraries, APIs, tech choices) via web…"
    },
    {
     "name": "code-reviewer",
     "room": "review-ship",
     "oneLine": "Reviews a diff or PR with industry-standard scanners (semgrep, gitleaks…"
    },
    {
     "name": "security-auditor",
     "room": "review-ship",
     "oneLine": "Deep application security audit -- OWASP Top 10 + STRIDE threat model w…"
    },
    {
     "name": "qa-tester",
     "room": "review-ship",
     "oneLine": "Drives the running app in a real browser via the agent-browser CLI (Pla…"
    },
    {
     "name": "log-analyzer",
     "room": "develop",
     "oneLine": "Diagnoses errors, stack traces and incident logs via differential diagn…"
    },
    {
     "name": "spec-fidelity",
     "room": "develop",
     "oneLine": "Pre-handoff fidelity check for /arc-develop. Fresh context reads ONLY t…"
    },
    {
     "name": "pattern-miner",
     "room": "develop",
     "oneLine": "Finds prior art for ONE declared product, UX, architecture or external-…"
    },
    {
     "name": "capability-scout",
     "room": "develop",
     "oneLine": "Finds candidate tools, skills and MCP servers for a STATED need and ret…"
    },
    {
     "name": "design-director",
     "room": "design-studio",
     "oneLine": "Explore-mode director. Assigns three DIFFERENT product-structure theses…"
    },
    {
     "name": "ui-composer",
     "room": "design-studio",
     "oneLine": "Explore-mode composer. Builds exactly ONE variant from the brief and it…"
    },
    {
     "name": "design-critic",
     "room": "design-studio",
     "oneLine": "Read-only design critic. Reads the rendered screenshot back with vision…"
    },
    {
     "name": "design-jury",
     "room": "design-studio",
     "oneLine": "Explore-mode blind juror. Ranks FOUR unlabelled items — the three varia…"
    },
    {
     "name": "design-reviewer (legacy)",
     "room": "design-studio",
     "oneLine": null
    }
   ]
  },
  "hooks": {
   "items": [
    {
     "name": "SessionStart",
     "room": "toolbelt",
     "oneLine": null
    },
    {
     "name": "SessionEnd",
     "room": "toolbelt",
     "oneLine": null
    },
    {
     "name": "PreToolUse",
     "room": "toolbelt",
     "oneLine": null
    },
    {
     "name": "PreToolUse-edit",
     "room": "toolbelt",
     "oneLine": null
    },
    {
     "name": "PostToolUse",
     "room": "toolbelt",
     "oneLine": null
    },
    {
     "name": "PreCompact",
     "room": "toolbelt",
     "oneLine": null
    },
    {
     "name": "_dispatch.sh",
     "room": "toolbelt",
     "oneLine": null
    }
   ],
   "onDisk": [
    "policy-decide.sh",
    "PostToolUse.d",
    "PostToolUse.sh",
    "PreCompact.d",
    "PreCompact.sh",
    "PreToolUse-edit.d",
    "PreToolUse-edit.sh",
    "PreToolUse.d",
    "PreToolUse.sh",
    "SessionEnd.d",
    "SessionEnd.sh",
    "SessionStart.d",
    "SessionStart.sh",
    "_dispatch.sh"
   ]
  },
  "rules": {
   "note": "7 on disk 2026-08-19 (design source said 6 — tree wins): api, lanes, security-sensitive, stripe, supabase, testing, ui",
   "items": [
    {
     "name": "api",
     "room": "toolbelt",
     "oneLine": null
    },
    {
     "name": "lanes",
     "room": "board",
     "oneLine": null
    },
    {
     "name": "security-sensitive",
     "room": "toolbelt",
     "oneLine": null
    },
    {
     "name": "stripe",
     "room": "toolbelt",
     "oneLine": null
    },
    {
     "name": "supabase",
     "room": "toolbelt",
     "oneLine": null
    },
    {
     "name": "testing",
     "room": "toolbelt",
     "oneLine": null
    },
    {
     "name": "ui",
     "room": "toolbelt",
     "oneLine": null
    }
   ],
   "onDisk": [
    "api.md",
    "lanes.md",
    "security-sensitive.md",
    "stripe.md",
    "supabase.md",
    "testing.md",
    "ui.md"
   ]
  },
  "lints": {
   "items": [
    {
     "name": "kickoff-lint",
     "room": "lane",
     "oneLine": null
    },
    {
     "name": "develop-lint",
     "room": "develop",
     "oneLine": null
    },
    {
     "name": "process-lint",
     "room": "engine-room",
     "oneLine": null
    },
    {
     "name": "arc-compile-bytediff",
     "room": "engine-room",
     "oneLine": null
    },
    {
     "name": "policy-lint",
     "room": "policy",
     "oneLine": null
    },
    {
     "name": "policy-matrix",
     "room": "policy",
     "oneLine": null
    },
    {
     "name": "jobs-lint",
     "room": "scheduler",
     "oneLine": null
    },
    {
     "name": "board-lint",
     "room": "board",
     "oneLine": null
    },
    {
     "name": "ownership-lint",
     "room": "board",
     "oneLine": null
    },
    {
     "name": "product-lint",
     "room": "toolbelt",
     "oneLine": null
    },
    {
     "name": "council-lint",
     "room": "council-chamber",
     "oneLine": null
    },
    {
     "name": "design-lint",
     "room": "design-studio",
     "oneLine": null
    },
    {
     "name": "design-gate",
     "room": "design-studio",
     "oneLine": null
    },
    {
     "name": "render-hash",
     "room": "design-studio",
     "oneLine": null
    },
    {
     "name": "report-lint",
     "room": "absorb",
     "oneLine": null
    },
    {
     "name": "rebuild-lint",
     "room": "absorb",
     "oneLine": null
    },
    {
     "name": "registry-ref",
     "room": "absorb",
     "oneLine": null
    },
    {
     "name": "slop-lint",
     "room": "growth",
     "oneLine": null
    },
    {
     "name": "citation-lint",
     "room": "growth",
     "oneLine": null
    },
    {
     "name": "spec-verify",
     "room": "growth",
     "oneLine": null
    },
    {
     "name": "research-lint",
     "room": "leads",
     "oneLine": null
    },
    {
     "name": "pii-tripwire",
     "room": "leads",
     "oneLine": null
    },
    {
     "name": "rehearsal-check",
     "room": "leads",
     "oneLine": null
    },
    {
     "name": "publish-gate",
     "room": "legal",
     "oneLine": null
    },
    {
     "name": "legal-lints (4)",
     "room": "legal",
     "oneLine": null
    },
    {
     "name": "spine-reader-lint",
     "room": "spine",
     "oneLine": null
    },
    {
     "name": "capability-vet",
     "room": "develop",
     "oneLine": null
    },
    {
     "name": "arc-bytediff",
     "room": "toolbelt",
     "oneLine": null
    },
    {
     "name": "face-coverage",
     "room": "toolbelt",
     "oneLine": null
    }
   ]
  },
  "processes": {
   "note": "6 live + face-ask lands in Phase 07",
   "items": [
    {
     "name": "commit-msg-draft",
     "room": "engine-room",
     "oneLine": null
    },
    {
     "name": "review-diff",
     "room": "engine-room",
     "oneLine": null
    },
    {
     "name": "kickoff-plan",
     "room": "engine-room",
     "oneLine": null
    },
    {
     "name": "build-in-public-draft",
     "room": "engine-room",
     "oneLine": null
    },
    {
     "name": "brief-materialize",
     "room": "engine-room",
     "oneLine": null
    },
    {
     "name": "day-close-roll",
     "room": "engine-room",
     "oneLine": null
    },
    {
     "name": "face-ask (Phase 07)",
     "room": "ask-arc",
     "oneLine": null
    }
   ],
   "onDisk": [
    "brief-materialize.process.yaml",
    "build-in-public-draft.process.yaml",
    "commit-msg-draft.process.yaml",
    "day-close-roll.process.yaml",
    "kickoff-plan.process.yaml",
    "review-diff.process.yaml"
   ]
  },
  "gates": {
   "items": [
    {
     "name": "scan",
     "room": "review-ship",
     "oneLine": null
    },
    {
     "name": "coverage",
     "room": "review-ship",
     "oneLine": null
    },
    {
     "name": "reviews",
     "room": "review-ship",
     "oneLine": null
    },
    {
     "name": "docs",
     "room": "review-ship",
     "oneLine": null
    },
    {
     "name": "rls",
     "room": "review-ship",
     "oneLine": null
    },
    {
     "name": "spine-api",
     "room": "review-ship",
     "oneLine": null
    },
    {
     "name": "design",
     "room": "review-ship",
     "oneLine": null
    }
   ]
  },
  "products": {
   "note": "product -> room. Moved here from face-sections.mjs 2026-08-19: a hand-authored copy of the room map inside the generator is the second spelling ADR-1306 exists…",
   "items": [
    {
     "name": "hq",
     "room": "spine",
     "oneLine": null
    },
    {
     "name": "core",
     "room": "toolbelt",
     "oneLine": null
    },
    {
     "name": "plan",
     "room": "lane",
     "oneLine": null
    },
    {
     "name": "review",
     "room": "review-ship",
     "oneLine": null
    },
    {
     "name": "git",
     "room": "review-ship",
     "oneLine": null
    },
    {
     "name": "qa",
     "room": "review-ship",
     "oneLine": null
    },
    {
     "name": "council",
     "room": "council-chamber",
     "oneLine": null
    },
    {
     "name": "design",
     "room": "design-studio",
     "oneLine": null
    },
    {
     "name": "develop",
     "room": "develop",
     "oneLine": null
    },
    {
     "name": "engine",
     "room": "engine-room",
     "oneLine": null
    },
    {
     "name": "evolve",
     "room": "evolve",
     "oneLine": null
    },
    {
     "name": "absorb",
     "room": "absorb",
     "oneLine": null
    },
    {
     "name": "growth",
     "room": "growth",
     "oneLine": null
    },
    {
     "name": "leads",
     "room": "leads",
     "oneLine": null
    },
    {
     "name": "legal",
     "room": "legal",
     "oneLine": null
    },
    {
     "name": "memory",
     "room": "memory",
     "oneLine": null
    }
   ]
  }
 },
 "concepts": {
  "count": 107,
  "note": "the glossary inventory — the ⌘K backing store seed; term -> { room, station }. Grows with the tree; face-coverage asserts every term has a home.",
  "items": [
   {
    "term": "receipt",
    "room": "spine",
    "station": "emit"
   },
   {
    "term": "spine",
    "room": "spine",
    "station": "ring line"
   },
   {
    "term": "ULID",
    "room": "spine",
    "station": "emit"
   },
   {
    "term": "idem key",
    "room": "spine",
    "station": "dedup"
   },
   {
    "term": "quarantine",
    "room": "spine",
    "station": "validate"
   },
   {
    "term": "supersedes chain",
    "room": "spine",
    "station": "receipt drawer"
   },
   {
    "term": "day.closed seal",
    "room": "spine",
    "station": "close-day"
   },
   {
    "term": "torn line",
    "room": "spine",
    "station": "spine-health"
   },
   {
    "term": "envelope (15 keys)",
    "room": "spine",
    "station": "validate"
   },
   {
    "term": "stamp",
    "room": "inbox",
    "station": "decide"
   },
   {
    "term": "chip",
    "room": "inbox",
    "station": "needs-you cards"
   },
   {
    "term": "seal",
    "room": "law",
    "station": "E2 gallery"
   },
   {
    "term": "approval profile",
    "room": "inbox",
    "station": "card body"
   },
   {
    "term": "refusal code",
    "room": "inbox",
    "station": "decide"
   },
   {
    "term": "needs-you",
    "room": "today",
    "station": "brief groups"
   },
   {
    "term": "money strip",
    "room": "today",
    "station": "brief groups"
   },
   {
    "term": "since you left",
    "room": "today",
    "station": "cursor diff"
   },
   {
    "term": "Why? precedents",
    "room": "today",
    "station": "KPI row"
   },
   {
    "term": "arc ring",
    "room": "today",
    "station": "the mark"
   },
   {
    "term": "line / station",
    "room": "map",
    "station": "legend"
   },
   {
    "term": "interchange",
    "room": "map",
    "station": "inbox station"
   },
   {
    "term": "dashed (unexercised)",
    "room": "map",
    "station": "legend"
   },
   {
    "term": "dotted (planned)",
    "room": "map",
    "station": "legend"
   },
   {
    "term": "as-of",
    "room": "spine",
    "station": "tape"
   },
   {
    "term": "replay",
    "room": "spine",
    "station": "tape"
   },
   {
    "term": "playhead",
    "room": "spine",
    "station": "tape"
   },
   {
    "term": "honesty classes",
    "room": "money",
    "station": "SIMULATED panel"
   },
   {
    "term": "SIMULATED watermark",
    "room": "money",
    "station": "SIMULATED panel"
   },
   {
    "term": "REHEARSAL",
    "room": "leads",
    "station": "funnel split"
   },
   {
    "term": "DRILL",
    "room": "scheduler",
    "station": "fire-drill"
   },
   {
    "term": "EXPLORATORY",
    "room": "trader",
    "station": "playground"
   },
   {
    "term": "kill line / kill-distance",
    "room": "money",
    "station": "kill-distance meters"
   },
   {
    "term": "MRR",
    "room": "money",
    "station": "pnl"
   },
   {
    "term": "month-close",
    "room": "money",
    "station": "close board"
   },
   {
    "term": "ABSENT (reason)",
    "room": "money",
    "station": "honest states"
   },
   {
    "term": "not instrumented",
    "room": "model-policy",
    "station": "metrics"
   },
   {
    "term": "lane",
    "room": "board",
    "station": "rows"
   },
   {
    "term": "century band",
    "room": "board",
    "station": "ADR map"
   },
   {
    "term": "machine header",
    "room": "lane",
    "station": "header"
   },
   {
    "term": "appetite / burn",
    "room": "lane",
    "station": "header"
   },
   {
    "term": "50% tripwire",
    "room": "lane",
    "station": "header"
   },
   {
    "term": "WIP guideline",
    "room": "board",
    "station": "counter"
   },
   {
    "term": "Mode A / Mode B",
    "room": "board",
    "station": "execution mode"
   },
   {
    "term": "passport",
    "room": "ventures",
    "station": "passports"
   },
   {
    "term": "Golden Loop",
    "room": "map",
    "station": "circle line"
   },
   {
    "term": "steel thread",
    "room": "lane",
    "station": "phase 0"
   },
   {
    "term": "REQ",
    "room": "lane",
    "station": "PLAN table"
   },
   {
    "term": "assumptions ledger",
    "room": "lane",
    "station": "kickoff trail"
   },
   {
    "term": "pre-mortem",
    "room": "lane",
    "station": "kickoff trail"
   },
   {
    "term": "evidence bundle",
    "room": "lane",
    "station": "phase-done"
   },
   {
    "term": "PREDICTION",
    "room": "council-chamber",
    "station": "intake"
   },
   {
    "term": "POINT-ID",
    "room": "council-chamber",
    "station": "convene"
   },
   {
    "term": "Brier",
    "room": "council-chamber",
    "station": "calibration"
   },
   {
    "term": "HIT/MISS/UNRESOLVED",
    "room": "council-chamber",
    "station": "outcome"
   },
   {
    "term": "Review-by",
    "room": "council-chamber",
    "station": "overdue queue"
   },
   {
    "term": "slice",
    "room": "develop",
    "station": "slice ledger"
   },
   {
    "term": "proof tier",
    "room": "develop",
    "station": "slice ledger"
   },
   {
    "term": "stuck fingerprint",
    "room": "develop",
    "station": "stuck monitor"
   },
   {
    "term": "context pack",
    "room": "engine-room",
    "station": "dispatch"
   },
   {
    "term": "capped key",
    "room": "engine-room",
    "station": "hire line"
   },
   {
    "term": "unlock ladder",
    "room": "engine-room",
    "station": "hire cards"
   },
   {
    "term": "cert suite",
    "room": "engine-room",
    "station": "certification"
   },
   {
    "term": "router row",
    "room": "engine-room",
    "station": "router table"
   },
   {
    "term": "tier (model)",
    "room": "model-policy",
    "station": "census"
   },
   {
    "term": "trial (model_source)",
    "room": "model-policy",
    "station": "open trials"
   },
   {
    "term": "ceiling / cap / effective",
    "room": "policy",
    "station": "matrix"
   },
   {
    "term": "two-key model",
    "room": "policy",
    "station": "matrix"
   },
   {
    "term": "spend reservation",
    "room": "policy",
    "station": "reservations"
   },
   {
    "term": "proving week",
    "room": "scheduler",
    "station": "clock"
   },
   {
    "term": "overdue (2x cadence)",
    "room": "scheduler",
    "station": "jobs table"
   },
   {
    "term": "golden gate (recall)",
    "room": "memory",
    "station": "golden queries"
   },
   {
    "term": "HISTORICAL DATA fence",
    "room": "memory",
    "station": "recall"
   },
   {
    "term": "champion / challenger",
    "room": "evolve",
    "station": "arms"
   },
   {
    "term": "holdout cohort",
    "room": "evolve",
    "station": "arms"
   },
   {
    "term": "PENDING n/floor",
    "room": "evolve",
    "station": "board"
   },
   {
    "term": "scorecard",
    "room": "bench",
    "station": "scorecards"
   },
   {
    "term": "drift guard",
    "room": "bench",
    "station": "champion drift"
   },
   {
    "term": "PLANOFF A/B",
    "room": "absorb",
    "station": "sealed-blind"
   },
   {
    "term": "technique T-NN",
    "room": "absorb",
    "station": "registry"
   },
   {
    "term": "allowlist / DO-NOT-WIDEN",
    "room": "absorb",
    "station": "allowlist"
   },
   {
    "term": "thesis (design)",
    "room": "design-studio",
    "station": "explore"
   },
   {
    "term": "blind jury / reference item",
    "room": "design-studio",
    "station": "jury"
   },
   {
    "term": "BELOW-BAR",
    "room": "design-studio",
    "station": "critique"
   },
   {
    "term": "deterministic render",
    "room": "design-studio",
    "station": "render"
   },
   {
    "term": "tokens.css",
    "room": "design-studio",
    "station": "canonical tokens"
   },
   {
    "term": "gate 1 / gate 2 (growth)",
    "room": "growth",
    "station": "publish board"
   },
   {
    "term": "INDEXABLE clock",
    "room": "growth",
    "station": "feed clock"
   },
   {
    "term": "suppression / reply-stop",
    "room": "leads",
    "station": "guard chain"
   },
   {
    "term": "send window (IST)",
    "room": "leads",
    "station": "cap meters"
   },
   {
    "term": "hash-chain (legal)",
    "room": "legal",
    "station": "verify"
   },
   {
    "term": "E1/E2/E3",
    "room": "law",
    "station": "constitution"
   },
   {
    "term": "the five ungrantables",
    "room": "law",
    "station": "E2 seals"
   },
   {
    "term": "7-day cooling",
    "room": "law",
    "station": "amendment rule"
   },
   {
    "term": "retro-log",
    "room": "learn",
    "station": "retro line"
   },
   {
    "term": "trial ledger",
    "room": "learn",
    "station": "promotions"
   },
   {
    "term": "twin-fix",
    "room": "learn",
    "station": "lesson patterns"
   },
   {
    "term": "vacuous pass",
    "room": "learn",
    "station": "lesson patterns"
   },
   {
    "term": "Build-out Mandate",
    "room": "strategy",
    "station": "mandate citations"
   },
   {
    "term": "pull trigger",
    "room": "strategy",
    "station": "trigger table"
   },
   {
    "term": "data mode (live/replay/sim)",
    "room": "today",
    "station": "chrome"
   },
   {
    "term": "request journal",
    "room": "spine",
    "station": "L2 door"
   },
   {
    "term": "one write path",
    "room": "inbox",
    "station": "decide"
   },
   {
    "term": "planned room",
    "room": "map",
    "station": "legend"
   },
   {
    "term": "room birth-rule",
    "room": "toolbelt",
    "station": "face-coverage"
   },
   {
    "term": "face: section",
    "room": "toolbelt",
    "station": "product-lint"
   },
   {
    "term": "generated command (G)",
    "room": "toolbelt",
    "station": "commands"
   },
   {
    "term": "arc dash (L2)",
    "room": "spine",
    "station": "L2 door"
   }
  ]
 },
 "reviewShip": {
  "file": "arc.gates.yaml",
  "modes": "mode - block | warn | off | profile",
  "profileMode": [
   "profile => trust the check's own exit code (2=block, 1=warn) which",
   "already resolved the strictness profile (Phase 01)"
  ],
  "tierBudget": "tier - hook | ci (hook tier has a hard <30s budget, ADR-0006)",
  "gates": [
   {
    "name": "scan",
    "check": "bash .claude/scripts/review/arc-scan/arc-scan.sh --base main",
    "mode": "profile",
    "tier": "hook",
    "runtime": "native",
    "evidence": ".claude/state/scan/verdict.json",
    "src": "arc.gates.yaml:17"
   },
   {
    "name": "coverage",
    "check": "bash .claude/scripts/review/coverage-gate.sh",
    "mode": "profile",
    "tier": "hook",
    "runtime": "native",
    "evidence": "coverage/coverage-summary.json",
    "src": "arc.gates.yaml:23"
   },
   {
    "name": "reviews",
    "check": "bash .claude/scripts/core/review-ledger.sh require-profile",
    "mode": "block",
    "tier": "hook",
    "runtime": "native",
    "evidence": ".claude/state/reviews",
    "src": "arc.gates.yaml:29"
   },
   {
    "name": "docs",
    "check": "bash .claude/scripts/review/docs-drift.sh",
    "mode": "profile",
    "tier": "hook",
    "runtime": "native",
    "evidence": "docs",
    "src": "arc.gates.yaml:35"
   },
   {
    "name": "rls",
    "check": "bash .claude/scripts/review/rls-gate.sh",
    "mode": "block",
    "tier": "hook",
    "runtime": "native",
    "evidence": ".claude/state/rls/rls.json",
    "src": "arc.gates.yaml:41"
   },
   {
    "name": "spine-api",
    "check": "bash .claude/scripts/review/spine-reader-lint.sh",
    "mode": "warn",
    "tier": "hook",
    "runtime": "native",
    "evidence": ".claude/state/spine-lint/violations.txt",
    "src": "arc.gates.yaml:47"
   },
   {
    "name": "design",
    "check": "bash .claude/scripts/design/design-gate.sh",
    "mode": "warn",
    "tier": "hook",
    "runtime": "native",
    "evidence": ".claude/state/design/gate.txt",
    "src": "arc.gates.yaml:53"
   }
  ],
  "profiles": {
   "resolver": ".claude/scripts/core/arc-profile.sh",
   "order": "profile name : $ARC_PROFILE env > settings .arc.profile > \"standard\"",
   "valid": [
    "starter",
    "standard",
    "strict"
   ],
   "table": [
    {
     "profile": "starter",
     "gateMode": "warn",
     "requiredReviews": [],
     "src": ".claude/scripts/core/arc-profile.sh:51,61"
    },
    {
     "profile": "standard",
     "gateMode": "block (default; block-by-default)",
     "requiredReviews": [
      "code",
      "security"
     ],
     "src": ".claude/scripts/core/arc-profile.sh:52-54,62"
    },
    {
     "profile": "strict",
     "gateMode": "block",
     "requiredReviews": [
      "code",
      "security",
      "qa",
      "design",
      "docs"
     ],
     "src": ".claude/scripts/core/arc-profile.sh:52-54,63"
    }
   ]
  },
  "commitKeyed": {
   "literal": {
    "absent": true,
    "reason": "the phrase 'commit-keyed' does not appear in the repo"
   },
   "statement": [
    "Ledger: .claude/state/reviews/<SHA>.txt, one review-kind per line. Keyed by",
    "HEAD, so a NEW commit resets the ledger -> new code always requires re-review."
   ]
  }
 },
 "ventures": {
  "file": "ventures.yaml",
  "version": "version: 1",
  "rules": [
   "THIS FILE CANNOT BE EDITED SILENTLY. arc pnl parses it, canonicalizes it, digests the RESULT,",
   "The digest is over the PARSED VALUES, not the bytes. Reformat this file, add or remove a comment,",
   "Criteria only. Money never lives here (ADR-1001 / LED-B): costs are cost.incurred events.",
   "The venture set here stays identical to PORTFOLIO.md's Venture passports table. A kill line with",
   "PLACEHOLDER VALUES. The real thresholds for lexos are the owner's to set, and because this file"
  ],
  "items": [
   {
    "id": "lexos",
    "name": "lexos",
    "repo": "private, separate repo",
    "stage": "in build outside arc",
    "money": {
     "absent": true,
     "reason": "ventures.yaml:23 — Criteria only. Money never lives here; costs are cost.incurred events"
    },
    "mrr": {
     "absent": true,
     "reason": "no MRR field anywhere; ledger derives P&L from spine receipts"
    },
    "kill": [
     {
      "criterion": "days_without_revenue",
      "value": 90,
      "direction": "CEILING: crosses upward",
      "measurable": true,
      "note": null,
      "src": "ventures.yaml:37"
     },
     {
      "criterion": "traffic_floor_monthly",
      "value": 100,
      "direction": "FLOOR: crosses downward",
      "measurable": false,
      "note": "READ ADR-1018 BEFORE TRUSTING THIS LINE. Ledger has NO traffic source — it reads money, not visits — so this criterion renders ABSENT with a stated reason rath…",
      "src": "ventures.yaml:44"
     }
    ],
    "notes": [
     "PLACEHOLDER VALUES. The real thresholds for lexos are the owner's to set, and because this file",
     "READ ADR-1018 BEFORE TRUSTING THIS LINE. Ledger has NO traffic source — it reads money, not"
    ]
   }
  ]
 },
 "strategy": {
  "dir": "docs/strategy",
  "listing": [
   "arc-company-org-blueprint.md",
   "arc-full-architecture.md",
   "arc-hq-mockup.html",
   "arc-master-execution-plan.md",
   "plans",
   "README.md",
   "records"
  ],
  "records": [
   "arc-architecture-v2.1-verdicts.md",
   "arc-hq-blueprint.md",
   "arc-money-engine-plan.md"
  ],
  "plans": [
   {
    "file": "BRIEF-chat-mcp.md",
    "h1": "BRIEF — chat interface (HQ MCP server)"
   },
   {
    "file": "PLAN-absorb.md",
    "h1": "PLAN (design source) — absorb: the technique refinery"
   },
   {
    "file": "PLAN-bench.md",
    "h1": "PLAN (design source) — bench runner v1: \"the model market\""
   },
   {
    "file": "PLAN-cycle2-receipt-spine-v2.1.md",
    "h1": "PLAN (design source) — Cycle 2 · Receipt Spine — v2.1"
   },
   {
    "file": "PLAN-cycle3-venture-launch.md",
    "h1": "PLAN (design source) — Cycle 3 · First Money: [VENTURE] launch"
   },
   {
    "file": "PLAN-design-v2.md",
    "h1": "PLAN — design v2 · \"Eyes, Taste, Rivals\" — v1.2"
   },
   {
    "file": "PLAN-design.md",
    "h1": "PLAN — arc-design · \"The Designer\" (design capability as a first-class arc module)"
   },
   {
    "file": "PLAN-develop.md",
    "h1": "PLAN — arc-develop · \"The Developer\" (the execution harness — arc's develop product)"
   },
   {
    "file": "PLAN-discover.md",
    "h1": "PLAN (design source) — discover v1: the idea engine"
   },
   {
    "file": "PLAN-engine-process-layer.md",
    "h1": "PLAN (design source) — Model-Agnostic Foundation: engine v1 + process-layer pilot"
   },
   {
    "file": "PLAN-evolve.md",
    "h1": "PLAN (design source) — evolve v1: the self-improvement engine"
   },
   {
    "file": "PLAN-executor.md",
    "h1": "PLAN (design source) — executor v1: agent-runtime driver (the hired hands)"
   },
   {
    "file": "PLAN-face.md",
    "h1": "PLAN (design source) — arc face v1: the working HQ"
   },
   {
    "file": "PLAN-growth.md",
    "h1": "PLAN (design source) — growth v1: the content engine + evolve's first feed"
   },
   {
    "file": "PLAN-leads.md",
    "h1": "PLAN (design source) — leads v1: the outbound engine"
   },
   {
    "file": "PLAN-ledger.md",
    "h1": "PLAN (design source) — ledger module · \"the money brain\" — v1.0 DRAFT"
   },
   {
    "file": "PLAN-legal-pack.md",
    "h1": "PLAN (design source) — legal pack: customer-facing policies per venture"
   },
   {
    "file": "PLAN-memory.md",
    "h1": "PLAN (design source) — memory v1: playbooks + recall"
   },
   {
    "file": "PLAN-model-policy.md",
    "h1": "PLAN (design source) — Balanced Model Policy: pre-engine model discipline"
   },
   {
    "file": "PLAN-ops.md",
    "h1": "PLAN (design source) — ops v1: the keep-it-running engine"
   },
   {
    "file": "PLAN-policy.md",
    "h1": "PLAN (design source) — Policy Engine: enforced capability vectors"
   },
   {
    "file": "PLAN-portfolio.md",
    "h1": "PLAN — arc-portfolio · \"The Conductor\" (multi-lane workspaces — parallel products, one arc)"
   },
   {
    "file": "PLAN-scheduler.md",
    "h1": "PLAN — scheduler · \"the heartbeat\" — v1.0"
   },
   {
    "file": "PLAN-trader.md",
    "h1": "PLAN-trader.md — trader sandbox · \"The Lab\" (permanently special)"
   },
   {
    "file": "README.md",
    "h1": "docs/strategy/plans/ — the kickoff-ready plan pack"
   }
  ],
  "adrs": {
   "dir": "docs/adr",
   "count": 265,
   "highest": 1316,
   "recent": [
    {
     "n": 1316,
     "title": "ADR 1316 — FACE-Q: L3 flips to an in-repo face/, because a new repo would have no CI"
    },
    {
     "n": 1315,
     "title": "ADR 1315 — FACE-P: voice on the brain dock is optional, behind a setting, and not v1"
    },
    {
     "n": 1314,
     "title": "ADR 1314 — FACE-O: v1 is single-tenant local; the SaaS face is a later cycle"
    },
    {
     "n": 1313,
     "title": "ADR 1313 — FACE-N: honesty classes — real · simulated · rehearsal · drill · exploratory — never mixed"
    },
    {
     "n": 1312,
     "title": "ADR 1312 — FACE-M: localhost + token, no PII, escaped serializer, no analytics"
    }
   ]
  }
 },
 "planned": [
  {
   "room": "ops",
   "ring": "money",
   "source": "docs/strategy/plans/PLAN-ops.md (OPS-A..M)",
   "line": [
    "registry",
    "sweep",
    "incident.raised",
    "ack",
    "resolve",
    "support file-drop",
    "classify",
    "template draft",
    "approval (stamp)",
    "human sends (seal)",
    "weekly report",
    "drill"
   ],
   "shows_today": [
    "docs/canary/*.md",
    "incident.raised (0 ever)"
   ],
   "takes_over": "manifest face: section at /arc-kickoff --lane ops"
  },
  {
   "room": "trader",
   "ring": "money",
   "source": "docs/strategy/plans/PLAN-trader.md (TRD-A..M)",
   "line": [
    "question.opened",
    "PLAYGROUND (EXPLORATORY)",
    "register",
    "snapshot.pinned",
    "backtest",
    "honesty battery",
    "verdict",
    "paper-live (human gate)",
    "30 days",
    "CONTINUE/DORMANT",
    "THE LOCK (display only)"
   ],
   "seals": [
    "unlock control",
    "real orders",
    "WIN (the word)"
   ],
   "takes_over": "manifest face: section at /arc-kickoff --lane trader"
  },
  {
   "room": "discover",
   "ring": "money",
   "source": "docs/strategy/plans/PLAN-discover.md (DIS-A..D)",
   "line": [
    "hunt",
    "miner",
    "normalize",
    "dedupe/cluster",
    "score.yaml",
    "top-2",
    "council",
    "approval (stamp)",
    "one-pager",
    "separate venture kickoff"
   ],
   "shows_today": [
    "idea.captured"
   ],
   "takes_over": "manifest face: section at /arc-kickoff --lane discover"
  },
  {
   "room": "chat-mcp",
   "ring": "command",
   "source": "docs/strategy/plans/BRIEF-chat-mcp.md (sleeping — the face fires its trigger)",
   "line": [
    "hq_query",
    "hq_brief",
    "hq_pnl",
    "hq_inbox",
    "hq_approve"
   ],
   "note": "the same L2 reader + the same decision path exposed as MCP tools for other clients; renders as Ask arc's second door, never a separate truth (ADR-1307)",
   "takes_over": "manifest face: section when the brief wakes"
  }
 ],
 "roomCopy": [
  {
   "id": "today",
   "sentence": "The company ran all night. Here is what it did.",
   "lede": "the brief, the numbers that moved, and what is waiting on you — one screen, forty lines, no route change"
  },
  {
   "id": "inbox",
   "sentence": "A machine may raise it. Only you may decide it.",
   "lede": "the one write path in this product — a typed reason, no bulk action, no default, no undo"
  },
  {
   "id": "map",
   "sentence": "If it is not on this map, it is not in the company.",
   "lede": "every room a station, every lane a line — unexercised drawn dashed, planned drawn dotted, in-flight dots moving on receipt"
  },
  {
   "id": "spine",
   "sentence": "If it isn't an event, it didn't happen.",
   "lede": "append-only, canonical JSONL, a closed vocabulary of 46 kinds — corrections supersede, nothing is edited"
  },
  {
   "id": "board",
   "sentence": "Every lane, its phase, and what it is burning.",
   "lede": "the portfolio view — appetite spent against appetite bought, and how far each lane is from its own kill line"
  },
  {
   "id": "ask-arc",
   "sentence": "Ask in words. Every answer carries its receipt.",
   "lede": "a brain with no hands — it reads the live state, cites the ULID, and cannot stamp anything"
  },
  {
   "id": "engine-room",
   "sentence": "The model is a swappable part. The process is not.",
   "lede": "drivers, routers and budgets — the identity is the process file, the receipts and the constitution"
  },
  {
   "id": "model-policy",
   "sentence": "Tiers are law, not taste.",
   "lede": "which tier each process runs at, and why a change is a reviewed diff rather than a quiet edit (ADR-0069)"
  },
  {
   "id": "policy",
   "sentence": "Deny by default. Every capability earns its level.",
   "lede": "the subject table — what each process may touch, and the two keys that must turn for it to change"
  },
  {
   "id": "scheduler",
   "sentence": "Nothing runs because someone remembered.",
   "lede": "jobs, their next fire, their last outcome, and the heartbeat that proves the clock is alive"
  },
  {
   "id": "memory",
   "sentence": "A correction made twice becomes a rule.",
   "lede": "the playbook — what recall costs today, and which lessons were promoted out of the retro log"
  },
  {
   "id": "evolve",
   "sentence": "Measured, or it did not improve.",
   "lede": "champion against challenger, with a sample floor and a holdout — the winner lands as a reviewed diff, never self-merged"
  },
  {
   "id": "bench",
   "sentence": "Drivers are compared, never trusted.",
   "lede": "scored runs per driver per process, and what a disagreement between two of them costs to settle"
  },
  {
   "id": "absorb",
   "sentence": "What arrives from outside is quarantined before it is believed.",
   "lede": "intake — a candidate tool, skill or dependency is reported and vetted, and nothing installs itself"
  },
  {
   "id": "council-chamber",
   "sentence": "Twelve seats. No rubber stamps.",
   "lede": "blind parallel debate, a verifier grading every point, one bounded rebuttal, then a verdict that commits with its dissent"
  },
  {
   "id": "develop",
   "sentence": "A phase closes on evidence, or it does not close.",
   "lede": "the execution harness — slices, their proofs, and the Definition of Done each one is measured against"
  },
  {
   "id": "review-ship",
   "sentence": "Every gate blocks by default.",
   "lede": "seven gates, commit-keyed — a new commit is a new review, and a profile switches the whole set as one"
  },
  {
   "id": "design-studio",
   "sentence": "A rule unbroken is not the same as work worth shipping.",
   "lede": "briefs, explores, critiques and renders — and the BELOW-BAR class that exists because zero violations once meant a passing grade"
  },
  {
   "id": "toolbelt",
   "sentence": "Every command, every agent, every rule — one place to look.",
   "lede": "26 commands, 30 agents, 7 hooks, 7 rules, and the lints that hold them; click one and the face explains it"
  },
  {
   "id": "money",
   "sentence": "Real and simulated are different substances.",
   "lede": "revenue.received is real-only and has never fired; everything else on this screen says so in its own colour"
  },
  {
   "id": "growth",
   "sentence": "Reach is capped before it is measured.",
   "lede": "channels, what each published, and the caps that hold at every autonomy level"
  },
  {
   "id": "leads",
   "sentence": "An offer, not a broadcast.",
   "lede": "who was researched, who was contacted inside the daily cap, who replied, and what was actually offered"
  },
  {
   "id": "legal",
   "sentence": "Nothing ships under his name without a human hand.",
   "lede": "the content gates, the claims that need a source, and the pieces held at the publish gate right now"
  },
  {
   "id": "ops",
   "sentence": "Two live ventures away.",
   "lede": "planned, drawn dotted — this room opens when a second venture is running and support stops being one person"
  },
  {
   "id": "trader",
   "sentence": "Paper only, until a written rule change unlocks it.",
   "lede": "planned, drawn dotted — real-money trading sits at L0 behind a 72-hour cooldown and an amendment, not a toggle"
  },
  {
   "id": "discover",
   "sentence": "The next venture is chosen, not stumbled into.",
   "lede": "planned, drawn dotted — opens when the venture #2 slot needs filling from a scored field, not a hunch"
  },
  {
   "id": "ventures",
   "sentence": "The factory is not the product.",
   "lede": "each venture in its own repo with its own money and its own kill criteria — the venture track wins every tie"
  },
  {
   "id": "law",
   "sentence": "It outranks every roadmap, plan, and line of code.",
   "lede": "three eternal articles, ten working ones, and the friction any amendment has to survive"
  },
  {
   "id": "learn",
   "sentence": "Correct it twice, it becomes impossible.",
   "lede": "the retro loop — repeated corrections become permanent setup upgrades, and the ones still sleeping say what would wake them"
  },
  {
   "id": "strategy",
   "sentence": "One plan is live per lane. The rest are history.",
   "lede": "the plans, the ADRs behind them, and the decisions that are now too expensive to revisit"
  },
  {
   "id": "org",
   "sentence": "Sixteen lanes. Who is awake, who is idle, who is blocked.",
   "lede": "the company as a roster rather than a board — every lane, its status, and the one thing it is waiting on"
  },
  {
   "id": "concepts",
   "sentence": "Every word arc uses, and the room it lives in.",
   "lede": "107 terms, each anchored to a room and a station — this is what the command palette searches"
  },
  {
   "id": "lane",
   "sentence": "One lane, six zones, the same shape every time.",
   "lede": "the template every born lane instantiates — plan, phase, burn, gates, evidence, and what it owes right now"
  }
 ],
 "map": {
  "rings": [
   "command",
   "kernel",
   "factory",
   "money",
   "company"
  ],
  "rooms": [
   {
    "id": "today",
    "name": "Today",
    "ring": "command",
    "status": "built"
   },
   {
    "id": "inbox",
    "name": "Inbox",
    "ring": "command",
    "status": "built"
   },
   {
    "id": "map",
    "name": "Map",
    "ring": "command",
    "status": "built"
   },
   {
    "id": "spine",
    "name": "Spine",
    "ring": "command",
    "status": "built"
   },
   {
    "id": "board",
    "name": "Board",
    "ring": "command",
    "status": "built"
   },
   {
    "id": "ask-arc",
    "name": "Ask arc",
    "ring": "command",
    "status": "built"
   },
   {
    "id": "engine-room",
    "name": "Engine room",
    "ring": "kernel",
    "status": "built"
   },
   {
    "id": "model-policy",
    "name": "Model policy",
    "ring": "kernel",
    "status": "built"
   },
   {
    "id": "policy",
    "name": "Policy",
    "ring": "kernel",
    "status": "built"
   },
   {
    "id": "scheduler",
    "name": "Scheduler",
    "ring": "kernel",
    "status": "built"
   },
   {
    "id": "memory",
    "name": "Memory",
    "ring": "kernel",
    "status": "built"
   },
   {
    "id": "evolve",
    "name": "Evolve",
    "ring": "kernel",
    "status": "built"
   },
   {
    "id": "bench",
    "name": "Bench",
    "ring": "kernel",
    "status": "built"
   },
   {
    "id": "absorb",
    "name": "Absorb",
    "ring": "kernel",
    "status": "built"
   },
   {
    "id": "council-chamber",
    "name": "Council chamber",
    "ring": "factory",
    "status": "built"
   },
   {
    "id": "develop",
    "name": "Develop",
    "ring": "factory",
    "status": "built"
   },
   {
    "id": "review-ship",
    "name": "Review & Ship",
    "ring": "factory",
    "status": "built"
   },
   {
    "id": "design-studio",
    "name": "Design studio",
    "ring": "factory",
    "status": "built"
   },
   {
    "id": "toolbelt",
    "name": "Toolbelt",
    "ring": "factory",
    "status": "built"
   },
   {
    "id": "money",
    "name": "Money",
    "ring": "money",
    "status": "built"
   },
   {
    "id": "growth",
    "name": "Growth",
    "ring": "money",
    "status": "built"
   },
   {
    "id": "leads",
    "name": "Leads",
    "ring": "money",
    "status": "built"
   },
   {
    "id": "legal",
    "name": "Legal",
    "ring": "money",
    "status": "built"
   },
   {
    "id": "ops",
    "name": "Ops",
    "ring": "money",
    "status": "planned"
   },
   {
    "id": "trader",
    "name": "Trader",
    "ring": "money",
    "status": "planned"
   },
   {
    "id": "discover",
    "name": "Discover",
    "ring": "money",
    "status": "planned"
   },
   {
    "id": "ventures",
    "name": "Ventures",
    "ring": "money",
    "status": "built"
   },
   {
    "id": "law",
    "name": "Law",
    "ring": "company",
    "status": "built"
   },
   {
    "id": "learn",
    "name": "Learn",
    "ring": "company",
    "status": "built"
   },
   {
    "id": "strategy",
    "name": "Strategy",
    "ring": "company",
    "status": "built"
   },
   {
    "id": "org",
    "name": "Org",
    "ring": "company",
    "status": "built"
   },
   {
    "id": "concepts",
    "name": "Concepts",
    "ring": "company",
    "status": "built"
   }
  ],
  "kinds": [
   {
    "kind": "idea.captured",
    "group": "background",
    "homes": [
     "discover",
     "spine"
    ]
   },
   {
    "kind": "council.verdict",
    "group": "progress",
    "homes": [
     "council-chamber",
     "evolve"
    ]
   },
   {
    "kind": "council.outcome",
    "group": "progress",
    "homes": [
     "council-chamber",
     "evolve"
    ]
   },
   {
    "kind": "approval.requested",
    "group": "needs-you",
    "homes": [
     "inbox",
     "*decide-zones"
    ]
   },
   {
    "kind": "decision.recorded",
    "group": "progress",
    "homes": [
     "inbox",
     "council-chamber",
     "design-studio",
     "absorb"
    ]
   },
   {
    "kind": "kickoff.done",
    "group": "progress",
    "homes": [
     "lane"
    ]
   },
   {
    "kind": "phase.closed",
    "group": "progress",
    "homes": [
     "lane"
    ]
   },
   {
    "kind": "review.completed",
    "group": "progress",
    "homes": [
     "review-ship",
     "design-studio"
    ]
   },
   {
    "kind": "qa.completed",
    "group": "progress",
    "homes": [
     "review-ship"
    ]
   },
   {
    "kind": "commit.done",
    "group": "progress",
    "homes": [
     "review-ship"
    ]
   },
   {
    "kind": "ship.done",
    "group": "progress",
    "homes": [
     "review-ship"
    ]
   },
   {
    "kind": "revenue.received",
    "group": "money",
    "homes": [
     "money",
     "today"
    ]
   },
   {
    "kind": "revenue.simulated",
    "group": "money",
    "homes": [
     "money"
    ]
   },
   {
    "kind": "cost.incurred",
    "group": "money",
    "homes": [
     "money",
     "today"
    ]
   },
   {
    "kind": "month.closed",
    "group": "money",
    "homes": [
     "money",
     "spine"
    ]
   },
   {
    "kind": "run.completed",
    "group": "progress",
    "homes": [
     "engine-room",
     "scheduler",
     "bench",
     "ask-arc"
    ]
   },
   {
    "kind": "incident.raised",
    "group": "needs-you",
    "homes": [
     "ops",
     "policy",
     "evolve",
     "leads",
     "scheduler",
     "today"
    ]
   },
   {
    "kind": "redaction.applied",
    "group": "background",
    "homes": [
     "spine"
    ]
   },
   {
    "kind": "day.closed",
    "group": "background",
    "homes": [
     "spine",
     "trader"
    ]
   },
   {
    "kind": "note.logged",
    "group": "background",
    "homes": [
     "spine",
     "design-studio",
     "legal"
    ]
   },
   {
    "kind": "develop.started",
    "group": "progress",
    "homes": [
     "develop"
    ]
   },
   {
    "kind": "slice.done",
    "group": "progress",
    "homes": [
     "develop"
    ]
   },
   {
    "kind": "handoff.ready",
    "group": "needs-you",
    "homes": [
     "develop"
    ]
   },
   {
    "kind": "slice.stuck",
    "group": "needs-you",
    "homes": [
     "develop"
    ]
   },
   {
    "kind": "experiment.opened",
    "group": "progress",
    "homes": [
     "evolve"
    ]
   },
   {
    "kind": "experiment.assigned",
    "group": "background",
    "homes": [
     "evolve"
    ]
   },
   {
    "kind": "experiment.measured",
    "group": "background",
    "homes": [
     "evolve"
    ]
   },
   {
    "kind": "experiment.verdict",
    "group": "progress",
    "homes": [
     "evolve"
    ]
   },
   {
    "kind": "promotion.proposed",
    "group": "needs-you",
    "homes": [
     "evolve",
     "bench"
    ]
   },
   {
    "kind": "experiment.promoted",
    "group": "progress",
    "homes": [
     "evolve"
    ]
   },
   {
    "kind": "experiment.rolled_back",
    "group": "progress",
    "homes": [
     "evolve"
    ]
   },
   {
    "kind": "experiment.closed",
    "group": "progress",
    "homes": [
     "evolve"
    ]
   },
   {
    "kind": "lead.researched",
    "group": "background",
    "homes": [
     "leads"
    ]
   },
   {
    "kind": "outreach.sent",
    "group": "background",
    "homes": [
     "leads"
    ]
   },
   {
    "kind": "outreach.replied",
    "group": "progress",
    "homes": [
     "leads"
    ]
   },
   {
    "kind": "meeting.booked",
    "group": "needs-you",
    "homes": [
     "leads",
     "ventures"
    ]
   },
   {
    "kind": "lead.suppressed",
    "group": "background",
    "homes": [
     "leads"
    ]
   },
   {
    "kind": "deal.won",
    "group": "money",
    "homes": [
     "leads",
     "money",
     "ventures"
    ]
   },
   {
    "kind": "deal.lost",
    "group": "progress",
    "homes": [
     "leads",
     "ventures"
    ]
   },
   {
    "kind": "metric.observed",
    "group": "background",
    "homes": [
     "growth",
     "evolve",
     "spine"
    ]
   },
   {
    "kind": "policy.level.changed",
    "group": "progress",
    "homes": [
     "policy"
    ]
   },
   {
    "kind": "policy.demoted",
    "group": "needs-you",
    "homes": [
     "policy"
    ]
   },
   {
    "kind": "spend.reserved",
    "group": "money",
    "homes": [
     "policy",
     "money"
    ]
   },
   {
    "kind": "spend.released",
    "group": "money",
    "homes": [
     "policy",
     "money"
    ]
   },
   {
    "kind": "constitution.adopted",
    "group": "progress",
    "homes": [
     "law"
    ]
   },
   {
    "kind": "content.published",
    "group": "progress",
    "homes": [
     "growth",
     "today"
    ]
   }
  ],
  "lanesMap": {
   "absorb": "absorb",
   "bench": "bench",
   "design": "design-studio",
   "develop": "develop",
   "engine": "engine-room",
   "evolve": "evolve",
   "face": "toolbelt",
   "growth": "growth",
   "leads": "leads",
   "ledger": "money",
   "legal": "legal",
   "memory": "memory",
   "model-policy": "model-policy",
   "policy": "policy",
   "portfolio": "board",
   "scheduler": "scheduler"
  }
 },
 "inbox": {
  "cli": ".claude/scripts/hq/arc-inbox.mjs",
  "usage": [
   "// arc-inbox inbox list OPEN approvals (approval.requested, undecided)",
   "// arc-inbox approve <ULID> --reason R record decision.recorded verdict=approve",
   "// arc-inbox reject <ULID> --reason R record decision.recorded verdict=reject"
  ],
  "maxReasonBytes": 2000,
  "keys": {
   "inbox": {
    "next": "j",
    "prev": "k",
    "approve": "a (ARMS, does not stamp)",
    "reject": "r (ARMS, does not stamp)",
    "cancel": "Escape",
    "submit": "Enter records the ARMED verdict with the typed reason; Shift+Enter is a newline",
    "src": "face/src/lib/inbox.mjs:750; face/src/rooms/Inbox.tsx:13-14,427-430"
   },
   "shell": {
    "roomMove": "j / ArrowDown = next room, k / ArrowUp = previous room",
    "palette": "Cmd/Ctrl+K toggles the palette",
    "src": "face/src/lib/shell.mjs:133,147-148"
   }
  },
  "rules": [
   {
    "key": "0",
    "text": "// no bulk action there is no control that decides more than one thing"
   },
   {
    "key": "1",
    "text": "// no default reason the box starts empty and nothing ever writes into it"
   },
   {
    "key": "2",
    "text": "// no undo a decision is final; the card says so before the stamp, not after"
   },
   {
    "key": "3",
    "text": "// no pre-fill switching cards never carries a reason across"
   },
   {
    "key": "4",
    "text": "// no retry a write that may have landed is never sent twice"
   },
   {
    "key": "5",
    "text": "inbox: \"the one write path in this product — a typed reason, no bulk action, no default, no undo\","
   }
  ],
  "readerOnly": "// SPINE-G (ADR-0030): this is a reader-only consumer. The OPEN set is recomputed on every run",
  "oneWriter": "// same inbox. Decisions are WRITTEN only through arc-event, the one writer; this file never",
  "envelope": {
   "requiredKeys": [
    "id",
    "v",
    "ts",
    "idem",
    "actor",
    "process",
    "model",
    "venture",
    "run_id",
    "kind",
    "payload",
    "outcome",
    "cost",
    "evidence",
    "supersedes"
   ],
   "count": 15,
   "optional": [
    "sha (computed by the emitter; verified when supplied)"
   ],
   "schemaVersion": {
    "text": "export const SCHEMA_VERSION = 1;",
    "src": ".claude/scripts/hq/lib/validate.mjs:86"
   },
   "src": ".claude/scripts/hq/lib/validate.mjs:90-92"
  },
  "decisionPayload": {
   "fields": [
    "decides",
    "reason",
    "verdict"
   ],
   "src": ".claude/scripts/hq/arc-inbox.mjs:161"
  },
  "profiles": {
   "note": "approval.requested stays generic; approval PROFILES (policy.promotion, absorb A/B, ledger criteria) ride the same kind",
   "src": ".claude/scripts/hq/lib/validate.mjs:386-404",
   "imports": [
    {
     "text": "import { isPromotionRequest } from \"./lib/validate-policy.mjs\";",
     "src": ".claude/scripts/hq/arc-inbox.mjs:20"
    },
    {
     "text": "import { isAbJudgement } from \"./lib/validate-absorb.mjs\";",
     "src": ".claude/scripts/hq/arc-inbox.mjs:21"
    },
    {
     "text": "import { isCriteriaChange } from \"./lib/validate-ledger.mjs\";",
     "src": ".claude/scripts/hq/arc-inbox.mjs:22"
    }
   ]
  }
 },
 "askArc": {
  "file": "face/src/lib/ask.mjs",
  "can": [
   "\"ask-arc\": \"a brain with no hands — it reads the live state, cites the ULID, and cannot stamp anything\",",
   "/ What Ask arc is granted. Nothing here can write; ask costs a governed receipt and says so. */",
   "ASK_GRANTS = [\"ask\", \"spine\", \"inbox\", \"lane\", \"file\"]",
   "halfLine: No model, no key, no spend. Every number below was computed from the log by L2 — ${source}. This half cannot hallucinate a receipt because it never w…"
  ],
  "cannot": [
   "* REQ-07's rule is \"zero write tools\", and a room can honour that in two ways:",
   "// Ask arc renders an answer a brain assembled. Neither may act, and the audit that proves it",
   "// ULID via L2 marks the answer *unverified* (never silently kept)\" is a DoD line, not a",
   "* unverified at least one claim did not resolve, OR the brain marked itself unverified.",
   "export const MAX_QUESTION_BYTES = 2000;"
  ],
  "verifiedClasses": {
   "classes": [
    "verified",
    "unverified",
    "absence",
    "uncited",
    "checking"
   ],
   "src": "face/src/lib/ask.mjs:1214"
  },
  "adr1307": null,
  "policyRow": null,
  "processFile": null
 }
}
