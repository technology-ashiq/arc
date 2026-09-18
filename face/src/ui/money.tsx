// money.tsx -- the money and ventures rooms' fragments, ported from the Cycle 15 renderers onto the kit (face v2
// Phase 03, money ring, ADR-1318, ADR-1320).
//
// MoneyRoom.tsx and VenturesRoom.tsx drew these with their own stylesheet; the rooms are modules now, their
// decisions are in money.mjs and money-room.mjs, and what is left is the drawing -- which is not nothing. The
// GLYPH is the argument: a measured zero is a filled numeral, a kind that has never fired is an OUTLINED, DASHED
// ring with nothing inside it, an absence is an em-dash and a figure the door did not serve says `not served`.
// The difference has to survive with the words removed, because the eye reads shape before it reads a badge.
// Real money's colour arrives only through the green gate (money.mjs moneyInk); nothing here picks a colour.
import type { ReactNode } from 'react'
import type { Figure } from '../lib/money.mjs'
import type { CostView, KillLinesView, SubstanceView } from '../lib/money-room.mjs'
import { FONT, MONO, UI } from './kit'
import { DoorRefusal, HPanel, Reading } from './bits'

/** One figure, in the shape its state earned. */
export function MoneyFigure({ figure, size = 'stat' }: { figure: Figure; size?: 'stat' | 'row' }) {
  const stat = size === 'stat'
  if (figure.glyph === 'hollow') {
    return (
      <span data-state={figure.state} title={figure.note} className="inline-flex items-center gap-2">
        <span
          aria-hidden="true"
          className={stat ? 'inline-block rounded-full shrink-0 h-[26px] w-[16px]' : 'inline-block rounded-full shrink-0 h-[15px] w-[10px]'}
          style={{ border: `${stat ? 2 : 1}px dashed ${figure.ink}` }}
        />
        <span className="uppercase tracking-[0.06em]" style={{ fontFamily: UI, fontWeight: 600, fontSize: stat ? 11 : 10.5, color: 'var(--faint)' }}>{figure.text}</span>
      </span>
    )
  }
  return (
    <span
      data-state={figure.state}
      title={figure.note}
      className={`tnum ${stat ? 'leading-[28px]' : 'leading-[18px]'}`}
      style={{
        fontFamily: stat ? FONT : MONO,
        fontWeight: stat ? 600 : 500,
        fontSize: stat ? 24 : 12.5,
        color: figure.ink,
        // The non-real family is violet AND hatched: hue alone is not enough.
        backgroundImage: figure.hatch ? 'var(--sim-hatch)' : undefined,
      }}
    >
      {figure.text}
    </span>
  )
}

/**
 * The instrument strip for money: figures that keep their glyph, and plain counts beside them. A figure is never
 * reduced to a string here, because the string of a never-fired figure is the word `never` and its shape is the
 * point.
 */
export function FigureStrip({ figures, counts }: { figures: { key: string; label: string; sub: string; figure: Figure }[]; counts: { key: string; v: string; l: string; sub: string }[] }) {
  return (
    <div className="grid grid-cols-2 xl:grid-cols-4 mb-4 overflow-hidden" style={{ background: 'var(--bg-2)', border: '1px solid var(--line-1)', borderRadius: 'var(--r-lg)', boxShadow: 'var(--shadow-card)' }}>
      {figures.map((s) => (
        <div key={s.key} data-figure={s.key} className="px-5 py-4 min-w-0" style={{ boxShadow: 'inset 1px 0 0 var(--line-1), inset 0 1px 0 var(--line-1)' }}>
          <div className="min-h-[28px] flex items-center">
            <MoneyFigure figure={s.figure} />
          </div>
          <div className="text-[12px] leading-[16px] mt-1 line-clamp-2" style={{ fontFamily: UI, color: 'var(--text-2)' }}>{s.label}</div>
          <div className="text-[11px] leading-[14px] mt-0.5 line-clamp-2" style={{ fontFamily: UI, color: 'var(--text-3)' }}>{s.sub}</div>
        </div>
      ))}
      {counts.map((s) => (
        <div key={s.key} className="px-5 py-4 min-w-0" style={{ boxShadow: 'inset 1px 0 0 var(--line-1), inset 0 1px 0 var(--line-1)' }}>
          <div className="leading-[28px] tracking-[-0.01em] truncate tnum" style={{ fontFamily: FONT, fontWeight: 600, fontSize: 24, color: 'var(--text-1)' }}>{s.v}</div>
          <div className="text-[12px] leading-[16px] mt-1 line-clamp-2" style={{ fontFamily: UI, color: 'var(--text-2)' }}>{s.l}</div>
          <div className="text-[11px] leading-[14px] mt-0.5 line-clamp-2 break-all" style={{ fontFamily: MONO, color: 'var(--text-3)' }}>{s.sub}</div>
        </div>
      ))}
    </div>
  )
}

