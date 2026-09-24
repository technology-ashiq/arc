// SessionDock.tsx -- the SESSION door inside a room (face v2 Phase 06; ADR-1326 · REQ-08).
//
// A room whose id carries session verbs in the door's registry gets this dock under its View. Each verb is one card:
// its fields, a driver pick, and a Start button. Below them, the room's recent sessions, each with an Attach button
// that reads the run back -- its lines as it writes them, its state, the receipts the door credited to it.
//
// A SESSION STARTS FROM THE START BUTTON'S CLICK AND NOTHING ELSE. Mounting reads the registry; Attach reads a run;
// neither can start one, and door.sessionStart is called in onStart alone. The browser flow counts the door's start
// requests across mount, reload and attach and requires 0 (face/scripts/flows.mjs).
//
// Every decision is in lib/sessions.mjs, where node can hold it; this file runs the effects and draws.
import { useEffect, useRef, useState } from 'react'
import type { Door } from '../lib/door.mjs'
import {
  SESSION_IDLE, driverChoices, pollDelay, roomRuns, sessionCards, sessionFailed, sessionPolling, sessionRunView, sessionVerdict, startBlocked, startBody, terminalRefusal,
} from '../lib/sessions.mjs'
import type { SessionCard, SessionState } from '../lib/sessions.mjs'
import { fieldCount } from '../lib/ops.mjs'
import { Btn, Chip, Field, MONO, Panel, PanelTitle, PickRow, Receipt, TextInput, UI } from '../ui/kit'

export default function SessionDock({ roomId, door }: { roomId: string; door: Door }) {
  const [registry, setRegistry] = useState<unknown>(null)
  const [loadError, setLoadError] = useState('')
  const [bump, setBump] = useState(0)
  useEffect(() => {
    const ac = new AbortController()
    setLoadError('')
    door
      .sessions(ac.signal)
      .then((r: unknown) => { if (!ac.signal.aborted) setRegistry(r) })
      .catch((err: { human?: string; message?: string }) => { if (!ac.signal.aborted) setLoadError(String(err?.human ?? err?.message ?? 'the door did not answer')) })
    return () => ac.abort()
  }, [door, bump])

  const cards = sessionCards(roomId, registry)
  if (registry !== null && cards.length === 0) return null
  const drivers = driverChoices(registry)
  const processes = registry && typeof registry === 'object' && Array.isArray((registry as { processes?: unknown }).processes) ? ((registry as { processes: unknown[] }).processes.filter((p) => typeof p === 'string') as string[]) : []
  const runs = roomRuns(roomId, registry)
  return (
    <section data-session-dock={roomId} className="mt-6">
      <Panel>
        <PanelTitle>Sessions you can start in this room</PanelTitle>
        <p className="-mt-2 mb-4 text-[12.5px] leading-[19px]" style={{ fontFamily: UI, color: 'var(--text-3)' }}>
          A session is judgement work run by a model through arc-run on the driver you pick. It starts only when you press
          Start, it may spend money, and it lands a receipt on the spine when it ends.
        </p>
        {loadError ? <p className="mb-3 text-[12px]" style={{ fontFamily: MONO, color: 'var(--red)' }}>session list refused: {loadError}</p> : null}
        <div className="space-y-4">
          {cards.map((c) => <SessionCardView key={c.id} card={c} door={door} drivers={drivers} processes={processes} onStarted={() => setBump((n) => n + 1)} />)}
        </div>
        {runs.length > 0 ? (
          <div className="mt-5 space-y-3" data-session-runs={runs.length}>
            <PanelTitle>Recent sessions</PanelTitle>
            {runs.map((r) => <RunView key={r.sid} sid={r.sid} session={r.session} listedState={r.state} door={door} />)}
          </div>
        ) : null}
      </Panel>
    </section>
  )
}

