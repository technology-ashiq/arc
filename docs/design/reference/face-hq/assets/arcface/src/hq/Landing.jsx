// The front page. Cloudflare grammar: message left, the living system
// right (the face sits where they put the globe), then the whole product
// story in sections. The face exists ONLY here. Every number shown is a
// repo receipt; live panels render the actual running spine.
import { useEffect, useRef, useState } from 'react'
import { subscribe } from '../lib/voice.js'
import { FONT, BODY, MONO, COLOR, EASE, Reveal } from '../ui/kit.jsx'
import { uiBus } from '../lib/uiBus.js'
import { setStage } from '../lib/stage.js'
import { spine } from '../spine/store.js'
import { clockLabel, briefLines } from '../spine/derive.js'
import { familyOf, hhmm } from '../spine/kinds.js'
import { useSpine } from './useSpine.js'
import { ARC } from '../data/arcKnowledge.js'

// the landing keeps the ORIGINAL neon identity — the calm palette is the dashboard's
const NEON = '#00ffd1'

const enter = (room) => {
  uiBus.enterHQ()
  if (room) setTimeout(() => uiBus.openRoom(room), 90)
}

/* ── primitives ─────────────────────────────────────────────── */

function PillBtn({ children, onClick, ghost = false, big = false }) {
  return (
    <button
      onClick={onClick}
      className={`group inline-flex items-center gap-3 rounded-full cursor-pointer transition-all duration-500 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00ffd1] ${big ? 'pl-7 pr-2 min-h-[56px] text-[13px]' : 'pl-5 pr-1.5 min-h-[44px] text-[11.5px]'}`}
      style={{
        fontFamily: MONO,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        transitionTimingFunction: EASE,
        ...(ghost
          ? { color: 'rgba(255,255,255,0.82)', border: '1px solid rgba(255,255,255,0.18)', background: 'rgba(255,255,255,0.03)' }
          : { color: '#031311', background: NEON, border: '1px solid ' + NEON, fontWeight: 700 }),
      }}
    >
      {children}
      <span
        aria-hidden="true"
        className={`flex items-center justify-center rounded-full transition-transform duration-500 group-hover:translate-x-[2px] group-hover:-translate-y-[1px] ${big ? 'w-10 h-10' : 'w-8 h-8'}`}
        style={{ background: ghost ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.16)', transitionTimingFunction: EASE }}
      >
        ↗
      </span>
    </button>
  )
}

function SectionLink({ children, room }) {
  return (
    <button
      onClick={() => enter(room)}
      className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] cursor-pointer transition-colors hover:text-white"
      style={{ fontFamily: MONO, color: NEON }}
    >
      {children} <span aria-hidden="true">↗</span>
    </button>
  )
}

function H2({ children }) {
  return (
    <h2 className="text-[30px] sm:text-[42px] lg:text-[50px] leading-[1.04] tracking-tight text-white max-w-[22ch]" style={{ fontFamily: FONT, fontWeight: 600 }}>
      {children}
    </h2>
  )
}

function Sub({ children, className = '' }) {
  return (
    <p className={`text-[15px] leading-[26px] max-w-[52ch] ${className}`} style={{ fontFamily: BODY, fontWeight: 300, color: 'rgba(255,255,255,0.62)' }}>
      {children}
    </p>
  )
}

/* the live tape row, slim form for the front page */
function Tick({ e }) {
  const fam = familyOf(e.kind)
  return (
    <div className="flex items-baseline gap-3 py-[7px] border-b border-white/[0.06] last:border-0 min-w-0">
      <span className="text-[10px] shrink-0 tabular-nums" style={{ fontFamily: MONO, color: 'rgba(255,255,255,0.38)' }}>{hhmm(e.t)}</span>
      <span aria-hidden="true" className="w-[6px] h-[6px] rounded-full shrink-0 translate-y-[-1px]" style={{ background: fam.color }} />
      <span className="text-[11px] shrink-0 hidden sm:inline" style={{ fontFamily: MONO, color: fam.color }}>{e.kind}</span>
      <span className="text-[12px] leading-[18px] truncate" style={{ fontFamily: BODY, fontWeight: 300, color: 'rgba(255,255,255,0.72)' }}>{e.text}</span>
    </div>
  )
}

