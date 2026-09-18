// company.tsx -- the company ring's drawing pieces (face v2 Phase 03, company ring). Each takes what a module's fold
// already decided -- a list, a sentence, a boolean -- and draws it; none reads the door or judges a value, the same
// contract as bits.tsx. Colours are tokens: accent for what the owner reads first, the text ladder for the rest; no
// reserved hue is spent here.
import type { ReactNode } from 'react'
import { FONT, MONO, UI } from './kit'

/** One article of the constitution: its id, its name, its text. */
export function ArticleCard({ id, name, text, tier }: { id: string; name: string; text: string; tier: string }) {
  return (
    <div data-article={id} className="px-5 py-4 min-w-0" style={{ background: 'var(--bg-2)', border: '1px solid var(--line-1)', borderRadius: 'var(--r-lg)', boxShadow: 'var(--shadow-card)' }}>
      <div className="flex items-baseline gap-2 mb-2">
        <span className="text-[11.5px]" style={{ fontFamily: MONO, fontWeight: 600, color: 'var(--accent)' }}>{id}</span>
        <span className="text-[12px]" style={{ fontFamily: UI, color: 'var(--text-3)' }}>{tier}</span>
      </div>
      <div className="text-[15px] leading-[20px] mb-1.5 break-words" style={{ fontFamily: UI, fontWeight: 600, color: 'var(--text-1)' }}>{name}</div>
      <p className="text-[13px] leading-[20px] break-words" style={{ fontFamily: UI, color: 'var(--text-2)' }}>{text}</p>
    </div>
  )
}

