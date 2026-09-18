// Rail.tsx -- the room rail, v0.7's (face v2 Phase 02): 240 px, fixed, the five rings in the served
// order, one row per room, the search box that opens the palette, and a footer that counts.
//
// Ported from docs/design/reference/face-hq/assets/arcface/src/hq/HQ.jsx with three declared deltas:
//   1. the rooms, rings and order are the SERVED registry's (railGroups), never roomRegistry.js;
//   2. a row's icon is its module's own `Icon` export, and a room with no module wears a dashed
//      circle -- the rail shows which rooms are still generic before you open one;
//   3. the brand is not a button: the product has no front door to go back to.
import type { ComponentType } from 'react'
import { CircleDashed, MagnifyingGlass } from '@phosphor-icons/react'
import { stateBadge } from '../lib/rooms.mjs'
import type { Room } from '../lib/rooms.mjs'
import type { Attachment } from '../lib/registry.mjs'
import { EASE, FONT, MONO, UI } from '../ui/kit'

type Group = { ring: string; lede: string; rooms: Room[] }
type IconProps = { size?: number; weight?: 'regular' | 'fill'; color?: string; 'aria-hidden'?: boolean | 'true' }

export const RAIL_W = 240
export const HEAD_H = 56

export default function Rail({
  groups, current, onOpen, onPalette, attachment, ringCount,
}: {
  groups: Group[]
  current: string | null
  onOpen: (id: string) => void
  onPalette: () => void
  attachment: Attachment
  ringCount: number
}) {
  const roomCount = groups.reduce((n, g) => n + g.rooms.length, 0)
  const moduleCount = Object.keys(attachment.attached).length
  return (
    <nav aria-label="Rooms" className="fixed left-0 top-0 bottom-0 z-40 hidden lg:flex flex-col" style={{ width: RAIL_W, background: 'var(--bg-1)', borderRight: '1px solid var(--line-1)' }}>
      <div className="flex items-center gap-2 px-4 shrink-0" style={{ height: HEAD_H }}>
        <span className="flex items-center gap-2 px-1 -ml-1 h-[32px]">
          <span className="text-[19px] leading-none tracking-tight" style={{ fontFamily: FONT, fontWeight: 700, color: 'var(--text-1)' }}>arc</span>
          <span className="text-[10px] uppercase tracking-[0.08em] h-[18px] px-1.5 inline-flex items-center rounded" style={{ fontFamily: UI, fontWeight: 600, color: 'var(--accent)', background: 'rgba(var(--accent-rgb), 0.1)' }}>HQ</span>
        </span>
      </div>

      <div className="px-3 pb-2 shrink-0">
        <button
          type="button"
          onClick={onPalette}
          className="w-full flex items-center gap-2 h-[34px] px-2.5 cursor-pointer transition-colors duration-200 hover:bg-(--bg-3) focus-visible:outline focus-visible:outline-2 focus-visible:outline-(--accent)"
          style={{ background: 'var(--bg-2)', border: '1px solid var(--line-2)', borderRadius: 'var(--r-md)', color: 'var(--text-3)' }}
          title="Find a room or a word arc uses"
        >
          <MagnifyingGlass size={15} aria-hidden="true" />
          <span className="text-[12.5px] flex-1 text-left truncate" style={{ fontFamily: UI }}>Find a room or a word</span>
          <kbd className="text-[10.5px] px-1.5 h-[18px] inline-flex items-center rounded whitespace-nowrap shrink-0" style={{ fontFamily: UI, color: 'var(--text-3)', background: 'var(--bg-4)', border: '1px solid var(--line-1)' }}>⌘K</kbd>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-4 rail-scroll">
        {groups.map((g) => (
          <div key={g.ring} className="mt-3 first:mt-1">
            <div className="px-2.5 pb-1 text-[10.5px] uppercase tracking-[0.08em]" style={{ fontFamily: UI, fontWeight: 600, color: 'var(--text-3)' }} title={g.lede}>
              {g.ring}
            </div>
            {g.rooms.map((r) => {
              const isActive = current === r.id
              const planned = Boolean(r.planned)
              const extra = Boolean(r.extra)
              const attached = attachment.attached[r.id]
              const Icon = ((attached && attached.Icon) || CircleDashed) as ComponentType<IconProps>
              const badge = stateBadge(r)
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => onOpen(r.id)}
                  aria-current={isActive ? 'page' : undefined}
                  title={`${r.sentence} · ${badge.label}${attached ? '' : ' · no module yet'}`}
                  className="relative w-full flex items-center gap-2.5 text-left px-2.5 h-[32px] cursor-pointer transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-(--accent) hover:bg-(--bg-3)"
                  style={{ borderRadius: 'var(--r-md)', background: isActive ? 'var(--bg-4)' : 'transparent', transitionTimingFunction: EASE }}
                >
                  <Icon size={16} weight={isActive ? 'fill' : 'regular'} color={isActive ? 'var(--accent)' : planned ? 'var(--text-3)' : 'var(--text-2)'} aria-hidden="true" />
                  <span className="text-[13px] truncate" style={{ fontFamily: UI, fontWeight: isActive ? 600 : 500, color: isActive ? 'var(--text-1)' : planned ? 'var(--text-3)' : 'var(--text-2)' }}>{r.name}</span>
                  {planned ? <span className="ml-auto text-[9.5px] uppercase tracking-[0.06em]" style={{ fontFamily: UI, fontWeight: 600, color: 'var(--text-3)' }}>planned</span> : null}
                  {extra ? <span className="ml-auto text-[9.5px] uppercase tracking-[0.06em]" title={badge.title} style={{ fontFamily: UI, fontWeight: 600, color: 'var(--text-3)' }}>extra</span> : null}
                  <span className="sr-only">{badge.label}</span>
                </button>
              )
            })}
          </div>
        ))}
      </div>

      <div className="shrink-0 px-4 py-3 text-[11px] leading-[17px]" style={{ fontFamily: UI, color: 'var(--text-3)', borderTop: '1px solid var(--line-1)' }}>
        <div className="flex justify-between gap-2">
          <span className="truncate">{roomCount} rooms · {ringCount} rings</span>
          <span className="shrink-0" style={{ fontFamily: MONO }}>{moduleCount} modules</span>
        </div>
        <div className="mt-0.5">j k move · g home · ⌘K find</div>
      </div>
    </nav>
  )
}
