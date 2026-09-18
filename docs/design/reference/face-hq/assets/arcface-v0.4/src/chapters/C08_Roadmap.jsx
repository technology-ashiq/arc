// 08 · THE ROADMAP — cycles walked, cycle running, money milestones,
// and the sleeping queue with its pull-triggers. Ends at arc-as-SaaS.
import { ARC } from '../data/arcKnowledge.js'
import { Chapter, Head, Panel, PanelTitle, Receipt, Reveal, StatusDot, COLOR, MONO } from '../ui/kit.jsx'

const CYCLES = [
  { id: 'C1', name: 'the factory', state: 'done', when: '→ 2026-07-22', what: '6 installable modules · selective sync + per-target registry · 22 commands · closed 6/6 phases at ~22% of appetite' },
  { id: 'C2', name: 'the receipt spine', state: 'done', when: '→ 2026-07-28 · LIVE', what: "emitter/replay/reader · morning brief · approval inbox · ADR-0024…0031 · dogfooding the company's own days since Jul 24" },
  { id: 'C3', name: 'the designer', state: 'now', when: 'running now', what: 'read-only vision critic · machine-checked briefs · critique receipts on the spine · phase 00 closed day one, phase 01 built' },
  { id: 'C4', name: 'first money', state: 'next', when: 'target Sep 2026', what: 'LexOS billing week — payments, SEO pages, launch week playbook, canary watch. OS feature-freezes; only retro fixes' },
  { id: 'C5', name: 'public arc', state: 'later', when: '~Nov 2026', what: 'public repo — the launch story told from its own receipts · sponsors · the constitution doubles as manifesto' },
  { id: 'C6', name: 'the evolve loop', state: 'later', when: '~Dec 2026', what: 'scoreboards per module · first champion/challenger experiment · self-improvement as a contract, propose-only' },
]

const STATE_STYLE = {
  done: { color: COLOR.green, label: 'CLOSED' },
  now: { color: COLOR.amber, label: '● NOW' },
  next: { color: COLOR.cyan, label: 'NEXT' },
  later: { color: 'rgba(255,255,255,0.5)', label: 'QUEUED' },
}

