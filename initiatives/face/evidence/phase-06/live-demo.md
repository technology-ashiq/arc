# Phase 06 slice 03 — the live convene (2026-09-25)

The session door in **live** mode from the main clone (`E:/Work_Hub/01_Automemory/arc`), on a `feat/*` demo branch (the
door refuses `main`, ADR-1326), over the canonical spine. Driver: a scratch script that boots `arc-dash.mjs`, asks
`POST /api/session-click` for a click token, spends it on `POST /api/session/council.convene/start`, relays
`/api/session-run/<sid>` every 5 s, and reads each credited receipt back off the spine files by id.

## The passing run — attempt 4 (session `0mugwlg2lGjgEGgY`, 28 min, opus Chair)

Question: "Should arc's attack pass redact credential-shaped text inside an attacker's findings, instead of refusing
the attacker's whole report?"

```
START 200  argv: node .claude/scripts/engine/arc-run.mjs --process council-convene --driver auto ...
  | claude-code: step Read .claude/commands/arc-council.md
  | claude-code: step Bash node .claude/scripts/council/council-lint.mjs      (--claim: 006-...)
  | claude-code: step Agent council-researcher        (x4, then advocate, skeptic, neutral, experts, verifier)
  | claude-code: step Edit docs/council/sessions/006-attack-redact-credential-shaped-findings.md
  | claude-code: step Bash bash .claude/scripts/hq/arc-event.sh              (emit council.verdict --process ...)
  | arc-run: receipt council.verdict 01M3C89E89QA9XZQW56VA804ZJ
  | arc-run: receipt run.completed 01M3C8A25Y1X3GKQJ7SDCM3DXT
END state=done exit=0
SPINE council.verdict 01M3C89E89QA9XZQW56VA804ZJ: found in 2026-09-25.jsonl
      {"call":"hold","confidence":"Medium","question_hash":"ad57d9fc…","session_id":"c-006-attack-redact-credential-shaped-findings"}
SPINE run.completed  01M3C8A25Y1X3GKQJ7SDCM3DXT: outcome ok, model opus (router), 19,184 tokens out
```

Against the spec's check ("one convene clicked in the `council` module, its phases streamed, the `council.verdict`
receipt read back off the spine by ULID"):

- **Clicked:** started only by a spent click token, through `arc-run --driver` (the door's argv, above).
- **Streamed:** each `claude-code: step …` line reached the session log as the step happened (slice 03c's tee), 28
  minutes of them, not one block at the end.
- **Receipt:** the Chair emitted `council.verdict` tagged `--process council-convene@1.0.0`; arc-run read the returned
  `receipt_id` back off the spine and said the credited line; the door credited it (`attributedBy: named-line`) and the
  driver found it in the spine's own file by id. The verdict is `docs/council/sessions/006-…` (DECISION NO, CONFIDENCE
  Medium).

## The three attempts before it — each found a real defect, each fixed before the next

| Attempt | Got as far as | Defect | Fix |
|---|---|---|---|
| 1 | research, streamed 19 min | the Chair backgrounded its agents and called ScheduleWakeup; a `-p` turn ends there | body: one turn, every agent in the foreground, tools named (`5b15d7d6`) |
| 2 | the whole council; verdict passed `--verdict` | `--payload` refused it: no `# arc-council — <question> (<date>)` first line, and step 8 never said to write one | `arc-council.md` step 8 names the line; `runs:` pin re-pinned (`0ab6635a`). Its unreceipted verdict is kept as `live-demo-attempt2-verdict.md`, never hand-patched into a receipt |
| 3 | emitted `council.verdict` `01M3C5ZCA2MJVR736SMMW3RTF1` (tagged, on the spine); session `005-…` | the reply began with the receipt line body rule 6 asked for, so it was not JSON and the run failed before arc-run could vouch | rule 6 removed; the reply is the JSON alone (`4f347089`) |

Attempt 3's verdict and receipt are real and stay (`005-…`); the run itself is recorded `outcome fail` on the spine,
which is true.
