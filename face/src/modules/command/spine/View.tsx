// View.tsx -- command/spine: v0.7's SpineRoom, drawing what fold() returned and deciding nothing (face
// v2 Phase 03, ADR-1320).
//
// Declared deltas from the reference: the day pick reads the door's today, yesterday or the log's first
// page instead of a simulated day; the family filter is the door's `kind` query over the reserved
// meanings; the integrity panel quotes the door's own quarantine and torn-line figures in place of
// numbers typed into the reference; the data-source panel says which spine the door is reading.
import { Pulse } from '@phosphor-icons/react'
import type { ModuleViewContext } from '../../../lib/registry.mjs'
import type { Folded } from './fold.mjs'
import { MONO, PickRow, SimBadge, UI, YoursBadge } from '../../../ui/kit'
import { DoorRefusal, Empty, EventRow, HPanel, KpiStrip, Reading, ReceiptDrawer, RoomHead, SectionLabel } from '../../../ui/bits'
export { Pulse as Icon } from '@phosphor-icons/react'

export default function View({ f, ctx }: { f: Folded; ctx: ModuleViewContext }) {
  return (
    <>
      <RoomHead
        title={f.sentence}
        hint={f.lede}
        right={f.isSim ? <SimBadge>{f.sourceBadge}</SimBadge> : <YoursBadge>{f.sourceBadge}</YoursBadge>}
      />

      <KpiStrip items={f.kpis} />

      <div className="grid grid-cols-1 xl:grid-cols-[1.45fr_1fr] gap-4 items-start">
        <div className="min-w-0">
          <HPanel
            title="The log"
            hint={f.log.hint}
            actions={<PickRow small options={f.scopes} value={f.scope} onPick={(v) => ctx.onPick('scope', v)} label="which day" />}
          >
            <div className="mb-3">
              <PickRow small options={f.families} value={f.family} onPick={(v) => ctx.onPick('family', v)} label="which family of kinds" />
            </div>
            <div className="max-h-[560px] overflow-y-auto -mx-2" style={{ scrollbarWidth: 'thin' }}>
              {f.log.isReading && <Reading what="the log" />}
              {f.log.isRefused && <DoorRefusal code={f.log.refusal.code} human={f.log.refusal.human} />}
              {f.log.rows.map((row) => (
                <EventRow key={row.id} row={row} onReceipt={(id) => ctx.onPick('receipt', id)} />
              ))}
              {f.log.isEmpty && <Empty icon={Pulse} title="No events under this filter" hint="Widen the filter or pick another day. Every line that lands here is a receipt." />}
            </div>
            <p className="mt-2 text-[11.5px] leading-[17px]" style={{ fontFamily: UI, color: 'var(--text-3)' }}>{f.log.foot}</p>
            <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--line-1)' }}>
              <SectionLabel>Legend</SectionLabel>
              <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                {f.legend.map((l) => (
                  <span key={l.key} className="inline-flex items-center gap-1.5 text-[11.5px]" style={{ fontFamily: UI, color: 'var(--text-2)' }}>
                    <span aria-hidden="true" className="w-[6px] h-[6px] rounded-full" style={{ background: l.ink }} /> {l.label}
                  </span>
                ))}
              </div>
            </div>
          </HPanel>
        </div>

        <div className="min-w-0">
          <HPanel title="The spine laws" hint="each one a written decision">
            <div className="grid grid-cols-1 gap-2">
              {f.laws.map((law) => (
                <div key={law.adr} className="p-3 min-w-0" style={{ background: 'var(--well)', border: '1px solid var(--line-1)', borderRadius: 'var(--r-md)' }}>
                  <div className="flex items-baseline gap-2 mb-0.5 flex-wrap">
                    <span className="text-[11px]" style={{ fontFamily: MONO, color: 'var(--accent)' }}>{law.adr}</span>
                    <span className="text-[13px]" style={{ fontFamily: UI, fontWeight: 600, color: 'var(--text-1)' }}>{law.title}</span>
                  </div>
                  <div className="text-[12.5px] leading-[19px]" style={{ fontFamily: UI, color: 'var(--text-2)' }}>{law.law}</div>
                </div>
              ))}
            </div>
          </HPanel>

          <HPanel title="Integrity" hint="mechanics, not promises">
            <div className="space-y-2.5 text-[12.5px] leading-[19px]" style={{ fontFamily: UI, color: 'var(--text-2)' }}>
              {f.integrity.map((row) => (
                <div key={row.key}>
                  <b style={{ fontWeight: 600, color: 'var(--text-1)' }}>{row.title}</b> — {row.text}
                </div>
              ))}
            </div>
          </HPanel>

          <HPanel title="Data source" hint="views rebuild from the log">
            <p className="text-[13px] leading-[20px]" style={{ fontFamily: UI, color: 'var(--text-2)' }}>{f.source}</p>
          </HPanel>
        </div>
      </div>

      <ReceiptDrawer receipt={f.receipt} onClose={() => ctx.onPick('receipt', '')} />
    </>
  )
}