export default function C08_Roadmap() {
  return (
    <Chapter id="c08">
      <Head
        n="08"
        name="the roadmap"
        title={<>Built Only{' '}<br />When Pulled.</>}
        lede="Dates are planning aids; appetites and gates are the real control. Two cycles are closed with receipts, one is running, and everything after it waits on a written trigger — because capability built before something real pulls it is how factories polish themselves to death."
        receipt="master execution plan v1.1 · plans/README.md — the trigger index"
      />

      {/* cycle timeline */}
      <div className="relative mb-12">
        <div aria-hidden="true" className="absolute left-[7px] top-3 bottom-3 w-px bg-white/12 hidden sm:block" />
        <div className="space-y-3">
          {CYCLES.map((c, i) => {
            const st = STATE_STYLE[c.state]
            return (
              <Reveal key={c.id} delay={i * 60}>
                <div className="relative sm:pl-10">
                  <div
                    aria-hidden="true"
                    className="absolute left-[3px] top-6 w-[9px] h-[9px] rounded-full hidden sm:block"
                    style={{ background: st.color, boxShadow: c.state === 'now' ? `0 0 10px ${st.color}` : 'none' }}
                  />
                  <Panel className={c.state === 'now' ? '!border-[#fbbf5d]/40' : ''}>
                    <div className="flex items-baseline justify-between gap-3 flex-wrap mb-2">
                      <div className="flex items-baseline gap-4 flex-wrap">
                        <span className="text-[13px]" style={{ fontFamily: MONO, color: st.color, fontWeight: 700 }}>
                          {c.id}
                        </span>
                        <span className="text-[19px] tracking-tight text-white" style={{ fontWeight: 600 }}>
                          {c.name}
                        </span>
                        <span className="text-[10px] uppercase tracking-[0.18em]" style={{ fontFamily: MONO, color: st.color }}>
                          {st.label}
                        </span>
                      </div>
                      <span className="text-[10.5px] text-white/48" style={{ fontFamily: MONO }}>
                        {c.when}
                      </span>
                    </div>
                    <p className="text-[12.5px] leading-[20px] text-white/60" style={{ fontWeight: 300 }}>
                      {c.what}
                    </p>
                  </Panel>
                </div>
              </Reveal>
            )
          })}
        </div>
      </div>

      {/* money milestones */}
      <Reveal>
        <PanelTitle tone="green">the money line — honest ranges, not promises</PanelTitle>
      </Reveal>
      <Reveal delay={60}>
        <Panel className="mb-12 overflow-x-auto">
          <div className="flex items-stretch gap-0 min-w-max">
            {ARC.vision.milestones.map((m, i) => (
              <div key={m.when} className="flex items-center">
                <div className="w-[190px] pr-5">
                  <div className="text-[11px] mb-1.5" style={{ fontFamily: MONO, color: COLOR.green }}>
                    {m.when}
                  </div>
                  <div className="text-[13px] leading-[19px] text-white/82" style={{ fontWeight: 500 }}>
                    {m.what}
                  </div>
                </div>
                {i < ARC.vision.milestones.length - 1 && (
                  <div aria-hidden="true" className="w-10 h-px bg-white/20 mr-5 shrink-0" />
                )}
              </div>
            ))}
          </div>
          <div className="mt-5 pt-4 border-t border-white/10 flex flex-wrap gap-x-6 gap-y-2 text-[11px] text-white/52" style={{ fontWeight: 300 }}>
            <span>rules: trading never sits in a load-bearing row</span>
            <span>byproducts ship-with, never build-for</span>
            <span>every number lands as revenue.received — or it did not happen</span>
          </div>
        </Panel>
      </Reveal>

      {/* the sleeping queue */}
      <Reveal>
        <PanelTitle>the sleeping queue — every module has an alarm, not a deadline</PanelTitle>
      </Reveal>
      <Reveal delay={60}>
        <Panel pad={false} className="mb-8 overflow-hidden">
          <div className="grid grid-cols-[1fr_1.6fr] sm:grid-cols-[150px_1fr_1.4fr] gap-x-5 px-5 py-3 border-b border-white/10 text-[9.5px] uppercase tracking-[0.2em] text-white/45" style={{ fontFamily: MONO }}>
            <span>module</span>
            <span className="hidden sm:block">what it is</span>
            <span>sleeps until — the pull-trigger</span>
          </div>
          <div className="divide-y divide-white/6">
            {ARC.vision.sleeping.map((s) => (
              <div key={s.id} className="grid grid-cols-[1fr_1.6fr] sm:grid-cols-[150px_1fr_1.4fr] gap-x-5 px-5 py-[11px] items-baseline hover:bg-white/[0.025] transition-colors">
                <span className="flex items-center gap-2 text-[12px] text-white/85" style={{ fontFamily: MONO }}>
                  <StatusDot state="sleeping" />
                  {s.id}
                </span>
                <span className="hidden sm:block text-[11.5px] leading-[17px] text-white/55" style={{ fontWeight: 300 }}>
                  {s.what}
                </span>
                <span className="text-[11.5px] leading-[17px]" style={{ fontWeight: 300, color: 'rgba(251,191,93,0.82)' }}>
                  {s.wakes}
                </span>
              </div>
            ))}
          </div>
        </Panel>
      </Reveal>

      {/* endgame */}
      <Reveal>
        <Panel tone="cyan">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-6 items-center">
            <div>
              <PanelTitle>the endgame — arc itself becomes the product</PanelTitle>
              <p className="text-[13.5px] leading-[23px] text-white/68" style={{ fontWeight: 300 }}>
                Public repo first — the launch story told from its own receipts. Then SaaS. And through the engine layer —
                model-neutral process files, compiled adapters proven by byte-diff, drivers, a router and bench — arc runs
                on <span className="text-white/92" style={{ fontWeight: 500 }}>any AI tool: claude, codex, gemini, local, whatever ships next.</span>{' '}
                When a new model drops, bench scores it on every process and the whole company upgrades in a day. Models
                are parts. The company is the product.
              </p>
            </div>
            <div className="flex md:flex-col gap-2 shrink-0">
              <Receipt>engine + processes: PLAN-engine-process-layer.md</Receipt>
              <Receipt>“new model in a day — with receipts”</Receipt>
            </div>
          </div>
        </Panel>
      </Reveal>
    </Chapter>
  )
}
