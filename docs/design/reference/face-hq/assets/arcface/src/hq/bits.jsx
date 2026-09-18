// shared HQ fragments — the workroom's design system.
// Shape law: controls 8px · cards 12px · chips pills. One accent; amber,
// green, red and violet keep their reserved meanings only. No glow, no
// gradient wash: hierarchy comes from type weight, ink level and spacing.
import { useState } from 'react'
import { Tray } from '@phosphor-icons/react'
import { FONT, UI, MONO, COLOR, EASE, TONE, tint, Btn, SimBadge } from '../ui/kit.jsx'
import { familyOf, hhmm } from '../spine/kinds.js'

// ── room head: the sentence leads, the lede explains, the right slot labels ──
export function RoomHead({ title, hint, right }) {
  return (
    <header className="mb-6 pb-5 flex items-end justify-between gap-6 flex-wrap" style={{ borderBottom: '1px solid var(--line-1)' }}>
      <div className="min-w-0">
        <h1 className="text-[22px] sm:text-[26px] leading-[1.15] tracking-[-0.01em] max-w-[30ch]" style={{ fontFamily: FONT, fontWeight: 600, color: 'var(--text-1)' }}>
          {title}
        </h1>
        {hint && (
          <p className="text-[13.5px] leading-[21px] mt-1.5 max-w-[72ch]" style={{ fontFamily: UI, color: 'var(--text-2)' }}>
            {typeof hint === 'string' ? hint.charAt(0).toUpperCase() + hint.slice(1) : hint}
          </p>
        )}
      </div>
      {right && <div className="shrink-0 flex items-center gap-2 pb-0.5">{right}</div>}
    </header>
  )
}

