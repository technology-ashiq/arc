// 06 · MONEY — revenue chart with hover, real-vs-simulated truth,
// cost & return, the north-star, and the milestone line.
import { useRef, useState } from 'react'
import { MONO, COLOR, SimBadge } from '../../ui/kit.jsx'
import { RoomHead, HPanel } from '../bits.jsx'
import { revenueSeries, kpis } from '../../spine/derive.js'
import { ARC } from '../../data/arcKnowledge.js'
import { useSpine } from '../useSpine.js'

function Chart({ series }) {
  const [hover, setHover] = useState(null)
  const ref = useRef(null)
  const W = 640, H = 170, padL = 10, padR = 70, padT = 18, padB = 24
  const max = Math.max(9000, ...series.map((s) => s.value)) * 1.05
  const x = (i) => padL + ((W - padL - padR) * i) / Math.max(1, series.length - 1)
  const y = (v) => padT + (H - padT - padB) * (1 - v / max)
  const pts = series.map((s, i) => `${x(i)},${y(s.value)}`).join(' ')
  const last = series[series.length - 1]

  return (
    <div className="relative">
      <svg
        ref={ref}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label={`Simulated revenue line chart, ${series.length} days, latest ₹${last.value.toLocaleString('en-IN')}`}
        onMouseMove={(e) => {
          const r = ref.current.getBoundingClientRect()
          const mx = ((e.clientX - r.left) / r.width) * W
          const i = Math.max(0, Math.min(series.length - 1, Math.round(((mx - padL) / (W - padL - padR)) * (series.length - 1))))
          setHover(i)
        }}
        onMouseLeave={() => setHover(null)}
      >
        {[3000, 6000, 9000].map((g) => (
          <g key={g}>
            <line x1={padL} x2={W - padR} y1={y(g)} y2={y(g)} stroke="rgba(255,255,255,0.09)" strokeWidth="1" />
            <text x={W - padR + 8} y={y(g) + 4} fill="rgba(255,255,255,0.4)" fontSize="10" fontFamily="JetBrains Mono, monospace">₹{g / 1000}k</text>
          </g>
        ))}
        <polygon points={`${padL},${y(0)} ${pts} ${x(series.length - 1)},${y(0)}`} fill="rgba(0,255,209,0.09)" />
        <polyline points={pts} fill="none" stroke={COLOR.cyan} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={x(series.length - 1)} cy={y(last.value)} r="4" fill={COLOR.cyan} stroke="#050a09" strokeWidth="2" />
        <text x={x(series.length - 1) - 6} y={y(last.value) - 10} fill="#fff" fontSize="11" fontWeight="600" textAnchor="end" fontFamily="JetBrains Mono, monospace">
          ₹{last.value.toLocaleString('en-IN')} {last.live ? '· live' : ''}
        </text>
        {hover !== null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={padT} y2={H - padB} stroke="rgba(255,255,255,0.25)" strokeDasharray="3,3" />
            <circle cx={x(hover)} cy={y(series[hover].value)} r="4" fill={COLOR.cyan} stroke="#050a09" strokeWidth="2" />
          </g>
        )}
      </svg>
      {hover !== null && (
        <div className="absolute top-2 left-2 rounded-lg border border-white/14 px-3 py-1.5 text-[11px]" style={{ background: 'rgba(0,0,0,0.8)', fontFamily: MONO }}>
          <b className="text-white">{series[hover].label}</b> <span className="text-white/70">· sim revenue ₹{series[hover].value.toLocaleString('en-IN')} · cost ₹{series[hover].cost.toLocaleString('en-IN')}</span>
        </div>
      )}
    </div>
  )
}

