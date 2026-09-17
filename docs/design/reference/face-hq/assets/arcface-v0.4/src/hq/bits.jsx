// shared HQ fragments — room header, timeline row, approval card
import { useState } from 'react'
import { MONO, COLOR, Btn, SimBadge } from '../ui/kit.jsx'
import { familyOf, hhmm } from '../spine/kinds.js'

export function RoomHead({ title, hint, right }) {
  return (
    <div className="flex items-end justify-between gap-4 flex-wrap mb-4 mt-2">
      <div>
        <h1 className="text-[22px] sm:text-[26px] tracking-tight text-white leading-tight" style={{ fontWeight: 600 }}>
          {title}
        </h1>
        {hint && (
          <div className="text-[11px] text-white/52 mt-1" style={{ fontWeight: 300 }}>
            {hint}
          </div>
        )}
      </div>
      {right}
    </div>
  )
}

export function HPanel({ title, hint, children, className = '', tone }) {
  return (
    <section
      className={`rounded-xl border p-4 sm:p-5 mb-4 ${className}`}
      style={{
        background: 'rgba(4,9,8,0.78)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        borderColor: tone === 'amber' ? 'rgba(251,191,93,0.3)' : tone === 'cyan' ? 'rgba(0,255,209,0.28)' : 'rgba(255,255,255,0.1)',
      }}
    >
      {title && (
        <h2 className="flex items-baseline justify-between gap-3 text-[10.5px] uppercase tracking-[0.24em] mb-3.5" style={{ fontFamily: MONO, color: tone === 'amber' ? COLOR.amber : COLOR.cyan }}>
          <span>{title}</span>
          {hint && <span className="text-[9.5px] tracking-[0.06em] normal-case text-white/42">{hint}</span>}
        </h2>
      )}
      {children}
    </section>
  )
}

export function EventRow({ e, onReceipt }) {
  const fam = familyOf(e.kind)
  return (
    <div className="grid grid-cols-[42px_1fr_auto] sm:grid-cols-[46px_150px_1fr_auto] items-baseline gap-x-3 px-2 py-[7px] rounded-md hover:bg-white/[0.03] transition-colors border-b border-white/5 last:border-0">
      <span className="text-[10px] text-white/45" style={{ fontFamily: MONO, fontVariantNumeric: 'tabular-nums' }}>
        {e.dateLabel ? e.dateLabel.slice(5) + ' ' : ''}{hhmm(e.t)}
      </span>
      <span className="hidden sm:inline-flex items-center gap-1.5 text-[10.5px] truncate" style={{ fontFamily: MONO, color: fam.color }}>
        <span aria-hidden="true" className="w-[6px] h-[6px] rounded-full shrink-0" style={{ background: fam.color }} />
        {e.kind}
      </span>
      <span className="text-[12px] leading-[18px] text-white/80 min-w-0" style={{ fontWeight: 300 }}>
        <span className="sm:hidden mr-1.5" style={{ color: fam.color, fontFamily: MONO, fontSize: 10 }}>{e.kind}</span>
        {e.text}
      </span>
      <span className="flex items-center gap-2 shrink-0" style={{ fontFamily: MONO }}>
        {e.level && <span className="text-[8.5px] text-white/45 border border-white/14 rounded px-1 py-[1px]">{e.level}</span>}
        <button
          onClick={() => onReceipt && onReceipt(e)}
          className="text-[9px] rounded-md border border-dashed px-1.5 min-h-[26px] cursor-pointer hover:border-solid focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00ffd1]"
          style={{ color: 'rgba(0,255,209,0.7)', borderColor: 'rgba(0,255,209,0.35)' }}
          title="open receipt"
        >
          ⌗ {String(e.id).slice(-6)}
        </button>
      </span>
    </div>
  )
}