/** Articles in a two-column list: id, name, then the text. */
export function ArticleList({ items }: { items: { id: string; name: string; text: string }[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
      {items.map((a) => (
        <div key={a.id} data-article={a.id} className="flex gap-3 min-w-0">
          <span className="text-[11.5px] mt-[3px] w-7 shrink-0" style={{ fontFamily: MONO, fontWeight: 600, color: 'var(--accent)' }}>{a.id}</span>
          <div className="min-w-0 text-[13px] leading-[20px] break-words">
            <span style={{ fontFamily: UI, fontWeight: 600, color: 'var(--text-1)' }}>{a.name}.</span>{' '}
            <span style={{ fontFamily: UI, color: 'var(--text-2)' }}>{a.text}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

/** An ordered chain of labels, first one in accent: what outranks what. */
export function Chain({ items, note }: { items: { key: string; label: string; isFirst: boolean; isLast: boolean }[]; note: ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-4 flex-wrap">
      {items.map((c) => (
        <span key={c.key} className="flex items-center gap-2">
          <span className="inline-flex items-center h-[24px] px-2.5 text-[12px]" style={{ fontFamily: UI, fontWeight: 600, borderRadius: 'var(--r-sm)', color: c.isFirst ? 'var(--accent)' : 'var(--text-2)', border: `1px solid ${c.isFirst ? 'rgba(var(--accent-rgb), 0.45)' : 'var(--line-2)'}` }}>
            {c.label}
          </span>
          {c.isLast ? null : <span aria-hidden="true" className="text-[13px]" style={{ color: 'var(--text-3)' }}>›</span>}
        </span>
      ))}
      <span className="text-[12px] ml-1" style={{ fontFamily: UI, color: 'var(--text-3)' }}>{note}</span>
    </div>
  )
}

/** Plain rows, one per item, with a hairline between -- a list a person reads top to bottom. */
export function Rows({ items, empty, isEmpty }: { items: string[]; empty: string; isEmpty: boolean }) {
  if (isEmpty) return <p className="text-[12.5px] leading-[19px] py-2" style={{ fontFamily: UI, color: 'var(--text-3)' }}>{empty}</p>
  return (
    <div className="-mx-2">
      {items.map((t, i) => (
        <div key={`${i}-${t.slice(0, 24)}`} className="grid grid-cols-[10px_1fr] gap-2 px-2 py-[7px] text-[13px] leading-[20px]" style={{ borderBottom: '1px solid var(--line-1)' }}>
          <span aria-hidden="true" style={{ color: 'var(--text-3)' }}>·</span>
          <span className="min-w-0 break-words" style={{ fontFamily: UI, color: 'var(--text-2)' }}>{t}</span>
        </div>
      ))}
    </div>
  )
}

export type ChapterView = { key: string; code: string; title: string; meta: string; body: string[]; hasCode: boolean }

/** One logbook entry, set as a chapter: its cycle code, its title, how and when it closed, then its lines. */
export function Chapter({ c }: { c: ChapterView }) {
  return (
    <article data-chapter={c.key} className="pt-5 pb-6 min-w-0" style={{ borderTop: '1px solid var(--line-1)' }}>
      <div className="flex items-baseline gap-2.5 flex-wrap mb-1">
        {c.hasCode ? <span className="text-[12px]" style={{ fontFamily: MONO, fontWeight: 600, color: 'var(--accent)' }}>{c.code}</span> : null}
        <h2 className="text-[20px] leading-[26px] tracking-[-0.01em] break-words" style={{ fontFamily: FONT, fontWeight: 600, color: 'var(--text-1)' }}>{c.title}</h2>
      </div>
      <div className="text-[11.5px] uppercase tracking-[0.06em] mb-3" style={{ fontFamily: UI, fontWeight: 600, color: 'var(--text-3)' }}>{c.meta}</div>
      <div className="space-y-2 max-w-[72ch]">
        {c.body.map((line, i) => (
          <p key={`${c.key}-${i}`} className="text-[14px] leading-[22px] break-words" style={{ fontFamily: UI, color: 'var(--text-2)' }}>{line}</p>
        ))}
      </div>
    </article>
  )
}

export type BandView = { key: string; band: string; who: string; note: string; title: string; isLane: boolean; canOpen: boolean; room: string }

/** The ADR centuries: the band, the lane that owns it (or what does, when no lane does), and its note. */
export function BandRows({ rows, onOpen }: { rows: BandView[]; onOpen: (room: string) => void }) {
  return (
    <div className="-mx-2">
      {rows.map((b) => (
        <div key={b.key} data-band={b.band} title={b.title} className="grid grid-cols-[92px_minmax(0,1fr)] gap-x-3 px-2 py-[7px] text-[12.5px] leading-[18px]" style={{ borderBottom: '1px solid var(--line-1)' }}>
          <span className="tnum" style={{ fontFamily: MONO, color: 'var(--text-1)' }}>{b.band}</span>
          <span className="min-w-0">
            {b.canOpen ? (
              <button type="button" onClick={() => onOpen(b.room)} className="cursor-pointer underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-(--accent)" style={{ fontFamily: MONO, fontWeight: 600, color: 'var(--accent)' }}>{b.who}</button>
            ) : (
              <span style={{ fontFamily: b.isLane ? MONO : UI, fontWeight: b.isLane ? 600 : 400, color: b.isLane ? 'var(--text-1)' : 'var(--text-2)' }}>{b.who}</span>
            )}
            {b.note ? <span className="block text-[11.5px] leading-[16px] mt-0.5 break-words" style={{ fontFamily: UI, color: 'var(--text-3)' }}>{b.note}</span> : null}
          </span>
        </div>
      ))}
    </div>
  )
}

export type RosterView = { key: string; lane: string; status: string; ink: string; phase: string; cycle: string; line: string; lineInk: string; canOpen: boolean }

/** Lanes as a roster: name, status in its own ink, the phase, the cycle, and the one line it waits on. */
export function Roster({ rows, onOpen }: { rows: RosterView[]; onOpen: (room: string) => void }) {
  return (
    <div className="-mx-2">
      {rows.map((r) => (
        <div key={r.key} data-roster={r.lane} className="px-2 py-[9px] min-w-0" style={{ borderBottom: '1px solid var(--line-1)' }}>
          <div className="flex items-baseline gap-2.5 flex-wrap">
            {r.canOpen ? (
              <button type="button" onClick={() => onOpen(r.lane)} className="text-[13px] cursor-pointer underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-(--accent)" style={{ fontFamily: MONO, fontWeight: 600, color: 'var(--text-1)' }}>{r.lane}</button>
            ) : (
              <span className="text-[13px]" style={{ fontFamily: MONO, fontWeight: 600, color: 'var(--text-1)' }}>{r.lane}</span>
            )}
            <span className="text-[10.5px] uppercase tracking-[0.06em]" style={{ fontFamily: UI, fontWeight: 600, color: r.ink }}>{r.status}</span>
            <span className="text-[12px]" style={{ fontFamily: UI, color: 'var(--text-3)' }}>{r.phase}</span>
          </div>
          <div className="text-[12px] leading-[18px] mt-0.5 break-words" style={{ fontFamily: UI, color: 'var(--text-3)' }}>{r.cycle}</div>
          {r.line ? <div className="text-[12.5px] leading-[18px] mt-1 break-words" style={{ fontFamily: UI, color: r.lineInk }}>{r.line}</div> : null}
        </div>
      ))}
    </div>
  )
}

export type TermView = { key: string; term: string; station: string }

/** One room's words: the room, then each term with its station on the room's line. */
export function TermGroup({ name, room, terms, canOpen, onOpen }: { name: string; room: string; terms: TermView[]; canOpen: boolean; onOpen: (room: string) => void }) {
  return (
    <div data-term-room={room} className="py-3 min-w-0" style={{ borderTop: '1px solid var(--line-1)' }}>
      {canOpen ? (
        <button type="button" onClick={() => onOpen(room)} className="text-[13px] mb-2 cursor-pointer underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-(--accent)" style={{ fontFamily: UI, fontWeight: 600, color: 'var(--text-1)' }}>{name}</button>
      ) : (
        <div className="text-[13px] mb-2" style={{ fontFamily: UI, fontWeight: 600, color: 'var(--text-1)' }}>{name}</div>
      )}
      <div className="flex flex-wrap gap-1.5">
        {terms.map((t) => (
          <span key={t.key} title={t.station} className="inline-flex items-center h-[24px] px-2 text-[12px]" style={{ fontFamily: UI, color: 'var(--text-2)', background: 'var(--bg-3)', border: '1px solid var(--line-1)', borderRadius: 'var(--r-sm)' }}>
            {t.term}
            <span className="ml-1.5 text-[10.5px]" style={{ fontFamily: MONO, color: 'var(--text-3)' }}>{t.station}</span>
          </span>
        ))}
      </div>
    </div>
  )
}

export type HitView = { key: string; term: string; roomName: string; room: string; station: string; canOpen: boolean }

/** Search hits: the term, then the room and station it lives at -- the room opens when it can. */
export function Hits({ hits, empty, isEmpty, onOpen }: { hits: HitView[]; empty: string; isEmpty: boolean; onOpen: (room: string) => void }) {
  if (isEmpty) return <p className="text-[12.5px] leading-[19px] py-2" style={{ fontFamily: UI, color: 'var(--text-3)' }}>{empty}</p>
  return (
    <div className="-mx-2">
      {hits.map((h) => (
        <div key={h.key} data-hit={h.term} className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 px-2 py-[7px]" style={{ borderBottom: '1px solid var(--line-1)' }}>
          <span className="text-[13px] truncate" style={{ fontFamily: UI, fontWeight: 600, color: 'var(--text-1)' }}>{h.term}</span>
          {h.canOpen ? (
            <button type="button" onClick={() => onOpen(h.room)} className="text-[12px] cursor-pointer underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-(--accent)" style={{ fontFamily: UI, color: 'var(--accent)' }}>{h.roomName}</button>
          ) : (
            <span className="text-[12px]" style={{ fontFamily: UI, color: 'var(--text-3)' }}>{h.roomName}</span>
          )}
          <span className="col-span-2 text-[11px]" style={{ fontFamily: MONO, color: 'var(--text-3)' }}>{h.station}</span>
        </div>
      ))}
    </div>
  )
}

export type CycleView = { key: string; code: string; name: string; dates: string; result: string; burn: string; hasCode: boolean }

/** The logbook's glance table as rows: the cycle's code and name, its dates and burn, then how it ended. */
export function CycleRows({ rows, empty, isEmpty }: { rows: CycleView[]; empty: string; isEmpty: boolean }) {
  if (isEmpty) return <p className="text-[12.5px] leading-[19px] py-2" style={{ fontFamily: UI, color: 'var(--text-3)' }}>{empty}</p>
  return (
    <div className="-mx-2">
      {rows.map((c) => (
        <div key={c.key} data-cycle={c.code} className="px-2 py-[8px] min-w-0" style={{ borderBottom: '1px solid var(--line-1)' }}>
          <div className="flex items-baseline gap-2 flex-wrap">
            {c.hasCode ? <span className="text-[11.5px]" style={{ fontFamily: MONO, fontWeight: 600, color: 'var(--accent)' }}>{c.code}</span> : null}
            <span className="text-[13px] break-words" style={{ fontFamily: UI, fontWeight: 600, color: 'var(--text-1)' }}>{c.name}</span>
          </div>
          <div className="text-[11.5px] leading-[16px] mt-0.5 break-words" style={{ fontFamily: MONO, color: 'var(--text-3)' }}>{c.dates} · {c.burn}</div>
          <div className="text-[12px] leading-[18px] mt-1 break-words" style={{ fontFamily: UI, color: 'var(--text-2)' }}>{c.result}</div>
        </div>
      ))}
    </div>
  )
}

export type MilestoneView = { key: string; milestone: string; status: string; isDone: boolean; isPending: boolean }

/** The book's milestone tracker: what the company set out to reach, and where each stands, in the book's words. */
export function MilestoneRows({ rows, empty, isEmpty }: { rows: MilestoneView[]; empty: string; isEmpty: boolean }) {
  if (isEmpty) return <p className="text-[12.5px] leading-[19px] py-2" style={{ fontFamily: UI, color: 'var(--text-3)' }}>{empty}</p>
  return (
    <div className="-mx-2">
      {rows.map((m) => (
        <div key={m.key} data-milestone={m.isDone ? 'done' : m.isPending ? 'pending' : 'other'} className="px-2 py-[8px] min-w-0" style={{ borderBottom: '1px solid var(--line-1)' }}>
          <div className="text-[13px] leading-[19px] break-words" style={{ fontFamily: UI, fontWeight: 600, color: m.isDone ? 'var(--text-1)' : 'var(--text-2)' }}>{m.milestone}</div>
          <div className="text-[12px] leading-[18px] mt-0.5 break-words" style={{ fontFamily: UI, color: 'var(--text-3)' }}>{m.status}</div>
        </div>
      ))}
    </div>
  )
}
