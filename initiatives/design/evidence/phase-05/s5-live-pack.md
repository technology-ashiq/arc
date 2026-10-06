# Phase 05 S5 -- the live pack (lexos-case-workspace), 2026-10-06

Text only: the images are cached under the gitignored `.claude/state/design/refpacks/lexos-case-workspace/`;
provenance rows are in [`docs/design/refpacks/lexos-case-workspace/sources.md`](../../../../docs/design/refpacks/lexos-case-workspace/sources.md).

## The live contract, as found

The first live `--query` answered **8 real results and counted 0**: the adapter called the legacy Magic tool
name, which the server translated and answered in prose. `tools/list` on the real endpoint showed the read-only
tool is `search(query, type, limit)` and that its answer is `structuredContent.results`. The adapter now speaks
that contract, and a test pins it. The same endpoint also serves edit, delete and upload tools
(`edit_component`, `delete_component`, `upload_profile_media`, ...), which is a second reason it is reached
only through refpack's search-only adapter and never through `.mcp.json`.

Live searches this run: `21st-dev answered 5 of 5` (twice) and `6 of 6`. The key travels only as `x-api-key`;
the provenance file was scanned for the env name, the key prefix and a key query parameter (0 hits).

## Robots

`cdn.21st.dev` returns 404 for robots.txt (permission, RFC 9309) for ClaudeBot and Claude-User; `21st.dev`
allows `/community/` for ClaudeBot. nicelydone refused `/search` (`Disallow: /search`), recorded by the hook.

## Added this run (design-curator; each staged, viewed, then added, exit 0) -- all five opened in-session

| source | screen | what it teaches the brief |
|---|---|---|
| 21st-dev | status bar | a strip of day cells makes a history one glance (colour-only: a variant must add a label) |
| 21st-dev | incident status timeline | state + start date in the header, dated entries, a closing "what is next" line |
| 21st-dev | process timeline | done vs pending marks on one line; the first hollow ring is what is owed next |
| nicelydone | Deck task run detail | one row of labelled facts under the title, read before any section |
| nicelydone | Deck task runs table | the status chip leads the row, so exceptions show in one scan |

## Availability summary (`design-refpack.mjs --summary`, verbatim)

```
availability nicelydone: ANSWERED 2/4 screen(s) added/asked
availability collectui: NOT-ASKED -- active, and this run never queried it
availability shadcn: NOT-ASKED -- active, and this run never queried it
availability 21st-dev: ANSWERED results 6 of 6
design-refpack summary: 2 of 4 active pack source(s) answered live since 2026-10-05T19:10:49Z
```

**REQ-07 met: 2 live sources answered in one run, each with its availability line.** collectui is active and
was not asked (client-rendered, no fetchable screen -- known since 2026-09-27); shadcn is active and has no
search adapter here, so it reads NOT-ASKED every run rather than being hidden. Both are named, never silent.

## shadcn, wired at the close (2026-10-06)

The real shadcn MCP (`shadcn@4.21.2`, server `shadcn 1.0.0`, local stdio, keyless) lists seven tools;
the adapter calls only `search_items_in_registries`. It answers in prose, parsed from its list lines.
Live: `--query card` answered **5 of 5** (card, card-demo, hover-card, skeleton-card, card-with-form);
`--query timeline` answered **0 of 5, SHORT** -- recorded, not hidden. The same live run exposed a
summary defect -- a later empty answer erased an earlier hit -- fixed so every answer in the window is
listed and any hit counts.
