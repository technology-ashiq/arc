// kit.tsx -- the workroom's controls and marks, ported from the owner's v0.7 reference
// (docs/design/reference/face-hq/assets/arcface/src/ui/kit.jsx) onto Tailwind v4 and the token
// law (face v2 Phase 01, ADR-1318, ADR-1323).
//
// Ported as written, with three declared deltas and nothing else:
//   1. NO COLOUR SPELLED OUT. Every colour is a var() from docs/design/system/tokens.css; where
//      the reference names a colour in a utility or compares against one, this file reads a
//      token. face-colour-literal.mjs fails a literal anywhere in this folder, comments included.
//   2. COUNCIL IS --kind-council, which resolves to --accent-dim (ADR-1322). The reference renders
//      council violet, and violet is the non-real family's alone.
//   3. LIVE IS --mode-live, which resolves to the accent (tokens.css collision 3). The reference's
//      StatusDot renders live in green, and green is real money's alone.
//
// The landing-only pieces of the reference (Reveal, Chapter, Head, Stat) are not ported: the
// product has no landing page, and a component with no reader is a component nobody checks.
import type { CSSProperties, KeyboardEvent, MouseEvent, ReactNode } from 'react'

export const FONT = 'var(--font-display)' // display: arc's identity, for sentences and figures
export const UI = 'var(--font-ui)' // the workroom's reading face
export const MONO = 'var(--font-mono)' // what the machine wrote: ids, kinds, receipts
export const EASE = 'var(--ease-out-heavy)' // one motion voice

export const COLOR = {
  accent: 'var(--accent)',
  green: 'var(--green)',
  amber: 'var(--amber)',
  red: 'var(--red)',
  violet: 'var(--violet)',
  blue: 'var(--blue)',
  ink: 'var(--text-1)',
  dim: 'var(--text-2)',
  faint: 'var(--text-3)',
} as const

/** A tone names a meaning, never a colour. The reserved four keep theirs everywhere. */
export type Tone =
  | 'accent' | 'cyan' | 'live'
  | 'green' | 'good' | 'money'
  | 'amber' | 'warn'
  | 'red' | 'critical' | 'danger'
  | 'violet' | 'blue'

const TONE_VAR: Record<Tone, string> = {
  accent: '--accent', cyan: '--accent', live: '--mode-live',
  green: '--green', good: '--green', money: '--green',
  amber: '--amber', warn: '--amber',
  red: '--red', critical: '--red', danger: '--red',
  violet: '--violet', blue: '--blue',
}

// The -rgb triple each tone's tint is built from. `live` tints with the accent it resolves to.
const TONE_RGB: Record<Tone, string> = {
  accent: '--accent-rgb', cyan: '--accent-rgb', live: '--accent-rgb',
  green: '--green-rgb', good: '--green-rgb', money: '--green-rgb',
  amber: '--amber-rgb', warn: '--amber-rgb',
  red: '--red-rgb', critical: '--red-rgb', danger: '--red-rgb',
  violet: '--violet-rgb', blue: '--blue-rgb',
}

export const isTone = (t: unknown): t is Tone => typeof t === 'string' && Object.hasOwn(TONE_VAR, t)

/** The token a tone renders in. */
export function toneColor(tone: Tone): string {
  return `var(${TONE_VAR[tone]})`
}

/** A tone at an alpha, over whatever is behind it. The ink triple when the tone is unknown. */
export function tint(tone: Tone | undefined, alpha: number): string {
  const rgb = tone && isTone(tone) ? TONE_RGB[tone] : '--ink'
  return `rgba(var(${rgb}), ${alpha})`
}

