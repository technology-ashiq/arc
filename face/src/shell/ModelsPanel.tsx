// ModelsPanel.tsx -- the face's settings for talking (face v2 Phase 10, REQ-14, ADR-1350).
//
// The owner adds the model the face answers with -- any OpenAI-compatible endpoint, free or paid, or a local one --
// switches between them and removes them, and turns voice on or off. The key is typed here once and sent to the door,
// which keeps it outside the repo; the panel never receives it back (it shows "key …abcd"), and the input is cleared
// the moment the add is sent. Every decision is talk.mjs's; this file renders.
import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { X } from '@phosphor-icons/react'
import { PRESETS, VOICE_NOTE, addChange, emptyForm, modelsView } from '../lib/talk.mjs'
type ModelForm = ReturnType<typeof emptyForm>
import { refusalOf } from '../lib/ask.mjs'
import type { Door } from '../lib/door.mjs'
import { MONO, UI } from '../ui/kit'

type View = ReturnType<typeof modelsView>

const field = 'w-full min-h-[38px] px-3 text-[13px] bg-transparent outline-none placeholder:text-(--text-3) focus-visible:outline focus-visible:outline-2 focus-visible:outline-(--accent)'
const fieldStyle = { color: 'var(--text-1)', border: '1px solid var(--line-2)', borderRadius: 'var(--r-sm)' }
const small = 'text-[12px] h-[30px] px-3 rounded-full cursor-pointer transition-colors hover:text-(--accent) focus-visible:outline focus-visible:outline-2 focus-visible:outline-(--accent)'
const smallStyle = { fontWeight: 500, color: 'var(--text-2)', border: '1px solid var(--line-2)' }

