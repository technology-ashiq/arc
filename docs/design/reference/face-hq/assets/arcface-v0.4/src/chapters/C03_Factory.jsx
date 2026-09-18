// 03 · THE FACTORY — what exists today: 8 modules, the golden loop,
// the gates culture, and the receipted numbers strip.
import { useState } from 'react'
import { ARC } from '../data/arcKnowledge.js'
import { Chapter, Head, Panel, PanelTitle, Receipt, Reveal, Stat, StatusDot, COLOR, MONO } from '../ui/kit.jsx'

const ERA_BADGE = {
  c1: { label: 'cycle 1', state: 'live' },
  c2: { label: 'cycle 2 · LIVE', state: 'live' },
  c3: { label: 'cycle 3 · building', state: 'building' },
}

function ModuleCard({ p, i }) {
  const [open, setOpen] = useState(false)
  const era = ERA_BADGE[p.era] || ERA_BADGE.c1
  return (
    <Panel className="group transition-colors hover:border-[#00ffd1]/45 h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] text-white/40" style={{ fontFamily: MONO }}>
          {String(i + 1).padStart(2, '0')}
        </span>
        <span className="inline-flex items-center gap-1.5 text-[9px] uppercase tracking-[0.16em] text-white/62 border border-white/12 rounded-full px-2.5 py-[4px]" style={{ fontFamily: MONO }}>
          <StatusDot state={era.state} />
          {era.label}
        </span>
      </div>
      <h3 className="text-[24px] tracking-tight mb-2 text-white group-hover:text-[#00ffd1] transition-colors" style={{ fontWeight: 600 }}>
        {p.id}
        <span className="text-[#00ffd1]">.</span>
      </h3>
      <p className="text-[12.5px] leading-[20px] text-white/60 mb-4" style={{ fontWeight: 300 }}>
        {p.purpose}
      </p>
      <div className="mt-auto">
        <div className="flex flex-wrap gap-1.5">
          {(open ? p.pieces : p.pieces.slice(0, 3)).map((piece) => (
            <span key={piece} className="text-[10px] text-white/55 border border-white/12 rounded-lg px-2 py-[4px]" style={{ fontFamily: MONO }}>
              {piece}
            </span>
          ))}
        </div>
        {p.pieces.length > 3 && (
          <button
            onClick={() => setOpen(!open)}
            className="mt-3 text-[10px] uppercase tracking-[0.18em] text-[#00ffd1]/85 hover:text-[#00ffd1] cursor-pointer min-h-[30px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00ffd1] rounded"
            style={{ fontFamily: MONO }}
          >
            {open ? '− less' : `+ ${p.pieces.length - 3} more`}
          </button>
        )}
      </div>
    </Panel>
  )
}

