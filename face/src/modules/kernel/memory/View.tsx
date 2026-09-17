// View.tsx -- kernel/memory: v0.7's Memory, drawing what fold() returned and deciding nothing (face v2
// Phase 03, ADR-1320).
//
// Declared deltas from the reference: the lessons and the recall cost are NOT SERVED panels until
// /api/memory (ADR-1324); Log, Recall and Propose rule are verb-pending cards (ADR-1326); the trial ledger
// panel is the file the door serves, by path, hash and size, instead of its last rows copied into a bundle.
import type { ModuleViewContext } from '../../../lib/registry.mjs'
import type { Folded } from './fold.mjs'
import { UI, YoursBadge } from '../../../ui/kit'
import { HPanel, HoldsPanel, KpiStrip, LanePanel, NotServed, ReceiptDrawer, RoomHead, SourcesPanel, TrailPanel, VerbPending } from '../../../ui/bits'
export { Brain as Icon } from '@phosphor-icons/react'

export default function View({ f, ctx }: { f: Folded; ctx: ModuleViewContext }) {
  return (
    <>
      <RoomHead title={f.sentence} hint={f.lede} right={<YoursBadge>{f.badge}</YoursBadge>} />

      <KpiStrip items={f.kpis} />

      <div className="grid grid-cols-1 xl:grid-cols-[1.4fr_1fr] gap-4 items-start">
        <div className="min-w-0">
          <HPanel title="Log a correction" hint="repeats are counted by normalized text">
            <VerbPending item={f.logVerb} />
          </HPanel>

          <HPanel title="Recall" hint="a fold over lessons, the trial ledger and receipts · no model, no spend">
            <VerbPending item={f.recallVerb} />
          </HPanel>

          <HPanel title="Lessons" hint="yours · the retro log · promoted">
            <NotServed item={f.lessons} />
          </HPanel>

          <TrailPanel trail={f.trail} onReceipt={(id) => ctx.onPick('receipt', id)} />
        </div>

        <div className="min-w-0">
          <HPanel title="The playbook rule">
            <p className="text-[12.5px] leading-[19px]" style={{ fontFamily: UI, color: 'var(--text-2)' }}>
              A correction made twice becomes a rule. The retro reads repeated corrections and turns each into a permanent setup upgrade, and promotion is your stamp, never the machine's.
            </p>
          </HPanel>

          <HPanel title="Recall cost">
            <NotServed item={f.recallCost} />
          </HPanel>

          <SourcesPanel sources={f.sources} title="The retro log and the trial ledger" hint="as the door serves them" />

          <LanePanel lane={f.lane} title="Memory lane phases" />

          <HoldsPanel holds={f.holds} century={f.century} />
        </div>
      </div>

      <ReceiptDrawer receipt={f.receipt} onClose={() => ctx.onPick('receipt', '')} />
    </>
  )
}
