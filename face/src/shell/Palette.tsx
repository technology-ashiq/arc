import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { rankMatches } from '../lib/shell.mjs'

export type PaletteItem = {
  id: string
  label: string
  hint: string
  kind: 'room' | 'concept'
  room: string
  station?: string
}

/**
 * The command palette.
 *
 * The Map is how you SEE that nothing is missing; this is how you REACH it. Thirty-three
 * rooms are navigable from a rail. A hundred and seven concepts are not, and the contract
 * anchors every one of them to a room AND a station exactly so a search can land you in the
 * right part of the right room.
 *
 * It decides nothing: ranking and the item list are `shell.mjs`, where a node test holds
 * them. What is here is focus, selection and the escape hatch.
 */
export default function Palette({
  items,
  onOpen,
  onClose,
}: {
  items: PaletteItem[]
  onOpen: (item: PaletteItem) => void
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const [cursor, setCursor] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const matches = useMemo(() => rankMatches(items, query, 14), [items, query])

  useEffect(() => { inputRef.current?.focus() }, [])
  useEffect(() => { setCursor(0) }, [query])

  // The palette owns its keys while it is open -- shell.mjs's keyAction returns null for
  // everything but Escape once paletteOpen is true, so there is exactly one place these
  // bindings live and it is not fighting the room underneath.
  const onKeyDown = (ev: React.KeyboardEvent) => {
    if (ev.key === 'Escape') { ev.preventDefault(); onClose(); return }
    if (ev.key === 'ArrowDown' || (ev.key === 'n' && ev.ctrlKey)) {
      ev.preventDefault()
      setCursor((c) => Math.min(c + 1, Math.max(matches.length - 1, 0)))
      return
    }
    if (ev.key === 'ArrowUp' || (ev.key === 'p' && ev.ctrlKey)) {
      ev.preventDefault()
      setCursor((c) => Math.max(c - 1, 0))
      return
    }
    if (ev.key === 'Enter') {
      ev.preventDefault()
      const item = matches[cursor]
      if (item) onOpen(item)
    }
  }

  return (
    <div style={scrimStyle} onMouseDown={onClose}>
      <div
        style={boxStyle}
        role="dialog"
        aria-modal="true"
        aria-label="Find a room or a word arc uses"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="a room, or any word arc uses"
          aria-label="Search rooms and vocabulary"
          style={inputStyle}
        />
        {matches.length === 0 ? (
          // Not a blank panel. If the company genuinely has no word for what was typed, that
          // is a fact about arc and it should read as one.
          <p style={emptyStyle}>
            Nothing in arc is called “{query}”. The Map draws every room; the Concepts room
            lists every word.
          </p>
        ) : (
          <ul style={listStyle}>
            {matches.map((m, i) => (
              <li key={m.id}>
                <button
                  type="button"
                  onMouseEnter={() => setCursor(i)}
                  onClick={() => onOpen(m)}
                  style={rowStyle(i === cursor)}
                >
                  <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {m.label}
                  </span>
                  <span style={kindStyle}>{m.kind}</span>
                  <span style={hintStyle}>{m.hint}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <p style={footStyle}>
          {items.length} rooms and words · ↑↓ move · enter opens · esc closes
        </p>
      </div>
    </div>
  )
}

const scrimStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 50,
  background: 'rgba(0, 0, 0, 0.62)',
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'center',
  paddingTop: '12vh',
}

const boxStyle: CSSProperties = {
  width: 'min(680px, 92vw)',
  background: 'var(--panel)',
  backdropFilter: 'blur(var(--panel-blur))',
  WebkitBackdropFilter: 'blur(var(--panel-blur))',
  border: '1px solid var(--accent-line)',
  borderRadius: 'var(--radius-panel)',
  padding: 'calc(var(--grid) * 1.5)',
}

const inputStyle: CSSProperties = {
  width: '100%',
  minHeight: 'var(--row-h-live)',
  padding: '0 var(--grid)',
  background: 'transparent',
  border: 0,
  borderBottom: '1px solid var(--hairline-strong)',
  color: 'var(--prose)',
  font: `400 var(--step-lede)/1.4 var(--font-mono)`,
  outline: 'none',
}

const listStyle: CSSProperties = { listStyle: 'none', margin: 'var(--grid) 0 0', padding: 0, maxHeight: '46vh', overflowY: 'auto' }

function rowStyle(active: boolean): CSSProperties {
  return {
    display: 'flex',
    alignItems: 'baseline',
    gap: 'var(--grid)',
    width: '100%',
    minHeight: 'var(--row-h-live)',
    padding: '0 var(--grid-in)',
    border: 0,
    borderRadius: 'var(--radius-chip)',
    cursor: 'pointer',
    textAlign: 'left',
    // The cursor row uses the product's own colour, never a reserved hue: being highlighted
    // is not a meaning, it is chrome.
    background: active ? 'var(--accent-wash)' : 'transparent',
    color: 'var(--prose)',
    font: `400 var(--step-data)/1.3 var(--font-mono)`,
  }
}

const kindStyle: CSSProperties = {
  font: `400 var(--step-micro)/1 var(--font-mono)`,
  letterSpacing: 'var(--track-tight)',
  textTransform: 'uppercase',
  color: 'var(--accent-dim)',
  flexShrink: 0,
}

const hintStyle: CSSProperties = {
  font: `400 var(--step-micro)/1.2 var(--font-mono)`,
  color: 'var(--faint)',
  flexShrink: 0,
  maxWidth: '46%',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

const emptyStyle: CSSProperties = {
  font: `400 var(--step-body)/1.5 var(--font-display)`,
  color: 'var(--meta)',
  margin: 'calc(var(--grid) * 2) var(--grid-in)',
}

const footStyle: CSSProperties = {
  font: `400 var(--step-micro)/1.2 var(--font-mono)`,
  color: 'var(--faint)',
  margin: 'var(--grid) var(--grid-in) 0',
  letterSpacing: 'var(--track-tight)',
}
