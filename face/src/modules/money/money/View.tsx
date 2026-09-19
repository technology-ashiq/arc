// View.tsx -- money/money: v0.7's Money, drawing what fold() returned and deciding nothing (face v2 Phase 03,
// ADR-1320).
//
// Declared deltas from the reference: the two substances are the door's two P&L reads, side by side and never
// summed, where v0.7 drew one simulated series; the fourteen days are the money brain's day series through /api/pnl?by=day,
// drawn as three tables rather than one chart so no row holds two substances; the milestone line and "where money comes from" are NOT SERVED (ADR-1324) -- the reference's milestones
// and prices were facts typed into it; "Record real revenue" is a work-door card, not a form (ADR-1326); cost
// is counted and never totalled, and the return is refused by name, as the Cycle 15 renderer this replaces did.
import type { ModuleViewContext } from '../../../lib/registry.mjs'
import type { Folded } from './fold.mjs'
import { MONO, SimBadge, UI, YoursBadge } from '../../../ui/kit'
import { HPanel, NotServed, RoomHead, ServedTable } from '../../../ui/bits'
import { CostPanel, FigureStrip, FileBadge, GateStrip, KillLinesPanel, SubstancePanel } from '../../../ui/money'
export { CurrencyInr as Icon } from '@phosphor-icons/react'

export default function View({ f }: { f: Folded; ctx: ModuleViewContext }) {
  return (
    <>
      <RoomHead
        title={f.sentence}
        hint={f.lede}
        right={f.isRealFired ? <YoursBadge>{f.badge}</YoursBadge> : <SimBadge>{f.badge}</SimBadge>}
      />

      <GateStrip gate={f.gate} />

      <FigureStrip figures={f.figures} counts={f.counts} />

      <div className="grid grid-cols-1 xl:grid-cols-[1.4fr_1fr] gap-4 items-start">
        <div className="min-w-0">
          <SubstancePanel s={f.realPanel} />
          <SubstancePanel s={f.simPanel} />
          <p className="text-[12.5px] leading-[19px] mb-4 max-w-[82ch]" style={{ fontFamily: UI, color: 'var(--text-3)' }}>{f.neverAdded}</p>

          <HPanel title="Fourteen days" hint="one axis, three substances · every line derives from the log">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <ServedTable item={f.chart} />
              <ServedTable item={f.chartSim} />
              <ServedTable item={f.chartCost} />
            </div>
          </HPanel>

          <CostPanel c={f.productCost} />
          <CostPanel c={f.overheadCost} />

          <HPanel title="The return" hint={f.ret.code}>
            <p className="text-[13px] leading-[20px] mb-3 max-w-[82ch]" style={{ fontFamily: UI, color: 'var(--text-1)' }}>{f.ret.human}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {f.ret.parts.map((p) => (
                <div key={p.label} className="min-w-0 p-3" style={{ border: '1px solid var(--line-1)', borderRadius: 'var(--r-md)' }}>
                  <div className="text-[10.5px] uppercase tracking-[0.06em]" style={{ fontFamily: UI, fontWeight: 600, color: 'var(--text-3)' }}>{p.label}</div>
                  <div className="text-[12.5px] my-1 break-words" style={{ fontFamily: MONO, color: 'var(--text-1)' }}>{p.value}</div>
                  <div className="text-[11px] break-words" style={{ fontFamily: MONO, color: 'var(--text-3)' }}>{p.why}</div>
                </div>
              ))}
            </div>
            <p className="text-[12px] leading-[18px] mt-3" style={{ fontFamily: UI, color: 'var(--text-3)' }}>
              The derived P&amp;L, totalled by the money brain rather than by this screen: <span style={{ fontFamily: MONO, color: 'var(--text-2)' }}>{f.ret.command}</span>
            </p>
          </HPanel>

          <HPanel title="The milestone line" hint="honest ranges, not promises">
            <NotServed item={f.milestones} />
          </HPanel>
        </div>

        <div className="min-w-0">
          <KillLinesPanel k={f.kill} />

          <HPanel title="The north-star">
            <div className="text-[16px] leading-[24px] mb-2" style={{ fontFamily: UI, fontWeight: 600, color: 'var(--text-1)' }}>{f.northStar[0]}</div>
            <p className="text-[13px] leading-[20px]" style={{ fontFamily: UI, color: 'var(--text-2)' }}>{f.northStar[1]}</p>
          </HPanel>

          <HPanel title="Where money comes from" hint="portfolio math, honest">
            <NotServed item={f.sources} />
          </HPanel>

          {f.hasFlags ? (
            <HPanel title="Needs you" hint="the money brain's own flags" tone="amber">
              {f.flags.map((x) => (
                <div key={x.key} className="flex items-baseline gap-2 flex-wrap py-1.5" style={{ borderBottom: '1px solid var(--line-1)', backgroundImage: x.hatch }}>
                  <span className="text-[12px]" style={{ fontFamily: MONO, color: 'var(--amber)' }}>{x.type}</span>
                  <span className="text-[12px]" style={{ fontFamily: MONO, color: 'var(--text-2)' }}>{x.venture}</span>
                  <span className="text-[12.5px] leading-[19px] flex-1 min-w-[200px]" style={{ fontFamily: UI, color: 'var(--text-1)' }}>{x.detail}</span>
                </div>
              ))}
            </HPanel>
          ) : null}

          <HPanel title="What this route does not serve" hint="a gap the reader cannot see is a gap the reader assumes is not there">
            <div>
              {f.gaps.map((g) => (
                <div key={g.what} className="py-2" style={{ borderBottom: '1px solid var(--line-1)' }}>
                  <div className="text-[12.5px]" style={{ fontFamily: MONO, color: 'var(--text-1)' }}>{g.what}</div>
                  <p className="text-[12px] leading-[18px] mt-0.5" style={{ fontFamily: UI, color: 'var(--text-2)' }}>{g.why}</p>
                </div>
              ))}
            </div>
            <div className="mt-3 space-y-1.5">
              {f.provenance.map((n) => (
                <div key={n.half} className="flex items-baseline gap-2 flex-wrap text-[12px]" style={{ fontFamily: UI, color: 'var(--text-2)' }}>
                  <b style={{ fontFamily: MONO, fontWeight: 600, color: 'var(--text-1)' }}>{n.half}</b>
                  {n.hasBadge ? <FileBadge text={n.badge} /> : null}
                  <span className="flex-1 min-w-[200px]">{n.source}</span>
                  <span className="text-[11px]" style={{ fontFamily: MONO, color: 'var(--text-3)' }}>as-of — {n.asof}</span>
                </div>
              ))}
            </div>
            <p className="text-[12px] leading-[18px] mt-3" style={{ fontFamily: UI, color: 'var(--text-3)' }}>
              <b style={{ fontFamily: MONO, fontWeight: 600 }}>{f.asof.code}</b> — {f.asof.offer}
            </p>
          </HPanel>
        </div>
      </div>
    </>
  )
}
