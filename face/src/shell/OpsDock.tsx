// OpsDock.tsx -- the WORK door inside a room (face v2 Phase 05; ADR-1326 · ADR-1339 · REQ-07).
//
// A room that names ops in its ops.mjs gets this dock under its View. Each op is one card: its fields, a Plan button
// that asks the door for the dry run, the plan the door answered (the exact command, what apply will run, the file
// diff, the cost), and a Run button that applies THAT plan. A human-run op needs the owner's tick first. While the
// tool runs, its own lines stream in; when it ends, the card names the receipt the door read off the spine, or the
// tool's refusal in its own words.
//
// Every decision is in lib/ops.mjs, where node can hold it; this file runs the effects and draws. It never builds a
// command, a payload or a verdict -- the door and the lane's own tool do that.
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Door } from '../lib/door.mjs'
import {
  IDLE, RUN_POLL_MS, applyArgs, applyBlocked, applyFailed, applyStarted, callFailed, fieldCount, opCards, planBlocked, planInput,
  planSettled, planStarted, polling, runSettled, runVerdict,
} from '../lib/ops.mjs'
import type { OpCard, OpState } from '../lib/ops.mjs'
import { Btn, Chip, Field, MONO, Panel, PanelTitle, PickRow, Receipt, TextInput, UI } from '../ui/kit'

export default function OpsDock({ ops, door, onApplied }: { ops: readonly unknown[]; door: Door; onApplied: () => void }) {
  const [registry, setRegistry] = useState<unknown>(null)
  const [loadError, setLoadError] = useState('')
  useEffect(() => {
    const ac = new AbortController()
    setRegistry(null)
    setLoadError('')
    door
      .ops(ac.signal)
      .then((r: unknown) => { if (!ac.signal.aborted) setRegistry(r) })
      .catch((err: { human?: string; message?: string }) => { if (!ac.signal.aborted) setLoadError(String(err?.human ?? err?.message ?? 'the door did not answer')) })
    return () => ac.abort()
  }, [door])

  const cards = opCards(ops, registry)
  if (cards.length === 0) return null
  return (
    <section data-ops-dock className="mt-6">
      <Panel>
        <PanelTitle>Work you can do in this room</PanelTitle>
        <p className="-mt-2 mb-4 text-[12.5px] leading-[19px]" style={{ fontFamily: UI, color: 'var(--text-3)' }}>
          Each button runs arc's own tool -- the same command you would type -- and nothing else. Plan first: the door shows
          exactly what will run and what it costs, and writes nothing until you press Run.
        </p>
        {loadError ? <p className="mb-3 text-[12px]" style={{ fontFamily: MONO, color: 'var(--red)' }}>ops list refused: {loadError}</p> : null}
        <div className="space-y-4">
          {cards.map((c) => <OpCardView key={c.id} card={c} door={door} onApplied={onApplied} />)}
        </div>
      </Panel>
    </section>
  )
}