// approval card — the brief's law: the 3 facts ON the card, never behind a click
export function ApprovalCard({ ap, selected, onAct }) {
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')
  const factColor = { council: COLOR.violet, money: COLOR.green, kill: COLOR.red }
  return (
    <div
      data-approval={ap.id}
      className="rounded-xl border p-4 mb-3 transition-shadow"
      style={{
        background: 'rgba(0,0,0,0.5)',
        borderColor: selected ? 'rgba(0,255,209,0.6)' : 'rgba(255,255,255,0.13)',
        boxShadow: selected ? '0 0 0 1px rgba(0,255,209,0.35), 0 0 24px rgba(0,255,209,0.08)' : 'none',
      }}
    >
      <div className="flex items-baseline justify-between gap-3 flex-wrap mb-2">
        <b className="text-[13.5px] text-white/94" style={{ fontWeight: 600 }}>{ap.title}</b>
        <span className="text-[9px] uppercase tracking-[0.14em] text-white/48" style={{ fontFamily: MONO }}>{ap.tag}</span>
      </div>
      <div className="space-y-[3px] mb-3.5 text-[11px]" style={{ fontFamily: MONO }}>
        {ap.facts.map((f) => (
          <div key={f.k} style={{ color: factColor[f.k] || 'rgba(255,255,255,0.6)' }}>» {f.v}</div>
        ))}
      </div>
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
                {a.label}
              </Btn>
            ))}
          <Btn small tone="danger" onClick={() => setRejecting(true)}>
            reject · r
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
            placeholder="reason — required, it becomes calibration data"
            className="flex-1 min-w-[220px] bg-transparent border border-[#ff6b6b]/45 rounded-lg px-3 min-h-[40px] text-[12px] text-white/85 placeholder-white/35 outline-none focus:border-[#ff6b6b]"
            style={{ fontFamily: MONO }}
          />
          <Btn small tone="danger" onClick={() => reason.trim() && onAct(ap.id, false, reason.trim(), 'rejected')}>
            record rejection
          </Btn>
          <Btn small onClick={() => setRejecting(false)}>cancel</Btn>
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
      <button aria-label="close" onClick={onClose} className="absolute inset-0 cursor-pointer" style={{ background: 'rgba(0,0,0,0.55)' }} />
      <div className="relative w-full max-w-[440px] h-full overflow-y-auto border-l border-white/12 p-5" style={{ background: '#050a09', fontFamily: MONO }}>
        <div className="flex items-center justify-between mb-5">
          <span className="text-[10px] uppercase tracking-[0.24em]" style={{ color: COLOR.cyan }}>receipt</span>
          <Btn small onClick={onClose}>close · esc</Btn>
        </div>
        <div className="text-[13px] text-white mb-1" style={{ fontWeight: 700 }}>⌗ {ev.id}</div>
        <div className="inline-flex items-center gap-1.5 text-[10.5px] mb-4" style={{ color: fam.color }}>
          <span className="w-[6px] h-[6px] rounded-full" style={{ background: fam.color }} /> {ev.kind} · {ev.module} {ev.level ? '· ' + ev.level : ''}
        </div>
        <div className="text-[11.5px] leading-[18px] text-white/75 mb-4" style={{ fontFamily: 'inherit', fontWeight: 300 }}>{ev.text}</div>
        <div className="text-[9.5px] uppercase tracking-[0.2em] text-white/42 mb-1.5">payload</div>
        <pre className="text-[10.5px] leading-[17px] text-white/70 rounded-lg border border-white/10 p-3 overflow-x-auto mb-4" style={{ background: 'rgba(255,255,255,0.03)' }}>
          {JSON.stringify(ev.payload || {}, null, 2)}
        </pre>
        <div className="text-[10px] leading-[17px] text-white/45 space-y-1.5">
          <div>day {typeof ev.day === 'number' ? ev.day - 13 : ev.day} · {hhmm(ev.t)} IST · append-only (ADR-0029: corrections supersede, never edit)</div>
          <div>canonical serialization · sha-chained · redaction fail-safe stub-only (ADR-0028)</div>
          {!ev.real && <div className="pt-1"><SimBadge>simulated event · real vocabulary · presentational id</SimBadge></div>}
          {ev.real && <div style={{ color: COLOR.green }}>REAL event — read from your spine (read-only)</div>}
        </div>
      </div>
    </div>
  )
}
