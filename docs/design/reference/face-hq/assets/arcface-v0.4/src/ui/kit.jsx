// ──────────────────────────────────────────────────────────────────────
// arc face — design-system kit.
// One vocabulary of surfaces for the whole experience:
//   Chapter  — full-width scroll section with consistent rhythm
//   Head     — eyebrow + display line + lede (every chapter opens the same)
//   Panel    — raised glass card over the face (radius 16, hairline border)
//   Receipt  — the signature: a small mono chip proving a claim (⌗ source)
//   Kind     — colored event-kind tag; colors carry ONE meaning everywhere
//   Reveal   — scroll entrance (disabled under reduced motion)
// Color code (legend rendered in chapter 04):
//   cyan = spine/live · green = money/pass · amber = needs-you/trial
//   red = kill/blocked · violet = council/verdict
// ──────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from 'react'
import { stage } from '../lib/stage.js'

export const FONT = "'Anybody', sans-serif"
export const MONO = "'JetBrains Mono', monospace"

export const COLOR = {
  cyan: '#00ffd1',
  green: '#4ade80',
  amber: '#fbbf5d',
  red: '#ff6b6b',
  violet: '#b9a2ff',
  ink: 'rgba(255,255,255,0.87)',
  dim: 'rgba(255,255,255,0.60)',
  faint: 'rgba(255,255,255,0.42)',
}

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
          <span className="text-[11px] uppercase tracking-[0.34em] text-[#00ffd1]/80" style={{ fontFamily: MONO }}>
            {n} · {name}
          </span>
          <span className="h-px flex-1 max-w-[120px] bg-[#00ffd1]/25" />
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
          <p className="text-[15px] sm:text-[16px] leading-[27px]" style={{ fontWeight: 300, color: COLOR.dim }}>
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
    tone === 'cyan' ? 'border-[#00ffd1]/30' : tone === 'amber' ? 'border-[#fbbf5d]/30' : tone === 'red' ? 'border-[#ff6b6b]/30' : tone === 'violet' ? 'border-[#b9a2ff]/28' : 'border-white/12'
  return (
    <div
      className={`relative rounded-2xl border ${border} ${pad ? 'p-6 sm:p-7' : ''} ${className}`}
      style={{ background: 'rgba(5,10,9,0.66)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)' }}
    >
      {children}
    </div>
  )
}

export function PanelTitle({ children, tone = 'cyan' }) {
  const c = tone === 'amber' ? COLOR.amber : tone === 'violet' ? COLOR.violet : tone === 'green' ? COLOR.green : tone === 'red' ? COLOR.red : COLOR.cyan
  return (
    <div className="text-[10.5px] uppercase tracking-[0.3em] mb-4" style={{ color: c, fontFamily: MONO }}>
      {children}
    </div>
  )
}

// the signature element — a receipt chip. Every big claim carries one.
export function Receipt({ children, tone = 'cyan' }) {
  const c = tone === 'amber' ? COLOR.amber : tone === 'green' ? COLOR.green : tone === 'violet' ? COLOR.violet : COLOR.cyan
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-[5px] text-[10.5px] align-middle"
      style={{ fontFamily: MONO, color: c, borderColor: `color-mix(in srgb, ${c} 32%, transparent)`, background: 'rgba(0,0,0,0.45)' }}
    >
      <span aria-hidden="true" style={{ opacity: 0.85 }}>⌗</span>
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
  system: { color: 'rgba(255,255,255,0.62)', label: 'system' },
}
export function Kind({ family = 'factory', children }) {
  const f = KIND_FAMILY[family] || KIND_FAMILY.system
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px]" style={{ fontFamily: MONO, color: f.color }}>
      <span aria-hidden="true" className="w-[7px] h-[7px] rounded-full inline-block" style={{ background: f.color }} />
      {children}
    </span>
  )
}

export function StatusDot({ state = 'live' }) {
  const c = state === 'live' ? COLOR.green : state === 'building' ? COLOR.amber : state === 'sleeping' ? 'rgba(255,255,255,0.38)' : COLOR.cyan
  return <span aria-hidden="true" className="inline-block w-[7px] h-[7px] rounded-full" style={{ background: c, boxShadow: state === 'live' ? `0 0 8px ${c}` : 'none' }} />
}

// big number for stat strips — tabular, receipted
export function Stat({ value, label, tone = 'default' }) {
  const c = tone === 'green' ? COLOR.green : tone === 'amber' ? COLOR.amber : tone === 'cyan' ? COLOR.cyan : '#ffffff'
  return (
    <div className="min-w-0">
      <div className="text-[26px] sm:text-[32px] tracking-tight" style={{ fontWeight: 600, color: c, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </div>
      <div className="text-[10.5px] uppercase tracking-[0.22em] mt-1" style={{ color: COLOR.faint, fontFamily: MONO }}>
        {label}
      </div>
    </div>
  )
}

export function HairlineDivider() {
  return <div className="h-px w-full bg-gradient-to-r from-transparent via-[#00ffd1]/22 to-transparent" />
}

// action button — 44px floor, three tones. HQ's only button style.
export function Btn({ children, onClick, tone = 'ghost', small = false, className = '', title }) {
  const styles =
    tone === 'primary'
      ? { background: COLOR.cyan, color: '#000', border: '1px solid ' + COLOR.cyan, fontWeight: 700 }
      : tone === 'green'
        ? { background: COLOR.green, color: '#03130a', border: '1px solid ' + COLOR.green, fontWeight: 700 }
        : tone === 'danger'
          ? { background: 'transparent', color: COLOR.red, border: '1px solid rgba(255,107,107,0.55)', fontWeight: 700 }
          : tone === 'amber'
            ? { background: 'transparent', color: COLOR.amber, border: '1px solid rgba(251,191,93,0.5)', fontWeight: 600 }
            : { background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.82)', border: '1px solid rgba(255,255,255,0.2)' }
  return (
    <button
      title={title}
      onClick={onClick}
      className={`inline-flex items-center justify-center rounded-lg px-4 cursor-pointer transition-transform hover:scale-[1.02] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00ffd1] ${small ? 'min-h-[36px] text-[10.5px]' : 'min-h-[44px] text-[11px]'} uppercase tracking-[0.14em] ${className}`}
      style={{ fontFamily: MONO, ...styles }}
    >
      {children}
    </button>
  )
}

export function Meter({ value, tone = 'good' }) {
  const c = tone === 'critical' ? COLOR.red : tone === 'warn' ? COLOR.amber : tone === 'blue' ? '#7dd3fc' : COLOR.green
  return (
    <div className="h-[5px] rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.09)' }}>
      <div className="h-full rounded-full" style={{ width: `${Math.round(value * 100)}%`, background: c }} />
    </div>
  )
}

export function SimBadge({ children = 'simulated' }) {
  return (
    <span
      className="inline-flex items-center text-[8.5px] uppercase tracking-[0.18em] px-2 py-[3px] rounded-full border"
      style={{ fontFamily: MONO, color: COLOR.amber, borderColor: 'rgba(251,191,93,0.4)' }}
    >
      {children}
    </span>
  )
}
