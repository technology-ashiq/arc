// ──────────────────────────────────────────────────────────────────────
// arc face — design-system kit.
// One vocabulary of surfaces for the whole experience:
//   Chapter  — full-width scroll section with consistent rhythm (landing)
//   Head     — eyebrow + display line + lede (landing chapters)
//   Panel    — raised card over the face (landing)
//   Receipt  — the signature: a small mono chip proving a claim (⌗ source)
//   Kind     — colored event-kind tag; colors carry ONE meaning everywhere
//   Btn / Field / TextInput / PickRow / Meter / badges — the workroom controls
// Every color is a token (src/index.css). The landing reads the legacy neon
// values on :root; the HQ reads html.hq (dark) or html.hq.hq-light (light).
// Color code (legend rendered in chapter 04):
//   accent = spine/live · green = money/pass · amber = needs-you/trial
//   red = kill/blocked · violet = council/verdict · blue = neutral progress
// ──────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from 'react'
import { stage } from '../lib/stage.js'

export const FONT = "'Anybody', sans-serif" // display — arc's identity
export const BODY = "'Plus Jakarta Sans', sans-serif" // reading text (landing)
export const UI = "'Inter', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif" // workroom UI
export const MONO = "'JetBrains Mono', ui-monospace, monospace" // data, receipts, ids
export const EASE = 'cubic-bezier(0.32, 0.72, 0, 1)' // one motion voice

export const COLOR = {
  cyan: 'var(--accent)',
  green: 'var(--green)',
  amber: 'var(--amber)',
  red: 'var(--red)',
  violet: 'var(--violet)',
  blue: 'var(--blue)',
  ink: 'var(--text-1)',
  dim: 'var(--text-2)',
  faint: 'var(--text-3)',
}

// tone → token, one lookup for the whole kit
export const TONE = {
  cyan: 'var(--accent)', accent: 'var(--accent)', live: 'var(--accent)',
  green: 'var(--green)', good: 'var(--green)', money: 'var(--green)',
  amber: 'var(--amber)', warn: 'var(--amber)',
  red: 'var(--red)', critical: 'var(--red)', danger: 'var(--red)',
  violet: 'var(--violet)', blue: 'var(--blue)',
}
export const TONE_RGB = {
  cyan: 'var(--accent-rgb)', accent: 'var(--accent-rgb)', live: 'var(--accent-rgb)',
  green: 'var(--green-rgb)', good: 'var(--green-rgb)', money: 'var(--green-rgb)',
  amber: 'var(--amber-rgb)', warn: 'var(--amber-rgb)',
  red: 'var(--red-rgb)', critical: 'var(--red-rgb)', danger: 'var(--red-rgb)',
  violet: 'var(--violet-rgb)', blue: 'var(--blue-rgb)',
}
export const tint = (tone, a) => `rgba(${TONE_RGB[tone] || 'var(--ink)'}, ${a})`

// scroll entrance — respectful of prefers-reduced-motion
export function Reveal({ children, delay = 0, className = '' }) {
  const ref = useRef(null)
  const [on, setOn] = useState(stage.reducedMotion)
  useEffect(() => {
    if (stage.reducedMotion) return
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            setOn(true)
            io.disconnect()
          }
        })
      },
      { rootMargin: '0px 0px -8% 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: on ? 1 : 0,
        transform: on ? 'none' : 'translateY(22px)',
        transition: `opacity 0.7s ease ${delay}ms, transform 0.7s ease ${delay}ms`,
      }}
    >
      {children}
    </div>
  )
}

export function Chapter({ id, children, className = '' }) {
  return (
    <section id={id} data-chapter={id} className={`relative w-full ${className}`} style={{ fontFamily: FONT }}>
      <div className="max-w-[1180px] mx-auto px-6 sm:px-10 lg:px-12 py-24 sm:py-32">{children}</div>
    </section>
  )
}

export function Head({ n, name, title, lede, receipt }) {
  return (
    <div className="mb-14 sm:mb-16 max-w-3xl">
      <Reveal>
        <div className="flex items-center gap-3 mb-5">
          <span className="text-[12px] uppercase tracking-[0.34em] text-(--accent)/80" style={{ fontFamily: MONO }}>
            {n} · {name}
          </span>
          <span className="h-px flex-1 max-w-[120px] bg-(--accent)/25" />
        </div>
        <h2
          className="text-[36px] sm:text-[56px] md:text-[68px] leading-[1.02] tracking-tight mb-6 text-white"
          style={{ fontWeight: 600 }}
        >
          {title}
        </h2>
      </Reveal>
      {lede && (
        <Reveal delay={80}>
          <p className="text-[15px] sm:text-[16px] leading-[27px]" style={{ fontWeight: 400, color: COLOR.dim }}>
            {lede}
          </p>
        </Reveal>
      )}
      {receipt && (
        <Reveal delay={140}>
          <div className="mt-5">
            <Receipt>{receipt}</Receipt>
          </div>
        </Reveal>
      )}
    </div>
  )
}

