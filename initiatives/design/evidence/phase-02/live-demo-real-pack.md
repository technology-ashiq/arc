# Phase 02 live demo — the first real reference pack

Brief `lexos-case-workspace`. Built by the `design-curator` agent under the ADR-1420 boundary, three runs
on 2026-09-26/27. Text only: the images stay under `.claude/state/design/refpacks/lexos-case-workspace/`
(gitignored, `git check-ignore` confirmed), and the provenance is
[`docs/design/refpacks/lexos-case-workspace/sources.md`](../../../../docs/design/refpacks/lexos-case-workspace/sources.md).

## What each run met

| Run | Sources tried | Added | What stopped it |
|---|---|---|---|
| 1 | lapa-ninja, saasframe | 0 | Lapa Ninja's Cloudflare answers robots.txt 403 to ClaudeBot and Claude-User (a browser agent gets 301). SaaSFrame serves every screenshot from Webflow's shared CDN, whose robots.txt is 403 AccessDenied. **Assumption row FIRED**; owner replaced both (ADR-1412 amendment). |
| 2 | nicelydone, collectui | 0 | collectui's robots.txt is comments only and the parser read it as UNREADABLE (a parser bug, fixed: RFC 9309 empty file = allow). The curator could not see a screen before writing about it, so it wrote nothing (a design gap, fixed: `--stage`). |
| 3 | nicelydone, collectui | **6** | collectui is a client-rendered app: no screen URL is reachable by a plain fetch. nicelydone's public teaser images worked; 11 of its CDN objects were refused for sending `image/jpg` (fixed afterwards: the alias is accepted, the magic bytes still decide). |

The refusal exercise held every time: a Dribbble page (off-registry) and a lapa.ninja page (source off) were
refused by the hook before any request left.

## The pack, checked by eye (the session opened all six images)

| sha prefix | product seen | principle vs pixels |
|---|---|---|
| `b7fdffbc` | Linear, project overview | **Holds.** Status, priority and dates sit in a Properties panel beside the content. |
| `37d8ed56` | Linear, command palette | **Holds.** Every command shows its shortcut inline (`C`, `V`, `⌥C`, `N then U`). |
| `c338685c` | Found, transaction detail | **Holds.** The record opens as a slide-over panel over the list, with Note / Tag / Split under the amount. |
| `88211aba` | Whop, messages | **Holds.** A persistent list rail beside the record pane (the pane itself is the empty state). |
| `54da337f` | Dovetail, notifications | **Holds.** The list ends with "You're up to date". |
| `157f4188` | **Dock, Library** (the curator's report called it Found) | **Overstated.** The principle says selecting a row swaps the page's header buttons for the valid actions. In the image the header buttons (Tags / Manage / Add content) stay; only the table toolbar carries selection actions (Add tag / Archive). |

Five of six principles describe what the screen shows; one overstates it and its product was misnamed in the
curator's report (the row itself records no product name). That is the failure the owner's two-row reading
exists to catch, and it is on the record rather than smoothed over.

## Still open for Phase 02

- **REQ-04's "≥2 sources"** — met by one source only. collectui is active and permitted but yields no fetchable
  screen. A second source needs the owner: `saasui.design` passes the same probe (robots.txt plain text allowing
  both Claude tokens, 51 of 51 homepage images on its own host).
- **The owner reads the adaptable-principle column on at least two rows.**