function SessionCardView({ card, door, drivers, processes, onStarted }: { card: SessionCard; door: Door; drivers: string[]; processes: string[]; onStarted: () => void }) {
  const [values, setValues] = useState<Record<string, string>>({})
  const [driver, setDriver] = useState('auto')
  const [proc, setProc] = useState('')
  const [st, setSt] = useState<SessionState>(SESSION_IDLE)
  const [sid, setSid] = useState('')
  const busy = useRef(false)

  // THE ONLY CALLER OF door.sessionStart. It runs from the Start button's onClick; nothing mounts, polls or replays it.
  const onStart = () => {
    if (busy.current) return
    busy.current = true
    setSt({ phase: 'starting' })
    door
      .sessionStart(card.id, startBody(card, values, driver, proc))
      .then((r: { sid?: unknown }) => { setSid(typeof r.sid === 'string' ? r.sid : ''); setSt(SESSION_IDLE); onStarted() })
      .catch((err: unknown) => setSt(sessionFailed(err)))
      .finally(() => { busy.current = false })
  }

  const blocked = startBlocked(card, values, proc)
  return (
    <div data-session={card.id} data-session-state={st.phase} className="rounded-xl border p-4" style={{ borderColor: 'var(--line-2)', background: 'var(--bg-3)' }}>
      <div className="flex flex-wrap items-center gap-2 mb-1">
        <span className="text-[14px]" style={{ fontFamily: UI, fontWeight: 600, color: 'var(--text-1)' }}>{card.label}</span>
        {card.spends ? <Chip tone="amber">spends money</Chip> : null}
        {!card.ready ? <Chip tone="amber">not shippable yet</Chip> : null}
        {card.receiptKind ? <Chip mono>{card.receiptKind}</Chip> : null}
      </div>
      {card.droppedFields > 0 ? <p className="mb-2 text-[12px]" style={{ fontFamily: MONO, color: 'var(--red)' }}>{card.droppedFields} field(s) the door served for this verb could not be read and are not shown</p> : null}
      {!card.ready ? <p data-session-why className="mb-3 text-[12.5px] leading-[19px]" style={{ fontFamily: UI, color: 'var(--text-3)' }}>{card.why}</p> : null}
      <fieldset disabled={st.phase === 'starting' || !card.ready} className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3 min-w-0 border-0 p-0 m-0">
        {card.fields.map((f) => (
          <Field key={f.name} label={f.label} hint={fieldCount(f, values[f.name]) || undefined}>
            <TextInput value={values[f.name] ?? ''} placeholder={f.placeholder} onChange={(v) => setValues((prev) => ({ ...prev, [f.name]: v }))} />
          </Field>
        ))}
        {card.pickProcess ? (
          <Field label="Process" className="md:col-span-2">
            <PickRow small label="Process" options={processes} value={proc} onPick={setProc} />
          </Field>
        ) : null}
        <Field label="Driver" className="md:col-span-2">
          <PickRow small label="Driver" options={drivers} value={driver} onPick={setDriver} />
        </Field>
      </fieldset>
      <div className="flex flex-wrap items-center gap-2">
        <Btn small tone="primary" onClick={onStart} disabled={blocked !== null || st.phase === 'starting'} title={blocked ?? undefined}>
          Start session
        </Btn>
        {blocked && card.ready ? <span className="text-[11.5px]" style={{ fontFamily: UI, color: 'var(--text-3)' }}>{blocked}</span> : null}
      </div>
      {st.phase === 'starting' ? <p className="mt-3 text-[12px]" style={{ fontFamily: UI, color: 'var(--text-3)' }}>starting -- the door is checking and starting arc-run</p> : null}
      {st.phase === 'error' ? <p data-session-refused className="mt-3 text-[12px]" style={{ fontFamily: MONO, color: 'var(--red)' }}>{st.code}: {st.human}</p> : null}
      {sid ? <p data-session-started={sid} className="mt-3 text-[12px]" style={{ fontFamily: MONO, color: 'var(--text-2)' }}>started {sid} -- attach to it below</p> : null}
    </div>
  )
}

