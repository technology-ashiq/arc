# arc HQ design system (v0.7) — the workroom

Status: implemented in the shared layer (tokens, kit, bits, shell, Overview); rooms are polished against this document.

## Design read

A redesign-overhaul of a dense operator dashboard: 36 rooms in 5 rings, a single technical owner, real write paths. The bar is Linear / Vercel / Cloudflare-dashboard grade: calm, precise, neutral-dominant, one accent. Dials: variance 3, motion 3, density 7.

The landing (the face) is untouched and keeps its dark neon voice. The HQ has its own token set on `html.hq` (dark) and `html.hq.hq-light` (light). Nothing in the workroom hard-codes a hue.

## Tokens (src/index.css)

| Token | Dark | Light | Use |
|---|---|---|---|
| `--bg-0` | #0b0d10 | #f4f5f7 | canvas |
| `--bg-1` | #0f1114 | #ffffff | rail, header, input wells |
| `--bg-2` | #14171b | #ffffff | card |
| `--bg-3` | #191d22 | #f6f7f9 | nested item, hover |
| `--bg-4` | #20252b | #eceef2 | active control, kbd |
| `--well` | = bg-3 | = bg-3 | an item card inside a panel |
| `--line-1` / `--line-2` | white 7.5% / 13% | ink 8% / 14% | hairline / control border |
| `--text-1` / `--text-2` / `--text-3` | #e8eaed / #a3a9b3 / #7a8290 | #14161a / #5c6470 / #7b8491 | primary / secondary / muted |
| `--accent` | #2dd4bf | #0f766e | brand, live, links, focus, active icon |
| `--green` | #3fb950 | #1a7f37 | real money, pass |
| `--amber` | #e3b341 | #9a6700 | needs-you, trial, blocked |
| `--red` | #f85149 | #cf222e | kill, refused, over the line |
| `--violet` | #a78bfa | #6e40c9 | council, simulated |
| `--blue` | #58a6ff | #0969da | neutral progress (meters that are not money) |

`--ink` is an rgb triple: `rgba(var(--ink), 0.06)` is a tint of the text colour. Every colour also has `--x-rgb` for `rgba(var(--amber-rgb), 0.12)` tints. In light mode Tailwind's `white` is remapped to ink, so `text-white/70`, `bg-white/[0.03]`, `border-white/10` flip automatically.

Radii: `--r-sm` 6 (chips, kbd, small picks) · `--r-md` 8 (buttons, inputs, list rows) · `--r-lg` 12 (cards) · `--r-xl` 16 (dialogs). Badges are pills.

## Type

- `UI` (Inter) for every label, control, body line. 13px default, 12px meta, 11px captions, 14px panel titles (600), 13.5px body in cards.
- `FONT` (Anybody) only for the room sentence (h1, 26px/600) and instrument figures (24px/600).
- `MONO` (JetBrains Mono) only for data: ids, receipts, timestamps, event kinds, capability names, model ids, code. Never for labels, buttons or hints.
- No letter-spaced uppercase except: `SectionLabel` (11px/600, 0.08em) for a sub-section inside a panel, badges (SimBadge / YoursBadge / Chip), and column headers of a table. At most one SectionLabel style per panel.
- Sentence case for buttons and labels. Proportional figures for big numbers, `tnum` in columns.

## Components (src/ui/kit.jsx, src/hq/bits.jsx)

- `RoomHead {title, hint, right}` — sentence + lede + right slot; a hairline underneath. Every room starts with it.
- `KpiStrip {items:[{v,l,sub?,tone?}]}` — the instrument strip. Use it for any row of figures; never hand-build one.
- `HPanel {title, hint, actions, tone, pad}` — the card. `actions` puts buttons in the title row. `tone="amber"` only when the panel needs the owner.
- `SectionLabel` — small uppercase label for a sub-section inside a panel.
- `Empty {icon, title, hint, action}` — every list with a possible zero state uses it.
- `EventRow`, `ApprovalCard`, `ReceiptDrawer` — the tape and the inbox card.
- `Btn {tone: primary|green|danger|amber|ghost, small}` — 36px / 30px, radius 8. One `primary` per panel at most. `green` only for a money / pass action. `danger` for kill / reject.
- `IconBtn` — 32px icon-only control.
- `Field {label, hint}`, `TextInput {mono?}`, `INPUT_CLASS` + `INPUT_STYLE` for a `<select>` / `<textarea>` styled like the input.
- `PickRow {options, value, onPick, small}` — segmented picks (sort, filter, tier). Replaces hand-rolled chip rows.
- `Meter {value, tone: good|warn|critical|blue}` — 6px, no glow. `good` (green) only for real money.
- `Chip {tone, mono}` — a tinted chip for status text. `SimBadge`, `YoursBadge` for the honest labels.
- `StatusDot {state: live|building|sleeping|awake, size}` — semantic only, never decorative.
- `COLOR.cyan|green|amber|red|violet|blue|ink|dim|faint` resolve to tokens.

## Rules

1. Cards: one hairline, flat `--bg-2`, radius 12, padding 20. No double bezels, no inset highlights, no gradient washes, no glow shadows anywhere.
2. Items inside a card sit on `--well` with a `--line-1` border, radius 8, padding 12-14. Rows in a list divide with a single bottom hairline.
3. One accent. Amber, green, red, violet keep their meanings; a decorative dot is not allowed, a semantic one is.
4. Figures lead: a row of numbers is a `KpiStrip` above the panels, not a bezel with mono caps.
5. Hints are sentence case, in `--text-3`, and short. Middle-dots and long dashes are rationed to one per line.
6. Every write path: label above input, the primary action to the right, an inline refusal in red text under the form (never an alert).
7. Tables: header row `SectionLabel`-style, rows 13px UI, numbers mono `tnum` right-aligned, hover `--bg-3`.
8. Empty states say how to fill them.
9. Both moods must read: never a literal white, black, or hex in a room; `var(--…)` only.
10. Behaviour, strings and ids are frozen: button text, placeholders, `data-*`, the h1 sentence and the events emitted stay exactly as they are (scripts/flows.mjs asserts on them).

## Shell

Rail 240px (`--bg-1`), a search trigger that opens ⌘K, ring groups with 10.5px labels, 32px items (active `--bg-4` + accent icon). Header 56px: room name + ring, clock + day, one segmented speed control; right: data-mode chip, inbox chip (amber-filled when something waits), brain chip, theme toggle. Main column max 1440, 32px gutters, 160px bottom room for the voice dock, which sits in the content column.

## Verification

`npx vite build && npx vite preview --port 4173`, then `BASE=http://localhost:4173/ node scripts/smoke.mjs` (all rooms + flows, 0 errors) and `node scripts/shots.mjs` (dark + light screenshots into `.shots/`).
