// EVOLVE — "Measured, or it did not improve."
// Champion against challenger on a declared surface, with a sample
// floor per arm and a holdout. Batches here are SIMULATED and say so.
// The verdict is one pinned formula (newcombe-wilson-difference-v1),
// computed once when BOTH arms reach the floor. NO PROPOSAL is a
// first-class result. A CHALLENGER win lands only as a reviewed diff
// on YOUR stamp; rollback is propose-only in both directions.
import { useState } from 'react'
import { Flask } from '@phosphor-icons/react'
import { UI, MONO, FONT, COLOR, Btn, Field, TextInput, PickRow, SimBadge, YoursBadge, Meter, Chip } from '../../ui/kit.jsx'
import { RoomHead, HPanel, KpiStrip, Empty } from '../bits.jsx'
import { useSpine } from '../useSpine.js'
import { spine } from '../../spine/store.js'
import { wsAppend, wsRequestApproval, newRef } from '../../spine/workspace.js'
import { experiments, verdictFor } from '../../spine/registries.js'
import { FACTS } from '../../data/arcFacts.js'
import { hhmm } from '../../spine/kinds.js'

const KINDS = new Set(['experiment.opened', 'experiment.measured', 'experiment.concluded'])
const METRICS = ['ctr', 'approval-rate', 'pass-rate', 'reply-rate']
const FLOORS = [
  { value: 50, label: '50' },
  { value: 200, label: '200' },
  { value: 1900, label: "1900 — arc's honest example floor" },
]
const HOLDOUTS = [
  { value: 10, label: '10%' },
  { value: 20, label: '20%' },
  { value: 30, label: '30%' },
]
// status → chip tone. open = neutral progress, landed = it passed on your stamp; concluded stays quiet
const STATUS_TONE = { open: 'blue', landed: 'green' }
const VERDICT_COLOR = { CHALLENGER: COLOR.cyan, CHAMPION: 'var(--text-1)', 'NO PROPOSAL': COLOR.amber }
const hash = (s) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7)
const pct = (n) => (n * 100).toFixed(2) + '%'
// an item card inside a panel
const WELL = { background: 'var(--well)', border: '1px solid var(--line-1)', borderRadius: 'var(--r-md)' }

// one arm: progress toward the per-arm floor, then hits/samples (rate)
function Arm({ label, n, hits, floor }) {
  return (
    <div className="flex items-center gap-3 min-w-0">
      <span className="w-[136px] shrink-0 truncate text-[12px]" style={{ fontFamily: UI, color: 'var(--text-2)' }}>{label}</span>
      <div className="flex-1 min-w-0"><Meter value={Math.min(1, n / floor)} tone="blue" /></div>
      <span className="w-[128px] shrink-0 text-right text-[11.5px] tnum" style={{ fontFamily: MONO, color: 'var(--text-2)' }}>{hits}/{n} ({n ? pct(hits / n) : '—'})</span>
    </div>
  )
}