function NonRealChip({ children = 'simulated · labeled' }) {
  return (
    <span
      className="inline-flex items-center text-[8.5px] uppercase tracking-[0.18em] px-2.5 py-[4px] rounded-full border shrink-0"
      style={{
        fontFamily: MONO,
        color: COLOR.violet,
        borderColor: 'rgba(169,154,230,0.35)',
        background: 'repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(169,154,230,0.08) 4px, rgba(169,154,230,0.08) 8px)',
      }}
    >
      {children}
    </span>
  )
}

/* ── page ───────────────────────────────────────────────────── */

const MODULES = [
  { id: 'core', blurb: 'The deterministic foundation. Guards, gates, state snapshots and the registry every other module stands on.', status: 'live since cycle 1' },
  { id: 'plan', blurb: 'Kickoff turns a one-line goal into a committed plan. Attack agents try to break it before any code exists.', status: 'live since cycle 1' },
  { id: 'review', blurb: 'Scanner-armed, four-pass code review. A second model can block a ship on critical disagreement.', status: 'live since cycle 1' },
  { id: 'qa', blurb: 'Quality where users live: a real browser. Every bug fix carries a mandatory regression test.', status: 'live since cycle 1' },
  { id: 'git', blurb: 'Shipping discipline. The deploy guard re-runs the tests, so red code physically cannot ship.', status: 'live since cycle 1' },
  { id: 'design', blurb: 'A read-only critic that judges rendered UI against a declared brief and files receipts.', status: 'building · cycle 3', tint: true },
]

const LOOP = [
  { name: 'Challenge', line: 'A fuzzy idea meets six forcing questions. A hard fork goes to the council. Nothing skips to code.' },
  { name: 'Kickoff', line: 'Appetite sets the tier, forks become recorded decisions, phases are ordered by risk.' },
  { name: 'Build', line: 'Smallest working slice, tests, live demo, verify in the real place. Every loop, every phase.' },
  { name: 'Gates', line: 'Review, audit, browser QA, design critique. Each stamps a ledger keyed to the commit.' },
  { name: 'Receipt', line: 'Every step lands on the spine. The day closes replayable, greppable, forever.' },
]

