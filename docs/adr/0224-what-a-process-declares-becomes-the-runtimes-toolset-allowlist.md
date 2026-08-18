# ADR 0224 — what a process declares becomes the runtime's toolset allowlist, and the seventeen defaults were the confound

**Status:** accepted
**Date:** 2026-08-18
**Product:** `engine` — Cycle 7, executor v1. Completes ADR-0223 (which made `tools: []` mean something) and amends ADR-0221 clause 4. Decides nothing about policy levels.
**Reversibility:** two-way
One derivation function, one validated `-t` argument, and the tests that pin them. Reverting restores a runtime with all seventeen toolsets on every dispatch — which is the state in which three of three real dispatches failed their schema.
**Revisit trigger:** the runtime CLI grows a real spelling for "no toolsets" (today an empty `-t` is a fail-open). Then `NARROWEST_TOOLSET` is the one constant to change, and clause 3 below is re-decided rather than left as a documented workaround.

Recorded as the finding that closed a four-session confound, not as new scope: REQ-07 had already run and failed, and this is the diagnosis of that failure.

## Context

Full measurement: `initiatives/engine/evidence/phase-08/req07-toolsets-are-the-confound.md`.

For four sessions this cycle carried one unexplained result — **the runtime would not honour a
one-shot output contract** — and three explanations were offered and disproved in turn: the parser
(it extracted exactly what arrived, every time), the config (fixed, behaviour unchanged), and the
model tier (a hosted model failed the same way an 8B local one did).

`hermes tools list` on the pinned digest shows the image enabling **seventeen toolsets by default**,
including `file`, `terminal`, `code_execution`, `clarify`, `web`, `browser` and `memory`. Every
"wrong shape" this cycle wrote down is one of those doing its job: the draft written to `/tmp`
instead of returned (`file` + `terminal` + `code_execution`), *"Should I include any co-authors?"*
(`clarify`), *"Example Domain is the title of the page"* (`web` + `browser`), and the run-N marker
readable in run N+1 that ADR-0222 exists to contain (`memory`).

**The runtime was never failing to answer. It was doing the job a different way, with the tools it
was handed.** `-z` makes a session headless; the vendor's own help text says in the same paragraph
that *"tools, memory, rules and AGENTS.md in the CWD are loaded as normal"*. Headless is not
single-turn and it is not tool-free.

Measured, identical prompt and pack, one flag apart:

| invocation | exit | wall | api calls | input tokens | result |
|---|---|---|---|---|---|
| all 17 (no `-t`), ×3 | 1 | 150–307 s | — | — | `$.draft` absent every time |
| `-t vision` | 0 | 55 s | 1 | 2,134 | a valid draft, sources cited |

And arc already had the vocabulary for this. `processes/*.process.yaml` says what a process needs,
and ADR-0223 made `tools: []` mean *nothing* rather than *everything*. What that ADR could not claim
— and said so in its own comment — is that the declaration constrained the runtime, because
`drivers/hermes.mjs` read no tools at all. The CLI's `-t/--toolsets` flag closes that gap.

## Decision

1. **A process's declared `tools:` list becomes the runtime's toolset allowlist for the
   invocation.** `drivers/hermes` derives `-t` from the canonical process document via one shared
   reader (`canonicalDoc`, so the gate and the dispatch cannot be shaped by different reads of the
   same file — the defect ADR-0223's adversarial pass found in two drivers).

   | arc token | runtime toolsets |
   |---|---|
   | `fs.read`, `fs.write` | `file` |
   | `shell.run` | `terminal`, `code_execution` |
   | `git.op` | `terminal`, `web` |
   | `agent.invoke` | `delegation` |
   | `ask.human` | `clarify` |

   `git.op` reaches the network as well as the shell, which is what `TOOL_CAPABILITIES` in the gate
   already records; the two tables agree by construction and a test asserts it.

2. **A declaration that cannot be narrowed passes NO flag, and says so out loud.** No canonical
   file, unparseable, `permissions: unrestricted`, a `tools:` that is not a list, or a token nobody
   has classified — each keeps the runtime's own defaults. An absence of information is not a narrow
   claim, and narrowing a process nobody has described would break dispatches this change is not
   entitled to break; refusing an undeclared process is the GATE's job, not this function's. The
   wide posture is announced on the transcript, the same contract this driver already keeps for an
   unconfined egress and `PreToolUse.sh` keeps for a missing dispatcher: **a disarmed guard must
   never be silent.**

3. **A process that declares NOTHING gets `vision`, and that is a documented workaround rather than
   a design.** `-t ""` was measured as a **fail-open** — the empty value reads as no override and
   the run came back with three api calls and 30,248 input tokens, the full seventeen-toolset shape
   — so arc must never pass an empty value. `-t <unknown>` is refused, so "nothing" cannot be
   spelled as a made-up name either. `vision` is the narrowest real toolset: it analyses an image
   the caller supplies, and there is none. The rejected alternatives are named because implicit
   choices rot: `todo` keeps planning state, `session_search` reads previous sessions and is
   memory-adjacent, `tts` and `image_gen` produce FILES.

4. **The toolset list is validated against the image's own vocabulary before the container starts.**
   `-t none` was measured: the runtime refuses and exits **2**, and ENG-D reads 2 as
   BUDGET_DECLINED. A typo would therefore reach arc as *the driver declined for budget* — a wrong
   diagnosis of a wrong thing, on the code path whose entire job is to tell a driver fault from a
   budget one. `KNOWN_TOOLSETS` is pinned from `hermes tools list` on the pinned digest, and a test
   asserts the map can never produce a name outside it.

5. **ADR-0221 clause 4 is amended.** It ships the `--usage-file` reader as *"fail-safe plumbing, and
   NOT claimed to work against the real runtime"*. On the real path the reader fired and filled the
   model seat on all three dispatches, and the `-t vision` run produced a complete report with token
   counts and `api_calls`. The reader works. What does NOT work is the vendor's documented promise
   that the report is *"written even when the run fails"* — four of six observed runs wrote one, and
   the two that did not include a failing run. The trigger stays unestablished and is recorded as an
   open question rather than guessed at.

## Consequences

- `build-in-public-draft` becomes answerable, not merely dispatchable. The next pack approval buys a
  real draft rather than a fourth measurement of the same confound.
- Every existing process keeps its current behaviour unless it declares tools this map knows, so no
  dispatch narrows by surprise. `demo` and every fixture process are unaffected.
- The three-way agreement between the gate's `TOOL_CAPABILITIES`, the adapter's `renderAllowedTools`
  and this driver's `TOOLSET_FOR` is now something a test can hold; before, two of the three did not
  know the third existed.
- The cycle's answer-reliability question is closed with a cause rather than a workaround, and
  `runtime-answer-reliability.md`'s conclusion that *"an 8B local model does not produce the shape a
  real arc process needs"* is superseded: a hosted model did not either, until the toolsets came off.
