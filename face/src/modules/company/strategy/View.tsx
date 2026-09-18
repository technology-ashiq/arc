// View.tsx -- company/strategy: v0.7's Strategy, drawing what fold() returned and deciding nothing (face v2 Phase 03,
// company ring, ADR-1320).
//
// Declared deltas from the reference: the live plans are the board's LIVE lanes and the shelf is the served
// registry's plans, not a seeded list with a "yours" tab; the ADR index and the too-expensive-to-revisit list are NOT
// SERVED until /api/adrs (ADR-1324); adopting a plan and recording an ADR are work-door cards, not forms (ADR-1326).
import type { ModuleViewContext } from '../../../lib/registry.mjs'
import type { Folded } from './fold.mjs'
import { MONO, UI, YoursBadge } from '../../../ui/kit'
import { DoorRefusal, HPanel, HoldsPanel, KpiStrip, NotServed, Reading, RoomHead, VerbPending } from '../../../ui/bits'
export { Compass as Icon } from '@phosphor-icons/react'

export default function View({ f, ctx }: { f: Folded; ctx: ModuleViewContext }) {
  return (
    <>
      <RoomHead title={f.sentence} hint={f.lede} right={<YoursBadge>{f.badge}</YoursBadge>} />

      <KpiStrip items={f.kpis} />

      <div className="grid grid-cols-1 xl:grid-cols-[1.3fr_1fr] gap-4 items-start">
        <div className="min-w-0">
          <HPanel title="Live plans" hint="initiatives/<lane>/PLAN.md · one per lane, from the board">
            {f.board.isReading ? <Reading what="the board" /> : null}
            {f.board.isRefused ? <DoorRefusal code={f.board.refusal.code} human={f.board.refusal.human} /> : null}
            {f.isLiveEmpty ? <p className="text-[12.5px] leading-[19px]" style={{ fontFamily: UI, color: 'var(--text-3)' }}>{f.liveEmpty}</p> : null}
            <div className="-mx-2">
              {f.live.map((p) => (
                <div key={p.key} data-live-plan={p.lane} className="px-2 py-[9px] min-w-0" style={{ borderBottom: '1px solid var(--line-1)' }}>
                  <div className="flex items-baseline gap-2.5 flex-wrap">
                    {p.canOpen ? (
                      <button type="button" onClick={() => ctx.onOpen(p.lane)} className="text-[13px] cursor-pointer underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-(--accent)" style={{ fontFamily: MONO, fontWeight: 600, color: 'var(--text-1)' }}>{p.lane}</button>
                    ) : (
                      <span className="text-[13px]" style={{ fontFamily: MONO, fontWeight: 600, color: 'var(--text-1)' }}>{p.lane}</span>
                    )}
                    <span className="text-[12px]" style={{ fontFamily: UI, color: 'var(--text-3)' }}>{p.phase}</span>
                  </div>
                  <div className="text-[13px] leading-[19px] mt-0.5 break-words" style={{ fontFamily: UI, color: 'var(--text-2)' }}>{p.cycle}</div>
                  <div className="text-[11px] mt-0.5 break-all" style={{ fontFamily: MONO, color: 'var(--text-3)' }}>{p.path}</div>
                </div>
              ))}
            </div>
          </HPanel>

          <HPanel title="The shelf" hint="docs/strategy/plans · the design sources and briefs, history once adopted">
            {f.isShelfEmpty ? <p className="text-[12.5px] leading-[19px]" style={{ fontFamily: UI, color: 'var(--text-3)' }}>{f.shelfEmpty}</p> : null}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
              {f.shelf.map((p) => (
                <div key={p.key} data-plan={p.id} className="py-[6px] text-[12.5px] leading-[18px] break-all" style={{ fontFamily: MONO, color: 'var(--text-2)', borderBottom: '1px solid var(--line-1)' }}>{p.id}</div>
              ))}
            </div>
          </HPanel>
        </div>

        <div className="min-w-0">
          <HPanel title="Change the plan" hint="adoption and the decision record, through the work door">
            <div className="space-y-2.5">
              <VerbPending item={f.adoptVerb} />
              <VerbPending item={f.recordVerb} />
            </div>
          </HPanel>

          <HPanel title="The decision record" hint="docs/adr · one century per lane">
            <NotServed item={f.adrs} />
          </HPanel>

          <HPanel title="Too expensive to revisit">
            <NotServed item={f.expensive} />
          </HPanel>

          <HoldsPanel holds={f.holdsShown} century={f.century} hasHolds={f.hasHoldsShown} note={f.holdsNote} />
        </div>
      </div>
    </>
  )
}
