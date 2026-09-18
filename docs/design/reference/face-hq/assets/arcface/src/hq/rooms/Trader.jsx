// TRADER (planned) — "Paper only, until a written rule change unlocks it."
// Not born in arc. No manifest is invented for an unborn lane, so this
// room rehearses the planned line (PLAN-trader.md · TRD-A..M) on paper:
// question → PLAYGROUND (EXPLORATORY) → register → snapshot + backtest →
// honesty battery → verdict → paper-live → 30 days → CONTINUE/DORMANT.
// THE LOCK is display only. No control on this page can touch money.
import { useState } from 'react'
import { Flask, Receipt } from '@phosphor-icons/react'
import { UI, MONO, COLOR, tint, Btn, Field, TextInput, PickRow, SimBadge, Chip } from '../../ui/kit.jsx'
import { RoomHead, HPanel, KpiStrip, Empty } from '../bits.jsx'
import { useSpine } from '../useSpine.js'
import { spine } from '../../spine/store.js'
import { wsAppend, newRef } from '../../spine/workspace.js'
import { TRADER_LOCK, strategies, traderQuestions } from '../../spine/registries.js'
import { FACTS } from '../../data/arcFacts.js'
import { hhmm } from '../../spine/kinds.js'

const PLAN = FACTS.planned.find((p) => p.room === 'trader')
// every station on the line is rehearsable on paper; the lock is rehearsed by being shown
const TODAY = new Set(PLAN.line)
const TRAIL = new Set(['question.opened', 'strategy.registered', 'backtest.completed', 'trade.verdict', 'trade.paper'])
const MARKETS = ['NIFTY-paper', 'BTC-paper', 'ETF-paper']
// status → chip tone. paper-live is amber because a verdict is owed at day 30; the rest stay quiet
const STATUS = { backtested: 'cyan', 'paper-live': 'amber' }
const PAPER_DAYS = 30
const hash = (s) => [...(s || '')].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7)
// deterministic rehearsal numbers from the name — same name, same backtest, forever
function backtestFor(name) {
  const h = hash(name)
  const honesty = { lookahead: false, survivorship: false, costsIncluded: true }
  if (h % 3 === 0) {
    const k = (h >> 2) % 3
    if (k === 0) honesty.lookahead = true
    else if (k === 1) honesty.survivorship = true
    else honesty.costsIncluded = false
  }
  return {
    trades: 40 + (h % 161),
    winRate: +(0.38 + ((h >> 4) % 25) / 100).toFixed(2),
    maxDrawdown: +(0.05 + ((h >> 8) % 31) / 100).toFixed(2),
    sharpe: +(-0.4 + ((h >> 12) % 21) / 10).toFixed(2),
    window: '2024-01→2026-06',
    snapshot: newRef('snap'),
    honesty,
  }
}
const honest = (h) => !!h && !h.lookahead && !h.survivorship && h.costsIncluded
const pct = (x) => Math.round(x * 100) + '%'

// the planned-lane banner: a dotted hairline and the honest badge, no wash
function Banner() {
  return (
    <div className="flex items-center gap-3 flex-wrap px-4 py-3 mb-4 text-[12.5px] leading-[19px]" style={{ fontFamily: UI, color: 'var(--text-2)', background: 'var(--bg-2)', border: '1px dotted var(--line-2)', borderRadius: 'var(--r-lg)' }}>
      <SimBadge>rehearsal</SimBadge>
      <span className="min-w-0">planned · drawn dotted — this lane is not born (arc rule: no manifest is invented for an unborn lane). Everything below is REHEARSAL and says so.</span>
    </div>
  )
}
function Stepper({ line }) {
  return (
    <div className="flex flex-wrap items-center gap-y-2">
      {line.map((s, i) => {
        const on = TODAY.has(s)
        return (
          <span key={s} className="inline-flex items-center">
            {i > 0 && <span aria-hidden="true" className="mx-1.5 text-[11px]" style={{ color: 'var(--text-3)' }}>→</span>}
            <span
              className="inline-flex items-center h-[22px] px-2 text-[11.5px] whitespace-nowrap"
              style={{ fontFamily: UI, fontWeight: 500, borderRadius: 'var(--r-sm)', color: on ? 'var(--accent)' : 'var(--text-3)', background: on ? tint('cyan', 0.06) : 'transparent', border: '1px dotted ' + (on ? tint('cyan', 0.45) : 'var(--line-2)') }}
            >
              {s}
            </span>
          </span>
        )
      })}
    </div>
  )
}
// one line of the honesty battery — a failed check is red because it is over the line for PAPER-LIVE
const Check = ({ ok, label }) => <Chip tone={ok ? 'cyan' : 'red'}>{ok ? '✓' : '✗'} {label}</Chip>
// one backtest figure: label in UI, number in mono
const Fig = ({ l, v, truncate = false }) => (
  <div className="min-w-0">
    <div className="text-[11px] leading-[14px]" style={{ fontFamily: UI, color: 'var(--text-3)' }}>{l}</div>
    <div className={`text-[12.5px] leading-[18px] tnum ${truncate ? 'truncate' : ''}`} style={{ fontFamily: MONO, fontWeight: 600, color: 'var(--text-1)' }}>{v}</div>
  </div>
)

