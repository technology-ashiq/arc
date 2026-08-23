// ─────────────────────────────────────────────────────────────
// HQ shell — the command room. Left rail of rooms, top status
// strip with the sim-day player, room content over the dimmed
// face. Registers itself on the uiBus so the brain (and the
// landing page) can drive navigation.
// ─────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react'
import { FONT, MONO, COLOR, StatusDot } from '../ui/kit.jsx'
import { registerUI, uiBus } from '../lib/uiBus.js'
import { spine, setSpeed } from '../spine/store.js'
import { kpis, clockLabel } from '../spine/derive.js'
import { useSpine } from './useSpine.js'
import { engineReady, loadEngine } from '../brain/llm.js'

import Overview from './rooms/Overview.jsx'
import SpineRoom from './rooms/SpineRoom.jsx'
import Factory from './rooms/Factory.jsx'
import Council from './rooms/Council.jsx'
import Portfolio from './rooms/Portfolio.jsx'
import Autonomy from './rooms/Autonomy.jsx'
import Money from './rooms/Money.jsx'
import Learn from './rooms/Learn.jsx'
import Law from './rooms/Law.jsx'
import Story from './rooms/Story.jsx'
import EngineRoom from './rooms/EngineRoom.jsx'

export const ROOMS = [
  { id: 'overview', name: 'overview', C: Overview },
  { id: 'spine', name: 'the spine', C: SpineRoom },
  { id: 'factory', name: 'factory', C: Factory },
  { id: 'council', name: 'council', C: Council },
  { id: 'portfolio', name: 'portfolio', C: Portfolio },
  { id: 'autonomy', name: 'autonomy', C: Autonomy },
  { id: 'money', name: 'money', C: Money },
  { id: 'learn', name: 'learn', C: Learn },
  { id: 'law', name: 'the law', C: Law },
  { id: 'story', name: 'story', C: Story },
  { id: 'engine', name: 'engine room', C: EngineRoom },
]

const SPEEDS = [
  { v: 0, label: '⏸' },
  { v: 1, label: '1×' },
  { v: 10, label: '10×' },
  { v: 60, label: '60×' },
]

