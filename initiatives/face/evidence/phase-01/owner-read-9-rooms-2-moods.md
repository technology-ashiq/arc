# Phase 01 — the owner's by-eye read of the 9 bespoke rooms × 2 moods

**When:** 2026-09-17, after PR #235 merged as `4fcb53db` and the main clone was fast-forwarded to it.

## What was put in front of the owner

- The live HQ from the MAIN clone: `node .claude/scripts/hq/arc-face.mjs --no-open` (door on the
  canonical spine + Vite dev server, after `npm ci` from the tracked lockfile). The owner could
  open it and toggle the mood from the rail.
- 18 viewport screenshots at 1440×1000, one per room per mood, taken over that live HQ with the
  mood set in the app's own storage key (`arc-hq-theme`) and confirmed on `<html>` (`hq` in dark,
  `hq hq-light` in light): Today, Inbox, Map, Spine, Board, Money, Council chamber, Ventures,
  Ask arc. They live in the git-ignored `.playwright-mcp/phase-01-rooms/` (the live spine is on
  them, so they are not committed).
- Console over all 18 navigations: **0 errors**; the only warnings are the `THREE.Clock`
  deprecation line v0.7's own smoke excludes.
- The session opened four of the shots before asking (dark Today; light Today, Money, Council,
  Map): the workroom scales render in both moods; in light, Money's simulated panel is violet on
  its hatch and nothing on the screen is green; council renders in the accent family.

## The owner's answers, verbatim (2026-09-17)

1. **"9 rooms × 2 moods … idhu render aagudhaa?"** → **"Render aagudhu — close pannu"**
   (it renders — close it). PLAN kill criteria's Block A clause at Phase 01's exit: no STOP.
2. **The AA adjustments to v0.7's colours** (spec-fidelity drift (b)) → **"AA-adjusted values
   vechukko"** (keep the AA-adjusted values). The contrast law (REQ-02) wins over the spec's
   rabbit-hole note; each moved value stays listed with its reason in the tokens.css header.
3. **The face stage in the dark mood only** (spec-fidelity scope finding) → **"Dark-la mattum,
   Phase 02 decide"** (dark only; Phase 02 decides). The debt row stands, with Phase 02's shell
   port as its pay-down.
