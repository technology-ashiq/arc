// The voice dock — arc's mouth and ears, persistent across landing
// and every HQ room. Mic + typed ask + streaming captions, with
// suggestion chips that follow where you are. Engine badge shows
// which brain answered (offline matcher vs the configured model).
import { useEffect, useRef, useState } from 'react'
import { bus, subscribe, listen, ask } from '../lib/voice.js'
import { FONT, UI, MONO } from '../ui/kit.jsx'
import { uiBus } from '../lib/uiBus.js'
import { onStage } from '../lib/stage.js'
import { useSpine } from '../hq/useSpine.js'
import { engineReady, loadEngine } from '../brain/llm.js'

const CHIPS = {
  landing: ['What is arc?', 'What needs me today?'],
  overview: ['What needs me today?', 'Approve the first one', 'Read me the brief'],
  spine: ['What is the spine?', 'What happened in the last hour?'],
  factory: ['How does a phase close?', 'What does /arc-kickoff do?'],
  council: ['Run the council on billing', 'What happened in session 001?'],
  portfolio: ['Tell me about LexOS', 'What is the portfolio math?'],
  autonomy: ['What stays human forever?', 'How does promotion work?'],
  money: ['How much did we make today?', 'When is the first real rupee?'],
  learn: ['What did the company learn?', 'What is evolve?'],
  law: ['What is the truth law?', 'How is the constitution amended?'],
  story: ['Tell me your story', 'What are the five laws?'],
  engine: ['Which brain are you using?', 'What can you do with a real brain?'],
}

let _focusAsk = null
export function focusAsk() {
  if (_focusAsk) _focusAsk()
}