export default function Money() {
  useSpine()
  const k = kpis()
  const series = revenueSeries()

  return (
    <>
      <RoomHead
        title="Money — with the truth law on."
        hint="revenue.received is real-only; the sim feed is revenue.simulated. The P&L cannot be polluted by wishes."
        right={<SimBadge>every ₹ below is simulated & labeled — real revenue: ₹0</SimBadge>}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        {[
          { v: '₹0', l: 'real revenue · all-time', tone: COLOR.green, sub: 'first real ₹ target: Sep 2026' },
          { v: '₹' + k.simRev.toLocaleString('en-IN'), l: 'simulated · today', tone: '#fff', sub: 'lexos plans + projected sponsors' },
          { v: '₹' + k.cost.toLocaleString('en-IN'), l: 'ai cost · today', tone: '#fff', sub: 'REQ-08 cost honesty — first cut' },
          { v: k.ret.toFixed(1) + '×', l: 'return (sim ÷ cost)', tone: COLOR.cyan, sub: 'the shape of the engine' },
        ].map((s) => (
          <div key={s.l} className="rounded-xl border border-white/10 p-4" style={{ background: 'rgba(4,9,8,0.78)' }}>
            <div className="text-[22px] tracking-tight" style={{ fontWeight: 700, color: s.tone, fontVariantNumeric: 'tabular-nums' }}>{s.v}</div>
            <div className="text-[9px] uppercase tracking-[0.16em] text-white/45 mt-1" style={{ fontFamily: MONO }}>{s.l}</div>
            <div className="text-[10px] text-white/50 mt-1.5" style={{ fontWeight: 300 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.4fr_1fr] gap-4 items-start">
        <div>
          <HPanel title="simulated revenue — last 14 sim days" hint="hover for daily detail · derives from the log" tone="cyan">
            <Chart series={series} />
          </HPanel>

          <HPanel title="the milestone line" hint="honest ranges, not promises">
            <div className="overflow-x-auto pb-1">
              <div className="flex items-stretch min-w-max">
                {ARC.vision.milestones.map((m, i) => (
                  <div key={m.when} className="flex items-center">
                    <div className="w-[170px] pr-4">
                      <div className="text-[10.5px] mb-1" style={{ fontFamily: MONO, color: COLOR.green }}>{m.when}</div>
                      <div className="text-[11.5px] leading-[16px] text-white/78" style={{ fontWeight: 500 }}>{m.what}</div>
                    </div>
                    {i < ARC.vision.milestones.length - 1 && <div className="w-8 h-px bg-white/18 mr-4 shrink-0" />}
                  </div>
                ))}
              </div>
            </div>
          </HPanel>
        </div>

        <div>
          <HPanel title="the north-star" tone="cyan">
            <div className="text-[19px] leading-[1.3] tracking-tight text-white mb-2" style={{ fontWeight: 600 }}>
              ₹ / month of revenue,<br />per hour of Ashiq's week.
            </div>
            <p className="text-[11px] leading-[16px] text-white/58" style={{ fontWeight: 300 }}>
              The only number arc optimizes. A feature that adds human hours is a regression, however impressive — Working Article Three.
            </p>
          </HPanel>

          <HPanel title="where money comes from" hint="portfolio math honest">
            <div className="space-y-2 text-[11.5px] leading-[17px] text-white/68" style={{ fontWeight: 300 }}>
              <div><b style={{ color: COLOR.green, fontWeight: 600 }}>LexOS</b> — ₹2,999 / ₹5,999 per firm per month. Billing opens → first real revenue.received. Kill checkpoint day 26, in writing.</div>
              <div><b className="text-white/90" style={{ fontWeight: 600 }}>arc itself</b> — public repo ~Nov, sponsors, then SaaS 2027+. The launch story is told from its own receipts.</div>
              <div><b className="text-white/90" style={{ fontWeight: 600 }}>Later ventures</b> — discover mines pains, council judges, 1-in-4 lives. Trading is never in a load-bearing row.</div>
              <div><b className="text-white/90" style={{ fontWeight: 600 }}>Byproducts</b> — ship-with, never build-for.</div>
            </div>
          </HPanel>

          <HPanel title="cost honesty — agent payroll" hint="REQ-08 · revives fully in the ledger module">
            <p className="text-[11px] leading-[16px] text-white/58" style={{ fontWeight: 300 }}>
              Every run carries nullable cost fields; the ledger module (sleeping — wakes at 2 revenue sources) turns them into per-venture P&L, AI-cost attribution and kill-distance meters. Today's chip shows the first cut.
            </p>
          </HPanel>
        </div>
      </div>
    </>
  )
}
