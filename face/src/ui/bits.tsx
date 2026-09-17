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
//   - The spine-bound bits (EventRow, ReceiptDrawer) arrive with Phase 03 at the bottom of this file,
//     taking what a fold decided instead of reading v0.7's simulated spine. ApprovalCard's one-click
//     approve is not ported: a stamp needs a typed reason, and it lives in the inbox module alone.
import type { ReactNode } from 'react'
import { Tray } from '@phosphor-icons/react'
import type { Icon } from '@phosphor-icons/react'
import { EASE, FONT, MONO, Meter, UI, toneColor } from './kit'
import type { Tone } from './kit'
import type { LaneRoom } from '../lib/lane-room.mjs'

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

// ─────────────────────────────────────────────────────────────────────────────
// Door-bound fragments (face v2 Phase 03). Each takes what a module's fold() already decided -- a
// sentence, an ink token, a boolean -- and draws it; none reads the door or judges a value.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A panel the door cannot fill yet (ADR-1324): the route it needs and what it would show. Marked
 * `data-not-served` so the browser harness counts what the owner sees, not only what a fold returned.
 */
export function NotServed({ item }: { item: { panel: string; route: string; sentence: string } }) {
  return (
    <div
      data-not-served={item.route}
      className="px-4 py-3.5 min-w-0"
      style={{ background: 'var(--well)', border: '1px dashed var(--line-2)', borderRadius: 'var(--r-md)' }}
    >
      <div className="flex items-center gap-2 flex-wrap mb-1">
        <span className="inline-flex items-center h-[20px] px-2 rounded-full text-[10.5px] uppercase tracking-[0.06em]" style={{ fontFamily: UI, fontWeight: 600, color: 'var(--text-2)', background: 'var(--bg-4)', border: '1px solid var(--line-1)' }}>
          not served
        </span>
        <span className="text-[11.5px] truncate" style={{ fontFamily: MONO, color: 'var(--text-3)' }}>GET {item.route}</span>
      </div>
      <p className="text-[12.5px] leading-[19px]" style={{ fontFamily: UI, color: 'var(--text-2)' }}>
        {item.sentence}
      </p>
    </div>
  )
}

/** A door read that has not answered yet. A number never shows a spinner: it says what it waits for. */
export function Reading({ what }: { what: string }) {
  return (
    <p className="text-[12.5px] leading-[19px] py-2" style={{ fontFamily: UI, color: 'var(--text-3)' }}>
      reading {what} from the door…
    </p>
  )
}

/** A door refusal, in the door's own code and a sentence -- never "something went wrong". */
export function DoorRefusal({ code, human }: { code: string; human: string }) {
  return (
    <div role="status" className="px-4 py-3 min-w-0" style={{ background: 'var(--well)', border: '1px solid var(--line-2)', borderRadius: 'var(--r-md)' }}>
      <span className="text-[11.5px]" style={{ fontFamily: MONO, fontWeight: 600, color: 'var(--text-1)' }}>{code}</span>
      <p className="text-[12.5px] leading-[19px] mt-0.5" style={{ fontFamily: UI, color: 'var(--text-2)' }}>{human}</p>
    </div>
  )
}

export type EventRowView = { id: string; short: string; time: string; kind: string; ink: string; text: string; tag: string }

/** One receipt on the tape. The kind wears the ink its meaning earned; ⌗ opens the receipt. */
export function EventRow({ row, onReceipt }: { row: EventRowView; onReceipt: (id: string) => void }) {
  return (
    <div className="group grid grid-cols-[44px_1fr_auto] sm:grid-cols-[52px_176px_1fr_auto] items-baseline gap-x-3 px-2 py-[8px] transition-colors duration-200 hover:bg-(--bg-3)" style={{ borderBottom: '1px solid var(--line-1)', borderRadius: 'var(--r-sm)' }}>
      <span className="text-[11.5px] tnum" style={{ fontFamily: MONO, color: 'var(--text-3)' }}>{row.time}</span>
      <span className="hidden sm:inline-flex items-center gap-1.5 text-[11.5px] truncate min-w-0" style={{ fontFamily: MONO, color: row.ink }}>
        <span aria-hidden="true" className="w-[5px] h-[5px] rounded-full shrink-0" style={{ background: row.ink }} />
        <span className="truncate">{row.kind}</span>
      </span>
      <span className="text-[13px] leading-[20px] min-w-0 break-words" style={{ fontFamily: UI, color: 'var(--text-1)' }}>
        <span className="sm:hidden mr-1.5 text-[10.5px]" style={{ color: row.ink, fontFamily: MONO }}>{row.kind}</span>
        {row.text}
      </span>
      <span className="flex items-center gap-1.5 shrink-0">
        {row.tag ? <span className="hidden md:inline text-[10.5px] px-1.5 h-[18px] leading-[18px] rounded" style={{ fontFamily: MONO, color: 'var(--text-3)', background: 'var(--bg-4)' }}>{row.tag}</span> : null}
        <button
          type="button"
          onClick={() => onReceipt(row.id)}
          className="text-[11px] h-[22px] px-1.5 rounded cursor-pointer transition-colors duration-200 hover:text-(--accent) focus-visible:outline focus-visible:outline-2 focus-visible:outline-(--accent)"
          style={{ fontFamily: MONO, color: 'var(--text-3)', transitionTimingFunction: EASE }}
          title="open receipt"
        >
          ⌗ {row.short}
        </button>
      </span>
    </div>
  )
}

