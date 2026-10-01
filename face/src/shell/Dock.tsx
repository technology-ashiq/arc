// Dock.tsx -- the ask dock, in the content column and on the front door (face v2 Phase 02; voice and the owner's model
// since Phase 10, ADR-1350).
//
// v0.7's VoiceDock (docs/design/reference/face-hq/assets/arcface/src/chrome/VoiceDock.jsx) ported as its
// workroom form: a pill with a typed ask, suggestion chips while it has focus, and the answer in a
// caption panel above it. Declared deltas:
//   - voice is a setting, off until the owner turns it on (ADR-1350, which amends ADR-1315): a mic when the browser can
//     listen, the answer read aloud when it can speak; typing always works. talk.mjs voiceStep decides every step;
//   - a question the reader cannot reach goes to the model the owner added in the face (the gear opens ModelsPanel),
//     and the answer carries the label the DOOR wrote: from arc's record, general, or unverified;
//   - the brain is the door's `POST /api/ask` through the SAME read-only handle the Ask arc room uses
//     (ask.mjs readOnly + ASK_GRANTS): no provider key in the browser and no write tool (ADR-1325);
//   - the chips are ask.mjs's EXAMPLE_QUESTIONS, the questions the deterministic reader is known to
//     reach, not v0.7's room-keyed table -- a shell file names no room;
//   - an answer shows which half of the brain gave it and how many receipts it cites; checking them
//     is the Ask arc room's job, and the dock says so rather than implying they were checked.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowRight, Gear, Microphone, X } from '@phosphor-icons/react'
import { ASK_GRANTS, EXAMPLE_QUESTIONS, askThrough, askable, readAnswer, readOnly, refusalOf } from '../lib/ask.mjs'
import { answerTag, readVoicePref, speakable, voiceStep, voiceSupport, writeVoicePref } from '../lib/talk.mjs'
import ModelsPanel from './ModelsPanel'
import { citationLine } from '../lib/registry.mjs'
import type { Door } from '../lib/door.mjs'
import { UI } from '../ui/kit'

type DockState =
  | { phase: 'idle' }
  | { phase: 'blocked'; why: string }
  | { phase: 'asking'; question: string }
  | { phase: 'answered'; question: string; answer: string; halfLabel: string; citations: number; tag: string; tone: string; howTo: string | null; model: string | null }
  | { phase: 'refused'; question: string; code: string; human: string }

type VoiceState = 'idle' | 'listening' | 'thinking' | 'speaking'
type Recognizer = { lang: string; interimResults: boolean; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onerror: (() => void) | null; onend: (() => void) | null; start: () => void; stop: () => void }

const safeStorage = () => { try { return window.localStorage } catch { return null } }

