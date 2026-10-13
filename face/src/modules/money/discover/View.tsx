// View.tsx -- money/discover: discover's own receipts, drawing what fold() returned and deciding nothing (face v2
// Phase 17, ADR-1356, ADR-1320).
//
// Declared deltas from the reference: v0.7 rehearsed hunt, score and shortlist as forms; the lane is born, so the room
// draws what its receipts say instead -- the ideas captured, the last hunt and judge, and each winner with your
// decision. Running a hunt stays /arc-hunt, so there is no form here.
import type { ModuleViewContext } from '../../../lib/registry.mjs'
import type { Folded } from './fold.mjs'
import { UI, YoursBadge } from '../../../ui/kit'
import { HPanel, KpiStrip, RoomHead, ServedTable } from '../../../ui/bits'
export { Lightbulb as Icon } from '@phosphor-icons/react'

export default function View({ f }: { f: Folded; ctx: ModuleViewContext }) {
  return (
    <>
      <RoomHead title={f.sentence} hint={f.lede} right={<YoursBadge>{f.badge}</YoursBadge>} />

      <KpiStrip items={f.kpis} />

      <div className="grid grid-cols-1 xl:grid-cols-[1.4fr_1fr] gap-4 items-start">
        <div className="min-w-0">
          <HPanel title="Winners" hint="each discover-proposed venture, and what you decided">
            {f.showNoHunt && (
              <p className="text-[12.5px] leading-[19px] mb-3" style={{ fontFamily: UI, color: 'var(--text-2)' }}>{f.noHunt}</p>
            )}
            <ServedTable item={f.winners} />
          </HPanel>
        </div>

        <div className="min-w-0">
          <HPanel title="The room's rules" hint="what the discover lane holds itself to">
            <div className="text-[12.5px] leading-[19px] space-y-1.5" style={{ fontFamily: UI, color: 'var(--text-2)' }}>
              {f.rules.map((r) => (
                <div key={r}>· {r}</div>
              ))}
            </div>
          </HPanel>
        </div>
      </div>
    </>
  )
}
