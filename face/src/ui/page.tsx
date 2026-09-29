// page.tsx -- the kit parts of page shape v1 (ADR-1348): the owner's arc-wiki-engine_1.html, drawn on face tokens.
// Every part renders what it is handed and decides nothing -- the Reference fold chose the content, and
// lib/diagram.mjs computed every coordinate a figure has. Colours are tokens only (face-colour-literal).
import { useId, type ReactNode } from 'react'
import type { Geometry } from '../lib/diagram.mjs'
import { MONO, UI } from './kit'

const soft = (token: string, pct: number) => `color-mix(in srgb, var(${token}) ${pct}%, transparent)`

/** The masthead: crumb, name + version, the one-line tagline, and the chips the extract holds. */
export function PageMast({ crumb, name, version, tagline, chips, action }: {
  crumb: string; name: string; version?: string; tagline?: ReactNode; chips: { k: string; v: string }[]; action?: ReactNode
}) {
  return (
    <header className="mb-6 pb-5" style={{ borderBottom: '1px solid var(--line-1)' }}>
      <div className="text-[11.5px] uppercase mb-2.5" style={{ fontFamily: MONO, color: 'var(--text-3)', letterSpacing: '.06em' }}>
        {crumb}<b style={{ color: 'var(--accent)', fontWeight: 600 }}>{name}</b>
      </div>
      <h1 className="flex flex-wrap items-baseline gap-3 m-0 text-[32px] leading-tight" style={{ fontFamily: UI, fontWeight: 650, letterSpacing: '-.02em', color: 'var(--text-1)' }}>
        {name}
        {version && <span className="text-[13px] px-[7px] py-[2px] rounded-[5px]" style={{ fontFamily: MONO, fontWeight: 400, color: 'var(--text-3)', border: '1px solid var(--line-2)' }}>v{version}</span>}
      </h1>
      {tagline && <p className="mt-3 mb-0 text-[17px] leading-relaxed max-w-[64ch]" style={{ fontFamily: UI, color: 'var(--text-2)' }}>{tagline}</p>}
      <div className="mt-4 flex flex-wrap items-center gap-2 text-[11.5px]" style={{ fontFamily: MONO }}>
        {chips.map((c) => (
          <span key={c.k} className="rounded-full px-2.5 py-[3px]" style={{ border: '1px solid var(--line-2)', color: 'var(--text-2)' }}>
            {c.k} <b style={{ color: 'var(--text-1)', fontWeight: 600 }}>{c.v}</b>
          </span>
        ))}
        {action}
      </div>
    </header>
  )
}

/** The left nav. A click scrolls to its section; it never touches the location hash, which carries the room's pick. */
export function PageNav({ groups }: { groups: { title: string; items: { id: string; label: string }[] }[] }) {
  const go = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  return (
    <nav aria-label="On this page" className="xl:sticky xl:top-4 self-start pb-4 xl:max-h-[calc(100vh-2rem)] xl:overflow-auto">
      {groups.map((g) => (
        <div key={g.title} className="mb-4">
          <p className="text-[10.5px] uppercase mb-2" style={{ fontFamily: MONO, letterSpacing: '.1em', color: 'var(--text-3)' }}>{g.title}</p>
          {g.items.map((it) => (
            <button key={it.id} type="button" onClick={() => go(it.id)}
              className="block w-full text-left text-[13.5px] leading-snug py-[5px] pl-[11px] cursor-pointer hover:text-(--accent) hover:border-(--accent)"
              style={{ fontFamily: UI, color: 'var(--text-2)', borderLeft: '2px solid var(--line-1)' }}>
              {it.label}
            </button>
          ))}
        </div>
      ))}
    </nav>
  )
}

/** A group label (START HERE, REFERENCE ...) -- small mono caps, like the reference's h2. */
export function GroupLabel({ children }: { children: ReactNode }) {
  return <h2 className="text-[11.5px] uppercase m-0 mb-2" style={{ fontFamily: MONO, letterSpacing: '.13em', color: 'var(--text-3)', fontWeight: 600 }}>{children}</h2>
}

/** Where a section's words came from: hand-written (narrative) or rebuilt from source (generated). */
export function ProvPill({ generated }: { generated: boolean }) {
  const token = generated ? '--blue' : '--amber'
  return (
    <span className="inline-flex align-middle ml-2 text-[10px] uppercase rounded-[5px] px-2 py-[2.5px] whitespace-nowrap"
      style={{ fontFamily: MONO, letterSpacing: '.07em', fontWeight: 600, background: soft(token, 16), color: `var(${token})` }}>
      {generated ? 'generated' : 'narrative'}
    </span>
  )
}

