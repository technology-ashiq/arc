// View.tsx -- money/trader: v0.7's Trader, drawing what fold() returned and deciding nothing (face v2 Phase 03,
// ADR-1320, ADR-1328).
//
// Declared deltas from the reference: a PLANNED room, drawn from the planned-rooms registry, dotted; the
// question, strategy, backtest and verdict forms are REHEARSAL cards, and v0.7's deterministic rehearsal numbers
// are not drawn at all, because the face keeps no second store to hold them. The lock is the registry's seals,
// struck through: no control for them exists here, not even a disabled one. F3 closed: the room reads no receipt
// and wears no liveness pill.
import type { ModuleViewContext } from '../../../lib/registry.mjs'
import type { Folded } from './fold.mjs'
import { SimBadge, UI } from '../../../ui/kit'
import { HPanel, KpiStrip, PlannedBanner, PlannedFactsPanel, PlannedLinePanel, Rehearsal, RoomHead } from '../../../ui/bits'
export { Flask as Icon } from '@phosphor-icons/react'

export default function View({ f }: { f: Folded; ctx: ModuleViewContext }) {
  return (
    <div data-planned="trader">
      <RoomHead title={f.sentence} hint={f.lede} right={<SimBadge>{f.badge}</SimBadge>} />
      <PlannedBanner text={f.banner} />

      <KpiStrip items={f.kpis} />

      <div className="grid grid-cols-1 xl:grid-cols-[1.4fr_1fr] gap-4 items-start">
        <div className="min-w-0">
          <HPanel title="Rehearsed here — paper only" hint="question · playground · backtest · verdict · none reaches the work door">
            <div className="space-y-2.5">
              {f.flows.map((x) => (
                <Rehearsal key={x.verb} item={x} />
              ))}
            </div>
          </HPanel>

          <HPanel title="Why paper">
            <div className="text-[13px] leading-[20px] space-y-2" style={{ fontFamily: UI, color: 'var(--text-2)' }}>
              {f.why.map((w) => (
                <p key={w}>{w}</p>
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