function OpCardView({ card, door, onApplied }: { card: OpCard; door: Door; onApplied: () => void }) {
  const [values, setValues] = useState<Record<string, string>>({})
  const [st, setSt] = useState<OpState>(IDLE)
  const [confirmed, setConfirmed] = useState(false)
  // Only the newest plan's answers land: a slow answer to an older Plan click must not overwrite a newer one.
  const attempt = useRef(0)

  const setValue = useCallback((name: string, v: string) => {
    setValues((prev) => ({ ...prev, [name]: v }))
    // A changed field makes the held plan a plan for something else: it is dropped, and so is the tick -- and so is
    // any plan still answering, or its answer would put the OLD values' plan back on the card (Phase 05 attack).
    attempt.current++
    setSt(IDLE)
    setConfirmed(false)
  }, [])

  const onPlan = () => {
    const n = ++attempt.current
    setSt(planStarted())
    setConfirmed(false)
    door
      .opPlan(card.id, planInput(card, values))
      .then((p: unknown) => { if (n === attempt.current) setSt(planSettled(p)) })
      .catch((err: unknown) => { if (n === attempt.current) setSt(callFailed(err)) })
  }

  const onRun = () => {
    if (st.phase !== 'planned') return
    const { planId, confirm } = applyArgs(card, st.plan, confirmed)
    setSt(applyStarted(st))
    door
      .opApply(card.id, planId, confirm)
      .then((run: unknown) => setSt((s) => runSettled(s, run)))
      .catch((err: unknown) => setSt((s) => applyFailed(s, err, planId)))
  }

  // The run streams by polling the door while the tool is still writing.
  const planId = 'plan' in st ? st.plan.planId : ''
  const live = polling(st)
  useEffect(() => {
    if (!live || !planId) return
    const ac = new AbortController()
    const t = window.setInterval(() => {
      door.opRun(planId, ac.signal).then((run: unknown) => setSt((s) => runSettled(s, run))).catch(() => { /* the next tick asks again */ })
    }, RUN_POLL_MS)
    return () => { ac.abort(); window.clearInterval(t) }
  }, [live, planId, door])

  // A run that wrote its receipt changes what the room shows: the room reads again.
  const landed = st.phase === 'done' && st.run.receipt !== null
  useEffect(() => { if (landed) onApplied() }, [landed, onApplied])

  if (card.state !== 'ready') {
    return (
      <div data-op={card.id} data-op-state={card.state} className="text-[12.5px]" style={{ fontFamily: MONO, color: 'var(--text-3)' }}>
        {card.id}: {card.state === 'absent' ? card.why : 'loading the door op list'}
      </div>
    )
  }

  const blockedPlan = planBlocked(card, values)
  const blockedRun = applyBlocked(card, st, confirmed, door.asOf)
  return (
    <div data-op={card.id} data-op-state={st.phase} className="rounded-xl border p-4" style={{ borderColor: 'var(--line-2)', background: 'var(--bg-3)' }}>
      <div className="flex flex-wrap items-center gap-2 mb-1">
        <span className="text-[14px]" style={{ fontFamily: UI, fontWeight: 600, color: 'var(--text-1)' }}>{card.label}</span>
        {card.humanRun ? <Chip tone="amber">human-run</Chip> : null}
        {card.spends ? <Chip tone="amber">spends money</Chip> : null}
        {card.touchesFiles ? <Chip tone="amber">writes a proposal branch</Chip> : null}
        {card.touchesOs ? <Chip tone="amber">registers with this machine</Chip> : null}
        {card.touchesTree ? <Chip tone="amber">writes the lane's tracker</Chip> : null}
        <Chip mono>{card.receiptKind}</Chip>
      </div>
      <p className="mb-3 text-[12.5px] leading-[19px]" style={{ fontFamily: UI, color: 'var(--text-3)' }}>{card.hint}</p>

      {/* Locked while a plan is answering or a run is going: an edit then would plan or run something else. */}
      <fieldset disabled={st.phase === 'planning' || live} className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3 min-w-0 border-0 p-0 m-0">
        {card.fields.map((f) => (
          <Field key={f.name} label={f.label} className={f.type === 'select' ? 'md:col-span-2' : ''} hint={fieldCount(f, values[f.name]) || undefined}>
            {f.type === 'select' ? (
              <PickRow small label={f.label} options={f.options} value={values[f.name] ?? ''} onPick={(v) => setValue(f.name, v)} />
            ) : (
              <TextInput mono={f.type === 'int'} value={values[f.name] ?? ''} placeholder={f.placeholder} onChange={(v) => setValue(f.name, v)} />
            )}
          </Field>
        ))}
      </fieldset>

      <div className="flex flex-wrap items-center gap-2">
        <Btn small tone="ghost" onClick={onPlan} disabled={blockedPlan !== null || st.phase === 'planning' || live} title={blockedPlan ?? undefined}>
          Plan it
        </Btn>
        {card.humanRun ? (
          <label className="inline-flex items-center gap-2 text-[12px]" style={{ fontFamily: UI, color: 'var(--text-2)' }}>
            <input data-op-confirm type="checkbox" checked={confirmed} disabled={st.phase !== 'planned'} onChange={(e) => setConfirmed(e.target.checked)} />
            I read the plan, and I am running this myself
          </label>
        ) : null}
        <Btn small tone="primary" onClick={onRun} disabled={blockedRun !== null} title={blockedRun ?? undefined}>
          Run it
        </Btn>
        {blockedPlan && st.phase === 'idle' ? <span className="text-[11.5px]" style={{ fontFamily: UI, color: 'var(--text-3)' }}>{blockedPlan}</span> : null}
      </div>

      <OpStateView st={st} />
    </div>
  )
}

function Lines({ lines, tone }: { lines: string[]; tone?: string }) {
  if (lines.length === 0) return null
  return (
    <pre className="mt-2 max-h-[220px] overflow-auto rounded-lg p-3 text-[11.5px] leading-[17px] whitespace-pre-wrap break-words" style={{ fontFamily: MONO, background: 'var(--well)', color: tone ?? 'var(--text-2)' }}>
      {lines.join('\n')}
    </pre>
  )
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex flex-wrap gap-x-2 text-[12px] leading-[18px]">
      <span style={{ fontFamily: UI, color: 'var(--text-3)', minWidth: '5.5rem' }}>{k}</span>
      <span className="min-w-0 break-all" style={{ fontFamily: MONO, color: 'var(--text-1)' }}>{v}</span>
    </div>
  )
}