/** A section: its title, its pill, and its blocks. `id` is what the nav scrolls to. */
export function PageSection({ id, title, generated, children }: { id: string; title?: ReactNode; generated: boolean; children: ReactNode }) {
  return (
    <section id={id} className="mb-12 scroll-mt-4 min-w-0">
      {title && (
        <h3 className="text-[23px] leading-snug m-0 mb-2" style={{ fontFamily: UI, fontWeight: 630, letterSpacing: '-.015em', color: 'var(--text-1)' }}>
          {title}<ProvPill generated={generated} />
        </h3>
      )}
      {children}
    </section>
  )
}

/** "In one line": the plain-words sentence a section opens with. */
export function Lede({ children }: { children: ReactNode }) {
  return (
    <div className="my-3.5 mb-4 pl-4 max-w-[70ch]" style={{ borderLeft: '3px solid var(--accent)' }}>
      <span className="block text-[10px] uppercase mb-1" style={{ fontFamily: MONO, letterSpacing: '.12em', color: 'var(--text-3)', fontWeight: 600 }}>In one line</span>
      <p className="m-0 text-[17px] leading-normal" style={{ fontFamily: UI, color: 'var(--text-1)' }}>{children}</p>
    </div>
  )
}

/** A panel: plain, big (larger text) or warn (the live-position box). */
export function PagePanel({ title, warn, big, children }: { title?: string; warn: boolean; big: boolean; children: ReactNode }) {
  return (
    <div className={`rounded-[11px] px-5 py-[18px] mb-4 ${big ? 'text-[16.5px]' : ''}`}
      style={{ background: warn ? soft('--red', 10) : 'var(--bg-1)', border: `1px solid ${warn ? 'var(--red)' : 'var(--line-1)'}` }}>
      {title && <p className="text-[11px] uppercase mt-0 mb-2.5" style={{ fontFamily: MONO, letterSpacing: '.09em', fontWeight: 600, color: warn ? 'var(--red)' : 'var(--text-3)' }}>{title}</p>}
      {children}
    </div>
  )
}

/** The numbered step pipeline: what a stage does in plain words, then what happens in the code, then where. */
export function StepPipe({ steps }: { steps: { n: string; t: ReactNode; plain?: ReactNode; d?: ReactNode; f?: ReactNode }[] }) {
  return (
    <div className="rounded-[11px] overflow-hidden mb-4" style={{ border: '1px solid var(--line-1)', background: 'var(--bg-1)' }}>
      {steps.map((s) => (
        <div key={s.n} className="grid" style={{ gridTemplateColumns: '54px minmax(0,1fr)', borderBottom: '1px solid var(--line-1)' }}>
          <div className="text-[12px] text-center pt-4" style={{ fontFamily: MONO, fontWeight: 600, color: 'var(--text-3)', background: 'var(--bg-2)', borderRight: '1px solid var(--line-1)' }}>{s.n}</div>
          <div className="px-5 py-[15px] min-w-0">
            <div className="text-[15px] mb-1.5" style={{ fontFamily: UI, fontWeight: 630, color: 'var(--text-1)' }}>{s.t}</div>
            {s.plain && <p className="text-[14.5px] m-0 mb-2" style={{ fontFamily: UI, color: 'var(--text-1)' }}>{s.plain}</p>}
            {s.d && <p className="text-[13.5px] m-0" style={{ fontFamily: UI, color: 'var(--text-2)' }}>{s.d}</p>}
            {s.f && <p className="text-[11.5px] mt-2 mb-0" style={{ fontFamily: MONO, color: 'var(--text-3)' }}>{s.f}</p>}
          </div>
        </div>
      ))}
    </div>
  )
}

