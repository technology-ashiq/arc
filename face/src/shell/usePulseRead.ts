// usePulseRead.ts -- one door read that follows the pulse (face v2 Phase 05, REQ-11), for the rooms the module host does
// not drive (the index rooms, a lane's phases).
//
// Three rules, each a defect the PR 2 logic attack found in the abort-and-restart version it replaces:
//   - a NEW read (another route, another lane) starts from loading; a pulse re-read keeps the last answer on screen
//   - a pulse that arrives while the read is in flight does not abort it -- aborting on every pulse starved a read that
//     takes longer than the pulse interval, so it never landed -- it marks the read, and the read runs again when it lands
//   - a failed re-read keeps the last good answer and says so; only a read that never answered shows the error
import { useEffect, useRef, useState } from 'react'

export type PulseRead<T> =
  | { phase: 'loading' }
  | { phase: 'ready'; data: T; rereadFailed?: unknown }
  | { phase: 'error'; error: unknown }

export function usePulseRead<T>(key: string | null, load: (signal: AbortSignal) => Promise<T>, pulse?: string): PulseRead<T> {
  const [read, setRead] = useState<PulseRead<T>>({ phase: 'loading' })
  const current = useRef<PulseRead<T>>(read)
  const loadRef = useRef(load)
  loadRef.current = load
  const flight = useRef<AbortController | null>(null)
  const dirty = useRef(false)
  const alive = useRef(true)

  const set = (r: PulseRead<T>) => {
    current.current = r
    if (alive.current) setRead(r)
  }
  const startRef = useRef<() => void>(() => {})
  startRef.current = () => {
    const ac = new AbortController()
    flight.current = ac
    loadRef
      .current(ac.signal)
      .then((data) => {
        if (flight.current === ac) set({ phase: 'ready', data })
      })
      .catch((error: unknown) => {
        if (flight.current !== ac || ac.signal.aborted) return
        const prev = current.current
        set(prev.phase === 'ready' ? { phase: 'ready', data: prev.data, rereadFailed: error } : { phase: 'error', error })
      })
      .finally(() => {
        if (flight.current !== ac) return
        flight.current = null
        if (dirty.current) {
          dirty.current = false
          startRef.current()
        }
      })
  }

  // A new identity: abort what was in flight and start from loading.
  useEffect(() => {
    alive.current = true
    if (key === null) return
    dirty.current = false
    set({ phase: 'loading' })
    startRef.current()
    return () => {
      const f = flight.current
      flight.current = null
      f?.abort()
    }
  }, [key])

  // The pulse: read again without clearing, or mark the read in flight to run again when it lands.
  const seen = useRef(pulse)
  useEffect(() => {
    if (pulse === seen.current) return
    seen.current = pulse
    if (key === null) return
    if (flight.current) {
      dirty.current = true
      return
    }
    startRef.current()
  }, [pulse, key])

  useEffect(() => () => { alive.current = false }, [])
  return read
}