function OpStateView({ st }: { st: OpState }) {
  if (st.phase === 'idle') return null
  if (st.phase === 'planning') return <p data-op-note className="mt-3 text-[12px]" style={{ fontFamily: UI, color: 'var(--text-3)' }}>planning -- the tool's dry run is answering</p>
  if (st.phase === 'error') return <p data-op-refused className="mt-3 text-[12px]" style={{ fontFamily: MONO, color: 'var(--red)' }}>{st.code}: {st.human}</p>
  if (st.phase === 'plan-refused') {
    return (
      <div data-op-refused className="mt-3">
        <p className="text-[12px]" style={{ fontFamily: UI, color: 'var(--red)' }}>The tool refused the plan (exit {st.refusal.exit ?? '?'}), in its own words:</p>
        <Lines lines={[...st.refusal.stderr, ...st.refusal.stdout]} tone="var(--text-1)" />
        {st.refusal.dropped > 0 ? <p className="text-[11px]" style={{ fontFamily: UI, color: 'var(--text-3)' }}>{st.refusal.dropped} characters of the tool's earlier output not kept</p> : null}
      </div>
    )
  }
  const plan = st.plan
  return (
    <div className="mt-3 space-y-1.5" data-op-plan={plan.planId}>
      <Row k="plan ran" v={plan.command} />
      <Row k="run will" v={plan.apply} />
      <Row k="files" v={plan.diff} />
      <Row k="cost" v={plan.estimate} />
      <Row k="receipt" v={plan.receiptKind} />
      <Lines lines={[...plan.output, ...plan.notes]} />
      {plan.outputDropped > 0 ? <p className="text-[11px]" style={{ fontFamily: UI, color: 'var(--text-3)' }}>{plan.outputDropped} characters of the tool's earlier output not kept</p> : null}
      {st.phase === 'planned' && st.error ? <p data-op-refused className="text-[12px]" style={{ fontFamily: MONO, color: 'var(--red)' }}>{st.error}</p> : null}
      {st.phase === 'applying' ? <p className="text-[12px]" style={{ fontFamily: UI, color: 'var(--text-3)' }}>starting the run</p> : null}
      {st.phase === 'running' || st.phase === 'done' ? (
        <div data-op-run={st.run.state}>
          <Lines lines={st.run.lines.map((l) => l.t)} />
          {st.run.linesDropped > 0 || st.run.bytesDropped > 0 ? <p className="text-[11px]" style={{ fontFamily: UI, color: 'var(--text-3)' }}>{st.run.linesDropped} earlier line(s) and {st.run.bytesDropped} characters of the tool's output not kept</p> : null}
          <p className="mt-2 text-[12.5px]" style={{ fontFamily: MONO, color: st.run.ok ? 'var(--text-1)' : 'var(--red)' }}>{runVerdict(st.run)}</p>
          {st.run.receipt ? (
            <div className="mt-1.5" data-op-receipt={st.run.receipt.id}>
              <Receipt tone={st.run.ok ? 'accent' : 'amber'} title={st.run.receipt.ts}>{st.run.receipt.kind} · {st.run.receipt.id}</Receipt>
            </div>
          ) : null}
          {st.run.refusal ? <Lines lines={[...st.run.refusal.stderr, ...st.run.refusal.stdout]} tone="var(--text-1)" /> : null}
        </div>
      ) : null}
    </div>
  )
}
