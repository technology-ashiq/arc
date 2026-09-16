// DEVELOP — "A phase closes on evidence, or it does not close."
// The execution harness: open a slice, prove it (tests green AND you
// saw it run), then try to close the phase. The Definition of Done
// (§8) is computed, not asserted — every slice proven and tests > 0,
// or the close is REFUSED and the refusal is a receipt that says
// exactly what is missing.
import { useState } from 'react'
import { ListChecks, Stack, Flag } from '@phosphor-icons/react'
import { UI, MONO, COLOR, Btn, Field, TextInput, PickRow, YoursBadge, Chip } from '../../ui/kit.jsx'
import { RoomHead, HPanel, KpiStrip, Empty } from '../bits.jsx'
import { useSpine } from '../useSpine.js'
import { spine } from '../../spine/store.js'
import { wsAppend, newRef } from '../../spine/workspace.js'
import { devPhases, slices } from '../../spine/registries.js'
import { FACTS } from '../../data/arcFacts.js'
import { LANES } from '../roomRegistry.js'
import { hhmm } from '../../spine/kinds.js'

const KINDS = new Set(['slice.opened', 'slice.proven', 'phase.closed', 'phase.refused'])
const TH = 'text-[11px] uppercase tracking-[0.08em] text-left py-2 pr-3 whitespace-nowrap'
const TD = 'text-[13px] leading-[19px] py-2 pr-3 align-top'

// the phase table: devPhases() (seed + closed-by-you) merged with every
// lane/phase that has a slice or a refusal — derived locally, because the
// fold drops a phase.refused on a phase that was never closed.
function phaseTable(sl) {
  const rows = devPhases()
  const byKey = new Map(rows.map((r) => [r.lane + '/' + r.phase, r]))
  const ensure = (lane, phase, iso) => {
    const k = lane + '/' + phase
    if (!byKey.has(k)) {
      const r = { phase, lane, capability: 'your phase', appetite: null, status: 'open', closed: false, refused: null, added: iso }
      rows.push(r)
      byKey.set(k, r)
    }
    return byKey.get(k)
  }
  for (const s of sl) ensure(s.lane, s.phase, s.added)
  for (const e of spine.events) {
    if (e.kind !== 'phase.refused' || !e.payload || !e.payload.lane) continue
    const r = ensure(e.payload.lane, e.payload.phase, e.iso)
    if (!r.closed) Object.assign(r, { refused: e.payload.missing || [], refusedId: e.id })
  }
  for (const r of rows) {
    const mine = sl.filter((s) => s.lane === r.lane && s.phase === r.phase)
    r.sliceCount = mine.length
    r.provenCount = mine.filter((s) => s.status === 'proven').length
  }
  return rows.sort((a, b) => (a.lane + a.phase).localeCompare(b.lane + b.phase))
}

