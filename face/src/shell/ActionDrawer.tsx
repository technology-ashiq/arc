// ActionDrawer.tsx -- the right-side drawer that holds exactly one form (face v3 P01; FV3-A).
//
// Fixed under the 56px header, full height, scrollable inside. Close button and Esc close it. It owns no form logic:
// the frame hands it the one OpsDock or SessionDock card to draw.
import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { MONO, UI } from '../ui/kit'

export default function ActionDrawer({ title, kind, onClose, children }: { title: string; kind: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <aside
      data-action-drawer={kind}
      role="dialog"
      aria-label={title}
      className="fixed right-0 bottom-0 z-50 flex flex-col"
      style={{ top: 56, width: 'min(460px, 100vw)', background: 'var(--bg-2)', borderLeft: '1px solid var(--line-1)', boxShadow: '-12px 0 32px -16px var(--bg-0)' }}
    >
      <div className="flex items-center gap-2 px-4 h-[48px] shrink-0" style={{ borderBottom: '1px solid var(--line-1)' }}>
        <span className="text-[10px] uppercase tracking-[0.06em]" style={{ fontFamily: MONO, color: 'var(--text-3)' }}>{kind}</span>
        <span className="min-w-0 flex-1 truncate text-[13.5px]" style={{ fontFamily: UI, fontWeight: 600, color: 'var(--text-1)' }}>{title}</span>
        <button
          type="button"
          data-drawer-close
          onClick={onClose}
          title="Close (Esc)"
          aria-label="Close"
          className="inline-flex items-center justify-center w-[30px] h-[30px] text-[16px] cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-(--accent)"
          style={{ fontFamily: UI, color: 'var(--text-2)', borderRadius: 'var(--btn-radius)', border: '1px solid var(--line-1)', background: 'var(--bg-3)' }}
        >
          ×
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4">{children}</div>
    </aside>
  )
}
