// View.tsx -- kernel/evolve: v0.7's Evolve, drawing what fold() returned and deciding nothing (face v2
// Phase 03, ADR-1320).
//
// Declared deltas from the reference: the experiment list and the experiment contract are read from
// /api/evolve, folded by the evolve lane's own board (Phase 04); Open, Measure a batch and Conclude are verb-pending cards
// (ADR-1326); the reference's simulated batches are gone -- the figures count real receipts by kind.
import type { ModuleViewContext } from '../../../lib/registry.mjs'
import type { Folded } from './fold.mjs'
import { UI, YoursBadge } from '../../../ui/kit'
import { HPanel, HoldsPanel, KpiStrip, LanePanel, ReceiptDrawer, RoomHead, ServedTable, TrailPanel, VerbPending } from '../../../ui/bits'
export { Flask as Icon } from '@phosphor-icons/react'

export default function View({ f, ctx }: { f: Folded; ctx: ModuleViewContext }) {
  return (
    <>
      <RoomHead title={f.sentence} hint={f.lede} right={<YoursBadge>{f.badge}</YoursBadge>} />

      <KpiStrip items={f.kpis} />

      <div className="grid grid-cols-1 xl:grid-cols-[1.4fr_1fr] gap-4 items-start">
        <div className="min-w-0">
          <HPanel title="Open an experiment" hint="one declared surface · one metric · one hypothesis">
            <VerbPending item={f.openVerb} />
          </HPanel>

          <HPanel title="Experiments" hint="open, concluded, landed · status moves only on receipts and your stamp">
            <ServedTable item={f.experiments} />
          </HPanel>

          <HPanel title="Experiment contract" hint="the evolve section of a manifest">
            <ServedTable item={f.contract} />
          </HPanel>

          <TrailPanel trail={f.trail} onReceipt={(id) => ctx.onPick('receipt', id)} />
        </div>

        <div className="min-w-0">
          <HPanel title="The rules">
            <p className="text-[12.5px] leading-[19px]" style={{ fontFamily: UI, color: 'var(--text-2)' }}>
              The verdict is one pinned formula, computed once, when both arms reach the sample floor. NO PROPOSAL is a first-class result. A challenger that wins lands only as a reviewed diff on your stamp, and a rollback is propose-only in both directions.
            </p>
          </HPanel>

          <LanePanel lane={f.lane} />

          <HoldsPanel holds={f.holds} century={f.century} hasHolds={f.hasHolds} note={f.holdsNote} />
        </div>
      </div>

      <ReceiptDrawer receipt={f.receipt} onClose={() => ctx.onPick('receipt', '')} />
    </>
  )
}
