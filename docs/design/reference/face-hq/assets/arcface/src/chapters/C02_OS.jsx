// 02 · THE OS — kernel · workflows · ventures, live and sleeping,
// with the spine drawn through all of it. This is the whole company
// on one screen: what exists, what waits, and what wakes it.
import { Chapter, Head, Panel, Receipt, Reveal, StatusDot, COLOR, MONO } from '../ui/kit.jsx'

// state: live · building · sleeping — one visual code, one legend below
const LAYERS = [
  {
    key: 'kernel',
    title: 'KERNEL',
    sub: 'runs the company',
    nodes: [
      { id: 'core', state: 'live', note: 'hooks · gates · registry' },
      { id: 'hq · spine', state: 'live', note: 'events · brief · inbox' },
      { id: 'engine', state: 'sleeping', note: 'model drivers + router' },
      { id: 'bench', state: 'sleeping', note: 'score every model' },
      { id: 'memory', state: 'sleeping', note: 'playbooks + recall' },
      { id: 'evolve', state: 'sleeping', note: 'propose-only self-improvement' },
      { id: 'policy', state: 'sleeping', note: 'capability vectors' },
      { id: 'scheduler', state: 'sleeping', note: 'budgeted headless runs' },
    ],
  },
  {
    key: 'workflows',
    title: 'WORKFLOWS',
    sub: 'do the work',
    nodes: [
      { id: 'plan', state: 'live', note: 'kickoff → phases → retro' },
      { id: 'review', state: 'live', note: 'code + security' },
      { id: 'qa', state: 'live', note: 'real-browser quality' },
      { id: 'git', state: 'live', note: 'gated shipping' },
      { id: 'council', state: 'live', note: '12-seat judgment' },
      { id: 'design', state: 'building', note: 'the designer — cycle 3' },
      { id: 'develop', state: 'sleeping', note: 'execution harness' },
      { id: 'discover', state: 'sleeping', note: 'pain mining' },
      { id: 'growth', state: 'sleeping', note: 'SEO · content · video' },
      { id: 'leads', state: 'sleeping', note: 'capped outbound' },
      { id: 'ops', state: 'sleeping', note: 'support + canary sweeps' },
      { id: 'ledger', state: 'sleeping', note: 'P&L + kill-distance' },
      { id: 'legal-pack', state: 'sleeping', note: 'policies per venture' },
    ],
  },
  {
    key: 'ventures',
    title: 'VENTURES',
    sub: 'make the money',
    nodes: [
      { id: 'LexOS', state: 'live', note: 'venture #1 · legal SaaS' },
      { id: 'venturemind', state: 'consumer', note: 'arc consumer repo' },
      { id: 'Opportunity-Scout', state: 'consumer', note: 'arc consumer repo' },
      { id: 'venture #2', state: 'sleeping', note: 'discover picks it' },
      { id: 'trader', state: 'sleeping', note: 'sandbox · forever last' },
    ],
  },
]

function Node({ n }) {
  const dim = n.state === 'sleeping'
  const consumer = n.state === 'consumer'
  return (
    <div
      className="flex items-center gap-3 rounded-xl border px-3.5 py-2.5 min-h-[52px]"
      style={{
        borderColor: n.state === 'live' ? 'rgba(74,222,128,0.28)' : n.state === 'building' ? 'rgba(251,191,93,0.32)' : 'rgba(255,255,255,0.1)',
        background: dim ? 'rgba(255,255,255,0.015)' : 'rgba(0,0,0,0.35)',
        opacity: dim ? 0.72 : 1,
      }}
    >
      <StatusDot state={consumer ? 'ok' : n.state} />
      <div className="min-w-0">
        <div className="text-[12.5px] text-white/90 truncate" style={{ fontFamily: MONO }}>
          {n.id}
        </div>
        <div className="text-[10.5px] text-white/52 truncate" style={{ fontWeight: 300 }}>
          {n.note}
        </div>
      </div>
    </div>
  )
}

export default function C02_OS() {
  return (
    <Chapter id="c02">
      <Head
        n="02"
        name="the os"
        title={<>Kernel. Workflows.{' '}<br />Ventures.</>}
        lede="The whole company on one map. Solid nodes exist today; dim ones sleep in the strategy queue, each with a written pull-trigger — nothing is built before something real pulls it. And one spine runs through every layer."
        receipt="architecture v2.1 · 16-module catalog · plans/README.md trigger index"
      />

      <div className="relative">
        {/* the spine — literally drawn through the layers */}
        <div
          aria-hidden="true"
          className="absolute left-[7px] top-2 bottom-2 w-px hidden md:block"
          style={{ background: 'linear-gradient(to bottom, rgba(0,255,209,0.55), rgba(0,255,209,0.14), rgba(0,255,209,0.55))' }}
        />

        <div className="space-y-6">
          {LAYERS.map((layer, li) => (
            <Reveal key={layer.key} delay={li * 90}>
              <div className="relative md:pl-10">
                <div
                  aria-hidden="true"
                  className="absolute left-[3px] top-7 w-[9px] h-[9px] rounded-full hidden md:block"
                  style={{ background: COLOR.cyan, boxShadow: '0 0 10px rgba(0,255,209,0.7)' }}
                />
                <Panel>
                  <div className="flex items-baseline justify-between flex-wrap gap-2 mb-5">
                    <div className="flex items-baseline gap-4">
                      <span className="text-[17px] tracking-[0.22em] text-white" style={{ fontWeight: 600 }}>
                        {layer.title}
                      </span>
                      <span className="text-[11px] uppercase tracking-[0.2em] text-white/48" style={{ fontFamily: MONO }}>
                        {layer.sub}
                      </span>
                    </div>
                    <span className="text-[10px] uppercase tracking-[0.18em] text-white/42" style={{ fontFamily: MONO }}>
                      {layer.nodes.filter((n) => n.state === 'live').length} live · {layer.nodes.filter((n) => n.state === 'sleeping').length} sleeping
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                    {layer.nodes.map((n) => (
                      <Node key={n.id} n={n} />
                    ))}
                  </div>
                </Panel>
              </div>
            </Reveal>
          ))}
        </div>
      </div>

      {/* legend + law */}
      <Reveal delay={120}>
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap gap-x-5 gap-y-2 items-center text-[10.5px] uppercase tracking-[0.16em] text-white/60" style={{ fontFamily: MONO }}>
            <span className="text-white/42">legend</span>
            <span className="inline-flex items-center gap-2"><StatusDot state="live" /> live today</span>
            <span className="inline-flex items-center gap-2"><StatusDot state="building" /> being built — cycle 3</span>
            <span className="inline-flex items-center gap-2"><StatusDot state="ok" /> consumer repo</span>
            <span className="inline-flex items-center gap-2"><StatusDot state="sleeping" /> sleeps until its trigger fires</span>
          </div>
          <Receipt>constitution A8 — earn before build</Receipt>
        </div>
      </Reveal>
    </Chapter>
  )
}