export default function Evolve() {
  useSpine()
  const [name, setName] = useState('')
  const [surface, setSurface] = useState('')
  const [metric, setMetric] = useState('ctr')
  const [hypothesis, setHypothesis] = useState('')
  const [champion, setChampion] = useState('current')
  const [challenger, setChallenger] = useState('')
  const [floor, setFloor] = useState(200)
  const [holdout, setHoldout] = useState(20)
  const [msg, setMsg] = useState(null)

  const rows = experiments()
  const trail = spine.events.filter((e) => KINDS.has(e.kind)).slice(-6).reverse()
  const batchesFor = (expId) => spine.events.filter((e) => e.kind === 'experiment.measured' && e.payload && e.payload.expId === expId).length
  const openN = rows.filter((x) => x.status === 'open').length
  const concludedN = rows.filter((x) => x.status === 'concluded').length
  const landedN = rows.filter((x) => x.status === 'landed').length
  const batchesN = rows.reduce((n, x) => n + batchesFor(x.expId), 0)

  const open = () => {
    const n = name.trim()
    const s = surface.trim()
    const c = challenger.trim()
    if (!n || !s || !c) return
    const h = hypothesis.trim() || 'not stated'
    wsAppend('experiment.opened', 'evolve', `experiment opened: ${n} on ${s} · metric ${metric} · ${champion} vs ${c} · floor ${floor}/arm · holdout ${holdout}% · split 50/50 · hypothesis: ${h} — measured, or it did not improve`, {
      expId: newRef('exp'), name: n, surface: s, metric, hypothesis: h, champion, challenger: c, floor, holdout, split: 50,
    })
    setName('')
    setSurface('')
    setHypothesis('')
    setChallenger('')
    setMsg(`${n} is open. no verdict exists until both arms reach ${floor} — measure batches until then.`)
  }

  const measure = (x) => {
    const h = hash(x.expId + ':' + batchesFor(x.expId))
    const a = 40 + (h % 30)
    const b = 40 + ((h >> 3) % 30)
    const baseRate = 0.03 + (h % 9) / 100
    const lift = (((h >> 5) % 7) - 3) / 100
    const hitsA = Math.round(a * baseRate)
    const hitsB = Math.max(0, Math.round(b * (baseRate + lift)))
    wsAppend('experiment.measured', 'evolve', `batch measured (SIMULATED): champion +${a} (${hitsA} hits) · challenger +${b} (${hitsB} hits)`, { expId: x.expId, a, b, hitsA, hitsB })
  }

  const conclude = (x) => {
    const v = verdictFor(x)
    if (!v.ready) return
    const winner = v.verdict === 'CHALLENGER' ? x.challenger : x.champion
    const tail = v.verdict === 'CHALLENGER' ? ` → landing ${x.challenger} on ${x.surface} is in your inbox as a reviewed diff` : ' — nothing lands; the champion stays'
    wsAppend('experiment.concluded', 'evolve', `${x.name} concluded: ${v.verdict} · diff ${pct(v.diff)} · CI [${pct(v.lo)}, ${pct(v.hi)}] · newcombe-wilson-difference-v1 · computed once at ${x.floor}/arm${tail}`, {
      expId: x.expId, verdict: v.verdict, winner, diff: v.diff, lo: v.lo, hi: v.hi,
    })
    if (v.verdict === 'CHALLENGER') {
      wsRequestApproval({
        title: `evolve: land ${x.challenger} on ${x.surface}`,
        tag: 'evolve · reviewed diff',
        subject: 'evolve.conclude',
        data: { expId: x.expId },
        facts: [
          { k: 'council', v: `newcombe-wilson-difference-v1 · diff ${pct(v.diff)} · CI [${pct(v.lo)}, ${pct(v.hi)}] · computed once at floor ${x.floor}/arm` },
          { k: 'money', v: 'no spend — the winner is a diff, reviewed' },
          { k: 'kill', v: 'rollback is propose-only in both directions (ADR-0305)' },
        ],
      })
      setMsg(`${x.name}: CHALLENGER — the landing proposal is in your inbox. nothing merged itself.`)
    } else setMsg(`${x.name}: ${v.verdict} — nothing lands; the champion stays. that is a result, not a failure.`)
  }

  return (
    <>
      <RoomHead
        title="Measured, or it did not improve."
        hint="Champion against challenger, with a sample floor and a holdout — the winner lands as a reviewed diff, never self-merged"
        right={<YoursBadge>evolve · experiments persisted</YoursBadge>}
      />

      <KpiStrip
        items={[
          { v: openN, l: 'Open experiments', sub: openN ? 'measure until both arms reach the floor' : 'nothing improves without one' },
          { v: concludedN, l: 'Concluded', sub: 'verdict computed once' },
          { v: landedN, l: 'Landed on your stamp', sub: 'reviewed diffs, never self-merged' },
          { v: batchesN, l: 'Batches measured', sub: 'simulated, labeled', tone: batchesN ? 'violet' : undefined },
        ]}
      />

      <div className="grid grid-cols-1 xl:grid-cols-[1.35fr_1fr] gap-4 items-start">
        <div className="min-w-0">
          <HPanel title="Open an experiment" hint="experiment.opened → one declared surface, one metric, one hypothesis">
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault()
                open()
              }}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Name"><TextInput value={name} onChange={setName} placeholder="shorter commit subject" /></Field>
                <Field label="Surface" hint="file path"><TextInput value={surface} onChange={setSurface} placeholder="prompts/commit-msg.md" mono /></Field>
              </div>
              <Field label="Hypothesis"><TextInput value={hypothesis} onChange={setHypothesis} placeholder="a 50-char subject line raises review approval-rate" /></Field>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Champion label"><TextInput value={champion} onChange={setChampion} placeholder="current" /></Field>
                <Field label="Challenger label"><TextInput value={challenger} onChange={setChallenger} placeholder="v2-terse" /></Field>
              </div>
              <Field label="Metric"><PickRow small options={METRICS} value={metric} onPick={setMetric} /></Field>
              <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
                <Field label="Per-arm floor"><PickRow small options={FLOORS} value={floor} onPick={setFloor} /></Field>
                <Field label="Holdout"><PickRow small options={HOLDOUTS} value={holdout} onPick={setHoldout} /></Field>
              </div>
              <div className="flex items-center gap-3 flex-wrap pt-1">
                <Btn tone="primary" onClick={open}>Open experiment →</Btn>
                <span className="text-[12px]" style={{ fontFamily: UI, color: 'var(--text-3)' }}>split 50/50, fixed horizon, verdict computed once</span>
              </div>
            </form>
            {msg && (
              <p className="mt-3 text-[12.5px] leading-[18px]" style={{ fontFamily: UI, color: 'var(--text-2)' }}>{msg}</p>
            )}
          </HPanel>

          <HPanel title="Experiments" hint={`${rows.length} · open, concluded, landed — status moves only on receipts and your stamp`}>
            {rows.length === 0 && (
              <Empty icon={Flask} title="No experiment is open" hint="Nothing in arc improves without one. Declare a surface, a metric and a hypothesis above." />
            )}
            <div className="space-y-2">
              {rows.map((x) => {
                const v = verdictFor(x)
                const word = x.verdict || (v.ready ? v.verdict : null)
                return (
                  <div key={x.expId} className="p-3.5 min-w-0" style={WELL}>
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      <b className="text-[13.5px]" style={{ fontFamily: UI, fontWeight: 600, color: 'var(--text-1)' }}>{x.name}</b>
                      <Chip tone={STATUS_TONE[x.status]}>{x.status}{x.rolledBack ? ' · rolled back' : ''}</Chip>
                      <span className="text-[11.5px] min-w-0 break-all" style={{ fontFamily: MONO, color: 'var(--text-3)' }}>{x.surface} · {x.metric} · holdout {x.holdout}%</span>
                      <SimBadge>SIMULATED batches</SimBadge>
                    </div>
                    <p className="text-[12.5px] leading-[18px] mb-3 break-words" style={{ fontFamily: UI, color: 'var(--text-2)' }}>{x.hypothesis}</p>
                    <div className="space-y-1.5 mb-3">
                      <Arm label={`champion · ${x.champion}`} n={x.samples.a} hits={x.hits.a} floor={x.floor} />
                      <Arm label={`challenger · ${x.challenger}`} n={x.samples.b} hits={x.hits.b} floor={x.floor} />
                    </div>
                    {v.ready ? (
                      <div className="flex items-baseline gap-x-3 gap-y-1 flex-wrap mb-3">
                        <span className="text-[22px] leading-[26px] tracking-[-0.01em]" style={{ fontFamily: FONT, fontWeight: 600, color: VERDICT_COLOR[word] || 'var(--text-1)' }}>{word}</span>
                        <span className="text-[11.5px] tnum" style={{ fontFamily: MONO, color: 'var(--text-3)' }}>diff {pct(v.diff)} · CI [{pct(v.lo)}, {pct(v.hi)}]</span>
                        <span className="text-[11.5px]" style={{ fontFamily: MONO, color: 'var(--text-3)' }}>newcombe-wilson-difference-v1, computed once</span>
                        {word === 'NO PROPOSAL' && <span className="text-[12px]" style={{ fontFamily: UI, color: COLOR.amber }}>the interval spans zero — a first-class result, not a failed test</span>}
                      </div>
                    ) : (
                      <p className="text-[12px] mb-3" style={{ fontFamily: UI, color: 'var(--text-3)' }}>{v.reason} · no verdict exists below the floor</p>
                    )}
                    <div className="flex gap-2 flex-wrap items-center">
                      {x.status === 'open' && !v.ready && <Btn small onClick={() => measure(x)}>Measure a batch</Btn>}
                      {x.status === 'open' && v.ready && <Btn small onClick={() => conclude(x)}>Conclude — {v.verdict === 'CHALLENGER' ? 'propose landing' : 'record it'}</Btn>}
                      {x.status === 'concluded' && x.verdict !== 'CHALLENGER' && <span className="text-[12px]" style={{ fontFamily: UI, color: 'var(--text-3)' }}>nothing lands; the champion stays</span>}
                      {x.status === 'concluded' && x.verdict === 'CHALLENGER' && !x.rolledBack && <span className="text-[12px]" style={{ fontFamily: UI, color: COLOR.amber }}>landing proposal → inbox · waiting on your stamp</span>}
                      {x.status === 'landed' && <span className="text-[12px]" style={{ fontFamily: UI, color: COLOR.green }}>landed on your stamp as a reviewed diff · rollback is propose-only</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          </HPanel>

          {trail.length > 0 && (
            <HPanel title="The trail" hint="the last 6 of experiment.opened, measured and concluded">
              <div className="-mx-2">
                {trail.map((e) => (
                  <div key={e.id} className="grid grid-cols-[44px_1fr_auto] items-baseline gap-x-3 px-2 py-[7px] border-b border-(--line-1) last:border-b-0 transition-colors duration-200 hover:bg-(--bg-3)" style={{ borderRadius: 'var(--r-sm)' }}>
                    <span className="text-[11.5px] tnum" style={{ fontFamily: MONO, color: 'var(--text-3)' }}>{hhmm(e.t)}</span>
                    <span className="text-[13px] leading-[20px] min-w-0 break-words" style={{ fontFamily: UI, color: 'var(--text-1)' }}>{e.text}</span>
                    <span className="text-[11px]" style={{ fontFamily: MONO, color: 'var(--text-3)' }}>⌗ {String(e.id).slice(-6)}</span>
                  </div>
                ))}
              </div>
            </HPanel>
          )}
        </div>

        <div className="min-w-0">
          <HPanel title="The rules">
            <div className="-mx-2">
              {FACTS.evolve.rules.slice(0, 7).map((r, i) => (
                <div key={i} className="px-2 py-2 min-w-0 border-b border-(--line-1) last:border-b-0" style={{ borderRadius: 'var(--r-sm)' }}>
                  <div className="text-[12.5px] leading-[19px] break-words" style={{ fontFamily: UI, color: 'var(--text-2)' }}>{r.text}</div>
                  <div className="text-[11px] mt-0.5 truncate" style={{ fontFamily: MONO, color: 'var(--text-3)' }}>{r.src}</div>
                </div>
              ))}
            </div>
          </HPanel>

          <HPanel title="Experiment contract" hint="the evolve section of a manifest">
            <div className="space-y-1.5">
              {FACTS.evolve.registry.fields.map((f, i) => (
                <div key={i} className="text-[11.5px] leading-[18px] break-words" style={{ fontFamily: MONO, color: 'var(--text-2)' }}>{f}</div>
              ))}
            </div>
            <div className="mt-3 text-[11px] truncate" style={{ fontFamily: MONO, color: 'var(--text-3)' }}>{FACTS.evolve.registry.src}</div>
          </HPanel>

          <HPanel title="The lane" hint="initiatives/evolve/PLAN.md">
            <div className="text-[13px] leading-[19px] mb-1.5 break-words" style={{ fontFamily: UI, fontWeight: 600, color: 'var(--text-1)' }}>{FACTS.evolve.plan.h1.replace(/^#\s*/, '')}</div>
            <p className="text-[12.5px] leading-[19px]" style={{ fontFamily: UI, color: 'var(--text-2)' }}>
              {FACTS.evolve.plan.goal} {FACTS.evolve.plan.goalLines.slice(0, 3).join(' ')}
            </p>
          </HPanel>
        </div>
      </div>
    </>
  )
}