export default function HQ({ onExit }) {
  useSpine()
  const [room, setRoom] = useState('overview')
  useEffect(() => {
    registerUI({ openRoom: (id) => ROOMS.some((r) => r.id === id) && setRoom(id) })
    uiBus.room = room
  })
  useEffect(() => {
    uiBus.room = room
  }, [room])

  const k = kpis()
  const eng = engineReady() ? loadEngine() : null
  const Active = (ROOMS.find((r) => r.id === room) || ROOMS[0]).C

  return (
    <div className="relative min-h-screen" style={{ fontFamily: FONT }}>
      {/* ── top strip ── */}
      <header className="fixed top-0 left-0 right-0 z-40" style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.88), rgba(0,0,0,0.55))', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="flex items-center justify-between gap-3 px-4 sm:px-6 h-[58px]">
          <div className="flex items-center gap-4 min-w-0">
            <button onClick={onExit} className="flex items-baseline gap-2 cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00ffd1] rounded min-h-[44px] items-center" title="back to the face">
              <span className="text-[20px] tracking-tight text-white leading-none" style={{ fontWeight: 600 }}>arc</span>
              <span className="text-[10px] uppercase tracking-[0.3em]" style={{ fontFamily: MONO, color: COLOR.cyan }}>hq</span>
            </button>
            <span className="hidden md:flex items-center gap-2 text-[10.5px] text-white/62" style={{ fontFamily: MONO, fontVariantNumeric: 'tabular-nums' }}>
              <span>{clockLabel()}</span>
              <span className="text-white/35">·</span>
              <span>sim day {spine.dayIndex - 13}</span>
            </span>
            {/* day player */}
            <span className="hidden sm:flex items-center gap-1" role="group" aria-label="Simulation speed">
              {SPEEDS.map((s) => (
                <button
                  key={s.v}
                  onClick={() => setSpeed(s.v)}
                  className="min-w-[34px] min-h-[30px] rounded-md text-[10px] cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00ffd1]"
                  style={{
                    fontFamily: MONO,
                    background: spine.speed === s.v ? 'rgba(0,255,209,0.16)' : 'rgba(255,255,255,0.05)',
                    color: spine.speed === s.v ? COLOR.cyan : 'rgba(255,255,255,0.6)',
                    border: `1px solid ${spine.speed === s.v ? 'rgba(0,255,209,0.5)' : 'rgba(255,255,255,0.12)'}`,
                  }}
                >
                  {s.label}
                </button>
              ))}
            </span>
          </div>

          <div className="flex items-center gap-2" style={{ fontFamily: MONO }}>
            <span className="hidden lg:inline-flex items-center gap-2 text-[9.5px] uppercase tracking-[0.14em] text-white/65 border border-white/13 rounded-full px-3 py-[6px]">
              <StatusDot state={spine.source === 'real' ? 'live' : 'building'} />
              {spine.source === 'real' ? 'REAL SPINE' : 'SIMULATED'}
            </span>
            <button
              onClick={() => setRoom('overview')}
              className="inline-flex items-center gap-2 text-[9.5px] uppercase tracking-[0.14em] rounded-full px-3 min-h-[34px] cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00ffd1]"
              style={{ color: k.pending ? '#000' : 'rgba(255,255,255,0.65)', background: k.pending ? COLOR.amber : 'rgba(255,255,255,0.05)', border: '1px solid ' + (k.pending ? COLOR.amber : 'rgba(255,255,255,0.13)'), fontWeight: k.pending ? 700 : 400 }}
            >
              {k.pending} waiting · ~{k.minutesNeeded} min
            </button>
            <button
              onClick={() => setRoom('engine')}
              className="hidden md:inline-flex items-center gap-2 text-[9.5px] uppercase tracking-[0.14em] text-white/65 border border-white/13 rounded-full px-3 min-h-[34px] cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00ffd1]"
              title="engine room — brain settings"
            >
              <StatusDot state={eng ? 'live' : 'sleeping'} />
              {eng ? `brain: ${eng.provider}` : 'brain: offline'}
            </button>
          </div>
        </div>
      </header>

      {/* ── room rail ── */}
      <nav aria-label="Rooms" className="fixed left-0 top-[58px] bottom-0 z-40 hidden lg:flex flex-col gap-[2px] w-[168px] px-3 pt-5" style={{ fontFamily: MONO, background: 'linear-gradient(to right, rgba(0,0,0,0.72), rgba(0,0,0,0.25))' }}>
        {ROOMS.map((r, i) => {
          const active = room === r.id
          return (
            <button
              key={r.id}
              onClick={() => setRoom(r.id)}
              aria-current={active ? 'true' : undefined}
              className="flex items-center gap-2.5 text-left rounded-lg px-3 min-h-[38px] cursor-pointer transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00ffd1]"
              style={{ background: active ? 'rgba(0,255,209,0.1)' : 'transparent', border: `1px solid ${active ? 'rgba(0,255,209,0.35)' : 'transparent'}` }}
            >
              <span className="text-[9px]" style={{ color: active ? COLOR.cyan : 'rgba(255,255,255,0.38)' }}>{String(i).padStart(2, '0')}</span>
              <span className="text-[10.5px] uppercase tracking-[0.16em]" style={{ color: active ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.58)' }}>{r.name}</span>
            </button>
          )
        })}
        <div className="mt-auto pb-40 px-3 text-[8.5px] leading-[14px] text-white/35 uppercase tracking-[0.12em]">
          j/k a/r — inbox keys<br />every panel = a view over the log
        </div>
      </nav>

      {/* mobile room switcher */}
      <div className="lg:hidden fixed top-[58px] left-0 right-0 z-40 overflow-x-auto px-3 py-2 flex gap-1.5" style={{ background: 'rgba(0,0,0,0.8)', fontFamily: MONO }}>
        {ROOMS.map((r) => (
          <button key={r.id} onClick={() => setRoom(r.id)} className="shrink-0 text-[9.5px] uppercase tracking-[0.14em] rounded-full px-3 min-h-[32px] cursor-pointer" style={{ color: room === r.id ? '#000' : 'rgba(255,255,255,0.65)', background: room === r.id ? COLOR.cyan : 'rgba(255,255,255,0.07)', fontWeight: room === r.id ? 700 : 400 }}>
            {r.name}
          </button>
        ))}
      </div>

      {/* ── room content ── */}
      <main className="relative z-10 pt-[74px] lg:pt-[78px] lg:pl-[176px] px-4 sm:px-6 pb-64 max-w-[1500px]">
        <Active />
      </main>
    </div>
  )
}
