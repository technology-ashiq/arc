// View.tsx -- command/board: v0.7's Board, drawing what fold() returned and deciding nothing (face v2
// Phase 03, ADR-1320).
//
// Declared deltas from the reference: every lane value is its PROGRESS header through the door, in
// PORTFOLIO.md's order unless re-sorted; a blocked lane and a lane past its line wear no reserved colour
// (blocked is not needs-you and burn is not an incident), the words carry it; the pipeline counts the
// door's day of receipts by kind; the venture cards are the ledger's kill panel through /api/ventures, and the base rate is NOT SERVED (ADR-1324).
import type { ModuleViewContext } from '../../../lib/registry.mjs'
import type { Folded } from './fold.mjs'
import { Btn, FONT, MONO, Meter, PickRow, UI, YoursBadge } from '../../../ui/kit'
import { DoorRefusal, HPanel, KpiStrip, NotServed, Reading, RoomHead, ServedTable } from '../../../ui/bits'
export { Kanban as Icon } from '@phosphor-icons/react'

// one column template for the header row and every lane row
const COLS = 'md:grid-cols-[120px_80px_minmax(0,1fr)_128px_128px_140px]'

export default function View({ f, ctx }: { f: Folded; ctx: ModuleViewContext }) {
  return (
    <>
      <RoomHead title={f.sentence} hint={f.lede} right={<YoursBadge>{f.badge}</YoursBadge>} />

      <KpiStrip items={f.kpis} />

      <HPanel
        title="Lanes"
        hint="appetite bought vs spent · at the line the phase-done gate refuses and the lane stops"
        actions={
          <>
            <PickRow small options={f.sorts} value={f.sort} onPick={(v) => ctx.onPick('sort', v)} label="sort the lanes" />
            {f.canOpenOrg && <Btn small onClick={() => ctx.onOpen(f.orgRoom)}>The roster → org</Btn>}
          </>
        }
      >
        {f.lanes.isReading && <Reading what="the board" />}
        {f.lanes.isRefused && <DoorRefusal code={f.lanes.refusal.code} human={f.lanes.refusal.human} />}
        {f.lanes.hasRows && (
          <div>
            <div className={`hidden md:grid ${COLS} gap-x-3 px-2 pb-2 text-[11px] uppercase tracking-[0.08em]`} style={{ fontFamily: UI, fontWeight: 600, color: 'var(--text-3)', borderBottom: '1px solid var(--line-1)' }}>
              <span>lane</span>
              <span>status</span>
              <span>phase · what it is waiting on</span>
              <span className="text-right">burn / appetite</span>
              <span>burn</span>
              <span className="text-right">kill distance</span>
            </div>
            {f.lanes.rows.map((r) => (
              <div key={r.lane} data-lane={r.lane} className={`grid grid-cols-1 ${COLS} gap-x-3 gap-y-1 items-center px-2 py-2.5 transition-colors duration-200 hover:bg-(--bg-3)`} style={{ borderBottom: '1px solid var(--line-1)', borderRadius: 'var(--r-sm)' }}>
                <button type="button" disabled={!r.canOpen} onClick={() => ctx.onOpen(r.room)} className="text-left cursor-pointer disabled:cursor-default flex items-center gap-2 min-w-0">
                  <span className="text-[12.5px] truncate" style={{ fontFamily: MONO, fontWeight: 600, color: 'var(--text-1)' }}>{r.lane}</span>
                </button>
                <span className="text-[11.5px]" style={{ fontFamily: MONO, fontWeight: 600, color: r.statusInk }}>{r.status}</span>
                <span className="min-w-0 text-[13px] leading-[18px]" style={{ fontFamily: UI }}>
                  <span className="break-words" style={{ color: 'var(--text-1)' }}>{r.phase}</span>
                  <span className="block text-[12px] truncate" style={{ color: 'var(--text-3)' }}>{r.sub}</span>
                </span>
                <span className="text-[12px] tnum md:text-right" style={{ fontFamily: MONO, color: 'var(--text-2)' }}>{r.appetite}</span>
                <span className="flex items-center gap-2 min-w-0">
                  <span className="flex-1 min-w-0">
                    <Meter value={r.meter} label={`${r.lane} burn`} />
                  </span>
                  <span className="text-[11.5px] w-[42px] text-right tnum shrink-0" style={{ fontFamily: MONO, color: 'var(--text-2)' }}>{r.pct}</span>
                </span>
                <span className="text-[11.5px] tnum md:text-right" style={{ fontFamily: MONO, fontWeight: 600, color: 'var(--text-2)' }}>{r.distance}</span>
              </div>
            ))}
            <p className="mt-3 text-[12px] leading-[18px]" style={{ fontFamily: UI, color: 'var(--text-3)' }}>{f.lanes.foot}</p>
          </div>
        )}
      </HPanel>

      <HPanel title="Pipeline" hint={f.pipelineHint}>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {f.pipeline.map((s) => (
            <div key={s.key} className="p-3 min-w-0" style={{ background: 'var(--well)', border: '1px solid var(--line-1)', borderRadius: 'var(--r-md)' }}>
              <div className="text-[12px] mb-1 truncate" style={{ fontFamily: UI, color: 'var(--text-3)' }}>{s.name}</div>
              <div className="text-[24px] leading-[28px] tracking-[-0.01em] tnum" style={{ fontFamily: FONT, fontWeight: 600, color: 'var(--text-1)' }}>{s.n}</div>
              <div className="text-[11.5px] leading-[16px] mt-0.5 break-words" style={{ fontFamily: UI, color: 'var(--text-2)' }}>{s.note}</div>
            </div>
          ))}
        </div>
      </HPanel>

      <HPanel title="Ventures" hint="kill-distance cards · criteria set at kickoff, in writing">
        <ServedTable item={f.ventures} />
      </HPanel>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <HPanel title="The base rate" hint="planned for, before the first launch">
          <NotServed item={f.baseRate} />
        </HPanel>
        <HPanel title="Appetite is the kill line">
          <p className="text-[13px] leading-[20px]" style={{ fontFamily: UI, color: 'var(--text-2)' }}>A lane buys its appetite at kickoff in days. Burn is spent against bought; at the line the phase-done gate refuses and the lane stops. Extending is a new decision, recorded, never a quiet edit of the number.</p>
        </HPanel>
        <HPanel title="Kill honestly" hint="constitution A10">
          <p className="text-[13px] leading-[20px]" style={{ fontFamily: UI, color: 'var(--text-2)' }}>Fail the written criteria and the venture is attic'd with a retro, components harvested, the lesson pinned. Never deleted. The kill review lands in the inbox with its facts on the card.</p>
        </HPanel>
      </div>
    </>
  )
}
