// MONEY — "Real and simulated are different substances."
// The chart obeys the meaning contract: simulated revenue is violet
// AND hatched (hue alone is not enough), cost is plain ink, and
// green — real money's colour — stays unspent until revenue.received
// fires for the first time. Recording your first real rupee HERE is
// what lights the green. Kill lines render even when unmeasurable:
// an ABSENT row is printed, never dropped.
import { useEffect, useRef, useState } from 'react'
import { UI, MONO, COLOR, tint, Btn, Field, TextInput, PickRow, SimBadge, YoursBadge, Meter, Chip } from '../../ui/kit.jsx'
import { RoomHead, HPanel, KpiStrip } from '../bits.jsx'
import { revenueSeries, kpis } from '../../spine/derive.js'
import { spine } from '../../spine/store.js'
import { wsAppend } from '../../spine/workspace.js'
import { ARC } from '../../data/arcKnowledge.js'
import { useSpine } from '../useSpine.js'

// has real money EVER entered the log? (not "is it nonzero" — has the KIND fired)
const greenFired = () => spine.events.some((e) => e.kind === 'revenue.received')
const realAllTime = () => spine.events.filter((e) => e.kind === 'revenue.received').reduce((s, e) => s + (e.payload.amount || 0), 0)

// ── the chart: sim (violet, hatched area) · cost (ink line) · real (green, dots) ──
// The SVG is drawn at the container's real pixel width so axis text stays 11px.
function Chart({ series }) {
  const [hover, setHover] = useState(null)
  const wrap = useRef(null)
  const ref = useRef(null)
  const [W, setW] = useState(640)
  useEffect(() => {
    const el = wrap.current
    if (!el) return
    const measure = () => setW(Math.max(280, Math.round(el.getBoundingClientRect().width)))
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const H = 220, padL = 8, padR = 56, padT = 18, padB = 24
  const fired = greenFired()
  const max = Math.max(9000, ...series.map((s) => Math.max(s.value, s.cost, s.real || 0))) * 1.08
  const x = (i) => padL + ((W - padL - padR) * i) / Math.max(1, series.length - 1)
  const y = (v) => padT + (H - padT - padB) * (1 - v / max)
  const line = (key) => series.map((s, i) => `${x(i)},${y(s[key] || 0)}`).join(' ')
  const last = series[series.length - 1]
  const grid = [Math.round(max / 3 / 1000) * 1000, Math.round((max * 2) / 3 / 1000) * 1000].filter((g) => g > 0)

  return (
    <div ref={wrap} className="relative min-w-0">
      <svg
        ref={ref}
        viewBox={`0 0 ${W} ${H}`}
        className="block w-full"
        style={{ height: H }}
        role="img"
        aria-label={`Fourteen day money chart. Simulated revenue latest ₹${last.value.toLocaleString('en-IN')}, cost ₹${last.cost.toLocaleString('en-IN')}${fired ? `, real revenue all-time ₹${realAllTime().toLocaleString('en-IN')}` : ', real revenue has never fired'}`}
        onMouseMove={(e) => {
          const r = ref.current.getBoundingClientRect()
          const mx = ((e.clientX - r.left) / r.width) * W
          setHover(Math.max(0, Math.min(series.length - 1, Math.round(((mx - padL) / (W - padL - padR)) * (series.length - 1)))))
        }}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          {/* the non-real texture — 45°, per the contract: always hatched */}
          <pattern id="simHatch" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="6" stroke={COLOR.violet} strokeWidth="1.4" opacity="0.28" />
          </pattern>
        </defs>

        {grid.map((g) => (
          <g key={g}>
            <line x1={padL} x2={W - padR} y1={y(g)} y2={y(g)} stroke="var(--line-1)" strokeWidth="1" />
            <text x={W - padR + 8} y={y(g) + 4} fill="var(--text-3)" fontSize="11" fontFamily={UI}>₹{(g / 1000).toFixed(0)}k</text>
          </g>
        ))}

        {/* simulated revenue — violet area, hatched, violet line */}
        <polygon points={`${x(0)},${y(0)} ${line('value')} ${x(series.length - 1)},${y(0)}`} fill={tint('violet', 0.06)} />
        <polygon points={`${x(0)},${y(0)} ${line('value')} ${x(series.length - 1)},${y(0)}`} fill="url(#simHatch)" />
        <polyline points={line('value')} fill="none" stroke={COLOR.violet} strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" />

        {/* cost — plain ink line */}
        <polyline points={line('cost')} fill="none" stroke="var(--text-2)" strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" />

        {/* real revenue — exists only once the kind has fired */}
        {fired && (
          <g>
            <polyline points={line('real')} fill="none" stroke={COLOR.green} strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" />
            {series.map((s, i) => (s.real || 0) > 0 && <circle key={i} cx={x(i)} cy={y(s.real)} r="3.5" fill={COLOR.green} stroke="var(--bg-2)" strokeWidth="2" />)}
          </g>
        )}

        {/* direct label on the newest simulated point */}
        <circle cx={x(series.length - 1)} cy={y(last.value)} r="3.5" fill={COLOR.violet} stroke="var(--bg-2)" strokeWidth="2" />
        <text x={x(series.length - 1) - 8} y={y(last.value) - 10} fill="var(--text-1)" fontSize="11" fontWeight="600" textAnchor="end" fontFamily={MONO}>
          ₹{last.value.toLocaleString('en-IN')}{last.live ? ' · live' : ''}
        </text>

        {hover !== null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={padT} y2={H - padB} stroke="var(--line-2)" strokeDasharray="3,3" />
            <circle cx={x(hover)} cy={y(series[hover].value)} r="3.5" fill={COLOR.violet} stroke="var(--bg-2)" strokeWidth="2" />
            <circle cx={x(hover)} cy={y(series[hover].cost)} r="3.5" fill="var(--text-2)" stroke="var(--bg-2)" strokeWidth="2" />
            {fired && <circle cx={x(hover)} cy={y(series[hover].real || 0)} r="3.5" fill={COLOR.green} stroke="var(--bg-2)" strokeWidth="2" />}
          </g>
        )}
      </svg>

      {hover !== null && (
        <div className="absolute top-2 left-2 px-3 py-2 text-[12px] leading-[18px] pointer-events-none" style={{ background: 'var(--bg-2)', border: '1px solid var(--line-2)', borderRadius: 'var(--r-md)', fontFamily: UI }}>
          <div style={{ fontWeight: 600, color: 'var(--text-1)' }}>{series[hover].label}</div>
          <div className="flex items-baseline justify-between gap-4" style={{ color: COLOR.violet }}>
            <span>simulated</span>
            <span className="tnum" style={{ fontFamily: MONO }}>₹{series[hover].value.toLocaleString('en-IN')}</span>
          </div>
          <div className="flex items-baseline justify-between gap-4" style={{ color: 'var(--text-2)' }}>
            <span>cost</span>
            <span className="tnum" style={{ fontFamily: MONO }}>₹{series[hover].cost.toLocaleString('en-IN')}</span>
          </div>
          {fired ? (
            <div className="flex items-baseline justify-between gap-4" style={{ color: COLOR.green }}>
              <span>real</span>
              <span className="tnum" style={{ fontFamily: MONO }}>₹{(series[hover].real || 0).toLocaleString('en-IN')}</span>
            </div>
          ) : (
            <div style={{ color: 'var(--text-3)' }}>real: never-fired</div>
          )}
        </div>
      )}

      {/* legend — identity never by colour alone: texture, marker and label */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-3 text-[11.5px]" style={{ fontFamily: UI }}>
        <span className="inline-flex items-center gap-1.5" style={{ color: 'var(--text-2)' }}>
          <span aria-hidden="true" className="w-[14px] h-[8px] rounded-[2px] border shrink-0" style={{ borderColor: tint('violet', 0.5), background: `repeating-linear-gradient(45deg, transparent, transparent 2px, ${tint('violet', 0.35)} 2px, ${tint('violet', 0.35)} 3.5px)` }} />
          simulated revenue
        </span>
        <span className="inline-flex items-center gap-1.5" style={{ color: 'var(--text-2)' }}>
          <span aria-hidden="true" className="w-[14px] h-[2px] rounded-full shrink-0" style={{ background: 'var(--text-2)' }} />
          ai cost
        </span>
        {fired ? (
          <span className="inline-flex items-center gap-1.5" style={{ color: COLOR.green }}>
            <span aria-hidden="true" className="w-[8px] h-[8px] rounded-full shrink-0" style={{ background: COLOR.green }} />
            real revenue — FIRED
          </span>
        ) : (
          <span style={{ color: 'var(--text-3)' }}>real revenue: never-fired — green stays unspent until it is</span>
        )}
      </div>
    </div>
  )
}

// ── kill panel: the declared lines, measured or honestly ABSENT ──
function KillPanel() {
  const lastReal = [...spine.events].reverse().find((e) => e.kind === 'revenue.received')
  // venture #1 went live 2026-07-16; the sim's "today" is day 14 = 2026-07-28
  const daysWithout = lastReal ? Math.max(0, spine.dayIndex - lastReal.day) : 12 + spine.dayIndex - 14 + 27
  const CEILING = 90
  const status = daysWithout >= CEILING ? 'CROSSED' : daysWithout >= 60 ? 'WARNING' : 'OK'
  const sc = status === 'CROSSED' ? COLOR.red : status === 'WARNING' ? COLOR.amber : 'var(--text-2)'
  return (
    <HPanel title="Kill lines — lexos" hint="ventures.yaml · an ABSENT row is printed, never dropped" tone={status === 'OK' ? undefined : 'amber'}>
      <div className="mb-3">
        <div className="flex items-baseline justify-between gap-3 mb-2 min-w-0">
          <span className="text-[12.5px] truncate" style={{ fontFamily: UI, color: 'var(--text-1)' }}>
            <span style={{ fontFamily: MONO }}>days_without_revenue</span>
            <span style={{ color: 'var(--text-3)' }}> · ceiling {CEILING}</span>
          </span>
          <span className="text-[12px] tnum shrink-0" style={{ fontFamily: MONO, fontWeight: 600, color: sc }}>{daysWithout}d · {status}</span>
        </div>
        <Meter value={Math.min(1, daysWithout / CEILING)} tone={status === 'CROSSED' ? 'critical' : status === 'WARNING' ? 'warn' : 'blue'} />
        <div className="mt-2 text-[12px] leading-[18px]" style={{ fontFamily: UI, color: 'var(--text-3)' }}>
          {lastReal ? `resets on every revenue.received — last fired day ${lastReal.day - 13}` : 'counting since venture #1 went live · resets the day real ₹ lands'}
        </div>
      </div>
      <div className="p-3 min-w-0" style={{ background: 'var(--well)', border: '1px solid var(--line-1)', borderRadius: 'var(--r-md)' }}>
        <div className="flex items-center justify-between gap-3 min-w-0">
          <span className="text-[12.5px] truncate" style={{ fontFamily: UI, color: 'var(--text-1)' }}>
            <span style={{ fontFamily: MONO }}>traffic_floor_monthly</span>
            <span style={{ color: 'var(--text-3)' }}> · floor 100</span>
          </span>
          <Chip>ABSENT</Chip>
        </div>
        <p className="mt-2 text-[12px] leading-[18px]" style={{ fontFamily: UI, color: 'var(--text-2)' }}>
          reason: the ledger reads money, not visits. Dropping this row would hide a declared kill line nobody can measure — which is worse than showing it unmeasured.
        </p>
      </div>
    </HPanel>
  )
}

export default function Money() {
  useSpine()
  const k = kpis()
  const series = revenueSeries()
  const fired = greenFired()
  const [amount, setAmount] = useState('')
  const [venture, setVenture] = useState('lexos')
  const [msg, setMsg] = useState(null)

  const recordReal = () => {
    const n = Math.round(Number(amount))
    if (!n || n <= 0) {
      setMsg({ tone: 'err', text: 'a real rupee amount is required — whole ₹, greater than zero' })
      return
    }
    const first = !greenFired()
    wsAppend('revenue.received', 'money', `+ ₹${n.toLocaleString('en-IN')} REAL — ${venture} · recorded by the owner (E2: money moves by human hands)${first ? ' · FIRST EVER revenue.received — the green gate opens' : ''}`, {
      amount: n, venture, real: true,
    })
    setAmount('')
    setMsg({ tone: 'ok', text: first ? `Recorded. revenue.received has FIRED for the first time — green is now spendable across the HQ.` : `Recorded. Real all-time: ₹${realAllTime().toLocaleString('en-IN')}.` })
  }

  return (
    <>
      <RoomHead
        title="Real and simulated are different substances."
        hint="revenue.received is real-only; the sim feed is revenue.simulated. The P&L cannot be polluted by wishes."
        right={fired ? <YoursBadge>real ₹ on the log</YoursBadge> : <SimBadge>every ₹ below is simulated & labeled</SimBadge>}
      />

      {/* the instrument strip — green only where real money actually fired */}
      <KpiStrip
        items={[
          fired
            ? { v: '₹' + realAllTime().toLocaleString('en-IN'), l: 'Real revenue all-time', sub: 'revenue.received · measured', tone: 'green' }
            : { v: '₹0', l: 'Real revenue all-time', sub: 'never fired · not a zero with history' },
          { v: '₹' + k.simRev.toLocaleString('en-IN'), l: 'Simulated today', sub: 'lexos plans + projected sponsors', tone: 'violet' },
          { v: '₹' + k.cost.toLocaleString('en-IN'), l: 'AI cost today', sub: 'real-shaped · every run carries cost' },
          { v: k.ret.toFixed(1) + '×', l: 'Return (sim ÷ cost)', sub: 'the shape of the engine' },
        ]}
      />

      <div className="grid grid-cols-1 xl:grid-cols-[1.4fr_1fr] gap-4 items-start">
        <div className="min-w-0">
          <HPanel title="Fourteen sim days" hint="one axis, three substances · every line derives from the log">
            <Chart series={series} />
          </HPanel>

          <HPanel title="Record real revenue" hint="E2: money moves by human hands only — this form is yours alone" tone={fired ? undefined : 'amber'}>
            <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr_auto] gap-3 items-end">
              <Field label="Amount · whole ₹">
                <TextInput value={amount} onChange={setAmount} placeholder="e.g. 2999" />
              </Field>
              <Field label="Venture">
                <PickRow options={['lexos', 'arc-oss', 'other']} value={venture} onPick={setVenture} />
              </Field>
              <Btn tone={fired ? 'green' : 'primary'} onClick={recordReal}>Record revenue.received</Btn>
            </div>
            {msg && (
              <div className="mt-3 text-[12px] leading-[18px] break-words" style={{ fontFamily: UI, color: msg.tone === 'err' ? COLOR.red : COLOR.green }}>
                {msg.text}
              </div>
            )}
            {!fired && (
              <p className="mt-3 text-[12px] leading-[18px]" style={{ fontFamily: UI, color: 'var(--text-3)' }}>
                The first entry here is a company milestone: it opens the green gate, resets the kill clock, and lands on the spine forever.
              </p>
            )}
          </HPanel>

          <HPanel title="The milestone line" hint="honest ranges, not promises">
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
              {ARC.vision.milestones.map((m) => (
                <div key={m.when} className="min-w-0 p-3" style={{ background: 'var(--well)', border: '1px solid var(--line-1)', borderRadius: 'var(--r-md)' }}>
                  <div className="text-[11px] tnum mb-1" style={{ fontFamily: MONO, color: 'var(--text-3)' }}>{m.when}</div>
                  <div className="text-[13px] leading-[19px] break-words" style={{ fontFamily: UI, fontWeight: 500, color: 'var(--text-1)' }}>{m.what}</div>
                </div>
              ))}
            </div>
          </HPanel>
        </div>

        <div className="min-w-0">
          <KillPanel />

          <HPanel title="The north-star">
            <div className="text-[16px] leading-[24px] mb-2" style={{ fontFamily: UI, fontWeight: 600, color: 'var(--text-1)' }}>
              ₹ / month of revenue,<br />per hour of Ashiq's week.
            </div>
            <p className="text-[13px] leading-[20px]" style={{ fontFamily: UI, color: 'var(--text-2)' }}>
              The only number arc optimizes. A feature that adds human hours is a regression, however impressive — Working Article Three.
            </p>
          </HPanel>

          <HPanel title="Where money comes from" hint="portfolio math, honest">
            <div className="space-y-2 text-[13px] leading-[20px]" style={{ fontFamily: UI, color: 'var(--text-2)' }}>
              <div><b style={{ fontWeight: 600, color: 'var(--text-1)' }}>LexOS</b> — ₹2,999 / ₹5,999 per firm per month. Billing opens → real revenue.received. Kill checkpoint day 26, in writing.</div>
              <div><b style={{ fontWeight: 600, color: 'var(--text-1)' }}>arc itself</b> — public repo ~Nov, sponsors, then SaaS 2027+. The launch story is told from its own receipts.</div>
              <div><b style={{ fontWeight: 600, color: 'var(--text-1)' }}>Later ventures</b> — discover mines pains, council judges, 1-in-4 lives. Trading is never in a load-bearing row.</div>
              <div><b style={{ fontWeight: 600, color: 'var(--text-1)' }}>Byproducts</b> — ship-with, never build-for.</div>
            </div>
          </HPanel>
        </div>
      </div>
    </>
  )
}
