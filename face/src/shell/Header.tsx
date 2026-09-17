// Header.tsx -- the top bar, v0.7's (face v2 Phase 02): 56 px, fixed right of the rail, the open
// room's name and ring on the left with the day control, and the data mode, the inbox and the mood
// on the right. Below `lg` it also carries v0.7's room switcher, because the rail is hidden there.
//
// Declared deltas from docs/design/reference/face-hq/assets/arcface/src/hq/HQ.jsx:
//   - the day player (clock, day, play/pause, 1x/10x/60x) drives v0.7's SIMULATED spine; the product
//     reads a real one, so its place holds the as-of scrub, which is the product's day control;
//   - the brain chip is not ported: the product's brain has no status route yet (NOT SERVED);
//   - the mode chip reads the door's own mode: live is the product's colour and sim is violet, the
//     non-real family's, never green (green is real money's alone);
//   - the inbox chip counts what the door's inbox holds open and opens the room that homes
//     `approval.requested`; a read that failed says so instead of claiming inbox zero.
import { MoonStars, SunDim, Tray } from '@phosphor-icons/react'
import type { ReactNode } from 'react'
import type { Room } from '../lib/rooms.mjs'
import { moodToggleLabel } from '../lib/mood.mjs'
import type { Mood } from '../lib/mood.mjs'
import { UI } from '../ui/kit'
import AsOf from './AsOf'
import { HEAD_H } from './Rail'

type Group = { ring: string; rooms: Room[] }

export default function Header({
  room, mode, inbox, onOpen, mood, onToggleMood, asOf, today, asOfSupported, onAsOf, groups, current,
}: {
  room: Room | null
  mode: { label: string; tone: 'live' | 'sim' | 'unknown'; title: string }
  inbox: { open: number | null; room: string | null }
  onOpen: (id: string) => void
  mood: Mood
  onToggleMood: () => void
  asOf: string | null
  today: string | null
  asOfSupported: boolean
  onAsOf: (day: string | null) => void
  groups: Group[]
  current: string | null
}) {
  const moodLabel = moodToggleLabel(mood)
  const inboxRoom = inbox.room
  const waiting = inbox.open
  const dot = mode.tone === 'live' ? 'var(--mode-live)' : mode.tone === 'sim' ? 'var(--sim-fg)' : 'var(--text-3)'
  return (
    <>
      <header className="fixed top-0 right-0 left-0 lg:left-[240px] z-40" style={{ background: 'color-mix(in srgb, var(--bg-1) 88%, transparent)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', borderBottom: '1px solid var(--line-1)' }}>
        <div className="flex items-center justify-between gap-3 px-4 sm:px-6" style={{ height: HEAD_H }}>
          <div className="flex items-center gap-3 min-w-0">
            <span className="lg:hidden flex items-center gap-2 h-[32px]">
              <span className="text-[18px] leading-none tracking-tight" style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--text-1)' }}>arc</span>
              <span className="text-[10px] uppercase tracking-[0.08em] h-[18px] px-1.5 inline-flex items-center rounded" style={{ fontFamily: UI, fontWeight: 600, color: 'var(--accent)', background: 'rgba(var(--accent-rgb), 0.1)' }}>HQ</span>
            </span>
            {room ? (
              <span className="hidden lg:flex items-baseline gap-2 min-w-0">
                <span className="text-[13.5px] truncate" style={{ fontFamily: UI, fontWeight: 600, color: 'var(--text-1)' }}>{room.name}</span>
                <span className="text-[12px] truncate" style={{ fontFamily: UI, color: 'var(--text-3)' }}>{room.ring}</span>
              </span>
            ) : null}
            <span className="hidden md:block w-px h-4" style={{ background: 'var(--line-2)' }} />
            <span className="hidden md:inline-flex">
              <AsOf asOf={asOf} today={today} supported={asOfSupported} onChange={onAsOf} />
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden lg:block">
              <BarChip title={mode.title}>
                <span aria-hidden="true" className="inline-block w-[6px] h-[6px] rounded-full" style={{ background: dot }} />
                {mode.label}
              </BarChip>
            </span>
            <BarChip
              onClick={inboxRoom ? () => onOpen(inboxRoom) : undefined}
              strong={typeof waiting === 'number' && waiting > 0}
              title={inboxRoom ? 'Open the room where approvals are decided' : 'no served room homes approval.requested'}
            >
              <Tray size={14} weight={typeof waiting === 'number' && waiting > 0 ? 'fill' : 'regular'} aria-hidden="true" />
              {waiting === null ? 'inbox unread' : waiting > 0 ? `${waiting} waiting` : 'Inbox zero'}
            </BarChip>
            <button
              type="button"
              onClick={onToggleMood}
              title={moodLabel}
              aria-label={moodLabel}
              className="inline-flex items-center justify-center w-[30px] h-[30px] cursor-pointer transition-colors duration-200 hover:bg-(--bg-3) focus-visible:outline focus-visible:outline-2 focus-visible:outline-(--accent)"
              style={{ border: '1px solid var(--line-2)', borderRadius: 'var(--r-md)', color: 'var(--text-2)' }}
            >
              {mood === 'dark' ? <SunDim size={16} aria-hidden="true" /> : <MoonStars size={16} aria-hidden="true" />}
            </button>
          </div>
        </div>
      </header>

      {/* The room switcher below lg, v0.7's: the rail is hidden there, and every room stays reachable. */}
      <div className="lg:hidden fixed left-0 right-0 z-40 overflow-x-auto px-3 py-2 flex gap-1.5" style={{ top: HEAD_H, background: 'var(--bg-1)', borderBottom: '1px solid var(--line-1)', fontFamily: UI }}>
        {groups.flatMap((g) => g.rooms).map((r) => {
          const on = current === r.id
          return (
            <button key={r.id} type="button" onClick={() => onOpen(r.id)} className="shrink-0 text-[12px] h-[28px] px-3 cursor-pointer" style={{ borderRadius: 'var(--r-md)', color: on ? 'var(--text-1)' : 'var(--text-2)', background: on ? 'var(--bg-4)' : 'transparent', border: `1px solid ${on ? 'var(--line-2)' : 'var(--line-1)'}`, fontWeight: on ? 600 : 500 }}>
              {r.name}
            </button>
          )
        })}
      </div>
    </>
  )
}

/** A small status chip in the top bar: a button when it does something, a label when it does not. */
function BarChip({ children, onClick, title, strong = false }: { children: ReactNode; onClick?: () => void; title: string; strong?: boolean }) {
  const style = strong
    ? { background: 'var(--amber)', color: 'var(--on-fill)', border: '1px solid transparent', fontWeight: 600 }
    : { background: 'transparent', color: 'var(--text-2)', border: '1px solid var(--line-2)', fontWeight: 500 }
  const className = `inline-flex items-center gap-2 h-[30px] px-3 text-[12px] whitespace-nowrap transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-(--accent) ${onClick ? 'cursor-pointer hover:bg-(--bg-3)' : ''}`
  const common = { title, className, style: { fontFamily: UI, borderRadius: 'var(--r-md)', letterSpacing: '-0.005em', ...style } }
  return onClick ? (
    <button type="button" onClick={onClick} {...common}>{children}</button>
  ) : (
    <span {...common}>{children}</span>
  )
}
