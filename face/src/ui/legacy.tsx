// legacy.tsx -- the v1 kit's room-bound components, rebuilt on the v0.7 kit (face v2 Phase 01).
//
// The generic and index rooms, and the shell's loading and failure states, were written against
// the v1 kit's props: a Room, a zone, a value that may be missing. Their Phase 03 modules replace
// them; until then these keep those props and draw with the workroom's kit and tokens, so every
// served room reads in both moods without rewriting a renderer that is about to be deleted.
//
// Nothing here decides anything. The state a badge shows, what a missing value prints and which
// zones exist are all ../lib/rooms.mjs, exactly as before. Delete this file with its last reader.
import type { CSSProperties, ReactNode } from 'react'
import type { Room } from '../lib/rooms.mjs'
import { displayValue, errorSentence, headNotes, stateBadge, unescapeDoorText } from '../lib/rooms.mjs'
import { MONO, UI } from './kit'
import { HPanel, RoomHead as KitRoomHead, SectionLabel } from './bits'

/** The v1 tones: the four `stateBadge` returns, plus `plain`. Not meanings -- data states. */
export type LegacyTone = 'live' | 'sim' | 'file' | 'index' | 'plain'

// live is a data-mode statement (--mode-live, never green); sim is the non-real family.
const FG: Record<LegacyTone, string> = {
  live: 'var(--mode-live)',
  sim: 'var(--sim-fg)',
  file: 'var(--text-2)',
  index: 'var(--accent-dim)',
  plain: 'var(--accent)',
}

const LINE: Record<LegacyTone, string> = {
  live: 'var(--accent-line)',
  sim: 'var(--sim-line)',
  file: 'var(--line-2)',
  index: 'var(--accent-line)',
  plain: 'var(--line-1)',
}

export function Panel({ children, tone = 'plain', style }: { children: ReactNode; tone?: LegacyTone; style?: CSSProperties }) {
  return (
    <section
      className="relative p-5 min-w-0"
      style={{
        background: tone === 'sim' ? 'var(--sim-hatch), var(--bg-2)' : 'var(--bg-2)',
        border: `1px solid ${LINE[tone]}`,
        borderRadius: 'var(--r-lg)',
        boxShadow: 'var(--shadow-card)',
        ...style,
      }}
    >
      {children}
    </section>
  )
}

export function PanelTitle({ children, tone = 'plain', count }: { children: ReactNode; tone?: LegacyTone; count?: number }) {
  const n = count === undefined ? null : displayValue(count)
  return (
    <h2 className="flex items-baseline gap-2 mb-4 min-w-0">
      {tone === 'plain' ? null : <Dot tone={tone} />}
      <span className="text-[14px] leading-[20px] truncate" style={{ fontFamily: UI, fontWeight: 600, color: 'var(--text-1)', letterSpacing: '-0.005em' }}>
        {children}
      </span>
      {n === null ? null : (
        <span className="text-[12px] tnum" style={{ fontFamily: MONO, color: 'var(--text-3)' }}>{n.text}</span>
      )}
    </h2>
  )
}

export function Chip({ children, tone = 'plain', face = 'mono', title }: { children: ReactNode; tone?: LegacyTone; face?: 'mono' | 'display'; title?: string }) {
  const neutral = tone === 'plain' || tone === 'file'
  return (
    <span
      title={title}
      className="inline-flex items-center gap-1.5 min-h-[22px] px-2 py-[2px] rounded-full text-[11px] max-w-full"
      style={{
        fontFamily: face === 'mono' ? MONO : UI,
        fontWeight: 500,
        overflowWrap: 'anywhere',
        color: neutral ? 'var(--text-2)' : FG[tone],
        background: tone === 'sim' ? 'var(--sim-hatch)' : neutral ? 'var(--bg-4)' : 'rgba(var(--accent-rgb), 0.08)',
        border: `1px solid ${neutral ? 'var(--line-1)' : LINE[tone]}`,
      }}
    >
      {children}
    </span>
  )
}

export function Receipt({ children, tone = 'plain', title }: { children: ReactNode; tone?: LegacyTone; title?: string }) {
  return (
    <span
      title={title}
      className="inline-flex items-center gap-1.5 rounded-md border px-2 py-[3px] text-[11px] align-middle"
      style={{ fontFamily: MONO, color: FG[tone], borderColor: LINE[tone], background: 'var(--well)', overflowWrap: 'anywhere' }}
    >
      <span aria-hidden="true" style={{ opacity: 0.8 }}>&#8983;</span>
      {children}
    </span>
  )
}

