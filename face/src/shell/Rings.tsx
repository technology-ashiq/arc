import type { CSSProperties } from 'react'
import { RING_LEDE, stateBadge } from '../lib/rooms.mjs'
import type { Room } from '../lib/rooms.mjs'

type Group = { ring: string; lede: string; rooms: Room[] }

/**
 * The five-ring rail.
 *
 * Not thirty-three rows. Coverage and a thirty-three-item sidebar are not the same
 * requirement: the contract says every part of arc must be FINDABLE, and a rail that long
 * would defeat the thirty-to-sixty-minute budget the whole product exists for. Rings group;
 * the Map and the palette find.
 */
export default function Rings({
  groups,
  current,
  onOpen,
}: {
  groups: Group[]
  current: string
  onOpen: (id: string) => void
}) {
  return (
    <nav aria-label="Rooms, by ring" style={railStyle}>
      {groups.map((g) => (
        <section key={g.ring} style={{ marginBottom: 'calc(var(--grid) * 3)' }}>
          <h2 style={ringTitleStyle}>{g.ring}</h2>
          <p style={ringLedeStyle}>{g.lede || RING_LEDE[g.ring] || ''}</p>
          <ul style={listStyle}>
            {g.rooms.map((room) => {
              const badge = stateBadge(room)
              const active = room.id === current
              return (
                <li key={room.id}>
                  <button
                    type="button"
                    onClick={() => onOpen(room.id)}
                    aria-current={active ? 'page' : undefined}
                    title={badge.title}
                    style={rowStyle(active, Boolean(room.planned))}
                  >
                    <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {room.name}
                    </span>
                    {/* The state travels with the NAME, not only into the room. A rail that
                        shows every room as equally alive is the same lie as an empty room
                        that looks built -- you should be able to see, without opening
                        anything, that six of the eight money rooms have never run. */}
                    <span aria-hidden="true" style={dotStyle(badge.tone)} />
                    <span style={srOnly}>{badge.label}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </nav>
  )
}

const railStyle: CSSProperties = {
  width: 232,
  flexShrink: 0,
  padding: 'calc(var(--grid) * 2)',
  overflowY: 'auto',
  borderRight: '1px solid var(--hairline)',
}

const ringTitleStyle: CSSProperties = {
  font: `600 var(--step-meta)/1.2 var(--font-mono)`,
  letterSpacing: 'var(--track-wide)',
  textTransform: 'uppercase',
  color: 'var(--accent)',
  margin: 0,
}

const ringLedeStyle: CSSProperties = {
  font: `400 var(--step-micro)/1.4 var(--font-mono)`,
  color: 'var(--faint)',
  margin: '2px 0 calc(var(--grid) * 1.25)',
}

const listStyle: CSSProperties = { listStyle: 'none', margin: 0, padding: 0 }

function rowStyle(active: boolean, planned: boolean): CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--grid-in)',
    width: '100%',
    minHeight: 'var(--row-h-live)',
    padding: '0 var(--grid-in)',
    border: 0,
    borderRadius: 'var(--radius-chip)',
    cursor: 'pointer',
    textAlign: 'left',
    font: `${active ? 600 : 400} var(--step-data)/1.3 var(--font-mono)`,
    color: active ? 'var(--on-accent)' : planned ? 'var(--faint)' : 'var(--prose)',
    background: active ? 'var(--accent)' : 'transparent',
  }
}

function dotStyle(tone: string): CSSProperties {
  // Reserved hues are law. A nav dot is CHROME, so it may not borrow amber, green or red --
  // the only reserved family it touches is violet, and only for the non-real class, which is
  // what "unexercised" genuinely is.
  const color =
    tone === 'live' ? 'var(--accent)'
      : tone === 'sim' ? 'var(--sim-fg)'
        : 'var(--hairline-strong)'
  return { width: 6, height: 6, borderRadius: 'var(--radius-pill)', background: color, flexShrink: 0 }
}

const srOnly: CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
  border: 0,
}
