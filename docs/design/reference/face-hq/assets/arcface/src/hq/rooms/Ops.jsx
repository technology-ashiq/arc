// OPS (planned) — "Two live ventures away."
// Not born in arc. No manifest is invented for an unborn lane, so this
// room rehearses the planned line (PLAN-ops.md · OPS-A..M) and labels
// every write REHEARSAL: incident raised → ack → resolve · support
// file-drop → classify → template draft → your stamp → human sends ·
// weekly report · drill. Nothing here sends anything.
import { useState } from 'react'
import { Lifebuoy, Ticket, Receipt } from '@phosphor-icons/react'
import { UI, MONO, COLOR, tint, Btn, Field, TextInput, PickRow, SimBadge, Chip } from '../../ui/kit.jsx'
import { RoomHead, HPanel, KpiStrip, Empty } from '../bits.jsx'
import { useSpine } from '../useSpine.js'
import { spine } from '../../spine/store.js'
import { wsAppend, wsRequestApproval, newRef } from '../../spine/workspace.js'
import { incidents, tickets } from '../../spine/registries.js'
import { FACTS } from '../../data/arcFacts.js'
import { hhmm } from '../../spine/kinds.js'

const PLAN = FACTS.planned.find((p) => p.room === 'ops')
// stations this room can rehearse today; registry · sweep · human sends stay dim
const TODAY = new Set(['incident.raised', 'ack', 'resolve', 'support file-drop', 'classify', 'template draft', 'approval (stamp)', 'weekly report', 'drill'])
const TRAIL = new Set(['incident.raised', 'incident.acked', 'incident.resolved', 'support.dropped', 'support.triaged', 'ops.report'])
// chip tones — red is over the line, amber needs a person, the rest stay quiet
const SEV = { S1: 'red', S2: 'amber' }
const INC = { raised: 'red', acked: 'amber' }
const TK = { dropped: 'blue', drafted: 'amber', 'sealed — you send it': 'cyan' }
// four honest templates — the billing one promises a look, never a refund
const TEMPLATES = {
  billing: 'Thanks for flagging the charge. I have pulled the invoice and will confirm each line against your plan by tomorrow; nothing changes on your account until you hear back from a person.',
  bug: 'Thanks — reproduced on our side and filed against the current build. You will get the fix id here once it ships, and a workaround today if one exists.',
  howto: 'Shortest path: open Settings, then the section you named, then follow the three steps on the linked page. Reply here if any step does not match your screen.',
  other: 'Received — routed to a person, not a queue. A named reply lands within one working day.',
}
const classify = (s) => (/refund|invoice|price/i.test(s) ? 'billing' : /error|bug|broken|crash/i.test(s) ? 'bug' : /\bhow\b|\bwhere\b|can i/i.test(s) ? 'howto' : 'other')

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