/**
 * THE GREEN GATE, STATED: the room's thesis, above every number. It says whether the colour of real money is
 * spent or unspent, and why -- a reader who scrolls no further has the one fact that matters.
 */
export function GateStrip({ gate }: { gate: { isSpent: boolean; why: string; source: string; contradiction: string; hasContradiction: boolean } }) {
  return (
    <>
      <div
        data-green-gate={gate.isSpent ? 'spent' : 'unspent'}
        className="flex items-center gap-4 flex-wrap px-4 py-3 mb-4"
        style={{
          background: 'var(--bg-2)',
          border: '1px solid var(--line-1)',
          borderLeft: gate.isSpent ? '2px solid var(--green)' : '2px dashed var(--faint)',
          borderRadius: 'var(--r-lg)',
        }}
      >
        <span className="text-[10.5px] uppercase tracking-[0.08em] shrink-0" style={{ fontFamily: UI, fontWeight: 600, color: 'var(--text-3)' }}>real money</span>
        <p className="text-[13.5px] leading-[20px] flex-1 min-w-[280px]" style={{ fontFamily: UI, color: 'var(--text-1)' }}>{gate.why}</p>
        <span className="text-[11px] break-all" style={{ fontFamily: MONO, color: 'var(--text-3)' }} title={gate.source}>⌗ {gate.source}</span>
      </div>
      {gate.hasContradiction ? (
        <p role="status" className="px-4 py-3 mb-4 text-[12.5px] leading-[19px]" style={{ fontFamily: UI, color: 'var(--amber)', border: '1px solid var(--amber)', borderRadius: 'var(--r-md)' }}>{gate.contradiction}</p>
      ) : null}
    </>
  )
}

/**
 * One P&L, one kind, one region. The simulated one carries the hatch across the WHOLE panel rather than a badge
 * in its corner: a header scrolls off, and a screenshot of the middle of a simulated P&L must not be mistakable
 * for the real thing.
 */