export function Panel({ children, className = '', pad = true, tone = 'default' }) {
  const border =
    tone === 'cyan' ? 'border-(--accent)/30' : tone === 'amber' ? 'border-(--amber)/30' : tone === 'red' ? 'border-(--red)/30' : tone === 'violet' ? 'border-(--violet)/28' : 'border-white/10'
  return (
    <div
      className={`relative rounded-2xl border ${border} ${pad ? 'p-6 sm:p-7' : ''} ${className}`}
      style={{ background: 'var(--bg-2)', boxShadow: 'inset 0 1px 0 rgba(var(--ink),0.04)' }}
    >
      {children}
    </div>
  )
}

export function PanelTitle({ children, tone = 'cyan' }) {
  const c = TONE[tone] || TONE.cyan
  return (
    <div className="text-[11.5px] uppercase tracking-[0.22em] mb-4" style={{ color: c, fontFamily: MONO }}>
      {children}
    </div>
  )
}

// the signature element — a receipt chip. Every big claim carries one.
export function Receipt({ children, tone = 'cyan' }) {
  const c = TONE[tone] || TONE.cyan
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-md border px-2 py-[3px] text-[11px] align-middle"
      style={{ fontFamily: MONO, color: c, borderColor: `color-mix(in srgb, ${c} 30%, transparent)`, background: 'var(--well)' }}
    >
      <span aria-hidden="true" style={{ opacity: 0.8 }}>⌗</span>
      {children}
    </span>
  )
}

// event-kind tag — one color system for the whole page (legend in ch. 04)
export const KIND_FAMILY = {
  factory: { color: COLOR.cyan, label: 'factory' },
  money: { color: COLOR.green, label: 'money' },
  decision: { color: COLOR.amber, label: 'needs-you / decision' },
  council: { color: COLOR.violet, label: 'council' },
  system: { color: 'var(--text-2)', label: 'system' },
}
export function Kind({ family = 'factory', children }) {
  const f = KIND_FAMILY[family] || KIND_FAMILY.system
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px]" style={{ fontFamily: MONO, color: f.color }}>
      <span aria-hidden="true" className="w-[7px] h-[7px] rounded-full inline-block" style={{ background: f.color }} />
      {children}
    </span>
  )
}

// a semantic state dot. live = accent (a data-mode statement), building =
// amber (in flight), sleeping = muted. No glow: the dot is a mark, not a lamp.
export function StatusDot({ state = 'live', size = 7 }) {
  const c = state === 'live' ? COLOR.green : state === 'building' ? COLOR.amber : state === 'sleeping' ? 'var(--text-3)' : COLOR.cyan
  return <span aria-hidden="true" className="inline-block rounded-full shrink-0" style={{ width: size, height: size, background: c }} />
}

// big number for stat strips (landing) — proportional figures, receipted
export function Stat({ value, label, tone = 'default' }) {
  const c = TONE[tone] || 'var(--text-1)'
  return (
    <div className="min-w-0">
      <div className="text-[26px] sm:text-[32px] tracking-tight" style={{ fontWeight: 600, color: c }}>
        {value}
      </div>
      <div className="text-[11.5px] uppercase tracking-[0.16em] mt-1" style={{ color: COLOR.faint, fontFamily: MONO }}>
        {label}
      </div>
    </div>
  )
}

export function HairlineDivider() {
  return <div className="h-px w-full bg-gradient-to-r from-transparent via-(--accent)/22 to-transparent" />
}

// ── action button ──────────────────────────────────────────────────────
// The shape rule: controls are 8px, cards 12px, chips pills.
// tones: primary (ink fill — the one strong action on a screen),
//        green (money / pass, a real approval), danger (kill / reject),
//        amber (needs-you), ghost (everything else).
// Inside a <form>, a button with an onClick is type="button" so a click never
// ALSO submits the form (a double append); a Btn without onClick is the
// native submit, so Enter and click both fire exactly once.
const BTN = {
  primary: { background: 'var(--text-1)', color: 'var(--bg-0)', border: '1px solid transparent', fontWeight: 600 },
  green: { background: 'var(--green)', color: 'var(--on-fill)', border: '1px solid transparent', fontWeight: 600 },
  danger: { background: 'rgba(var(--red-rgb),0.08)', color: 'var(--red)', border: '1px solid rgba(var(--red-rgb),0.35)', fontWeight: 500 },
  amber: { background: 'rgba(var(--amber-rgb),0.1)', color: 'var(--amber)', border: '1px solid rgba(var(--amber-rgb),0.35)', fontWeight: 500 },
  ghost: { background: 'var(--bg-3)', color: 'var(--text-1)', border: '1px solid var(--line-2)', fontWeight: 500 },
}
export function Btn({ children, onClick, tone = 'ghost', small = false, className = '', title, type, disabled }) {
  const styles = BTN[tone] || BTN.ghost
  return (
    <button
      type={type || (onClick ? 'button' : 'submit')}
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer select-none transition-[background,border-color,color,transform,opacity] duration-200 hover:brightness-110 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent) ${small ? 'h-[30px] px-3 text-[12px]' : 'h-[36px] px-4 text-[13px]'} ${className}`}
      style={{ fontFamily: UI, borderRadius: 'var(--btn-radius)', letterSpacing: '-0.005em', transitionTimingFunction: EASE, ...styles }}
    >
      {children}
    </button>
  )
}

// a small icon-only control (theme toggle, close, filters)
export function IconBtn({ children, onClick, title, className = '', active = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className={`inline-flex items-center justify-center w-[32px] h-[32px] cursor-pointer transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-(--accent) ${className}`}
      style={{ borderRadius: 'var(--r-md)', color: active ? 'var(--text-1)' : 'var(--text-2)', background: active ? 'var(--bg-4)' : 'transparent', border: '1px solid ' + (active ? 'var(--line-2)' : 'transparent') }}
    >
      {children}
    </button>
  )
}

// a progress meter. The fill carries the meaning; the track is a quiet step
// of the surface. good = green is reserved for real money (meaning contract):
// neutral progress uses tone="blue".
export function Meter({ value, tone = 'good', height = 6 }) {
  const c = TONE[tone] || TONE.good
  const w = Math.max(0, Math.min(100, Math.round((value || 0) * 100)))
  return (
    <div className="w-full rounded-full overflow-hidden" style={{ height, background: 'var(--track)' }} role="progressbar" aria-valuenow={w} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${w}%`, background: c, transitionTimingFunction: EASE }} />
    </div>
  )
}

