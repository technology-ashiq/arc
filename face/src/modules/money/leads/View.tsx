// View.tsx -- money/leads: v0.7's Leads, drawing what fold() returned and deciding nothing (face v2 Phase 03,
// ADR-1320).
//
// Declared deltas from the reference: the funnel's columns count the door's receipts by kind, where v0.7 drew a
// card per lead from a local store -- no lead is named on this screen, only its HMAC id; the per-lead funnel, the caps and the
// suppression ledger are read from /api/leads (Phase 04); research, send, move and suppress are
// work-door cards, not buttons (ADR-1326).
import type { ModuleViewContext } from '../../../lib/registry.mjs'
import type { Folded } from './fold.mjs'
import { MONO, UI, YoursBadge } from '../../../ui/kit'
import { HPanel, HoldsPanel, KpiStrip, LanePanel, ReceiptDrawer, RoomHead, ServedTable, TrailPanel, VerbPending } from '../../../ui/bits'
export { Funnel as Icon } from '@phosphor-icons/react'

export default function View({ f, ctx }: { f: Folded; ctx: ModuleViewContext }) {
  return (
    <>
      <RoomHead title={f.sentence} hint={f.lede} right={<YoursBadge>{f.badge}</YoursBadge>} />

      <KpiStrip items={f.kpis} />

      <HPanel title="The funnel" hint="receipts by kind, in the funnel's order">
        <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-7 gap-3">
          {f.funnel.map((s) => (
            <div key={s.key} data-funnel-stage={s.stage} className="min-w-0 p-3" style={{ background: 'var(--well)', border: `1px ${s.isHomed ? 'solid' : 'dashed'} var(--line-1)`, borderRadius: 'var(--r-md)' }}>
              <div className="text-[11px] uppercase tracking-[0.08em] truncate" style={{ fontFamily: UI, fontWeight: 600, color: 'var(--text-3)' }}>{s.stage}</div>
              <div className="text-[22px] leading-[28px] tnum mt-1" style={{ fontFamily: MONO, fontWeight: 600, color: 'var(--text-1)' }}>{s.v}</div>
              <div className="text-[11px] truncate" style={{ fontFamily: MONO, color: 'var(--text-3)' }}>{s.kind}</div>
            </div>
          ))}
        </div>
        <p className="text-[12px] leading-[18px] mt-3" style={{ fontFamily: UI, color: 'var(--text-3)' }}>{f.funnelNote}</p>
      </HPanel>

      <div className="grid grid-cols-1 xl:grid-cols-[1.35fr_1fr] gap-4 items-start">
        <div className="min-w-0">
          <HPanel title="Research a lead" hint="geography rides on every lead · the jurisdiction guard">
            <div className="space-y-2.5">
              <VerbPending item={f.researchVerb} />
              <VerbPending item={f.moveVerb} />
              <VerbPending item={f.suppressVerb} />
            </div>
          </HPanel>

          <HPanel title="The funnel by lead" hint="one card per lead, never a raw contact">
            <ServedTable item={f.byLead} />
          </HPanel>

          <TrailPanel trail={f.trail} onReceipt={(id) => ctx.onPick('receipt', id)} />
        </div>

        <div className="min-w-0">
          <HPanel title="The caps" hint="values in config, enforcement in code">
            <ServedTable item={f.caps} />
            <ul className="mt-3 list-disc pl-4 space-y-1 text-[12px] leading-[18px] marker:text-(--text-3)" style={{ fontFamily: UI, color: 'var(--text-2)' }}>
              {f.guard.map((g) => (
                <li key={g}>{g}</li>
              ))}
            </ul>
          </HPanel>

          <HPanel title="Suppression ledger" hint="event-backed, derived · no way to reset it">
            <ServedTable item={f.ledger} />
          </HPanel>

          <LanePanel lane={f.lane} />

          <HoldsPanel holds={f.holds} century={f.century} hasHolds={f.hasHolds} note={f.holdsNote} />
        </div>
      </div>

      <ReceiptDrawer receipt={f.receipt} onClose={() => ctx.onPick('receipt', '')} />
    </>
  )
}
