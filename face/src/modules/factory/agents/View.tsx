// View.tsx -- factory/agents: v0.7's Agents, drawing what fold() returned and deciding nothing (face v2 Phase 03,
// ADR-1320, ADR-1327).
//
// Declared deltas from the reference: the roster is the served registry's agents with the room each works in, not a
// seeded store with "yours" rows; tiers and the enabled switch are NOT SERVED until /api/roster (ADR-1324); adding an
// agent is a work-door card, not a form (ADR-1326). The room wears its not-in-registry label, as ADR-1327 requires.
import type { ModuleViewContext } from '../../../lib/registry.mjs'
import type { Folded } from './fold.mjs'
import { Chip, MONO, UI } from '../../../ui/kit'
import { HPanel, KpiStrip, NotServed, RoomHead } from '../../../ui/bits'
export { Robot as Icon } from '@phosphor-icons/react'

export default function View({ f, ctx }: { f: Folded; ctx: ModuleViewContext }) {
  return (
    <>
      <RoomHead title={f.sentence} hint={f.lede} right={<Chip>{f.badge}</Chip>} />

      <KpiStrip items={f.kpis} />

      <div className="grid grid-cols-1 xl:grid-cols-[1.4fr_1fr] gap-4 items-start">
        <div className="min-w-0">
          <HPanel title="The roster" hint="every agent the served registry homes, by the room it works in">
            {f.isRosterEmpty ? <p className="text-[12.5px] leading-[19px]" style={{ fontFamily: UI, color: 'var(--text-3)' }}>{f.rosterEmpty}</p> : null}
            {f.isRosterPartial ? <p className="text-[12.5px] leading-[19px] mb-2" style={{ fontFamily: UI, color: 'var(--text-3)' }}>{f.partial}</p> : null}
            {f.byRoom.map((g) => (
              <div key={g.key} data-agent-room={g.room} className="py-3 min-w-0" style={{ borderTop: '1px solid var(--line-1)' }}>
                {g.canOpen ? (
                  <button type="button" onClick={() => ctx.onOpen(g.room)} className="text-[13px] mb-1.5 cursor-pointer underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-(--accent)" style={{ fontFamily: UI, fontWeight: 600, color: 'var(--text-1)' }}>{g.roomName}</button>
                ) : (
                  <div className="text-[13px] mb-1.5" style={{ fontFamily: UI, fontWeight: 600, color: 'var(--text-1)' }}>{g.roomName}</div>
                )}
                <div className="flex flex-wrap gap-1.5">
                  {g.names.map((n) => (
                    <span key={n} data-agent={n} className="inline-flex items-center h-[24px] px-2 text-[12px]" style={{ fontFamily: MONO, color: 'var(--text-2)', background: 'var(--bg-3)', border: '1px solid var(--line-1)', borderRadius: 'var(--r-sm)' }}>{n}</span>
                  ))}
                </div>
              </div>
            ))}
          </HPanel>
        </div>

        <div className="min-w-0">
          <HPanel title="Tiers are law" hint="ADR-0069">
            <p className="text-[13px] leading-[20px] mb-3" style={{ fontFamily: UI, color: 'var(--text-2)' }}>{f.law}</p>
            <NotServed item={f.tiers} />
          </HPanel>
        </div>
      </div>
    </>
  )
}
