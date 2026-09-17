// bits.tsx -- the workroom's shared fragments, ported from the owner's v0.7 reference
// (docs/design/reference/face-hq/assets/arcface/src/hq/bits.jsx) onto the token law
// (face v2 Phase 01, ADR-1318).
//
// Shape law: controls 8px · cards 12px · chips pills. One accent; amber, green, red and violet
// keep their reserved meanings only. No glow, no gradient wash: hierarchy comes from type weight,
// ink level and spacing.
//
// Declared deltas from the reference:
//   - KpiStrip items carry a `tone` (a meaning) and never a colour of their own; the reference's
//     `c` field, and its comparison against a literal to detect the default, are gone.
//   - The spine-bound bits (EventRow, ApprovalCard, ReceiptDrawer) are not ported here: they read
//     v0.7's simulated spine, and each arrives with the Phase 03 module that reads the real one.
import type { ReactNode } from 'react'
import { Tray } from '@phosphor-icons/react'
import type { Icon } from '@phosphor-icons/react'
import { FONT, UI, toneColor } from './kit'
import type { Tone } from './kit'

/** A room's head: the sentence leads, the lede explains, the right slot labels. */
export function RoomHead({ title, hint, right, eyebrow }: { title: ReactNode; hint?: ReactNode; right?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <header className="mb-6 pb-5 flex items-end justify-between gap-6 flex-wrap" style={{ borderBottom: '1px solid var(--line-1)' }}>
      <div className="min-w-0">
        {eyebrow ? (
          <div className="text-[11px] uppercase tracking-[0.08em] mb-1.5" style={{ fontFamily: UI, fontWeight: 600, color: 'var(--text-3)' }}>
            {eyebrow}
          </div>
        ) : null}
        <h1 className="text-[22px] sm:text-[26px] leading-[1.15] tracking-[-0.01em] max-w-[30ch]" style={{ fontFamily: FONT, fontWeight: 600, color: 'var(--text-1)' }}>
          {title}
        </h1>
        {hint ? (
          <p className="text-[13.5px] leading-[21px] mt-1.5 max-w-[72ch]" style={{ fontFamily: UI, color: 'var(--text-2)' }}>
            {typeof hint === 'string' ? hint.charAt(0).toUpperCase() + hint.slice(1) : hint}
          </p>
        ) : null}
      </div>
      {right ? <div className="shrink-0 flex items-center gap-2 flex-wrap pb-0.5">{right}</div> : null}
    </header>
  )
}

export type PanelTone = 'amber' | 'red' | 'green' | 'violet'

/**
 * One card, one hairline, a title row. A tone marks the card with a dot and a tinted edge.
 * `titleId` (not in the reference) names the section by its title for assistive tech, and
 * `role` lets a refusal card announce itself.
 */
