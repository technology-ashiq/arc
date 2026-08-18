# ADR 0223 — an empty tools list is a declaration, not an absence, and the narrowest process in the repo was the only one the gate refused

**Status:** accepted
**Date:** 2026-08-18
**Product:** `engine` — Cycle 7, executor v1. Corrects the reading of `tools:` in the Phase-01 headless gate (REQ-02); applies ADR-0220's root split to the CLI drivers. Decides nothing new about policy levels.
**Reversibility:** two-way
One predicate in one function, one refusal in one driver, one shared root helper, and the tests that pin all three. Reverting restores a state in which `processes/build-in-public-draft.process.yaml` cannot be dispatched at all, which is the condition this decision exists to remove.
**Revisit trigger:** a process ships `permissions: declared` + `tools: []` and is nonetheless observed causing a side effect. That would mean a tool reached a runtime by a route other than the `tools:` list, and the finding would belong to that driver — but this ADR is where to come back to first.

Routed as a defect fix on Phase 06's own red CI, not via `/arc-change`: the gate was blocking a file the phase had already landed, so this is the phase finishing its own work rather than new scope.

## Context

`declaredCapabilities()` in `.claude/scripts/hq/lib/policy/run-gate.mjs` maps what a process file
declares onto the capability vocabulary. `authorizeRun()` then denies a run that declares a
capability policy denies outright (L0). The intersection is the whole rule: a process may request
LESS than its grant and never more (POL-D).

The predicate read:

```js
const tools = Array.isArray(doc.tools) ? doc.tools : [];
if (tools.length === 0) return new Set(CAPABILITIES); // nothing to go on -- assume the worst
```

That line collapses two inputs which are not the same input:

- **`tools:` absent, null, or holding a scalar** — the file never said what it needs. This is an
  ABSENCE OF INFORMATION, and deny-by-default is correct: assume every capability.
- **`tools: []`** — the file said, explicitly, that it needs nothing. This is a STATEMENT, and the
  narrowest one the vocabulary can express.

`processes/build-in-public-draft.process.yaml` (REQ-07) is the first file in the repo to make that
statement, and it makes it deliberately: *"NO `git.op`, NO `shell.run`. This process reads a pack
and returns prose... a draft process that could commit is a draft process that can publish."* Its
`hq.policy.yaml` row grants L0 on write, shell, message, publish, deploy and spend to match.

Read as an absence, that file declared all eight capabilities, collided with its own six L0 grants,
and the gate refused to start it:

```
BLOCKED: build-in-public-draft(write,shell,message,publish,deploy,spend)
```

**The strictest file in the repo was the only one the gate would not run.** It was found by
`tests/policy-runwrapper.bats` — *"every process in the repo passes its own gate"* — on all three CI
legs at once, which is that test working exactly as its comment says it should: *"either the policy
file is wrong about what that process does, or the process declares something it should not."*
Neither was true. The gate was wrong about what "nothing" means.

**The inconsistency was already visible from the other side.** `ask.human` maps to no capability at
all (*a prompt to a human is not a capability the machine holds*), so `tools: [ask.human]` produces
the identical empty capability set — and sailed through, because the length check fired on the LIST,
not on the SET. Same effective declaration, opposite verdicts, and the stricter file lost.

This repo had already written the general form down once, in this cycle, in REQ-04: *"a row where
any of the 4 is absent, empty, `null` or malformed fails the router load... because 'missing' and
'present but empty' are different inputs and a near-miss that loads is a guard that cannot fail."*
The rule was applied to the router row and not to the declaration the same phase reads three files
away.

## Decision

1. **`tools:` that is not a list stays deny-by-default.** Absent, null, a scalar, a mapping — every
   one is an absence of information and declares all eight capabilities. This half of the old
   behaviour is preserved deliberately and pinned by negative controls, because over-applying the
   change is its whole risk.