// ── badges — the honest labels. A non-real class is violet AND hatched
// (hue alone is not enough); a thing the owner did is the accent. ──
const badgeBase = 'inline-flex items-center gap-1.5 h-[22px] px-2 rounded-full text-[10.5px] uppercase tracking-[0.06em] whitespace-nowrap'
export function SimBadge({ children = 'simulated' }) {
  return (
    <span
      className={badgeBase}
      style={{
        fontFamily: UI,
        fontWeight: 600,
        color: 'var(--violet)',
        border: '1px solid rgba(var(--violet-rgb),0.35)',
        background: 'repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(var(--violet-rgb),0.1) 4px, rgba(var(--violet-rgb),0.1) 8px)',
      }}
    >
      {children}
    </span>
  )
}
export function YoursBadge({ children = 'yours · persisted' }) {
  return (
    <span className={badgeBase} style={{ fontFamily: UI, fontWeight: 600, color: 'var(--accent)', border: '1px solid rgba(var(--accent-rgb),0.35)', background: 'rgba(var(--accent-rgb),0.08)' }}>
      {children}
    </span>
  )
}
// generic tinted chip — tone carries the meaning, text stays readable
export function Chip({ tone = 'neutral', children, mono = false, className = '' }) {
  const c = TONE[tone]
  return (
    <span
      className={`inline-flex items-center gap-1.5 h-[22px] px-2 rounded-full text-[11px] whitespace-nowrap ${className}`}
      style={{
        fontFamily: mono ? MONO : UI,
        fontWeight: 500,
        color: c || 'var(--text-2)',
        background: c ? tint(tone, 0.1) : 'var(--bg-4)',
        border: '1px solid ' + (c ? tint(tone, 0.28) : 'var(--line-1)'),
      }}
    >
      {children}
    </span>
  )
}

// ── form primitives — one input style for every write path ──
export function Field({ label, children, className = '', hint }) {
  // a <label> wrapping a PickRow (buttons, no input) would forward a click on
  // the caption to the first button — refuse that; a real input keeps the
  // native label-click focus
  const onClick = (e) => {
    if (!e.currentTarget.querySelector('input,select,textarea') && !(e.target.closest && e.target.closest('button'))) e.preventDefault()
  }
  return (
    <label className={`block min-w-0 ${className}`} onClick={onClick}>
      <span className="flex items-baseline justify-between gap-2 mb-1.5">
        <span className="text-[12px]" style={{ fontFamily: UI, fontWeight: 500, color: 'var(--text-2)' }}>{label}</span>
        {hint && <span className="text-[11px] truncate" style={{ fontFamily: UI, color: 'var(--text-3)' }}>{hint}</span>}
      </span>
      {children}
    </label>
  )
}

export const INPUT_CLASS = 'w-full h-[36px] px-3 text-[13px] outline-none border transition-[border-color,box-shadow] duration-200 focus:border-(--accent)'
export const INPUT_STYLE = { fontFamily: UI, background: 'var(--input-bg)', borderColor: 'var(--line-2)', borderRadius: 'var(--r-md)', color: 'var(--text-1)' }

export function TextInput({ value, onChange, placeholder, autoFocus, onKeyDown, mono = false }) {
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

// a segmented pick — one active, the rest quiet
export function PickRow({ options, value, onPick, small = false }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="group">
      {options.map((o) => {
        const v = typeof o === 'string' ? o : o.value
        const label = typeof o === 'string' ? o : o.label
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
            {label}
          </button>
        )
      })}
    </div>
  )
}
