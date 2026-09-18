// 02 · FACTORY — the live cycle, gates, and the full catalog:
// 8 modules, 23 commands, 24 agents — every one addressable.
import { useMemo, useState } from 'react'
import { Terminal } from '@phosphor-icons/react'
import { UI, MONO, COLOR, tint, Btn, StatusDot, Chip, Field, TextInput, PickRow } from '../../ui/kit.jsx'
import { RoomHead, HPanel, KpiStrip, SectionLabel, Empty } from '../bits.jsx'
import { factoryState } from '../../spine/derive.js'
import { ARC } from '../../data/arcKnowledge.js'
import { useSpine } from '../useSpine.js'
import { ask } from '../../lib/voice.js'

const PROFILES = ['starter', 'standard', 'strict']
const AGENT_GROUPS = ['council', 'plan', 'review', 'qa', 'design', 'ops', 'research']
// closed = passed phase-done on evidence (green); built = waiting on the owner (amber)
const phaseTone = (p) => (p.status.startsWith('closed') ? 'green' : p.status.startsWith('built') ? 'amber' : undefined)

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
  const filtering = Boolean(q.trim())
  const [testCount, testWhere] = String(factoryState.tests).split(' · ')
  const cycle = factoryState.cycle

  return (
    <>
      <RoomHead
        title="The factory floor."
        hint="8 modules · 23 commands · 24 agents · 389 tests on 3-OS CI · 48 ADRs — all real repo facts"
      />

      <KpiStrip
        items={[
          { v: ARC.products.length, l: 'Modules', sub: 'install any subset' },
          { v: ARC.commands.length, l: 'Commands', sub: 'every one addressable' },
          { v: ARC.agents.length, l: 'Agents', sub: 'spawned per task, then gone' },
          { v: testCount, l: 'Tests', sub: testWhere },
          { v: factoryState.adrs, l: 'ADRs' },
          { v: factoryState.gates.length, l: 'Gates', sub: `${profile} profile` },
        ]}
      />

      <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_1fr] gap-4 items-start">
        <div className="min-w-0">
          {/* live cycle */}
          <HPanel title="Live cycle" hint={`${cycle.id} ${cycle.name} · one live plan, ever — root PLAN.md`}>
            <div className="space-y-2">
              {cycle.phases.map((p) => {
                const tone = phaseTone(p)
                const c = tone ? COLOR[tone] : 'var(--text-3)'
                return (
                  <div
                    key={p.n}
                    className="flex items-center gap-3 flex-wrap px-3 py-2.5 min-w-0"
                    style={{ background: 'var(--well)', border: '1px solid ' + (tone === 'amber' ? tint('amber', 0.35) : 'var(--line-1)'), borderRadius: 'var(--r-md)' }}
                  >
                    <span className="text-[11.5px] w-6 shrink-0 tnum" style={{ fontFamily: MONO, color: c }}>{p.n}</span>
                    <span className="flex-1 min-w-0 text-[13px] break-words" style={{ fontFamily: UI, fontWeight: 500, color: 'var(--text-1)' }}>{p.name}</span>
                    <Chip tone={tone}>{p.status}</Chip>
                  </div>
                )
              })}
            </div>
            <p className="mt-3 text-[12.5px] leading-[19px]" style={{ fontFamily: UI, color: 'var(--text-2)' }}>
              A phase flips ✅ only via <span style={{ fontFamily: MONO, color: 'var(--text-1)' }}>/arc-phase-done</span>: suite green + live demo + exit criteria + sha256 evidence bundle — or it refuses and names what is missing.
            </p>
          </HPanel>

          {/* gates */}
          <HPanel title="Gates" hint="block by default · stamps are commit-keyed: new commit = re-review">
            <Field label="Profile" hint="one key switches every gate as a set" className="mb-3">
              <PickRow small options={PROFILES} value={profile} onPick={setProfile} />
            </Field>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {factoryState.gates.map((g) => {
                const warn = g.mode.startsWith('WARN')
                const off = profile === 'starter' && !warn
                return (
                  <div
                    key={g.name}
                    className="flex items-center justify-between gap-2 px-3 py-2.5 min-w-0"
                    style={{ background: 'var(--well)', border: '1px solid ' + (warn ? tint('amber', 0.35) : 'var(--line-1)'), borderRadius: 'var(--r-md)' }}
                  >
                    <span className="text-[12.5px] truncate" style={{ fontFamily: MONO, color: 'var(--text-1)' }}>{g.name}</span>
                    <span className="text-[11px] shrink-0 text-right" style={{ fontFamily: MONO, color: warn ? COLOR.amber : off ? 'var(--text-3)' : COLOR.red }}>
                      {off ? 'warn (starter)' : g.mode}
                    </span>
                  </div>
                )
              })}
            </div>
            <p className="mt-3 text-[12px] leading-[18px]" style={{ fontFamily: UI, color: 'var(--text-3)' }}>
              <span style={{ fontFamily: MONO, color: COLOR.amber }}>WARN</span> → trial-ledger evidence → <span style={{ fontFamily: MONO, color: COLOR.red }}>FAIL</span> · adversarial pass mandatory · 43+25+4 holes pinned
            </p>
          </HPanel>

          {/* modules */}
          <HPanel title="Modules" hint="install any subset · registry-tracked: looked up, never guessed">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {ARC.products.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => ask(`tell me about the ${p.id} module`)}
                  title="ask the face about this module"
                  className="text-left cursor-pointer min-w-0 px-3 py-2.5 transition-colors duration-200 hover:bg-(--bg-4) focus-visible:outline focus-visible:outline-2 focus-visible:outline-(--accent)"
                  style={{ background: 'var(--well)', border: '1px solid var(--line-1)', borderRadius: 'var(--r-md)' }}
                >
                  <div className="flex items-center gap-2 mb-1 min-w-0">
                    <StatusDot state={p.era === 'c3' ? 'building' : 'live'} />
                    <span className="text-[13px] truncate" style={{ fontFamily: MONO, fontWeight: 600, color: 'var(--text-1)' }}>{p.id}</span>
                  </div>
                  <div className="text-[11.5px] truncate" style={{ fontFamily: UI, color: 'var(--text-3)' }}>{p.status.split('—')[0].trim()}</div>
                </button>
              ))}
            </div>
          </HPanel>
        </div>

        <div className="min-w-0">
          {/* commands catalog */}
          <HPanel
            title="Commands"
            hint="click one · the face explains it out loud"
            actions={<Chip>{filtering ? `${cmds.length} of ${ARC.commands.length}` : `all ${ARC.commands.length}`}</Chip>}
          >
            <div className="mb-3">
              <TextInput value={q} onChange={setQ} placeholder="filter: kickoff, review, ship…" />
            </div>
            <div className="max-h-[320px] overflow-y-auto -mx-2" style={{ scrollbarWidth: 'thin' }}>
              {cmds.length === 0 && (
                <Empty icon={Terminal} title={`No command matches “${q.trim()}”`} hint="Names, one-liners and modules are searched. Try a shorter word." />
              )}
              {cmds.map((c) => (
                <div key={c.name} className="border-b border-(--line-1) last:border-b-0">
                  <button
                    type="button"
                    onClick={() => setOpenCmd(openCmd === c.name ? null : c.name)}
                    className="w-full grid grid-cols-[auto_1fr_auto] items-baseline gap-3 px-2 py-2 text-left cursor-pointer rounded-md transition-colors duration-200 hover:bg-(--bg-3) focus-visible:outline focus-visible:outline-2 focus-visible:outline-(--accent)"
                  >
                    <span className="text-[12.5px]" style={{ fontFamily: MONO, color: 'var(--accent)' }}>{c.name}</span>
                    <span className="text-[13px] truncate min-w-0" style={{ fontFamily: UI, color: 'var(--text-1)' }}>{c.short}</span>
                    <span className="text-[11px]" style={{ fontFamily: MONO, color: 'var(--text-3)' }}>{c.product}</span>
                  </button>
                  {openCmd === c.name && (
                    <div className="px-2 pb-3">
                      <p className="text-[12.5px] leading-[19px] mb-2" style={{ fontFamily: UI, color: 'var(--text-2)' }}>{c.detail}</p>
                      <Btn small onClick={() => ask(`what does ${c.name} do?`)}>Ask the face 🎙</Btn>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </HPanel>

          {/* agents roster */}
          <HPanel title="Agents" hint="an employee here is spawned for the task, then gone" actions={<Chip>all {ARC.agents.length}</Chip>}>
            {AGENT_GROUPS.map((g) => {
              const list = ARC.agents.filter((a) => a.group === g)
              if (!list.length) return null
              return (
                <div key={g} className="mb-3 last:mb-0">
                  <SectionLabel>
                    {g} · {list.length}
                  </SectionLabel>
                  <div className="flex flex-wrap gap-1.5">
                    {list.map((a) => (
                      <Btn key={a.name} small onClick={() => ask(`who is ${a.name}?`)} title={a.role}>
                        <span style={{ fontFamily: MONO }}>{a.name.replace('council-', 'c·')}</span>
                      </Btn>
                    ))}
                  </div>
                </div>
              )
            })}
          </HPanel>

          <HPanel title="The golden loop">
            <div className="flex flex-wrap items-center gap-1.5">
              {ARC.pipeline.stages.map((s, i) => (
                <span key={s.name} className="flex items-center gap-1.5">
                  <span title={s.what}>
                    <Chip>{s.name}</Chip>
                  </span>
                  {i < ARC.pipeline.stages.length - 1 && (
                    <span aria-hidden="true" className="text-[12px]" style={{ color: 'var(--text-3)' }}>→</span>
                  )}
                </span>
              ))}
            </div>
          </HPanel>
        </div>
      </div>
    </>
  )
}
