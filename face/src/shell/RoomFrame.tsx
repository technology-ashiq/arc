// RoomFrame.tsx -- draws one served room: its module, or the generic module (face v2 Phase 02,
// ADR-1320, ADR-1321), and hosts a module's reads (face v2 Phase 03, REQ-05).
//
// A module is drawn by folding what the door served and handing the result to its View. The HOST
// here runs the effects of that loop and decides nothing: fold() asks for reads, registry.mjs checks
// each against the module's declared routes and says which to start, the host starts them through
// the door and folds again. A View reaches the door only through ctx.onPick, ctx.onAct and
// ctx.onReread. A served room with no module draws through the generic module, which REPORTS that it
// did, by the room's id, above the room.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ComponentType } from 'react'
import {
  actCall, actProblem, actSettled, actStarted, afterAct, dropReads, fallbackFor, foldModule, plannedReads,
  POLL_MS, problemsFor, readsToLoad, refusedPayload, renderFor,
} from '../lib/registry.mjs'
import type { AttachedModule, Attachment, ModuleContext, ModuleProblem, ModuleViewContext, Payload } from '../lib/registry.mjs'
import { laneForRoom } from '../lib/rooms.mjs'
import type { Room } from '../lib/rooms.mjs'
import GenericRoom from '../rooms/GenericRoom'
import IndexRoom from '../rooms/IndexRoom'
import { Failure } from '../ui/legacy'
import { MONO, UI } from '../ui/kit'

type ViewProps = { f: Record<string, unknown>; ctx: ModuleViewContext }
type Folded = { ok: true; f: Record<string, unknown> } | { ok: false; error: unknown }

export default function RoomFrame({ room, attachment, ctx }: { room: Room; attachment: Attachment; ctx: ModuleContext }) {
  const render = renderFor(room.id, attachment)
  const attached = attachment.attached[room.id]
  if (render.kind === 'module' && attached) return <ModuleView module={attached} ctx={ctx} />
  return <GenericModule room={room} ctx={ctx} problems={problemsFor(room.id, attachment)} />
}

