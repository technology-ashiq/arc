// View.tsx -- company/org: v0.7's Org, drawing what fold() returned and deciding nothing (face v2 Phase 03,
// company ring, ADR-1320).
//
// Declared deltas from the reference: the roster reads the board's lane headers through the door, not a local store;
// the ADR band map names the lane that owns each century from PORTFOLIO.md (F1) instead of the room the contract homes
// it in; setting a status and birthing a lane are work-door cards, not forms (ADR-1326); receipts per lane today are
// NOT SERVED until /api/lanes (ADR-1324). A blocked lane wears no reserved colour: nothing here can decide it.
import type { ModuleViewContext } from '../../../lib/registry.mjs'
import type { Folded } from './fold.mjs'
import { MONO, UI, YoursBadge } from '../../../ui/kit'
import { DoorRefusal, HPanel, KpiStrip, NotServed, Reading, RoomHead, SourceFile, VerbPending } from '../../../ui/bits'
import { OrgChart } from '../../../ui/orgchart'
export { UsersThree as Icon } from '@phosphor-icons/react'

export default function View({ f, ctx }: { f: Folded; ctx: ModuleViewContext }) {
  return (
    <>
      <RoomHead title={f.sentence} hint={f.lede} right={<YoursBadge>{f.badge}</YoursBadge>} />

      <HPanel title="The org chart" hint="owner → CEO → departments → every role · pick a chip for its card">
        {f.org.isReading ? <Reading what="the org" /> : null}
        {f.org.isRefused ? <DoorRefusal code={f.org.refusal.code} human={f.org.refusal.human} /> : null}
        {f.chart.isShown ? <OrgChart chart={f.chart} onPick={ctx.onPick} /> : null}
      </HPanel>

      <KpiStrip items={f.kpis} />

      <div className="grid grid-cols-1 xl:grid-cols-[1.3fr_1fr] gap-4 items-start">
        <div className="min-w-0">
          <HPanel title="The roster" hint="every lane on the board · each value from its own PROGRESS header">
            {f.board.isReading ? <Reading what="the board" /> : null}
            {f.board.isRefused ? <DoorRefusal code={f.board.refusal.code} human={f.board.refusal.human} /> : null}
            <p className="text-[12px] leading-[18px]" style={NOTE}>Every lane on the board is a row on the Records tab, with a search.</p>
          </HPanel>

          <HPanel title="Change the roster" hint="a status is a header, a lane is born by kickoff">
            <div className="space-y-2.5">
              <VerbPending item={f.birthVerb} />
            </div>
          </HPanel>

          <HPanel title="The roles" hint="every role card by department · org-catalog's chart model through /api/org">
            {f.org.isReading ? <Reading what="the org" /> : null}
            {f.org.isRefused ? <DoorRefusal code={f.org.refusal.code} human={f.org.refusal.human} /> : null}
            {f.org.hasCountsLine ? <p className="text-[12.5px] leading-[19px] mb-2" style={{ fontFamily: MONO, color: 'var(--text-2)' }}>{f.org.countsLine}</p> : null}
            {f.org.notes.map((n) => <p key={n} className="text-[12.5px] leading-[19px] mb-2" style={NOTE}>{n}</p>)}
            <p className="text-[12px] leading-[18px]" style={NOTE}>Every role, department by department, is a row on the Records tab, with a search.</p>
          </HPanel>

          <HPanel title="Scorecards" hint="each staffed seat from its own receipts · org-review's count, never re-done here">
            {f.org.scores.isRefused ? <DoorRefusal code={f.org.scores.refusal.code} human={f.org.scores.refusal.human} /> : null}
            {f.org.scores.hasFootnote ? <p className="text-[12.5px] leading-[19px] mb-2" style={NOTE}>{f.org.scores.footnote}</p> : null}
            <p className="text-[12px] leading-[18px]" style={NOTE}>Each scored seat is a row on the Records tab.</p>
          </HPanel>
        </div>

        <div className="min-w-0">
          <HPanel title="Who is waiting on whom" hint="the blocked-on line, as each header writes it">
            {f.isWaitingEmpty ? <p className="text-[12.5px] leading-[19px]" style={{ fontFamily: UI, color: 'var(--text-3)' }}>{f.waitingEmpty}</p> : null}
            <div className="-mx-2">
              {f.waiting.map((w) => (
                <div key={w.key} className="grid grid-cols-[auto_1fr] gap-2 px-2 py-[7px] text-[12.5px] leading-[18px]" style={{ borderBottom: '1px solid var(--line-1)' }}>
                  <span style={{ fontFamily: MONO, fontWeight: 600, color: 'var(--text-1)' }}>{w.lane}</span>
                  <span className="min-w-0 break-words" style={{ fontFamily: UI, color: 'var(--text-2)' }}>→ {w.on}</span>
                </div>
              ))}
            </div>
          </HPanel>

          <HPanel title="ADR bands" hint="each lane owns a century · PORTFOLIO.md's band table">
            {f.bands.isEmpty ? <p className="text-[12.5px] leading-[19px] mb-2" style={{ fontFamily: UI, color: 'var(--text-3)' }}>{f.bands.empty}</p> : null}
            {f.bands.notes.map((n) => (
              <p key={n} className="text-[12.5px] leading-[19px] mb-2" style={{ fontFamily: UI, color: 'var(--text-3)' }}>{n}</p>
            ))}
            <p className="text-[12px] leading-[18px]" style={NOTE}>Each claimed century is a row on the Records tab.</p>
            <div className="mt-3">
              <SourceFile file={f.portfolio} />
            </div>
          </HPanel>

          <HPanel title="Receipts per lane today">
            <NotServed item={f.today} />
          </HPanel>
        </div>
      </div>

    </>
  )
}

const NOTE = { fontFamily: UI, color: 'var(--text-3)' }
