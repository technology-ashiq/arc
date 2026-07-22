# Retro log — patterns that must not repeat

> Append-only, ONE line per pattern. Written by `/arc-retro` (recurring findings only,
> never one-offs). Read by `/arc-kickoff` step 5 to seed the pre-mortem — read as-is,
> never summarized. This file is why kickoff quality compounds across projects.
>
> Format: `YYYY-MM-DD | project | pattern | prevention | tags`
> Tags: lowercase tokens (e.g. `deploy,ci,scope`) — focus C matches by tag overlap.

2026-07-16 | arc-council-v2 | an adversarial "construct a concrete breaking input and run it" pass found real holes in every freshly-built lint/gate each phase (P0 11, P1 16, P2 1 high-sev fabrication loophole) — code that looked correct and passed its own fixtures | for any hand-authored gate/lint/parser, run an adversarial breaking-input workflow BEFORE close; mandatory verification, not optional review | lint,gate,parser,verification,adversarial
2026-07-16 | arc-council-v2 | the same markdown-contract parsing bugs recurred across phases: first-match where a section legitimately repeats (append-only OUTCOME/Review-by, multi REBUTTAL LOG), case-insensitive-match-then-exact-compare (lowercase CONFIDENCE crash / RESULT mis-scored), and $ under /m as end-of-string | markdown-contract linter checklist: normalize case before compare, take last-of/all repeated sections, anchor line regexes (no $ under /m), validate real calendar dates not just shape | lint,regex,parsing,markdown
2026-07-16 | arc-council-v3 | the cosmetic-variant attack class recurs — a markdown line/heading a human reads as meaningful but an exact-match regex misses, letting a doctored artifact DISPLAY legitimacy while dodging the gate (P0: 12 issues; P1 binding: 3 more incl. a ## Juror: heading bypass) | every new markdown-contract field gets tolerant DETECTION (bullet/emphasis/whitespace/heading-level enforced as one) + strict value GRAMMAR (near-misses fail closed), from the start | lint,regex,parsing,markdown,gate
2026-07-16 | arc-council-v3 | process.exit() races undici/socket teardown on Windows → libuv assertion + garbage exit code, on both happy and error paths of a fetch-based script | network-then-exit scripts set process.exitCode + park + an unref'd backstop timer (natural drain), never abrupt process.exit() while a socket may be closing | node,fetch,windows,exit-code
2026-07-22 | arc-orchestrator | meta-docs hardcoded counts and lists that a script already reports (commands 20 vs 22, agents 7 vs 23, hooks 6 vs 7, a 7-item gate list vs an 8-item TRIAL set) and rotted silently the moment the code moved — four docs described a pre-Phase-00 product for five days after it changed | in a doc, name the QUERY not the count (`/arc`, `--list`, the manifest); hardcode a number only where a gate fails on drift | docs,drift,counts,rot
2026-07-22 | arc-orchestrator | the golden fixture broke across 10 separate commits because any content edit to a product-shipped file moves its hash — at least twice it surfaced as a surprise mid-task failure instead of a planned step | when editing a file a product ships, treat fixture regen as a named step: diff the delta FIRST, confirm ONLY intended paths moved, then re-record and name the change in the commit | golden,fixture,sync,test-data

2026-07-22 | arc-orchestrator | L | rework 1/6 | amendments 10 | FIRED 1/8 | burn ~22% | sim-blockers-r1 not-recorded | t-to-phase0 0d
