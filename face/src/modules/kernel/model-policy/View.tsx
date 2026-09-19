// View.tsx -- kernel/model-policy: v0.7's ModelPolicy, drawing what fold() returned and deciding nothing
// (face v2 Phase 03, ADR-1320).
//
// Declared deltas from the reference: the tier table and the process routes are read from /api/model-policy (Phase 04); the egress allowlist is
// NOT SERVED, because only the egress proxy parses it, in Python (ADR-1324); "Propose tier" is a
// verb-pending card, not a button, until the work door (ADR-1326); the ADR-0069 panel states the law in
// words rather than quoting a bundled copy of the ADR; the registry homes no kind here, so the trail says
// where the record of a tier change lives instead.
import type { ModuleViewContext } from '../../../lib/registry.mjs'
import type { Folded } from './fold.mjs'
import { Btn, UI, YoursBadge } from '../../../ui/kit'
import { HPanel, HoldsPanel, KpiStrip, LanePanel, NotServed, ReceiptDrawer, RoomHead, ServedTable, SourcesPanel, TrailPanel } from '../../../ui/bits'
export { Stack as Icon } from '@phosphor-icons/react'

export default function View({ f, ctx }: { f: Folded; ctx: ModuleViewContext }) {
  return (
    <>
      <RoomHead title={f.sentence} hint={f.lede} right={<YoursBadge>{f.badge}</YoursBadge>} />

      <KpiStrip items={f.kpis} />

      <div className="grid grid-cols-1 xl:grid-cols-[1.4fr_1fr] gap-4 items-start">
        <div className="min-w-0">
          <HPanel title="The tier table" hint="a tier is a job description first; the model name is the implementation">
            <ServedTable item={f.tiers} />
          </HPanel>

          <HPanel title="Process routes" hint="class · tier · driver · fallback chain · contractors carry tenure">
            <div className="space-y-2.5">
              <ServedTable item={f.routesTable} />
            </div>
          </HPanel>

          <TrailPanel trail={f.trail} onReceipt={(id) => ctx.onPick('receipt', id)} />
        </div>

        <div className="min-w-0">
          <HPanel title="ADR-0069" hint="the balanced model policy" actions={f.bench.canOpen && <Btn small onClick={() => ctx.onOpen(f.bench.room)}>Scorecards live on the bench →</Btn>}>
            <p className="text-[12.5px] leading-[19px]" style={{ fontFamily: UI, color: 'var(--text-2)' }}>
              Changing the tier a process runs at is a production change: a reviewed diff that cites the ADR, never a quiet edit. The router file never updates itself, nothing switches a tier at run time, and a rollback is another reviewed diff.
            </p>
          </HPanel>

          <LanePanel lane={f.lane} />

          <HPanel title="Egress allowlist" hint="exact host and port only">
            <NotServed item={f.egress} />
          </HPanel>

          <SourcesPanel sources={f.sources} hint="the file the tiers and routes are parsed from" />

          <HoldsPanel holds={f.holds} century={f.century} hasHolds={f.hasHolds} note={f.holdsNote} />
        </div>
      </div>

      <ReceiptDrawer receipt={f.receipt} onClose={() => ctx.onPick('receipt', '')} />
    </>
  )
}
