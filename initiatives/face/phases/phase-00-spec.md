# Phase 00 — Brief + coverage contract

**Goal (one line):** the design brief (four contracts) passes `design-lint`, and the
Coverage map is frozen as the machine-readable contract every later phase builds against.
**Appetite:** 1 day
**Depends on:** none

**Required reading for this phase** (part of the executor's information set):
`docs/strategy/plans/PLAN-face.md` §§ "Coverage map" + "Coverage appendices A–D" (the
room list and appendices are transcribed from there, never re-invented) and
`docs/templates/design-brief-template.md` (the design-lint grammar's own template —
design-lint parses section headings exactly and reads its floors from the brief's a11y
line; authoring FROM the template is what makes exit 0 reachable deterministically).

## Exit criteria (Definition of Done)

- [ ] `docs/design/briefs/face-hq/brief.md` authored FROM
      `docs/templates/design-brief-template.md`, carrying the four contracts (A
      interaction · B art direction with Ink & Signal as direction-to-beat · C platform ·
      D content) per ADR-1308, the panel state matrix (empty · loading · error with
      refusal code · success · disabled/sealed — the design source's B-contract list),
      slop kill-list, a11y floor and reference bar — `design-lint` passes it (exit 0)
- [ ] the machine-readable expected set frozen under `initiatives/face/contracts/`
      as **JSON** (the format is forced, not chosen: `face:` sections land inside
      `products/*/manifest.json`, and the zero-dep law (A2) leaves node's `JSON.parse`
      as the only parser-free structured reader — sim round-2 blocker, resolved here;
      filenames free, content and format mandatory): the 32-room list + appendices A–D transcribed
      from the design source (46 kinds → homes, 26 commands, 30 agents, 6 processes, 7
      gates, the concepts/glossary inventory) — this exact artifact is what the
      `face-coverage` lint (Phase 05) consumes as its expected set
- [ ] the `face:` schema draft in the same dir (JSON, same rule), fields exactly per ADR-1306: `room`,
      `ring`, `kinds[]`, `actors[]`, `sanctioned[]`, `stations[]`, `decisions[]`,
      `numbers[]`, `concepts[]` — plus the planned-rooms registry draft (ops · trader ·
      discover · chat-mcp)
- [ ] signature-screen list (8) named in the brief: Today · Inbox · Map · Spine/Tape ·
      Council room · Money · Board · Ask arc
- [ ] assumptions ledger carried into PLAN.md with triggers (kickoff step 4 — done at
      kickoff, verified present)
- [ ] tracker updated — `initiatives/face/PROGRESS.md`: the Phase 00 row in `## Phase
      table` flips to `✅ done YYYY-MM-DD` (only `/arc-phase-done 00 --lane face` flips
      it), and one dated bullet lands in its `## Done-log` section
- [ ] owner reads the brief and says "purinjathu" (understood) — recorded as a dated
      done-log bullet naming the brief's commit SHA, so the ack binds to the exact text
      read

## Verification plan

- **Test command:** `node .claude/scripts/design/design-lint.mjs docs/design/briefs/face-hq/brief.md`
- **Expected failure first:** before this phase the brief file does not exist —
  design-lint exits non-zero with a missing-file/section error (red), and after authoring
  it exits 0 (green). A brief passing on first write without ever having failed is the
  vacuous-pass smell — run the command once BEFORE authoring.
- **Live demo scenario:** open the brief; every level-2 section the design-lint grammar
  requires is present with real content (no lorem, no placeholder); the coverage contract
  file lists all 32 rooms and the 46-kind appendix.
- **Real-system check:** n/a — docs only this phase; no product code (owner approval
  gate stands).
- **Expected evidence:** BOTH design-lint transcripts (red then green) · brief file ·
  the contracts dir's frozen expected-set + schema + registry files · the done-log ack
  bullet carrying the brief's commit SHA — artifacts, never reports about them.

## Rabbit holes in this phase

Writing panel designs into the brief (that is Phase 01's job) · inventing manifest schema
beyond the ADR-1306 field set · starting the `face-coverage` lint (Phase 05).

## Out of scope for this phase

Variants and rendering (Phase 01) · any L2 code (Phase 03) · `face:` sections in real
manifests (Phase 05).

## Your-setup / pending

None — docs only.

## Non-negotiables (verbatim from PLAN)

- One write path, mandatory reason, byte-parity with the CLI (E2, E1, ADR-1302).
- Reader-only over the spine; no second truth in the UI (SPINE-G/ADR-0030, A5, ADR-1301).
- Every number has *Why?* precedents; no invented numbers, ETAs, health emoji (A1, E3).
- Real vs simulated/rehearsal/drill never mixed or summed; MISSING ≠ 0; ABSENT with reason (E3, ADR-1313, ADR-1018, ADR-0416).
- Kinds, gates, lanes, ADR ids verbatim (A5); unknown kinds/profiles render generically — nothing dropped silently (E1, ADR-1306).
- Seals for every forever-human action; no button ever exists for them (E2, ADR-1303, ADR-0069 b1, ADR-0305, ADR-0110, ADR-1203).
- Localhost + token; no PII; escaped serializer (ADR-1312, ADR-0410, LED-C, SPINE-E).
- Design lane law: three theses, blind jury with reference, owner pick + prediction, two critique rounds max (ADR-1308, ADR-0034…0049).
- Every new face lint starts WARN-first in the TRIAL set and earns FAIL through the trial ledger (A1) — `face-coverage` excepted (a validator over the tree, FAIL from birth like policy-lint, ADR-1311).
- The Engine room's unlock-ladder rung indicator reads evidence only — the rung is never a control (E2).
- Tests green on CI per job; two fresh attackers per gate (decision logic + shell/HTTP boundary); attacker prompt carries the lane's fixed-defect list; vacuous-pass rule (assert it RAN before asserting what it printed).
- Zero product-code writes before explicit owner approval of this plan; L3 stack never enters the arc repo (ADR-1300, ADR-1309).
