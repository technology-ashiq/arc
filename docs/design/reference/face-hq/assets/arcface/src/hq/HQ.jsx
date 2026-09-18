// ─────────────────────────────────────────────────────────────
// HQ shell — the command room. A rail of rooms on the left, a
// thin status bar on top, the room in the middle. Registers
// itself on the uiBus so the brain (and the landing page) can
// drive navigation. Adds `hq` to <html> so the workroom reads
// its own tokens; `hq-light` swaps them for paper.
// ─────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react'
import { FONT, UI, MONO, COLOR, EASE, StatusDot } from '../ui/kit.jsx'
import { SunDim, MoonStars, MagnifyingGlass, Pause, Play, Tray } from '@phosphor-icons/react'
import { registerUI, uiBus } from '../lib/uiBus.js'
import { spine, setSpeed } from '../spine/store.js'
import { kpis, clockLabel } from '../spine/derive.js'
import { useSpine } from './useSpine.js'
import { engineReady, loadEngine } from '../brain/llm.js'
import { ROOM_META, RING_ORDER, resolveRoom } from './roomRegistry.js'

// command
import Overview from './rooms/Overview.jsx'
import Inbox from './rooms/Inbox.jsx'
import MapRoom from './rooms/MapRoom.jsx'
import SpineRoom from './rooms/SpineRoom.jsx'
import Board from './rooms/Board.jsx'
import AskArc from './rooms/AskArc.jsx'
// kernel
import EngineRoom from './rooms/EngineRoom.jsx'
import ModelPolicy from './rooms/ModelPolicy.jsx'
import Policy from './rooms/Policy.jsx'
import Scheduler from './rooms/Scheduler.jsx'
import Memory from './rooms/Memory.jsx'
import Evolve from './rooms/Evolve.jsx'
import Bench from './rooms/Bench.jsx'
import Absorb from './rooms/Absorb.jsx'
// factory
import Council from './rooms/Council.jsx'
import Develop from './rooms/Develop.jsx'
import ReviewShip from './rooms/ReviewShip.jsx'
import DesignStudio from './rooms/DesignStudio.jsx'
import Toolbelt from './rooms/Toolbelt.jsx'
import Factory from './rooms/Factory.jsx'
import Executor from './rooms/Executor.jsx'
import Agents from './rooms/Agents.jsx'
// money
import Money from './rooms/Money.jsx'
import Growth from './rooms/Growth.jsx'
import Leads from './rooms/Leads.jsx'
import Legal from './rooms/Legal.jsx'
import Ventures from './rooms/Ventures.jsx'
import Ops from './rooms/Ops.jsx'
import Trader from './rooms/Trader.jsx'
import Discover from './rooms/Discover.jsx'
// company
import Law from './rooms/Law.jsx'
import Learn from './rooms/Learn.jsx'
import Strategy from './rooms/Strategy.jsx'
import Org from './rooms/Org.jsx'
import Concepts from './rooms/Concepts.jsx'
import Story from './rooms/Story.jsx'

// room id → component. The registry (roomRegistry.js) owns names, rings,
// icons and sentences; this map only binds the view.
const VIEW = {
  overview: Overview, inbox: Inbox, map: MapRoom, spine: SpineRoom, board: Board, 'ask-arc': AskArc,
  engine: EngineRoom, 'model-policy': ModelPolicy, policy: Policy, scheduler: Scheduler, memory: Memory, evolve: Evolve, bench: Bench, absorb: Absorb,
  council: Council, develop: Develop, 'review-ship': ReviewShip, 'design-studio': DesignStudio, toolbelt: Toolbelt, factory: Factory, executor: Executor, agents: Agents,
  money: Money, growth: Growth, leads: Leads, legal: Legal, ventures: Ventures, ops: Ops, trader: Trader, discover: Discover,
  law: Law, learn: Learn, strategy: Strategy, org: Org, concepts: Concepts, story: Story,
}

// the five rings, in arc's read order — command first is not
// alphabetical, it is the daily surface
export const RINGS = RING_ORDER.map((ring) => ({ ring, rooms: ROOM_META.filter((r) => r.ring === ring).map((r) => ({ ...r, C: VIEW[r.id] })) }))
export const ROOMS = RINGS.flatMap((r) => r.rooms)

const SPEEDS = [
  { v: 1, label: '1×' },
  { v: 10, label: '10×' },
  { v: 60, label: '60×' },
]

const RAIL_W = 240
const HEAD_H = 56

