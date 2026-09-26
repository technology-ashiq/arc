// View.tsx -- company/story: the story of arc, drawing what fold() returned and deciding nothing (face v2 Phase 03,
// company ring, ADR-1320, ADR-1337).
//
// Declared deltas from the reference: v0.7 set the landing's nine explainer chapters here, prose typed into the
// bundle. The served room's lede is "the cycles, in order", so the chapters are the company's own logbook
// (docs/HISTORY.md) through the door -- every initiative in its glance table, the milestone tracker, and each closed
// cycle's entry -- set at the same reading measure (14px/22px, capped at 72ch, one hairline between chapters).
import type { ModuleViewContext } from '../../../lib/registry.mjs'
import type { Folded } from './fold.mjs'
import { UI, YoursBadge } from '../../../ui/kit'
import { DoorRefusal, HPanel, HoldsPanel, KpiStrip, Reading, RoomHead, SourcesPanel } from '../../../ui/bits'
import { Chapter, CycleRows, MilestoneRows } from '../../../ui/company'
export { BookOpen as Icon } from '@phosphor-icons/react'

export default function View({ f }: { f: Folded; ctx: ModuleViewContext }) {
  return (
    <>
      <RoomHead title={f.sentence} hint={f.lede} right={<YoursBadge>{f.badge}</YoursBadge>} />

      <KpiStrip items={f.kpis} />

      {f.doc.isReading ? <Reading what="the logbook" /> : null}
      {f.doc.isRefused ? (
        <div className="mb-4">
          <DoorRefusal code={f.doc.refusal.code} human={f.doc.refusal.human} />
        </div>
      ) : null}

      <div className="grid grid-cols-1 xl:grid-cols-[1.45fr_1fr] gap-4 items-start">
        <div className="min-w-0">
          <HPanel title="The chapters" hint="one entry per closed cycle, newest first, as the logbook keeps them">
            <p className="mb-1 text-[12.5px] leading-[19px]" style={{ fontFamily: UI, color: 'var(--text-3)' }}>{f.lag}</p>
            {f.isChaptersEmpty ? <p className="text-[12.5px] leading-[19px] py-2" style={{ fontFamily: UI, color: 'var(--text-3)' }}>{f.chaptersEmpty}</p> : null}
            {f.chapters.map((c) => (
              <Chapter key={c.key} c={c} />
            ))}
          </HPanel>
        </div>

        <div className="min-w-0">
          <HPanel title="Every initiative" hint="the logbook's glance table, in its order">
            <CycleRows rows={f.cycles} empty={f.cyclesEmpty} isEmpty={f.isCyclesEmpty} />
          </HPanel>

          <HPanel title="Milestones" hint="what the company set out to reach, in the book's words">
            <MilestoneRows rows={f.milestones} empty={f.milestonesEmpty} isEmpty={f.isMilestonesEmpty} />
          </HPanel>

          <SourcesPanel sources={[f.doc]} title="Where the story is written" hint="docs/HISTORY.md, through the door · written at each cycle's retro" />

          <HoldsPanel holds={f.holds} century={f.century} hasHolds={f.hasHolds} note={f.holdsNote} />
        </div>
      </div>
    </>
  )
}
