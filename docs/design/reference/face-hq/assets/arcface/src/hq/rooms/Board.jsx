// BOARD — "Every lane, its phase, and what it is burning."
// The portfolio view: appetite spent against appetite bought, and how far
// each lane is from its own kill line. Absorbs the old portfolio room —
// the idea → money pipeline and the venture cards stay here, labeled.
import { useState } from 'react'
import { UI, FONT, MONO, COLOR, Btn, Meter, Chip, SimBadge, YoursBadge, StatusDot, PickRow, tint } from '../../ui/kit.jsx'
import { RoomHead, HPanel, KpiStrip } from '../bits.jsx'
import { pipeline, portfolio } from '../../spine/derive.js'
import { boardRows, orgCounts } from '../../spine/registries.js'
import { useSpine } from '../useSpine.js'
import { uiBus } from '../../lib/uiBus.js'
import { RING_ORDER, roomMeta } from '../roomRegistry.js'

const STATUS_C = { awake: COLOR.cyan, idle: 'var(--text-3)', blocked: COLOR.amber }
const burnTone = (b) => (b == null ? 'blue' : b >= 1 ? 'critical' : b >= 0.8 ? 'warn' : 'blue')
const SORTS = [
  { value: 'ring', label: 'sort · ring' },
  { value: 'burn', label: 'sort · burn' },
  { value: 'status', label: 'sort · status' },
]
// one column template for the header row and every lane row
const COLS = 'md:grid-cols-[120px_80px_minmax(0,1fr)_128px_128px_120px]'

