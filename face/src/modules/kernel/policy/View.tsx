// View.tsx -- kernel/policy: v0.7's Policy, drawing what fold() returned and deciding nothing (face v2
// Phase 03, ADR-1320).
//
// Declared deltas from the reference: the subject table and the ladder are read from /api/policy, which
// parses hq.policy.yaml with the policy lane's own reducer (Phase 04); Propose cap, Demote, Promote and Declare are verb-pending
// cards until the work door (ADR-1326); the figures count the receipts the registry homes here, and no
// figure wears amber or red -- a count of past level changes is not a thing waiting on you.
import type { ModuleViewContext } from '../../../lib/registry.mjs'
import type { Folded } from './fold.mjs'
import { UI, YoursBadge } from '../../../ui/kit'
import { HPanel, HoldsPanel, KpiStrip, LanePanel, ReceiptDrawer, RoomHead, ServedTable, SourcesPanel, TrailPanel, VerbPending } from '../../../ui/bits'
export { ShieldCheck as Icon } from '@phosphor-icons/react'

export default function View({ f, ctx }: { f: Folded; ctx: ModuleViewContext }) {
  return (
    <>
      <RoomHead title={f.sentence} hint={f.lede} right={<YoursBadge>{f.badge}</YoursBadge>} />

      <KpiStrip items={f.kpis} />

      <div className="grid grid-cols-1 xl:grid-cols-[1.4fr_1fr] gap-4 items-start">
        <div className="min-w-0">
          <HPanel title="The subject table" hint="ceiling · cap · effective is the lower of the two">
            <div className="space-y-2.5">
              <ServedTable item={f.subjects} />
              <VerbPending item={f.capVerb} />
            </div>
          </HPanel>

          <HPanel title="Declare a subject" hint="no row in the policy file, no job">
            <VerbPending item={f.declare} />
          </HPanel>

          <HPanel title="The ladder" hint="per capability · trial-ledger evidence">
            <ServedTable item={f.ladder} />
          </HPanel>

          <TrailPanel trail={f.trail} onReceipt={(id) => ctx.onPick('receipt', id)} />
        </div>

        <div className="min-w-0">
          <HPanel title="Two keys">
            <p className="text-[12.5px] leading-[19px]" style={{ fontFamily: UI, color: 'var(--text-2)' }}>
              A capability moves only when two keys turn. The ceiling is a repo edit in a reviewed diff, which this face refuses to fake. The cap is earned on receipts and rises only on your stamp. What a process may actually do is the lower of the two, and a demotion never waits for either key.
            </p>
          </HPanel>

          <HPanel title="Deny by default">
            <p className="text-[12.5px] leading-[19px]" style={{ fontFamily: UI, color: 'var(--text-2)' }}>
              A subject with no row in the policy file may touch nothing, and a scheduled job that names no subject never runs. Some capabilities stay human forever and cannot be granted at any level.
            </p>
          </HPanel>

          <LanePanel lane={f.lane} />

          <SourcesPanel sources={f.sources} hint="the file the subject table will be parsed from" />

          <HoldsPanel holds={f.holds} century={f.century} hasHolds={f.hasHolds} note={f.holdsNote} />
        </div>
      </div>

      <ReceiptDrawer receipt={f.receipt} onClose={() => ctx.onPick('receipt', '')} />
    </>
  )
}
