// RoomFrame.tsx -- draws one served room: its module, or the generic module (face v2 Phase 02,
// ADR-1320, ADR-1321).
//
// A module is drawn by calling its fold() over the context's data and handing the result to its
// View. A served room with no module draws through the generic module, which REPORTS that it did,
// by the room's id, above the room -- a room that renders generic is a fact the owner can see, not
// a quiet fallback. Which renderer and which problem to name are registry.mjs's decisions.
import { useMemo } from 'react'
import type { ComponentType } from 'react'
import { fallbackFor, foldContext, problemsFor, renderFor } from '../lib/registry.mjs'
import type { AttachedModule, Attachment, ModuleContext, ModuleProblem } from '../lib/registry.mjs'
import { laneForRoom } from '../lib/rooms.mjs'
import type { Room } from '../lib/rooms.mjs'
import GenericRoom from '../rooms/GenericRoom'
import IndexRoom from '../rooms/IndexRoom'
import { Failure } from '../ui/legacy'
import { MONO, UI } from '../ui/kit'

type ViewProps = { f: Record<string, unknown>; ctx: ModuleContext }

export default function RoomFrame({ room, attachment, ctx }: { room: Room; attachment: Attachment; ctx: ModuleContext }) {
  const render = renderFor(room.id, attachment)
  const attached = attachment.attached[room.id]
  if (render.kind === 'module' && attached) return <ModuleView module={attached} ctx={ctx} />
  return <GenericModule room={room} ctx={ctx} problems={problemsFor(room.id, attachment)} />
}

function ModuleView({ module: m, ctx }: { module: AttachedModule; ctx: ModuleContext }) {
  // A fold that throws is this module's failure, named, and never a blank room or a dead shell.
  const folded = useMemo((): { ok: true; f: Record<string, unknown> } | { ok: false; error: unknown } => {
    try {
      return { ok: true, f: m.fold({}, foldContext(ctx)) }
    } catch (error) {
      return { ok: false, error }
    }
  }, [m, ctx])
  if (!folded.ok) return <Failure error={folded.error} what={`the ${m.key} module's fold`} />
  const View = m.View as ComponentType<ViewProps>
  return <View f={folded.f} ctx={ctx} />
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
