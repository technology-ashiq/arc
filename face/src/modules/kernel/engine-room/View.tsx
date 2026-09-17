// View.tsx -- kernel/engine-room: v0.7's EngineRoom, drawing what fold() returned and deciding nothing
// (face v2 Phase 03, ADR-1320).
//
// Declared deltas from the reference: the driver list is a NOT SERVED panel until /api/engine parses the
// router file (ADR-1324); the key field, Save + test and Remove key are not ported, because no provider
// key lives in the browser (ADR-1325) -- the brain panel says where the key lives instead; the data-source
// picker and the workspace export are gone, the face always reads the door; runs are the door's
// run.completed receipts, grouped by process.
import type { ModuleViewContext } from '../../../lib/registry.mjs'
import type { Folded } from './fold.mjs'
import { Btn, UI, YoursBadge } from '../../../ui/kit'
import { DoorRefusal, HPanel, HoldsPanel, KpiStrip, LanePanel, NotServed, Reading, ReceiptDrawer, RoomHead, RunRows, SourcesPanel, TrailPanel } from '../../../ui/bits'
export { Gear as Icon } from '@phosphor-icons/react'

export default function View({ f, ctx }: { f: Folded; ctx: ModuleViewContext }) {
  return (
    <>
      <RoomHead title={f.sentence} hint={f.lede} right={<YoursBadge>{f.badge}</YoursBadge>} />

      <KpiStrip items={f.kpis} />

      <div className="grid grid-cols-1 xl:grid-cols-[1.4fr_1fr] gap-4 items-start">
        <div className="min-w-0">
          <HPanel title="Drivers, routers and budgets" hint="any driver plugs in · the router picks per task class">
            <NotServed item={f.drivers} />
          </HPanel>

          <HPanel title="Runs by process" hint="run.completed receipts, grouped by the process that ran">
            {f.trail.isReading && <Reading what="the run receipts" />}
            {f.trail.isRefused && <DoorRefusal code={f.trail.refusal.code} human={f.trail.refusal.human} />}
            {f.trail.isDrawn && <RunRows rows={f.runs} isEmpty={f.showRunsEmpty} empty="No run.completed receipt on the page the door sent names a process." />}
          </HPanel>

          <TrailPanel trail={f.trail} onReceipt={(id) => ctx.onPick('receipt', id)} />
        </div>

        <div className="min-w-0">
          <LanePanel lane={f.lane} />

          <HPanel title="The face's brain" hint="ADR-1325 · no key in this browser" actions={f.ask.canOpen && <Btn small onClick={() => ctx.onOpen(f.ask.room)}>Ask arc →</Btn>}>
            <p className="text-[12.5px] leading-[19px]" style={{ fontFamily: UI, color: 'var(--text-2)' }}>
              No provider key is typed, stored or held here. A question to arc goes through the door, which runs the face-ask process on the machine that holds the key and hands back the answer with its receipt. Swapping the model is a reviewed change to the router, never a field in a browser.
            </p>
          </HPanel>

          <SourcesPanel sources={f.sources} hint="the file the driver table will be parsed from" />

          <HoldsPanel holds={f.holds} century={f.century} />
        </div>
      </div>

      <ReceiptDrawer receipt={f.receipt} onClose={() => ctx.onPick('receipt', '')} />
    </>
  )
}