export default function Dock({ door, onDoor = false }: { door: Door; onDoor?: boolean }) {
  const handle = useMemo(() => readOnly(door, ASK_GRANTS), [door])
  const support = useMemo(() => voiceSupport(window), [])
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [voiceOn, setVoiceOn] = useState(() => readVoicePref(safeStorage()))
  const [voice, setVoice] = useState<VoiceState>('idle')
  const voiceRef = useRef<VoiceState>('idle')
  const recRef = useRef<Recognizer | null>(null)
  const [draft, setDraft] = useState('')
  const [state, setState] = useState<DockState>({ phase: 'idle' })
  const [focused, setFocused] = useState(false)
  // Every ask gets a ticket: a slow answer that lands after a newer question must not overwrite it.
  const ticket = useRef(0)
  const blurTimer = useRef<number | undefined>(undefined)

  const ask = useCallback(async (text: string) => {
    const ok = askable(text)
    if (!ok.ok) { setState({ phase: 'blocked', why: ok.why }); return }
    const mine = ++ticket.current
    setState({ phase: 'asking', question: ok.q })
    try {
      const answer = readAnswer(await askThrough(handle, ok.q))
      if (ticket.current !== mine) return
      if (!answer.ok) { setState({ phase: 'refused', question: ok.q, code: answer.code, human: answer.human }); return }
      const tag = answerTag(answer)
      setState({ phase: 'answered', question: ok.q, answer: answer.answer, halfLabel: answer.halfLabel, citations: answer.citations.length, tag: tag.tag, tone: tag.tone, howTo: tag.howTo, model: answer.model })
      setDraft('')
      return answer.answer
    } catch (err) {
      if (ticket.current !== mine) return
      const r = refusalOf(err)
      setState({ phase: 'refused', question: ok.q, code: r.code, human: r.human })
    }
  }, [handle])

  // ── voice: talk.mjs decides each step, this runs its effect ──
  const step = useCallback((ev: Parameters<typeof voiceStep>[1]) => {
    const next = voiceStep(voiceRef.current, ev)
    voiceRef.current = next.state
    setVoice(next.state)
    if (next.effect === 'start-listening') {
      const W = window as unknown as { SpeechRecognition?: new () => Recognizer; webkitSpeechRecognition?: new () => Recognizer }
      const Ctor = W.SpeechRecognition ?? W.webkitSpeechRecognition
      if (!Ctor) { step({ type: 'error' }); return }
      const rec = new Ctor()
      rec.lang = navigator.language || 'en-IN'
      rec.interimResults = false
      rec.onresult = (e) => step({ type: 'heard', text: e.results[0]?.[0]?.transcript ?? '' })
      rec.onerror = () => step({ type: 'error' })
      rec.onend = () => { if (voiceRef.current === 'listening') step({ type: 'silence' }) }
      recRef.current = rec
      rec.start()
    } else if (next.effect === 'stop-listening') {
      recRef.current?.stop()
    } else if (next.effect === 'stop-speaking') {
      window.speechSynthesis.cancel()
    } else if (next.effect === 'ask' && next.text) {
      setDraft(next.text)
      void ask(next.text).then((said) => {
        step({ type: 'answer', speak: support.speak && typeof said === 'string' })
        if (voiceRef.current === 'speaking' && typeof said === 'string') {
          const u = new SpeechSynthesisUtterance(speakable(said))
          u.lang = navigator.language || 'en-IN'
          u.onend = () => step({ type: 'spoken' })
          u.onerror = () => step({ type: 'error' })
          window.speechSynthesis.speak(u)
        }
      })
    }
  }, [ask, support.speak])

  useEffect(() => () => { recRef.current?.stop(); if (support.speak) window.speechSynthesis.cancel() }, [support.speak])

  const setVoicePref = (on: boolean) => { setVoiceOn(on); writeVoicePref(safeStorage(), on); if (!on) step({ type: 'error' }) }
  const micShown = voiceOn && support.listen

  const onSubmit = (ev: FormEvent) => { ev.preventDefault(); void ask(draft) }
  const chipsVisible = focused && (state.phase === 'idle' || state.phase === 'blocked')
  const conversation = state.phase !== 'idle'

  return (
    <div data-ask-dock={onDoor ? 'door' : 'workroom'} className={`fixed bottom-0 right-0 left-0 ${onDoor ? '' : 'lg:left-[240px]'} z-40 pointer-events-none`} style={{ fontFamily: UI }}>
      {settingsOpen ? <ModelsPanel door={door} onClose={() => setSettingsOpen(false)} voiceOn={voiceOn} onVoice={setVoicePref} voiceAvailable={support.listen || support.speak} /> : null}
      {conversation ? (
        <div className="flex justify-center px-5 mb-3">
          <div role="status" className="pointer-events-auto max-w-2xl w-full px-6 py-4 relative" style={{ background: 'var(--bg-2)', border: '1px solid var(--line-2)', borderRadius: 'var(--r-lg)', boxShadow: 'var(--shadow-pop)' }}>
            <button
              type="button"
              aria-label="Close the answer"
              onClick={() => { ticket.current++; setState({ phase: 'idle' }) }}
              className="absolute top-3 right-3 inline-flex items-center justify-center w-[26px] h-[26px] cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-(--accent)"
              style={{ color: 'var(--text-3)', borderRadius: 'var(--r-sm)' }}
            >
              <X size={14} aria-hidden="true" />
            </button>
            {state.phase === 'blocked' ? (
              <div className="text-[13px]" style={{ color: 'var(--text-2)' }}>{state.why}</div>
            ) : null}
            {state.phase === 'asking' || state.phase === 'answered' || state.phase === 'refused' ? (
              <div className="text-[11px] uppercase tracking-[0.12em] mb-2.5 pr-8" style={{ fontWeight: 600, color: 'var(--text-3)' }}>
                you: {state.question}
              </div>
            ) : null}
            {state.phase === 'asking' ? (
              <div className="text-[13px] animate-pulse" style={{ color: 'var(--text-2)' }}>{voice === 'thinking' ? 'thinking…' : 'checking the receipts…'}</div>
            ) : null}
            {state.phase === 'answered' ? (
              <>
                <div className="text-[15px] sm:text-[17px] leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--text-1)' }}>{state.answer}</div>
                <div data-answer-tag={state.tone} className="mt-2.5 text-[11px] leading-[16px] uppercase tracking-[0.08em]" style={{ fontWeight: 600, color: state.tone === 'warn' ? 'var(--red)' : state.tone === 'general' ? 'var(--accent)' : 'var(--text-3)' }}>
                  {state.tag}{state.model ? ` · ${state.model}` : ''}
                </div>
                <div className="mt-1 text-[11px] leading-[16px]" style={{ color: 'var(--text-3)' }}>
                  {citationLine(state.halfLabel, state.citations)}
                </div>
                {state.howTo ? <div data-needs-model className="mt-2 text-[12.5px] leading-[19px]" style={{ color: 'var(--text-2)' }}>{state.howTo}</div> : null}
              </>
            ) : null}
            {state.phase === 'refused' ? (
              <div className="text-[13px]" style={{ color: 'var(--text-2)' }}>
                <span className="text-[11px] uppercase tracking-[0.08em] mr-2" style={{ fontWeight: 600, color: 'var(--red)' }}>{state.code}</span>
                {state.human}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="pb-4 pt-8 px-4" style={{ background: 'linear-gradient(to top, var(--bg-0) 30%, transparent)' }}>
        <div className="flex flex-wrap justify-center gap-2 mb-3 transition-opacity duration-300" style={{ opacity: chipsVisible ? 1 : 0, pointerEvents: chipsVisible ? 'auto' : 'none' }}>
          {EXAMPLE_QUESTIONS.slice(0, 3).map((q) => (
            <button
              key={q}
              type="button"
              tabIndex={chipsVisible ? 0 : -1}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => void ask(q)}
              className="text-[12px] h-[30px] px-3 rounded-full transition-colors cursor-pointer hover:text-(--accent) focus-visible:outline focus-visible:outline-2 focus-visible:outline-(--accent)"
              style={{ fontWeight: 500, color: 'var(--text-2)', background: 'var(--bg-2)', border: '1px solid var(--line-2)' }}
            >
              {q}
            </button>
          ))}
        </div>

        <div className="flex justify-center">
          <form onSubmit={onSubmit} className="pointer-events-auto flex items-center gap-2 rounded-full pl-4 pr-1.5 py-1.5" style={{ background: 'var(--bg-2)', border: '1px solid var(--line-2)', boxShadow: 'var(--shadow-pop)' }}>
            <label htmlFor="ask-arc-dock" className="sr-only">Ask arc a question</label>
            <input
              id="ask-arc-dock"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onFocus={() => { window.clearTimeout(blurTimer.current); setFocused(true) }}
              onBlur={() => { blurTimer.current = window.setTimeout(() => setFocused(false), 200) }}
              placeholder={state.phase === 'asking' ? 'checking the receipts…' : 'ask the company anything'}
              className="bg-transparent outline-none text-[13.5px] w-[200px] sm:w-[320px] px-1 placeholder:text-(--text-3)"
              style={{ color: 'var(--text-1)' }}
            />
            {micShown ? (
              <button
                type="button"
                data-voice-mic={voice}
                aria-label={voice === 'listening' ? 'Stop listening' : voice === 'speaking' ? 'Stop speaking' : 'Ask by voice'}
                aria-pressed={voice !== 'idle'}
                onClick={() => step({ type: 'press' })}
                className="w-10 h-10 rounded-full flex items-center justify-center transition-colors cursor-pointer hover:text-(--accent) focus-visible:outline focus-visible:outline-2 focus-visible:outline-(--accent)"
                style={{ border: `1px solid ${voice === 'idle' ? 'var(--line-2)' : 'var(--accent)'}`, color: voice === 'idle' ? 'var(--text-2)' : 'var(--accent)' }}
              >
                <Microphone size={15} aria-hidden="true" className={voice === 'listening' ? 'animate-pulse' : ''} />
              </button>
            ) : null}
            <button
              type="button"
              data-ask-settings
              aria-label="Talking settings: models and voice"
              onClick={() => setSettingsOpen(true)}
              className="w-10 h-10 rounded-full flex items-center justify-center transition-colors cursor-pointer hover:text-(--accent) focus-visible:outline focus-visible:outline-2 focus-visible:outline-(--accent)"
              style={{ border: '1px solid var(--line-2)', color: 'var(--text-2)' }}
            >
              <Gear size={15} aria-hidden="true" />
            </button>
            <button
              type="submit"
              aria-label="Ask arc"
              className="w-10 h-10 rounded-full flex items-center justify-center transition-colors cursor-pointer hover:text-(--accent) focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent)"
              style={{ border: '1px solid var(--line-2)', color: 'var(--text-2)' }}
            >
              <ArrowRight size={15} aria-hidden="true" />
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
