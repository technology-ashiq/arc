// View.tsx -- factory/review-ship: v0.7's Review · Ship, drawing what fold() returned and deciding
// nothing (face v2 Phase 03, ADR-1320).
//
// Declared deltas from the reference: the gate MODES, their budgets and the strictness profile are a
// NOT SERVED panel until /api/gates (ADR-1324) -- the gate NAMES are the served registry's and are
// drawn; Review, Run qa and Ship are work-door cards (ADR-1326); the run ledger v0.7 kept in its own
// store is the door's receipts, counted by kind and drawn as the trail.
import type { ModuleViewContext } from '../../../lib/registry.mjs'
import type { Folded } from './fold.mjs'
import { MONO, UI, YoursBadge } from '../../../ui/kit'
import { HPanel, HoldsPanel, KpiStrip, NotServed, ReceiptDrawer, RoomHead, TrailPanel, VerbPending } from '../../../ui/bits'
export { ShieldCheck as Icon } from '@phosphor-icons/react'

export default function View({ f, ctx }: { f: Folded; ctx: ModuleViewContext }) {
  return (
    <>
      <RoomHead title={f.sentence} hint={f.lede} right={<YoursBadge>{f.badge}</YoursBadge>} />

      <KpiStrip items={f.kpis} />

      <div className="grid grid-cols-1 xl:grid-cols-[1.4fr_1fr] gap-4 items-start">
        <div className="min-w-0">
          <HPanel title="Gates" hint="blocking by default · a mode change is a receipt">
            <div className="space-y-2.5">
              {f.hasGates ? (
                <div className="-mx-2">
                  {f.gates.map((g) => (
                    <div key={g.key} className="px-2 py-[6px] text-[12.5px] truncate" style={{ fontFamily: MONO, color: 'var(--text-2)', borderBottom: '1px solid var(--line-1)' }}>{g.name}</div>
                  ))}
                </div>
              ) : null}
              <NotServed item={f.gateModes} />
            </div>
          </HPanel>

          <HPanel title="Review and ship" hint="a review is keyed to the commit it read">
            <div className="space-y-2.5">
              <VerbPending item={f.reviewVerb} />
              <VerbPending item={f.shipVerb} />
            </div>
          </HPanel>

          <TrailPanel trail={f.trail} onReceipt={(id) => ctx.onPick('receipt', id)} />
        </div>

        <div className="min-w-0">
          <HPanel title="What runs it" hint="the CI workflows the registry names">
            {f.hasWorkflows ? (
              <div className="-mx-2">
                {f.workflows.map((w) => (
                  <div key={w.key} className="px-2 py-[6px] text-[12.5px] truncate" style={{ fontFamily: MONO, color: 'var(--text-2)', borderBottom: '1px solid var(--line-1)' }}>{w.name}</div>
                ))}
              </div>
            ) : (
              <p className="text-[12.5px] leading-[19px]" style={{ fontFamily: UI, color: 'var(--text-3)' }}>the served registry names no CI workflow in this room</p>
            )}
          </HPanel>

          <HPanel title="Blocking by default">
            <p className="text-[12.5px] leading-[19px]" style={{ fontFamily: UI, color: 'var(--text-2)' }}>
              A gate that cannot run blocks; it never passes quietly. A commit is the key: a new commit is a new review, and a stamp from the previous one does not carry over. Loosening the set is a profile switch with a reason written down, not a flag somebody remembers.
            </p>
          </HPanel>

          <HoldsPanel holds={f.holds} century={f.century} hasHolds={f.hasHolds} note={f.holdsNote} />
        </div>
      </div>

      <ReceiptDrawer receipt={f.receipt} onClose={() => ctx.onPick('receipt', '')} />
    </>
  )
}
