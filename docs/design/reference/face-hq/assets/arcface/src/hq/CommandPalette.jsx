// ⌘K / Ctrl+K — the one door for "just paste it".
// Paste a model → the bench. "hire X" → the executor. A repo,
// skill or tool → the absorber. A question → the council.
// "lead: X" → the funnel. A room name → navigation. Anything
// else → note.logged. The palette PREVIEWS the action before
// Enter — nothing is ever added silently.
import { useEffect, useMemo, useRef, useState } from 'react'
import { MagnifyingGlass } from '@phosphor-icons/react'
import { UI } from '../ui/kit.jsx'
import { uiBus, registerUI } from '../lib/uiBus.js'
import { wsAppend, newRef } from '../spine/workspace.js'
import { detectProvider } from './rooms/Bench.jsx'
import { ROOM_META, resolveRoom } from './roomRegistry.js'
import { searchConcepts } from '../spine/registries.js'

const MODELISH = /(claude|gpt|gemini|llama|qwen|mistral|deepseek|grok|phi|sonnet|opus|haiku|flash|o[34])[\w.-]*/i

export function parseIntent(raw) {
  const v = raw.trim()
  if (!v) return null
  const low = v.toLowerCase()

  // a room by id, alias or display name — the registry is the one list
  const byName = ROOM_META.find((r) => r.name === low || r.name.replace(/\s*·\s*/g, ' ') === low)
  const roomId = resolveRoom(low) || (byName && byName.id)
  if (roomId) return { type: 'goto', room: roomId, label: `open ${ROOM_META.find((r) => r.id === roomId).name} — ${ROOM_META.find((r) => r.id === roomId).sentence}` }

  // "ask: …" or "? …" → Ask arc, the brain with no hands
  if (/^(ask|arc)\s*[:?]\s*\S/.test(low)) return { type: 'ask', q: v.replace(/^(ask|arc)\s*[:?]\s*/i, ''), label: `ask arc “${v.replace(/^(ask|arc)\s*[:?]\s*/i, '')}” — answered with receipts, no hands` }


  if (low.startsWith('hire ')) {
    const rest = v.slice(5)
    const m = rest.split(/\s+as\s+/i)
    return { type: 'hire', name: m[0].trim(), role: (m[1] || '').trim(), label: `hire “${m[0].trim()}” as a contractor${m[1] ? ` — ${m[1].trim()}` : ''} → executor` }
  }

  if (low.startsWith('lead') && /^leads?\s*[:-]?\s*\S/.test(low)) {
    const name = v.replace(/^leads?\s*[:-]?\s*/i, '')
    return { type: 'lead', name, label: `research lead “${name}” → the funnel` }
  }

  if (v.endsWith('?')) return { type: 'council', q: v, label: `convene the council on “${v}”` }

  if (low.includes('github.com') || low.endsWith('.git') || low.startsWith('http') || /@[\d^~]/.test(low) || low.startsWith('skill:') || low.startsWith('absorb ')) {
    const name = v.replace(/^absorb\s+/i, '').replace(/^skill:\s*/i, '')
    return { type: 'absorb', name, label: `absorb “${name}” → quarantined as a candidate` }
  }

  if ((/^\S+$/.test(v) && v.includes('/')) || MODELISH.test(low)) {
    return { type: 'model', model: v, label: `add “${v}” (${detectProvider(v)}) to the bench as a challenger` }
  }

  // a concept word → the room it lives in (107 terms + yours); checked last so
  // a model, a hire or a lead is never mistaken for a glossary lookup
  if (/^[a-z][a-z0-9 .-]{2,40}$/.test(low)) {
    const hit = searchConcepts(low).find((c) => c.term.toLowerCase() === low) || (low.length >= 4 && !low.includes(' ') ? searchConcepts(low)[0] : null)
    if (hit && resolveRoom(hit.room)) return { type: 'goto', room: resolveRoom(hit.room), label: `“${hit.term}” lives in ${hit.room}${hit.station ? ' · ' + hit.station : ''} — open it` }
  }

  return { type: 'note', text: v, label: `log “${v}” as note.logged on the spine` }
}

const go = (room) => {
  uiBus.enterHQ()
  setTimeout(() => uiBus.openRoom(room), 90)
}