function RunView({ sid, session, listedState, door }: { sid: string; session: string; listedState: string; door: Door }) {
  const [st, setSt] = useState<SessionState>(SESSION_IDLE)
  // Attach is a READ: it asks the door for the run as its files hold it, and never starts anything.
  const onAttach = () => {
    door.sessionRun(sid).then((p: unknown) => setSt({ phase: 'attached', run: sessionRunView(p) })).catch((err: unknown) => setSt(sessionFailed(err)))
  }
  // A failed re-read keeps the last good answer on screen and SAYS it failed; failures back the poll off, and a refusal
  // no later read can change ends it (attack a320d86 B13).
  const [failures, setFailures] = useState(0)
  const [lastFail, setLastFail] = useState('')
  const live = sessionPolling(st) && !terminalRefusal(lastFail.split(':')[0] ?? '')
  useEffect(() => {
    if (!live) return
    const ac = new AbortController()
    const t = window.setTimeout(() => {
      door
        .sessionRun(sid, ac.signal)
        .then((p: unknown) => { setSt({ phase: 'attached', run: sessionRunView(p) }); setFailures(0); setLastFail('') })
        .catch((err: unknown) => {
          if (ac.signal.aborted) return
          const f = sessionFailed(err)
          setFailures((n) => n + 1)
          setLastFail(f.phase === 'error' ? `${f.code}: ${f.human}` : 'UNREACHABLE')
        })
    }, pollDelay(failures))
    return () => { ac.abort(); window.clearTimeout(t) }
  }, [live, sid, door, failures, st])

  return (
    <div data-session-run={sid} data-session-run-state={st.phase === 'attached' ? st.run.state : listedState} className="rounded-lg border p-3" style={{ borderColor: 'var(--line-2)' }}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[12.5px]" style={{ fontFamily: MONO, color: 'var(--text-1)' }}>{session} · {sid}</span>
        <Chip mono>{st.phase === 'attached' ? st.run.state : listedState}</Chip>
        {st.phase !== 'attached' ? <Btn small tone="ghost" onClick={onAttach}>Attach</Btn> : null}
      </div>
      {st.phase === 'error' ? <p data-session-refused className="mt-2 text-[12px]" style={{ fontFamily: MONO, color: 'var(--red)' }}>{st.code}: {st.human}</p> : null}
      {st.phase === 'attached' ? (
        <div className="mt-2">
          <p className="text-[12px]" style={{ fontFamily: MONO, color: 'var(--text-3)' }}>{st.run.command}</p>
          {st.run.branchMoved ? <p className="text-[12px]" style={{ fontFamily: UI, color: 'var(--red)' }}>{st.run.branchMoved}</p> : null}
          {lastFail ? <p data-session-read-failed className="text-[12px]" style={{ fontFamily: MONO, color: 'var(--red)' }}>last read failed ({lastFail}) -- showing the answer before it</p> : null}
          {st.run.lines.length ? (
            <pre data-session-lines={st.run.lines.length} className="mt-2 max-h-[240px] overflow-auto rounded-lg p-3 text-[11.5px] leading-[17px] whitespace-pre-wrap break-words" style={{ fontFamily: MONO, background: 'var(--well)', color: 'var(--text-2)' }}>
              {st.run.lines.join('\n')}
            </pre>
          ) : null}
          {st.run.linesDropped > 0 || st.run.bytesDropped > 0 ? <p className="text-[11px]" style={{ fontFamily: UI, color: 'var(--text-3)' }}>{st.run.linesDropped} earlier line(s) and {st.run.bytesDropped} bytes of the run's output not kept</p> : null}
          <p className="mt-2 text-[12.5px]" style={{ fontFamily: MONO, color: 'var(--text-1)' }}>{sessionVerdict(st.run)}</p>
          {st.run.receipts.map((r) => (
            <div key={r.id} className="mt-1.5" data-session-receipt={r.id}>
              <Receipt tone="accent" title={r.ts}>{r.kind} · {r.id}</Receipt>
            </div>
          ))}
          {st.run.unattributed.length ? <p className="mt-1 text-[11px]" style={{ fontFamily: UI, color: 'var(--text-3)' }}>{st.run.unattributed.length} id(s) the run printed are not credited to it</p> : null}
        </div>
      ) : null}
    </div>
  )
}
