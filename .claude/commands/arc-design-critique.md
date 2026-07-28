---
description: Read-only vision critique of one route -- deterministic render, design-critic judges the pixels against the brief's four contracts, verdict + receipt derived by script. Never edits product code.
argument-hint: "<route> [--viewport WxH]"
allowed-tools: Task, Bash(bash .claude/scripts/design/design-critique.sh:*), Bash(bash .claude/scripts/design/design-gate.sh:*), Bash(bash .claude/scripts/core/review-ledger.sh:*), Bash(node .claude/scripts/hq/spine.mjs:*), Read, Glob, Grep
---

Critique: **$ARGUMENTS** (a repo-relative route, or a URL for a running surface).

This is the read-only half of the design loop. It reports; it never fixes. Fixing is the
creation side's job, and the critic then re-verifies (ADR-0034).

## 1. Arm the boundary and render

```bash
bash .claude/scripts/design/design-critique.sh begin <route>
```

This arms the critic's write boundary, renders the route deterministically (fixed viewport,
pinned font, animations off), and prints the render path, its hash, and the exact artifact
path the critic may write. **If it refuses — blank page, stale duplicate pixels, missing
agent-browser — STOP.** A critique of a page that did not render is confident nonsense.

## 2. Spawn the critic

Invoke the **`design-critic`** subagent explicitly (Task tool, `subagent_type:
"design-critic"`). Pass it: the route, the render PNG path, the render meta path, and the
brief path if the product has one (else `docs/templates/design-brief-template.md` for the
contract shape).

Do NOT fall back to `general-purpose` or to the old `design-reviewer` — `design-reviewer`
fixes its own findings, which is exactly the self-approval this loop replaced. If
`design-critic` is missing, STOP and say the template needs re-syncing.

The critic must read the PNG back with vision before judging. If it reports that it could not
read the image, the run has no result — say so rather than accepting a source-only review.

## 3. Derive the verdict

```bash
bash .claude/scripts/design/design-critique.sh finish <route>
```

The script counts declared `VIOLATION` findings, so **PASS ≡ zero violations**, emits the
`review.completed` receipt carrying `{"lens":"design","target":...,"result":...}`, stamps the
review ledger `design` on PASS only, and releases the write boundary. It also releases the
boundary on FAIL — otherwise the creation side could not fix what was just found.

## 4. Show the evidence

- the critique artifact path + the count per class (VIOLATION / WEAKNESS / POLISH)
- the receipt, read back through the reader (never by opening the JSONL):
  ```bash
  node .claude/scripts/hq/spine.mjs read --kind review.completed --limit 3
  ```
- the gate's current reading: `bash .claude/scripts/design/design-gate.sh` (warn-only this
  cycle — it flags a critiqued route with no receipt, it never blocks)

## On FAIL

Report the violations and STOP. Do not fix them in this command — hand them to the creation
side, which fixes and then re-runs this critique. Two rounds maximum; a third means the
disagreement is a human call, not another round (REQ-08).
