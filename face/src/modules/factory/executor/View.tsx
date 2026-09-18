// View.tsx -- factory/executor: v0.7's Executor, drawing what fold() returned and deciding nothing (face v2 Phase 03,
// ADR-1320, ADR-1327).
//
// Declared deltas from the reference: the hires and their runs are read from /api/roster (Phase 04) and their certification is NOT SERVED
// (ADR-1324) -- the reference drew a simulated team and a run log; hiring, dispatching and terminating are
// work-door cards, not wizards (ADR-1326); the employees are the served registry's agents, counted and linked to the
// agents room; the file the hires are written in is drawn by its provenance. The room wears its not-in-registry label.
import type { ModuleViewContext } from '../../../lib/registry.mjs'
import type { Folded } from './fold.mjs'
import { Chip, UI } from '../../../ui/kit'
import { HPanel, KpiStrip, NotServed, RoomHead, ServedTable, SourceFile, VerbPending } from '../../../ui/bits'
import { Rows } from '../../../ui/company'
export { UsersFour as Icon } from '@phosphor-icons/react'

export default function View({ f, ctx }: { f: Folded; ctx: ModuleViewContext }) {
  return (
    <>
      <RoomHead title={f.sentence} hint={f.lede} right={<Chip>{f.badge}</Chip>} />

      <KpiStrip items={f.kpis} />

      <div className="grid grid-cols-1 xl:grid-cols-[1.3fr_1fr] gap-4 items-start">
        <div className="min-w-0">
          <HPanel title="The terms of a hire" hint="the same terms for every contractor">
            <Rows items={f.terms} empty="" isEmpty={false} />
          </HPanel>

          <HPanel title="Hires on the books" hint="contractors, on tenure">
            <ServedTable item={f.hires} />
            <div className="mt-3 space-y-2.5">
              <VerbPending item={f.hireVerb} />
              <VerbPending item={f.dispatchVerb} />
              <VerbPending item={f.terminateVerb} />
            </div>
          </HPanel>
        </div>

        <div className="min-w-0">
          <HPanel title="Where the hires are written" hint="engine/router.yaml, through the door">
            <SourceFile file={f.router} />
            {f.engineLink.canOpen ? (
              <button type="button" onClick={() => ctx.onOpen(f.engineLink.room)} className="mt-2.5 text-[12.5px] cursor-pointer underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-(--accent)" style={{ fontFamily: UI, fontWeight: 600, color: 'var(--accent)' }}>
                the driver table, in the engine room →
              </button>
            ) : null}
          </HPanel>

          <HPanel title="Employees" hint="in-house: an agent spawned for a task, then gone">
            <p className="text-[13px] leading-[20px]" style={{ fontFamily: UI, color: 'var(--text-2)' }}>
              Every agent the served registry homes is an employee here; the roster, room by room, is the agents room's.
            </p>
            {f.agentsLink.canOpen ? (
              <button type="button" onClick={() => ctx.onOpen(f.agentsLink.room)} className="mt-2.5 text-[12.5px] cursor-pointer underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-(--accent)" style={{ fontFamily: UI, fontWeight: 600, color: 'var(--accent)' }}>
                open the roster →
              </button>
            ) : null}
          </HPanel>

          <HPanel title="Certification">
            <NotServed item={f.certification} />
          </HPanel>

          <HPanel title="Runs">
            <ServedTable item={f.runs} />
          </HPanel>
        </div>
      </div>
    </>
  )
}
