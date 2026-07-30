# LexOS token reference — the system every variant composes against

Read out of `E:/Work_Hub/01_Automemory/Lexos/tailwind.config.ts` at base revision `4784ac9`,
verbatim. **Composers: use these values. Do not invent a hex, and do not read the LexOS repo** —
it carries the owner's uncommitted work and is out of bounds for this explore.

Put the ones your variant uses in your own `tokens.css` as custom properties, then reference only
those properties in your markup. A raw hex anywhere in variant code is refused by
`design-explore check`.

## Why these names and not a palette

Five semantic families, so a palette change is one edit rather than a grep across every route:

| family | means |
|---|---|
| `surface` | what a thing sits ON |
| `ink` | what a thing is WRITTEN in |
| `line` | what separates things |
| `danger` | the one tone that means "wrong" |
| `warning` / `success` | status tone, for the one badge that carries meaning in colour |
| `disabled` | the single dead surface that is still legible |

## Colour

| token | hex | note |
|---|---|---|
| `surface` | `#ffffff` | page + card |
| `surface-muted` | `#f9fafb` | a card that must recede |
| `surface-sunken` | `#f3f4f6` | hover, disabled input |
| `surface-strong` | `#e5e7eb` | pressed state, skeleton bar |
| `surface-inverse` | `#111827` | primary button, active pill |
| `ink` | `#111827` | body + headings |
| `ink-subtle` | `#374151` | link idle, inverse hover |
| `ink-muted` | `#4b5563` | secondary prose |
| `ink-deep` | `#030712` | inverse pressed |
| `ink-faint` | `#6b7280` | placeholder — **the dimmest ink still AA** |
| `ink-inverse` | `#ffffff` | text on an inverse surface |
| `line` | `#e5e7eb` | card, list divider |
| `line-strong` | `#d1d5db` | input border — owes 3:1 as a control, not 4.5:1 as text |
| `danger` | `#b91c1c` | destructive button, error text |
| `danger-strong` | `#991b1b` | hover, error-panel text |
| `danger-deep` | `#7f1d1d` | pressed |
| `danger-edge` | `#dc2626` | invalid field border + focus |
| `danger-line` | `#fca5a5` | error-panel border |
| `danger-surface` | `#fef2f2` | error-panel background |
| `warning-strong` | `#78350f` | text on the tint — 11.0:1 |
| `warning-line` | `#fde68a` | badge border |
| `warning-surface` | `#fffbeb` | badge fill |
| `success-strong` | `#166534` | 9.7:1 on its own surface |
| `success-line` | `#bbf7d0` | badge border |
| `success-surface` | `#f0fdf4` | badge fill |
| `disabled` | `#6b7280` | both `disabled:bg-` and `disabled:text-` |

**`disabled` under white is 4.83:1 and that is deliberate.** Tailwind's reflex `gray-400` is
2.16:1 and unreadable; this number was measured and earned in the Phase-2 review. Do not "improve"
it, and do not treat it as a defect to fix in a variant.

## Non-colour

| token | value | why it is a token |
|---|---|---|
| `max-w-shell` | `48rem` | one page width everywhere — it forked once already (`max-w-xl` vs `max-w-3xl`) |
| `borderRadius.DEFAULT` | `0.375rem` | one radius; a bare `rounded` cannot introduce a second |

## Stance the system already has — keep it unless your thesis is explicitly about changing it

- **No drop shadows anywhere in the feature.** Separation is done with `line` borders. Adding a
  shadow introduces a second visual language.
- **Empty states are left-aligned on a quiet fill**, never centred in a dashed box.
- **Motion is colour-only, 150ms, and carries `motion-reduce:transition-none`**, reached through
  recipes so a route cannot forget it.
- **The dimmest ink in the system is the dimmest that still passes AA.** There is no token below
  it, on purpose.
- **Status is never carried by colour alone** — the badge has a label as well as a tone.
