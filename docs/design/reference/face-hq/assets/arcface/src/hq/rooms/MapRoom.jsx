// MAP — "If it is not on this map, it is not in the company."
// Every room a station, every lane a line. A station is LIVE when a
// receipt homed there fired today, UNEXERCISED (dashed) when nothing
// ever did, PLANNED (dotted) when the lane is not born, INDEX when the
// room only points at others. In-flight dots move on receipt — the map
// is a derived view over the log like every other room, and clicking
// a station opens it.
import { useEffect, useMemo, useRef, useState } from 'react'
import { Crosshair } from '@phosphor-icons/react'
import { UI, FONT, MONO, COLOR, Chip, SimBadge, YoursBadge } from '../../ui/kit.jsx'
import { RoomHead, HPanel, KpiStrip, Empty } from '../bits.jsx'
import { spine } from '../../spine/store.js'
import { useSpine } from '../useSpine.js'
import { uiBus } from '../../lib/uiBus.js'
import { ROOM_META, RING_ORDER, LANE_ROOM, resolveRoom } from '../roomRegistry.js'

// index rooms render other rooms' receipts and home none of their own
const INDEX_ROOMS = new Set(['overview', 'spine', 'map', 'toolbelt', 'concepts', 'story', 'board', 'org'])
// event.module → the station that homes it (modules that are not room ids)
const MODULE_HOME = { hq: 'inbox', plan: 'develop', review: 'review-ship', qa: 'review-ship', git: 'review-ship', ship: 'review-ship', deploy: 'review-ship', canary: 'ops', support: 'ops', content: 'growth', outreach: 'leads', trade: 'trader', ideas: 'discover', idea: 'discover', constitution: 'law', retro: 'memory', learn: 'learn', ledger: 'money', money: 'money', revenue: 'money', design: 'design-studio', council: 'council', spine: 'spine', session: 'spine' }
const homeOf = (e) => resolveRoom(e.module) || MODULE_HOME[e.module] || null

const RING_COLOR = { command: COLOR.cyan, kernel: COLOR.blue, factory: 'var(--text-2)', money: COLOR.green, company: COLOR.violet }