// a small status chip in the top bar
function BarChip({ children, onClick, title, tone, strong = false, className = '' }) {
  const c = tone === 'amber' ? COLOR.amber : tone === 'green' ? COLOR.green : tone === 'violet' ? COLOR.violet : tone === 'cyan' ? COLOR.cyan : null
  const style = strong
    ? { background: c, color: 'var(--on-fill)', border: '1px solid transparent', fontWeight: 600 }
    : { background: 'transparent', color: 'var(--text-2)', border: '1px solid var(--line-2)', fontWeight: 500 }
  const Tag = onClick ? 'button' : 'span'
  return (
    <Tag
      onClick={onClick}
      title={title}
      type={onClick ? 'button' : undefined}
      className={`inline-flex items-center gap-2 h-[30px] px-3 text-[12px] whitespace-nowrap ${onClick ? 'cursor-pointer hover:bg-(--bg-3)' : ''} transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-(--accent) ${className}`}
      style={{ fontFamily: UI, borderRadius: 'var(--r-md)', letterSpacing: '-0.005em', ...style }}
    >
      {children}
    </Tag>
  )
}

export default function HQ({ onExit }) {
  useSpine()
  // #hq/<room> deep link — an alias resolves too; an unknown room falls to today
  const [room, setRoom] = useState(() => {
    const m = typeof window !== 'undefined' && /^#hq\/([a-z-]+)/.exec(window.location.hash)
    return (m && resolveRoom(m[1])) || 'overview'
  })
  useEffect(() => {
    try { window.history.replaceState(null, '', '#hq/' + room) } catch { /* fine */ }
  }, [room])
  // the workroom has BOTH moods — dark and light — as real token sets.
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem('arc-hq-theme') || 'dark' } catch { return 'dark' }
  })
  useEffect(() => {
    document.documentElement.classList.add('hq')
    return () => document.documentElement.classList.remove('hq', 'hq-light')
  }, [])
  useEffect(() => {
    document.documentElement.classList.toggle('hq-light', theme === 'light')
    try { localStorage.setItem('arc-hq-theme', theme) } catch { /* fine */ }
  }, [theme])
  useEffect(() => {
    // old ids (autonomy, portfolio, today…) resolve through the alias table — a link never 404s
    registerUI({ openRoom: (id) => { const r = resolveRoom(id); if (r) setRoom(r); return !!r } })
    uiBus.room = room
  })
  useEffect(() => {
    uiBus.room = room
  }, [room])

  const k = kpis()
  const eng = engineReady() ? loadEngine() : null
  const active = ROOMS.find((r) => r.id === room) || ROOMS[0]
  const Active = active.C
  const paused = spine.speed === 0

  return (
    <div className="relative min-h-screen" style={{ fontFamily: UI, background: 'var(--bg-0)', color: 'var(--text-1)' }}>
      {/* ── room rail — the five rings, arc's read order ── */}
      <nav aria-label="Rooms" className="fixed left-0 top-0 bottom-0 z-40 hidden lg:flex flex-col" style={{ width: RAIL_W, background: 'var(--bg-1)', borderRight: '1px solid var(--line-1)' }}>
        <div className="flex items-center gap-2 px-4 shrink-0" style={{ height: HEAD_H }}>
          <button onClick={onExit} className="flex items-center gap-2 cursor-pointer rounded-md px-1 -ml-1 h-[32px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-(--accent)" title="Back to the face">
            <span className="text-[19px] leading-none tracking-tight" style={{ fontFamily: FONT, fontWeight: 700, color: 'var(--text-1)' }}>arc</span>
            <span className="text-[10px] uppercase tracking-[0.08em] h-[18px] px-1.5 inline-flex items-center rounded" style={{ fontFamily: UI, fontWeight: 600, color: 'var(--accent)', background: 'rgba(var(--accent-rgb),0.1)' }}>HQ</span>
          </button>
        </div>

        <div className="px-3 pb-2 shrink-0">
          <button
            type="button"
            onClick={() => uiBus.openPalette && uiBus.openPalette()}
            className="w-full flex items-center gap-2 h-[34px] px-2.5 cursor-pointer transition-colors duration-200 hover:bg-(--bg-3) focus-visible:outline focus-visible:outline-2 focus-visible:outline-(--accent)"
            style={{ background: 'var(--bg-2)', border: '1px solid var(--line-2)', borderRadius: 'var(--r-md)', color: 'var(--text-3)' }}
            title="Search or paste anything"
          >
            <MagnifyingGlass size={15} aria-hidden="true" />
            <span className="text-[12.5px] flex-1 text-left truncate" style={{ fontFamily: UI }}>Search or paste</span>
            <kbd className="text-[10.5px] px-1.5 h-[18px] inline-flex items-center rounded whitespace-nowrap shrink-0" style={{ fontFamily: UI, color: 'var(--text-3)', background: 'var(--bg-4)', border: '1px solid var(--line-1)' }}>⌘K</kbd>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 pb-4 rail-scroll">
          {RINGS.map((ring) => (
            <div key={ring.ring} className="mt-3 first:mt-1">
              <div className="px-2.5 pb-1 text-[10.5px] uppercase tracking-[0.08em]" style={{ fontFamily: UI, fontWeight: 600, color: 'var(--text-3)' }}>
                {ring.ring}
              </div>
              {ring.rooms.map((r) => {
                const isActive = room === r.id
                const Icon = r.I
                return (
                  <button
                    key={r.id}
                    onClick={() => setRoom(r.id)}
                    aria-current={isActive ? 'page' : undefined}
                    title={r.sentence}
                    className="relative w-full flex items-center gap-2.5 text-left px-2.5 h-[32px] cursor-pointer transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-(--accent) hover:bg-(--bg-3)"
                    style={{ borderRadius: 'var(--r-md)', background: isActive ? 'var(--bg-4)' : 'transparent', transitionTimingFunction: EASE }}
                  >
                    <Icon size={16} weight={isActive ? 'fill' : 'regular'} color={isActive ? 'var(--accent)' : r.planned ? 'var(--text-3)' : 'var(--text-2)'} aria-hidden="true" />
                    <span className="text-[13px] truncate" style={{ fontFamily: UI, fontWeight: isActive ? 600 : 500, color: isActive ? 'var(--text-1)' : r.planned ? 'var(--text-3)' : 'var(--text-2)' }}>{r.name}</span>
                    {r.planned && <span className="ml-auto text-[9.5px] uppercase tracking-[0.06em]" style={{ fontFamily: UI, fontWeight: 600, color: 'var(--text-3)' }}>planned</span>}
                  </button>
                )
              })}
            </div>
          ))}
        </div>

        <div className="shrink-0 px-4 py-3 text-[11px] leading-[17px]" style={{ fontFamily: UI, color: 'var(--text-3)', borderTop: '1px solid var(--line-1)' }}>
          <div className="flex justify-between gap-2"><span className="truncate">{ROOMS.length} rooms · 5 rings</span><span className="shrink-0" style={{ fontFamily: MONO }}>v0.7</span></div>
          <div className="mt-0.5">Inbox keys: j k a r</div>
        </div>
      </nav>

      {/* ── top bar ── */}
      <header className="fixed top-0 right-0 left-0 lg:left-[240px] z-40" style={{ background: 'color-mix(in srgb, var(--bg-1) 88%, transparent)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', borderBottom: '1px solid var(--line-1)' }}>
        <div className="flex items-center justify-between gap-3 px-4 sm:px-6" style={{ height: HEAD_H }}>
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={onExit} className="lg:hidden flex items-center gap-2 cursor-pointer h-[32px]" title="Back to the face">
              <span className="text-[18px] leading-none tracking-tight" style={{ fontFamily: FONT, fontWeight: 700, color: 'var(--text-1)' }}>arc</span>
              <span className="text-[10px] uppercase tracking-[0.08em] h-[18px] px-1.5 inline-flex items-center rounded" style={{ fontFamily: UI, fontWeight: 600, color: 'var(--accent)', background: 'rgba(var(--accent-rgb),0.1)' }}>HQ</span>
            </button>
            <span className="hidden lg:flex items-baseline gap-2 min-w-0">
              <span className="text-[13.5px] truncate" style={{ fontFamily: UI, fontWeight: 600, color: 'var(--text-1)' }}>{active.name}</span>
              <span className="text-[12px] truncate" style={{ fontFamily: UI, color: 'var(--text-3)' }}>{active.ring}</span>
            </span>
            <span className="hidden md:block w-px h-4" style={{ background: 'var(--line-2)' }} />
            {/* the day player: clock, day, one segmented speed control */}
            <span className="hidden md:inline-flex items-center gap-2 text-[12px] tnum" style={{ fontFamily: MONO, color: 'var(--text-2)' }}>
              <span>{clockLabel()}</span>
              <span style={{ color: 'var(--text-3)' }}>day {spine.dayIndex - 13}</span>
            </span>
            <span className="hidden sm:inline-flex items-center p-[2px] gap-[2px]" role="group" aria-label="Simulation speed" style={{ background: 'var(--bg-3)', border: '1px solid var(--line-1)', borderRadius: 'var(--r-md)' }}>
              <button
                type="button"
                onClick={() => setSpeed(paused ? 10 : 0)}
                title={paused ? 'Play the day' : 'Pause the day'}
                className="inline-flex items-center justify-center w-[26px] h-[24px] rounded-[6px] cursor-pointer transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-(--accent)"
                style={{ color: paused ? 'var(--accent)' : 'var(--text-2)', background: 'transparent' }}
              >
                {paused ? <Play size={13} weight="fill" aria-hidden="true" /> : <Pause size={13} weight="fill" aria-hidden="true" />}
              </button>
              {SPEEDS.map((s) => {
                const on = spine.speed === s.v
                return (
                  <button
                    key={s.v}
                    type="button"
                    onClick={() => setSpeed(s.v)}
                    className="min-w-[32px] h-[24px] px-2 rounded-[6px] text-[11.5px] cursor-pointer transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-(--accent)"
                    style={{ fontFamily: MONO, background: on ? 'var(--bg-2)' : 'transparent', color: on ? 'var(--text-1)' : 'var(--text-3)', fontWeight: on ? 600 : 500, boxShadow: on ? '0 0 0 1px var(--line-2)' : 'none' }}
                  >
                    {s.label}
                  </button>
                )
              })}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden lg:block">
              <BarChip title={spine.source === 'real' ? 'Reading your real spine' : 'A simulated day, real vocabulary'}>
                <span aria-hidden="true" className="inline-block w-[6px] h-[6px] rounded-full" style={{ background: spine.source === 'real' ? COLOR.green : COLOR.violet }} />
                {spine.source === 'real' ? 'Real spine' : 'Simulated'}
              </BarChip>
            </span>
            <BarChip onClick={() => setRoom('inbox')} tone="amber" strong={!!k.pending} title="Open the inbox">
              <Tray size={14} weight={k.pending ? 'fill' : 'regular'} aria-hidden="true" />
              {k.pending ? `${k.pending} waiting · ~${k.minutesNeeded} min` : 'Inbox zero'}
            </BarChip>
            <span className="hidden md:block">
              <BarChip onClick={() => setRoom('engine')} title="Engine room: brain settings">
                <StatusDot state={eng ? 'live' : 'sleeping'} size={6} />
                {eng ? `Brain: ${eng.provider}` : 'Brain offline'}
              </BarChip>
            </span>
            <button
              type="button"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              title={theme === 'dark' ? 'Switch to light' : 'Switch to dark'}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              className="inline-flex items-center justify-center w-[30px] h-[30px] cursor-pointer transition-colors duration-200 hover:bg-(--bg-3) focus-visible:outline focus-visible:outline-2 focus-visible:outline-(--accent)"
              style={{ border: '1px solid var(--line-2)', borderRadius: 'var(--r-md)', color: 'var(--text-2)' }}
            >
              {theme === 'dark' ? <SunDim size={16} aria-hidden="true" /> : <MoonStars size={16} aria-hidden="true" />}
            </button>
          </div>
        </div>
      </header>

      {/* mobile room switcher */}
      <div className="lg:hidden fixed left-0 right-0 z-40 overflow-x-auto px-3 py-2 flex gap-1.5" style={{ top: HEAD_H, background: 'var(--bg-1)', borderBottom: '1px solid var(--line-1)', fontFamily: UI }}>
        {ROOMS.map((r) => {
          const on = room === r.id
          return (
            <button key={r.id} onClick={() => setRoom(r.id)} className="shrink-0 text-[12px] h-[28px] px-3 cursor-pointer" style={{ borderRadius: 'var(--r-md)', color: on ? 'var(--text-1)' : 'var(--text-2)', background: on ? 'var(--bg-4)' : 'transparent', border: '1px solid ' + (on ? 'var(--line-2)' : 'var(--line-1)'), fontWeight: on ? 600 : 500 }}>
              {r.name}
            </button>
          )
        })}
      </div>

      {/* ── room content ── */}
      {/* no z-index here on purpose: a room's drawers (z-50, fixed) must stack above the rail and header (z-40) */}
      <main className="relative pt-[104px] lg:pt-[80px] lg:pl-[240px] pb-40 overflow-x-clip">
        <div className="px-4 sm:px-6 lg:px-8 max-w-[1440px] min-w-0">
          {/* keyed on the room so every switch replays the entry */}
          <div key={room} className="room-enter">
            <Active />
          </div>
        </div>
      </main>
    </div>
  )
}
