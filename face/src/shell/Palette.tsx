// Palette.tsx -- the ⌘K palette, in v0.7's shape (face v2 Phase 02).
//
// The Map is how you SEE that nothing is missing; this is how you REACH it: every served room and
// every word the frozen contract anchors to a room and a station. Ranking and the item list are
// shell.mjs's, where a node test holds them; what is here is focus, selection and the escape hatch.
//
// Ported from docs/design/reference/face-hq/assets/arcface/src/hq/CommandPalette.jsx with one declared
// delta: v0.7's palette also turns a pasted model, a "hire", a repo or a "lead:" into a spine write.
// Those are verbs, and verbs arrive with Phase 05's work door through the real CLIs (ADR-1326) --
// this palette finds and opens, and writes nothing.
import { useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { MagnifyingGlass } from '@phosphor-icons/react'
import { rankMatches } from '../lib/shell.mjs'
import { MONO, UI } from '../ui/kit'

export type PaletteItem = {
  id: string
  label: string
  hint: string
  kind: 'room' | 'concept'
  room: string
  station?: string
}

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

  // The palette owns its keys while it is open: shell.mjs's keyAction returns null for everything
  // but Escape once the palette is open, so these bindings live in exactly one place.
  const onKeyDown = (ev: KeyboardEvent<HTMLInputElement>) => {
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
    <div className="fixed inset-0 z-[60] flex items-start justify-center pt-[14vh] px-4" role="dialog" aria-modal="true" aria-label="Find a room or a word arc uses">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 cursor-default" style={{ background: 'var(--scrim)', backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)' }} />
      <div className="relative w-full max-w-[640px] overflow-hidden" style={{ border: '1px solid var(--line-2)', background: 'var(--bg-2)', borderRadius: 'var(--r-lg)', boxShadow: 'var(--shadow-pop)' }}>
        <div className="flex items-center gap-3 px-4" style={{ borderBottom: '1px solid var(--line-1)' }}>
          <MagnifyingGlass size={17} aria-hidden="true" style={{ color: 'var(--text-3)', flexShrink: 0 }} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="a room, or any word arc uses"
            aria-label="Search rooms and vocabulary"
            className="w-full bg-transparent min-h-[54px] text-[15px] outline-none placeholder:text-(--text-3)"
            style={{ fontFamily: UI, color: 'var(--text-1)' }}
          />
          <kbd className="hidden sm:inline-flex items-center h-[20px] px-1.5 rounded text-[10.5px] shrink-0" style={{ fontFamily: UI, color: 'var(--text-3)', background: 'var(--bg-4)', border: '1px solid var(--line-1)' }}>esc</kbd>
        </div>
        {matches.length === 0 ? (
          // Not a blank panel: if the company has no word for what was typed, that is a fact about arc.
          <p className="px-4 py-4 text-[13px] leading-[20px]" style={{ fontFamily: UI, color: 'var(--text-2)' }}>
            Nothing in arc is called “{query}”. The Map draws every room; the Concepts room lists every word.
          </p>
        ) : (
          <ul className="max-h-[46vh] overflow-y-auto py-1.5">
            {matches.map((m, i) => (
              <li key={m.id}>
                <button
                  type="button"
                  onMouseEnter={() => setCursor(i)}
                  onClick={() => onOpen(m)}
                  className="w-full flex items-baseline gap-3 px-4 h-[36px] text-left cursor-pointer"
                  // The cursor row takes a surface step, never a reserved hue: being highlighted is chrome.
                  style={{ background: i === cursor ? 'var(--bg-4)' : 'transparent', fontFamily: UI }}
                >
                  <span className="flex-1 min-w-0 truncate text-[13.5px]" style={{ color: 'var(--text-1)', fontWeight: i === cursor ? 600 : 500 }}>{m.label}</span>
                  <span className="shrink-0 text-[10px] uppercase tracking-[0.08em]" style={{ fontWeight: 600, color: 'var(--accent-dim)' }}>{m.kind}</span>
                  <span className="shrink-0 max-w-[46%] truncate text-[11.5px]" style={{ fontFamily: MONO, color: 'var(--text-3)' }}>{m.hint}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="px-4 py-2.5 text-[11.5px] leading-[18px]" style={{ fontFamily: UI, color: 'var(--text-3)', borderTop: '1px solid var(--line-1)' }}>
          {items.length} rooms and words · ↑↓ move · enter opens · esc closes
        </div>
      </div>
    </div>
  )
}