export function SubstancePanel({ s }: { s: SubstanceView }) {
  return (
    <section
      data-substance={s.isSim ? 'simulated' : 'real'}
      className="mb-4 min-w-0 p-5"
      aria-label={s.title}
      style={{
        background: s.isSim ? 'var(--sim-hatch), var(--bg-2)' : 'var(--bg-2)',
        border: `1px solid ${s.isSim ? 'var(--sim-line)' : 'var(--line-1)'}`,
        borderRadius: 'var(--r-lg)',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      <div className="flex items-center justify-between gap-3 mb-2">
        <h2 className="flex items-baseline flex-wrap gap-x-2 min-w-0">
          <span className="text-[14px] leading-[20px]" style={{ fontFamily: UI, fontWeight: 600, color: s.isSim ? 'var(--sim-fg)' : 'var(--text-1)' }}>{s.title}</span>
          <span className="text-[11.5px]" style={{ fontFamily: MONO, color: 'var(--text-3)' }}>{s.kind}</span>
        </h2>
        {s.hasWatermark ? (
          <span className="text-[10.5px] uppercase tracking-[0.08em] px-2 h-[20px] inline-flex items-center rounded-full" style={{ fontFamily: MONO, color: 'var(--sim-fg)', border: '1px solid var(--sim-line)' }}>{s.watermark}</span>
        ) : null}
      </div>
      <p className="text-[12.5px] leading-[19px] mb-3 max-w-[62ch]" style={{ fontFamily: UI, color: 'var(--text-2)' }}>{s.lede}</p>
      {s.isReading ? <Reading what={s.reading} /> : null}
      {s.isRefused ? <DoorRefusal code={s.refusal.code} human={s.refusal.human} /> : null}
      {s.isDrawn ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            <FigureCell label="cash in" figure={s.cashIn} />
            <FigureCell label="MRR" figure={s.mrr} />
          </div>
          <p className="text-[12px] leading-[18px] mt-3 max-w-[62ch]" style={{ fontFamily: UI, color: 'var(--text-3)' }}>{s.scopeNote}</p>
          {s.hasComponents ? (
            <div className="flex flex-wrap gap-2 mt-3">
              {s.components.map((c) => (
                <span key={c.label} data-state={c.state} className="inline-flex items-center gap-2 px-2.5 py-1 rounded-[var(--r-sm)]" style={{ border: `1px ${c.state === 'absent' ? 'dotted' : 'solid'} var(--line-1)` }}>
                  <span className="text-[10.5px] uppercase tracking-[0.06em]" style={{ fontFamily: UI, fontWeight: 600, color: 'var(--text-3)' }}>{c.label}</span>
                  <MoneyFigure figure={c} size="row" />
                </span>
              ))}
            </div>
          ) : null}
          {s.hasVentures ? (
            <div className="mt-3" style={{ borderTop: '1px solid var(--line-1)' }}>
              {s.ventures.map((v) => (
                <div key={v.venture} className="flex items-center gap-3 flex-wrap py-2" style={{ borderBottom: '1px solid var(--line-1)' }}>
                  <span className="text-[12.5px] flex-1 min-w-0 break-all" style={{ fontFamily: MONO, color: 'var(--text-1)' }}>{v.venture}</span>
                  <MoneyFigure figure={v.cashIn} size="row" />
                  <span className="inline-flex items-center gap-1.5 text-[10.5px] uppercase tracking-[0.06em]" style={{ fontFamily: UI, color: 'var(--text-3)' }}>
                    MRR <MoneyFigure figure={v.mrr} size="row" />
                  </span>
                </div>
              ))}
            </div>
          ) : null}
          {s.hasRows ? (
            <details className="mt-3">
              <summary className="text-[11px] uppercase tracking-[0.06em] cursor-pointer" style={{ fontFamily: UI, fontWeight: 600, color: 'var(--accent)' }}>every receipt behind these figures</summary>
              <div className="mt-2">
                {s.rows.map((r) => (
                  <div key={r.id} className="flex items-baseline gap-3 flex-wrap py-1.5 text-[12px]" style={{ fontFamily: MONO, borderBottom: '1px solid var(--line-1)' }}>
                    <span className="tnum" style={{ color: 'var(--text-3)' }}>{r.ts}</span>
                    <span className="tnum" style={{ color: r.ink }}>{r.amount}</span>
                    <span style={{ color: 'var(--text-2)' }}>{r.venture}</span>
                    <span className="flex-1 min-w-0 break-all" style={{ color: 'var(--text-2)' }}>{r.payment}</span>
                    {r.hasFx ? <span className="text-[11px]" style={{ color: 'var(--text-3)' }} title="converted at the rate recorded on this event, never one looked up at render (ADR-1003)">{r.fx}</span> : null}
                    <span className="text-[11px] break-all" style={{ color: 'var(--text-3)' }}>{r.id}</span>
                  </div>
                ))}
              </div>
            </details>
          ) : null}
        </>
      ) : null}
    </section>
  )
}

/** A figure with its label and its sentence: no number appears without the sentence that keeps it honest. */
function FigureCell({ label, figure }: { label: string; figure: Figure }) {
  return (
    <div data-state={figure.state} className="min-w-0 p-3" style={{ border: `1px ${figure.state === 'never-fired' ? 'dashed' : 'solid'} var(--line-1)`, borderRadius: 'var(--r-md)' }}>
      <div className="min-h-[28px] flex items-center"><MoneyFigure figure={figure} /></div>
      <div className="text-[10.5px] uppercase tracking-[0.06em] mt-1.5" style={{ fontFamily: UI, fontWeight: 600, color: 'var(--text-3)' }}>{label}</div>
      <FigureNote text={figure.note} />
      <span className="block text-[10.5px] mt-1.5 break-all" style={{ fontFamily: MONO, color: 'var(--text-3)' }} title={figure.why}>⌗ {figure.why}</span>
    </div>
  )
}

function FigureNote({ text }: { text: string }) {
  if (text === '') return null
  return <p className="text-[12px] leading-[17px] mt-1" style={{ fontFamily: UI, color: 'var(--text-2)' }}>{text}</p>
}

/** Cost lines, counted by currency and source and NEVER summed: the rule is drawn where the total would have been. */
export function CostPanel({ c }: { c: CostView }) {
  return (
    <HPanel title={c.title} hint={c.count}>
      <CostBlock c={c} />
    </HPanel>
  )
}

/** The same cost lines without a panel around them, for a venture's card. */
export function CostBlock({ c }: { c: CostView }) {
  return (
    <>
      <p className="text-[12.5px] leading-[19px] mb-3 max-w-[62ch]" style={{ fontFamily: UI, color: 'var(--text-2)' }}>{c.lede}</p>
      {c.isReading ? <Reading what="the cost lines" /> : null}
      {c.isRefused ? <DoorRefusal code={c.refusal.code} human={c.refusal.human} /> : null}
      {c.isEmpty ? (
        <p className="text-[12.5px] leading-[19px]" style={{ fontFamily: UI, color: 'var(--text-3)' }}>
          The door served no cost line here. That is an empty list, not a zero: nothing on this screen claims the amount was nil.
        </p>
      ) : null}
      {c.isDrawn ? (
        <>
          <div className="flex flex-wrap gap-2 mb-3">
            {c.chips.map((x) => (
              <span key={x.key} className="inline-flex items-center h-[24px] px-2.5 rounded-full text-[11.5px]" style={{ fontFamily: MONO, color: 'var(--text-1)', border: '1px solid var(--line-1)', background: 'var(--bg-3)' }}>
                {x.text}
                {x.hasWarn ? <b className="ml-1" style={{ color: 'var(--amber)', fontWeight: 600 }}>{x.warn}</b> : null}
              </span>
            ))}
          </div>
          <p className="text-[12px] leading-[18px] mb-3 pl-3 max-w-[72ch]" style={{ fontFamily: UI, color: 'var(--text-3)', borderLeft: '2px solid var(--line-2)' }}>{c.rule}</p>
          <div>
            {c.lines.map((l) => (
              <div key={l.id} className="flex items-baseline gap-3 flex-wrap py-1.5 text-[12px]" style={{ fontFamily: MONO, borderBottom: '1px solid var(--line-1)' }}>
                <span className="tnum" style={{ color: 'var(--text-3)' }}>{l.ts}</span>
                <span className="tnum" style={{ color: l.isExact ? 'var(--text-1)' : 'var(--text-3)' }} title={l.note}>{l.amount}</span>
                <span style={{ color: 'var(--text-2)' }}>{l.source}</span>
                <span className="flex-1 min-w-0 break-words" style={{ color: 'var(--text-2)' }}>{l.label}</span>
                <span className="text-[11px] break-all" style={{ color: 'var(--text-3)' }}>{l.id}</span>
              </div>
            ))}
          </div>
        </>
      ) : null}
    </>
  )
}

export type VentureCardView = {
  key: string
  venture: string
  isDeclared: boolean
  badge: string
  badgeTitle: string
  hasWorst: boolean
  worst: string
  isWorstLoud: boolean
  isDanger: boolean
  earned: string
  real: Figure
  mrr: Figure
  sim: Figure
  components: (Figure & { label: string })[]
  hasComponents: boolean
  hasKill: boolean
  criteria: { key: string; criterion: string; headline: string; ink: string; detail: string; isAbsent: boolean }[]
  noKill: string
  absentNote: string
  hasAbsentNote: boolean
  hasFinding: boolean
  finding: { code: string; human: string }
  cost: CostView
}

/**
 * One venture: what it earned, what it simulated, what it cost, and how far it is from each line someone drew
 * for it. The sentence comes first and the numbers second: the shape is what a reader sees, the words are what
 * a reader can quote.
 */
export function VentureCardPanel({ v, neverMix }: { v: VentureCardView; neverMix: string }) {
  return (
    <HPanel
      title={v.venture}
      tone={v.isDanger ? 'amber' : undefined}
      actions={
        <>
          <span title={v.badgeTitle} className="inline-flex items-center h-[20px] px-2 rounded-full text-[10.5px] uppercase tracking-[0.06em]" style={{ fontFamily: UI, fontWeight: 600, color: v.isDeclared ? 'var(--text-2)' : 'var(--amber)', border: `1px solid ${v.isDeclared ? 'var(--line-2)' : 'var(--amber)'}` }}>
            {v.badge}
          </span>
          {v.hasWorst ? (
            <span className="text-[11px]" style={{ fontFamily: MONO, fontWeight: 600, color: v.isWorstLoud ? 'var(--amber)' : 'var(--faint)' }}>{v.worst}</span>
          ) : null}
        </>
      }
    >
      <p className="text-[13px] leading-[20px] mb-3" style={{ fontFamily: UI, color: 'var(--text-1)' }}>{v.earned}</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <FigureCell label="real · revenue.received" figure={v.real} />
        <FigureCell label="MRR" figure={v.mrr} />
        <FigureCell label="simulated · revenue.simulated" figure={v.sim} />
      </div>
      <p className="text-[12px] leading-[18px] mt-3" style={{ fontFamily: UI, color: 'var(--text-3)' }}>{neverMix}</p>
      {v.hasComponents ? (
        <div className="flex flex-wrap gap-2 mt-3">
          {v.components.map((c) => (
            <span key={c.label} data-state={c.state} className="inline-flex items-center gap-2 px-2.5 py-1 rounded-[var(--r-sm)]" style={{ border: `1px ${c.state === 'absent' ? 'dotted' : 'solid'} var(--line-1)` }}>
              <span className="text-[10.5px] uppercase tracking-[0.06em]" style={{ fontFamily: UI, fontWeight: 600, color: 'var(--text-3)' }}>{c.label}</span>
              <MoneyFigure figure={c} size="row" />
            </span>
          ))}
        </div>
      ) : null}

      <div className="mt-4">
        <div className="text-[11px] uppercase tracking-[0.08em] mb-2" style={{ fontFamily: UI, fontWeight: 600, color: 'var(--text-3)' }}>kill lines — written at kickoff</div>
        {v.hasKill ? (
          <div>
            {v.criteria.map((c) => (
              <div key={c.key} data-state={c.isAbsent ? 'absent' : 'measured'} className="py-2" style={{ borderBottom: `1px ${c.isAbsent ? 'dotted' : 'solid'} var(--line-1)` }}>
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-[12.5px]" style={{ fontFamily: MONO, color: 'var(--text-1)' }}>{c.criterion}</span>
                  <span className="text-[12px] ml-auto" style={{ fontFamily: MONO, fontWeight: 600, color: c.ink }}>{c.headline}</span>
                </div>
                <p className="text-[12px] leading-[18px] mt-1" style={{ fontFamily: UI, color: 'var(--text-2)' }}>{c.detail}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[12.5px] leading-[19px]" style={{ fontFamily: UI, color: 'var(--text-2)' }}>{v.noKill}</p>
        )}
        {v.hasAbsentNote ? <p className="text-[12px] leading-[18px] mt-2" style={{ fontFamily: UI, color: 'var(--text-3)' }}>{v.absentNote}</p> : null}
      </div>

      {v.hasFinding ? (
        <div className="mt-3">
          <DoorRefusal code={v.finding.code} human={v.finding.human} />
        </div>
      ) : null}

      <div className="mt-4">
        <div className="text-[11px] uppercase tracking-[0.08em] mb-2" style={{ fontFamily: UI, fontWeight: 600, color: 'var(--text-3)' }}>{v.cost.title}</div>
        <CostBlock c={v.cost} />
      </div>
    </HPanel>
  )
}

/**
 * The kill lines: the ONE region on the money pages that wears "file, not log", because it is the one region that
 * reads a file. Its refusal states are drawn differently from each other and none of them is an empty panel.
 */
export function KillLinesPanel({ k, title = 'Kill lines' }: { k: KillLinesView; title?: string }) {
  return (
    <HPanel
      title={title}
      hint={k.hasAsOf ? k.asOf : 'ventures.yaml · an ABSENT row is printed, never dropped'}
      tone={k.isLoud ? 'amber' : undefined}
      actions={k.isPanel ? <FileBadge text={k.badge} /> : null}
    >
      {k.isReading ? <Reading what="the kill panel" /> : null}
      {k.isRefused ? <DoorRefusal code={k.refusal.code} human={k.refusal.human} /> : null}
      {k.hasNote ? <DoorRefusal code={k.note.code} human={k.note.human} /> : null}
      {k.isPanel ? (
        <>
          <p className="text-[13px] leading-[20px] mb-3" style={{ fontFamily: UI, color: k.isDanger ? 'var(--amber)' : 'var(--text-2)' }}>{k.summary}</p>
          <div>
            {k.rows.map((r) => (
              <div key={r.key} data-state={r.isAbsent ? 'absent' : 'measured'} className="py-2" style={{ borderBottom: `1px ${r.isAbsent ? 'dotted' : 'solid'} var(--line-1)` }}>
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-[12.5px]" style={{ fontFamily: MONO, color: 'var(--text-1)' }}>{r.venture}</span>
                  <span className="text-[12.5px]" style={{ fontFamily: MONO, color: 'var(--text-2)' }}>{r.criterion}</span>
                  <span className="text-[12px] ml-auto" style={{ fontFamily: MONO, fontWeight: 600, color: r.ink }}>{r.headline}</span>
                </div>
                <p className="text-[12px] leading-[18px] mt-1" style={{ fontFamily: UI, color: 'var(--text-2)' }}>{r.detail}</p>
              </div>
            ))}
          </div>
          {k.hasFuture ? (
            <div className="mt-3 space-y-1">
              {k.future.map((line) => (
                <p key={line} className="text-[12px] leading-[18px]" style={{ fontFamily: UI, color: 'var(--amber)' }}>{line}</p>
              ))}
            </div>
          ) : null}
          <span className="inline-block mt-3 text-[11px] break-all" style={{ fontFamily: MONO, color: 'var(--text-3)' }} title={k.receiptTitle}>⌗ {k.receipt}</span>
        </>
      ) : null}
    </HPanel>
  )
}

/** "file, not log": what a file-borne half wears, and nothing else on the page. */
export function FileBadge({ text }: { text: ReactNode }) {
  return (
    <span className="inline-flex items-center h-[20px] px-2 rounded-full text-[10.5px] uppercase tracking-[0.06em]" style={{ fontFamily: MONO, color: 'var(--text-2)', border: '1px solid var(--line-2)' }} title="this half reads a file on the tree; a file has no day-granular history to scrub to">
      {text}
    </span>
  )
}
