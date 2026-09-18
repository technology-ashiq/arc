// View.tsx -- company/learn: v0.7's Learn, drawing what fold() returned and deciding nothing (face v2 Phase 03,
// company ring, ADR-1320).
//
// Declared deltas from the reference: the playbook rules are read from /api/learn (Phase 04); the jurors' calibration and the sleeping queue are NOT
// SERVED, because no lane records either in a form a parser reads (ADR-1324) -- the reference drew them from a local store and a typed list;
// v0.7's champion/challenger preview was a simulated experiment, and the real experiments live in the evolve room,
// which this room links to rather than imitates.
import type { ModuleViewContext } from '../../../lib/registry.mjs'
import type { Folded } from './fold.mjs'
import { UI, YoursBadge } from '../../../ui/kit'
import { HPanel, HoldsPanel, KpiStrip, NotServed, RoomHead, ServedTable, SourcesPanel } from '../../../ui/bits'
import { Rows } from '../../../ui/company'
export { Lightbulb as Icon } from '@phosphor-icons/react'

export default function View({ f, ctx }: { f: Folded; ctx: ModuleViewContext }) {
  return (
    <>
      <RoomHead title={f.sentence} hint={f.lede} right={<YoursBadge>{f.badge}</YoursBadge>} />

      <KpiStrip items={f.kpis} />

      <div className="grid grid-cols-1 xl:grid-cols-[1.3fr_1fr] gap-4 items-start">
        <div className="min-w-0">
          <HPanel title="How a correction becomes a rule" hint="the loop this room is the record of">
            <Rows items={f.loop} empty="" isEmpty={false} />
          </HPanel>

          <HPanel title="Playbook rules" hint="the company's memory · recall search">
            <ServedTable item={f.rules} />
          </HPanel>

          <HPanel title="Evolve" hint="the generalised retro">
            <p className="text-[13px] leading-[20px] mb-2.5" style={{ fontFamily: UI, color: 'var(--text-2)' }}>{f.evolve.line}</p>
            {f.evolve.canOpen ? (
              <button type="button" onClick={() => ctx.onOpen(f.evolve.room)} className="text-[12.5px] cursor-pointer underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-(--accent)" style={{ fontFamily: UI, fontWeight: 600, color: 'var(--accent)' }}>
                open the evolve room →
              </button>
            ) : null}
          </HPanel>
        </div>

        <div className="min-w-0">
          <HPanel title="Juror calibration" hint="Brier-scored, weight-adjusted">
            <NotServed item={f.calibration} />
          </HPanel>

          <HPanel title="The sleeping queue" hint="earn before build — every module has an alarm, not a deadline">
            <NotServed item={f.sleeping} />
          </HPanel>

          <SourcesPanel sources={f.sources} title="What the loop writes" hint="the retro log and the trial ledger, through the door" />

          <HoldsPanel holds={f.holds} century={f.century} hasHolds={f.hasHolds} note={f.holdsNote} />
        </div>
      </div>
    </>
  )
}
