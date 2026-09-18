// View.tsx -- factory/council-chamber: v0.7's Council, drawing what fold() returned and deciding nothing
// (face v2 Phase 03, ADR-1320, ADR-1322).
//
// Declared deltas from the reference: the Cycle 15 renderer this module carried through Phase 02 is
// gone, and so is `face/src/rooms/CouncilRoom.tsx`; the verdict ledger and the calibration number are
// NOT SERVED panels until /api/council (ADR-1324); Convene and the HIT/MISS scoring buttons are
// work-door cards (ADR-1326); the twelve seats are the agents the served registry homes in this room,
// so a seat added to the registry appears here without an edit.
import type { ModuleViewContext } from '../../../lib/registry.mjs'
import type { Folded } from './fold.mjs'
import { MONO, UI, YoursBadge } from '../../../ui/kit'
import { HPanel, HoldsPanel, KpiStrip, NotServed, ReceiptDrawer, RoomHead, TrailPanel, VerbPending } from '../../../ui/bits'
export { Users as Icon } from '@phosphor-icons/react'

export default function View({ f, ctx }: { f: Folded; ctx: ModuleViewContext }) {
  return (
    <>
      <RoomHead title={f.sentence} hint={f.lede} right={<YoursBadge>{f.badge}</YoursBadge>} />

      <KpiStrip items={f.kpis} />

      <div className="grid grid-cols-1 xl:grid-cols-[1.4fr_1fr] gap-4 items-start">
        <div className="min-w-0">
          <HPanel title="Convene the council" hint="blind and parallel · one bounded rebuttal · the verdict commits with its dissent">
            <VerbPending item={f.convene} />
          </HPanel>

          <HPanel title="The verdict ledger" hint="a call is scored HIT or MISS on its review-by date">
            <NotServed item={f.ledger} />
          </HPanel>

          <TrailPanel trail={f.trail} onReceipt={(id) => ctx.onPick('receipt', id)} />
        </div>

        <div className="min-w-0">
          <HPanel title="The seats" hint="from the served registry">
            {f.hasSeats ? (
              <div className="-mx-2">
                {f.seats.map((s) => (
                  <div key={s.key} className="px-2 py-[6px] text-[12.5px] truncate" style={{ fontFamily: MONO, color: 'var(--text-2)', borderBottom: '1px solid var(--line-1)' }}>{s.name}</div>
                ))}
              </div>
            ) : (
              <p className="text-[12.5px] leading-[19px]" style={{ fontFamily: UI, color: 'var(--text-3)' }}>{f.seatsNote}</p>
            )}
          </HPanel>

          <HPanel title="Calibration">
            <NotServed item={f.calibration} />
          </HPanel>

          <HPanel title="How a verdict is earned">
            <p className="text-[12.5px] leading-[19px]" style={{ fontFamily: UI, color: 'var(--text-2)' }}>
              Each seat argues from its own brief, blind to the others, and a verifier grades the evidence behind every point rather than the conclusion. One bounded rebuttal follows. The verdict commits with its dissent attached, and it is scored later against what actually happened — a call nobody scores is not a call.
            </p>
          </HPanel>

          <HoldsPanel holds={f.holds} century={f.century} hasHolds={f.hasHolds} note={f.holdsNote} />
        </div>
      </div>

      <ReceiptDrawer receipt={f.receipt} onClose={() => ctx.onPick('receipt', '')} />
    </>
  )
}
