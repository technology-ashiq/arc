// KeysSection.tsx -- the Settings page's Keys section (face v2 Phase 12, REQ-16, ADR-1351).
//
// Any NAME : value the owner sets once, here, and arc's tools read from the door's store. A value is typed once, sent
// once, and the field is cleared: the page never receives one back, only "…abcd" or "set". Every decision is talk.mjs's;
// this file renders.
import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { emptyKeyForm, keyChange, keysView } from '../lib/talk.mjs'
import { refusalOf } from '../lib/ask.mjs'
import type { Door } from '../lib/door.mjs'
import { MONO } from '../ui/kit'

type View = ReturnType<typeof keysView>

const field = 'w-full min-h-[38px] px-3 text-[13px] bg-transparent outline-none placeholder:text-(--text-3) focus-visible:outline focus-visible:outline-2 focus-visible:outline-(--accent)'
const fieldStyle = { color: 'var(--text-1)', border: '1px solid var(--line-2)', borderRadius: 'var(--r-sm)' }
const small = 'text-[12px] h-[30px] px-3 rounded-full cursor-pointer transition-colors hover:text-(--accent) focus-visible:outline focus-visible:outline-2 focus-visible:outline-(--accent) disabled:opacity-50 disabled:cursor-default'
const smallStyle = { fontWeight: 500, color: 'var(--text-2)', border: '1px solid var(--line-2)' }
const primary = 'self-start text-[13px] h-[34px] px-4 rounded-full cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-(--accent) disabled:opacity-50'
const primaryStyle = { fontWeight: 600, color: 'var(--bg-0)', background: 'var(--accent)' }

export default function KeysSection({ door }: { door: Door }) {
  const [view, setView] = useState<View>({ ok: false, rows: [] })
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [form, setForm] = useState(emptyKeyForm())
  // The one key whose value is being replaced, and the new value typed for it.
  const [replacing, setReplacing] = useState<{ name: string; value: string } | null>(null)

  // A change closes its form only when the door accepts it, so a refusal keeps what was typed (attack 0087028 B4).
  const send = useCallback(async (p: Promise<unknown>, done?: () => void) => {
    setBusy(true)
    setProblem(null)
    try { setView(keysView(await p)); if (done) done() } catch (err) { setProblem(refusalOf(err).human) } finally { setBusy(false); setLoading(false) }
  }, [])

  // The first read only fills the list: it never holds `busy`, so a slow door cannot lock the add button (CI
  // 37350862408: the button read disabled while the first GET was still in flight).
  useEffect(() => {
    let live = true
    door.keys().then((b) => { if (live) setView(keysView(b)) }, (err) => { if (live) setProblem(refusalOf(err).human) }).finally(() => { if (live) setLoading(false) })
    return () => { live = false }
  }, [door])

  const onAdd = (ev: FormEvent) => {
    ev.preventDefault()
    const c = keyChange('add', form)
    if (!c.ok) { setProblem(c.why); return }
    void send(door.setKeys(c.change), () => setForm(emptyKeyForm()))
  }
  const onReplace = (ev: FormEvent) => {
    ev.preventDefault()
    if (!replacing) return
    const c = keyChange('replace', replacing)
    if (!c.ok) { setProblem(c.why); return }
    void send(door.setKeys(c.change), () => setReplacing(null))
  }

  return (
    <section data-settings-section="keys" aria-label="Keys">
      <p className="text-[12.5px] leading-[19px] mb-4" style={{ color: 'var(--text-2)' }}>
        Set a key once and arc's tools use it, so no session has to ask you again. Name it the way the tool looks it up,
        like <span style={{ fontFamily: MONO }}>OPENROUTER_API_KEY</span>. Values stay on this machine, outside the repo,
        and are never shown again.
      </p>

      <ul className="flex flex-col gap-2 mb-5" aria-label="Your keys">
        {loading ? <li className="text-[12.5px]" style={{ color: 'var(--text-3)' }}>reading your keys…</li> : null}
        {!loading && view.rows.length === 0 ? <li className="text-[12.5px]" style={{ color: 'var(--text-3)' }}>No key yet. Add one below.</li> : null}
        {view.rows.map((k) => (
          <li key={k.name} data-key-row={k.name} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2" style={{ border: '1px solid var(--line-1)', borderRadius: 'var(--r-sm)' }}>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] truncate" style={{ fontFamily: MONO, fontWeight: 600, color: 'var(--text-1)' }}>{k.name}</div>
              <div data-key-shown className="text-[11.5px]" style={{ fontFamily: MONO, color: 'var(--text-3)' }}>{k.shown}</div>
            </div>
            {replacing && replacing.name === k.name ? (
              <form onSubmit={onReplace} className="flex w-full gap-2" aria-label={`Replace ${k.name}`}>
                <label className="sr-only" htmlFor="key-replace">New value for {k.name}</label>
                <input id="key-replace" data-key-replace-value type="password" autoComplete="off" value={replacing.value} onChange={(e) => setReplacing({ name: k.name, value: e.target.value })} placeholder="the new value" className={field} style={fieldStyle} />
                <button type="submit" data-key-replace-save disabled={busy} className={primary} style={primaryStyle}>save</button>
                <button type="button" onClick={() => { setReplacing(null); setProblem(null) }} className={small} style={smallStyle}>cancel</button>
              </form>
            ) : (
              <>
                <button type="button" data-key-replace disabled={busy} aria-label={`Replace ${k.name}`} onClick={() => { setProblem(null); setReplacing({ name: k.name, value: '' }) }} className={small} style={smallStyle}>replace</button>
                <button type="button" data-key-remove disabled={busy} aria-label={`Remove ${k.name}`} onClick={() => void send(door.setKeys({ op: 'remove', name: k.name }))} className={small} style={smallStyle}>remove</button>
              </>
            )}
          </li>
        ))}
      </ul>

      <form onSubmit={onAdd} className="flex flex-col gap-2.5" aria-label="Add a key">
        <div className="text-[11px] uppercase tracking-[0.12em]" style={{ fontWeight: 600, color: 'var(--text-3)' }}>add a key</div>
        <label className="sr-only" htmlFor="key-name">Name</label>
        <input id="key-name" data-key-name value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value.toUpperCase() })} placeholder="NAME, e.g. OPENROUTER_API_KEY" className={field} style={{ ...fieldStyle, fontFamily: MONO }} />
        <label className="sr-only" htmlFor="key-value">Value</label>
        <input id="key-value" data-key-value type="password" autoComplete="off" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} placeholder="value (shown once, here, as you type)" className={field} style={fieldStyle} />
        <button type="submit" data-key-add disabled={busy} className={primary} style={primaryStyle}>add</button>
      </form>
      {problem ? <p role="alert" className="mt-3 text-[12.5px]" style={{ color: 'var(--red)' }}>{problem}</p> : null}
    </section>
  )
}
