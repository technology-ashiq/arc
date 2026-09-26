// View.tsx -- kernel/bench: v0.7's Bench, drawing what fold() returned and deciding nothing (face v2
// Phase 03, ADR-1320).
//
// Declared deltas from the reference: the scorecards are the scored runs /api/bench serves (Phase 04), none labelled champion;
// Add to bench, Run scorecard, Propose promotion and Retire are verb-pending cards (ADR-1326); runs by
// driver are the door's run.completed receipts, not a mock scorecard at no cost.
import type { ModuleViewContext } from '../../../lib/registry.mjs'
import type { Folded } from './fold.mjs'
import { Btn, UI, YoursBadge } from '../../../ui/kit'
import { DoorRefusal, HPanel, HoldsPanel, KpiStrip, LanePanel, Reading, ReceiptDrawer, RoomHead, RunRows, ServedTable, TrailPanel } from '../../../ui/bits'
export { ChartBarHorizontal as Icon } from '@phosphor-icons/react'

export default function View({ f, ctx }: { f: Folded; ctx: ModuleViewContext }) {
  return (
    <>
      <RoomHead title={f.sentence} hint={f.lede} right={<YoursBadge>{f.badge}</YoursBadge>} />

      <KpiStrip items={f.kpis} />

      <div className="grid grid-cols-1 xl:grid-cols-[1.4fr_1fr] gap-4 items-start">
        <div className="min-w-0">
          <HPanel title="The bench" hint="every number derives from scored runs">
            <ServedTable item={f.scorecards} />
          </HPanel>

          <HPanel title="Runs by driver" hint="run.completed receipts, grouped by the driver that ran">
            {f.trail.isReading && <Reading what="the run receipts" />}
            {f.trail.isRefused && <DoorRefusal code={f.trail.refusal.code} human={f.trail.refusal.human} />}
            {f.trail.isDrawn && <RunRows rows={f.drivers} isEmpty={f.showDriversEmpty} empty="No run.completed receipt on the page the door sent names a driver." />}
          </HPanel>

          <TrailPanel trail={f.trail} onReceipt={(id) => ctx.onPick('receipt', id)} />
        </div>

        <div className="min-w-0">
          <HPanel title="How the bench judges" actions={f.policy.canOpen && <Btn small onClick={() => ctx.onOpen(f.policy.room)}>Tiers → model policy</Btn>}>
            <p className="text-[12.5px] leading-[19px]" style={{ fontFamily: UI, color: 'var(--text-2)' }}>
              Every driver runs the same fixtures and is scored the same way. The champion is pinned until a challenger beats it on the scorecard, and a win is only a proposal: a machine may raise it, and only you may decide it. Not enough fixtures is an answer too.
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
