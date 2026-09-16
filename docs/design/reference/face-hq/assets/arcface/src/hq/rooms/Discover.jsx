// DISCOVER (planned) — "The next venture is chosen, not stumbled into."
// Not born in arc. No manifest is invented for an unborn lane, so this
// room rehearses the planned line (PLAN-discover.md · DIS-A..D): hunt →
// normalize → dedupe → score → top-2 → council → your stamp → one-pager
// → separate venture kickoff. Every write is labeled REHEARSAL.
import { useState } from 'react'
import { Lightbulb, Receipt } from '@phosphor-icons/react'
import { UI, MONO, COLOR, tint, Btn, Field, TextInput, PickRow, SimBadge, Chip } from '../../ui/kit.jsx'
import { RoomHead, HPanel, KpiStrip, Empty } from '../bits.jsx'
import { useSpine } from '../useSpine.js'
import { spine } from '../../spine/store.js'
import { wsAppend, wsRequestApproval, newRef } from '../../spine/workspace.js'
import { ideas, scoreIdea } from '../../spine/registries.js'
import { FACTS } from '../../data/arcFacts.js'
import { uiBus } from '../../lib/uiBus.js'
import { hhmm } from '../../spine/kinds.js'

const PLAN = FACTS.planned.find((p) => p.room === 'discover')
// stations rehearsable here today; miner · one-pager · kickoff stay dim (they need a born lane)
const TODAY = new Set(['hunt', 'normalize', 'dedupe/cluster', 'score.yaml', 'top-2', 'council', 'approval (stamp)'])
const TRAIL = new Set(['idea.captured', 'idea.scored', 'idea.shortlisted'])
const SOURCES = ['reddit', 'forum', 'call', 'manual']
// status → chip tone. council is violet (the council's turn), kickoff is amber (stamped, a venture waits on you); the rest stay quiet
const STATUS = { scored: 'cyan', shortlisted: 'cyan', council: 'violet', kickoff: 'amber' }
const DIST_FLOOR = 6
const norm = (s) => (s || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
// the registry fold keeps the four numbers; the R-114 flag is derived from distribution
const flagOf = (score) => (score && score.distribution < DIST_FLOOR ? 'distribution < 6 — hard-flagged (R-114)' : null)

// the planned-lane banner: a dotted hairline and the honest badge, no wash
function Banner() {
  return (
    <div className="flex items-center gap-3 flex-wrap px-4 py-3 mb-4 text-[12.5px] leading-[19px]" style={{ fontFamily: UI, color: 'var(--text-2)', background: 'var(--bg-2)', border: '1px dotted var(--line-2)', borderRadius: 'var(--r-lg)' }}>
      <SimBadge>rehearsal</SimBadge>
      <span className="min-w-0">planned · drawn dotted — this lane is not born (arc rule: no manifest is invented for an unborn lane). Everything below is REHEARSAL and says so.</span>
    </div>
  )
}
function Stepper({ line }) {
  return (
    <div className="flex flex-wrap items-center gap-y-2">
      {line.map((s, i) => {
        const on = TODAY.has(s)
        return (
          <span key={s} className="inline-flex items-center">
            {i > 0 && <span aria-hidden="true" className="mx-1.5 text-[11px]" style={{ color: 'var(--text-3)' }}>→</span>}
            <span
              className="inline-flex items-center h-[22px] px-2 text-[11.5px] whitespace-nowrap"
              style={{ fontFamily: UI, fontWeight: 500, borderRadius: 'var(--r-sm)', color: on ? 'var(--accent)' : 'var(--text-3)', background: on ? tint('cyan', 0.06) : 'transparent', border: '1px dotted ' + (on ? tint('cyan', 0.45) : 'var(--line-2)') }}
            >
              {s}
            </span>
          </span>
        )
      })}
    </div>
  )
}
// one score figure: label in UI, number in mono; amber only when the R-114 floor is crossed
const Fig = ({ l, v, warn = false }) => (
  <span className="inline-flex items-baseline gap-1.5 text-[12px]" style={{ fontFamily: UI, color: 'var(--text-3)' }}>
    {l} <b className="text-[12.5px] tnum" style={{ fontFamily: MONO, fontWeight: 600, color: warn ? COLOR.amber : 'var(--text-1)' }}>{v}</b>
  </span>
)

export default function Discover() {
  useSpine()
  const [text, setText] = useState('')
  const [source, setSource] = useState('reddit')
  const [refuse, setRefuse] = useState(null)
  const [msg, setMsg] = useState(null)

  const rows = ideas()
  const scored = rows.filter((r) => r.status === 'scored')
  const eligible = scored.filter((r) => !flagOf(r.score)).sort((a, b) => b.score.total - a.score.total)
  const counts = rows.reduce((a, r) => ((a[r.status] = (a[r.status] || 0) + 1), a), {})
  const simToday = spine.events.filter((e) => e.kind === 'idea.captured' && !e.ws && e.day === spine.dayIndex)
  const simCandidates = simToday.reduce((s, e) => s + ((e.payload && e.payload.candidates) || 0), 0)
  const trail = spine.events.filter((e) => e.ws && TRAIL.has(e.kind)).slice(-8).reverse()
  const pendingKickoff = (id) => spine.pendingApprovals.some((a) => a.subject === 'discover.kickoff' && a.data && a.data.ideaId === id)
  const shortlistedN = (counts.shortlisted || 0) + (counts.council || 0) + (counts.kickoff || 0)

  const hunt = () => {
    const v = text.trim()
    if (!v) return
    const dup = rows.find((r) => norm(r.text) === norm(v))
    if (dup) {
      setRefuse(`dedupe — already in the field as ${dup.ideaId}`)
      return
    }
    wsAppend('idea.captured', 'discover', `REHEARSAL · idea captured from ${source}: “${v.slice(0, 70)}”`, { ideaId: newRef('idea'), text: v, source })
    setText('')
    setRefuse(null)
    setMsg('pain captured — normalize + score it; two clean scores unlock the shortlist')
  }
  const score = (r) => {
    const s = scoreIdea(r.text)
    wsAppend('idea.scored', 'discover', `REHEARSAL · scored “${r.text.slice(0, 50)}”: market ${s.market} · moat ${s.moat} · distribution ${s.distribution} · total ${s.total}${s.flag ? ' · ' + s.flag : ''}`, { ideaId: r.ideaId, ...s })
  }
  const shortlist = () => {
    if (eligible.length < 2) return
    for (const r of eligible.slice(0, 2)) wsAppend('idea.shortlisted', 'discover', `REHEARSAL · shortlisted top-2: “${r.text.slice(0, 50)}” · total ${r.score.total} · un-flagged`, { ideaId: r.ideaId, total: r.score.total })
    setMsg('top-2 shortlisted — each one can now go to council and your stamp')
  }
  const council = (r) => {
    const s = r.score
    const flag = flagOf(s)
    uiBus.pendingCouncilQ = `Should arc kick off “${r.text}” as venture #2?`
    wsRequestApproval({
      title: `discover: kick off “${r.text.slice(0, 50)}” as venture #2`,
      tag: 'discover · one-pager',
      subject: 'discover.kickoff',
      data: { ideaId: r.ideaId },
      facts: [
        { k: 'council', v: `score ${s.total} (market ${s.market} · moat ${s.moat} · distribution ${s.distribution})${flag ? ' · ' + flag : ''}` },
        { k: 'money', v: 'appetite 2w · burn 0% · no ₹ committed by this stamp' },
        { k: 'kill', v: 'separate venture kickoff — own repo, own kill criteria set at kickoff, one-pager first' },
      ],
    })
    setMsg('kickoff proposal is in your inbox — the council question is queued in the council room')
  }

  return (
    <>
      <RoomHead title="The next venture is chosen, not stumbled into." hint="planned, drawn dotted — opens when the venture #2 slot needs filling from a scored field, not a hunch" right={<SimBadge>planned · drawn dotted · rehearsal only</SimBadge>} />
      <Banner />

      {/* figures lead — the sim's hunt is violet because it is simulated; a shortlisted idea is amber because it waits on your stamp */}
      <KpiStrip
        items={[
          { v: simCandidates, l: 'Sim candidates today', sub: simToday.length === 0 ? 'no nightly hunt has fired yet' : 'simulated · never lands here', tone: 'violet' },
          { v: rows.length, l: 'Captured in this room', sub: `${counts.captured || 0} waiting for a score` },
          { v: counts.scored || 0, l: 'Scored', sub: `${eligible.length} un-flagged` },
          { v: shortlistedN, l: 'Shortlisted', sub: 'council · your stamp · kickoff', tone: counts.shortlisted ? 'amber' : undefined },
        ]}
      />

      <div className="grid grid-cols-1 xl:grid-cols-[1.4fr_1fr] gap-4 items-start">
        <div className="min-w-0">
          <HPanel title="Hunt" hint="idea.captured → normalize → dedupe · a pain, in the customer's words, with its source">
            <form className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 mb-3" onSubmit={(e) => { e.preventDefault(); hunt() }}>
              <Field label="Pain — what someone said, not what you think they meant"><TextInput value={text} onChange={setText} placeholder="“I spend every sunday re-typing GST invoices into tally because the export never matches”" /></Field>
              <div className="flex items-end"><Btn tone="primary" onClick={hunt}>Capture →</Btn></div>
            </form>
            <Field label="Source"><PickRow options={SOURCES} value={source} onPick={setSource} /></Field>
            {refuse && <div className="mt-3 text-[12.5px] leading-[19px]" style={{ fontFamily: UI, color: COLOR.red }}>{refuse}</div>}
            {msg && !refuse && <div className="mt-3 text-[12.5px] leading-[19px]" style={{ fontFamily: UI, color: 'var(--accent)' }}>{msg}</div>}
          </HPanel>

          <HPanel
            title={`The field — ${rows.length} ideas`}
            hint="captured · scored · shortlisted · council · kickoff · parked — status moves only on receipts"
            tone={counts.shortlisted ? 'amber' : undefined}
            actions={<Btn small tone={eligible.length >= 2 ? 'amber' : 'ghost'} onClick={shortlist} className={eligible.length >= 2 ? '' : 'opacity-40'}>Shortlist top-2</Btn>}
          >
            <div className="text-[12px] leading-[18px] mb-3" style={{ fontFamily: UI, color: 'var(--text-3)' }}>{eligible.length} un-flagged scored · shortlist needs 2</div>
            {rows.length === 0 && <Empty icon={Lightbulb} title="The field is empty" hint="the sim's nightly hunt never lands here; capture a pain above to start one." />}
            <div className="space-y-2.5">
              {rows.map((r) => {
                const s = r.score
                const flag = flagOf(s)
                return (
                  <div key={r.ideaId} className="p-3.5 min-w-0" style={{ background: 'var(--well)', border: '1px solid var(--line-1)', borderRadius: 'var(--r-md)', opacity: r.status === 'parked' ? 0.55 : 1 }}>
                    <div className="flex items-center gap-2 flex-wrap mb-2 min-w-0">
                      <b className="text-[13.5px] leading-[19px] min-w-0 break-words" style={{ fontFamily: UI, fontWeight: 600, color: 'var(--text-1)' }}>{r.text.length > 96 ? r.text.slice(0, 96) + '…' : r.text}</b>
                      <Chip tone="blue">{r.source}</Chip>
                      <Chip tone={STATUS[r.status]}>{r.status}</Chip>
                      <span className="text-[11.5px]" style={{ fontFamily: MONO, color: 'var(--text-3)' }}>{r.ideaId}</span>
                      <SimBadge>rehearsal</SimBadge>
                    </div>
                    {s && (
                      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 mb-2">
                        <Fig l="market" v={s.market} />
                        <Fig l="moat" v={s.moat} />
                        <Fig l="distribution" v={s.distribution} warn={!!flag} />
                        <Fig l="total" v={s.total} />
                        {flag && <span className="text-[12px] leading-[18px]" style={{ fontFamily: UI, color: COLOR.amber }}>{flag}</span>}
                      </div>
                    )}
                    <div className="flex gap-2 flex-wrap items-center text-[12px] leading-[18px]" style={{ fontFamily: UI }}>
                      {r.status === 'captured' && <Btn small onClick={() => score(r)}>Normalize + score</Btn>}
                      {r.status === 'shortlisted' && !pendingKickoff(r.ideaId) && <Btn small tone="amber" onClick={() => council(r)}>Council + your stamp →</Btn>}
                      {r.status === 'shortlisted' && pendingKickoff(r.ideaId) && <span style={{ color: COLOR.amber }}>proposal is in your inbox</span>}
                      {r.status === 'kickoff' && <span style={{ color: COLOR.amber }}>kickoff stamped — one-pager and a separate repo are the next station, outside this room</span>}
                      {r.status === 'parked' && <span style={{ color: 'var(--text-3)' }}>parked — the rejection reason is the record</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          </HPanel>

          <HPanel title="The trail" hint="idea.captured · idea.scored · idea.shortlisted — last 8, rehearsals only">
            {trail.length === 0 && <Empty icon={Receipt} title="Nothing rehearsed yet." hint="the first idea.* receipt lands here" />}
            {trail.length > 0 && (
              <div className="-mx-2">
                {trail.map((e) => (
                  <div key={e.id} className="grid grid-cols-[auto_1fr_auto] items-baseline gap-3 px-2 py-2 transition-colors duration-200 hover:bg-(--bg-3)" style={{ borderBottom: '1px solid var(--line-1)', borderRadius: 'var(--r-sm)' }}>
                    <span className="text-[11.5px] tnum shrink-0" style={{ fontFamily: MONO, color: 'var(--text-3)' }}>{hhmm(e.t)}</span>
                    <span className="text-[13px] leading-[20px] min-w-0 break-words" style={{ fontFamily: UI, color: 'var(--text-1)' }}>{e.text}</span>
                    <span className="text-[11px] shrink-0" style={{ fontFamily: MONO, color: 'var(--text-3)' }}>⌗ {String(e.id).slice(-6)}</span>
                  </div>
                ))}
              </div>
            )}
          </HPanel>
        </div>

        <div className="min-w-0">
          <HPanel title="The planned line" hint={`${PLAN.line.length} stations · cyan = rehearsable here today`}>
            <Stepper line={PLAN.line} />
          </HPanel>

          <HPanel title="Shows today" hint="what already exists for this unborn lane">
            <div className="space-y-1.5 text-[12px] leading-[18px]" style={{ fontFamily: MONO, color: 'var(--text-2)' }}>
              {PLAN.shows_today.map((s) => <div key={s} className="break-all">· {s}</div>)}
            </div>
            <div className="mt-4 pt-3 space-y-1.5 text-[12px] leading-[18px]" style={{ fontFamily: UI, borderTop: '1px solid var(--line-1)' }}>
              <div className="grid grid-cols-[72px_1fr] gap-2 min-w-0">
                <span style={{ color: 'var(--text-3)' }}>takes over</span>
                <span className="min-w-0 break-words" style={{ color: 'var(--text-2)' }}>{PLAN.takes_over}</span>
              </div>
              <div className="grid grid-cols-[72px_1fr] gap-2 min-w-0">
                <span style={{ color: 'var(--text-3)' }}>src</span>
                <span className="min-w-0 break-all" style={{ fontFamily: MONO, color: 'var(--text-2)' }}>{PLAN.source}</span>
              </div>
            </div>
          </HPanel>

          <HPanel title="The room's rules">
            <div className="text-[12.5px] leading-[19px] space-y-1.5" style={{ fontFamily: UI, color: 'var(--text-2)' }}>
              <div>· distribution below {DIST_FLOOR} is hard-flagged (R-114) — it never recovered post-launch, so it never reaches the shortlist</div>
              <div>· a duplicate pain is refused at capture, not merged later</div>
              <div>· the shortlist is exactly two; council debates them, you stamp one</div>
              <div>· a kickoff is a separate venture — own repo, own kill criteria, one-pager first</div>
            </div>
          </HPanel>
        </div>
      </div>
    </>
  )
}
