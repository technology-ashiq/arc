// arc — Speak To The Company (v0.4 "the working HQ")
// Two layers over one persistent face:
//   landing → the face at full presence, ENTER HQ
//   hq      → the command room: rooms over the dimmed face,
//             everything derived from a live event spine,
//             the face talking with a real model brain.
import { useEffect, useRef, useState } from 'react'
import FaceStage from './face/FaceStage.jsx'
import Landing from './hq/Landing.jsx'
import HQ from './hq/HQ.jsx'
import VoiceDock from './chrome/VoiceDock.jsx'
import { setStage, stage } from './lib/stage.js'
import { registerUI, uiBus } from './lib/uiBus.js'
import { boot, startClock } from './spine/store.js'

export default function App() {
  const [mode, setMode] = useState('landing')
  const prevMode = useRef('landing')

  // the spine lives from the first frame — the company is always running
  useEffect(() => {
    boot()
    startClock()
  }, [])

  useEffect(() => {
    registerUI({ enterHQ: () => setMode('hq') })
  }, [])

  useEffect(() => {
    uiBus.mode = mode
    // face presence: forward on the landing, recessed in the HQ.
    // (voice activity always wakes it — handled inside FaceStage.)
    // Crossing the doorway also fires a warp: the face flies past the
    // camera going in and swoops back coming out (FaceStage timeline).
    const crossed = prevMode.current !== mode
    prevMode.current = mode
    setStage({
      presence: mode === 'landing' ? 1 : 0.24,
      ...(crossed ? { warp: { dir: mode === 'hq' ? 1 : -1, id: stage.warp.id + 1 } } : {}),
    })
  }, [mode])

  return (
    <main className="relative" style={{ background: '#000' }}>
      <FaceStage />
      {/* reading scrim — guarantees type contrast over the particles.
          Entering the HQ it waits half a beat so the face's fly-through
          stays bright; leaving, it clears immediately. */}
      <div
        aria-hidden="true"
        className="fixed inset-0 z-[1] pointer-events-none bg-black transition-opacity duration-700"
        style={{ opacity: mode === 'hq' ? 0.52 : 0, transitionDelay: mode === 'hq' ? '500ms' : '0ms' }}
      />
      <div className="relative z-10">
        {mode === 'landing' ? <Landing /> : <HQ onExit={() => setMode('landing')} />}
      </div>
      <VoiceDock />
    </main>
  )
}