2. **An explicitly empty list declares nothing — but only under `permissions: declared`.** The
   `permissions` field is part of the predicate. `unrestricted` means *"nobody has narrowed this
   file yet"*: the adapters and drivers emit no allowed-tools line for it, and an absent line is
   UNRESTRICTED. So `unrestricted` + `tools: []` keeps the full-capability reading, or the gate
   would answer *"asks for nothing"* about the exact file the driver hands the default tool set to.

3. **The policy row is not touched.** The rejected alternative was to raise the row's L0 grants to
   L1 so the declared-INTERSECT-granted product came out non-empty. That would have widened real
   authority — write, shell, publish, deploy and spend — on a hosted contractor at the L1-drafts
   ceiling, to work around a misreading. It also is not this session's to make: POL-I puts the
   grant with the owner, and a self-granted hiring row is precisely what that rule prevents.

4. **The CLI drivers reuse the adapter's REFUSAL, not only its mapping.** `adapters/claude-code.mjs`
   throws on an empty grant under `declared`, because an absent `--allowedTools` is UNRESTRICTED.
   `drivers/claude-code.mjs` had the mapping and omitted the rule — `if (allowed) args.push(...)` —
   so the rule held at compile time and not at dispatch. It now throws the same way.

5. **A driver reads its canonical process file from the MACHINERY root, never `$ARC_ROOT`.**
   ADR-0220 already says `processes/` belongs to `root` and not to `workRoot`; the drivers were
   reading it from the work root, so `driverPolicyDenial` validated the file at `policyRoot()` while
   the driver body built its prompt and its tool grant from a different file. One shared
   `canonicalRoot()` in `drivers/common.mjs` now serves both CLI drivers, so there is no second
   implementation to drift.

6. **The test that asserted the old reading is replaced, not supplemented.** It read *"an empty
   tools list declares everything rather than nothing"*. A rule and the test protecting it were
   wrong together; fixing only the module would have been reverted by CI, correctly.

## What the adversarial pass found, and what it changed

Two fresh agents on different surfaces attacked the first draft of this change. The decision-logic
surface broke it three times, and every break is folded into the decision above rather than argued
with:

- **Clause 2 did not exist in the first draft.** `permissions: unrestricted` + `tools: []` was
  lint-clean, gate-clean, and compiled to an unrestricted command — the same inversion this ADR
  removes, entering from the opposite side of the same two fields.
- **Clause 4 did not exist.** With the gate no longer blocking, `tools: []` reached
  `drivers/claude-code.mjs`, which omitted `--allowedTools` and thereby handed over the CLI default
  set. The compile-time refusal that would have caught it is short-circuited for this file by
  `baseline.waived`, so the run gate had been the only thing standing there.
- **Clause 5 did not exist**, and the split read was demonstrated with an attacker-authored
  `processes/` tree: the gate reading arc's benign file while the prompt and the tool grant came
  from the hostile one. `codex.mjs` carried the identical defect and is fixed in the same change —
  the twin, found by grepping the pattern rather than the file.

**The first draft's justification comment was also wrong and is rewritten.** It claimed *"every tool
is gated at the tool boundary"*. Measured: `drivers/hermes.mjs` reads no tools at all, the
interactive `PreToolUse` hook is disarmed unless `ARC_POLICY_HOOK=1` and judges `session:interactive`
rather than the process kind, and `arc-jobs` script jobs have no tool boundary in front of them at
all. The honest claim is narrower and is the one now in the code: **a `declared` process with no
tools is handed nothing by the surfaces that hand tools over**, and those surfaces now refuse rather
than omit. An agent runtime is constrained by its container and its egress policy — which is what
Phase 06 certifies — and not by this list.

## Consequences

- `build-in-public-draft` becomes dispatchable, which unblocks REQ-07's three real runs and with
  them the close of Phase 08.
- Any future process may declare `permissions: declared` + `tools: []` and be trusted to mean it.
  That is the intended shape for every read-and-return-prose contractor this cycle expects to hire.
- The `[ask.human]`-only and `[]` cases now agree at the gate, and both are refused at the driver
  rather than silently widened.
- A hostile `$ARC_ROOT` can no longer hand a driver a process file the gate never saw.
