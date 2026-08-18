# Phase 08 — what the runtime was TOLD, and the confound that was not the toolsets

> **THIS FILE WAS FIRST WRITTEN AS `req07-toolsets-are-the-confound.md` AND ITS CENTRAL CLAIM WAS
> WRONG.** Renamed and corrected 2026-08-19. Everything below the correction is the original
> measurement of what the TOOLSETS do, which stands; what does not stand is the causal story it was
> wrapped in. Kept rather than deleted, because the way the wrong answer was reached is the more
> useful record.

## The correction

**The seventeen default toolsets were not the answer-reliability confound. The prompt was.**

`drivers/hermes.mjs` built a three-line prompt: the process NAME, "reply with ONE JSON document",
and the input. No `doc.body`, no output contract, not one field name. `drivers/claude-code.mjs` has
always sent the brief; nothing ever compared the two, and `grep -c 'doc.body' hermes.mjs` returned
**0** for the whole cycle.

So `$.draft: required property is absent` was the only honest thing the runtime could produce. It
had never been told the contract has a `draft`.

**Isolated 2026-08-19, one variable at a time, same pack, image and key:**

| prompt | toolsets | exit | wall | result |
|---|---|---|---|---|
| thin (name only) | all 17 | 1 | 150–307 s | `$.draft` absent, 3 dispatches × 2 attempts |
| thin (name only) | `-t vision` | 1 | 99–194 s | `$.draft` absent, 3 dispatches × 2 attempts |
| full (brief + contract) | `-t vision` | 0 | 55 s | a valid draft, sources cited |
| full (brief + contract) | all 17 | **0** | **62 s** | **a valid draft** |

The bottom row is the cell that settles it, and it is the cell that was missing when ADR-0224 was
written.

## How the wrong answer was reached, because that is the reusable part

**The comparison changed two variables at once.** Thin-prompt-plus-all-toolsets was compared against
full-prompt-plus-`vision`, and the difference was attributed to the flag. That is the confounded
experiment this cycle keeps recording in other people's work.

**And the cell that would have caught it WAS RUN.** A `-t ""` probe went out with the full prompt and
came back with a valid draft — pretty-printed across several lines. The probe's own verdict parser
only recognised a JSON object on ONE line, so it printed `NO JSON OBJECT ON STDOUT` on a run that had
succeeded. **A measurement tool produced a false negative and a conclusion was built on it**, which
is the same class as trusting an agent's report about a screenshot instead of opening the screenshot
— applied here to a probe of my own writing.

**Cost: six dispatches and two owner approvals**, against a bug findable by reading five lines of the
driver and diffing them with the driver next to it.

## What the toolset narrowing IS still for

Not answer reliability — isolation. A draft process that declares `tools: []` was being handed
`file`, `terminal`, `code_execution` and `memory` it never asked for, and that is a real widening on
a hosted contractor at the L1-drafts ceiling. It belongs to REQ-02, and ADR-0224 keeps it on those
terms. The two measured hazards guarded there are independent of the error above and both stand:
`-t ""` is a fail-open, and `-t <unknown>` exits 2 where ENG-D reads 2 as BUDGET_DECLINED.

---

## The original write-up, preserved

### (as first recorded 2026-08-18)

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
