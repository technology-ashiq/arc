# v0.7 — the workroom redesign (2026-09-15)

The HQ was rated 40/100 and asked to reach 90. Nothing functional changed: every event, store call, button wording, placeholder and room sentence is the same, and the 36-room smoke suite + 20 write-path flows pass with 0 console errors in both moods. What changed is the whole visual system.

## What was wrong

- One neon accent on near-black, glows on dots, meters and buttons, gradient washes behind headings.
- Uppercase, letter-spaced JetBrains Mono for almost every label, hint and button — a terminal cosplay, not a product.
- Double-bezel cards (a hairline shell around a solid core) with inset highlights; cards inside cards inside cards.
- A 188px rail with 7.5px ring labels; four same-weight pills in the header.
- Light mode was a CSS `filter: invert()` over the dark theme, so every colour went muddy.
- Rooms hard-coded 400+ colour literals, so nothing could be retuned centrally.

## What is there now

**Tokens** (`src/index.css`). `:root` keeps the landing's neon values, untouched. `html.hq` is the dark workroom: a neutral-cool scale (#0b0d10 canvas, #14171b cards), one accent (#2dd4bf), and Primer-grade semantic colours (green #3fb950 for real money, amber #e3b341 needs-you, red #f85149 kill, violet #a78bfa council/simulated, blue #58a6ff neutral progress). `html.hq.hq-light` is paper: #f4f5f7 canvas, white cards, ink text, a #0f766e accent that clears 5.4:1. Every semantic colour passes WCAG AA on its card in both moods. Light mode remaps Tailwind's `white` to ink, so `text-white/70`-style utilities flip on their own.

**Type.** Inter for the workroom UI (13px default, 14px/600 panel titles), Anybody only for the room sentence and the instrument figures, JetBrains Mono only for data (ids, receipts, timestamps, kinds, model ids, paths). Sentence case everywhere; letter-spaced caps survive only as `SectionLabel` and badges.

**Shape.** Controls 8px, cards 12px, chips pills. Buttons are no longer pills. One flat hairline per card, no glow, no bezel, no inset highlight. Primary button = ink fill; green is spent only on money/pass; danger only on kill/reject.

**Kit** (`src/ui/kit.jsx`, `src/hq/bits.jsx`). New: `KpiStrip` (the instrument strip every room now shares), `SectionLabel`, `Empty`, `Chip`, `IconBtn`, `INPUT_CLASS`/`INPUT_STYLE`, `TONE`, `tint()`. `HPanel` gained `actions`; `Field` gained `hint`; `Meter` lost its glow; `PickRow` is a segmented control. `COLOR.*` now resolve to tokens.

**Shell** (`src/hq/HQ.jsx`). 240px rail (wordmark, a search trigger that opens ⌘K, ring groups, 32px items, keyboard hints). 56px header: room name + ring, clock + day, one segmented play/1×/10×/60× control, then data-mode chip, inbox chip (amber-filled only when something waits), brain chip, theme toggle. The voice dock sits inside the content column. Main column max 1440 with 32px gutters, no horizontal scroll at 1280/1440/400.

**Rooms.** All 35 rooms restyled against `docs/superpowers/specs/2026-09-15-hq-design-system.md`: hand-built strips → `KpiStrip`, chip rows → `PickRow`, list rows with a single hairline, item cards on `--well`, empty states that say how to fill them, refusals as inline red text. The money chart now measures its container (axis text is a true 11px). Org, Money and Trader no longer overflow horizontally.

## Verify

```
npx vite build && npx vite preview --port 4173
BASE=http://localhost:4173/ node scripts/smoke.mjs     # 36 rooms + 20 flows, both persisted
node scripts/shots.mjs                                  # dark + light screenshots into .shots/
ROOMS=landing node scripts/shots.mjs                    # the front door, untouched
SIZES=phone ROOMS=overview node scripts/shots.mjs       # 400px
OPEN=palette node scripts/shots.mjs                     # ⌘K open
```

`vite preview` binds `localhost`, not `127.0.0.1`. The review·ship flow seeds a QA verdict from the commit hash, so one run in five refuses the ship on purpose; the flow reports it, it is not a regression.