export default function MapRoom() {
  useSpine()
  const [hover, setHover] = useState(null)
  const [flight, setFlight] = useState(null) // { ring, x, key }
  const lastLen = useRef(spine.events.length)
  const eventCount = spine.events.length

  // station state, folded from the log — nothing here is typed in
  const stations = useMemo(() => {
    const everCount = {}
    const todayCount = {}
    const last = {}
    for (const e of spine.events) {
      const h = homeOf(e)
      if (!h) continue
      everCount[h] = (everCount[h] || 0) + 1
      if (e.day === spine.dayIndex) todayCount[h] = (todayCount[h] || 0) + 1
      last[h] = e
    }
    return ROOM_META.map((r) => {
      const state = r.planned ? 'planned' : INDEX_ROOMS.has(r.id) ? 'index' : todayCount[r.id] ? 'live' : everCount[r.id] ? 'quiet' : 'unexercised'
      return { ...r, state, ever: everCount[r.id] || 0, today: todayCount[r.id] || 0, last: last[r.id] }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventCount])

  // the in-flight dot: the newest receipt slides along its ring toward its station
  useEffect(() => {
    if (eventCount <= lastLen.current) return
    lastLen.current = eventCount
    const e = spine.events[eventCount - 1]
    const h = homeOf(e)
    const st = stations.find((s) => s.id === h)
    if (!st) return
    setFlight({ ring: st.ring, id: st.id, key: e.id })
    const t = setTimeout(() => setFlight(null), 1400)
    return () => clearTimeout(t)
  }, [eventCount, stations])

  const W = 1120
  const rowH = 96
  const H = rowH * RING_ORDER.length + 24
  const rows = RING_ORDER.map((ring, i) => {
    const list = stations.filter((s) => s.ring === ring)
    const y = 40 + i * rowH
    const gap = (W - 160) / Math.max(1, list.length - 1)
    return { ring, y, list: list.map((s, j) => ({ ...s, x: 80 + j * gap })) }
  })
  const counts = stations.reduce((a, s) => ((a[s.state] = (a[s.state] || 0) + 1), a), {})
  const hovered = hover && stations.find((s) => s.id === hover)

  return (
    <>
      <RoomHead
        title="If it is not on this map, it is not in the company."
        hint="Every room a station, every lane a line. Unexercised is drawn dashed, planned is drawn dotted, and in-flight dots move on receipt."
        right={<YoursBadge>{stations.length} stations · {Object.keys(LANE_ROOM).length} lanes · derived live</YoursBadge>}
      />

      {/* the instrument strip — station states, folded from the log */}
      <KpiStrip
        items={[
          { v: counts.live || 0, l: 'Live today', sub: 'a receipt fired here' },
          { v: counts.quiet || 0, l: 'Quiet', sub: 'fired before, not today' },
          { v: counts.unexercised || 0, l: 'Unexercised', sub: 'never fired, drawn dashed' },
          { v: counts.planned || 0, l: 'Planned', sub: 'lane not born, drawn dotted' },
          { v: counts.index || 0, l: 'Index rooms', sub: 'point at other rooms' },
        ]}
      />

      <HPanel title="The map" hint="click a station to open it · hover for its last receipt">
        <div className="overflow-x-auto" style={{ scrollbarWidth: 'thin' }}>
          <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ minWidth: 820, display: 'block', fontFamily: UI }} role="img" aria-label="Map of every room, by ring">
            {rows.map((row) => {
              const c = RING_COLOR[row.ring]
              const x0 = row.list[0]?.x ?? 80
              const x1 = row.list[row.list.length - 1]?.x ?? W - 80
              return (
                <g key={row.ring}>
                  <text x={14} y={row.y + 4} fontSize={10} fontWeight={600} letterSpacing={0.8} fill="var(--text-3)" style={{ textTransform: 'uppercase' }}>{row.ring}</text>
                  <line x1={x0} y1={row.y} x2={x1} y2={row.y} stroke={c} strokeOpacity={0.3} strokeWidth={2} strokeLinecap="round" />
                  {flight && flight.ring === row.ring && (() => {
                    const st = row.list.find((s) => s.id === flight.id)
                    if (!st) return null
                    return <circle key={flight.key} cx={x0} cy={row.y} r={4} fill={c}><animate attributeName="cx" from={x0} to={st.x} dur="1.2s" fill="freeze" calcMode="spline" keySplines="0.32 0.72 0 1" /><animate attributeName="opacity" from="1" to="0" begin="1.1s" dur="0.3s" fill="freeze" /></circle>
                  })()}
                  {row.list.map((s) => {
                    const live = s.state === 'live'
                    const dash = s.state === 'unexercised' ? '4 4' : s.state === 'planned' ? '1.5 4' : undefined
                    const fill = live ? c : s.state === 'index' ? 'var(--bg-4)' : 'var(--bg-2)'
                    const r = live ? 8 : 6.5
                    return (
                      <g key={s.id} className="cursor-pointer" onClick={() => uiBus.openRoom(s.id)} onMouseEnter={() => setHover(s.id)} onMouseLeave={() => setHover(null)}>
                        <circle cx={s.x} cy={row.y} r={r} fill={fill} stroke={s.state === 'planned' ? COLOR.violet : c} strokeWidth={live ? 0 : 1.5} strokeDasharray={dash} />
                        {s.today > 0 && <text x={s.x} y={row.y + 3.5} fontSize={8.5} textAnchor="middle" fill="var(--on-fill)" fontWeight={700}>{s.today > 99 ? '99' : s.today}</text>}
                        <text x={s.x} y={row.y + 26} fontSize={10.5} fontWeight={500} textAnchor="middle" fill={hover === s.id ? 'var(--text-1)' : s.state === 'planned' ? COLOR.violet : 'var(--text-2)'}>{s.name}</text>
                        <text x={s.x} y={row.y + 39} fontSize={8.5} textAnchor="middle" fill={live ? c : s.state === 'planned' ? COLOR.violet : 'var(--text-3)'}>{s.state === 'quiet' ? `${s.ever} ever` : s.state}</text>
                      </g>
                    )
                  })}
                </g>
              )
            })}
          </svg>
        </div>
        {/* legend — the glyph is the meaning; the count in brackets is asserted by scripts/flows.mjs */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-3 text-[11.5px]" style={{ fontFamily: UI, color: 'var(--text-3)' }}>
          <span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="w-[8px] h-[8px] rounded-full" style={{ background: COLOR.cyan }} />live · a receipt fired here today ({counts.live || 0})</span>
          <span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="w-[8px] h-[8px] rounded-full border" style={{ borderColor: 'var(--text-3)' }} />quiet · fired before, not today ({counts.quiet || 0})</span>
          <span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="w-[8px] h-[8px] rounded-full border border-dashed" style={{ borderColor: 'var(--text-3)' }} />unexercised · never fired ({counts.unexercised || 0})</span>
          <span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="w-[8px] h-[8px] rounded-full border border-dotted" style={{ borderColor: COLOR.violet }} />planned · lane not born ({counts.planned || 0})</span>
          <span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="w-[8px] h-[8px] rounded-full" style={{ background: 'var(--bg-4)', border: '1px solid var(--line-2)' }} />index · points at other rooms ({counts.index || 0})</span>
        </div>
      </HPanel>

      <div className="grid grid-cols-1 xl:grid-cols-[1.35fr_1fr] gap-4 items-start">
        <HPanel className="min-w-0" title="Lanes" hint="16 born lanes → the room that renders each · face-coverage fails on a lane with no room">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
            {Object.entries(LANE_ROOM).map(([lane, room]) => {
              const s = stations.find((x) => x.id === room)
              const c = s ? RING_COLOR[s.ring] : 'var(--text-3)'
              return (
                <button key={lane} type="button" onClick={() => uiBus.openRoom(room)} className="flex items-center gap-3 text-left min-w-0 px-2 py-[7px] cursor-pointer transition-colors duration-200 hover:bg-(--bg-3)" style={{ borderBottom: '1px solid var(--line-1)', borderRadius: 'var(--r-sm)' }}>
                  <span className="w-[92px] shrink-0 text-[12px] truncate" style={{ fontFamily: MONO, color: 'var(--text-1)' }}>{lane}</span>
                  <span aria-hidden="true" className="flex-1 h-px" style={{ background: 'var(--line-2)' }} />
                  <span className="text-[12px] truncate" style={{ fontFamily: UI, color: c }}>{s ? s.name : room}</span>
                  <span className="w-[78px] shrink-0 text-right text-[11px] truncate" style={{ fontFamily: UI, color: s?.state === 'live' ? c : 'var(--text-3)' }}>{s?.state}</span>
                </button>
              )
            })}
          </div>
          <p className="mt-3 text-[12px] leading-[18px]" style={{ fontFamily: UI, color: 'var(--text-3)' }}>
            Three rooms have no lane yet — ops, trader, discover — and stay dotted until <span style={{ fontFamily: MONO }}>/arc-kickoff --lane</span> births them. Four rooms are this app's own (factory, executor, agents, story) and say so.
          </p>
        </HPanel>

        <div className="min-w-0">
          <HPanel title={hovered ? `Station · ${hovered.name}` : 'Station'} hint="hover the map" actions={hovered ? <Chip>{hovered.ring}</Chip> : undefined}>
            {!hovered && <Empty icon={Crosshair} title="Hover a station" hint="Its sentence, its counts and the last receipt that homed there appear here." />}
            {hovered && (
              <div className="space-y-3">
                <div className="min-w-0">
                  <div className="text-[13.5px] leading-[19px] break-words" style={{ fontFamily: UI, fontWeight: 600, color: 'var(--text-1)' }}>{hovered.sentence}</div>
                  <div className="text-[12.5px] leading-[18px] mt-1 break-words" style={{ fontFamily: UI, color: 'var(--text-2)' }}>{hovered.lede}</div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { v: hovered.today, l: 'Receipts today' },
                    { v: hovered.ever, l: 'Receipts ever' },
                  ].map((f) => (
                    <div key={f.l} className="p-3 min-w-0" style={{ background: 'var(--well)', border: '1px solid var(--line-1)', borderRadius: 'var(--r-md)' }}>
                      <div className="text-[22px] leading-[26px] tracking-[-0.01em]" style={{ fontFamily: FONT, fontWeight: 600, color: 'var(--text-1)' }}>{f.v}</div>
                      <div className="text-[12px] mt-0.5" style={{ fontFamily: UI, color: 'var(--text-3)' }}>{f.l}</div>
                    </div>
                  ))}
                </div>
                {hovered.last ? (
                  <div className="text-[12px] leading-[18px] pt-3 break-words" style={{ fontFamily: UI, color: 'var(--text-2)', borderTop: '1px solid var(--line-1)' }}>
                    last: {hovered.last.text} <span style={{ fontFamily: MONO, color: 'var(--text-3)' }}>⌗ {String(hovered.last.id).slice(-6)}</span>
                  </div>
                ) : (
                  <div className="text-[12px] leading-[18px] pt-3" style={{ fontFamily: UI, color: 'var(--text-3)', borderTop: '1px solid var(--line-1)' }}>
                    {hovered.planned ? 'planned — no manifest is invented for an unborn lane' : hovered.state === 'index' ? 'an index room — it homes no receipts of its own' : 'never fired — this station is drawn dashed until a receipt homes here'}
                  </div>
                )}
                {hovered.extra && <SimBadge>this app's own room · not in arc's 32</SimBadge>}
              </div>
            )}
          </HPanel>

          <HPanel title="The map's law">
            <div className="space-y-2 text-[12.5px] leading-[19px]" style={{ fontFamily: UI, color: 'var(--text-2)' }}>
              <div>A room exists in exactly one place — the registry; the rail, the palette and this map read it.</div>
              <div>A new lane lands its room in the same change, or face-coverage fails (the birth rule).</div>
              <div>Liveness is a fold over receipts — nobody marks a station live by hand.</div>
              <div>Dotted means unborn; dashed means born but silent; both are honest states, never hidden.</div>
            </div>
          </HPanel>
        </div>
      </div>
    </>
  )
}
