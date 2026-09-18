// View.tsx -- factory/design-studio: v0.7's Design Studio, drawing what fold() returned and deciding
// nothing (face v2 Phase 03, ADR-1320).
//
// Declared deltas from the reference: the studio floor -- submissions, variants, critiques, jury -- is a
// NOT SERVED panel until /api/design (ADR-1324); Explore, Run critique and Blind jury are work-door
// cards (ADR-1326); the figures count the receipts the registry homes here, and the lane card is the
// design lane's own header.
import type { ModuleViewContext } from '../../../lib/registry.mjs'
import type { Folded } from './fold.mjs'
import { UI, YoursBadge } from '../../../ui/kit'
import { HPanel, HoldsPanel, KpiStrip, LanePanel, NotServed, ReceiptDrawer, RoomHead, TrailPanel, VerbPending } from '../../../ui/bits'
export { PaintBrushBroad as Icon } from '@phosphor-icons/react'

export default function View({ f, ctx }: { f: Folded; ctx: ModuleViewContext }) {
  return (
    <>
      <RoomHead title={f.sentence} hint={f.lede} right={<YoursBadge>{f.badge}</YoursBadge>} />

      <KpiStrip items={f.kpis} />

      <div className="grid grid-cols-1 xl:grid-cols-[1.4fr_1fr] gap-4 items-start">
        <div className="min-w-0">
          <HPanel title="Submit a surface" hint="three variants, each with a thesis it must differ by">
            <VerbPending item={f.submitVerb} />
          </HPanel>

          <HPanel title="The studio floor" hint="explores · critique · blind jury">
            <div className="space-y-2.5">
              <NotServed item={f.floor} />
              <VerbPending item={f.critiqueVerb} />
            </div>
          </HPanel>

          <TrailPanel trail={f.trail} onReceipt={(id) => ctx.onPick('receipt', id)} />
        </div>

        <div className="min-w-0">
          <HPanel title="Why BELOW-BAR exists">
            <p className="text-[12.5px] leading-[19px]" style={{ fontFamily: UI, color: 'var(--text-2)' }}>
              A pass condition that is only an absence cannot detect mediocrity: work that broke no rule passed five runs running while being characterless. So the critique can fail work for insufficiency, and ranking candidates against each other yields a winner but never a bar — which is why the jury is handed a reference item it is not told about.
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
