// View.tsx -- money/growth: v0.7's Growth, drawing what fold() returned and deciding nothing (face v2 Phase 03,
// ADR-1320).
//
// Declared deltas from the reference: the pipeline is a NOT SERVED panel until /api/growth (ADR-1324); drafting,
// the review pack and the merge are work-door cards, not forms (ADR-1326); the channel scoreboard counts the
// door's content.published receipts by the channel each names, where v0.7 counted a typed channel list; "lints on
// duty" is the served registry's own list.
import type { ModuleViewContext } from '../../../lib/registry.mjs'
import type { Folded } from './fold.mjs'
import { UI, YoursBadge } from '../../../ui/kit'
import { CountRows, DoorRefusal, HPanel, HoldsPanel, KpiStrip, LanePanel, NameList, NotServed, Reading, ReceiptDrawer, RoomHead, TrailPanel, VerbPending } from '../../../ui/bits'
export { Megaphone as Icon } from '@phosphor-icons/react'

export default function View({ f, ctx }: { f: Folded; ctx: ModuleViewContext }) {
  return (
    <>
      <RoomHead title={f.sentence} hint={f.lede} right={<YoursBadge>{f.badge}</YoursBadge>} />

      <KpiStrip items={f.kpis} />

      <div className="grid grid-cols-1 xl:grid-cols-[1.35fr_1fr] gap-4 items-start">
        <div className="min-w-0">
          <HPanel title="Draft a piece" hint="draft → review pack (your inbox) → approve → publish">
            <div className="space-y-2.5">
              <VerbPending item={f.draftVerb} />
              <VerbPending item={f.packVerb} />
              <VerbPending item={f.publishVerb} />
            </div>
          </HPanel>

          <HPanel title="The pipeline" hint="status moves only on receipts">
            <NotServed item={f.pipeline} />
          </HPanel>

          <TrailPanel trail={f.trail} onReceipt={(id) => ctx.onPick('receipt', id)} />
        </div>

        <div className="min-w-0">
          <HPanel title="Channel scoreboard" hint="content.published receipts, by the channel each names">
            {f.trail.isReading ? <Reading what="the publish receipts" /> : null}
            {f.trail.isRefused ? <DoorRefusal code={f.trail.refusal.code} human={f.trail.refusal.human} /> : null}
            {f.trail.isDrawn ? <CountRows rows={f.channels} isEmpty={f.showChannelsEmpty} empty={f.channelsEmpty} /> : null}
          </HPanel>

          <HPanel title="The two gates">
            <ol className="space-y-2 text-[13px] leading-[20px]" style={{ fontFamily: UI, color: 'var(--text-2)' }}>
              {f.gates.map((g) => (
                <li key={g.key}>
                  <b style={{ fontWeight: 600, color: 'var(--text-1)' }}>{g.name}</b>: {g.line}
                </li>
              ))}
            </ol>
          </HPanel>

          <HPanel title="Lints on duty" hint="from the served registry">
            <NameList names={f.lints} isEmpty={f.showLintsEmpty} empty={f.lintsEmpty} />
          </HPanel>

          <LanePanel lane={f.lane} />

          <HoldsPanel holds={f.holds} century={f.century} hasHolds={f.hasHolds} note={f.holdsNote} />
        </div>
      </div>

      <ReceiptDrawer receipt={f.receipt} onClose={() => ctx.onPick('receipt', '')} />
    </>
  )
}
