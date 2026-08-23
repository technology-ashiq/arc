// 01 · THE IDEA — what arc is, in its own locked words.
import { Chapter, Head, Panel, PanelTitle, Receipt, Reveal, Stat, COLOR, MONO } from '../ui/kit.jsx'

const LAWS = [
  ['process over model', 'the IP is the process — prompts, checklists, gates, schemas. Models are swappable engines.'],
  ['if it isn’t an event, it didn’t happen', 'every action appends to the spine. Dashboards and P&L are views over the log — never separate truths.'],
  ['trust is earned by evidence', 'every capability starts at WARN / L1 and climbs the ladder on trial-ledger receipts. Incidents demote automatically.'],
  ['everything measured, everything improvable', 'every module declares its own metrics, experiments and evals. Self-improvement is a contract, not a hope.'],
  ['boring tech, receipts everywhere', 'files, POSIX bash, zero-dep Node, SQLite. Deterministic gates around probabilistic models.'],
]

export default function C01_Idea() {
  return (
    <Chapter id="c01">
      <Head
        n="01"
        name="the idea"
        title={<>One Person.{' '}<br />A Whole Company.</>}
        lede="Most tools help you write code. arc runs the company around the code — planning, judging, shipping, marketing, accounting, deciding — as one operating system where the human does only what only a human should."
        receipt="docs/strategy/arc-master-execution-plan.md · v1.1"
      />

      {/* the locked mission sentence */}
      <Reveal>
        <Panel tone="cyan" className="mb-6">
          <PanelTitle>the mission — locked</PanelTitle>
          <blockquote
            className="text-[20px] sm:text-[27px] md:text-[31px] leading-[1.32] tracking-tight text-white"
            style={{ fontWeight: 500 }}
          >
            “arc is a receipt-driven company operating system: <span className="text-[#00ffd1]">one event spine</span>, one
            process layer, one model router, <span className="text-[#00ffd1]">one human approval inbox</span>.”
          </blockquote>
          <div className="mt-5 text-[12.5px] sm:text-[13.5px] text-white/62 leading-[22px]" style={{ fontWeight: 300 }}>
            Kernel runs the company · workflows do the work · ventures make the money · every claim has a receipt.
          </div>
        </Panel>
      </Reveal>

      <div className="grid grid-cols-1 lg:grid-cols-[1.35fr_1fr] gap-6 mb-6">
        {/* five laws */}
        <Reveal>
          <Panel className="h-full">
            <PanelTitle>the five laws</PanelTitle>
            <ol className="space-y-4">
              {LAWS.map(([law, what], i) => (
                <li key={law} className="flex gap-4">
                  <span className="text-[11px] mt-[3px] shrink-0" style={{ fontFamily: MONO, color: COLOR.cyan }}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <div>
                    <div className="text-[14.5px] text-white/92 mb-0.5" style={{ fontWeight: 600 }}>
                      {law}
                    </div>
                    <div className="text-[12.5px] leading-[20px] text-white/58" style={{ fontWeight: 300 }}>
                      {what}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
            <div className="mt-5">
              <Receipt>the laws graduate into the constitution — chapter 09</Receipt>
            </div>
          </Panel>
        </Reveal>

        <div className="flex flex-col gap-6">
          {/* north star */}
          <Reveal delay={80}>
            <Panel tone="cyan">
              <PanelTitle>the north-star — the only number arc optimizes</PanelTitle>
              <div className="text-[24px] sm:text-[28px] leading-[1.25] tracking-tight text-white" style={{ fontWeight: 600 }}>
                ₹ / month of revenue,
                <br />
                per hour of the owner's week.
              </div>
              <p className="mt-4 text-[12.5px] leading-[21px] text-white/58" style={{ fontWeight: 300 }}>
                A feature that adds human hours is a regression, however impressive. Constitution A3.
              </p>
            </Panel>
          </Reveal>

          {/* the honest frame */}
          <Reveal delay={140}>
            <Panel>
              <PanelTitle tone="amber">the honest frame</PanelTitle>
              <div className="flex items-end gap-6 mb-4">
                <Stat value="85–90%" label="execution automated — target" tone="cyan" />
                <Stat value="30–60" label="min/day of human decisions" />
              </div>
              <p className="text-[12.5px] leading-[21px] text-white/58" style={{ fontWeight: 300 }}>
                A 100%-autonomous company does not exist in 2026, and arc does not pretend otherwise. Build, content and
                support automate well; selling, pricing, law and money stay human-gated — by evidence and by design.
              </p>
              <div className="mt-4">
                <Receipt tone="amber">org blueprint · 2026-07-25 · external evidence audited</Receipt>
              </div>
            </Panel>
          </Reveal>
        </div>
      </div>

      {/* the one-line thesis */}
      <Reveal>
        <div className="text-center py-8 sm:py-10">
          <div className="text-[17px] sm:text-[22px] text-white/86 tracking-tight" style={{ fontWeight: 500 }}>
            “A claim without a receipt is an opinion.”
          </div>
          <div className="mt-2 text-[10.5px] uppercase tracking-[0.3em] text-white/45" style={{ fontFamily: MONO }}>
            eternal article E1 — the rule everything below obeys
          </div>
        </div>
      </Reveal>
    </Chapter>
  )
}
