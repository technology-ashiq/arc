// orgchart.tsx -- the org room's chart (face v3 P02, FV3-D): Owner -> CEO -> department boxes -> role chips, a
// legend, a filter row and the picked role's card. It draws what the org fold already decided -- every colour, label,
// filter and selected flag arrives precomputed -- and holds no judgement of its own (the same contract as bits.tsx).
// Colours are tokens only; the chip styles themselves are chosen in fold.mjs.
import type { CSSProperties } from 'react'
import { MONO, UI } from './kit'

export type OrgChip = { key: string; id: string; label: string; tag: string; title: string; state: string; pick: string; style: CSSProperties; isHead: boolean; isSelected: boolean }
export type OrgDeptBox = { key: string; dept: string; name: string; counts: string; head: string; isEmpty: boolean; empty: string; chips: OrgChip[] }
export type OrgLegendItem = { key: string; label: string; style: CSSProperties }
export type OrgFilter = { key: string; label: string; value: string; style: CSSProperties; isOn: boolean }
export type OrgCardLine = { key: string; k: string; v: string }
export type OrgCard = { isOpen: boolean; title: string; id: string; tagStyle: CSSProperties; tag: string; lines: OrgCardLine[]; hint: string }
export type OrgChartView = {
  isShown: boolean
  owner: { label: string; sub: string }
  ceo: { label: string; sub: string }
  summary: string
  legend: OrgLegendItem[]
  filters: OrgFilter[]
  depts: OrgDeptBox[]
  card: OrgCard
}

const BOX: CSSProperties = { background: 'var(--bg-2)', border: '1px solid var(--line-2)', borderRadius: 'var(--r-md)' }
const LINE: CSSProperties = { background: 'var(--line-2)' }

function Node({ label, sub, tone }: { label: string; sub: string; tone: CSSProperties }) {
  return (
    <div className="px-4 py-2 text-center min-w-[180px]" style={{ ...BOX, ...tone }}>
      <div className="text-[13.5px] leading-[18px]" style={{ fontFamily: UI, fontWeight: 600, color: 'var(--text-1)' }}>{label}</div>
      <div className="text-[11px] leading-[15px]" style={{ fontFamily: MONO, color: 'var(--text-3)' }}>{sub}</div>
    </div>
  )
}

/** The chart: tree head, legend + filters, department grid, and the picked role's card beside it. */
export function OrgChart({ chart, onPick }: { chart: OrgChartView; onPick: (key: string, value: string) => void }) {
  return (
    <div data-org-chart="" className="min-w-0">
      <div className="flex flex-col items-center">
        <Node label={chart.owner.label} sub={chart.owner.sub} tone={{ borderColor: 'rgba(var(--violet-rgb), 0.55)' }} />
        <div className="w-px h-3" style={LINE} />
        <Node label={chart.ceo.label} sub={chart.ceo.sub} tone={{ borderColor: 'var(--accent-line)' }} />
        <div className="w-px h-3" style={LINE} />
      </div>
      <div className="h-px mb-3" style={LINE} />

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-3">
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter roles">
          {chart.filters.map((x) => (
            <button key={x.key} type="button" data-org-filter={x.value} aria-pressed={x.isOn} onClick={() => onPick('orgFilter', x.value)} className="h-[24px] px-2.5 text-[12px] cursor-pointer" style={{ fontFamily: UI, fontWeight: 600, borderRadius: 'var(--radius-pill)', ...x.style }}>{x.label}</button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {chart.legend.map((l) => (
            <span key={l.key} className="inline-flex items-center gap-1.5 text-[11.5px]" style={{ fontFamily: UI, color: 'var(--text-2)' }}>
              <span className="inline-block w-[14px] h-[10px]" style={{ borderRadius: 'var(--r-sm)', ...l.style }} />
              {l.label}
            </span>
          ))}
        </div>
        <span className="text-[11.5px]" style={{ fontFamily: MONO, color: 'var(--text-3)' }}>{chart.summary}</span>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_300px] gap-4 items-start">
        <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(220px,1fr))] min-w-0">
          {chart.depts.map((d) => (
            <div key={d.key} data-org-dept={d.dept} className="px-3 py-2.5 min-w-0" style={BOX}>
              <div className="text-[12.5px] leading-[17px] break-words" style={{ fontFamily: UI, fontWeight: 600, color: 'var(--text-1)' }}>{d.name}</div>
              <div className="text-[11px] leading-[15px] mb-1" style={{ fontFamily: MONO, color: 'var(--text-3)' }}>{d.counts}</div>
              <div className="text-[11px] leading-[15px] mb-2 break-words" style={{ fontFamily: UI, color: 'var(--text-2)' }}>{d.head}</div>
              {d.isEmpty ? <p className="text-[11.5px]" style={{ fontFamily: UI, color: 'var(--text-3)' }}>{d.empty}</p> : null}
              <div className="flex flex-wrap gap-1">
                {d.chips.map((c) => (
                  <button key={c.key} type="button" data-org-chip={c.id} data-state={c.state} data-head={c.isHead} aria-pressed={c.isSelected} title={c.title} onClick={() => onPick('role', c.pick)} className="inline-flex items-center gap-1 max-w-full px-1.5 py-[2px] text-[11px] leading-[15px] text-left cursor-pointer" style={{ fontFamily: UI, borderRadius: 'var(--r-sm)', ...c.style }}>
                    <span className="min-w-0 break-words">{c.label}</span>
                    <span className="text-[9.5px] opacity-70" style={{ fontFamily: MONO }}>{c.tag}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="xl:sticky xl:top-3 min-w-0">
          {chart.card.isOpen ? (
            <div data-org-card={chart.card.id} className="px-4 py-3" style={{ ...BOX, borderColor: 'var(--accent-line)', boxShadow: 'var(--shadow-card)' }}>
              <div className="flex items-start justify-between gap-2 mb-1">
                <div className="min-w-0">
                  <div className="text-[14px] leading-[19px] break-words" style={{ fontFamily: UI, fontWeight: 600, color: 'var(--text-1)' }}>{chart.card.title}</div>
                  <div className="text-[11px]" style={{ fontFamily: MONO, color: 'var(--text-3)' }}>{chart.card.id}</div>
                </div>
                <button type="button" data-org-card-close="" onClick={() => onPick('role', '')} className="text-[11.5px] px-2 h-[22px] cursor-pointer" style={{ fontFamily: UI, color: 'var(--text-2)', border: '1px solid var(--line-2)', borderRadius: 'var(--r-sm)' }}>close</button>
              </div>
              <span className="inline-block text-[10.5px] px-1.5 py-[1px] mb-2" style={{ fontFamily: MONO, borderRadius: 'var(--r-sm)', ...chart.card.tagStyle }}>{chart.card.tag}</span>
              {chart.card.lines.map((l) => (
                <div key={l.key} className="py-[5px] text-[12px] leading-[17px]" style={{ borderTop: '1px solid var(--line-1)' }}>
                  <div className="text-[10.5px] uppercase tracking-wide" style={{ fontFamily: UI, fontWeight: 600, color: 'var(--text-3)' }}>{l.k}</div>
                  <div className="break-words" style={{ fontFamily: MONO, color: 'var(--text-2)' }}>{l.v}</div>
                </div>
              ))}
            </div>
          ) : (
            <p className="px-4 py-3 text-[12px] leading-[18px]" style={{ ...BOX, fontFamily: UI, color: 'var(--text-3)', borderStyle: 'dashed' }}>{chart.card.hint}</p>
          )}
        </div>
      </div>
    </div>
  )
}