/** Hue alone is not enough: the non-real dot carries the hatch as well as the violet. */
function Dot({ tone }: { tone: LegacyTone }) {
  if (tone === 'sim') {
    return <span aria-hidden="true" className="inline-block w-[8px] h-[8px] rounded-full shrink-0 self-center" style={{ border: '1px solid var(--sim-line)', backgroundImage: 'var(--sim-hatch)' }} />
  }
  return <span aria-hidden="true" className="inline-block w-[6px] h-[6px] rounded-full shrink-0 self-center" style={{ background: FG[tone] }} />
}

/**
 * The honest state. A room whose kinds never fired renders "unexercised", not a 0 -- the
 * decision is `stateBadge` in rooms.mjs; this only draws it.
 */
export function StateBadge({ room }: { room: Room }) {
  const badge = stateBadge(room)
  return (
    <span
      title={badge.title}
      className="inline-flex items-center gap-1.5 h-[22px] px-2 rounded-full text-[10.5px] uppercase tracking-[0.06em] whitespace-nowrap"
      style={{
        fontFamily: UI,
        fontWeight: 600,
        color: FG[badge.tone as LegacyTone] ?? 'var(--text-2)',
        border: `1px solid ${LINE[badge.tone as LegacyTone] ?? 'var(--line-2)'}`,
        background: badge.tone === 'sim' ? 'var(--sim-hatch)' : 'transparent',
      }}
    >
      <Dot tone={badge.tone as LegacyTone} />
      {badge.label}
    </span>
  )
}

export function Hairline({ tone = 'plain' }: { tone?: LegacyTone }) {
  return (
    <div
      aria-hidden="true"
      className="h-px w-full"
      style={{ background: tone === 'sim' ? 'var(--sim-hatch)' : tone === 'plain' ? 'var(--line-1)' : LINE[tone] }}
    />
  )
}

/** A labelled value that never renders a blank cell: a measured 0 prints 0, an absent one says so. */
export function Field({ label, value, title }: { label: string; value: string | number | null | undefined; title?: string }) {
  const v = displayValue(value)
  return (
    <div className="min-w-0">
      <SectionLabel className="mb-1">{label}</SectionLabel>
      <div title={title} className="text-[12px] tnum" style={{ fontFamily: MONO, color: v.missing ? 'var(--text-3)' : 'var(--text-1)', overflowWrap: 'anywhere' }}>
        {v.text}
      </div>
    </div>
  )
}

/** Every room opens with its SENTENCE. The ring and id are the eyebrow; the state is spelled out. */
export function RoomHead({ room, children }: { room: Room; children?: ReactNode }) {
  const badge = stateBadge(room)
  const notes = headNotes(room)
  return (
    <>
      <KitRoomHead
        eyebrow={`${room.ring} · ${room.id}`}
        title={unescapeDoorText(room.sentence)}
        hint={unescapeDoorText(room.lede)}
        right={<StateBadge room={room} />}
      />
      <div className="-mt-3 mb-6">
        <p className="text-[12px] leading-[19px] m-0 max-w-[82ch]" style={{ fontFamily: MONO, color: badge.tone === 'sim' ? 'var(--sim-fg)' : 'var(--text-3)' }}>
          {badge.label} — {badge.title}
        </p>
        {notes.length > 0 ? (
          <ul className="flex flex-wrap gap-4 list-none p-0 mt-2 mb-0">
            {notes.map((note) => (
              <li key={note} className="text-[11px]" style={{ fontFamily: MONO, color: 'var(--text-3)' }}>{note}</li>
            ))}
          </ul>
        ) : null}
        {children}
      </div>
    </>
  )
}

/** One zone of the lane template (ADR-1306). `zonesFor` never hands it an empty one. */
export function Zone({ zone }: { zone: { key: string; title: string; items: string[] } }) {
  return (
    <Panel>
      <PanelTitle count={zone.items.length}>{zone.title}</PanelTitle>
      <div className="flex flex-wrap gap-2">
        {zone.items.map((item) => (
          <Chip key={item} title={`${zone.key} · ${unescapeDoorText(item)}`}>
            {unescapeDoorText(item)}
          </Chip>
        ))}
      </div>
    </Panel>
  )
}

export function Loading({ what }: { what: string }) {
  return (
    <HPanel title="Reading">
      <p className="text-[12px] m-0" style={{ fontFamily: MONO, color: 'var(--text-2)' }}>waiting for {what} from the door…</p>
    </HPanel>
  )
}

/**
 * The door's own refusal, verbatim, with its code. A refused read is not an incident, so it is
 * never --red; red is incident.raised and nothing else.
 */
export function Failure({ error, what }: { error: unknown; what: string }) {
  const said = errorSentence(error)
  return (
    <HPanel title={`Could not read ${what}`}>
      <p className="text-[13.5px] leading-[21px] mt-0 mb-4 max-w-[70ch]" style={{ fontFamily: UI, color: 'var(--text-1)' }}>{said.human}</p>
      <Receipt tone="file" title="the door's own refusal code, verbatim">{said.code}</Receipt>
    </HPanel>
  )
}
