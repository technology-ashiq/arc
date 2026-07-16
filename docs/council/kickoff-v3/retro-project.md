# arc-council v3 — project retro (final, both phases)

> Scoped/self-contained (council-files-only + the owner-sanctioned `.env.example` line). **On merge to
> main, port the scoreboard row + retro-log lines below into root `docs/retro-log.md`** — mirroring the
> v1/v2 convention. Stacked on `feat/council-v2` (PR #25) — merge #25 first.

## Scoreboard (counted from PROGRESS done-log + PLAN ledgers, not estimated)
```
2026-07-16 | arc-council-v3 | S | rework 0/2 | amendments 1 | FIRED 1/5 | burn 90% | attack-findings 7 | t-to-phase0 0
```
- **rework 0/2** — 0 phases reopened; 2 closed (0–1).
- **amendments 1** — one post-STOP scope change: the SHA-256 verdict↔artifact binding (REQ-05) was pulled
  IN when the kickoff attack panel fired ADR-0018's revisit trigger (a hand-typed `## JUROR RATINGS`
  defeats the design); plus the owner-sanctioned `.env.example` exception. Both recorded in the plan.
- **FIRED 1/5** — pre-mortem **row 1 materialized** (every fresh gate had holes an adversarial pass finds):
  the P0 pass found 12, the **P1 binding pass found 3** (1 med: a `## Juror:` heading / `+`/`1.`/`>` list
  variant skipped the whole binding — the cosmetic-variant class again; 2 low: CRLF false-fail, reason-prose
  unbound) — **all fixed + pinned before v3 merged.** Rows 2–5 did not fire as failures — though provider
  outages (429s) DID occur live and were handled by the taxonomy exactly as row 5 designed.
- **burn 90%** — 2.7 of 3 appetite-days; 0.3d slack unspent; no scope cut.
- **attack-findings 7** — the merged kickoff attack panel raised 7, all applied before the STOP.
- **t-to-phase0 0** — Phase 0 closed the same day as kickoff.

## Project-level findings
| # | Pattern | Prevention | Recurring? |
|---|---|---|---|
| F1 | **The "cosmetic-variant" attack class is now a KNOWN recurring shape** — a markdown line/heading a human reads as meaningful (`**Juror:**`, `- Juror:`, `## JUROR  RATINGS`, a bulleted SHA line) but an exact-match regex misses, so a doctored artifact DISPLAYS legitimacy while dodging the gate. Found in P0 (12 issues) and pre-empted in P1. | For every new markdown-contract field: **tolerant DETECTION** (bullet/emphasis/whitespace/heading-level variants enforced as one) + **strict value GRAMMAR** (near-misses fail closed). Add it to the lint from the start, not after the adversarial pass names it. | **yes** (v2-F2's parser class, now sharpened) |
| F2 | **`process.exit()` races socket/undici teardown on Windows** → a libuv assertion + garbage exit code, on BOTH the happy path (real HTTPS) and error paths. A gate must never emit a non-clean code. | For any script that does network I/O and then exits: set `process.exitCode` + park + an unref'd backstop timer (natural drain), never an abrupt `process.exit()` while a socket may be closing. | one-off (but reusable for any fetch-based arc script) |
| F3 | **Free-tier provider model ids drift / are upstream-throttled** — `gemini-2.0-flash` 429'd, OpenRouter llama/qwen `:free` routes were Venice-throttled; the run needed a live `/models` discovery + slug swap. | A juror runbook step: on `[http] 404` or persistent `[rate-limit]`, hit `GET {base}/models` to confirm the exact slug and pick a non-throttled free route; the failure taxonomy already names which case you're in. | n/a (operational note) |

## Retro-log lines to port to root `docs/retro-log.md` on merge
```
2026-07-16 | arc-council-v3 | the cosmetic-variant attack class recurs — a markdown line/heading a human reads as meaningful but an exact-match regex misses, letting a doctored artifact DISPLAY legitimacy while dodging the gate (P0: 12 issues; pre-empted in P1) | every new markdown-contract field gets tolerant DETECTION (bullet/emphasis/whitespace/heading-level enforced as one) + strict value GRAMMAR (near-misses fail closed), from the start | lint,regex,parsing,markdown,gate
2026-07-16 | arc-council-v3 | process.exit() races undici/socket teardown on Windows → libuv assertion + garbage exit code, on both happy and error paths of a fetch-based script | network-then-exit scripts set process.exitCode + park + an unref'd backstop timer (natural drain), never abrupt process.exit() while a socket may be closing | node,fetch,windows,exit-code
```

## What went right (worth keeping)
- **The kickoff attack panel earned its whole keep at STOP** — it fired ADR-0018's revisit trigger before
  a line of code, turning "the juror is fabrication-proof" from an aspiration into the SHA-256 binding
  that actually delivers it. Attacking the PLAN, not just the code, changed the design.
- **Offline-first paid off precisely as designed** — the fake impl + local mock server proved the entire
  fetch/retry/binding surface with ZERO keys; the only key-dependent work was the final live confirmation.
- **The cross-model juror closed ADR-0014's residual in PRACTICE** — a real different-family model
  (Gemini) independently re-graded the anchor set and the verdict is byte-bound to its output; a doctored
  display is caught live. The v2 "honest residual" is now a shipped mechanism.

## Steps not applicable
- **Simulation gate / second opinion:** S-tier — not run (correctly, per kickoff tier rules).
- **Trial-gate promotion:** single build, no new bats fixtures — nothing promotable.
