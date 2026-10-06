# Phase 06 S2+S3 -- the Stitch spike receipt (quarantined; nothing but this receipt is committed)

The spike ran from the session scratchpad, never from the repo. No draft, screenshot or spike code
is committed (non-negotiable). The key was read through `lib/keys.mjs resolveKey` (face store) and
never printed or logged.

## Ordering (S4)

| event | time (UTC) |
|---|---|
| terms clearance `decision.recorded` for `01M46ZJ3K02JXSD7HHDXNHNJF1` | 2026-10-06, before the spike (S1) |
| first outbound Stitch request (`createProject`) | 2026-10-06T06:01:40.648Z |
| no adapter file exists in this phase | checked by `git log` at the phase close |

## Provider contract, as observed

- SDK: `@google/stitch-sdk@0.3.5` (`npm view` on 2026-10-06), MCP over `https://stitch.googleapis.com/mcp`
- Request: `createProject({title})`, then `project.generate(prompt, "DESKTOP")`; the prompt was the
  LexOS case-workspace brief's interaction model in one paragraph
- Timings: createProject 3.7 s · **generate 95.1 s** · HTML download 0.8 s
- Output schema (screen): `{ designSystem{...}, deviceType, generatedBy, height, htmlCode{downloadUrl, mimeType, name}, id, name, projectId, prompt, screenMetadata{agentType, status}, screenType, screenshot{downloadUrl, name}, theme{...} }`
- HTML: `text/html`, 45,669 bytes, sha256 `8853e4b7490718a3...`, served from `contribution.usercontent.google.com`; screenshot from `lh3.googleusercontent.com`
- Failure shape (bad key, observed): `StitchError`, code `UNKNOWN_ERROR`, after 3.6 s; the body is an
  MCP result with `isError: true` and the text "API key not valid". A wrong key is NOT a 401 at the
  SDK surface -- an adapter must read `isError`. Rate-limit and quota shapes were not reached on the
  free tier in one run and are not claimed.

## Self-containment (S3) -- FAILED

The HTML loads `https://cdn.tailwindcss.com?plugins=forms,container-queries` (the whole stylesheet
is generated at runtime by that script), four `fonts.googleapis.com` links and `fonts.gstatic.com`.

| render (1440x900, fresh browser session) | screenshot sha256 | probe |
|---|---|---|
| network open | `5b8fcd5f85cf6042` | `window.tailwind` = object, body font `ui-sans-serif ...`, 5 stylesheets |
| every `https://**` aborted | `22e4061f10e1668f` | `window.tailwind` = undefined, body font `Times New Roman`, 4 stylesheets |

**The first offline attempt was a false pass and is recorded as one:** `agent-browser set offline on`
in the same session reused the browser cache and hashed identical to the open render. The negative
control -- a fresh session with an aborting route and a probe that reads `window.tailwind` -- is
what showed the dependency. Both renders were opened in-session: open is a styled, competent case
page; blocked is unstyled text with Material icon names printed as words.

**Verdict: Stitch's output is CDN-dependent.** Per this phase's exit criterion it does not proceed
to Phase 07 on a special-case render path. PLAN assumption "Stitch's exported HTML is
self-contained enough to render deterministically offline" -- **FIRED 2026-10-06**.