export type ReceiptView = {
  isOpen: boolean
  id: string
  kind: string
  ink: string
  text: string
  fields: { key: string; value: string }[]
  payload: string
  notes: string[]
}

/** The payload behind a ⌗, read from the receipt the door served -- nothing assembled beside it. */
export function ReceiptDrawer({ receipt, onClose }: { receipt: ReceiptView; onClose: () => void }) {
  if (!receipt.isOpen) return null
  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-label="Receipt detail">
      <button type="button" aria-label="close" onClick={onClose} className="absolute inset-0 cursor-pointer" style={{ background: 'var(--scrim)', backdropFilter: 'blur(2px)', WebkitBackdropFilter: 'blur(2px)' }} />
      <div className="relative w-full max-w-[460px] h-full overflow-y-auto p-6" style={{ background: 'var(--bg-2)', borderLeft: '1px solid var(--line-2)', boxShadow: 'var(--shadow-pop)', fontFamily: UI }}>
        <div className="flex items-center justify-between mb-6">
          <span className="text-[11px] uppercase tracking-[0.08em]" style={{ fontWeight: 600, color: 'var(--text-3)' }}>Receipt</span>
          <button type="button" onClick={onClose} className="h-[30px] px-3 text-[12px] cursor-pointer" style={{ fontFamily: UI, color: 'var(--text-1)', border: '1px solid var(--line-2)', borderRadius: 'var(--btn-radius)', background: 'var(--bg-3)' }}>
            Close
          </button>
        </div>
        <div className="text-[15px] mb-1.5 break-all" style={{ fontFamily: MONO, fontWeight: 700, color: 'var(--text-1)' }}>⌗ {receipt.id}</div>
        <div className="inline-flex items-center gap-1.5 text-[11.5px] mb-5" style={{ fontFamily: MONO, color: receipt.ink }}>
          <span aria-hidden="true" className="w-[6px] h-[6px] rounded-full" style={{ background: receipt.ink }} /> {receipt.kind}
        </div>
        <div className="text-[13.5px] leading-[21px] mb-5 break-words" style={{ color: 'var(--text-1)' }}>{receipt.text}</div>
        <dl className="mb-5 space-y-1">
          {receipt.fields.map((row) => (
            <div key={row.key} className="grid grid-cols-[76px_1fr] gap-2 text-[12px] leading-[18px]">
              <dt style={{ fontFamily: MONO, color: 'var(--text-3)' }}>{row.key}</dt>
              <dd className="min-w-0 break-all" style={{ fontFamily: MONO, color: 'var(--text-2)' }}>{row.value}</dd>
            </div>
          ))}
        </dl>
        <SectionLabel>payload</SectionLabel>
        <pre className="text-[11.5px] leading-[19px] p-3.5 overflow-x-auto mb-5" style={{ fontFamily: MONO, color: 'var(--text-2)', background: 'var(--bg-1)', border: '1px solid var(--line-1)', borderRadius: 'var(--r-md)' }}>
          {receipt.payload}
        </pre>
        <div className="text-[11.5px] leading-[19px] space-y-1.5" style={{ color: 'var(--text-3)' }}>
          {receipt.notes.map((n) => (
            <div key={n}>{n}</div>
          ))}
        </div>
      </div>
    </div>
  )
}


/**
 * A verb the reference draws here that the face does not perform yet: it arrives with the work door
 * (Phase 05, ADR-1326). Drawn as a dashed card and marked `data-verb-pending`, never as a form that
 * writes nothing.
 */
