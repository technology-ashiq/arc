// 06 · HQ — the owner's nine minutes. A working demo of the approval
// inbox, built to the letter of the real HQ design brief: the council
// score, the ₹ at stake and the kill-criteria state sit ON the card,
// never behind a click; approve/reject are one action each; a cleared
// card collapses into the done log carrying its receipt id.
import { useState } from 'react'
import { Chapter, Head, Panel, PanelTitle, Receipt, Reveal, Stat, COLOR, MONO } from '../ui/kit.jsx'
import { ARC } from '../data/arcKnowledge.js'

const INBOX_SEED = [
  {
    id: 'apr-001',
    title: 'Close Phase 01 — design-lint v0 + first brief',
    kind: 'phase close',
    council: 'evidence verified · 389 tests · adversarial pass done',
    stake: '₹0 at stake',
    kill: 'kill tripwire: 1.4 days of headroom',
    receipt: '01J9F2Q7MB',
  },
  {
    id: 'apr-002',
    title: 'Adopt the Constitution v0.1',
    kind: 'governance',
    council: 'council lens: constitution-compliance PASS',
    stake: '₹0 at stake · irreversibility: HIGH',
    kill: 'tier E articles become unamendable',
    receipt: '01J9F3T8XC',
  },
  {
    id: 'apr-003',
    title: 'LexOS — open billing week (Razorpay live mode)',
    kind: 'venture / money',
    council: 'session 001: CONDITIONAL · override ADR-0006 on file',
    stake: '₹2,999–5,999 / firm / month at stake',
    kill: 'kill checkpoint: day 26 after billing',
    receipt: '01J9F5W1ZD',
  },
]

