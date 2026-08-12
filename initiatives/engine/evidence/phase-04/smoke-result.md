# Phase 04 — the live headless invocation (REQ-00)

Run on this machine, 2026-08-12, against the digest-pinned container image. Docker daemon
`29.6.1`, linux/WSL2 backend. Model endpoint: the local `ollama` already serving on the host,
reached from inside the container as `host.docker.internal:11434/v1`. **Zero spend, no credential.**

## The numbers, as observed

| | run 1 (cold) | run 2 (warm) |
|---|---|---|
| exit code | **0** | **0** |
| wall-clock | **176s** | **32s** |
| exited on its own | **yes** | **yes** |
| stdout lines | 80 | 8 |
| final line parses as JSON | yes | yes |

Answer, both runs: `{"ok": true, "runtime": "hermes"}` — which is what the pinned prompt at
`tests/fixtures/engine/hermes/smoke-prompt.txt` asked for.

**REQ-00 is met and the STOP does not fire.** `STOP evaluated: did not fire, because the runtime
installed as a digest-pinned image, ran headlessly, returned parseable output, and exited on its
own in both a cold and a warm run.`

That last property is not a formality. The rejected candidate (ADR-0208) was disqualified for
writing its answer and then hanging forever, and a process that must be force-killed can honour no
exit contract. This one exits. Confirmed twice.

## Divergence 1 — stdout is NEVER clean, and the shim must assume that

The vendor documents `-z` as *"single prompt in, final response text out, nothing else on stdout or
stderr."* That is true of the **agent** and false of the **container**. Every run — including the
warm one, so this is not a first-boot artifact — puts container boot output on the same stdout
before the answer:

```
Syncing bundled skills into ~/.hermes/skills/ ...
Done: 0 new, 0 updated, 71 unchanged. 71 total bundled.
[stage2] Found agent-browser Chromium binary: ...
[stage2] Setup complete; starting user services
[supervise-perms] chowned supervise/ trees for static s6-rc services
reconcile: profile=default prior_state=None action=registered
{"ok": true, "runtime": "hermes"}
```

Measured, not assumed: `JSON.parse` of the **whole** stdout fails with
`Unexpected token 'S', "Syncing bu"... is not valid JSON`; `JSON.parse` of the **last line**
succeeds. Raw capture in `smoke-stdout.txt`; the extracted answer in `smoke-run.json`.

**Consequence for Phase 05 (REQ-01).** A shim that does `JSON.parse(stdout)` fails on every run, not
occasionally. Last-line extraction is the *primary* path, not a fallback — and it is fragile in a
way the adversarial pass must attack directly: a draft whose own final line is JSON-shaped, an
answer containing a newline, boot output that grows a line, a warning arriving after the answer.
This is exactly the hostile-output surface REQ-01 already requires red fixtures for, and this run
says what the first fixture must be.

## Divergence 2 — 71 bundled skills install and activate themselves on first boot

The image syncs its own skill catalogue into the data volume without being asked: **71 skills across
13 categories** (`apple`, `autonomous-ai-agents`, `creative`, `email`, `github`, `media`, `mlops`,
`note-taking`, `productivity`, `research`, `smart-home`, `social-media`, `software-development`).
Named ones include `computer-use`, `claude-code`, `codex`, `github-repo-management`, `imessage`,
`apple-notes`, `google-workspace`, `notion`, `airtable`, `maps`, `polymarket`.

ADR-0209 says the pinned unit is *"the vetted skill/plugin list"*. The measured reality is that the
image ships 71 and turns them on, and none of them went through any vetting. That is the
ClawHavoc / ToxicSkills surface arriving by default rather than by an install decision.

Nothing here says they are malicious — they are the vendor bundle, not marketplace uploads. What it
says is that **"the vetted pinned list" is not the default state**, and Phase 06 inherits the job of
either pinning the bundle by hash or disabling it. Recorded now, on day 1, rather than discovered
when a certification fixture asks what the runtime can reach.

## What this run did NOT establish

- **Not a certification.** Twelve fixtures, real runtime, receipts attached — that is Phase 06 and
  none of it happened here.
- **Not a vetted admission.** The runtime is pinned by digest and verified out-of-band; the gate did
  not bless it (issue #167).
- **Context length was left at the ollama default.** The 64,000-token bump matters for real drafting
  in Phase 08, not for a two-line prompt, and restarting a running service to prove nothing would
  have been the wrong trade. Phase 08 owes it.
- **No egress restriction was applied.** The container ran with default networking. Fixture 7 is
  Phase 06.