export function executeIntent(it) {
  if (it.type === 'goto') return go(it.room)
  if (it.type === 'model') {
    wsAppend('bench.registered', 'bench', `Driver registered on the bench: ${it.model} (${detectProvider(it.model)}) · via ⌘K paste · scorecard never-fired`, {
      benchId: newRef('drv'), model: it.model, provider: detectProvider(it.model), tier: 'balanced-workhorse',
    })
    return go('bench')
  }
  if (it.type === 'hire') {
    const d = new Date()
    d.setDate(d.getDate() + 45)
    wsAppend('hire.added', 'executor', `Hire added: ${it.name} (contractor) — ${it.role || 'unassigned role'} · cap L1-drafts · judge owner · hosted local · review-by ${d.toISOString().slice(0, 10)}`, {
      hireId: newRef('hire'), name: it.name, type: 'contractor', role: it.role || 'unassigned role', cap: 'L1-drafts', judge: 'owner', hosted: 'local', review_by: d.toISOString().slice(0, 10),
    })
    return go('executor')
  }
  if (it.type === 'absorb') {
    wsAppend('absorb.captured', 'absorb', `Absorb intake: “${it.name}” → candidate · via ⌘K paste · quarantined, nothing installs itself`, {
      techId: newRef('T'), name: it.name, source: it.name.includes('github') ? 'repo' : 'skill', lane: 'develop', license: 'to-verify',
    })
    return go('absorb')
  }
  if (it.type === 'lead') {
    wsAppend('lead.researched', 'leads', `Lead researched: ${it.name} · via ⌘K · geo IN`, { leadId: newRef('lead'), name: it.name, niche: 'niche unset', geo: 'IN' })
    return go('leads')
  }
  if (it.type === 'council') {
    uiBus.pendingCouncilQ = it.q
    return go('council')
  }
  if (it.type === 'ask') {
    uiBus.pendingAskQ = it.q
    return go('ask-arc')
  }
  wsAppend('note.logged', 'hq', it.text, {})
  return go('spine')
}

export default function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [raw, setRaw] = useState('')
  const inputRef = useRef(null)
  const intent = useMemo(() => parseIntent(raw), [raw])

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((o) => !o)
        setRaw('')
      } else if (e.key === 'Escape' && open) setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current && inputRef.current.focus(), 30)
  }, [open])
  // the rail's search box opens the same door
  useEffect(() => {
    registerUI({ openPalette: () => { setRaw(''); setOpen(true) } })
  }, [])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center pt-[14vh] px-4" role="dialog" aria-label="Quick add">
      <button aria-label="close" onClick={() => setOpen(false)} className="absolute inset-0 cursor-default" style={{ background: 'var(--scrim)', backdropFilter: 'blur(3px)' }} />
      <div className="relative w-full max-w-[640px] overflow-hidden" style={{ border: '1px solid var(--line-2)', background: 'var(--bg-2)', borderRadius: 'var(--r-lg)', boxShadow: 'var(--shadow-pop)' }}>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (!intent) return
            executeIntent(intent)
            setOpen(false)
          }}
          className="flex items-center gap-3 px-4"
          style={{ borderBottom: '1px solid var(--line-1)' }}
        >
          <MagnifyingGlass size={17} aria-hidden="true" style={{ color: 'var(--text-3)', flexShrink: 0 }} />
          <input
            ref={inputRef}
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            placeholder="Paste anything: a model, “hire codex-cli”, a repo, “lead: Sharma & Assoc”, a question?, a room…"
            className="w-full bg-transparent min-h-[54px] text-[15px] outline-none placeholder:text-(--text-3)"
            style={{ fontFamily: UI, color: 'var(--text-1)' }}
          />
          <kbd className="hidden sm:inline-flex items-center h-[20px] px-1.5 rounded text-[10.5px] shrink-0" style={{ fontFamily: UI, color: 'var(--text-3)', background: 'var(--bg-4)', border: '1px solid var(--line-1)' }}>esc</kbd>
        </form>
        <div className="px-4 py-3 flex items-center gap-3 min-h-[46px]">
          {intent ? (
            <>
              <kbd className="inline-flex items-center h-[20px] px-1.5 rounded text-[10.5px] shrink-0" style={{ fontFamily: UI, fontWeight: 600, color: 'var(--accent)', background: 'rgba(var(--accent-rgb),0.1)' }}>↵ enter</kbd>
              <span className="text-[13px]" style={{ fontFamily: UI, color: 'var(--text-1)' }}>{intent.label}</span>
            </>
          ) : (
            <span className="text-[12px] leading-[18px]" style={{ fontFamily: UI, color: 'var(--text-3)' }}>
              A model goes to the bench. “hire …” to the executor. A repo or skill to absorb. A question? to the council. “ask: …” to ask arc. “lead: …” to the funnel. A room or a term jumps there.
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