// ─────────────────────────────────────────────────────────────────────────────
// Panel · PanelTitle -- a card and its mono title
// ─────────────────────────────────────────────────────────────────────────────
export function Panel({ children, className = '', pad = true, tone }: { children: ReactNode; className?: string; pad?: boolean; tone?: 'accent' | 'amber' | 'red' | 'violet' }) {
  const border = tone ? `color-mix(in srgb, ${toneColor(tone)} 30%, transparent)` : 'var(--line-2)'
  return (
    <div
      className={`relative rounded-2xl border ${pad ? 'p-6 sm:p-7' : ''} ${className}`}
      style={{ background: 'var(--bg-2)', borderColor: border, boxShadow: 'inset 0 1px 0 rgba(var(--ink), 0.04)' }}
    >
      {children}
    </div>
  )
}

export function PanelTitle({ children, tone = 'accent' }: { children: ReactNode; tone?: Tone }) {
  return (
    <div className="text-[11.5px] uppercase tracking-[0.22em] mb-4" style={{ color: toneColor(tone), fontFamily: MONO }}>
      {children}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Receipt -- the signature element: a small mono chip proving a claim
// ─────────────────────────────────────────────────────────────────────────────
export function Receipt({ children, tone = 'accent', title }: { children: ReactNode; tone?: Tone; title?: string }) {
  const c = toneColor(tone)
  return (
    <span
      title={title}
      className="inline-flex items-center gap-1.5 rounded-md border px-2 py-[3px] text-[11px] align-middle"
      style={{ fontFamily: MONO, color: c, borderColor: `color-mix(in srgb, ${c} 30%, transparent)`, background: 'var(--well)' }}
    >
      <span aria-hidden="true" style={{ opacity: 0.8 }}>&#8983;</span>
      {children}
    </span>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Kind -- an event-kind tag; one colour system for the whole product
// ─────────────────────────────────────────────────────────────────────────────
export type KindFamily = 'factory' | 'money' | 'decision' | 'council' | 'system'

export const KIND_FAMILY: Record<KindFamily, { color: string; label: string }> = {
  factory: { color: 'var(--kind-factory)', label: 'factory' },
  money: { color: 'var(--kind-money)', label: 'money' },
  decision: { color: 'var(--kind-decision)', label: 'needs-you / decision' },
  // Delta 2: council is a spine kind like any other, so it takes the product's colour.
  council: { color: 'var(--kind-council)', label: 'council' },
  system: { color: 'var(--kind-system)', label: 'system' },
}

export function Kind({ family = 'factory', children }: { family?: KindFamily; children: ReactNode }) {
  const f = KIND_FAMILY[family]
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px]" style={{ fontFamily: MONO, color: f.color }}>
      <span aria-hidden="true" className="w-[7px] h-[7px] rounded-full inline-block" style={{ background: f.color }} />
      {children}
    </span>
  )
}

/**
 * A state dot. Live is a data-mode statement and takes --mode-live (delta 3); building is amber,
 * in flight; sleeping is muted. No glow: the dot is a mark, not a lamp.
 */
export function StatusDot({ state = 'live', size = 7 }: { state?: 'live' | 'building' | 'sleeping' | 'idle'; size?: number }) {
  const c = state === 'live' ? 'var(--mode-live)' : state === 'building' ? COLOR.amber : state === 'sleeping' ? COLOR.faint : COLOR.accent
  return <span aria-hidden="true" className="inline-block rounded-full shrink-0" style={{ width: size, height: size, background: c }} />
}

export function HairlineDivider() {
  return <div aria-hidden="true" className="h-px w-full bg-gradient-to-r from-transparent via-(--accent)/22 to-transparent" />
}

// ─────────────────────────────────────────────────────────────────────────────
// Btn · IconBtn -- the shape rule: controls are 8px, cards 12px, chips pills.
// Inside a <form>, a Btn with an onClick is type="button" so a click never also submits;
// a Btn without one is the native submit, so Enter and click both fire exactly once.
// ─────────────────────────────────────────────────────────────────────────────
export type BtnTone = 'primary' | 'green' | 'danger' | 'amber' | 'ghost'

const BTN: Record<BtnTone, CSSProperties> = {
  primary: { background: 'var(--text-1)', color: 'var(--bg-0)', border: '1px solid transparent', fontWeight: 600 },
  green: { background: 'var(--green)', color: 'var(--on-fill)', border: '1px solid transparent', fontWeight: 600 },
  danger: { background: 'rgba(var(--red-rgb), 0.08)', color: 'var(--red)', border: '1px solid rgba(var(--red-rgb), 0.35)', fontWeight: 500 },
  amber: { background: 'rgba(var(--amber-rgb), 0.1)', color: 'var(--amber)', border: '1px solid rgba(var(--amber-rgb), 0.35)', fontWeight: 500 },
  ghost: { background: 'var(--bg-3)', color: 'var(--text-1)', border: '1px solid var(--line-2)', fontWeight: 500 },
}

export function Btn({
  children, onClick, tone = 'ghost', small = false, className = '', title, type, disabled,
}: {
  children: ReactNode
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void
  tone?: BtnTone
  small?: boolean
  className?: string
  title?: string
  type?: 'button' | 'submit'
  disabled?: boolean
}) {
  return (
    <button
      type={type ?? (onClick ? 'button' : 'submit')}
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer select-none transition-[background,border-color,color,transform,opacity] duration-200 hover:brightness-110 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent) ${small ? 'h-[30px] px-3 text-[12px]' : 'h-[36px] px-4 text-[13px]'} ${className}`}
      style={{ fontFamily: UI, borderRadius: 'var(--btn-radius)', letterSpacing: '-0.005em', transitionTimingFunction: EASE, ...BTN[tone] }}
    >
      {children}
    </button>
  )
}

export function IconBtn({ children, onClick, title, className = '', active = false }: { children: ReactNode; onClick?: () => void; title: string; className?: string; active?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className={`inline-flex items-center justify-center w-[32px] h-[32px] cursor-pointer transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-(--accent) ${className}`}
      style={{ borderRadius: 'var(--r-md)', color: active ? 'var(--text-1)' : 'var(--text-2)', background: active ? 'var(--bg-4)' : 'transparent', border: `1px solid ${active ? 'var(--line-2)' : 'transparent'}` }}
    >
      {children}
    </button>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Meter -- the fill carries the meaning; the track is a quiet step of the surface.
// Green is real money's alone, so neutral progress uses tone="blue".
// ─────────────────────────────────────────────────────────────────────────────
export function Meter({ value, tone = 'blue', height = 6, label }: { value: number | null | undefined; tone?: Tone; height?: number; label?: string }) {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : 0
  const w = Math.max(0, Math.min(100, Math.round(n * 100)))
  return (
    <div className="w-full rounded-full overflow-hidden" style={{ height, background: 'var(--track)' }} role="progressbar" aria-label={label} aria-valuenow={w} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${w}%`, background: toneColor(tone), transitionTimingFunction: EASE }} />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Badges -- the honest labels. A non-real class is violet AND hatched (hue alone is not
// enough); a thing the owner did is the accent.
// ─────────────────────────────────────────────────────────────────────────────
const badgeBase = 'inline-flex items-center gap-1.5 h-[22px] px-2 rounded-full text-[10.5px] uppercase tracking-[0.06em] whitespace-nowrap'

export function SimBadge({ children = 'simulated' }: { children?: ReactNode }) {
  return (
    <span className={badgeBase} style={{ fontFamily: UI, fontWeight: 600, color: 'var(--sim-fg)', border: '1px solid var(--sim-line)', background: 'var(--sim-hatch)' }}>
      {children}
    </span>
  )
}

export function YoursBadge({ children = 'yours · persisted' }: { children?: ReactNode }) {
  return (
    <span className={badgeBase} style={{ fontFamily: UI, fontWeight: 600, color: 'var(--accent)', border: '1px solid rgba(var(--accent-rgb), 0.35)', background: 'rgba(var(--accent-rgb), 0.08)' }}>
      {children}
    </span>
  )
}

/** A tinted chip: the tone carries the meaning, the text stays readable. No tone is neutral. */
export function Chip({ tone, children, mono = false, className = '', title }: { tone?: Tone; children: ReactNode; mono?: boolean; className?: string; title?: string }) {
  const toned = tone !== undefined && isTone(tone)
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1.5 h-[22px] px-2 rounded-full text-[11px] whitespace-nowrap ${className}`}
      style={{
        fontFamily: mono ? MONO : UI,
        fontWeight: 500,
        color: toned ? toneColor(tone) : 'var(--text-2)',
        background: toned ? tint(tone, 0.1) : 'var(--bg-4)',
        border: `1px solid ${toned ? tint(tone, 0.28) : 'var(--line-1)'}`,
      }}
    >
      {children}
    </span>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Form primitives -- one input style for every write path
// ─────────────────────────────────────────────────────────────────────────────
export function Field({ label, children, className = '', hint }: { label: ReactNode; children: ReactNode; className?: string; hint?: ReactNode }) {
  // A <label> wrapping a PickRow (buttons, no input) would forward a click on the caption to the
  // first button; that is refused. A real input keeps the native label-click focus.
  const onClick = (e: MouseEvent<HTMLLabelElement>) => {
    const target = e.target instanceof Element ? e.target : null
    if (!e.currentTarget.querySelector('input,select,textarea') && !(target && target.closest('button'))) e.preventDefault()
  }
  return (
    <label className={`block min-w-0 ${className}`} onClick={onClick}>
      <span className="flex items-baseline justify-between gap-2 mb-1.5">
        <span className="text-[12px]" style={{ fontFamily: UI, fontWeight: 500, color: 'var(--text-2)' }}>{label}</span>
        {hint ? <span className="text-[11px] truncate" style={{ fontFamily: UI, color: 'var(--text-3)' }}>{hint}</span> : null}
      </span>
      {children}
    </label>
  )
}

export const INPUT_CLASS = 'w-full h-[36px] px-3 text-[13px] outline-none border transition-[border-color,box-shadow] duration-200 focus:border-(--accent)'
export const INPUT_STYLE: CSSProperties = { fontFamily: UI, background: 'var(--input-bg)', borderColor: 'var(--line-2)', borderRadius: 'var(--r-md)', color: 'var(--text-1)' }

export function TextInput({ value, onChange, placeholder, autoFocus, onKeyDown, mono = false }: { value: string; onChange: (v: string) => void; placeholder?: string; autoFocus?: boolean; onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void; mono?: boolean }) {
  return (
    <input
      autoFocus={autoFocus}
      value={value}
      onKeyDown={onKeyDown}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`${INPUT_CLASS} placeholder:text-(--text-3)`}
      style={{ ...INPUT_STYLE, fontFamily: mono ? MONO : UI }}
    />
  )
}

export type PickOption<V extends string> = V | { value: V; label: ReactNode }

/** A segmented pick: one active, the rest quiet. */
export function PickRow<V extends string>({ options, value, onPick, small = false, label }: { options: PickOption<V>[]; value: V; onPick: (v: V) => void; small?: boolean; label?: string }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label={label}>
      {options.map((o) => {
        const v = typeof o === 'string' ? o : o.value
        const text = typeof o === 'string' ? o : o.label
        const active = value === v
        return (
          <button
            key={v}
            type="button"
            aria-pressed={active}
            onClick={() => onPick(v)}
            className={`${small ? 'h-[26px] px-2.5 text-[11.5px]' : 'h-[30px] px-3 text-[12px]'} cursor-pointer whitespace-nowrap transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-(--accent)`}
            style={{
              fontFamily: UI,
              fontWeight: 500,
              borderRadius: 'var(--r-sm)',
              background: active ? 'var(--bg-4)' : 'transparent',
              color: active ? 'var(--text-1)' : 'var(--text-2)',
              border: `1px solid ${active ? 'var(--line-2)' : 'var(--line-1)'}`,
            }}
          >
            {text}
          </button>
        )
      })}
    </div>
  )
}