export default function ModelsPanel({ door, onClose, voiceOn, onVoice, voiceAvailable }: {
  door: Door
  onClose: () => void
  voiceOn: boolean
  onVoice: (on: boolean) => void
  voiceAvailable: boolean
}) {
  const [view, setView] = useState<View>({ ok: false, active: null, rows: [] })
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState<ModelForm>(emptyForm())
  const [problem, setProblem] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const settle = useCallback(async (p: Promise<unknown>) => {
    setBusy(true)
    setProblem(null)
    try { setView(modelsView(await p)) } catch (err) { setProblem(refusalOf(err).human) } finally { setBusy(false); setLoading(false) }
  }, [])

  useEffect(() => { void settle(door.models()) }, [door, settle])

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => { if (ev.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const onAdd = (ev: FormEvent) => {
    ev.preventDefault()
    const c = addChange(form)
    if (!c.ok) { setProblem(c.why); return }
    // The key leaves this page once, in this request, and is not kept in the form afterwards.
    setForm(emptyForm())
    void settle(door.setModels(c.change))
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center pt-[8vh] px-4" role="dialog" aria-modal="true" aria-label="Talking settings: models and voice" style={{ fontFamily: UI }}>
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 cursor-default" style={{ background: 'var(--scrim)', backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)' }} />
      <div data-models-panel className="relative w-full max-w-[600px] max-h-[84vh] overflow-y-auto px-6 py-5" style={{ border: '1px solid var(--line-2)', background: 'var(--bg-2)', borderRadius: 'var(--r-lg)', boxShadow: 'var(--shadow-pop)' }}>
        <button type="button" aria-label="Close the settings" onClick={onClose} className="absolute top-3 right-3 inline-flex items-center justify-center w-[28px] h-[28px] cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-(--accent)" style={{ color: 'var(--text-3)', borderRadius: 'var(--r-sm)' }}>
          <X size={14} aria-hidden="true" />
        </button>

        <h2 className="text-[17px] mb-1" style={{ fontWeight: 600, color: 'var(--text-1)' }}>Who answers</h2>
        <p className="text-[12.5px] leading-[19px] mb-4" style={{ color: 'var(--text-2)' }}>
          Questions about arc are answered from its record first. Anything else goes to the model you choose here. Keys stay on this machine, outside the repo.
        </p>

        <ul className="flex flex-col gap-2 mb-5" aria-label="Your models">
          {loading ? <li className="text-[12.5px]" style={{ color: 'var(--text-3)' }}>reading your models…</li> : null}
          {!loading && view.rows.length === 0 ? <li className="text-[12.5px]" style={{ color: 'var(--text-3)' }}>No model yet. Add one below.</li> : null}
          {view.rows.map((r) => (
            <li key={r.name} data-model-row className="flex items-center gap-3 px-3 py-2" style={{ border: `1px solid ${r.active ? 'var(--accent)' : 'var(--line-1)'}`, borderRadius: 'var(--r-sm)' }}>
              <div className="min-w-0 flex-1">
                <div className="text-[13.5px] truncate" style={{ fontWeight: 600, color: 'var(--text-1)' }}>{r.name}{r.active ? ' · answering' : ''}</div>
                <div className="text-[11.5px] truncate" style={{ fontFamily: MONO, color: 'var(--text-3)' }}>{r.where} · {r.key}</div>
              </div>
              {r.active ? null : (
                <button type="button" disabled={busy} onClick={() => void settle(door.setModels({ op: 'activate', name: r.name }))} className={small} style={smallStyle}>use</button>
              )}
              <button type="button" disabled={busy} aria-label={`Remove ${r.name}`} onClick={() => void settle(door.setModels({ op: 'remove', name: r.name }))} className={small} style={smallStyle}>remove</button>
            </li>
          ))}
        </ul>

        <form onSubmit={onAdd} className="flex flex-col gap-2.5 mb-5" aria-label="Add a model">
          <div className="text-[11px] uppercase tracking-[0.12em]" style={{ fontWeight: 600, color: 'var(--text-3)' }}>add a model</div>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button key={p.label} type="button" onClick={() => setForm((f) => ({ ...f, name: f.name || (p.label.split(' ')[0] ?? ''), baseUrl: p.baseUrl, model: p.model }))} className={small} style={smallStyle}>{p.label}</button>
            ))}
          </div>
          <label className="sr-only" htmlFor="model-name">Name</label>
          <input id="model-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="a name you will recognise" className={field} style={fieldStyle} />
          <label className="sr-only" htmlFor="model-url">Base URL</label>
          <input id="model-url" value={form.baseUrl} onChange={(e) => setForm({ ...form, baseUrl: e.target.value })} placeholder="base URL, e.g. https://openrouter.ai/api/v1" className={field} style={fieldStyle} />
          <label className="sr-only" htmlFor="model-id">Model id</label>
          <input id="model-id" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} placeholder="model id, e.g. gpt-4o-mini" className={field} style={fieldStyle} />
          <label className="sr-only" htmlFor="model-key">API key</label>
          <input id="model-key" type="password" autoComplete="off" value={form.key} onChange={(e) => setForm({ ...form, key: e.target.value })} placeholder="API key (leave empty for a local model)" className={field} style={fieldStyle} />
          <button type="submit" disabled={busy} className="self-start text-[13px] h-[36px] px-4 rounded-full cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-(--accent)" style={{ fontWeight: 600, color: 'var(--bg-0)', background: 'var(--accent)' }}>add</button>
          {problem ? <p role="alert" className="text-[12.5px]" style={{ color: 'var(--red)' }}>{problem}</p> : null}
        </form>

        <div className="pt-4" style={{ borderTop: '1px solid var(--line-1)' }}>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" data-voice-switch checked={voiceOn} disabled={!voiceAvailable} onChange={(e) => onVoice(e.target.checked)} />
            <span className="text-[13.5px]" style={{ fontWeight: 600, color: 'var(--text-1)' }}>Voice: speak and hear answers</span>
          </label>
          <p className="mt-1.5 text-[12px] leading-[18px]" style={{ color: 'var(--text-3)' }}>
            {voiceAvailable ? VOICE_NOTE : 'This browser has no speech support, so voice is off here. Typing works.'}
          </p>
        </div>
      </div>
    </div>
  )
}
