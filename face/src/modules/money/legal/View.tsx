// View.tsx -- money/legal: v0.7's Legal, drawing what fold() returned and deciding nothing (face v2 Phase 03,
// ADR-1320).
//
// Declared deltas from the reference: the gates table, the publish gate and the seals are read from /api/gates and /api/legal (Phase 04);
// the hash chain is NOT SERVED (ADR-1324) -- the reference drew them from a local store and a typed list; cycling a gate's mode,
// running the legal lints and the full-read stamp are work-door cards, not buttons (ADR-1326); the constitution is
// drawn by its provenance too, the file the seals are parsed from.
import type { ModuleViewContext } from '../../../lib/registry.mjs'
import type { Folded } from './fold.mjs'
import { UI, YoursBadge } from '../../../ui/kit'
import { HPanel, HoldsPanel, KpiStrip, LanePanel, NotServed, ReceiptDrawer, RoomHead, ServedTable, SourcesPanel, TrailPanel, VerbPending } from '../../../ui/bits'
export { Scales as Icon } from '@phosphor-icons/react'

export default function View({ f, ctx }: { f: Folded; ctx: ModuleViewContext }) {
  return (
    <>
      <RoomHead title={f.sentence} hint={f.lede} right={<YoursBadge>{f.badge}</YoursBadge>} />

      <KpiStrip items={f.kpis} />

      <div className="grid grid-cols-1 xl:grid-cols-[1.35fr_1fr] gap-4 items-start">
        <div className="min-w-0">
          <HPanel title="The gates" hint="arc.gates.yaml · a mode changes by a reviewed diff">
            <ServedTable item={f.gates} />
            <div className="mt-3">
              <VerbPending item={f.modeVerb} />
            </div>
          </HPanel>

          <HPanel title="The publish gate" hint="pieces waiting between draft and the internet">
            <ServedTable item={f.publishGate} />
            <div className="mt-3 space-y-2.5">
              <VerbPending item={f.lintVerb} />
              <VerbPending item={f.stampVerb} />
            </div>
          </HPanel>

          <TrailPanel trail={f.trail} onReceipt={(id) => ctx.onPick('receipt', id)} />
        </div>

        <div className="min-w-0">
          <HPanel title="The seals" hint="human sovereignty">
            <ServedTable item={f.seals} />
            <p className="mt-3 text-[12px] leading-[18px]" style={{ fontFamily: UI, color: 'var(--text-3)' }}>
              No level of proven autonomy ever includes these. Changing that article means it is no longer arc.
            </p>
          </HPanel>

          <SourcesPanel sources={f.sources} title="Where the seals are written" hint="the constitution, through the door · the seals above are parsed from it" />

          <HPanel title="Hash chain" hint="the legal lane's verification spine">
            <NotServed item={f.chain} />
          </HPanel>

          <HPanel title="Who may change what">
            <ul className="list-disc pl-4 space-y-1.5 text-[13px] leading-[19px] marker:text-(--text-3)" style={{ fontFamily: UI, color: 'var(--text-2)' }}>
              {f.whoMay.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </HPanel>

          <LanePanel lane={f.lane} />

          <HoldsPanel holds={f.holds} century={f.century} hasHolds={f.hasHolds} note={f.holdsNote} />
        </div>
      </div>

      <ReceiptDrawer receipt={f.receipt} onClose={() => ctx.onPick('receipt', '')} />
    </>
  )
}
