// View.tsx -- kernel/absorb: v0.7's Absorb, drawing what fold() returned and deciding nothing (face v2
// Phase 03, ADR-1320).
//
// Declared deltas from the reference: the registry and adopted-per-lane panels are NOT SERVED until
// /api/absorb (ADR-1324); Absorb, Advance, Propose adoption and Retire are verb-pending cards (ADR-1326);
// the trail is the decision receipts the served registry homes here, and it says those are every
// decision, not intake's alone.
import type { ModuleViewContext } from '../../../lib/registry.mjs'
import type { Folded } from './fold.mjs'
import { UI, YoursBadge } from '../../../ui/kit'
import { HPanel, HoldsPanel, KpiStrip, LanePanel, NotServed, ReceiptDrawer, RoomHead, TrailPanel, VerbPending } from '../../../ui/bits'
export { Funnel as Icon } from '@phosphor-icons/react'

export default function View({ f, ctx }: { f: Folded; ctx: ModuleViewContext }) {
  return (
    <>
      <RoomHead title={f.sentence} hint={f.lede} right={<YoursBadge>{f.badge}</YoursBadge>} />

      <KpiStrip items={f.kpis} />

      <div className="grid grid-cols-1 xl:grid-cols-[1.4fr_1fr] gap-4 items-start">
        <div className="min-w-0">
          <HPanel title="Absorb something" hint="a candidate first · one honest ledger of every technique looked at">
            <VerbPending item={f.captureVerb} />
          </HPanel>

          <HPanel title="The registry" hint="candidate · trial · adopted · retired">
            <NotServed item={f.registry} />
          </HPanel>

          <HPanel title="Adopted per lane">
            <NotServed item={f.adopted} />
          </HPanel>

          <TrailPanel trail={f.trail} onReceipt={(id) => ctx.onPick('receipt', id)} />
        </div>

        <div className="min-w-0">
          <HPanel title="The refinery's rules">
            <p className="text-[12.5px] leading-[19px]" style={{ fontFamily: UI, color: 'var(--text-2)' }}>
              Nothing installs itself. A candidate is studied read-only, reported, classified, and rebuilt as a reviewed diff before a blind judgement. Adoption is your stamp, and each lane holds a capped number of adopted techniques, so adding one means retiring another.
            </p>
          </HPanel>

          <LanePanel lane={f.lane} />

          <HoldsPanel holds={f.holds} century={f.century} hasHolds={f.hasHolds} />
        </div>
      </div>

      <ReceiptDrawer receipt={f.receipt} onClose={() => ctx.onPick('receipt', '')} />
    </>
  )
}
