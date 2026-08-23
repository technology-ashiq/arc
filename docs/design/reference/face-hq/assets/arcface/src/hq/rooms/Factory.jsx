// 02 · FACTORY — the live cycle, gates, and the full catalog:
// 8 modules, 23 commands, 24 agents — every one addressable.
import { useMemo, useState } from 'react'
import { MONO, COLOR, Btn, StatusDot } from '../../ui/kit.jsx'
import { RoomHead, HPanel } from '../bits.jsx'
import { factoryState } from '../../spine/derive.js'
import { ARC } from '../../data/arcKnowledge.js'
import { useSpine } from '../useSpine.js'
import { ask } from '../../lib/voice.js'

const PROFILES = ['starter', 'standard', 'strict']

export default function Factory() {
  useSpine()
  const [profile, setProfile] = useState(factoryState.profile)
  const [q, setQ] = useState('')
  const [openCmd, setOpenCmd] = useState(null)

  const cmds = useMemo(() => {
    const n = q.trim().toLowerCase()
    if (!n) return ARC.commands
    return ARC.commands.filter((c) => (c.name + ' ' + c.short + ' ' + c.product).toLowerCase().includes(n))
  }, [q])

  return (
    <>
      <RoomHead
        title="The factory floor."
        hint="8 modules · 23 commands · 24 agents · 389 tests on 3-OS CI · 48 ADRs — all real repo facts"
      />

      <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_1fr] gap-4 items-start">
        <div>
          {/* live cycle */}
          <HPanel title={`live cycle — C3 · ${factoryState.cycle.name}`} hint="one live plan, ever — root PLAN.md" tone="cyan">
            <div className="space-y-2">
              {factoryState.cycle.phases.map((p) => {
                const done = p.status.startsWith('closed')
                const now = p.status.startsWith('built')
                return (
                  <div key={p.n} className="flex items-center gap-3 rounded-lg border border-white/9 px-3 py-2.5" style={{ background: now ? 'rgba(251,191,93,0.05)' : 'rgba(255,255,255,0.02)' }}>
                    <span className="text-[10px] w-6" style={{ fontFamily: MONO, color: done ? COLOR.green : now ? COLOR.amber : 'rgba(255,255,255,0.4)' }}>{p.n}</span>
                    <span className="flex-1 text-[12px] text-white/85" style={{ fontWeight: 500 }}>{p.name}</span>
                    <span className="text-[9.5px] uppercase tracking-[0.1em]" style={{ fontFamily: MONO, color: done ? COLOR.green : now ? COLOR.amber : 'rgba(255,255,255,0.45)' }}>{p.status}</span>
                  </div>
                )
              })}
            </div>
            <div className="mt-3 text-[10.5px] text-white/50 leading-[16px]" style={{ fontWeight: 300 }}>
              A phase flips ✅ only via /arc-phase-done: suite green + live demo + exit criteria + sha256 evidence bundle — or it refuses and names what is missing.
            </div>
          </HPanel>

          {/* gates */}
          <HPanel title="gates — block by default" hint="stamps are commit-keyed: new commit = re-review">
            <div className="flex items-center gap-2 mb-3 flex-wrap" style={{ fontFamily: MONO }}>
              <span className="text-[9.5px] uppercase tracking-[0.16em] text-white/45">profile</span>
              {PROFILES.map((p) => (
                <button key={p} onClick={() => setProfile(p)} className="min-h-[32px] rounded-full px-3.5 text-[10px] uppercase tracking-[0.12em] cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00ffd1]" style={{ background: profile === p ? 'rgba(0,255,209,0.15)' : 'rgba(255,255,255,0.05)', color: profile === p ? COLOR.cyan : 'rgba(255,255,255,0.6)', border: `1px solid ${profile === p ? 'rgba(0,255,209,0.5)' : 'rgba(255,255,255,0.13)'}` }}>
                  {p}
                </button>
              ))}
              <span className="text-[9px] text-white/40">one key switches every gate as a set</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {factoryState.gates.map((g) => {
                const warn = g.mode.startsWith('WARN')
                const off = profile === 'starter' && !warn
                return (
                  <div key={g.name} className="rounded-lg border px-3 py-2.5 flex items-center justify-between gap-2" style={{ borderColor: warn ? 'rgba(251,191,93,0.35)' : 'rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.02)' }}>
                    <span className="text-[11px] text-white/85" style={{ fontFamily: MONO }}>{g.name}</span>
                    <span className="text-[8.5px] uppercase tracking-[0.1em]" style={{ fontFamily: MONO, color: warn ? COLOR.amber : off ? 'rgba(255,255,255,0.4)' : COLOR.red }}>
                      {off ? 'warn (starter)' : g.mode}
                    </span>
                  </div>
                )
              })}
            </div>
            <div className="mt-3 flex items-center gap-2 text-[10px] uppercase tracking-[0.14em]" style={{ fontFamily: MONO }}>
              <span style={{ color: COLOR.amber }}>WARN</span>
              <span className="text-white/35">→ trial-ledger evidence →</span>
              <span style={{ color: COLOR.red }}>FAIL</span>
              <span className="text-white/35">· adversarial pass mandatory · 43+25+4 holes pinned</span>
            </div>
          </HPanel>

          {/* modules */}
          <HPanel title="modules — install any subset" hint="registry-tracked: looked up, never guessed">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {ARC.products.map((p) => (
                <button key={p.id} onClick={() => ask(`tell me about the ${p.id} module`)} className="rounded-lg border border-white/10 px-3 py-2.5 text-left cursor-pointer hover:border-[#00ffd1]/45 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00ffd1]" style={{ background: 'rgba(255,255,255,0.02)' }} title="ask the face about this module">
                  <div className="flex items-center gap-2 mb-1">
                    <StatusDot state={p.era === 'c3' ? 'building' : 'live'} />
                    <span className="text-[12.5px] text-white/90" style={{ fontFamily: MONO }}>{p.id}</span>
                  </div>
                  <div className="text-[9px] uppercase tracking-[0.1em] text-white/42" style={{ fontFamily: MONO }}>{p.status.split('—')[0]}</div>
                </button>
              ))}
            </div>
          </HPanel>
        </div>

        <div>
          {/* commands catalog */}
          <HPanel title="commands — all 23" hint="click one · the face explains it out loud">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="filter: kickoff, review, ship…"
              className="w-full bg-transparent border border-white/14 rounded-lg px-3 min-h-[38px] text-[12px] text-white/85 placeholder-white/35 outline-none focus:border-[#00ffd1]/60 mb-3"
              style={{ fontFamily: MONO }}
            />
            <div className="max-h-[290px] overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
              {cmds.map((c) => (
                <div key={c.name} className="border-b border-white/6 last:border-0">
                  <button onClick={() => setOpenCmd(openCmd === c.name ? null : c.name)} className="w-full flex items-baseline gap-3 py-2 px-1 text-left cursor-pointer hover:bg-white/[0.03] rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00ffd1]">
                    <span className="text-[11.5px] shrink-0" style={{ fontFamily: MONO, color: COLOR.cyan }}>{c.name}</span>
                    <span className="text-[11px] text-white/62 truncate" style={{ fontWeight: 300 }}>{c.short}</span>
                    <span className="ml-auto text-[8.5px] uppercase text-white/38" style={{ fontFamily: MONO }}>{c.product}</span>
                  </button>
                  {openCmd === c.name && (
                    <div className="px-1 pb-3">
                      <div className="text-[11px] leading-[17px] text-white/68 mb-2" style={{ fontWeight: 300 }}>{c.detail}</div>
                      <Btn small onClick={() => ask(`what does ${c.name} do?`)}>ask the face 🎙</Btn>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </HPanel>

          {/* agents roster */}
          <HPanel title="agents — all 24" hint="an employee here is spawned for the task, then gone">
            {['council', 'plan', 'review', 'qa', 'design', 'ops', 'research'].map((g) => {
              const list = ARC.agents.filter((a) => a.group === g)
              if (!list.length) return null
              return (
                <div key={g} className="mb-2.5">
                  <div className="text-[8.5px] uppercase tracking-[0.2em] text-white/40 mb-1" style={{ fontFamily: MONO }}>{g} · {list.length}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {list.map((a) => (
                      <button key={a.name} onClick={() => ask(`who is ${a.name}?`)} title={a.role} className="text-[10px] text-white/70 border border-white/12 rounded-md px-2 py-[4px] min-h-[28px] cursor-pointer hover:border-[#00ffd1]/50 hover:text-[#00ffd1] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00ffd1]" style={{ fontFamily: MONO }}>
                        {a.name.replace('council-', 'c·')}
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
          </HPanel>

          <HPanel title="the golden loop">
            <div className="flex flex-wrap gap-1 items-center" style={{ fontFamily: MONO }}>
              {ARC.pipeline.stages.map((s, i) => (
                <span key={s.name} className="flex items-center gap-1">
                  <span className="text-[9.5px] uppercase tracking-[0.08em] text-white/68 border border-white/12 rounded px-1.5 py-[3px]" title={s.what}>{s.name}</span>
                  {i < ARC.pipeline.stages.length - 1 && <span className="text-[#00ffd1]/55 text-[10px]">→</span>}
                </span>
              ))}
            </div>
          </HPanel>
        </div>
      </div>
    </>
  )
}