function ModuleView({ module: m, ctx }: { module: AttachedModule; ctx: ModuleContext }) {
  const { door } = ctx
  const [loaded, setLoaded] = useState<Record<string, Payload>>({})
  const [picks, setPicks] = useState<Record<string, string>>({})
  const [pollTick, setPollTick] = useState(0)
  // Bumped when the door or module changes, so the load effect runs again over the EMPTIED payloads
  // even when the new fold asks for exactly the same reads as the old one did.
  const [generation, setGeneration] = useState(0)
  const loadedRef = useRef(loaded)
  loadedRef.current = loaded
  const inflight = useRef(new Set<string>())
  const polledAt = useRef(0)
  const actCount = useRef<Record<string, number>>({})
  // One controller per door and module: a new door is a new as-of or token, so everything read through
  // the old one is stale, and a read still in flight must not land on the new one.
  const controller = useRef<AbortController | null>(null)

  useEffect(() => {
    const ac = new AbortController()
    controller.current = ac
    inflight.current = new Set()
    actCount.current = {}
    setLoaded({})
    setGeneration((g) => g + 1)
    return () => ac.abort()
  }, [door, m])

  // A fold that throws is this module's failure, named, and never a blank room or a dead shell.
  const folded = useMemo((): Folded => {
    try {
      return { ok: true, f: foldModule(m, loaded, ctx, picks) }
    } catch (error) {
      return { ok: false, error }
    }
  }, [m, loaded, ctx, picks])
  const plan = useMemo(() => plannedReads(folded.ok ? folded.f : null, m.manifest), [folded, m])
  const planKey = plan.reads.map((r) => r.key).join('\n')

  useEffect(() => {
    const t = window.setInterval(() => setPollTick((n) => n + 1), POLL_MS)
    return () => window.clearInterval(t)
  }, [])

  useEffect(() => {
    const ac = controller.current
    if (!ac || ac.signal.aborted) return
    const pollDue = pollTick !== polledAt.current
    polledAt.current = pollTick
    for (const r of readsToLoad(plan.reads, loadedRef.current, inflight.current, pollDue)) {
      const flight = inflight.current
      flight.add(r.key)
      door
        .call(r.path, { signal: ac.signal })
        .then((data: unknown) => {
          if (!ac.signal.aborted) setLoaded((prev) => ({ ...prev, [r.key]: { state: 'ok', data } }))
        })
        .catch((err: unknown) => {
          if (!ac.signal.aborted) setLoaded((prev) => ({ ...prev, [r.key]: refusedPayload(err) }))
        })
        .finally(() => flight.delete(r.key))
    }
    // plan.reads is read through planKey: the same key list is the same plan.
  }, [planKey, pollTick, door, generation])

  const onPick = useCallback((key: string, value: string) => {
    setPicks((prev) => ({ ...prev, [key]: value }))
  }, [])

  const onReread = useCallback(() => {
    setLoaded((prev) => dropReads(prev))
  }, [])

  const onAct = useCallback(
    (route: string, body: Record<string, unknown>) => {
      const ac = controller.current
      if (!ac || ac.signal.aborted) return
      const why = actProblem(route, body, m.manifest)
      const n = actCount.current[route] ?? 0
      actCount.current = { ...actCount.current, [route]: n + 1 }
      setLoaded((prev) => actStarted(prev, route, body).loaded)
      if (why !== null) {
        setLoaded((prev) => actSettled(prev, route, n, { state: 'refused', code: 'ACT_REFUSED', human: why }))
        return
      }
      actCall(door, route, body)
        .then((data: unknown) => {
          if (ac.signal.aborted) return
          setLoaded((prev) => afterAct(actSettled(prev, route, n, { state: 'ok', data }), route))
        })
        .catch((err: unknown) => {
          if (!ac.signal.aborted) setLoaded((prev) => actSettled(prev, route, n, refusedPayload(err)))
        })
    },
    [door, m],
  )

  const viewCtx = useMemo((): ModuleViewContext => ({ ...ctx, picks, onPick, onAct, onReread }), [ctx, picks, onPick, onAct, onReread])

  if (!folded.ok) return <Failure error={folded.error} what={`the ${m.key} module's fold`} />
  const View = m.View as ComponentType<ViewProps>
  return (
    <>
      {plan.problems.length > 0 && (
        <p data-read-problem={plan.problems.length} className="mb-3 text-[12px] leading-[18px]" style={{ fontFamily: MONO, color: 'var(--text-3)' }}>
          {plan.problems.map((p) => (
            <span key={p} className="block">
              read refused: {p}
            </span>
          ))}
        </p>
      )}
      <View f={folded.f} ctx={viewCtx} />
    </>
  )
}

function GenericModule({ room, ctx, problems }: { room: Room; ctx: ModuleContext; problems: ModuleProblem[] }) {
  const which = fallbackFor(room)
  return (
    <>
      <p className="mb-3 flex flex-wrap items-center gap-2 text-[12px] leading-[18px]" style={{ fontFamily: UI, color: 'var(--text-3)' }}>
        <span className="inline-flex items-center h-[20px] px-2 rounded-full text-[10.5px] uppercase tracking-[0.06em]" style={{ fontWeight: 600, color: 'var(--text-2)', background: 'var(--bg-4)', border: '1px solid var(--line-1)' }}>
          generic module
        </span>
        <span>
          No module draws <span style={{ fontFamily: MONO, color: 'var(--text-2)' }}>{room.id}</span> yet, so the generic module does (ADR-1321).
        </span>
        {problems.map((p) => (
          <span key={`${p.kind}:${p.key}`} style={{ fontFamily: MONO }}>
            {p.kind}: {p.why}
          </span>
        ))}
      </p>
      {which === 'index' ? (
        <IndexRoom room={room} rooms={ctx.rooms} door={ctx.door} />
      ) : (
        <GenericRoom room={room} door={ctx.door} lane={laneForRoom(room.id, ctx.laneMap)} />
      )}
    </>
  )
}