export default function VoiceDock() {
  useSpine()
  const [voice, setVoice] = useState({ ...bus })
  const [typed, setTyped] = useState('')
  const [focused, setFocused] = useState(false)
  const blurTimer = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => subscribe((v) => setVoice(v)), [])
  // on the landing the dock belongs to the hero: it slides away once the
  // reader scrolls into the story (presence is driven by the hero observer)
  const [heroAway, setHeroAway] = useState(false)
  useEffect(() => onStage((s) => setHeroAway(s.presence < 0.5)), [])
  useEffect(() => {
    _focusAsk = () => inputRef.current?.focus()
    return () => {
      _focusAsk = null
    }
  }, [])

  const onFocus = () => {
    clearTimeout(blurTimer.current)
    setFocused(true)
  }
  const onBlur = () => {
    blurTimer.current = setTimeout(() => setFocused(false), 300)
  }

  const submitTyped = (e) => {
    e.preventDefault()
    if (typed.trim()) {
      ask(typed.trim())
      setTyped('')
    }
  }

  const context = uiBus.mode === 'landing' ? 'landing' : uiBus.room || 'overview'
  const conversationActive = voice.started && (voice.state !== 'idle' || voice.reply || voice.transcript)
  const docked = uiBus.mode === 'landing' && heroAway && !conversationActive && !focused
  const stateLabel =
    voice.state === 'listening' ? 'listening…' : voice.state === 'thinking' ? 'thinking…' : voice.state === 'speaking' ? 'speaking' : 'ask the company anything'
  const chips = CHIPS[context] || CHIPS.landing
  const chipsVisible = voice.state === 'idle' && (context === 'landing' || focused)
  const eng = engineReady() ? loadEngine() : null
  // in the workroom the dock sits inside the content column (right of the
  // rail), on quiet solid surfaces; on the landing it floats over the face.
  const inHQ = uiBus.mode !== 'landing'
  const listening = voice.state === 'listening'
  const pillStyle = inHQ
    ? { background: 'var(--bg-2)', border: '1px solid var(--line-2)', boxShadow: 'var(--shadow-pop)' }
    : { background: 'rgba(0,0,0,0.66)', border: '1px solid rgba(255,255,255,0.14)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', boxShadow: '0 0 44px rgba(45,212,191,0.10)' }

  return (
    <div
      className={`fixed bottom-0 right-0 left-0 ${inHQ ? 'lg:left-[240px]' : ''} z-40 pointer-events-none transition-all duration-500`}
      style={{ fontFamily: inHQ ? UI : FONT, transitionTimingFunction: 'cubic-bezier(0.32,0.72,0,1)', opacity: docked ? 0 : 1, transform: docked ? 'translateY(24px)' : 'none' }}
      aria-hidden={docked ? 'true' : undefined}
    >
      {conversationActive && (
        <div className="flex justify-center px-5 mb-3">
          <div className="max-w-2xl w-full text-center px-6 py-4" style={inHQ ? { background: 'var(--bg-2)', border: '1px solid var(--line-2)', borderRadius: 'var(--r-lg)', boxShadow: 'var(--shadow-pop)' } : { background: 'rgba(0,0,0,0.68)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)' }}>
            {voice.transcript && (
              <div className="text-[11px] uppercase tracking-[0.12em] mb-2.5" style={{ fontFamily: inHQ ? UI : MONO, fontWeight: 600, color: 'var(--text-3)' }}>
                you: {voice.transcript}
              </div>
            )}
            {voice.reply && (
              <div className={`text-[15px] sm:text-[17px] md:text-[19px] leading-relaxed transition-opacity duration-300 ${voice.state === 'speaking' ? 'opacity-100' : 'opacity-85'}`} style={{ fontWeight: inHQ ? 400 : 300, color: 'var(--text-1)' }}>
                {voice.reply}
              </div>
            )}
            {listening && !voice.transcript && <div className="text-[14px] animate-pulse" style={{ color: 'var(--accent)' }}>I'm listening…</div>}
            {voice.state === 'thinking' && <div className="text-[13px] animate-pulse" style={{ color: 'var(--text-2)' }}>{engineReady() ? 'thinking with the engine…' : 'checking the receipts…'}</div>}
          </div>
        </div>
      )}

      <div className="pb-4 pt-8 px-4" style={{ background: inHQ ? 'linear-gradient(to top, var(--bg-0) 30%, transparent)' : 'linear-gradient(to top, rgba(0,0,0,0.85), transparent)' }}>
        <div className="flex flex-wrap justify-center gap-2 mb-3 transition-opacity duration-300" style={{ opacity: chipsVisible ? 1 : 0, pointerEvents: chipsVisible ? 'auto' : 'none' }}>
          {chips.map((c) => (
            <button
              key={c}
              onClick={() => ask(c)}
              className={`${inHQ ? 'text-[12px] h-[30px] px-3' : 'text-[10px] sm:text-[10.5px] uppercase tracking-[0.12em] min-h-[38px] px-4'} rounded-full transition-colors cursor-pointer hover:text-(--accent) hover:border-(--accent)/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-(--accent)`}
              style={inHQ ? { fontFamily: UI, fontWeight: 500, color: 'var(--text-2)', background: 'var(--bg-2)', border: '1px solid var(--line-2)' } : { fontFamily: MONO, color: 'rgba(255,255,255,0.72)', background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(255,255,255,0.16)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' }}
            >
              {c}
            </button>
          ))}
        </div>

        <div className="flex justify-center">
          <div className="pointer-events-auto flex items-center gap-2 rounded-full pl-1.5 pr-1.5 py-1.5" style={pillStyle}>
            <button
              onClick={listen}
              aria-label={listening ? 'Stop listening' : 'Talk to arc'}
              className="relative w-10 h-10 rounded-full flex items-center justify-center cursor-pointer transition-all duration-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent)"
              style={{
                background: listening ? 'rgba(var(--accent-rgb),0.16)' : inHQ ? 'var(--bg-4)' : 'rgba(255,255,255,0.06)',
                border: `1px solid ${listening ? 'var(--accent)' : inHQ ? 'var(--line-2)' : 'rgba(255,255,255,0.28)'}`,
                color: listening ? 'var(--accent)' : 'var(--text-1)',
              }}
            >
              {listening && <span className="absolute inset-0 rounded-full border animate-ping" style={{ borderColor: 'rgba(var(--accent-rgb),0.6)' }} />}
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
                <path d="M19 10v1a7 7 0 0 1-14 0v-1" />
                <line x1="12" y1="18" x2="12" y2="22" />
              </svg>
            </button>

            <form onSubmit={submitTyped} className="flex items-center gap-2">
              <label htmlFor="ask-arc" className="sr-only">Ask arc a question</label>
              <input id="ask-arc" ref={inputRef} value={typed} onChange={(e) => setTyped(e.target.value)} onFocus={onFocus} onBlur={onBlur} placeholder={stateLabel} className="bg-transparent outline-none text-[13.5px] w-[180px] sm:w-[300px] px-1 placeholder:text-(--text-3)" style={{ fontFamily: inHQ ? UI : FONT, fontWeight: inHQ ? 400 : 300, color: 'var(--text-1)' }} />
              <button type="submit" aria-label="Ask arc" className="w-10 h-10 rounded-full flex items-center justify-center transition-colors cursor-pointer hover:text-(--accent) hover:border-(--accent) focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent)" style={{ border: '1px solid ' + (inHQ ? 'var(--line-2)' : 'rgba(255,255,255,0.22)'), color: 'var(--text-2)' }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </button>
            </form>
          </div>
        </div>

        {!inHQ && (
          <div className="text-center mt-2.5 text-[9px] uppercase tracking-[0.24em]" style={{ fontFamily: MONO, color: eng ? 'rgba(74,222,128,0.75)' : 'rgba(255,255,255,0.4)' }}>
            {eng ? `engine: ${eng.provider} · ${eng.model} · key stays on this machine` : 'offline brain · add a key in the engine room for the full mind'}
          </div>
        )}
      </div>
    </div>
  )
}
