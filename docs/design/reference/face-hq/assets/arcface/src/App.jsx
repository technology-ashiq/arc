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
import CommandPalette from './hq/CommandPalette.jsx'
import { setStage, stage } from './lib/stage.js'
import { registerUI, uiBus } from './lib/uiBus.js'
import { boot, startClock } from './spine/store.js'
import { wsLoad } from './spine/workspace.js'

export default function App() {
  // deep link: /#hq opens straight into the command room
  // /#hq/<room> opens straight into that room (the rail keeps the hash current)
  const [mode, setMode] = useState(() => (typeof window !== 'undefined' && /^#hq(\/|$)/.test(window.location.hash) ? 'hq' : 'landing'))
  // the face lives on the FRONT PAGE only. Entering HQ it flies past the
  // camera (the warp) and then unmounts; leaving HQ it remounts mid-swoop.
  const [faceOn, setFaceOn] = useState(true)
  const prevMode = useRef('landing')
  const faceTimer = useRef(null)

  // the spine lives from the first frame — the company is always running.
  // After the sim boots, YOUR persisted workspace events merge back in.
  useEffect(() => {
    boot()
    wsLoad()
    startClock()
  }, [])

  useEffect(() => {
    registerUI({ enterHQ: () => setMode('hq') })
  }, [])

  useEffect(() => {
    uiBus.mode = mode
    const crossed = prevMode.current !== mode
    prevMode.current = mode
    clearTimeout(faceTimer.current)
    if (mode === 'hq') {
      // fire the warp while the face is still mounted, then remove it —
      // the HQ is a clean room, the face belongs to the front door.
      setStage({
        presence: 0.24,
        ...(crossed ? { warp: { dir: 1, id: stage.warp.id + 1 } } : {}),
      })
      faceTimer.current = setTimeout(() => setFaceOn(false), 1750)
    } else {
      setFaceOn(true)
      setStage({
        presence: 1,
        ...(crossed ? { warp: { dir: -1, id: stage.warp.id + 1 } } : {}),
      })
    }
    return () => clearTimeout(faceTimer.current)
  }, [mode])

  return (
    <main className="relative" style={{ background: '#0b0e11' }}>
      {faceOn && <FaceStage />}
      {/* reading scrim — only while the face is still on stage during the
          HQ warp; once it unmounts the HQ's own solid surfaces take over. */}
      {faceOn && (
        <div
          aria-hidden="true"
          className="fixed inset-0 z-[1] pointer-events-none bg-black transition-opacity duration-700"
          style={{ opacity: mode === 'hq' ? 0.6 : 0, transitionDelay: mode === 'hq' ? '500ms' : '0ms' }}
        />
      )}
      <div className="relative z-10">
        {mode === 'landing' ? <Landing /> : <HQ onExit={() => { setMode('landing'); try { window.history.replaceState(null, '', window.location.pathname) } catch { /* fine */ } }} />}
      </div>
      <VoiceDock />
      {/* ⌘K works everywhere — the landing included */}
      <CommandPalette />
    </main>
  )
}