export function HPanel({
  title, hint, children, className = '', tone, actions, pad = true, titleId, role, ariaLabel,
}: {
  title?: ReactNode
  hint?: ReactNode
  children?: ReactNode
  className?: string
  tone?: PanelTone
  actions?: ReactNode
  pad?: boolean
  titleId?: string
  role?: 'status' | 'region'
  ariaLabel?: string
}) {
  const accent = tone ? toneColor(tone) : null
  return (
    <section
      role={role}
      aria-labelledby={title && titleId ? titleId : undefined}
      aria-label={ariaLabel}
      className={`mb-4 min-w-0 ${pad ? 'p-5' : ''} ${className}`}
      style={{
        background: 'var(--bg-2)',
        border: `1px solid ${accent ? `color-mix(in srgb, ${accent} 35%, var(--line-1))` : 'var(--line-1)'}`,
        borderRadius: 'var(--r-lg)',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      {title || actions ? (
        <div className={`flex items-center justify-between gap-3 ${pad ? 'mb-4' : 'px-5 pt-4 pb-3'}`}>
          <h2 className="flex items-baseline gap-2 min-w-0 flex-1">
            {accent ? <span aria-hidden="true" className="w-[6px] h-[6px] rounded-full shrink-0 self-center" style={{ background: accent }} /> : null}
            <span id={titleId} className="text-[14px] leading-[20px] shrink-0 max-w-full truncate" style={{ fontFamily: UI, fontWeight: 600, color: 'var(--text-1)', letterSpacing: '-0.005em' }}>{title}</span>
            {hint ? <span className="hidden sm:inline text-[12px] leading-[20px] truncate min-w-0" style={{ fontFamily: UI, color: 'var(--text-3)' }}>{hint}</span> : null}
          </h2>
          {actions ? <div className="flex items-center gap-2 shrink-0">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  )
}

/** A small in-panel section label. */
export function SectionLabel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`text-[11px] uppercase tracking-[0.08em] mb-2 ${className}`} style={{ fontFamily: UI, fontWeight: 600, color: 'var(--text-3)' }}>
      {children}
    </div>
  )
}

export type Kpi = { v: ReactNode; l: ReactNode; tone?: Tone; sub?: ReactNode; key?: string }

/** The instrument strip: a row of figures. The value leads, the label explains. */
export function KpiStrip({ items, cols, className = '' }: { items: Kpi[]; cols?: number; className?: string }) {
  const n = cols ?? Math.min(6, items.length)
  const colClass = n >= 6 ? 'grid-cols-2 sm:grid-cols-3 xl:grid-cols-6' : n === 5 ? 'grid-cols-2 sm:grid-cols-3 xl:grid-cols-5' : n === 4 ? 'grid-cols-2 xl:grid-cols-4' : n === 3 ? 'grid-cols-3' : 'grid-cols-2'
  return (
    <div className={`grid ${colClass} mb-4 overflow-hidden ${className}`} style={{ background: 'var(--bg-2)', border: '1px solid var(--line-1)', borderRadius: 'var(--r-lg)', boxShadow: 'var(--shadow-card)' }}>
      {items.map((s, i) => {
        const c = s.tone ? toneColor(s.tone) : 'var(--text-1)'
        // A long figure (a ratio, a range, a word) steps down instead of truncating.
        const len = typeof s.v === 'string' || typeof s.v === 'number' ? String(s.v).length : 0
        const size = len > 12 ? 17 : len > 8 ? 20 : 24
        return (
          <div key={s.key ?? i} className="px-5 py-4 min-w-0" style={{ boxShadow: 'inset 1px 0 0 var(--line-1), inset 0 1px 0 var(--line-1)' }}>
            <div className="leading-[28px] tracking-[-0.01em] truncate tnum" style={{ fontFamily: FONT, fontWeight: 600, fontSize: size, color: c }}>{s.v}</div>
            <div className="text-[12px] leading-[16px] mt-1 line-clamp-2" style={{ fontFamily: UI, color: 'var(--text-2)' }}>{s.l}</div>
            {s.sub ? <div className="text-[11px] leading-[14px] mt-0.5 truncate" style={{ fontFamily: UI, color: 'var(--text-3)' }}>{s.sub}</div> : null}
          </div>
        )
      })}
    </div>
  )
}

/** An empty state that says how to fill it. */
export function Empty({ icon: IconComponent = Tray, title, hint, action }: { icon?: Icon; title: ReactNode; hint?: ReactNode; action?: ReactNode }) {
  return (
    <div className="py-8 px-4 text-center flex flex-col items-center gap-2">
      <span className="inline-flex items-center justify-center w-9 h-9 rounded-full mb-1" style={{ background: 'var(--bg-4)', color: 'var(--text-3)' }}>
        <IconComponent size={18} aria-hidden="true" />
      </span>
      <div className="text-[13.5px]" style={{ fontFamily: UI, fontWeight: 600, color: 'var(--text-1)' }}>{title}</div>
      {hint ? <div className="text-[12.5px] leading-[19px] max-w-[42ch]" style={{ fontFamily: UI, color: 'var(--text-2)' }}>{hint}</div> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  )
}