export default function C06_HQ() {
  const [queue, setQueue] = useState(INBOX_SEED)
  const [done, setDone] = useState([])

  const clear = (id, action) => {
    const item = queue.find((q) => q.id === id)
    if (!item) return
    setQueue(queue.filter((q) => q.id !== id))
    setDone([{ ...item, action, at: '09:1' + (4 + done.length) }, ...done])
  }
  const reset = () => {
    setQueue(INBOX_SEED)
    setDone([])
  }

  return (
    <Chapter id="c06">
      <Head
        n="06"
        name="hq"
        title={<>Your Nine Minutes.{' '}<br />The Machine's Day.</>}
        lede="HQ compresses ownership into minutes: see everything the company did, clear the decisions waiting on you, leave. Live today as CLI — brief and inbox over the spine. The dashboard below is the declared next skin, and this demo follows its written design brief."
        receipt="brief: calm · dense · factual — docs/design/briefs/…/brief.md · tier S"
      />

      {/* KPI row — per the brief: a number never shows a spinner */}
      <Reveal>
        <Panel className="mb-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-6">
            <Stat value={`${queue.length} waiting`} label="approval inbox" tone={queue.length ? 'amber' : 'green'} />
            <Stat value="₹0" label="real revenue — honest" tone="green" />
            <Stat value="₹2,999" label="simulated · lexos (labeled)" />
            <Stat value="~9 min" label="owner time needed today" tone="cyan" />
          </div>
        </Panel>
      </Reveal>

      <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-6 mb-6 items-start">
        {/* the inbox — interactive */}
        <Reveal>
          <Panel tone="amber">
            <div className="flex items-center justify-between flex-wrap gap-2 mb-5">
              <PanelTitle tone="amber">approval inbox — the one panel that needs you</PanelTitle>
              <span className="text-[9.5px] uppercase tracking-[0.18em] text-white/48" style={{ fontFamily: MONO }}>
                interactive demo — try it
              </span>
            </div>

            {queue.length === 0 && (
              <div className="text-center py-10">
                <div className="text-[17px] text-white/85 mb-1" style={{ fontWeight: 500 }}>
                  Inbox zero. The company is running itself.
                </div>
                <div className="text-[12px] text-white/52 mb-5" style={{ fontWeight: 300 }}>
                  Every decision you just made is a decision.recorded receipt on the spine.
                </div>
                <button
                  onClick={reset}
                  className="text-[10.5px] uppercase tracking-[0.2em] text-[#00ffd1] border border-[#00ffd1]/45 rounded-full px-5 min-h-[44px] cursor-pointer hover:bg-[#00ffd1]/10 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00ffd1]"
                  style={{ fontFamily: MONO }}
                >
                  replay the demo
                </button>
              </div>
            )}

            <div className="space-y-3.5">
              {queue.map((q) => (
                <div key={q.id} className="rounded-xl border border-white/14 p-4.5 p-5" style={{ background: 'rgba(0,0,0,0.42)' }}>
                  <div className="flex items-baseline justify-between gap-3 flex-wrap mb-2.5">
                    <div className="text-[14.5px] text-white/94" style={{ fontWeight: 600 }}>
                      {q.title}
                    </div>
                    <span className="text-[9.5px] uppercase tracking-[0.16em] text-white/50" style={{ fontFamily: MONO }}>
                      {q.kind}
                    </span>
                  </div>
                  {/* the three facts the decision needs — on the card, never behind a click */}
                  <div className="space-y-1 mb-4 text-[11.5px]" style={{ fontFamily: MONO }}>
                    <div style={{ color: COLOR.violet }}>» {q.council}</div>
                    <div style={{ color: COLOR.green }}>» {q.stake}</div>
                    <div style={{ color: COLOR.red }}>» {q.kill}</div>
                  </div>
                  <div className="flex gap-2.5 flex-wrap">
                    <button
                      onClick={() => clear(q.id, 'approved')}
                      className="text-[11px] uppercase tracking-[0.16em] text-black rounded-lg px-5 min-h-[44px] cursor-pointer transition-transform hover:scale-[1.02] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00ffd1]"
                      style={{ fontFamily: MONO, fontWeight: 700, background: COLOR.green }}
                    >
                      approve
                    </button>
                    <button
                      onClick={() => clear(q.id, 'rejected — reason required')}
                      className="text-[11px] uppercase tracking-[0.16em] rounded-lg px-5 min-h-[44px] cursor-pointer border transition-colors hover:bg-[#ff6b6b]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff6b6b]"
                      style={{ fontFamily: MONO, fontWeight: 700, color: COLOR.red, borderColor: 'rgba(255,107,107,0.5)' }}
                    >
                      reject · with reason
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {queue.length > 0 && (
              <div className="mt-4 text-[11px] leading-[18px] text-white/48" style={{ fontWeight: 300 }}>
                The real HQ's brief promises an expert path — j/k moves between cards, a approves, r rejects with a
                reason — dropping the daily clear from ~10 minutes of mousing to ~3 of keys.
              </div>
            )}

            {/* done log — cleared cards collapse here, receipt id kept */}
            {done.length > 0 && (
              <div className="mt-5 border-t border-white/10 pt-4">
                <div className="text-[9.5px] uppercase tracking-[0.22em] text-white/45 mb-2.5" style={{ fontFamily: MONO }}>
                  done log — decision.recorded
                </div>
                <div className="space-y-1.5">
                  {done.map((d) => (
                    <div key={d.id} className="flex items-baseline gap-3 text-[11px] flex-wrap" style={{ fontFamily: MONO }}>
                      <span className="text-white/42" style={{ fontVariantNumeric: 'tabular-nums' }}>{d.at} IST</span>
                      <span style={{ color: d.action === 'approved' ? COLOR.green : COLOR.red }}>{d.action}</span>
                      <span className="text-white/68 truncate max-w-[300px]">{d.title}</span>
                      <span style={{ color: 'rgba(0,255,209,0.55)' }}>⌗ {d.receipt}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Panel>
        </Reveal>

        {/* the autonomy ladder */}
        <Reveal delay={90}>
          <Panel className="h-full">
            <PanelTitle>the autonomy ladder — trust, earned</PanelTitle>
            <div className="space-y-3 mb-5">
              {ARC.autonomy.levels.map((l, i) => (
                <div key={l.level} className="flex items-center gap-3">
                  <span
                    className="text-[11px] w-9 h-7 rounded-lg flex items-center justify-center shrink-0"
                    style={{
                      fontFamily: MONO,
                      fontWeight: 700,
                      background: `rgba(0,255,209,${0.06 + i * 0.1})`,
                      color: i >= 3 ? '#001a14' : COLOR.cyan,
                    }}
                  >
                    {l.level}
                  </span>
                  <div aria-hidden="true" className="h-1 rounded-full bg-[#00ffd1] shrink-0" style={{ width: `${8 + i * 11}%`, opacity: 0.25 + i * 0.17 }} />
                  <span className="text-[11.5px] text-white/60 leading-tight" style={{ fontWeight: 300 }}>
                    {l.meaning}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-[12px] leading-[20px] text-white/58 mb-4" style={{ fontWeight: 300 }}>
              Promotion needs trial-ledger evidence — e.g. twenty consecutive drafts approved unedited. Any incident
              demotes automatically. Trust is re-earned, never argued back.
            </p>
            <div className="rounded-xl border border-[#ff6b6b]/28 p-4" style={{ background: 'rgba(255,107,107,0.05)' }}>
              <div className="text-[9.5px] uppercase tracking-[0.22em] mb-2.5" style={{ fontFamily: MONO, color: COLOR.red }}>
                forever human — at any level
              </div>
              <div className="flex flex-wrap gap-1.5">
                {ARC.autonomy.foreverHuman.map((f) => (
                  <span key={f} className="text-[10px] text-white/72 border border-white/14 rounded-lg px-2 py-[4px]" style={{ fontFamily: MONO }}>
                    {f}
                  </span>
                ))}
              </div>
            </div>
          </Panel>
        </Reveal>
      </div>

      <Reveal>
        <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-center">
          <span className="text-[12.5px] text-white/60" style={{ fontWeight: 300 }}>
            The daily rhythm: read the brief · clear the inbox · one venture-forward action. Everything else is the machine's.
          </span>
          <Receipt>master plan §9 — the owner's operating rhythm</Receipt>
        </div>
      </Reveal>
    </Chapter>
  )
}
