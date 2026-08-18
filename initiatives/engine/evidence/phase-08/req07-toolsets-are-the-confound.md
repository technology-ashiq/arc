# Phase 08 — the toolsets were the confound, measured 2026-08-18

This cycle carried one unexplained result for four sessions: **the runtime would not honour a
one-shot output contract.** Three explanations were offered and each was disproved in turn.

| explanation | how it was disproved |
|---|---|
| the parser is mis-reading the answer | `drivers/hermes` extracted exactly what arrived, every time (`adversarial-passes.md`) |
| the config was stale | `_config_version` fixed, runtime migrated to v33, behaviour unchanged (`runtime-answer-reliability.md`) |
| the model is too small | a **hosted** model failed the same way an 8B local one did (`req07-three-real-dispatches.md`) |

**It was none of those.** `hermes tools list` on the pinned digest shows the image enabling
**seventeen toolsets by default**:

```
web · browser · terminal · file · code_execution · vision · image_gen · bfl · tts
skills · todo · memory · session_search · clarify · delegation · cronjob · computer_use
```

Every "wrong shape" this cycle recorded is one of those doing exactly its job:

| what was observed | the toolset that did it |
|---|---|
| the draft written to `/tmp/build-in-public-draft-…` instead of returned | `file` + `terminal` + `code_execution` |
| *"Should I include any co-authors, issue references, or other metadata?"* | `clarify` |
| *"Example Domain is the title of the page"* | `web` + `browser` |
| a marker planted in run N readable in run N+1 (ADR-0222) | `memory` |

**The runtime was never failing to answer. It was doing the job a different way, with the tools it
was handed.** `-z` makes a session headless — the vendor's own text says *"print ONLY the final
response text to stdout"* — and in the same paragraph says *"Tools, memory, rules and AGENTS.md in
the CWD are loaded as normal"*. Headless is not single-turn, and it is not tool-free.

## The measurement

Identical prompt, identical pack, identical image, identical key. One flag apart.

| invocation | exit | wall | api calls | input tokens | result |
|---|---|---|---|---|---|
| all 17 (no `-t`), ×3 dispatches | 1 | 150–307 s | — | — | `$.draft` absent every time, 2 attempts each |
| `-t vision` | **0** | **55 s** | **1** | **2,134** | **a valid draft, `$.draft` present, sources cited** |
| `-t ""` | 0 | ~120 s | **3** | **30,248** | the full agentic shape — see below |
| `-t none` | **2** | 41 s | — | — | no output, no usage report |

The draft it returned, verbatim and unedited, from `#tripwire-dead-on-arrival` in the pack:

> A test in the audit suite was passing for four days while measuring nothing. Its probe asked a
> mounted volume for a config file that had never been placed there, so every run skipped the
> assertion silently and the suite read green. The fix rule landed immediately: assert that a probe
> *ran* before asserting what it printed.
>
> Surprising part: the suite was green on every machine, including CI, because the skip was
> indistinguishable from a pass. That's the blind spot this one cost us to find.

`sources: ["#tripwire-dead-on-arrival"]`, `task-class` and `pack-ref` echoed. The schema was
satisfied on the first attempt, with no retry and no proposal.

## `-t ""` IS A FAIL-OPEN, and it is the same defect ADR-0223 fixed hours earlier

An empty value does not mean "no toolsets". It reads as **no override at all**: three api calls and
30,248 input tokens against one call and 2,134 for `-t vision` — the full seventeen-toolset agentic
shape. So to this CLI an ABSENT `-t` and an EMPTY `-t` are the same input, and that input is
*everything*.

That is precisely the distinction ADR-0223 had to fix inside arc's own gate the same day —
`tools: []` read as an absence rather than a statement — found here in someone else's argument
parser, failing in the dangerous direction. **arc must never pass an empty `-t`.** ADR-0224 makes
that a rule with a test rather than a habit.

## `-t <unknown>` EXITS 2, AND 2 IS ALREADY SPOKEN FOR

`-t none` was measured: the runtime refuses and exits **2**. In ENG-D's map (ADR-0219) exit 2 is
BUDGET_DECLINED. So a typo in a toolset name would be reported to arc as *the driver declined for
budget* — a wrong diagnosis of a wrong thing, on the one code path whose whole job is to separate a
driver fault from a budget one. Fail-closed and loud is the right behaviour from the runtime; it is
the wrong CODE for arc to receive, so the list is validated before the container starts.

## Also settled: the usage report DOES write, with real token counts

`req07-three-real-dispatches.md` recorded that the three dispatches filled the model seat and left
the trigger unestablished. The `-t vision` run settles the shape of it — a complete report:

```json
{ "estimated_cost_usd": 0.0, "cost_status": "unknown", "cost_source": "provider_models_api",
  "input_tokens": 2134, "output_tokens": 193, "cache_read_tokens": 192,
  "total_tokens": 2519, "api_calls": 1, "model": "poolside/laguna-s-2.1:free" }
```

So the reader ADR-0221 clause 4 ships as *"fail-safe plumbing, and NOT claimed to work against the
real runtime"* works, and `cost_status: "unknown"` is the runtime telling the truth about cost — which
is what ADR-0069 b5 wants and why the driver must keep refusing to write that `estimated_cost_usd`
into a cost field. **ADR-0221 clause 4 needs an amendment.**

**The trigger is still not established, and the picture got stranger rather than clearer.** A report
appeared on the three long failing dispatches (model only, no counts) and on this short successful
restricted run (complete). It did NOT appear on two direct one-shot probes — a successful
`{"ok": true}` and a 401 on a bogus key — even though the vendor's `--help` states *"The report is
written even when the run fails, so pipelines can always account for spend."* **That documented claim
is false as written on this digest.** Four of six observed runs wrote one. Recorded as an open
question, not resolved.

## What this does not claim

`vision` is a workaround, not a design. It is the narrowest thing arc can honestly say to a CLI that
cannot express "nothing", and the day `-t` grows a real empty spelling, `NARROWEST_TOOLSET` is the
one constant to change. The alternatives were each worse and are named in the code: `todo` keeps
planning state, `session_search` reads previous sessions, `tts` and `image_gen` produce FILES.

Nothing here was re-run against the approved pack. The `N=3` approval was already spent by the three
dispatches, so every measurement above is either a direct container probe or a fake-docker argv
assertion — never a fourth dispatch of owner-approved data.
