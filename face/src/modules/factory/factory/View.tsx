// View.tsx -- factory/factory: v0.7's Factory, drawing what fold() returned and deciding nothing (face v2 Phase 03,
// ADR-1320, ADR-1337).
//
// Declared deltas from the reference: the live cycle is every LIVE lane on the board, each value from its own header,
// not one root PLAN.md; the parts are counted from the served registry rather than a typed ARC table; gate modes and
// the profile are read from /api/gates (Phase 04) and switching the profile is a work-door card, not a picker
// (ADR-1326); the commands and agents are the toolbelt's and the agents room's, so this room counts them and links out.
import type { ModuleViewContext } from '../../../lib/registry.mjs'
import type { Folded } from './fold.mjs'
import { FONT, MONO, UI, YoursBadge } from '../../../ui/kit'
import { DoorRefusal, HPanel, HoldsPanel, KpiStrip, Reading, ReceiptDrawer, RoomHead, ServedTable, TrailPanel } from '../../../ui/bits'
export { Factory as Icon } from '@phosphor-icons/react'

export default function View({ f, ctx }: { f: Folded; ctx: ModuleViewContext }) {
  return (
    <>
      <RoomHead title={f.sentence} hint={f.lede} right={<YoursBadge>{f.badge}</YoursBadge>} />

      <KpiStrip items={f.kpis} />

      <div className="grid grid-cols-1 xl:grid-cols-[1.35fr_1fr] gap-4 items-start">
        <div className="min-w-0">
          <HPanel title="On the floor" hint="every running cycle · its phase and what it waits on, from its own header">
            {f.board.isReading ? <Reading what="the board" /> : null}
            {f.board.isRefused ? <DoorRefusal code={f.board.refusal.code} human={f.board.refusal.human} /> : null}
            {f.isFloorEmpty ? <p className="text-[12.5px] leading-[19px]" style={{ fontFamily: UI, color: 'var(--text-3)' }}>{f.floorEmpty}</p> : null}
            {f.hasDropped ? <p className="text-[12.5px] leading-[19px] mb-2" style={{ fontFamily: UI, color: 'var(--text-3)' }}>{f.dropped}</p> : null}
            <div className="-mx-2">
              {f.floor.map((c) => (
                <div key={c.key} data-floor={c.lane} className="px-2 py-[10px] min-w-0" style={{ borderBottom: '1px solid var(--line-1)' }}>
                  <div className="flex items-baseline gap-2.5 flex-wrap">
                    {c.canOpen ? (
                      <button type="button" onClick={() => ctx.onOpen(c.lane)} className="text-[13px] cursor-pointer underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-(--accent)" style={{ fontFamily: MONO, fontWeight: 600, color: 'var(--text-1)' }}>{c.lane}</button>
                    ) : (
                      <span className="text-[13px]" style={{ fontFamily: MONO, fontWeight: 600, color: 'var(--text-1)' }}>{c.lane}</span>
                    )}
                    <span className="text-[12px]" style={{ fontFamily: UI, color: 'var(--text-3)' }}>{c.phaseLine}</span>
                  </div>
                  <div className="text-[13px] leading-[19px] mt-0.5 break-words" style={{ fontFamily: UI, color: 'var(--text-2)' }}>{c.cycle}</div>
                  {c.isWaiting ? <div className="text-[12.5px] leading-[18px] mt-1 break-words" style={{ fontFamily: UI, color: 'var(--text-1)' }}>{c.waiting}</div> : null}
                </div>
              ))}
            </div>
          </HPanel>

          <TrailPanel trail={f.trail} onReceipt={(id) => ctx.onPick('receipt', id)} />
        </div>

        <div className="min-w-0">
          <HPanel title="The factory's parts" hint="counted from the served registry">
            <div className="grid grid-cols-2 gap-3">
              {f.parts.map((p) => (
                <div key={p.key} className="px-3 py-2.5 min-w-0" style={{ background: 'var(--well)', border: '1px solid var(--line-1)', borderRadius: 'var(--r-md)' }}>
                  <div className="text-[20px] leading-[24px] tnum" style={{ fontFamily: FONT, fontWeight: 600, color: 'var(--text-1)' }}>{p.count}</div>
                  <div className="text-[12px] leading-[16px] mt-0.5" style={{ fontFamily: UI, color: 'var(--text-2)' }}>{p.label}</div>
                  <div className="text-[11px] leading-[14px] mt-0.5" style={{ fontFamily: UI, color: 'var(--text-3)' }}>{p.sub}</div>
                </div>
              ))}
            </div>
          </HPanel>

          <HPanel title="Gates" hint="blocking by default · a new commit is a new review">
            <div className="-mx-2 mb-3">
              {f.gates.map((g) => (
                <div key={g.key} className="flex items-baseline justify-between gap-3 px-2 py-[6px] text-[12.5px]" style={{ borderBottom: '1px solid var(--line-1)' }}>
                  <span style={{ fontFamily: MONO, color: 'var(--text-1)' }}>{g.name}</span>
                  {g.canOpen ? (
                    <button type="button" onClick={() => ctx.onOpen(g.room)} className="cursor-pointer underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-(--accent)" style={{ fontFamily: UI, color: 'var(--text-3)' }}>{g.roomName}</button>
                  ) : (
                    <span style={{ fontFamily: UI, color: 'var(--text-3)' }}>{g.roomName}</span>
                  )}
                </div>
              ))}
            </div>
            <ServedTable item={f.modes} />
          </HPanel>

          <HoldsPanel holds={f.holds} century={f.century} hasHolds={f.hasHolds} note={f.holdsNote} />
        </div>
      </div>

      <ReceiptDrawer receipt={f.receipt} onClose={() => ctx.onPick('receipt', '')} />
    </>
  )
}
