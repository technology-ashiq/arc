// View.tsx -- money/ops: v0.7's Ops, drawing what fold() returned and deciding nothing (face v2 Phase 03,
// ADR-1320, ADR-1328).
//
// Declared deltas from the reference: a PLANNED room, drawn from the planned-rooms registry, dotted; the
// incident form, the support file-drop and the weekly report are REHEARSAL cards, not forms, because the
// lane is not born and the face keeps no second store; the rehearsal KPIs of v0.7's workspace are counts
// of the planned row instead. The room never wears a liveness pill (F3).
import type { ModuleViewContext } from '../../../lib/registry.mjs'
import type { Folded } from './fold.mjs'
import { SimBadge, UI } from '../../../ui/kit'
import { HPanel, KpiStrip, PlannedBanner, PlannedFactsPanel, PlannedLinePanel, Rehearsal, RoomHead } from '../../../ui/bits'
export { Lifebuoy as Icon } from '@phosphor-icons/react'

export default function View({ f }: { f: Folded; ctx: ModuleViewContext }) {
  return (
    <div data-planned="ops">
      <RoomHead title={f.sentence} hint={f.lede} right={<SimBadge>{f.badge}</SimBadge>} />
      <PlannedBanner text={f.banner} />

      <KpiStrip items={f.kpis} />

      <div className="grid grid-cols-1 xl:grid-cols-[1.4fr_1fr] gap-4 items-start">
        <div className="min-w-0">
          <HPanel title="Rehearsed here" hint="v0.7's flows, each one REHEARSAL · none reaches the work door">
            <div className="space-y-2.5">
              {f.flows.map((x) => (
                <Rehearsal key={x.verb} item={x} />
              ))}
            </div>
          </HPanel>

          <HPanel title="The room's rules" hint="what holds on the day the lane is born">
            <div className="text-[12.5px] leading-[19px] space-y-1.5" style={{ fontFamily: UI, color: 'var(--text-2)' }}>
              {f.rules.map((r) => (
                <div key={r}>· {r}</div>
              ))}
            </div>
          </HPanel>
        </div>

        <div className="min-w-0">
          <PlannedLinePanel room={f} />
          <PlannedFactsPanel room={f} />
          <HPanel title="The kinds it will own">
            <p className="text-[12.5px] leading-[19px]" style={{ fontFamily: UI, color: 'var(--text-2)' }}>{f.kindsSentence}</p>
          </HPanel>
        </div>
      </div>
    </div>
  )
}
