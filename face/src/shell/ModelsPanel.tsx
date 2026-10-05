// ModelsPanel.tsx -- HQ's Settings page (face v2 Phase 10, REQ-14, ADR-1350; Phase 11, REQ-15, Amendments 1 and 2),
// drawn in the workroom's main area at `view=settings`, opened from the workroom header and from ⌘K.
//
// Two sections. MODELS: the owner adds the model the face answers with -- any OpenAI-compatible endpoint, free or paid,
// or a local one -- switches, removes, and TESTS one before asking it anything (ok or why, and the seconds it took; the
// door keeps each model's last test). The key is typed here once and sent to the door, which keeps it outside the repo;
// the panel never receives it back (it shows "key …abcd"), and the input is cleared the moment the add is sent.
// VOICE: the switch, which of the browser's voices speaks, how fast, and a preview. Every decision is talk.mjs's; this
// file renders.
import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { X } from '@phosphor-icons/react'
import {
  PRESETS, PREVIEW_LINE, RATE_MAX, RATE_MIN, VOICE_NOTE, addChange, emptyForm, modelsView, readVoiceChoice, voiceList, voicePick,
  voiceRate, writeVoiceChoice,
} from '../lib/talk.mjs'
type ModelForm = ReturnType<typeof emptyForm>
import { refusalOf } from '../lib/ask.mjs'
import type { Door } from '../lib/door.mjs'
import { MONO, UI } from '../ui/kit'

type View = ReturnType<typeof modelsView>
type Section = 'models' | 'voice'

const field = 'w-full min-h-[38px] px-3 text-[13px] bg-transparent outline-none placeholder:text-(--text-3) focus-visible:outline focus-visible:outline-2 focus-visible:outline-(--accent)'
const fieldStyle = { color: 'var(--text-1)', border: '1px solid var(--line-2)', borderRadius: 'var(--r-sm)' }
const small = 'text-[12px] h-[30px] px-3 rounded-full cursor-pointer transition-colors hover:text-(--accent) focus-visible:outline focus-visible:outline-2 focus-visible:outline-(--accent) disabled:opacity-50 disabled:cursor-default'
const smallStyle = { fontWeight: 500, color: 'var(--text-2)', border: '1px solid var(--line-2)' }
const testColour = { ok: 'var(--green)', fail: 'var(--red)', none: 'var(--text-3)' } as const

function storage(): Storage | null {
  try { return window.localStorage } catch { return null }
}