export default function C03_Factory() {
  return (
    <Chapter id="c03">
      <Head
        n="03"
        name="the factory"
        title={<>Eight Modules.{' '}<br />One Discipline.</>}
        lede="Each module installs on its own into any repo — core is the only must-have. Six were forged in cycle one, the spine went live in cycle two, and the designer is being built right now. A registry in every target repo means the install state is looked up, never guessed."
        receipt="products/*/manifest.json · sync-to-project · arc-registry.json"
      />

      {/* numbers strip — all receipted */}
      <Reveal>
        <Panel className="mb-8">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-x-6 gap-y-6">
            <Stat value={ARC.stats.modules} label="modules" tone="cyan" />
            <Stat value={ARC.stats.commands} label="commands" />
            <Stat value={ARC.stats.agents} label="agents" />
            <Stat value="389" label="tests · 3-OS CI" tone="green" />
            <Stat value={ARC.stats.adrs} label="decisions as ADRs" />
            <Stat value={ARC.stats.cyclesClosed} label="cycles closed" />
          </div>
        </Panel>
      </Reveal>

      {/* module grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-14">
        {ARC.products.map((p, i) => (
          <Reveal key={p.id} delay={(i % 4) * 70}>
            <ModuleCard p={p} i={i} />
          </Reveal>
        ))}
      </div>

      {/* the golden loop */}
      <Reveal>
        <PanelTitle>the golden loop — idea to shipped, with receipts</PanelTitle>
      </Reveal>
      <Reveal delay={60}>
        <div className="relative mb-12 -mx-6 sm:mx-0">
          <div className="overflow-x-auto pb-4 px-6 sm:px-0" style={{ scrollbarWidth: 'thin' }}>
            <div className="flex gap-0 min-w-max items-stretch">
              {ARC.pipeline.stages.map((s, i) => (
                <div key={s.name} className="flex items-stretch">
                  <div
                    className="w-[200px] rounded-2xl border border-white/12 p-4 hover:border-[#00ffd1]/45 transition-colors"
                    style={{ background: 'rgba(5,10,9,0.66)' }}
                  >
                    <div className="text-[10px] mb-2" style={{ fontFamily: MONO, color: COLOR.cyan }}>
                      {String(i + 1).padStart(2, '0')}
                    </div>
                    <div className="text-[14px] mb-1.5 text-white/92" style={{ fontWeight: 600 }}>
                      {s.name}
                    </div>
                    <div className="text-[11px] text-white/55 leading-snug" style={{ fontWeight: 300 }}>
                      {s.what}
                    </div>
                  </div>
                  {i < ARC.pipeline.stages.length - 1 && (
                    <div className="flex items-center px-1.5" aria-hidden="true">
                      <span className="text-[#00ffd1]/60 text-[12px]">→</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </Reveal>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* gates */}
        <Reveal>
          <Panel className="h-full">
            <PanelTitle>gates — block by default</PanelTitle>
            <p className="text-[13px] leading-[22px] text-white/62 mb-5" style={{ fontWeight: 300 }}>
              One profile key — starter · standard · strict — switches every gate as a set. Review stamps are keyed to the
              commit sha: any new commit resets them and forces honest re-review. New gates start WARN-first in TRIAL and
              earn blocking mode only through trial-ledger evidence.
            </p>
            <div className="flex flex-wrap gap-2 mb-5" style={{ fontFamily: MONO }}>
              {['tests', 'coverage', 'docs-drift', 'scans', 'review-stamp', 'design (warn · trial)'].map((g) => (
                <span key={g} className="text-[10.5px] text-white/62 border border-white/14 rounded-lg px-2.5 py-[6px]">
                  {g} <span className="text-[#4ade80]">✓</span>
                </span>
              ))}
            </div>
            <div className="flex items-center gap-2 text-[10.5px] uppercase tracking-[0.16em]" style={{ fontFamily: MONO }}>
              <span style={{ color: COLOR.amber }}>WARN</span>
              <span className="text-white/35">→ trial ledger →</span>
              <span style={{ color: COLOR.red }}>FAIL</span>
              <span className="text-white/35">— promotion by evidence, demotion on incident</span>
            </div>
          </Panel>
        </Reveal>

        {/* adversarial culture */}
        <Reveal delay={80}>
          <Panel tone="amber" className="h-full">
            <PanelTitle tone="amber">the adversarial pass — mandatory paranoia</PanelTitle>
            <p className="text-[13px] leading-[22px] text-white/62 mb-5" style={{ fontWeight: 300 }}>
              No gate, lint or parser counts as done until a construct-a-breaking-input pass has attacked it — and every
              hole found is fixed and pinned as a fixture, so it can never sneak back. All in code that looked correct
              and passed its own tests.
            </p>
            <div className="grid grid-cols-3 gap-4">
              <Stat value="43" label="holes · early gates" tone="amber" />
              <Stat value="25" label="holes · spine build" tone="amber" />
              <Stat value="4" label="holes · design-lint" tone="amber" />
            </div>
            <div className="mt-5">
              <Receipt tone="amber">every hole → a pinned fixture in the 389-test suite</Receipt>
            </div>
          </Panel>
        </Reveal>
      </div>
    </Chapter>
  )
}
