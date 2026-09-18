// View.tsx -- money/ventures: v0.7's Ventures, drawing what fold() returned and deciding nothing (face v2
// Phase 03, ADR-1320).
//
// Declared deltas from the reference: the roster is the union of ventures.yaml's kill panel and the P&L, not a
// seeded registry, and each card carries both substances and its costs as the Cycle 15 renderer this replaces
// did; passports (status, stage, repo) and the file's own rules are NOT SERVED panels (ADR-1324); registering,
// staging and proposing a kill are work-door cards (ADR-1326); the venture.* trail is a sentence, because the
// spine records no such kind yet; "Kill reviews waiting" became the crossed and undeclared counts the kill panel
// actually serves.
import type { ModuleViewContext } from '../../../lib/registry.mjs'
import type { Folded } from './fold.mjs'
import { Btn, MONO, SimBadge, UI, YoursBadge } from '../../../ui/kit'
import { DoorRefusal, HPanel, NotServed, Reading, RoomHead, SourceFile, VerbPending } from '../../../ui/bits'
import { CostPanel, FigureStrip, FileBadge, GateStrip, VentureCardPanel } from '../../../ui/money'
export { Buildings as Icon } from '@phosphor-icons/react'

export default function View({ f, ctx }: { f: Folded; ctx: ModuleViewContext }) {
  return (
    <>
      <RoomHead
        title={f.sentence}
        hint={f.lede}
        right={f.isRealFired ? <YoursBadge>real ₹ on the log</YoursBadge> : <SimBadge>no real ₹ yet · labelled</SimBadge>}
      />

      <GateStrip gate={f.gate} />

      <FigureStrip figures={f.figures} counts={f.counts} />

      <div className="grid grid-cols-1 xl:grid-cols-[1.4fr_1fr] gap-4 items-start">
        <div className="min-w-0">
          <HPanel title="The roster" hint="ventures.yaml's kill panel joined with the P&L -- a row leaves only by your stamp" actions={<FileBadge text={f.summary.badge} />}>
            <div className="flex items-baseline gap-3 flex-wrap mb-1">
              <span className="text-[18px] leading-[24px]" style={{ fontFamily: UI, fontWeight: 600, color: 'var(--text-1)' }}>{f.summary.headline}</span>
            </div>
            <p className="text-[12.5px] leading-[19px]" style={{ fontFamily: UI, color: 'var(--text-2)' }}>{f.summary.detail}</p>
            {f.roster.isReading ? <Reading what="the P&L and the kill panel" /> : null}
            {f.roster.isRefused ? <DoorRefusal code={f.roster.refusal.code} human={f.roster.refusal.human} /> : null}
            {f.hasKillNote ? (
              <div className="mt-3">
                <DoorRefusal code={f.killNote.code} human={f.killNote.human} />
              </div>
            ) : null}
            <p className="text-[12px] leading-[18px] mt-3" style={{ fontFamily: UI, color: 'var(--text-3)' }}>{f.declared}</p>
          </HPanel>

          {f.cards.map((v) => (
            <VentureCardPanel key={v.key} v={v} neverMix={f.neverMix} />
          ))}

          <HPanel title="Register, stage, review" hint="venture.registered · staged · a kill proposed to your inbox">
            <div className="space-y-2.5">
              <VerbPending item={f.registerVerb} />
              <VerbPending item={f.stageVerb} />
              <VerbPending item={f.killVerb} />
            </div>
          </HPanel>

          <HPanel title="Passports" hint="live · candidate · attic">
            <NotServed item={f.passports} />
          </HPanel>

          <HPanel title="venture.* — the trail" hint="every stage change and every kill review is a receipt">
            <p className="text-[12.5px] leading-[19px]" style={{ fontFamily: UI, color: 'var(--text-2)' }}>{f.trailNote}</p>
          </HPanel>

          <CostPanel c={f.overhead} />
        </div>

        <div className="min-w-0">
          <HPanel title="The rules of the file" hint="ventures.yaml, through the door">
            <SourceFile file={f.file} />
            <div className="mt-3">
              <NotServed item={f.rules} />
            </div>
          </HPanel>

          <HPanel title="1 in 4" hint="the base rate, planned for">
            <p className="text-[13.5px] leading-[21px]" style={{ fontFamily: UI, color: 'var(--text-2)' }}>{f.oneInFour}</p>
          </HPanel>

          <HPanel title="Ship WITH distribution">
            <p className="text-[13.5px] leading-[21px]" style={{ fontFamily: UI, color: 'var(--text-2)' }}>{f.shipWith}</p>
            <div className="mt-4 flex gap-2 flex-wrap">
              {f.board.canOpen ? <Btn small onClick={() => ctx.onOpen(f.board.room)}>Appetite and burn → the board</Btn> : null}
              {f.money.canOpen ? <Btn small onClick={() => ctx.onOpen(f.money.room)}>The ledger → money</Btn> : null}
            </div>
          </HPanel>

          <p className="text-[12px] leading-[18px]" style={{ fontFamily: UI, color: 'var(--text-3)' }}>
            <b style={{ fontFamily: MONO, fontWeight: 600 }}>{f.asof.code}</b> — {f.asof.offer}
          </p>
        </div>
      </div>
    </>
  )
}