export default function Trader() {
  useSpine()
  const [q, setQ] = useState('')
  const [name, setName] = useState('')
  const [market, setMarket] = useState(MARKETS[0])
  const [rule, setRule] = useState('')
  const [vf, setVf] = useState({ stratId: null, verdict: 'CONTINUE', reason: '' })
  const [refused, setRefused] = useState(null)
  const [msg, setMsg] = useState(null)

  const rows = strategies()
  const questions = traderQuestions()
  const trail = spine.events.filter((e) => e.ws && TRAIL.has(e.kind)).slice(-8).reverse()
  const paperLive = rows.filter((r) => r.status === 'paper-live').length

  const openQuestion = () => {
    const v = q.trim()
    if (!v) return
    wsAppend('question.opened', 'trader', `REHEARSAL · question opened: ${v}`, { q: v })
    setQ('')
    setMsg('question opened — a strategy answers it in the playground, on paper')
  }
  const register = () => {
    const n = name.trim()
    const r = rule.trim()
    if (!n || !r) return
    wsAppend('strategy.registered', 'trader', `REHEARSAL · strategy registered in PLAYGROUND (EXPLORATORY): ${n} · ${market} · rule “${r}”`, { stratId: newRef('st'), name: n, market, rule: r })
    setName('')
    setRule('')
    setMsg(`${n} registered — exploratory only; pin a snapshot and backtest it`)
  }
  const backtest = (s) => {
    const b = backtestFor(s.name)
    wsAppend('backtest.completed', 'trader', `REHEARSAL · snapshot ${b.snapshot} pinned · backtest ${s.name}: ${b.trades} trades · win rate ${pct(b.winRate)} · max drawdown ${pct(b.maxDrawdown)} · sharpe ${b.sharpe} · honesty ${honest(b.honesty) ? 'passed' : 'FAILED'} · paper numbers`, { stratId: s.stratId, ...b })
  }
  const verdict = (s) => {
    const reason = vf.reason.trim()
    if (!reason) return
    if (vf.verdict === 'PAPER-LIVE' && !honest(s.honesty)) {
      setRefused(s.stratId)
      return
    }
    wsAppend('trade.verdict', 'trader', `REHEARSAL · verdict ${vf.verdict} for ${s.name} · ${reason}${vf.verdict === 'PAPER-LIVE' ? ' · paper only, no order touches a market' : ''}`, { stratId: s.stratId, verdict: vf.verdict, reason })
    setVf({ stratId: null, verdict: 'CONTINUE', reason: '' })
    setRefused(null)
  }
  const paperDay = (s) => wsAppend('trade.paper', 'trader', `REHEARSAL · paper trade day ${s.paperDays + 1}/${PAPER_DAYS} for ${s.name} · no order touched a market`, { stratId: s.stratId, day: s.paperDays + 1 })
  const verdictOpen = (s) => s.status === 'backtested' || (s.status === 'paper-live' && s.paperDays >= PAPER_DAYS)
  // the strip's figures — folds over the same rows the list renders
  const backtestedN = rows.filter((r) => r.backtest).length
  const dueN = rows.filter(verdictOpen).length

  return (
    <>
      <RoomHead title="Paper only, until a written rule change unlocks it." hint="planned, drawn dotted — real-money trading sits at L0 behind a 72-hour cooldown and an amendment, not a toggle" right={<SimBadge>planned · drawn dotted · rehearsal only</SimBadge>} />
      <Banner />

      {/* figures lead — everything here is paper; amber only when a verdict is owed */}
      <KpiStrip
        items={[
          { v: questions.length, l: 'Questions opened', sub: 'a strategy answers one' },
          { v: rows.length, l: 'Strategies in the playground', sub: 'exploratory · paper' },
          { v: backtestedN, l: 'Backtests pinned', sub: 'deterministic rehearsal numbers', tone: 'violet' },
          { v: dueN, l: 'Verdicts due', sub: dueN ? 'a typed reason is the record' : `${paperLive} paper-live · no order touches a market`, tone: dueN ? 'amber' : undefined },
        ]}
      />

      <HPanel title="The lock — display only" hint={TRADER_LOCK.src}>
        <div className="p-4 grid grid-cols-1 md:grid-cols-[auto_1fr] gap-5 items-start min-w-0" style={{ background: 'var(--well)', border: '1px solid var(--line-1)', borderRadius: 'var(--r-md)' }}>
          <div className="min-w-0">
            <div className="text-[28px] leading-[32px] tracking-tight" style={{ fontFamily: MONO, fontWeight: 700, color: 'var(--text-1)' }}>{TRADER_LOCK.level} · DENIED</div>
            <div className="text-[12px] leading-[18px] mt-1.5" style={{ fontFamily: UI, color: 'var(--text-3)' }}>real money · cooldown {TRADER_LOCK.cooldownHours}h · ungrantable here</div>
          </div>
          <div className="min-w-0">
            <div className="text-[13px] leading-[20px] break-words" style={{ fontFamily: UI, color: 'var(--text-2)' }}>unlock: {TRADER_LOCK.unlock}</div>
            <div className="flex flex-wrap gap-2 mt-3">
              {PLAN.seals.map((s, i) => (
                <span key={s} className="inline-flex items-center h-[22px] px-2 rounded-full text-[11px] line-through whitespace-nowrap" style={{ fontFamily: UI, fontWeight: 500, color: 'var(--text-3)', background: 'var(--bg-4)', border: '1px solid var(--line-1)' }}>{i === 2 ? 'the word — never rendered' : s}</span>
              ))}
            </div>
            <div className="text-[12px] leading-[18px] mt-2" style={{ fontFamily: UI, color: 'var(--text-3)' }}>no control on this page exists for these — not disabled, absent</div>
          </div>
        </div>
      </HPanel>

      <div className="grid grid-cols-1 xl:grid-cols-[1.4fr_1fr] gap-4 items-start">
        <div className="min-w-0">
          <HPanel title="Open a question" hint="question.opened — a strategy exists to answer a question, never the other way round">
            <form className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3" onSubmit={(e) => { e.preventDefault(); openQuestion() }}>
              <Field label="Question"><TextInput value={q} onChange={setQ} placeholder="does a 20/50 crossover on NIFTY survive costs over two years?" /></Field>
              <div className="flex items-end"><Btn tone="primary" onClick={openQuestion}>Open →</Btn></div>
            </form>
            {questions.length > 0 && (
              <div className="mt-3 -mx-2">
                {questions.slice(0, 5).map((x) => (
                  <div key={x.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 px-2 py-2" style={{ borderBottom: '1px solid var(--line-1)' }}>
                    <span className="text-[12px]" style={{ fontFamily: MONO, color: 'var(--text-3)' }}>?</span>
                    <span className="text-[13px] leading-[20px] min-w-0 break-words" style={{ fontFamily: UI, color: 'var(--text-1)' }}>{x.q}</span>
                    <SimBadge>rehearsal</SimBadge>
                  </div>
                ))}
              </div>
            )}
            {msg && <div className="mt-3 text-[12.5px] leading-[19px]" style={{ fontFamily: UI, color: 'var(--accent)' }}>{msg}</div>}
          </HPanel>

          <HPanel title="Register a strategy — PLAYGROUND (EXPLORATORY)" hint="strategy.registered · exploratory means it can be thrown away without a retro">
            <form className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3" onSubmit={(e) => { e.preventDefault(); register() }}>
              <Field label="Name"><TextInput mono value={name} onChange={setName} placeholder="nifty-20-50-cross" /></Field>
              <Field label="Rule — one line"><TextInput value={rule} onChange={setRule} placeholder="long when 20d closes above 50d; flat otherwise; 1 unit; no leverage" /></Field>
            </form>
            <div className="flex items-end justify-between gap-3 flex-wrap">
              <Field label="Market — paper only"><PickRow options={MARKETS} value={market} onPick={setMarket} /></Field>
              <Btn tone="primary" onClick={register} className={name.trim() && rule.trim() ? '' : 'opacity-40'}>Register →</Btn>
            </div>
          </HPanel>

          <HPanel title={`Strategies — ${rows.length}`} hint={`${paperLive} paper-live · a verdict needs a typed reason · PAPER-LIVE needs a clean honesty battery`} tone={dueN ? 'amber' : undefined}>
            {rows.length === 0 && <Empty icon={Flask} title="No strategy registered" hint="the playground is empty, which is the honest state of an unborn lane — open a question above, then register a strategy that answers it" />}
            <div className="space-y-2.5">
              {rows.map((s) => {
                const b = s.backtest
                const h = s.honesty
                const editing = vf.stratId === s.stratId
                return (
                  <div key={s.stratId} className="p-3.5 min-w-0" style={{ background: 'var(--well)', border: '1px solid var(--line-1)', borderRadius: 'var(--r-md)', opacity: s.status === 'dormant' ? 0.6 : 1 }}>
                    <div className="flex items-center gap-2 flex-wrap mb-2 min-w-0">
                      <b className="text-[13px] leading-[19px] min-w-0 break-all" style={{ fontFamily: MONO, fontWeight: 600, color: 'var(--text-1)' }}>{s.name}</b>
                      <Chip tone={STATUS[s.status]}>{s.status}</Chip>
                      <span className="text-[12px]" style={{ fontFamily: UI, color: 'var(--text-3)' }}>{s.market}{s.verdict ? ` · verdict ${s.verdict}` : ''}{s.paperDays ? ` · day ${s.paperDays}/${PAPER_DAYS}` : ''}</span>
                      <SimBadge>rehearsal</SimBadge>
                    </div>
                    <div className="text-[12.5px] leading-[19px] mb-2 break-words" style={{ fontFamily: UI, color: 'var(--text-2)' }}>rule: {s.rule}</div>
                    {b && (
                      <div className="px-3 py-2.5 mb-2 min-w-0" style={{ background: 'var(--bg-1)', border: '1px solid var(--line-1)', borderRadius: 'var(--r-md)' }}>
                        <div className="mb-2"><SimBadge>PAPER · deterministic rehearsal numbers</SimBadge></div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2">
                          <Fig l="trades" v={b.trades} />
                          <Fig l="win rate" v={pct(b.winRate)} />
                          <Fig l="max drawdown" v={pct(b.maxDrawdown)} />
                          <Fig l="sharpe" v={b.sharpe} />
                          <Fig l="window" v={b.window} />
                          <Fig l="snapshot" v={b.snapshot} truncate />
                        </div>
                        <div className="flex flex-wrap gap-1.5 mt-2.5">
                          <Check ok={!h.lookahead} label="no lookahead" />
                          <Check ok={!h.survivorship} label="no survivorship bias" />
                          <Check ok={h.costsIncluded} label="costs included" />
                        </div>
                      </div>
                    )}
                    {s.status === 'paper-live' && s.paperDays >= PAPER_DAYS && <div className="text-[12.5px] leading-[19px] mb-2" style={{ fontFamily: UI, color: COLOR.amber }}>{PAPER_DAYS} days — CONTINUE / DORMANT is due</div>}
                    {editing ? (
                      <form className="space-y-2 mt-1" onSubmit={(e) => { e.preventDefault(); verdict(s) }}>
                        <PickRow small options={['CONTINUE', 'DORMANT', 'PAPER-LIVE']} value={vf.verdict} onPick={(v) => setVf({ ...vf, verdict: v })} />
                        <div className="flex gap-2 flex-wrap items-center">
                          <div className="flex-1 min-w-[220px]"><TextInput autoFocus value={vf.reason} onChange={(v) => setVf({ ...vf, reason: v })} placeholder="reason — required, it is the record" /></div>
                          <Btn small onClick={() => verdict(s)} className={vf.reason.trim() ? '' : 'opacity-40'}>Record verdict</Btn>
                          <Btn small onClick={() => { setVf({ stratId: null, verdict: 'CONTINUE', reason: '' }); setRefused(null) }}>Cancel</Btn>
                        </div>
                        {refused === s.stratId && <div className="text-[12.5px] leading-[19px]" style={{ fontFamily: UI, color: COLOR.red }}>honesty battery failed — PAPER-LIVE refused</div>}
                      </form>
                    ) : (
                      <div className="flex gap-2 flex-wrap">
                        {s.status === 'registered' && <Btn small onClick={() => backtest(s)}>Pin snapshot + backtest</Btn>}
                        {verdictOpen(s) && <Btn small tone="amber" onClick={() => setVf({ stratId: s.stratId, verdict: 'CONTINUE', reason: '' })}>Verdict</Btn>}
                        {s.status === 'paper-live' && s.paperDays < PAPER_DAYS && <Btn small onClick={() => paperDay(s)}>Paper day {s.paperDays + 1}/{PAPER_DAYS}</Btn>}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </HPanel>

          <HPanel title="The trail" hint="question · register · backtest · verdict · paper — last 8, rehearsals only">
            {trail.length === 0 && <Empty icon={Receipt} title="Nothing rehearsed yet." hint="the first question or strategy receipt lands here" />}
            {trail.length > 0 && (
              <div className="-mx-2">
                {trail.map((e) => (
                  <div key={e.id} className="grid grid-cols-[auto_1fr_auto] items-baseline gap-3 px-2 py-2 transition-colors duration-200 hover:bg-(--bg-3)" style={{ borderBottom: '1px solid var(--line-1)', borderRadius: 'var(--r-sm)' }}>
                    <span className="text-[11.5px] tnum shrink-0" style={{ fontFamily: MONO, color: 'var(--text-3)' }}>{hhmm(e.t)}</span>
                    <span className="text-[13px] leading-[20px] min-w-0 break-words" style={{ fontFamily: UI, color: 'var(--text-1)' }}>{e.text}</span>
                    <span className="text-[11px] shrink-0" style={{ fontFamily: MONO, color: 'var(--text-3)' }}>⌗ {String(e.id).slice(-6)}</span>
                  </div>
                ))}
              </div>
            )}
          </HPanel>
        </div>

        <div className="min-w-0">
          <HPanel title="The planned line" hint={`${PLAN.line.length} stations · all rehearsable on paper`}>
            <Stepper line={PLAN.line} />
          </HPanel>

          <HPanel title="Why paper">
            <div className="text-[13.5px] leading-[21px] space-y-2" style={{ fontFamily: UI, color: 'var(--text-2)' }}>
              <p>Real-money trading is ungrantable at every level. It is one of the five forever-human actions: no capability, no tier and no stamp in this app can hand it to a process.</p>
              <p>The only unlock is a constitution amendment plus a {TRADER_LOCK.cooldownHours}-hour cooldown — a written rule change with a review-by date, not a toggle. Until that text exists, every number on this page is paper and says so.</p>
              <p>A backtest with a failed honesty check cannot go paper-live. Thirty paper days end in CONTINUE or DORMANT, never in an order.</p>
            </div>
            <div className="mt-4 pt-3 space-y-1.5 text-[12px] leading-[18px]" style={{ fontFamily: UI, borderTop: '1px solid var(--line-1)' }}>
              <div className="grid grid-cols-[72px_1fr] gap-2 min-w-0">
                <span style={{ color: 'var(--text-3)' }}>takes over</span>
                <span className="min-w-0 break-words" style={{ color: 'var(--text-2)' }}>{PLAN.takes_over}</span>
              </div>
              <div className="grid grid-cols-[72px_1fr] gap-2 min-w-0">
                <span style={{ color: 'var(--text-3)' }}>src</span>
                <span className="min-w-0 break-all" style={{ fontFamily: MONO, color: 'var(--text-2)' }}>{PLAN.source}</span>
              </div>
            </div>
          </HPanel>
        </div>
      </div>
    </>
  )
}