/** A figure: the diagram lib/diagram.mjs laid out, mapped one-to-one onto svg elements, and its caption. */
export function Figure({ g }: { g: Geometry }) {
  const uid = useId().replace(/[^A-Za-z0-9_-]/g, '')
  const head = { ink: `url(#${uid}-ink)`, warn: `url(#${uid}-warn)`, none: undefined }
  return (
    <figure className="m-0 mb-5 rounded-[11px] px-[18px] pt-5 pb-3.5" style={{ background: 'var(--bg-1)', border: '1px solid var(--line-1)' }}>
      <svg viewBox={`0 0 ${g.w} ${g.h}`} role="img" aria-label={`${g.caption.title} ${g.caption.rest}`} className="block max-w-full h-auto mx-auto" style={{ color: 'var(--text-2)' }}>
        <defs>
          <marker id={`${uid}-ink`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill="var(--text-2)" />
          </marker>
          <marker id={`${uid}-warn`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill="var(--red)" />
          </marker>
        </defs>
        {g.divider && <line x1={g.divider.x} y1={g.divider.y1} x2={g.divider.x} y2={g.divider.y2} stroke="var(--red)" strokeWidth={1.2} strokeDasharray="5 4" opacity={0.8} />}
        {g.arrows.map((a) => (
          <path key={a.key} d={a.d} fill="none" stroke={a.stroke} strokeWidth={1.4} strokeDasharray={a.dash || undefined} markerEnd={head[a.head]} />
        ))}
        {g.boxes.map((b) => (
          <g key={b.key}>
            <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={b.rx} fill={b.fill} stroke={b.stroke} strokeWidth={b.strokeWidth} strokeDasharray={b.dash || undefined} />
            {b.lines.map((l) => (
              <text key={l.key} x={l.x} y={l.y} textAnchor="middle" fontSize={l.size} fontWeight={l.weight} fill={l.fill} style={{ fontFamily: l.mono ? MONO : UI }}>{l.text}</text>
            ))}
          </g>
        ))}
        {g.labels.map((l) => (
          <text key={l.key} x={l.x} y={l.y} textAnchor={l.anchor} fontSize={l.size} fontWeight={l.weight} fill={l.fill} style={{ fontFamily: l.mono ? MONO : UI }}>{l.text}</text>
        ))}
      </svg>
      {(g.caption.title || g.caption.rest) && (
        <figcaption className="text-[13px] mt-3.5 text-center mx-auto max-w-[68ch] leading-normal" style={{ fontFamily: UI, color: 'var(--text-3)' }}>
          <b style={{ color: 'var(--text-2)' }}>{g.caption.title}</b> {g.caption.rest}
        </figcaption>
      )}
    </figure>
  )
}

/** A table in the reference's frame: mono caps head, hairline rows; `rosetta` styles the arc-word column. */
export function PageTable({ head, rows, rosetta = false }: { head: ReactNode[]; rows: ReactNode[][]; rosetta?: boolean }) {
  return (
    <div className="overflow-x-auto mb-4 rounded-[11px]" style={{ border: '1px solid var(--line-1)', background: 'var(--bg-1)' }}>
      <table className="w-full border-collapse text-[13.5px]" style={{ fontFamily: UI }}>
        <thead>
          <tr>{head.map((h, i) => (
            <th key={i} className="text-left text-[10.5px] uppercase px-[15px] py-[11px] whitespace-nowrap" style={{ fontFamily: MONO, letterSpacing: '.08em', fontWeight: 600, color: 'var(--text-3)', borderBottom: '1px solid var(--line-2)' }}>{h}</th>
          ))}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>{r.map((c, j) => (
              <td key={j} className="align-top px-[15px] py-[11px]" style={{
                borderBottom: '1px solid var(--line-1)',
                color: rosetta && j === 0 ? 'var(--accent)' : rosetta && j === 1 ? 'var(--text-1)' : 'var(--text-2)',
                fontFamily: rosetta && j === 0 ? MONO : UI,
                fontWeight: rosetta && j === 1 ? 550 : undefined,
                whiteSpace: rosetta && j === 0 ? 'nowrap' : undefined,
              }}>{c}</td>
            ))}</tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Stat boxes: one big mono value and a small label each. */
export function StatGrid({ stats }: { stats: { value: string; label: string }[] }) {
  return (
    <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
      {stats.map((s) => (
        <div key={s.label} className="rounded-[11px] px-[17px] py-[15px]" style={{ background: 'var(--bg-1)', border: '1px solid var(--line-1)' }}>
          <div className="text-[25px] leading-tight break-words" style={{ fontFamily: MONO, fontWeight: 650, color: 'var(--text-1)' }}>{s.value}</div>
          <div className="text-[12px] mt-1" style={{ fontFamily: UI, color: 'var(--text-3)' }}>{s.label}</div>
        </div>
      ))}
    </div>
  )
}

/** The glossary: a term in accent mono, its meaning under it. */
export function Gloss({ items }: { items: { term: string; def: ReactNode }[] }) {
  return (
    <dl className="m-0 mb-4 rounded-[11px] px-5 pt-1.5 pb-4" style={{ background: 'var(--bg-1)', border: '1px solid var(--line-1)' }}>
      {items.map((it) => (
        <div key={it.term}>
          <dt className="text-[13px] mt-4" style={{ fontFamily: MONO, color: 'var(--accent)', fontWeight: 600 }}>{it.term}</dt>
          <dd className="m-0 mt-1 text-[14px] max-w-[70ch]" style={{ fontFamily: UI, color: 'var(--text-2)' }}>{it.def}</dd>
        </div>
      ))}
    </dl>
  )
}

/** A block the fold could not read: its source and the reason, so the author sees the typo on the page. */
export function BadBlock({ why, source }: { why: string; source: string }) {
  return (
    <div className="rounded-[11px] px-4 py-3 mb-4" style={{ border: '1px dashed var(--red)', background: soft('--red', 8) }}>
      <p className="text-[12.5px] m-0 mb-2" style={{ fontFamily: UI, color: 'var(--red)' }}>{why}</p>
      <pre className="text-[12px] m-0 overflow-x-auto" style={{ fontFamily: MONO, color: 'var(--text-2)' }}>{source}</pre>
    </div>
  )
}