export function VerbPending({ item }: { item: { verb: string; sentence: string } }) {
  return (
    <div data-verb-pending={item.verb} className="px-4 py-3.5 min-w-0" style={{ background: 'var(--well)', border: '1px dashed var(--line-2)', borderRadius: 'var(--r-md)' }}>
      <div className="flex items-center gap-2 flex-wrap mb-1">
        <span className="inline-flex items-center h-[20px] px-2 rounded-full text-[10.5px] uppercase tracking-[0.06em]" style={{ fontFamily: UI, fontWeight: 600, color: 'var(--text-2)', background: 'var(--bg-4)', border: '1px solid var(--line-1)' }}>
          work door · phase 05
        </span>
        <span className="text-[12.5px]" style={{ fontFamily: UI, fontWeight: 600, color: 'var(--text-1)' }}>{item.verb}</span>
      </div>
      <p className="text-[12.5px] leading-[19px]" style={{ fontFamily: UI, color: 'var(--text-2)' }}>{item.sentence}</p>
    </div>
  )
}

export type LaneCardView = {
  isRead: boolean
  lane: string
  status: string
  statusInk: string
  phase: string
  note: string
  burn: string
  meter: number
  distance: string
  phases: { key: string; label: string; title: string }[]
  hasPhases: boolean
  phasesNote: string
}

/** A lane's own card: its header's status, phase and burn, and its phase specs by number. */
export function LaneCard({ card }: { card: LaneCardView }) {
  if (!card.isRead) return <Reading what="the lane" />
  return (
    <div className="min-w-0" data-lane-card={card.lane}>
      <div className="flex items-baseline gap-2 flex-wrap mb-1">
        <span className="text-[13px]" style={{ fontFamily: MONO, fontWeight: 600, color: 'var(--text-1)' }}>{card.lane}</span>
        <span className="text-[11.5px]" style={{ fontFamily: MONO, fontWeight: 600, color: card.statusInk }}>{card.status}</span>
        <span className="text-[12.5px]" style={{ fontFamily: UI, color: 'var(--text-2)' }}>{card.phase}</span>
      </div>
      {card.note ? <div className="text-[12px] leading-[18px] mb-2 break-words" style={{ fontFamily: UI, color: 'var(--text-3)' }}>{card.note}</div> : null}
      <div className="flex items-center gap-2 mt-2">
        <span className="flex-1 min-w-0">
          <Meter value={card.meter} label={`${card.lane} burn`} />
        </span>
        <span className="text-[11.5px] shrink-0 tnum" style={{ fontFamily: MONO, fontWeight: 600, color: 'var(--text-2)' }}>{card.distance}</span>
      </div>
      <div className="text-[12px] mt-1 mb-3" style={{ fontFamily: UI, color: 'var(--text-3)' }}>{card.burn}</div>
      {card.hasPhases ? (
        <div className="-mx-2">
          {card.phases.map((p) => (
            <div key={p.key} className="grid grid-cols-[30px_minmax(0,1fr)] items-baseline gap-2 px-2 py-[5px] text-[12.5px]" style={{ borderTop: '1px solid var(--line-1)' }}>
              <span className="tnum" style={{ fontFamily: MONO, color: 'var(--text-3)' }}>{p.label}</span>
              <span className="min-w-0 truncate" style={{ fontFamily: UI, color: 'var(--text-2)' }}>{p.title}</span>
            </div>
          ))}
        </div>
      ) : null}
      {card.phasesNote ? <div className="text-[11.5px] mt-2" style={{ fontFamily: UI, color: 'var(--text-3)' }}>{card.phasesNote}</div> : null}
    </div>
  )
}

/** A room's trail: the receipts of the kinds it homes, each opening its receipt. */
export function Trail({ rows, empty, onReceipt }: { rows: EventRowView[]; empty: string; onReceipt: (id: string) => void }) {
  if (rows.length === 0) return <p className="text-[12.5px] leading-[19px] py-2" style={{ fontFamily: UI, color: 'var(--text-3)' }}>{empty}</p>
  return (
    <div className="-mx-2">
      {rows.map((row) => (
        <EventRow key={row.id} row={row} onReceipt={onReceipt} />
      ))}
    </div>
  )
}

export type SourceFileView = {
  id: string
  isReading: boolean
  isRefused: boolean
  isRead: boolean
  refusal: { code: string; human: string }
  path: string
  sha: string
  size: string
}

/**
 * The allow-listed file a room's tables will be parsed from, as the door served it: its path, hash and
 * size. Provenance only -- the table itself is NOT SERVED until its route exists (ADR-1324).
 */