export default function Board() {
  useSpine()
  const [sort, setSort] = useState('ring')
  const rows = boardRows()
  const counts = orgCounts()
  const pipe = pipeline()
  const folio = portfolio()
  const bought = rows.reduce((s, r) => s + (r.bought || 0), 0)
  const spent = rows.reduce((s, r) => s + (r.spent || 0), 0)
  const over = rows.filter((r) => r.burn != null && r.burn >= 1)
  const sorted = rows.slice().sort((a, b) => (sort === 'burn' ? (b.burn ?? -1) - (a.burn ?? -1) : sort === 'status' ? a.status.localeCompare(b.status) : RING_ORDER.indexOf(a.ring) - RING_ORDER.indexOf(b.ring) || a.lane.localeCompare(b.lane)))
  const companyBurn = bought ? spent / bought : null

  return (
    <>
      <RoomHead
        title="Every lane, its phase, and what it is burning."
        hint="Appetite spent against appetite bought, and how far each lane is from its own kill line. Derived from PROGRESS.md headers and your lane events."
        right={<YoursBadge>board · {rows.length} lanes · statuses persisted</YoursBadge>}
      />

      {/* the instrument strip — one row of figures */}
      <KpiStrip
        items={[
          { v: rows.length, l: 'Lanes on the board' },
          { v: counts.awake, l: 'Awake' },
          { v: counts.blocked, l: 'Blocked', sub: 'needs a decision', tone: counts.blocked ? 'amber' : undefined },
          { v: `${spent.toFixed(1)}d / ${bought.toFixed(1)}d`, l: 'Appetite spent / bought' },
          { v: companyBurn == null ? 'not stated' : Math.round(companyBurn * 100) + '%', l: 'Company burn', tone: companyBurn != null && companyBurn >= 1 ? 'red' : companyBurn != null && companyBurn >= 0.8 ? 'amber' : undefined },
          { v: over.length, l: 'Lanes over appetite', tone: over.length ? 'red' : undefined },
        ]}
      />

      <HPanel
        title="Lanes"
        hint="appetite bought vs spent · at 100% burn the phase-done gate refuses and the lane stops"
        tone={over.length ? 'amber' : undefined}
        actions={
          <>
            <PickRow small options={SORTS} value={sort} onPick={setSort} />
            <Btn small onClick={() => uiBus.openRoom('org')}>The roster → org</Btn>
          </>
        }
      >
        <div className={`hidden md:grid ${COLS} gap-x-3 px-2 pb-2 text-[11px] uppercase tracking-[0.08em]`} style={{ fontFamily: UI, fontWeight: 600, color: 'var(--text-3)', borderBottom: '1px solid var(--line-1)' }}>
          <span>lane</span>
          <span>status</span>
          <span>phase · what it is waiting on</span>
          <span className="text-right">appetite</span>
          <span>burn</span>
          <span className="text-right">kill distance</span>
        </div>
        {sorted.map((r) => {
          const rm = roomMeta(r.room)
          const burnC = r.burn == null ? 'var(--text-3)' : r.burn >= 1 ? COLOR.red : r.burn >= 0.8 ? COLOR.amber : 'var(--text-2)'
          return (
            <div key={r.lane} className={`grid grid-cols-1 ${COLS} gap-x-3 gap-y-1 items-center px-2 py-2.5 transition-colors duration-200 hover:bg-(--bg-3)`} style={{ borderBottom: '1px solid var(--line-1)', borderRadius: 'var(--r-sm)' }}>
              <button type="button" onClick={() => uiBus.openRoom(r.room)} className="text-left cursor-pointer flex items-center gap-2 min-w-0" title={rm ? `open ${rm.name}` : ''}>
                <StatusDot state={r.status === 'awake' ? 'awake' : r.status === 'blocked' ? 'building' : 'sleeping'} />
                <span className="text-[12.5px] truncate" style={{ fontFamily: MONO, fontWeight: 600, color: 'var(--text-1)' }}>{r.lane}</span>
              </button>
              <span className="text-[12px]" style={{ fontFamily: UI, fontWeight: 500, color: STATUS_C[r.status] || 'var(--text-2)' }}>{r.status}</span>
              <span className="min-w-0 text-[13px] leading-[18px]" style={{ fontFamily: UI }}>
                <span className="break-words" style={{ color: 'var(--text-1)' }}>{r.phase || r.cycle || '—'}</span>
                {r.status === 'blocked' && r.waitingOn && <span className="block text-[12px] break-words" style={{ color: COLOR.amber }}>waiting on: {r.waitingOn}</span>}
                {r.status !== 'blocked' && r.next && <span className="block text-[12px] truncate" style={{ color: 'var(--text-3)' }}>{r.next}</span>}
              </span>
              <span className="text-[12px] tnum md:text-right" style={{ fontFamily: MONO, color: 'var(--text-2)' }}>
                {r.appetite ? `${r.appetite.burn || '?'} / ${r.appetite.value || '?'}` : <span style={{ fontFamily: UI, color: 'var(--text-3)' }}>not stated</span>}
              </span>
              <span className="flex items-center gap-2 min-w-0">
                <span className="flex-1 min-w-0"><Meter value={r.burn == null ? 0 : Math.min(1, r.burn)} tone={burnTone(r.burn)} /></span>
                <span className="text-[11.5px] w-[42px] text-right tnum shrink-0" style={{ fontFamily: MONO, color: burnC }}>{r.burn == null ? '—' : Math.round(r.burn * 100) + '%'}</span>
              </span>
              <span className="text-[12px] tnum md:text-right" style={{ fontFamily: r.killDistance == null ? UI : MONO, fontWeight: r.killDistance === 0 ? 600 : 400, color: r.killDistance == null ? 'var(--text-3)' : r.killDistance === 0 ? COLOR.red : 'var(--text-2)' }}>
                {r.killDistance == null ? 'no appetite stated' : r.killDistance === 0 ? 'AT THE LINE' : `${(r.killDistance * (r.bought || 0)).toFixed(1)}d left`}
              </span>
            </div>
          )
        })}
        <p className="mt-3 text-[12px] leading-[18px]" style={{ fontFamily: UI, color: 'var(--text-3)' }}>
          Appetite is stated in days in <span style={{ fontFamily: MONO }}>PROGRESS.md</span> · a lane with none says so, it is not zero
        </p>
      </HPanel>

      {/* the pipeline — the factory floor, live */}
      <HPanel title="Pipeline" hint="idea → money · counts derive from today's events">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {pipe.map((s, i) => (
            <div key={s.name} className="p-3 min-w-0" style={{ background: 'var(--well)', border: '1px solid var(--line-1)', borderRadius: 'var(--r-md)' }}>
              <div className="text-[12px] mb-1 truncate" style={{ fontFamily: UI, color: 'var(--text-3)' }}>{i + 1} · {s.name}</div>
              <div className="text-[24px] leading-[28px] tracking-[-0.01em]" style={{ fontFamily: FONT, fontWeight: 600, color: 'var(--text-1)' }}>{s.n}</div>
              <div className="text-[11.5px] leading-[16px] mt-0.5 break-words" style={{ fontFamily: UI, color: 'var(--text-2)' }}>{s.note}</div>
            </div>
          ))}
        </div>
      </HPanel>

      {/* venture cards — mixed real facts and simulated projections, labeled per card */}
      <HPanel title="Ventures" hint="kill-distance cards · criteria set at kickoff, in writing" actions={<Btn small onClick={() => uiBus.openRoom('ventures')}>Registry → ventures</Btn>}>
        <div className="mb-3">
          <SimBadge>mixed: repo facts + simulated projections, labeled per card</SimBadge>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {folio.map((v) => {
            const noteC = v.tone === 'critical' ? COLOR.red : v.tone === 'warn' ? COLOR.amber : COLOR.green
            return (
              <div key={v.id} className="p-4 min-w-0" style={{ background: 'var(--well)', border: '1px solid ' + (v.tone === 'critical' ? tint('red', 0.4) : 'var(--line-1)'), borderRadius: 'var(--r-md)' }}>
                <div className="flex items-center gap-2 mb-2 min-w-0">
                  <StatusDot state={v.tone === 'critical' ? 'sleeping' : v.real ? 'live' : 'building'} />
                  <b className="text-[14px] truncate" style={{ fontFamily: UI, fontWeight: 600, color: 'var(--text-1)' }}>{v.name}</b>
                  <span className="ml-auto shrink-0"><Chip>{v.stage}</Chip></span>
                </div>
                <div className="text-[22px] leading-[26px] tracking-[-0.01em] truncate" style={{ fontFamily: FONT, fontWeight: 600, color: v.tone === 'critical' ? COLOR.red : 'var(--text-1)' }}>{v.big}</div>
                <div className="text-[12px] mb-3 truncate" style={{ fontFamily: UI, color: 'var(--text-2)' }}>{v.sub}</div>
                <Meter value={v.meter} tone={v.tone} />
                <div className="mt-2 flex items-center gap-1.5 text-[12px] leading-[18px]" style={{ fontFamily: UI, color: 'var(--text-2)' }}>
                  <span aria-hidden="true" className="w-[6px] h-[6px] rounded-full shrink-0" style={{ background: noteC }} />
                  <span className="min-w-0 break-words">{v.note}</span>
                </div>
              </div>
            )
          })}
        </div>
      </HPanel>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <HPanel title="1 in 4" hint="the base rate, planned for">
          <p className="text-[13px] leading-[20px]" style={{ fontFamily: UI, color: 'var(--text-2)' }}>One in four ventures is expected to live — written before the first launch, so a death is a data point, not a surprise. Kill-distance meters exist because the criteria were set at kickoff, in writing.</p>
        </HPanel>
        <HPanel title="Appetite is the kill line">
          <p className="text-[13px] leading-[20px]" style={{ fontFamily: UI, color: 'var(--text-2)' }}>A lane buys its appetite at kickoff in days. Burn is spent against bought; at the line the phase-done gate refuses and the lane stops — extending is a new decision, recorded, never a quiet edit of the number.</p>
        </HPanel>
        <HPanel title="Kill honestly" hint="constitution A10">
          <p className="text-[13px] leading-[20px]" style={{ fontFamily: UI, color: 'var(--text-2)' }}>Fail the written criteria → attic'd with a retro, components harvested, the lesson pinned. Never deleted. The kill review lands in the inbox with its three facts on the card.</p>
        </HPanel>
      </div>
    </>
  )
}
