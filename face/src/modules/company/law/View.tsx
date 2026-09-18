// View.tsx -- company/law: v0.7's Law, drawing what fold() returned and deciding nothing (face v2 Phase 03,
// ADR-1320).
//
// Declared deltas from the reference: every article, the precedence and the amendment steps are read from
// CONSTITUTION.md through the door rather than typed into the bundle; the adoption badge is the spine's
// constitution.adopted receipts, counted, not a demo flag; there is no amendment control -- the plan gives this room
// no verb, because an amendment is the owner's, by the CLI, after a cooling period.
import type { ModuleViewContext } from '../../../lib/registry.mjs'
import type { Folded } from './fold.mjs'
import { UI, YoursBadge } from '../../../ui/kit'
import { DoorRefusal, HPanel, HoldsPanel, KpiStrip, Reading, ReceiptDrawer, RoomHead, SourcesPanel, TrailPanel } from '../../../ui/bits'
import { ArticleCard, ArticleList, Chain, Rows } from '../../../ui/company'
export { Gavel as Icon } from '@phosphor-icons/react'

export default function View({ f, ctx }: { f: Folded; ctx: ModuleViewContext }) {
  return (
    <>
      <RoomHead title={f.sentence} hint={f.lede} right={<YoursBadge>{f.badge}</YoursBadge>} />

      <KpiStrip items={f.kpis} />

      {f.doc.isReading ? <Reading what="the constitution" /> : null}
      {f.doc.isRefused ? (
        <div className="mb-4">
          <DoorRefusal code={f.doc.refusal.code} human={f.doc.refusal.human} />
        </div>
      ) : null}

      {f.hasPrecedence ? <Chain items={f.precedence} note="the constitution's own order: when anything conflicts with it, that thing is wrong" /> : null}

      {f.isLawRead ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          {f.eternal.map((a) => (
            <ArticleCard key={a.id} id={a.id} name={a.name} text={a.text} tier="eternal — unamendable" />
          ))}
        </div>
      ) : null}
      {f.showEternalNote ? <p className="mb-4 text-[12.5px] leading-[19px]" style={{ fontFamily: UI, color: 'var(--text-3)' }}>{f.eternalNote}</p> : null}

      <div className="grid grid-cols-1 xl:grid-cols-[1.4fr_1fr] gap-4 items-start">
        <div className="min-w-0">
          <HPanel title="Working articles" hint="amendable, with friction">
            <ArticleList items={f.working} />
            {f.showWorkingNote ? <p className="mt-2 text-[12.5px] leading-[19px]" style={{ fontFamily: UI, color: 'var(--text-3)' }}>{f.workingNote}</p> : null}
          </HPanel>

          <TrailPanel trail={f.trail} onReceipt={(id) => ctx.onPick('receipt', id)} />
        </div>

        <div className="min-w-0">
          <HPanel title="Amending a working article" hint="one at a time, with friction">
            <Rows items={f.amendment} empty={f.amendmentNote} isEmpty={f.isAmendmentEmpty} />
            <p className="mt-3 text-[12.5px] leading-[19px]" style={{ fontFamily: UI, color: 'var(--text-3)' }}>{f.amendBy}</p>
          </HPanel>

          <HPanel title="Enforcement" hint="teeth, not a poster">
            <Rows items={f.teeth} empty={f.teethNote} isEmpty={f.isTeethEmpty} />
          </HPanel>

          <HPanel title="Adoption" hint="the file's own status line">
            <p className="text-[13px] leading-[20px] break-words" style={{ fontFamily: UI, color: 'var(--text-2)' }}>{f.adoption}</p>
          </HPanel>

          <SourcesPanel sources={[f.doc]} title="Where the law is written" hint="CONSTITUTION.md, through the door" />

          <HoldsPanel holds={f.holds} century={f.century} hasHolds={f.hasHolds} note={f.holdsNote} />
        </div>
      </div>

      <ReceiptDrawer receipt={f.receipt} onClose={() => ctx.onPick('receipt', '')} />
    </>
  )
}