export function SourceFile({ file }: { file: SourceFileView }) {
  if (file.isReading) return <Reading what={`the ${file.id} file`} />
  if (file.isRefused) return <DoorRefusal code={file.refusal.code} human={file.refusal.human} />
  return (
    <div data-source-file={file.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 py-[6px]" style={{ borderTop: '1px solid var(--line-1)' }}>
      <span className="text-[12.5px] truncate" style={{ fontFamily: MONO, color: 'var(--text-1)' }}>{file.path}</span>
      <span className="text-[11.5px] tnum" style={{ fontFamily: MONO, color: 'var(--text-3)' }}>{file.size}</span>
      <span className="col-span-2 text-[11px] truncate" style={{ fontFamily: MONO, color: 'var(--text-3)' }}>{file.sha}</span>
    </div>
  )
}

export type RunRowView = { key: string; name: string; runs: string; last: string; when: string; detail: string }

/** Runs grouped by what ran: the name, how many, how the last one ended and when. */
export function RunRows({ rows, empty, isEmpty }: { rows: RunRowView[]; empty: string; isEmpty: boolean }) {
  if (isEmpty) return <p className="text-[12.5px] leading-[19px] py-2" style={{ fontFamily: UI, color: 'var(--text-3)' }}>{empty}</p>
  return (
    <div className="-mx-2">
      {rows.map((r) => (
        <div key={r.key} data-run-group={r.key} className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 px-2 py-[8px] transition-colors duration-200 hover:bg-(--bg-3)" style={{ borderBottom: '1px solid var(--line-1)', borderRadius: 'var(--r-sm)' }}>
          <span className="text-[12.5px] truncate" style={{ fontFamily: MONO, fontWeight: 600, color: 'var(--text-1)' }}>{r.name}</span>
          <span className="text-[11.5px] tnum" style={{ fontFamily: MONO, color: 'var(--text-3)' }}>{r.when}</span>
          <span className="text-[12px] min-w-0 truncate" style={{ fontFamily: UI, color: 'var(--text-2)' }}>
            {r.runs} · {r.last}
          </span>
          <span className="text-[11px] truncate max-w-[40ch]" style={{ fontFamily: MONO, color: 'var(--text-3)' }}>{r.detail}</span>
        </div>
      ))}
    </div>
  )
}

/** What the served registry says a room holds, one line per kind of thing. */
export function Holds({ groups, century }: { groups: { key: string; label: string; items: string }[]; century: string }) {
  return (
    <div className="space-y-2.5">
      {groups.map((g) => (
        <div key={g.key} className="min-w-0">
          <div className="text-[11px] uppercase tracking-[0.08em] mb-0.5" style={{ fontFamily: UI, fontWeight: 600, color: 'var(--text-3)' }}>{g.label}</div>
          <div className="text-[12.5px] leading-[19px] break-words" style={{ fontFamily: MONO, color: 'var(--text-2)' }}>{g.items}</div>
        </div>
      ))}
      {century ? (
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-[0.08em] mb-0.5" style={{ fontFamily: UI, fontWeight: 600, color: 'var(--text-3)' }}>its ADR century</div>
          <div className="text-[12.5px] leading-[19px]" style={{ fontFamily: MONO, color: 'var(--text-2)' }}>{century}</div>
        </div>
      ) : null}
    </div>
  )
}

/** A lane room's lane panel: the header card, or the door's refusal of it. */
export function LanePanel({ lane, title = 'The lane', hint = 'its PROGRESS header and phase specs, through the door' }: { lane: LaneRoom['lane']; title?: string; hint?: string }) {
  return (
    <HPanel title={title} hint={hint}>
      {lane.isRefused ? <DoorRefusal code={lane.refusal.code} human={lane.refusal.human} /> : <LaneCard card={lane.card} />}
    </HPanel>
  )
}

/** A lane room's trail panel: the receipts of its homed kinds, each opening its receipt. */
export function TrailPanel({ trail, onReceipt, title = 'The trail' }: { trail: LaneRoom['trail']; onReceipt: (id: string) => void; title?: string }) {
  return (
    <HPanel title={title} hint={trail.hint}>
      {trail.isReading ? <Reading what="the trail" /> : null}
      {trail.isRefused ? <DoorRefusal code={trail.refusal.code} human={trail.refusal.human} /> : null}
      {trail.isDrawn ? <Trail rows={trail.rows} empty={trail.empty} onReceipt={onReceipt} /> : null}
    </HPanel>
  )
}

/** The allow-listed files a room's tables will be parsed from. */
export function SourcesPanel({ sources, title = 'Source on disk', hint }: { sources: SourceFileView[]; title?: string; hint: string }) {
  return (
    <HPanel title={title} hint={hint}>
      {sources.map((s) => (
        <SourceFile key={s.id} file={s} />
      ))}
    </HPanel>
  )
}

/** What the served registry homes in a room. */
export function HoldsPanel({ holds, century }: { holds: LaneRoom['holds']; century: string }) {
  return (
    <HPanel title="What this room holds" hint="from the served registry">
      <Holds groups={holds} century={century} />
    </HPanel>
  )
}