// ── panel: one card, one hairline, a title row ──
export function HPanel({ title, hint, children, className = '', tone, actions, pad = true }) {
  const accent = tone === 'amber' ? COLOR.amber : tone === 'red' ? COLOR.red : tone === 'green' ? COLOR.green : tone === 'violet' ? COLOR.violet : null
  return (
    <section
      className={`mb-4 ${pad ? 'p-5' : ''} ${className}`}
      style={{
        background: 'var(--bg-2)',
        border: '1px solid ' + (accent ? `color-mix(in srgb, ${accent} 35%, var(--line-1))` : 'var(--line-1)'),
        borderRadius: 'var(--r-lg)',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      {(title || actions) && (
        <div className={`flex items-center justify-between gap-3 ${pad ? 'mb-4' : 'px-5 pt-4 pb-3'}`}>
          <h2 className="flex items-baseline gap-2 min-w-0 flex-1">
            {accent && <span aria-hidden="true" className="w-[6px] h-[6px] rounded-full shrink-0 self-center" style={{ background: accent }} />}
            <span className="text-[14px] leading-[20px] shrink-0 max-w-full truncate" style={{ fontFamily: UI, fontWeight: 600, color: 'var(--text-1)', letterSpacing: '-0.005em' }}>{title}</span>
            {hint && <span className="hidden sm:inline text-[12px] leading-[20px] truncate min-w-0" style={{ fontFamily: UI, color: 'var(--text-3)' }}>{hint}</span>}
          </h2>
          {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  )
}

// ── a small in-panel section label ──
export function SectionLabel({ children, className = '' }) {
  return (
    <div className={`text-[11px] uppercase tracking-[0.08em] mb-2 ${className}`} style={{ fontFamily: UI, fontWeight: 600, color: 'var(--text-3)' }}>
      {children}
    </div>
  )
}

// ── the instrument strip: a row of figures. value leads, label explains.
// items: [{ v, l, tone?, c?, sub? }] — tone names a reserved meaning
export function KpiStrip({ items, cols, className = '' }) {
  const n = cols || Math.min(6, items.length)
  const colClass = n >= 6 ? 'grid-cols-2 sm:grid-cols-3 xl:grid-cols-6' : n === 5 ? 'grid-cols-2 sm:grid-cols-3 xl:grid-cols-5' : n === 4 ? 'grid-cols-2 xl:grid-cols-4' : n === 3 ? 'grid-cols-3' : 'grid-cols-2'
  return (
    <div className={`grid ${colClass} mb-4 overflow-hidden ${className}`} style={{ background: 'var(--bg-2)', border: '1px solid var(--line-1)', borderRadius: 'var(--r-lg)', boxShadow: 'var(--shadow-card)' }}>
      {items.map((s, i) => {
        const c = s.tone ? TONE[s.tone] : s.c && s.c !== '#fff' && s.c !== '#ffffff' ? s.c : 'var(--text-1)'
        // a long figure (a ratio, a range, a word) steps down instead of truncating
        const len = String(s.v ?? '').length
        const size = len > 12 ? 17 : len > 8 ? 20 : 24
        return (
          <div key={s.l + i} className="px-5 py-4 min-w-0" style={{ boxShadow: 'inset 1px 0 0 var(--line-1), inset 0 1px 0 var(--line-1)' }}>
            <div className="leading-[28px] tracking-[-0.01em] truncate" style={{ fontFamily: FONT, fontWeight: 600, fontSize: size, color: c }}>{s.v}</div>
            <div className="text-[12px] leading-[16px] mt-1 line-clamp-2" style={{ fontFamily: UI, color: 'var(--text-2)' }}>{s.l}</div>
            {s.sub && <div className="text-[11px] leading-[14px] mt-0.5 truncate" style={{ fontFamily: UI, color: 'var(--text-3)' }}>{s.sub}</div>}
          </div>
        )
      })}
    </div>
  )
}

// ── an empty state that says how to fill it ──
export function Empty({ icon: Icon = Tray, title, hint, action }) {
  return (
    <div className="py-8 px-4 text-center flex flex-col items-center gap-2">
      <span className="inline-flex items-center justify-center w-9 h-9 rounded-full mb-1" style={{ background: 'var(--bg-4)', color: 'var(--text-3)' }}>
        <Icon size={18} aria-hidden="true" />
      </span>
      <div className="text-[13.5px]" style={{ fontFamily: UI, fontWeight: 600, color: 'var(--text-1)' }}>{title}</div>
      {hint && <div className="text-[12.5px] leading-[19px] max-w-[42ch]" style={{ fontFamily: UI, color: 'var(--text-2)' }}>{hint}</div>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

// ── one event on the tape ──
export function EventRow({ e, onReceipt }) {
  const fam = familyOf(e.kind)
  return (
    <div className="group grid grid-cols-[44px_1fr_auto] sm:grid-cols-[52px_156px_1fr_auto] items-baseline gap-x-3 px-2 py-[8px] transition-colors duration-200 hover:bg-(--bg-3)" style={{ borderBottom: '1px solid var(--line-1)', borderRadius: 'var(--r-sm)' }}>
      <span className="text-[11.5px] tnum" style={{ fontFamily: MONO, color: 'var(--text-3)' }}>
        {e.dateLabel ? e.dateLabel.slice(5) + ' ' : ''}{hhmm(e.t)}
      </span>
      <span className="hidden sm:inline-flex items-center gap-1.5 text-[11.5px] truncate min-w-0" style={{ fontFamily: MONO, color: fam.color }}>
        <span aria-hidden="true" className="w-[5px] h-[5px] rounded-full shrink-0" style={{ background: fam.color }} />
        <span className="truncate">{e.kind}</span>
      </span>
      <span className="text-[13px] leading-[20px] min-w-0" style={{ fontFamily: UI, color: 'var(--text-1)' }}>
        <span className="sm:hidden mr-1.5 text-[10.5px]" style={{ color: fam.color, fontFamily: MONO }}>{e.kind}</span>
        {e.text}
      </span>
      <span className="flex items-center gap-1.5 shrink-0">
        {e.level && <span className="hidden md:inline text-[10.5px] px-1.5 h-[18px] leading-[18px] rounded" style={{ fontFamily: MONO, color: 'var(--text-3)', background: 'var(--bg-4)' }}>{e.level}</span>}
        <button
          type="button"
          onClick={() => onReceipt && onReceipt(e)}
          className="text-[11px] h-[22px] px-1.5 rounded cursor-pointer transition-colors duration-200 hover:text-(--accent) hover:bg-(--accent)/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-(--accent)"
          style={{ fontFamily: MONO, color: 'var(--text-3)', transitionTimingFunction: EASE }}
          title="open receipt"
        >
          ⌗ {String(e.id).slice(-6)}
        </button>
      </span>
    </div>
  )
}

// approval card — the law: the 3 facts ON the card, never behind a click.
// Amber is needs-you; the card carries it as a left rail, not a wash.
export function ApprovalCard({ ap, selected, onAct }) {
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')
  const factColor = { council: COLOR.cyan, money: COLOR.green, kill: COLOR.red }
  return (
    <div
      data-approval={ap.id}
      className="relative p-4 pl-5 mb-3 overflow-hidden transition-[border-color,box-shadow] duration-200"
      style={{
        background: 'var(--bg-3)',
        border: '1px solid ' + (selected ? 'var(--accent)' : 'var(--line-1)'),
        borderRadius: 'var(--r-md)',
        boxShadow: selected ? '0 0 0 3px rgba(var(--accent-rgb),0.15)' : 'none',
        transitionTimingFunction: EASE,
      }}
    >
      <span aria-hidden="true" className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: COLOR.amber }} />
      <div className="flex items-start justify-between gap-3 mb-3">
        <b className="text-[13.5px] leading-[19px]" style={{ fontFamily: UI, fontWeight: 600, color: 'var(--text-1)' }}>{ap.title}</b>
        <span className="shrink-0 inline-flex items-center h-[20px] px-2 rounded-full text-[10.5px] uppercase tracking-[0.05em]" style={{ fontFamily: UI, fontWeight: 600, color: COLOR.amber, background: tint('amber', 0.12) }}>{ap.tag}</span>
      </div>
      <dl className="mb-4 space-y-[5px]">
        {ap.facts.map((f) => (
          <div key={f.k} className="grid grid-cols-[56px_1fr] gap-2 items-baseline">
            <dt className="text-[10.5px] uppercase tracking-[0.06em]" style={{ fontFamily: UI, fontWeight: 600, color: 'var(--text-3)' }}>{f.k}</dt>
            <dd className="text-[12.5px] leading-[18px]" style={{ fontFamily: UI, color: factColor[f.k] || 'var(--text-2)' }}>{f.v}</dd>
          </div>
        ))}
      </dl>
      {!rejecting ? (
        <div className="flex gap-2 flex-wrap">
          {ap.actions
            .filter((a) => a.approved)
            .map((a) => (
              <Btn
                key={a.label}
                small
                tone={a.danger ? 'danger' : a.soft ? 'ghost' : 'green'}
                onClick={() => onAct(ap.id, true, a.soft ? 'soft action — noted' : 'evidence on the card verified', a.label)}
              >
                {a.label.charAt(0).toUpperCase() + a.label.slice(1)}
              </Btn>
            ))}
          <Btn small tone="danger" onClick={() => setRejecting(true)}>
            Reject
          </Btn>
        </div>
      ) : (
        <form
          className="flex gap-2 flex-wrap items-center"
          onSubmit={(e) => {
            e.preventDefault()
            if (reason.trim()) onAct(ap.id, false, reason.trim(), 'rejected')
          }}
        >
          <input
            autoFocus
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason (required, it becomes calibration data)"
            className="flex-1 min-w-[220px] h-[32px] px-3 text-[13px] outline-none border placeholder:text-(--text-3) focus:border-(--red)"
            style={{ fontFamily: UI, background: 'var(--input-bg)', borderColor: 'rgba(var(--red-rgb),0.45)', borderRadius: 'var(--r-md)', color: 'var(--text-1)' }}
          />
          <Btn small tone="danger" onClick={() => reason.trim() && onAct(ap.id, false, reason.trim(), 'rejected')}>
            Record rejection
          </Btn>
          <Btn small onClick={() => setRejecting(false)}>Cancel</Btn>
        </form>
      )}
    </div>
  )
}

// receipt drawer — the payload behind a ⌗
export function ReceiptDrawer({ ev, onClose }) {
  if (!ev) return null
  const fam = familyOf(ev.kind)
  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-label="Receipt detail">
      <button aria-label="close" onClick={onClose} className="absolute inset-0 cursor-pointer" style={{ background: 'var(--scrim)', backdropFilter: 'blur(2px)', WebkitBackdropFilter: 'blur(2px)' }} />
      <div className="relative w-full max-w-[460px] h-full overflow-y-auto p-6" style={{ background: 'var(--bg-2)', borderLeft: '1px solid var(--line-2)', boxShadow: 'var(--shadow-pop)', fontFamily: UI }}>
        <div className="flex items-center justify-between mb-6">
          <span className="text-[11px] uppercase tracking-[0.08em]" style={{ fontWeight: 600, color: 'var(--text-3)' }}>Receipt</span>
          <Btn small onClick={onClose}>Close · esc</Btn>
        </div>
        <div className="text-[16px] mb-1.5" style={{ fontFamily: MONO, fontWeight: 700, color: 'var(--text-1)' }}>⌗ {ev.id}</div>
        <div className="inline-flex items-center gap-1.5 text-[11.5px] mb-5" style={{ fontFamily: MONO, color: fam.color }}>
          <span className="w-[6px] h-[6px] rounded-full" style={{ background: fam.color }} /> {ev.kind} · {ev.module} {ev.level ? '· ' + ev.level : ''}
        </div>
        <div className="text-[13.5px] leading-[21px] mb-5" style={{ color: 'var(--text-1)' }}>{ev.text}</div>
        <SectionLabel>payload</SectionLabel>
        <pre className="text-[11.5px] leading-[19px] p-3.5 overflow-x-auto mb-5" style={{ fontFamily: MONO, color: 'var(--text-2)', background: 'var(--bg-1)', border: '1px solid var(--line-1)', borderRadius: 'var(--r-md)' }}>
          {JSON.stringify(ev.payload || {}, null, 2)}
        </pre>
        <div className="text-[11.5px] leading-[19px] space-y-1.5" style={{ color: 'var(--text-3)' }}>
          <div>day {typeof ev.day === 'number' ? ev.day - 13 : ev.day} · {hhmm(ev.t)} IST · append-only (ADR-0029: corrections supersede, never edit)</div>
          <div>canonical serialization · sha-chained · redaction fail-safe stub-only (ADR-0028)</div>
          {!ev.real && !ev.ws && <div className="pt-1"><SimBadge>simulated event · real vocabulary · presentational id</SimBadge></div>}
          {ev.ws && <div style={{ color: COLOR.cyan }}>YOURS — a real action you took in this app, persisted</div>}
          {ev.real && <div style={{ color: COLOR.green }}>REAL event — read from your spine (read-only)</div>}
        </div>
      </div>
    </div>
  )
}
