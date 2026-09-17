// View.tsx -- factory/develop: v0.7's Develop, drawing what fold() returned and deciding nothing (face
// v2 Phase 03, ADR-1320).
//
// Declared deltas from the reference: the slice table and the computed Definition of Done are NOT
// SERVED panels until /api/slices (ADR-1324); Open a slice, Record proof and Close on evidence are
// work-door cards (ADR-1326); the phases are the develop lane's own phase specs through the door, and
// the figures count the slice receipts the registry homes here.
import type { ModuleViewContext } from '../../../lib/registry.mjs'
import type { Folded } from './fold.mjs'
import { UI, YoursBadge } from '../../../ui/kit'
import { HPanel, HoldsPanel, KpiStrip, LanePanel, NotServed, ReceiptDrawer, RoomHead, TrailPanel, VerbPending } from '../../../ui/bits'
export { Wrench as Icon } from '@phosphor-icons/react'

export default function View({ f, ctx }: { f: Folded; ctx: ModuleViewContext }) {
  return (
    <>
      <RoomHead title={f.sentence} hint={f.lede} right={<YoursBadge>{f.badge}</YoursBadge>} />

      <KpiStrip items={f.kpis} />

      <div className="grid grid-cols-1 xl:grid-cols-[1.4fr_1fr] gap-4 items-start">
        <div className="min-w-0">
          <HPanel title="Open a slice" hint="a named unit of the live phase, open until it is proven">
            <VerbPending item={f.openVerb} />
          </HPanel>

          <HPanel title="Slices" hint="proven = tests green on CI AND the owner saw it run">
            <NotServed item={f.slices} />
          </HPanel>

          <HPanel title="Close a phase" hint="the DoD is computed, never asserted">
            <div className="space-y-2.5">
              <NotServed item={f.dod} />
              <VerbPending item={f.closeVerb} />
            </div>
          </HPanel>

          <TrailPanel trail={f.trail} onReceipt={(id) => ctx.onPick('receipt', id)} />
        </div>

        <div className="min-w-0">
          <LanePanel lane={f.lane} title="Phases" hint="the develop lane's own specs, through the door" />

          <HPanel title="A refusal is a receipt">
            <p className="text-[12.5px] leading-[19px]" style={{ fontFamily: UI, color: 'var(--text-2)' }}>
              A phase that cannot close writes down why: the slice that is not proven, the suite that is not green, the evidence that is not bundled. The refusal is appended like any other receipt, so a phase closed later carries the record of the day it could not be.
            </p>
          </HPanel>

          <HoldsPanel holds={f.holds} century={f.century} hasHolds={f.hasHolds} note={f.holdsNote} />
        </div>
      </div>

      <ReceiptDrawer receipt={f.receipt} onClose={() => ctx.onPick('receipt', '')} />
    </>
  )
}
