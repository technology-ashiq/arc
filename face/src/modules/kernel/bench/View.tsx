// View.tsx -- kernel/bench: v0.7's Bench, drawing what fold() returned and deciding nothing (face v2
// Phase 03, ADR-1320).
//
// Declared deltas from the reference: the scorecards are the scored runs /api/bench serves (Phase 04), none labelled champion;
// Add to bench, Run scorecard, Propose promotion and Retire are verb-pending cards (ADR-1326); runs by
// driver are the door's run.completed receipts, not a mock scorecard at no cost.
import type { ModuleViewContext } from '../../../lib/registry.mjs'
import type { Folded } from './fold.mjs'
import { Btn, MONO, UI, YoursBadge } from '../../../ui/kit'
import { DoorRefusal, HPanel, HoldsPanel, KpiStrip, LanePanel, Reading, ReceiptDrawer, RoomHead, RunRows, TrailPanel } from '../../../ui/bits'
export { ChartBarHorizontal as Icon } from '@phosphor-icons/react'

const BENCH_GRID = 'minmax(0, 0.7fr) minmax(0, 0.75fr) minmax(0, 0.5fr) minmax(0, 3.2fr)'

export default function View({ f, ctx }: { f: Folded; ctx: ModuleViewContext }) {
  return (
    <>
      <RoomHead title={f.sentence} hint={f.lede} right={<YoursBadge>{f.badge}</YoursBadge>} />

      <KpiStrip items={f.kpis} />

      <div className="grid grid-cols-1 xl:grid-cols-[1.4fr_1fr] gap-4 items-start">
        <div className="min-w-0">
          <HPanel title="The bench" hint="every number derives from scored runs">
            <div data-served={f.bench.route} data-availability={f.bench.availability} data-availability-failure={f.bench.failure} className="min-w-0">
              {f.bench.isReading && <Reading what="the bench" />}
              {f.bench.isRefused && <DoorRefusal code={f.bench.refusal.code} human={f.bench.refusal.human} />}
              {f.bench.showEmpty && <p className="text-[12.5px] leading-[19px] py-2" style={{ fontFamily: UI, color: 'var(--text-3)' }}>{f.bench.empty}</p>}
              {f.bench.showHead && (
                <div className="grid gap-x-3 px-2 pb-1.5 text-[10.5px] uppercase tracking-[0.06em]" style={{ gridTemplateColumns: BENCH_GRID, fontFamily: UI, fontWeight: 600, color: 'var(--text-3)' }}>
                  {f.bench.columns.map((c) => (
                    <span key={c} className="truncate">{c}</span>
                  ))}
                </div>
              )}
              {f.bench.rows.map((r) => (
                <div key={r.key} data-served-row={r.key} className="grid gap-x-3 px-2 py-[7px] text-[12.5px] leading-[19px] items-start transition-colors duration-200 hover:bg-(--bg-3)" style={{ gridTemplateColumns: BENCH_GRID, borderBottom: '1px solid var(--line-1)', borderRadius: 'var(--r-sm)' }}>
                  <span className="min-w-0 [overflow-wrap:anywhere]" style={{ fontFamily: MONO, fontWeight: 600, color: 'var(--text-1)' }}>{r.when}</span>
                  <span className="min-w-0 [overflow-wrap:anywhere]" style={{ fontFamily: UI, color: 'var(--text-2)' }}>{r.subject}</span>
                  <span className="min-w-0 [overflow-wrap:anywhere]" style={{ fontFamily: UI, color: 'var(--text-2)' }}>{r.outcome}</span>
                  <span className="min-w-0 flex flex-wrap gap-1">
                    {r.showNoClass && <span style={{ fontFamily: UI, color: 'var(--text-3)' }}>no class scored</span>}
                    {r.chips.map((k) => (
                      <span key={k.key} title={k.title} className="inline-flex items-center gap-1 px-1.5 py-0 text-[10.5px] leading-[16px] whitespace-nowrap max-w-full truncate" style={{ fontFamily: MONO, color: k.color, border: k.border, background: k.background, borderRadius: 'var(--radius-pill)' }}>
                        <span style={{ color: 'var(--text-2)' }}>{k.label}</span>
                        <span aria-hidden="true">·</span>
                        <span>{k.status}</span>
                      </span>
                    ))}
                  </span>
                </div>
              ))}
              {f.bench.showToggle && (
                <div className="pt-2">
                  <Btn small onClick={() => ctx.onPick('runs', f.bench.toggleValue)}>{f.bench.toggleLabel}</Btn>
                </div>
              )}
              {f.bench.showNote && <p className="text-[11.5px] leading-[17px] mt-2" style={{ fontFamily: UI, color: 'var(--text-3)' }}>{f.bench.note}</p>}
              {f.bench.showSource && <p className="text-[11px] leading-[16px] mt-1.5 [overflow-wrap:anywhere]" style={{ fontFamily: MONO, color: 'var(--text-3)' }}>GET {f.bench.route} · {f.bench.source}</p>}
            </div>
          </HPanel>

          <HPanel title="Runs by driver" hint="run.completed receipts, grouped by the driver that ran">
            {f.trail.isReading && <Reading what="the run receipts" />}
            {f.trail.isRefused && <DoorRefusal code={f.trail.refusal.code} human={f.trail.refusal.human} />}
            {f.trail.isDrawn && <RunRows rows={f.drivers} isEmpty={f.showDriversEmpty} empty="No run.completed receipt on the page the door sent names a driver." />}
          </HPanel>

          <TrailPanel trail={f.trail} onReceipt={(id) => ctx.onPick('receipt', id)} />
        </div>

        <div className="min-w-0">
          <HPanel title="How the bench judges" actions={f.policy.canOpen && <Btn small onClick={() => ctx.onOpen(f.policy.room)}>Tiers → model policy</Btn>}>
            <p className="text-[12.5px] leading-[19px]" style={{ fontFamily: UI, color: 'var(--text-2)' }}>
              Every driver runs the same fixtures and is scored the same way. The champion is pinned until a challenger beats it on the scorecard, and a win is only a proposal: a machine may raise it, and only you may decide it. Not enough fixtures is an answer too.
            </p>
          </HPanel>

          <LanePanel lane={f.lane} />

          <HoldsPanel holds={f.holds} century={f.century} hasHolds={f.hasHolds} note={f.holdsNote} />
        </div>
      </div>

      <ReceiptDrawer receipt={f.receipt} onClose={() => ctx.onPick('receipt', '')} />
    </>
  )
}