export default function ModelsPanel({ door, onClose, voiceOn, onVoice, voiceAvailable }: {
  door: Door
  onClose: () => void
  voiceOn: boolean
  onVoice: (on: boolean) => void
  voiceAvailable: boolean
}) {
  const [section, setSection] = useState<Section>('models')
  const [view, setView] = useState<View>({ ok: false, active: null, rows: [] })
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState<ModelForm>(emptyForm())
  const [problem, setProblem] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [testing, setTesting] = useState<string | null>(null)

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

  // A test can take a minute on a busy free model, so it holds its own row, not the whole list.
  const onTest = async (name: string) => {
    setTesting(name)
    setProblem(null)
    try { setView(modelsView(await door.testModel(name))) } catch (err) { setProblem(refusalOf(err).human) } finally { setTesting(null) }
  }

  // ── voice ──
  const speakOk = voiceAvailable && typeof window.speechSynthesis !== 'undefined'
  const [voices, setVoices] = useState(() => (speakOk ? voiceList(window.speechSynthesis.getVoices()) : []))
  const [choice, setChoice] = useState(() => readVoiceChoice(storage()))
  useEffect(() => {
    if (!speakOk) return
    // Chrome fills the list after the page loads; the event says when.
    const load = () => setVoices(voiceList(window.speechSynthesis.getVoices()))
    load()
    window.speechSynthesis.addEventListener('voiceschanged', load)
    return () => window.speechSynthesis.removeEventListener('voiceschanged', load)
  }, [speakOk])
  const choose = (next: { name: string | null; rate: number }) => { setChoice(next); writeVoiceChoice(storage(), next) }
  const picked = voicePick(choice.name, voices)
  const preview = () => {
    if (!speakOk) return
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(PREVIEW_LINE)
    const v = picked ? window.speechSynthesis.getVoices().find((x) => x.name === picked) : undefined
    if (v) { u.voice = v; u.lang = v.lang } else { u.lang = navigator.language || 'en-IN' }
    u.rate = choice.rate
    window.speechSynthesis.speak(u)
  }

  const tab = (id: Section, label: string) => (
    <button
      type="button" role="tab" aria-selected={section === id} data-settings-tab={id} onClick={() => setSection(id)}
      className="text-[13px] h-[32px] px-4 rounded-full cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-(--accent)"
      style={section === id ? { fontWeight: 600, color: 'var(--bg-0)', background: 'var(--accent)' } : { fontWeight: 500, color: 'var(--text-2)', border: '1px solid var(--line-2)' }}
    >{label}</button>
  )

  return (
    // A page in the workroom's main area, not a dialog over it (ADR-1350 Amendment 2): no scrim, and the rail and header
    // stay usable beside it.
    <div className="room-enter" aria-label="Settings: models and voice" style={{ fontFamily: UI }}>
      <div data-models-panel className="relative w-full max-w-[720px] px-6 py-5" style={{ border: '1px solid var(--line-2)', background: 'var(--bg-2)', borderRadius: 'var(--r-lg)' }}>
        <button type="button" aria-label="Close the settings" onClick={onClose} className="absolute top-3 right-3 inline-flex items-center justify-center w-[28px] h-[28px] cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-(--accent)" style={{ color: 'var(--text-3)', borderRadius: 'var(--r-sm)' }}>
          <X size={14} aria-hidden="true" />
        </button>

        <h2 className="text-[17px] mb-3" style={{ fontWeight: 600, color: 'var(--text-1)' }}>Settings</h2>
        <div role="tablist" aria-label="Settings sections" className="flex gap-2 mb-4">
          {tab('models', 'Models')}
          {tab('voice', 'Voice')}
        </div>

        {section === 'models' ? (
          <section data-settings-section="models" aria-label="Models">
            <p className="text-[12.5px] leading-[19px] mb-4" style={{ color: 'var(--text-2)' }}>
              Questions about arc are answered from its record first. Anything else goes to the model you choose here. Test a model to see whether it answers and how fast before you ask it. Keys stay on this machine, outside the repo.
            </p>

            <ul className="flex flex-col gap-2 mb-5" aria-label="Your models">
              {loading ? <li className="text-[12.5px]" style={{ color: 'var(--text-3)' }}>reading your models…</li> : null}
              {!loading && view.rows.length === 0 ? <li className="text-[12.5px]" style={{ color: 'var(--text-3)' }}>No model yet. Add one below.</li> : null}
              {view.rows.map((r) => (
                <li key={r.name} data-model-row className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2" style={{ border: `1px solid ${r.active ? 'var(--accent)' : 'var(--line-1)'}`, borderRadius: 'var(--r-sm)' }}>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13.5px] truncate" style={{ fontWeight: 600, color: 'var(--text-1)' }}>{r.name}{r.active ? ' · answering' : ''}</div>
                    <div className="text-[11.5px] truncate" style={{ fontFamily: MONO, color: 'var(--text-3)' }}>{r.where} · {r.key}</div>
                    <div data-test-line={r.test.state} className="text-[11.5px] leading-[16px] mt-0.5" style={{ color: testColour[r.test.state] }}>
                      {testing === r.name ? 'testing… (a busy free model can take up to a minute)' : r.test.text}
                    </div>
                  </div>
                  <button type="button" data-model-test disabled={testing !== null} aria-label={`Test ${r.name}`} onClick={() => void onTest(r.name)} className={small} style={smallStyle}>test</button>
                  {r.active ? null : (
                    <button type="button" disabled={busy} onClick={() => void settle(door.setModels({ op: 'activate', name: r.name }))} className={small} style={smallStyle}>use</button>
                  )}
                  <button type="button" disabled={busy} aria-label={`Remove ${r.name}`} onClick={() => void settle(door.setModels({ op: 'remove', name: r.name }))} className={small} style={smallStyle}>remove</button>
                </li>
              ))}
            </ul>

            <form onSubmit={onAdd} className="flex flex-col gap-2.5" aria-label="Add a model">
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
            </form>
          </section>
        ) : (
          <section data-settings-section="voice" aria-label="Voice">
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" data-voice-switch checked={voiceOn} disabled={!voiceAvailable} onChange={(e) => onVoice(e.target.checked)} />
              <span className="text-[13.5px]" style={{ fontWeight: 600, color: 'var(--text-1)' }}>Voice: speak and hear answers</span>
            </label>
            <p className="mt-1.5 mb-4 text-[12px] leading-[18px]" style={{ color: 'var(--text-3)' }}>
              {voiceAvailable ? VOICE_NOTE : 'This browser has no speech support, so voice is off here. Typing works.'}
            </p>
            {speakOk ? (
              <div className="flex flex-col gap-3">
                <label className="flex flex-col gap-1.5">
                  <span className="text-[11px] uppercase tracking-[0.12em]" style={{ fontWeight: 600, color: 'var(--text-3)' }}>which voice</span>
                  <select data-voice-select value={picked ?? ''} onChange={(e) => choose({ name: e.target.value || null, rate: choice.rate })} className={field} style={{ ...fieldStyle, background: 'var(--bg-2)' }}>
                    <option value="">the browser's default</option>
                    {voices.map((v) => <option key={v.name} value={v.name}>{v.name}{v.lang ? ` (${v.lang})` : ''}</option>)}
                  </select>
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[11px] uppercase tracking-[0.12em]" style={{ fontWeight: 600, color: 'var(--text-3)' }}>speed · {choice.rate}x</span>
                  <input data-voice-rate type="range" min={RATE_MIN} max={RATE_MAX} step={0.05} value={choice.rate} onChange={(e) => choose({ name: picked, rate: voiceRate(e.target.value) })} />
                </label>
                <button type="button" data-voice-preview onClick={preview} className={`${small} self-start`} style={smallStyle}>preview</button>
              </div>
            ) : null}
          </section>
        )}
        {problem ? <p role="alert" className="mt-3 text-[12.5px]" style={{ color: 'var(--red)' }}>{problem}</p> : null}
      </div>
    </div>
  )
}
