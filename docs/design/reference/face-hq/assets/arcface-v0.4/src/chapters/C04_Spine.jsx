// 04 · THE SPINE — the live organ. A simulated (and labeled simulated)
// receipt tape shaped exactly like the real vocabulary, the eight spine
// laws, and the real morning brief with its real numbers.
import { useEffect, useRef, useState } from 'react'
import { Chapter, Head, Panel, PanelTitle, Receipt, Reveal, Kind, KIND_FAMILY, COLOR, MONO } from '../ui/kit.jsx'
import { ARC } from '../data/arcKnowledge.js'
import { stage } from '../lib/stage.js'

// tape rows use only kinds that exist in the closed vocabulary,
// with payload shapes matching the docs. SIMULATED — and labeled so.
const TAPE = [
  { t: '09:04', kind: 'session.started', family: 'system', payload: '{ repo: "arc", host: "factory" }' },
  { t: '09:12', kind: 'review.completed', family: 'factory', payload: '{ verdict: "ship", lens: "code" }' },
  { t: '09:31', kind: 'qa.completed', family: 'factory', payload: '{ flows: 6, regressions: 0 }' },
  { t: '10:02', kind: 'approval.requested', family: 'decision', payload: '{ subject: "phase-01 close" }' },
  { t: '10:09', kind: 'decision.recorded', family: 'decision', payload: '{ approved: true, reason: "evidence verified" }' },
  { t: '10:40', kind: 'phase.closed', family: 'factory', payload: '{ cycle: 3, phase: 1, tests: 389 }' },
  { t: '11:15', kind: 'council.verdict', family: 'council', payload: '{ verdict: "CONDITIONAL", confidence: 0.72 }' },
  { t: '12:26', kind: 'revenue.simulated', family: 'money', payload: '{ venture: "lexos", amount_inr: 2999 }' },
  { t: '14:47', kind: 'review.completed', family: 'factory', payload: '{ lens: "design", violations: 0 }' },
  { t: '16:33', kind: 'note.logged', family: 'system', payload: '{ text: "retro item: dedup hook emits" }' },
  { t: '18:20', kind: 'ship.completed', family: 'factory', payload: '{ target: "lexos-bay.vercel.app" }' },
  { t: '21:00', kind: 'day.closed', family: 'system', payload: '{ events: 22, sha: "…f7de2d0" }' },
]

function ulid(i) {
  // deterministic fake ULIDs — clearly presentational
  const chars = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
  let s = '01J9'
  for (let k = 0; k < 6; k++) s += chars[(i * 7 + k * 11) % 32]
  return s
}

function TapeRow({ row, i, lit }) {
  return (
    <div
      className="grid grid-cols-[46px_1fr] sm:grid-cols-[52px_190px_1fr_92px] items-baseline gap-x-4 px-4 py-[9px] rounded-lg transition-colors duration-500"
      style={{ background: lit ? 'rgba(0,255,209,0.06)' : 'transparent', fontFamily: MONO }}
    >
      <span className="text-[10.5px] text-white/48" style={{ fontVariantNumeric: 'tabular-nums' }}>
        {row.t}
      </span>
      <span className="text-[11.5px]">
        <Kind family={row.family}>{row.kind}</Kind>
      </span>
      <span className="hidden sm:block text-[10.5px] text-white/48 truncate">{row.payload}</span>
      <span className="hidden sm:block text-[9.5px] text-right" style={{ color: 'rgba(0,255,209,0.55)' }}>
        ⌗ {ulid(i)}
      </span>
    </div>
  )
}