export default function Ops() {
  useSpine()
  const [title, setTitle] = useState('')
  const [severity, setSeverity] = useState('S2')
  const [source, setSource] = useState('canary')
  const [text, setText] = useState('')
  const [from, setFrom] = useState('email')
  const [resolving, setResolving] = useState(null)
  const [resolution, setResolution] = useState('')
  const [msg, setMsg] = useState(null)

  const inc = incidents()
  const tk = tickets()
  const resolvedN = inc.filter((i) => i.status === 'resolved').length
  const openN = inc.length - resolvedN
  const sealedN = tk.filter((t) => /^sealed/.test(t.status)).length
  const draftedN = tk.filter((t) => t.status === 'drafted').length
  const simRaised = spine.events.filter((e) => e.kind === 'incident.raised' && !e.ws).length
  const trail = spine.events.filter((e) => e.ws && TRAIL.has(e.kind)).slice(-8).reverse()
  const pendingReply = (id) => spine.pendingApprovals.some((a) => a.subject === 'ops.reply' && a.data && a.data.ticketId === id)

  const raise = (t, sev, src, extra = {}) =>
    wsAppend('incident.raised', 'ops', `REHEARSAL · incident raised: ${t} · ${sev} · ${src}`, { incId: newRef('inc'), title: t, severity: sev, source: src, ...extra })
  const submitIncident = () => {
    const v = title.trim()
    if (!v) return
    raise(v, severity, source)
    setTitle('')
    setMsg(`rehearsal incident raised · ${severity} via ${source} — ack it, then resolve it with a typed resolution`)
  }
  const ack = (i) => wsAppend('incident.acked', 'ops', `REHEARSAL · incident acked: ${i.title} · ${i.severity} · a person is on it`, { incId: i.incId })
  const resolve = (i) => {
    const r = resolution.trim()
    if (!r) return
    wsAppend('incident.resolved', 'ops', `REHEARSAL · incident resolved: ${i.title} · ${r}`, { incId: i.incId, resolution: r })
    setResolving(null)
    setResolution('')
  }
  const drop = () => {
    const v = text.trim()
    if (!v) return
    wsAppend('support.dropped', 'ops', `REHEARSAL · support file-drop from ${from}: “${v.slice(0, 60)}”`, { ticketId: newRef('tk'), text: v, from })
    setText('')
    setMsg('rehearsal ticket dropped — classify it; the draft is a template, the send is always yours')
  }
  const triage = (t) => {
    const cls = classify(t.text)
    const draft = TEMPLATES[cls]
    wsAppend('support.triaged', 'ops', `REHEARSAL · ticket ${t.ticketId} classified ${cls} · template draft (${draft.length} chars) · nothing sent`, { ticketId: t.ticketId, cls, draft })
  }
  const stamp = (t) => {
    wsRequestApproval({
      title: `ops: reply to ticket ${t.ticketId}`,
      tag: 'ops · human sends',
      subject: 'ops.reply',
      data: { ticketId: t.ticketId },
      facts: [
        { k: 'council', v: `classified ${t.cls} · template draft · ${(t.draft || '').length} chars` },
        { k: 'money', v: 'no refund inside this draft — refunds are forever human' },
        { k: 'kill', v: 'human sends (seal) — the machine never sends; an approved draft is copied by you' },
      ],
    })
    setMsg(`reply proposal for ${t.ticketId} is in your inbox — a stamp seals the draft; sending stays yours`)
  }
  const report = () => {
    wsAppend('ops.report', 'ops', `REHEARSAL · weekly ops report: ${inc.length} incidents (${openN} open) · ${tk.length} tickets · ${sealedN} sealed replies`, { incidents: inc.length, open: openN, tickets: tk.length, sealed: sealedN })
    setMsg('weekly report written as a rehearsal — numbers are this room’s own fold, nothing else')
  }
  const drill = () => {
    raise('drill — canary fired on purpose', 'S3', 'canary', { drill: true })
    setMsg('drill raised as a rehearsal S3 — ack it and resolve it like a real one')
  }

  return (
    <>
      <RoomHead title="Two live ventures away." hint="planned, drawn dotted — this room opens when a second venture is running and support stops being one person" right={<SimBadge>planned · drawn dotted · rehearsal only</SimBadge>} />
      <Banner />

      {/* figures lead — the sim spine's count is violet because it is simulated; open incidents are amber because a person owes an ack */}
      <KpiStrip
        items={[
          { v: inc.length, l: 'Incidents raised here', sub: `${openN} open · ${resolvedN} resolved`, tone: openN ? 'amber' : undefined },
          { v: simRaised, l: 'Raised on the sim spine', sub: 'simulated · never opens one here', tone: 'violet' },
          { v: tk.length, l: 'Tickets dropped', sub: `${sealedN} sealed · you send them` },
        ]}
      />

      <div className="grid grid-cols-1 xl:grid-cols-[1.4fr_1fr] gap-4 items-start">
        <div className="min-w-0">
          <HPanel title="Raise an incident" hint="incident.raised → ack → resolve · every write says REHEARSAL">
            <form className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 mb-3" onSubmit={(e) => { e.preventDefault(); submitIncident() }}>
              <Field label="Title"><TextInput value={title} onChange={setTitle} placeholder="canary: /api/health 503 for 4 min · invoice email bounced · …" /></Field>
              <div className="flex items-end"><Btn tone="primary" onClick={submitIncident}>Raise →</Btn></div>
            </form>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Severity"><PickRow options={['S1', 'S2', 'S3']} value={severity} onPick={setSeverity} /></Field>
              <Field label="Source"><PickRow options={['canary', 'support', 'manual']} value={source} onPick={setSource} /></Field>
            </div>
            {/* room-level rehearsals — neither is a kill, so neither is red */}
            <div className="flex gap-2 flex-wrap mt-4 pt-4" style={{ borderTop: '1px solid var(--line-1)' }}>
              <Btn small onClick={report}>Weekly report</Btn>
              <Btn small onClick={drill}>Drill — fire the canary on purpose</Btn>
            </div>
            {msg && <div className="mt-3 text-[12.5px] leading-[19px]" style={{ fontFamily: UI, color: 'var(--accent)' }}>{msg}</div>}
          </HPanel>

          <HPanel title={`Incidents — ${inc.length}`} hint={`resolved ${resolvedN} · open ${openN} · no MTTR: a rehearsal clock is not a measurement`} tone={openN ? 'amber' : undefined}>
            {inc.length === 0 && <Empty icon={Lifebuoy} title="No incident has been raised in this room" hint="the sim spine’s canary lines never open one here — raise one above, then ack and resolve it" />}
            <div className="space-y-2.5">
              {inc.map((i) => (
                <div key={i.incId} className="p-3.5 min-w-0" style={{ background: 'var(--well)', border: '1px solid var(--line-1)', borderRadius: 'var(--r-md)', opacity: i.status === 'resolved' ? 0.55 : 1 }}>
                  <div className="flex items-center gap-2 flex-wrap mb-2 min-w-0">
                    <b className="text-[13.5px] leading-[19px] min-w-0 break-words" style={{ fontFamily: UI, fontWeight: 600, color: 'var(--text-1)' }}>{i.title}</b>
                    <Chip mono tone={SEV[i.severity]}>{i.severity}</Chip>
                    <Chip tone={INC[i.status]}>{i.status}</Chip>
                    <span className="text-[12px]" style={{ fontFamily: UI, color: 'var(--text-3)' }}>{i.source} · <span className="tnum" style={{ fontFamily: MONO }}>{hhmm(i.t)}</span></span>
                    <SimBadge>rehearsal</SimBadge>
                  </div>
                  {i.resolution && <div className="text-[12.5px] leading-[19px] mb-2 break-words" style={{ fontFamily: UI, color: 'var(--text-2)' }}>resolution: {i.resolution}</div>}
                  {resolving === i.incId ? (
                    <form className="flex gap-2 flex-wrap items-center mt-1" onSubmit={(e) => { e.preventDefault(); resolve(i) }}>
                      <div className="flex-1 min-w-[220px]"><TextInput autoFocus value={resolution} onChange={setResolution} placeholder="resolution — required, one honest sentence" /></div>
                      <Btn small onClick={() => resolve(i)} className={resolution.trim() ? '' : 'opacity-40'}>Record resolution</Btn>
                      <Btn small onClick={() => { setResolving(null); setResolution('') }}>Cancel</Btn>
                    </form>
                  ) : (
                    <div className="flex gap-2 flex-wrap">
                      {i.status === 'raised' && <Btn small tone="amber" onClick={() => ack(i)}>Ack</Btn>}
                      {i.status !== 'resolved' && <Btn small onClick={() => setResolving(i.incId)}>Resolve</Btn>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </HPanel>

          <HPanel title="Support file-drop" hint="support.dropped → classify → template draft → your stamp · the machine never sends">
            <form className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 mb-3" onSubmit={(e) => { e.preventDefault(); drop() }}>
              <Field label="Paste a customer message"><TextInput value={text} onChange={setText} placeholder="hi, I was charged twice on the invoice for august — can I get this fixed?" /></Field>
              <div className="flex items-end"><Btn tone="primary" onClick={drop}>Drop →</Btn></div>
            </form>
            <Field label="From"><PickRow options={['email', 'whatsapp', 'portal']} value={from} onPick={setFrom} /></Field>
          </HPanel>

          <HPanel title={`Tickets — ${tk.length}`} hint={`${sealedN} sealed · a seal means you copy the draft and send it yourself`} tone={draftedN ? 'amber' : undefined}>
            {tk.length === 0 && <Empty icon={Ticket} title="No ticket dropped yet" hint="paste one message above; classification is keyword-honest, not a model." />}
            <div className="space-y-2.5">
              {tk.map((t) => (
                <div key={t.ticketId} className="p-3.5 min-w-0" style={{ background: 'var(--well)', border: '1px solid var(--line-1)', borderRadius: 'var(--r-md)', opacity: t.status === 'draft rejected' ? 0.5 : 1 }}>
                  <div className="flex items-center gap-2 flex-wrap mb-2 min-w-0">
                    <b className="text-[13.5px] leading-[19px] min-w-0 break-words" style={{ fontFamily: UI, fontWeight: 600, color: 'var(--text-1)' }}>“{t.text.length > 88 ? t.text.slice(0, 88) + '…' : t.text}”</b>
                    <span className="text-[12px]" style={{ fontFamily: UI, color: 'var(--text-3)' }}><span style={{ fontFamily: MONO }}>{t.ticketId}</span> · {t.from}</span>
                    <Chip tone={t.cls === 'unclassified' ? undefined : 'blue'}>{t.cls}</Chip>
                    <Chip tone={TK[t.status]}>{t.status}</Chip>
                    <SimBadge>rehearsal</SimBadge>
                  </div>
                  {t.draft && <div className="text-[12.5px] leading-[19px] px-3 py-2 mb-2 break-words" style={{ fontFamily: UI, color: 'var(--text-2)', background: 'var(--bg-1)', border: '1px solid var(--line-1)', borderRadius: 'var(--r-md)' }}>draft · {t.draft}</div>}
                  <div className="flex gap-2 flex-wrap items-center text-[12px] leading-[18px]" style={{ fontFamily: UI }}>
                    {t.status === 'dropped' && <Btn small onClick={() => triage(t)}>Classify + draft</Btn>}
                    {t.status === 'drafted' && !pendingReply(t.ticketId) && <Btn small tone="amber" onClick={() => stamp(t)}>Approval (stamp) →</Btn>}
                    {t.status === 'drafted' && pendingReply(t.ticketId) && <span style={{ color: COLOR.amber }}>proposal is in your inbox</span>}
                    {/^sealed/.test(t.status) && <span style={{ color: 'var(--text-3)' }}>human sends (seal) — copy the draft; no send button exists here</span>}
                  </div>
                </div>
              ))}
            </div>
          </HPanel>

          <HPanel title="The trail" hint="incident.* · support.* · ops.report — last 8, rehearsals only">
            {trail.length === 0 && <Empty icon={Receipt} title="Nothing rehearsed yet." hint="the first incident.* or support.* receipt lands here" />}
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

          <HPanel title="Shows today" hint="what already exists in the repo for this unborn lane">
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
              <div>· the machine drafts; a person sends — the seal is a copy, never a send button</div>
              <div>· refunds are forever human; no template mentions one</div>
              <div>· an incident is open until a typed resolution closes it — no auto-resolve</div>
              <div>· the room is born only when two ventures are live; until then everything is REHEARSAL</div>
            </div>
          </HPanel>
        </div>
      </div>
    </>
  )
}
