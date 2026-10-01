// useAsk.ts -- the one ask brain both surfaces share (face v2 Phase 10, REQ-14, ADR-1350).
//
// The workroom's Dock and the front door's ask bar look nothing alike (the workroom's calm tokens, the door's neon), so
// each renders its own; what they ask, how an answer is labelled and how voice runs is this hook, once. Every decision is
// talk.mjs's or ask.mjs's -- this file only holds state and runs the effects they name (the mic, the speaker).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ASK_GRANTS, askThrough, askable, readAnswer, readOnly, refusalOf } from '../lib/ask.mjs'
import { answerTag, speakable, voiceStep, voiceSupport } from '../lib/talk.mjs'
import type { Door } from '../lib/door.mjs'

export type AskState =
  | { phase: 'idle' }
  | { phase: 'blocked'; why: string }
  | { phase: 'asking'; question: string }
  | { phase: 'answered'; question: string; answer: string; halfLabel: string; citations: number; tag: string; tone: string; howTo: string | null; model: string | null }
  | { phase: 'refused'; question: string; code: string; human: string }

export type VoiceState = 'idle' | 'listening' | 'thinking' | 'speaking'
type Recognizer = { lang: string; interimResults: boolean; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onerror: (() => void) | null; onend: (() => void) | null; start: () => void; stop: () => void }

export function useAsk(door: Door, voiceOn: boolean) {
  const handle = useMemo(() => readOnly(door, ASK_GRANTS), [door])
  const support = useMemo(() => voiceSupport(window), [])
  const [draft, setDraft] = useState('')
  const [state, setState] = useState<AskState>({ phase: 'idle' })
  const [voice, setVoice] = useState<VoiceState>('idle')
  const voiceRef = useRef<VoiceState>('idle')
  const recRef = useRef<Recognizer | null>(null)
  // Every ask gets a ticket: a slow answer that lands after a newer question must not overwrite it.
  const ticket = useRef(0)

  const ask = useCallback(async (text: string): Promise<string | undefined> => {
    const ok = askable(text)
    if (!ok.ok) { setState({ phase: 'blocked', why: ok.why }); return undefined }
    const mine = ++ticket.current
    setState({ phase: 'asking', question: ok.q })
    try {
      const answer = readAnswer(await askThrough(handle, ok.q))
      if (ticket.current !== mine) return undefined
      if (!answer.ok) { setState({ phase: 'refused', question: ok.q, code: answer.code, human: answer.human }); return undefined }
      const tag = answerTag(answer)
      setState({ phase: 'answered', question: ok.q, answer: answer.answer, halfLabel: answer.halfLabel, citations: answer.citations.length, tag: tag.tag, tone: tag.tone, howTo: tag.howTo, model: answer.model })
      setDraft('')
      return answer.answer
    } catch (err) {
      if (ticket.current !== mine) return undefined
      const r = refusalOf(err)
      setState({ phase: 'refused', question: ok.q, code: r.code, human: r.human })
      return undefined
    }
  }, [handle])

  // ── voice: talk.mjs decides each step, this runs its effect ──
  const step = useCallback(function run(ev: Parameters<typeof voiceStep>[1]): void {
    const next = voiceStep(voiceRef.current, ev)
    voiceRef.current = next.state
    setVoice(next.state)
    if (next.effect === 'start-listening') {
      const W = window as unknown as { SpeechRecognition?: new () => Recognizer; webkitSpeechRecognition?: new () => Recognizer }
      const Ctor = W.SpeechRecognition ?? W.webkitSpeechRecognition
      if (!Ctor) { run({ type: 'error' }); return }
      const rec = new Ctor()
      rec.lang = navigator.language || 'en-IN'
      rec.interimResults = false
      rec.onresult = (e) => run({ type: 'heard', text: e.results[0]?.[0]?.transcript ?? '' })
      rec.onerror = () => run({ type: 'error' })
      rec.onend = () => { if (voiceRef.current === 'listening') run({ type: 'silence' }) }
      recRef.current = rec
      rec.start()
    } else if (next.effect === 'stop-listening') {
      recRef.current?.stop()
    } else if (next.effect === 'stop-speaking') {
      window.speechSynthesis.cancel()
    } else if (next.effect === 'ask' && next.text) {
      setDraft(next.text)
      void ask(next.text).then((said) => {
        run({ type: 'answer', speak: support.speak && typeof said === 'string' })
        if (voiceRef.current === 'speaking' && typeof said === 'string') {
          const u = new SpeechSynthesisUtterance(speakable(said))
          u.lang = navigator.language || 'en-IN'
          u.onend = () => run({ type: 'spoken' })
          u.onerror = () => run({ type: 'error' })
          window.speechSynthesis.speak(u)
        }
      })
    }
  }, [ask, support.speak])

  // Voice switched off in HQ's settings mid-sentence: stop listening and speaking now, not at the next press.
  useEffect(() => { if (!voiceOn && voiceRef.current !== 'idle') step({ type: 'error' }) }, [voiceOn, step])
  useEffect(() => () => { recRef.current?.stop(); if (support.speak) window.speechSynthesis.cancel() }, [support.speak])

  const close = useCallback(() => { ticket.current++; setState({ phase: 'idle' }) }, [])

  return { draft, setDraft, state, ask, voice, press: () => step({ type: 'press' }), micShown: voiceOn && support.listen, close }
}