export default function C04_Spine() {
  const [lit, setLit] = useState(0)
  const timer = useRef(null)
  useEffect(() => {
    if (stage.reducedMotion) return
    timer.current = setInterval(() => setLit((v) => (v + 1) % TAPE.length), 1400)
    return () => clearInterval(timer.current)
  }, [])

  return (
    <Chapter id="c04">
      <Head
        n="04"
        name="the spine"
        title={<>If It Isn't An Event,{' '}<br />It Didn't Happen.</>}
        lede="Cycle two's organ, live since July 24. Every action of the company appends one event to canonical JSONL — validated, redacted, sha-chained. State, briefs, dashboards, P&L: all of them are replayable views over this one log. This is the memory a company usually never keeps."
        receipt="ADR-0024…0032 · phases 00–03 closed · live dogfood since 2026-07-24"
      />

      <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-6 mb-6">
        {/* the tape */}
        <Reveal>
          <Panel pad={false} className="overflow-hidden h-full">
            <div className="flex items-center justify-between px-5 pt-5 pb-3 flex-wrap gap-2">
              <PanelTitle>the receipt tape — one day, one screen</PanelTitle>
              <span
                className="text-[9px] uppercase tracking-[0.22em] px-2.5 py-[5px] rounded-full border"
                style={{ fontFamily: MONO, color: COLOR.amber, borderColor: 'rgba(251,191,93,0.4)' }}
              >
                simulated feed · real vocabulary
              </span>
            </div>
            <div className="px-2 pb-3">
              {TAPE.map((row, i) => (
                <TapeRow key={i} row={row} i={i} lit={lit === i} />
              ))}
            </div>
            {/* the color legend — colors carry one meaning, everywhere on this page */}
            <div className="border-t border-white/10 px-5 py-3.5 flex flex-wrap gap-x-5 gap-y-2 items-center" style={{ fontFamily: MONO }}>
              <span className="text-[9.5px] uppercase tracking-[0.2em] text-white/42">legend — page-wide</span>
              {Object.entries(KIND_FAMILY).map(([k, f]) => (
                <span key={k} className="inline-flex items-center gap-1.5 text-[10px] text-white/62">
                  <span aria-hidden="true" className="w-[7px] h-[7px] rounded-full" style={{ background: f.color }} />
                  {f.label}
                </span>
              ))}
            </div>
          </Panel>
        </Reveal>

        {/* the morning brief — real numbers */}
        <Reveal delay={90}>
          <Panel tone="cyan" className="h-full flex flex-col">
            <PanelTitle>arc brief — the day in one screen</PanelTitle>
            <div
              className="rounded-xl border border-white/12 p-4 text-[11.5px] leading-[20px] mb-4"
              style={{ fontFamily: MONO, background: 'rgba(0,0,0,0.5)' }}
            >
              <div className="text-white/45 mb-2">$ arc brief · morning</div>
              <div><span style={{ color: COLOR.amber }}>needs-you</span> <span className="text-white/78">· 1 approval waiting: phase-01 close</span></div>
              <div><span style={{ color: COLOR.green }}>money</span> <span className="text-white/78">· real ₹0 · simulated ₹2,999 (lexos)</span></div>
              <div><span style={{ color: COLOR.cyan }}>progress</span> <span className="text-white/78">· phase 00 ✅ · 389 tests green · 0 violations</span></div>
              <div><span className="text-white/55">background</span> <span className="text-white/78">· 22 receipts · 0 quarantined</span></div>
            </div>
            <p className="text-[12.5px] leading-[21px] text-white/60 mb-4" style={{ fontWeight: 300 }}>
              Needs-you first, then money, progress, background. The noise budget is a hard law: the whole day in ≤40
              lines, or the brief itself is a bug.
            </p>
            <div className="mt-auto flex flex-wrap gap-2">
              <Receipt>dogfood day 1 — 10 lines · 306 ms · 22 receipts</Receipt>
            </div>
          </Panel>
        </Reveal>
      </div>

      {/* the eight spine laws */}
      <Reveal>
        <PanelTitle>the spine laws — each one a written decision</PanelTitle>
      </Reveal>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {ARC.spine.laws.map((law, i) => (
          <Reveal key={law.adr} delay={(i % 4) * 60}>
            <Panel className="h-full !p-5">
              <div className="text-[10px] mb-2" style={{ fontFamily: MONO, color: COLOR.cyan }}>
                {law.adr}
              </div>
              <div className="text-[13.5px] text-white/92 mb-1.5" style={{ fontWeight: 600 }}>
                {law.name}
              </div>
              <div className="text-[11.5px] leading-[18px] text-white/55" style={{ fontWeight: 300 }}>
                {law.what}
              </div>
            </Panel>
          </Reveal>
        ))}
      </div>

      <Reveal delay={100}>
        <div className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-3 justify-center text-center">
          <div className="text-[13px] text-white/62" style={{ fontWeight: 300 }}>
            <span className="text-white/88" style={{ fontWeight: 500 }}>18 event kinds, closed vocabulary</span> — a new kind needs an ADR
          </div>
          <div className="text-[13px] text-white/62" style={{ fontWeight: 300 }}>
            <span className="text-white/88" style={{ fontWeight: 500 }}>25 adversarial holes</span> found and pinned before anything consumed it
          </div>
          <div className="text-[13px] text-white/62" style={{ fontWeight: 300 }}>
            <span className="text-white/88" style={{ fontWeight: 500 }}>replay determinism in CI</span> — delete the cache, rebuild, byte-identical
          </div>
        </div>
      </Reveal>
    </Chapter>
  )
}