export default function Landing() {
  useSpine()
  const [convo, setConvo] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const heroRef = useRef(null)
  const topSentinel = useRef(null)
  useEffect(() => subscribe((v) => setConvo(!!(v.started && (v.state !== 'idle' || v.reply || v.transcript)))), [])

  // nav turns to glass once the page moves (sentinel, not a scroll listener)
  useEffect(() => {
    const el = topSentinel.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => setScrolled(!e.isIntersecting))
    io.observe(el)
    return () => io.disconnect()
  }, [])

  // the face alone owns the hero — centered, full presence, exactly the
  // original stage. Scrolling into the story recesses it.
  useEffect(() => {
    let heroVisible = true
    const apply = () => setStage({ shiftX: 0, presence: heroVisible ? 1 : 0.25 })
    apply()
    const hero = heroRef.current
    let io
    if (hero) {
      io = new IntersectionObserver(
        ([e]) => {
          heroVisible = e.intersectionRatio > 0.25
          apply()
        },
        { threshold: [0, 0.25, 0.6] },
      )
      io.observe(hero)
    }
    return () => {
      if (io) io.disconnect()
      setStage({ shiftX: 0, presence: 1 })
    }
  }, [])

  // last receipts across ALL days, so the tape is full from first paint
  const ticks = spine.events.slice(-9)
  const brief = briefLines()
  const councilSeats = ARC.agents.filter((a) => a.group === 'council').map((a) => a.name.replace('council-', ''))

  return (
    <div style={{ fontFamily: BODY }}>
      <div ref={topSentinel} aria-hidden="true" className="absolute top-0 h-2 w-px" />

      {/* ── nav ── */}
      <header
        className="fixed top-0 left-0 right-0 z-40 transition-all duration-500"
        style={{
          transitionTimingFunction: EASE,
          background: scrolled ? 'rgba(13,17,20,0.82)' : 'transparent',
          backdropFilter: scrolled ? 'blur(14px)' : 'none',
          WebkitBackdropFilter: scrolled ? 'blur(14px)' : 'none',
          borderBottom: scrolled ? '1px solid rgba(255,255,255,0.07)' : '1px solid transparent',
          opacity: convo ? 0.06 : 1,
        }}
      >
        <div className="flex items-center justify-between gap-6 px-5 sm:px-8 h-[68px] max-w-[1360px] mx-auto">
          <a href="#top" className="flex items-baseline gap-2 shrink-0 cursor-pointer">
            <span className="text-[22px] tracking-tight text-white leading-none" style={{ fontFamily: FONT, fontWeight: 600 }}>arc</span>
            <span className="text-[9.5px] uppercase tracking-[0.3em]" style={{ fontFamily: MONO, color: NEON }}>os</span>
          </a>
          <nav className="hidden md:flex items-center gap-1" style={{ fontFamily: MONO }}>
            {[
              ['platform', '#platform'],
              ['how it works', '#loop'],
              ['the spine', '#spine'],
              ['ventures', '#ventures'],
            ].map(([label, href]) => (
              <a key={href} href={href} className="min-h-[38px] inline-flex items-center rounded-full px-3.5 text-[10.5px] uppercase tracking-[0.14em] text-white/58 hover:text-white transition-colors duration-300">
                {label}
              </a>
            ))}
          </nav>
          <PillBtn onClick={() => enter()}>enter hq</PillBtn>
        </div>
      </header>

      {/* ── hero: the face alone. Nav carries ENTER HQ; the dock carries the voice. ── */}
      <section id="top" ref={heroRef} className="relative min-h-[100dvh] overflow-hidden" aria-label="arc — the face" />


      {/* everything below sits on solid ground; the face stays behind the hero */}
      <div className="relative z-10" style={{ background: '#0b0e11' }}>
        {/* ── stats band: every number is a repo receipt ── */}
        <section className="border-y border-white/[0.07]">
          <div className="max-w-[1360px] mx-auto px-5 sm:px-8 py-14 grid grid-cols-2 md:grid-cols-5 gap-x-6 gap-y-10">
            {[
              ['8', 'modules run the factory'],
              ['46', 'event kinds, a closed set'],
              ['24', 'agents on the roster'],
              ['389', 'tests, three-OS CI'],
            ].map(([n, l], i) => (
              <Reveal key={l} delay={i * 60}>
                <div>
                  <div className="text-[40px] sm:text-[52px] leading-none tracking-tight text-white tabular-nums" style={{ fontFamily: FONT, fontWeight: 600 }}>{n}</div>
                  <div className="mt-2.5 text-[11px] leading-[16px] text-white/45" style={{ fontFamily: BODY }}>{l}</div>
                </div>
              </Reveal>
            ))}
            <Reveal delay={260}>
              <div className="col-span-2 md:col-span-1">
                <div className="text-[40px] sm:text-[52px] leading-none tracking-tight tabular-nums" style={{ fontFamily: FONT, fontWeight: 600, color: COLOR.green }}>₹0</div>
                <div className="mt-2.5 text-[11px] leading-[16px] text-white/45" style={{ fontFamily: BODY }}>real revenue so far. The dashboard says so itself.</div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ── platform bento: the eight modules ── */}
        <section id="platform" className="max-w-[1360px] mx-auto px-5 sm:px-8 py-28 sm:py-36">
          <Reveal>
            <H2>Eight modules run the factory.</H2>
          </Reveal>
          <Reveal delay={80}>
            <Sub className="mt-5 mb-14">Each one installable, each one earned its place by running arc's own days first.</Sub>
          </Reveal>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* hq, featured: the spine with a real brief preview */}
            <Reveal className="lg:col-span-7">
              <div className="h-full rounded-2xl border border-white/[0.09] p-7 sm:p-9 relative overflow-hidden" style={{ background: 'radial-gradient(120% 90% at 0% 0%, rgba(0,255,209,0.06), transparent 55%), #12181c' }}>
                <div className="flex items-baseline justify-between gap-4 mb-3">
                  <h3 className="text-[24px] tracking-tight text-white" style={{ fontFamily: FONT, fontWeight: 600 }}>hq</h3>
                  <span className="text-[9.5px] uppercase tracking-[0.18em]" style={{ fontFamily: MONO, color: COLOR.green }}>live · dogfooding daily</span>
                </div>
                <p className="text-[13.5px] leading-[22px] text-white/62 max-w-[48ch] mb-7" style={{ fontWeight: 300 }}>
                  The receipt spine: the company's append-only memory and its only public API. On top of it, a morning brief that fits the whole day in one screen.
                </p>
                <div className="rounded-xl border border-white/[0.08] p-4" style={{ background: 'rgba(0,0,0,0.4)' }}>
                  <div className="flex items-center justify-between mb-2.5">
                    <span className="text-[9.5px] uppercase tracking-[0.2em] text-white/40" style={{ fontFamily: MONO }}>arc brief, rendering live</span>
                    <NonRealChip />
                  </div>
                  {brief.lines.slice(0, 3).map((l) => (
                    <div key={l.tag} className="flex gap-3 items-baseline py-[5px]" style={{ fontFamily: MONO }}>
                      <span className="w-[86px] shrink-0 text-[9.5px] uppercase tracking-[0.1em]" style={{ color: l.tone === 'amber' ? COLOR.amber : l.tone === 'green' ? COLOR.green : NEON }}>{l.tag}</span>
                      <span className="text-[11px] leading-[17px] text-white/70 truncate" style={{ fontFamily: BODY, fontWeight: 300 }}>{l.text}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-6">
                  <SectionLink room="spine">open the spine</SectionLink>
                </div>
              </div>
            </Reveal>

            {/* council, featured */}
            <Reveal delay={90} className="lg:col-span-5">
              <div className="h-full rounded-2xl border border-white/[0.09] p-7 sm:p-9" style={{ background: '#12181c' }}>
                <div className="flex items-baseline justify-between gap-4 mb-3">
                  <h3 className="text-[24px] tracking-tight text-white" style={{ fontFamily: FONT, fontWeight: 600 }}>council</h3>
                  <span className="text-[9.5px] uppercase tracking-[0.18em] text-white/40" style={{ fontFamily: MONO }}>12 seats</span>
                </div>
                <p className="text-[13.5px] leading-[22px] text-white/62 mb-7" style={{ fontWeight: 300 }}>
                  Blind parallel debate for hard decisions. A verifier grades every point; verdicts commit with confidence and dissent, then get scored against reality.
                </p>
                <div className="flex flex-wrap gap-1.5 mb-7">
                  {councilSeats.map((s) => (
                    <span key={s} className="text-[9.5px] text-white/55 border border-white/[0.1] rounded-full px-2.5 py-[4px]" style={{ fontFamily: MONO }}>{s}</span>
                  ))}
                </div>
                <SectionLink room="council">convene the council</SectionLink>
              </div>
            </Reveal>

            {/* six compact cells */}
            {MODULES.map((m, i) => (
              <Reveal key={m.id} delay={i * 50} className="lg:col-span-4">
                <div
                  className="h-full rounded-2xl border border-white/[0.08] p-6 sm:p-7 transition-colors duration-500 hover:border-white/[0.16]"
                  style={{
                    transitionTimingFunction: EASE,
                    background: m.tint ? 'radial-gradient(110% 100% at 100% 0%, rgba(255,255,255,0.045), transparent 55%), #12181c' : '#12181c',
                  }}
                >
                  <div className="flex items-baseline justify-between gap-3 mb-2.5">
                    <h3 className="text-[18px] tracking-tight text-white" style={{ fontFamily: FONT, fontWeight: 600 }}>{m.id}</h3>
                    <span className="text-[9px] uppercase tracking-[0.14em] text-white/38" style={{ fontFamily: MONO }}>{m.status}</span>
                  </div>
                  <p className="text-[12.5px] leading-[20px] text-white/58" style={{ fontWeight: 300 }}>{m.blurb}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ── how it works: the golden loop ── */}
        <section id="loop" className="border-t border-white/[0.07]">
          <div className="max-w-[1360px] mx-auto px-5 sm:px-8 py-28 sm:py-36">
            <Reveal>
              <H2>An idea becomes revenue, with a receipt at every step.</H2>
            </Reveal>
            <div className="mt-16 grid grid-cols-1 md:grid-cols-5 gap-y-10 md:gap-x-0 relative">
              <div aria-hidden="true" className="hidden md:block absolute top-[7px] left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
              {LOOP.map((s, i) => (
                <Reveal key={s.name} delay={i * 90}>
                  <div className="md:pr-8 relative">
                    <span aria-hidden="true" className="hidden md:block w-[14px] h-[14px] rounded-full border-2 mb-6" style={{ borderColor: NEON, background: '#0b0e11' }} />
                    <div className="text-[16px] text-white mb-2 tracking-tight" style={{ fontFamily: FONT, fontWeight: 600 }}>{s.name}</div>
                    <p className="text-[12.5px] leading-[20px] text-white/55" style={{ fontWeight: 300 }}>{s.line}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ── the spine, live ── */}
        <section id="spine" className="border-t border-white/[0.07]">
          <div className="max-w-[1360px] mx-auto px-5 sm:px-8 py-28 sm:py-36 grid grid-cols-1 lg:grid-cols-2 gap-14 items-center">
            <div>
              <Reveal>
                <span className="inline-flex items-center gap-2.5 rounded-full px-3.5 py-[7px] mb-6 text-[10px] uppercase tracking-[0.22em] border border-white/[0.12] text-white/60" style={{ fontFamily: MONO }}>
                  <span aria-hidden="true" className="w-[6px] h-[6px] rounded-full" style={{ background: NEON, boxShadow: `0 0 8px ${NEON}` }} />
                  live from the spine
                </span>
              </Reveal>
              <Reveal delay={60}>
                <H2>If it isn't an event, it didn't happen.</H2>
              </Reveal>
              <Reveal delay={120}>
                <Sub className="mt-5 mb-8">
                  Every action appends to a closed, replayable log. This feed is the actual app running behind this page, not a mockup.
                </Sub>
              </Reveal>
              <Reveal delay={160}>
                <SectionLink room="spine">open the full log</SectionLink>
              </Reveal>
            </div>
            <Reveal delay={100}>
              <div className="rounded-2xl border border-white/[0.09] overflow-hidden" style={{ background: '#12181c' }}>
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.07]">
                  <span className="text-[10.5px] tabular-nums text-white/55" style={{ fontFamily: MONO }}>{clockLabel()} · sim day {spine.dayIndex - 13}</span>
                  <NonRealChip>simulated day · real vocabulary</NonRealChip>
                </div>
                <div className="px-5 py-3">
                  {ticks.length === 0 && (
                    <div className="py-8 text-center text-[12px] text-white/40" style={{ fontWeight: 300 }}>The day is about to start. Events will stream in here.</div>
                  )}
                  {ticks.map((e) => (
                    <Tick key={e.id} e={e} />
                  ))}
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ── the inbox: the one write path ── */}
        <section className="border-t border-white/[0.07]">
          <div className="max-w-[1360px] mx-auto px-5 sm:px-8 py-28 sm:py-36 grid grid-cols-1 lg:grid-cols-2 gap-14 items-center">
            <Reveal className="order-2 lg:order-1">
              <button onClick={() => enter('overview')} className="block w-full text-left rounded-2xl border border-white/[0.09] p-6 sm:p-7 cursor-pointer transition-all duration-500 hover:border-[#00ffd1]/35" style={{ background: '#12181c', transitionTimingFunction: EASE }} title="open the inbox in HQ">
                <div className="flex items-baseline justify-between gap-3 flex-wrap mb-3">
                  <b className="text-[14px] text-white/94" style={{ fontFamily: BODY, fontWeight: 600 }}>Kickoff: venture #2 candidate, GST-Recon</b>
                  <span className="text-[9px] uppercase tracking-[0.14em] text-white/45" style={{ fontFamily: MONO }}>build · L1</span>
                </div>
                <div className="space-y-[5px] mb-5 text-[11px]" style={{ fontFamily: MONO }}>
                  <div style={{ color: 'rgba(0,255,209,0.75)' }}>» council: PROCEED 8.1/10, market 9, risk 6</div>
                  <div style={{ color: COLOR.green }}>» money: ₹0 at stake, appetite two weeks</div>
                  <div style={{ color: COLOR.red }}>» kill: drafted, 60 days or zero paying users</div>
                </div>
                <div className="flex gap-2 flex-wrap" style={{ fontFamily: MONO }}>
                  <span className="rounded-lg px-4 py-2.5 text-[10.5px] uppercase tracking-[0.1em]" style={{ background: COLOR.green, color: '#03130a', fontWeight: 700 }}>approve kickoff</span>
                  <span className="rounded-lg px-4 py-2.5 text-[10.5px] uppercase tracking-[0.1em] border border-white/20 text-white/75">send back with notes</span>
                </div>
                <div className="mt-4 text-[10px] text-white/38" style={{ fontFamily: MONO }}>j/k move · a approves · r rejects · every reason becomes calibration data</div>
              </button>
            </Reveal>
            <div className="order-1 lg:order-2">
              <Reveal>
                <H2>A machine may raise it. Only you may decide it.</H2>
              </Reveal>
              <Reveal delay={80}>
                <Sub className="mt-5 mb-8">
                  The inbox is the one write path. Three facts on every card, a typed reason on every decision. Nine minutes a day; the rest is the machine's.
                </Sub>
              </Reveal>
              <Reveal delay={140}>
                <SectionLink room="overview">open the inbox</SectionLink>
              </Reveal>
            </div>
          </div>
        </section>

        {/* ── constitution ── */}
        <section className="border-t border-white/[0.07]" style={{ background: '#0e1215' }}>
          <div className="max-w-[1360px] mx-auto px-5 sm:px-8 py-28 sm:py-36">
            <Reveal>
              <H2>Three laws outrank every plan, every model, every line of code.</H2>
            </Reveal>
            <div className="mt-14 grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                ['E1', 'The Receipts Law', 'Every action that matters emits an event. Append-only, corrections supersede. A claim without a receipt is an opinion.'],
                ['E2', 'Human Sovereignty', 'Money, kills, pricing and the owner’s name belong to the human alone. No level of proven autonomy ever includes them.'],
                ['E3', 'The Truth Law', 'Simulated is always labeled simulated. Untested is never reported as tested. A failing result never wears a passing one’s clothes.'],
              ].map(([id, name, body], i) => (
                <Reveal key={id} delay={i * 90}>
                  <div className="h-full rounded-2xl border border-white/[0.08] p-7" style={{ background: '#12181c' }}>
                    <div className="text-[11px] mb-4" style={{ fontFamily: MONO, color: NEON }}>{id}</div>
                    <div className="text-[17px] text-white mb-3 tracking-tight" style={{ fontFamily: FONT, fontWeight: 600 }}>{name}</div>
                    <p className="text-[12.5px] leading-[21px] text-white/58" style={{ fontWeight: 300 }}>{body}</p>
                  </div>
                </Reveal>
              ))}
            </div>
            <Reveal delay={200}>
              <p className="mt-8 text-[11.5px] text-white/40" style={{ fontFamily: MONO }}>Tier E is unamendable. A fork that changes it is a different company.</p>
            </Reveal>
          </div>
        </section>

        {/* ── ventures ── */}
        <section id="ventures" className="border-t border-white/[0.07]">
          <div className="max-w-[1360px] mx-auto px-5 sm:px-8 py-28 sm:py-36">
            <Reveal>
              <H2>The factory is not the product.</H2>
            </Reveal>
            <Reveal delay={80}>
              <Sub className="mt-5 mb-14">Ventures live in their own repos, with their own money and their own kill criteria, arc installed inside.</Sub>
            </Reveal>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              <Reveal className="lg:col-span-6">
                <div className="h-full rounded-2xl border border-white/[0.09] p-7 sm:p-9" style={{ background: 'radial-gradient(110% 90% at 100% 100%, rgba(74,222,128,0.05), transparent 55%), #12181c' }}>
                  <div className="flex items-baseline justify-between gap-4 mb-3">
                    <h3 className="text-[24px] tracking-tight text-white" style={{ fontFamily: FONT, fontWeight: 600 }}>LexOS</h3>
                    <span className="text-[9.5px] uppercase tracking-[0.18em]" style={{ fontFamily: MONO, color: COLOR.green }}>venture #1 · live</span>
                  </div>
                  <p className="text-[13.5px] leading-[22px] text-white/62 max-w-[52ch] mb-6" style={{ fontWeight: 300 }}>
                    Legal practice management for India. Clients, cases, hearing reminders on WhatsApp, Razorpay invoicing, a no-login client portal. It replaces WhatsApp plus Excel.
                  </p>
                  <div className="flex flex-wrap gap-2" style={{ fontFamily: MONO }}>
                    {['RLS on 10/10 tables', '163 tests green', 'p95 267 ms'].map((r) => (
                      <span key={r} className="text-[10px] text-white/60 border border-white/[0.12] rounded-lg px-2.5 py-[5px]">⌗ {r}</span>
                    ))}
                  </div>
                  <p className="mt-6 text-[11.5px] leading-[18px]" style={{ fontFamily: MONO, color: COLOR.amber }}>
                    First real rupee: targeted September 2026. Until then its revenue renders as simulated, in violet, hatched.
                  </p>
                </div>
              </Reveal>
              <Reveal delay={90} className="lg:col-span-3">
                <div className="h-full rounded-2xl border border-white/[0.08] p-7" style={{ background: '#12181c' }}>
                  <h3 className="text-[17px] tracking-tight text-white mb-2" style={{ fontFamily: FONT, fontWeight: 600 }}>venturemind</h3>
                  <p className="text-[12px] leading-[19px] text-white/55" style={{ fontWeight: 300 }}>An earlier product repo, now an arc consumer. The upgrade-path dogfood target.</p>
                </div>
              </Reveal>
              <Reveal delay={140} className="lg:col-span-3">
                <div className="h-full rounded-2xl border border-white/[0.08] p-7" style={{ background: '#12181c' }}>
                  <h3 className="text-[17px] tracking-tight text-white mb-2" style={{ fontFamily: FONT, fontWeight: 600 }}>Opportunity-Scout</h3>
                  <p className="text-[12px] leading-[19px] text-white/55" style={{ fontWeight: 300 }}>Pain-mining scout and fresh-install dogfood. The seed of the discover module.</p>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* ── final call ── */}
        <section className="border-t border-white/[0.07]">
          <div className="max-w-[1360px] mx-auto px-5 sm:px-8 py-32 sm:py-44 text-center">
            <Reveal>
              <h2 className="text-[36px] sm:text-[54px] leading-[1.02] tracking-tight text-white mb-6" style={{ fontFamily: FONT, fontWeight: 600 }}>
                The company is already running.
              </h2>
            </Reveal>
            <Reveal delay={80}>
              <p className="text-[15px] leading-[26px] text-white/60 max-w-[46ch] mx-auto mb-10" style={{ fontWeight: 300 }}>
                Walk into the HQ: add models to the bench, hire contractors, absorb skills, convene the council. Everything you do persists.
              </p>
            </Reveal>
            <Reveal delay={140}>
              <div className="flex justify-center">
                <PillBtn big onClick={() => enter()}>enter hq</PillBtn>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ── footer ── */}
        <footer className="border-t border-white/[0.07]" style={{ background: '#0e1215' }}>
          <div className="max-w-[1360px] mx-auto px-5 sm:px-8 py-16 grid grid-cols-2 md:grid-cols-5 gap-10">
            <div className="col-span-2">
              <div className="flex items-baseline gap-2 mb-4">
                <span className="text-[20px] tracking-tight text-white" style={{ fontFamily: FONT, fontWeight: 600 }}>arc</span>
                <span className="text-[9px] uppercase tracking-[0.3em]" style={{ fontFamily: MONO, color: NEON }}>os</span>
              </div>
              <p className="text-[12px] leading-[19px] text-white/45 max-w-[36ch]" style={{ fontWeight: 300 }}>
                A receipt-driven company operating system, built and owned by Ashiq. Simulated data is labeled. Your workspace stays in this browser.
              </p>
            </div>
            {[
              ['command', [['today', 'overview'], ['the spine', 'spine'], ['the inbox', 'overview']]],
              ['kernel + factory', [['bench', 'bench'], ['absorb', 'absorb'], ['executor', 'executor'], ['council', 'council'], ['design studio', 'design-studio']]],
              ['money + company', [['money', 'money'], ['leads', 'leads'], ['growth', 'growth'], ['the law', 'law'], ['story', 'story']]],
            ].map(([group, links]) => (
              <div key={group}>
                <div className="text-[9.5px] uppercase tracking-[0.22em] text-white/35 mb-4" style={{ fontFamily: MONO }}>{group}</div>
                <div className="flex flex-col gap-2.5">
                  {links.map(([label, room]) => (
                    <button key={label} onClick={() => enter(room)} className="text-left text-[12px] text-white/58 hover:text-white transition-colors cursor-pointer" style={{ fontWeight: 300 }}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="border-t border-white/[0.06]">
            <div className="max-w-[1360px] mx-auto px-5 sm:px-8 py-6 flex flex-wrap items-center justify-between gap-3">
              <span className="text-[10px] text-white/35" style={{ fontFamily: MONO }}>real revenue ₹0. It says so, because that is the brand.</span>
              <span className="text-[10px] text-white/35" style={{ fontFamily: MONO }}>Ctrl+K anywhere: paste a model, a hire, a skill, a question</span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  )
}
