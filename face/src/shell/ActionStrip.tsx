// ActionStrip.tsx -- the room's verbs above its content (face v3 P01; FV3-A, FV3-E).
//
// One compact button per op and per session verb. A click opens the drawer holding exactly that one form, so no verb
// sits below the fold. A session whose process is not built is still a button -- it says why it cannot start (FV3-E).
// What the strip carries is decided in lib/frame.mjs; this file draws.
import { itemKey } from '../lib/frame.mjs'
import type { StripItem } from '../lib/frame.mjs'
import { MONO, UI } from '../ui/kit'

export default function ActionStrip({ items, open, onOpen }: { items: StripItem[]; open: string; onOpen: (key: string) => void }) {
  if (items.length === 0) return null
  return (
    <div data-action-strip={items.length} role="toolbar" aria-label="Actions in this room" className="mb-4 flex flex-wrap items-center gap-2">
      {items.map((it) => {
        const key = itemKey(it)
        const active = key === open
        return (
          <button
            key={key}
            type="button"
            data-strip-item={key}
            data-strip-ready={it.ready ? 'yes' : 'no'}
            aria-pressed={active}
            title={it.ready ? `${it.kind === 'op' ? 'Op' : 'Session'}: ${it.label}` : it.reason}
            onClick={() => onOpen(key)}
            className="inline-flex items-center gap-1.5 h-[30px] px-3 text-[12px] whitespace-nowrap cursor-pointer transition-colors duration-200 hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent)"
            style={{
              fontFamily: UI,
              borderRadius: 'var(--btn-radius)',
              color: it.ready ? 'var(--text-1)' : 'var(--text-3)',
              background: active ? 'var(--bg-4)' : 'var(--bg-3)',
              border: `1px solid ${active ? 'var(--accent-line)' : 'var(--line-1)'}`,
            }}
          >
            <span className="text-[10px] uppercase tracking-[0.06em]" style={{ fontFamily: MONO, color: 'var(--text-3)' }}>{it.kind === 'op' ? 'op' : 'session'}</span>
            <span>{it.label}</span>
            {!it.ready ? (
              <span data-strip-not-ready className="inline-flex items-center h-[18px] px-1.5 rounded-full text-[10px]" style={{ fontFamily: UI, color: 'var(--amber)', border: '1px solid var(--line-2)' }}>
                {it.kind === 'session' ? 'not built yet' : 'not served'}
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
