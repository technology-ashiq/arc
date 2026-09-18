// View.tsx -- company/concepts: v0.7's Concepts, drawing what fold() returned and deciding nothing (face v2 Phase 03,
// company ring, ADR-1320).
//
// Declared deltas from the reference: the glossary is the contract the door serves, not a bundled seed; the search is
// the palette's fold, run in fold() on what was typed; defining a term is a work-door card, not a form (ADR-1326).
import type { ModuleViewContext } from '../../../lib/registry.mjs'
import type { Folded } from './fold.mjs'
import { MONO, TextInput, UI, YoursBadge } from '../../../ui/kit'
import { DoorRefusal, HPanel, KpiStrip, Reading, RoomHead, SourceFile, VerbPending } from '../../../ui/bits'
import { Hits, TermGroup } from '../../../ui/company'
export { BookBookmark as Icon } from '@phosphor-icons/react'

export default function View({ f, ctx }: { f: Folded; ctx: ModuleViewContext }) {
  return (
    <>
      <RoomHead title={f.sentence} hint={f.lede} right={<YoursBadge>{f.badge}</YoursBadge>} />

      <KpiStrip items={f.kpis} />

      {f.contract.isReading ? <Reading what="the contract" /> : null}
      {f.contract.isRefused ? (
        <div className="mb-4">
          <DoorRefusal code={f.contract.refusal.code} human={f.contract.refusal.human} />
        </div>
      ) : null}
      {f.glossary.isRefused ? (
        <div className="mb-4">
          <DoorRefusal code={f.glossary.refusal.code} human={f.glossary.refusal.human} />
        </div>
      ) : null}

      <div className="grid grid-cols-1 xl:grid-cols-[1.4fr_1fr] gap-4 items-start">
        <div className="min-w-0">
          <HPanel title="Find a term" hint="the same fold the ⌘K palette runs — substring, first 8">
            <div className="mb-2">
              <TextInput value={f.search.q} onChange={(v) => ctx.onPick('q', v)} placeholder="spine, seal, slice…" />
            </div>
            <Hits hits={f.search.hits} empty={f.search.empty} isEmpty={f.search.isEmpty} onOpen={ctx.onOpen} />
          </HPanel>

          <HPanel title="Every word, by the room it lives in" hint="grouped by the served rooms, in the rail's order">
            {f.groups.map((g) => (
              <TermGroup key={g.key} name={g.name} room={g.room} terms={g.terms} canOpen={g.canOpen} onOpen={ctx.onOpen} />
            ))}
          </HPanel>
        </div>

        <div className="min-w-0">
          <HPanel title="Coverage" hint="face-coverage asserts every term has a home">
            <p className="text-[13px] leading-[20px]" style={{ fontFamily: UI, color: 'var(--text-2)' }}>{f.coverage}</p>
          </HPanel>

          <HPanel title="Unhomed" hint="a term whose room is not served is listed, not hidden">
            {f.isUnhomedEmpty ? <p className="text-[12.5px] leading-[19px]" style={{ fontFamily: UI, color: 'var(--text-3)' }}>{f.unhomedEmpty}</p> : null}
            <ul className="space-y-1.5 text-[12.5px] leading-[19px]" style={{ fontFamily: MONO, color: 'var(--text-2)' }}>
              {f.unhomed.map((u) => (
                <li key={u.key} className="break-words">· {u.term} → {u.room}</li>
              ))}
            </ul>
          </HPanel>

          <HPanel title="Define a term" hint="homed in a room, found by the palette">
            <VerbPending item={f.defineVerb} />
          </HPanel>

          <HPanel title="Where the words are kept" hint="the frozen contract, through the door">
            <SourceFile file={f.contract} />
          </HPanel>
        </div>
      </div>
    </>
  )
}