export default function Develop() {
  useSpine()
  const [lane, setLane] = useState('develop')
  const [phase, setPhase] = useState('')
  const [name, setName] = useState('')
  const [proving, setProving] = useState(null)
  const [tests, setTests] = useState('')
  const [demo, setDemo] = useState('')
  const [pair, setPair] = useState('')
  const [msg, setMsg] = useState(null)

  const sl = slices()
  const phases = phaseTable(sl)
  const pairs = [...new Set(sl.map((s) => s.lane + '/' + s.phase))].sort()
  const chosen = pair && pairs.includes(pair) ? pair : pairs[0] || ''
  const trail = spine.events.filter((e) => KINDS.has(e.kind)).slice(-6).reverse()
  const closedCount = phases.filter((r) => r.closed).length
  const refusedCount = phases.filter((r) => !r.closed && r.refused).length
  const provenCount = sl.filter((s) => s.status === 'proven').length

  const openSlice = () => {
    const p = phase.trim()
    const n = name.trim()
    if (!p || !n) return
    wsAppend('slice.opened', 'develop', `slice opened: ${n} (${lane}/${p}) — plan first: even a paragraph beats nothing · status open until proven`, { sliceId: newRef('sl'), lane, phase: p, name: n })
    setName('')
    setMsg(`${n} is open under ${lane}/${p}. it counts against the phase until it is proven.`)
  }

  const prove = (s) => {
    const t = Number(tests)
    const d = demo.trim()
    if (!Number.isFinite(t) || t < 0 || !d) return
    wsAppend('slice.proven', 'develop', `slice proven: ${s.name} (${s.lane}/${s.phase}) · tests ${t} green · demo: ${d} · exit ticked — "should work" ≠ done`, { sliceId: s.sliceId, tests: t, demo: d, exit: 'ticked' })
    setProving(null)
    setTests('')
    setDemo('')
    setMsg(`${s.name} proven — ${t} tests green and you saw it run.`)
  }

  const closePhase = () => {
    if (!chosen) return
    const [l, p] = chosen.split('/')
    const mine = sl.filter((s) => s.lane === l && s.phase === p)
    const unproven = mine.filter((s) => s.status !== 'proven').length
    const sum = mine.reduce((a, s) => a + (s.proof ? Number(s.proof.tests) || 0 : 0), 0)
    const missing = []
    if (mine.length === 0) missing.push('no slices opened')
    if (unproven > 0) missing.push(`${unproven} slice${unproven > 1 ? 's' : ''} unproven`)
    if (mine.length > 0 && sum <= 0) missing.push('no tests recorded')
    if (missing.length === 0) {
      wsAppend('phase.closed', 'develop', `phase ${p} (${l}) closed on evidence · ${mine.length} slices proven · tests ${sum} green · evidence bundle sha256 manifest written`, { lane: l, phase: p, tests: sum, slices: mine.length })
      setMsg(`phase ${p} (${l}) closed — ${mine.length} slices proven, ${sum} tests green.`)
    } else {
      wsAppend('phase.refused', 'develop', `phase ${p} (${l}) NOT closed — missing: ${missing.join(', ')}`, { lane: l, phase: p, missing })
      setMsg(`phase ${p} (${l}) refused — missing: ${missing.join(', ')}. the refusal is a receipt too.`)
    }
  }

  const msgRefused = msg ? /refused/i.test(msg) : false

  return (
    <>
      <RoomHead
        title="A phase closes on evidence, or it does not close."
        hint="the execution harness — slices, their proofs, and the Definition of Done each one is measured against"
        right={<YoursBadge>develop · slices persisted</YoursBadge>}
      />

      <KpiStrip
        items={[
          { v: phases.length, l: 'Phases', sub: 'seed + yours' },
          { v: closedCount, l: 'Closed on evidence', sub: 'phase.closed receipts' },
          { v: refusedCount, l: 'Refused', sub: refusedCount ? 'the refusal names what is missing' : 'nothing refused', tone: refusedCount ? 'red' : undefined },
          { v: sl.length, l: 'Slices', sub: `${provenCount} proven · ${sl.length - provenCount} open` },
        ]}
      />

      <div className="grid grid-cols-1 xl:grid-cols-[1.35fr_1fr] gap-4 items-start">
        <div className="min-w-0">
          <HPanel title="Phases" hint="closed ✓ only on a phase.closed receipt · a refusal names what was missing">
            {phases.length === 0 ? (
              <Empty icon={Flag} title="No phase is invented here" hint="initiatives/develop/PLAN.md carries no phases table into this build and you have opened none." />
            ) : (
              <div className="overflow-x-auto -mx-2">
                <table className="w-full border-collapse min-w-[640px]">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--line-1)' }}>
                      {['phase', 'lane', 'capability', 'appetite', 'status', 'evidence'].map((h) => (
                        <th key={h} className={TH + (h === 'phase' ? ' pl-2' : '')} style={{ fontFamily: UI, fontWeight: 600, color: 'var(--text-3)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {phases.map((r) => (
                      <tr key={r.lane + '/' + r.phase} className="transition-colors duration-200 hover:bg-(--bg-3)" style={{ borderBottom: '1px solid var(--line-1)' }}>
                        <td className={TD + ' pl-2 tnum'} style={{ fontFamily: MONO, color: 'var(--text-1)' }}>{r.phase}</td>
                        <td className={TD} style={{ fontFamily: MONO, color: 'var(--text-2)' }}>{r.lane}</td>
                        <td className={TD + ' min-w-[200px] break-words'} style={{ fontFamily: UI, color: 'var(--text-1)' }}>
                          {r.capability}
                          {r.src && <span className="ml-2 text-[11px]" style={{ fontFamily: MONO, color: 'var(--text-3)' }}>{r.src}</span>}
                        </td>
                        <td className={TD + ' tnum whitespace-nowrap'} style={{ fontFamily: MONO, color: 'var(--text-2)' }}>{r.appetite || '—'}</td>
                        <td className={TD} style={{ fontFamily: UI, color: 'var(--text-2)' }}>{r.status}{typeof r.sliceCount === 'number' && r.sliceCount > 0 ? ` · ${r.provenCount}/${r.sliceCount} proven` : ''}</td>
                        <td className={TD + ' whitespace-nowrap'} style={{ fontFamily: UI, fontWeight: 500 }}>
                          {r.closed ? <span style={{ color: COLOR.cyan }}>closed ✓</span> : r.refused ? <span className="whitespace-normal" style={{ color: COLOR.red }}>refused — {r.refused.join(', ')}</span> : <span style={{ color: 'var(--text-3)' }}>not yet closed</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </HPanel>

          <HPanel title="Open a slice" hint="slice.opened → a named unit of a phase, open until proven">
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault()
                openSlice()
              }}
            >
              <div className="grid grid-cols-1 sm:grid-cols-[96px_1fr_auto] gap-3">
                <Field label="Phase"><TextInput value={phase} onChange={setPhase} placeholder="07" mono /></Field>
                <Field label="Slice name"><TextInput value={name} onChange={setName} placeholder="checkpoint health check reads risk globs from rules" /></Field>
                <div className="flex items-end"><Btn tone="primary" onClick={openSlice}>Open →</Btn></div>
              </div>
              <Field label="Lane"><PickRow options={LANES} value={lane} onPick={setLane} small /></Field>
            </form>
            {msg && (
              <div className="mt-3 text-[12.5px] leading-[19px] break-words" style={{ fontFamily: UI, color: msgRefused ? COLOR.red : COLOR.green }}>{msg}</div>
            )}
          </HPanel>

          <HPanel title="Slices" hint="proven = tests green AND you saw it run" actions={<Chip>{provenCount}/{sl.length} proven</Chip>}>
            {sl.length === 0 && <Empty icon={Stack} title="No slice is open" hint="A phase with nothing in it has nothing to prove. Open one above." />}
            <div className="space-y-2.5">
              {sl.map((s) => (
                <div key={s.sliceId} className="p-3.5 min-w-0" style={{ background: 'var(--well)', border: '1px solid var(--line-1)', borderRadius: 'var(--r-md)' }}>
                  <div className="flex items-center gap-2.5 flex-wrap mb-1">
                    <span className="text-[11.5px]" style={{ fontFamily: MONO, color: 'var(--text-3)' }}>{s.lane}/{s.phase}</span>
                    <b className="text-[13.5px] min-w-0 break-words" style={{ fontFamily: UI, fontWeight: 600, color: 'var(--text-1)' }}>{s.name}</b>
                    <Chip tone={s.status === 'proven' ? 'cyan' : undefined}>{s.status}</Chip>
                    <YoursBadge>yours</YoursBadge>
                  </div>
                  {s.proof && (
                    <div className="text-[12px] leading-[18px] break-words" style={{ fontFamily: UI, color: 'var(--text-2)' }}>
                      tests <span className="tnum" style={{ fontFamily: MONO, color: 'var(--text-1)' }}>{s.proof.tests}</span> green · demo: {s.proof.demo} · exit {s.proof.exit}
                    </div>
                  )}
                  {s.status === 'open' && proving !== s.sliceId && <div className="mt-2.5"><Btn small onClick={() => setProving(s.sliceId)}>Prove</Btn></div>}
                  {s.status === 'open' && proving === s.sliceId && (
                    <form
                      className="grid grid-cols-1 sm:grid-cols-[96px_1fr_auto_auto] gap-2 items-end mt-3"
                      onSubmit={(e) => {
                        e.preventDefault()
                        prove(s)
                      }}
                    >
                      <Field label="Tests green"><TextInput value={tests} onChange={setTests} placeholder="12" mono /></Field>
                      <Field label="Demo — what you saw run"><TextInput value={demo} onChange={setDemo} placeholder="/arc-phase-done 07 printed the §8 checklist all ticked" /></Field>
                      <Btn tone="primary" onClick={() => prove(s)}>Record proof</Btn>
                      <Btn onClick={() => setProving(null)}>Cancel</Btn>
                    </form>
                  )}
                </div>
              ))}
            </div>
          </HPanel>

          <HPanel title="Close a phase" hint="DoD computed, never asserted · a refusal is a receipt too — it says exactly what is missing">
            {pairs.length === 0 ? (
              <Empty icon={ListChecks} title="Nothing to put to the Definition of Done" hint="No lane/phase has a slice yet. Open a slice and prove it first." />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-end">
                <Field label="Lane / phase"><PickRow options={pairs} value={chosen} onPick={setPair} /></Field>
                <Btn tone="primary" onClick={closePhase}>Close on evidence →</Btn>
              </div>
            )}
          </HPanel>

          {trail.length > 0 && (
            <HPanel title="The trail" hint="slice.opened · slice.proven · phase.closed · phase.refused — last 6">
              <div className="-mx-2">
                {trail.map((e) => (
                  <div key={e.id} className="grid grid-cols-[44px_1fr_auto] items-baseline gap-x-3 px-2 py-2 text-[13px] leading-[20px] transition-colors duration-200 hover:bg-(--bg-3)" style={{ borderBottom: '1px solid var(--line-1)', borderRadius: 'var(--r-sm)' }}>
                    <span className="text-[11.5px] tnum" style={{ fontFamily: MONO, color: 'var(--text-3)' }}>{hhmm(e.t)}</span>
                    <span className="min-w-0 break-words" style={{ fontFamily: UI, color: e.kind === 'phase.refused' ? COLOR.red : 'var(--text-1)' }}>{e.text}</span>
                    <span className="text-[11px] shrink-0" style={{ fontFamily: MONO, color: 'var(--text-3)' }}>⌗ {String(e.id).slice(-6)}</span>
                  </div>
                ))}
              </div>
            </HPanel>
          )}
        </div>

        <div className="min-w-0">
          <HPanel title="Definition of Done — §8" hint="computed, never asserted">
            <div className="text-[13px] leading-[20px] space-y-1.5" style={{ fontFamily: UI, color: 'var(--text-2)' }}>
              {FACTS.develop.dod.rules.slice(0, 8).map((r, i) => <div key={i} className="break-words">· {r.replace(/^-\s*/, '')}</div>)}
            </div>
            <div className="mt-3 text-[12px] leading-[18px]" style={{ fontFamily: UI, color: 'var(--text-3)' }}>{FACTS.develop.dod.enforcer.replace(/^>\s*/, '')}</div>
            <div className="mt-1.5 text-[11px] break-all" style={{ fontFamily: MONO, color: 'var(--text-3)' }}>{FACTS.develop.dod.source}</div>
          </HPanel>

          <HPanel title="Where the harness stands" hint="initiatives/develop/PROGRESS.md">
            <div className="flex items-center gap-2.5 mb-2 flex-wrap">
              <Chip tone="blue" mono>{FACTS.develop.progress.header}</Chip>
              <span className="text-[13px] min-w-0 break-words" style={{ fontFamily: UI, fontWeight: 600, color: 'var(--text-1)' }}>{FACTS.develop.plan.h1.replace(/^#\s*/, '')}</span>
            </div>
            <div className="text-[13px] leading-[20px] mb-2 break-words" style={{ fontFamily: UI, color: 'var(--text-2)' }}>{FACTS.develop.progress.currentSlice}</div>
            <div className="text-[12px] leading-[18px] break-words" style={{ fontFamily: UI, color: 'var(--text-3)' }}>{FACTS.develop.plan.goal}</div>
          </HPanel>

          <HPanel title="Debt ledger" hint="initiatives/develop/DEBT.md">
            <div className="text-[12px] leading-[18px] mb-3" style={{ fontFamily: UI, color: 'var(--text-3)' }}>{FACTS.develop.debt.rule.replace(/^>\s*/, '')}</div>
            <div className="space-y-2">
              {FACTS.develop.debt.entries.slice(0, 8).map((d, i) => (
                <div key={i} className="grid grid-cols-[auto_1fr] items-start gap-2.5">
                  <Chip tone={d.status === 'open' ? 'amber' : undefined}>{d.status}</Chip>
                  <span className="text-[13px] leading-[20px] min-w-0 break-words" style={{ fontFamily: UI, color: 'var(--text-2)' }}>{d.item}</span>
                </div>
              ))}
            </div>
          </HPanel>
        </div>
      </div>
    </>
  )
}
