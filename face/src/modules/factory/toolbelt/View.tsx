// View.tsx -- factory/toolbelt: v0.7's Toolbelt, drawing what fold() returned and deciding nothing
// (face v2 Phase 03, ADR-1320).
//
// Declared deltas from the reference: every section is the SERVED REGISTRY's holds rather than a scan
// of the repo tree, and each row names the room that holds it, so the catalogue cannot know more or less
// than arc does; the pin is a work-door card (ADR-1326); "explain" is a link to the ask room instead of
// a second asking surface; the find box filters every section at once through the host's pick.
import type { ModuleViewContext } from '../../../lib/registry.mjs'
import type { Folded } from './fold.mjs'
import { Btn, MONO, TextInput, UI, YoursBadge } from '../../../ui/kit'
import { HPanel, HoldsPanel, KpiStrip, LanePanel, ReceiptDrawer, RoomHead, SectionLabel, VerbPending } from '../../../ui/bits'
export { Toolbox as Icon } from '@phosphor-icons/react'

export default function View({ f, ctx }: { f: Folded; ctx: ModuleViewContext }) {
  return (
    <>
      <RoomHead title={f.sentence} hint={f.lede} right={<YoursBadge>{f.badge}</YoursBadge>} />

      <KpiStrip items={f.kpis} />

      <div className="grid grid-cols-1 xl:grid-cols-[1.4fr_1fr] gap-4 items-start">
        <div className="min-w-0">
          <HPanel
            title="Find"
            hint="substring, case-insensitive · filters every section below"
            actions={f.ask.canOpen && <Btn small onClick={() => ctx.onOpen(f.ask.room)}>Ask arc what one does →</Btn>}
          >
            <TextInput value={f.find} onChange={(v) => ctx.onPick('find', v)} placeholder="a command, an agent, a rule, a room" mono />
            {f.hasFindNote ? <p className="text-[12px] leading-[18px] mt-2" style={{ fontFamily: UI, color: 'var(--text-3)' }}>{f.findNote}</p> : null}
            {f.hasCatalogueNote ? <p className="text-[12px] leading-[18px] mt-2" style={{ fontFamily: UI, color: 'var(--text-3)' }}>{f.catalogueNote}</p> : null}
          </HPanel>

          <HPanel title="The catalogue" hint="every section is what the served registry homes, with the room that holds it">
            {f.sections.map((s) => (
              <div key={s.key} className="mb-4 min-w-0">
                <SectionLabel>{s.label} · {s.count}</SectionLabel>
                {s.hasRows ? (
                  <div className="-mx-2">
                    {s.rows.map((r) => (
                      <div key={r.key} className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 px-2 py-[6px] transition-colors duration-200 hover:bg-(--bg-3)" style={{ borderBottom: '1px solid var(--line-1)' }}>
                        <span className="text-[12.5px] truncate" style={{ fontFamily: MONO, color: 'var(--text-1)' }}>{r.name}</span>
                        <button type="button" disabled={!r.canOpen} onClick={() => ctx.onOpen(r.room)} className="text-right cursor-pointer disabled:cursor-default text-[11.5px] truncate max-w-[22ch]" style={{ fontFamily: UI, color: 'var(--text-3)' }}>
                          {r.roomName}
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[12px] leading-[18px] px-2" style={{ fontFamily: UI, color: 'var(--text-3)' }}>{s.empty}</p>
                )}
              </div>
            ))}
          </HPanel>
        </div>

        <div className="min-w-0">
          <HPanel title="Pinned" hint="what the owner reaches for most">
            <VerbPending item={f.pinVerb} />
          </HPanel>

          <HPanel title="One place to look">
            <p className="text-[12.5px] leading-[19px]" style={{ fontFamily: UI, color: 'var(--text-2)' }}>
              Every row here is a thing the served registry says a room holds, and every count is derived from those rows rather than typed. That is the whole design: this room cannot drift from arc, because there is nothing here to drift. The room lede above it can: it was frozen with the contract, so where its figures and these disagree, these are today.
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
