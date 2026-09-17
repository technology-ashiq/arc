// LEADS — "An offer, not a broadcast."
// The funnel is a fold over receipts: research → outreach (capped)
// → reply → meeting → won/lost. All cap state derives from the
// spine — there is no mutable counter file to reset. Suppression
// is checked before EVERY send and survives campaigns.
import { useState } from 'react'
import { Funnel, Prohibit } from '@phosphor-icons/react'
import { UI, MONO, COLOR, Btn, Field, TextInput, PickRow, YoursBadge, Meter, Chip } from '../../ui/kit.jsx'
import { RoomHead, HPanel, KpiStrip, Empty } from '../bits.jsx'
import { useSpine } from '../useSpine.js'
import { leadsState, leadTouchesInWindow, LEADS_DAILY_CAP, LEADS_TOUCH_CAP, wsAppend, newRef } from '../../spine/workspace.js'

// stage marks are semantic: blue = neutral progress, accent = a live
// conversation / a win, amber = it is on your calendar, muted = the ends
const STAGES = [
  { id: 'researched', name: 'researched', color: 'var(--text-3)' },
  { id: 'contacted', name: 'contacted', color: 'var(--blue)' },
  { id: 'replied', name: 'replied', color: 'var(--accent)' },
  { id: 'meeting', name: 'meeting', color: 'var(--amber)' },
  { id: 'won', name: 'won', color: 'var(--accent)' },
  { id: 'lost', name: 'lost', color: 'var(--text-3)' },
]

const CARD = { background: 'var(--well)', border: '1px solid var(--line-1)', borderRadius: 'var(--r-md)' }

export default function Leads() {
  useSpine()
  const [name, setName] = useState('')
  const [niche, setNiche] = useState('')
  const [geo, setGeo] = useState('IN')
  const [msg, setMsg] = useState(null)
  const { leads, sentToday, capLeft } = leadsState()

  const add = () => {
    const n = name.trim()
    if (!n) return
    wsAppend('lead.researched', 'leads', `Lead researched: ${n} · ${niche.trim() || 'niche unset'} · geo ${geo} · id HMAC-keyed, never raw contact`, {
      leadId: newRef('lead'), name: n, niche: niche.trim() || 'niche unset', geo,
    })
    setName('')
    setNiche('')
  }

  const send = (l) => {
    if (l.suppressed) {
      setMsg({ tone: 'err', text: `REFUSED: ${l.name} is on the suppression ledger — checked before every send, honored instantly` })
      return
    }
    if (l.geo !== 'IN') {
      setMsg({ tone: 'err', text: `REFUSED: jurisdiction guard — v1 sends only to the allowlist (India)` })
      return
    }
    if (capLeft <= 0) {
      setMsg({ tone: 'err', text: `REFUSED: daily cap — ${LEADS_DAILY_CAP}/${LEADS_DAILY_CAP} submitted sends today. The cap derives from receipts; there is nothing to reset.` })
      return
    }
    if (leadTouchesInWindow(l) >= LEADS_TOUCH_CAP) {
      setMsg({ tone: 'err', text: `REFUSED: ${l.name} already has ${LEADS_TOUCH_CAP} touches in the rolling 7-day window` })
      return
    }
    wsAppend('outreach.sent', 'leads', `Outreach sent: ${l.name} (${l.niche}) · ${sentToday + 1}/${LEADS_DAILY_CAP} today · touch ${leadTouchesInWindow(l) + 1}/${LEADS_TOUCH_CAP} this window`, { leadId: l.leadId })
    setMsg({ tone: 'ok', text: `Sent. Auto-stop arms on reply.` })
  }

  const act = (l, kind, text, payload = {}) => wsAppend(kind, 'leads', text, { leadId: l.leadId, ...payload })

  const suppressed = leads.filter((l) => l.suppressed)

  return (
    <>
      <RoomHead
        title="An offer, not a broadcast."
        hint="approval authorizes a send ATTEMPT, never a send — caps, suppression and jurisdiction are checked at the moment of use"
        right={<YoursBadge>leads · persisted</YoursBadge>}
      />

      {/* the instrument strip — amber only when the cap is nearly spent */}
      <KpiStrip
        items={[
          { v: `${sentToday}/${LEADS_DAILY_CAP}`, l: 'Sends today', sub: 'hard cap', tone: capLeft <= 3 ? 'amber' : undefined },
          { v: leads.filter((l) => l.stage === 'replied' || l.stage === 'meeting').length, l: 'Live conversations' },
          { v: leads.filter((l) => l.stage === 'won').length, l: 'Deals won' },
          { v: suppressed.length, l: 'Suppressed', sub: 'never again' },
        ]}
      />

      <HPanel title="Research a lead" hint="lead.researched — geography rides on every lead (jurisdiction guard)">
        <div className="grid grid-cols-1 sm:grid-cols-[1.2fr_1fr_auto_auto] gap-3 items-end">
          <Field label="Who">
            <TextInput value={name} onChange={setName} placeholder="e.g. Sharma & Assoc. (Chennai) · 4-lawyer firm" />
          </Field>
          <Field label="Niche / pain">
            <TextInput value={niche} onChange={setNiche} placeholder="e.g. hearing-date chaos · GST recon" />
          </Field>
          <Field label="Geo">
            <PickRow options={['IN', 'other']} value={geo} onPick={setGeo} />
          </Field>
          <Btn tone="primary" onClick={add}>Add lead</Btn>
        </div>
        {msg && (
          <div className="mt-3 text-[12px] leading-[18px] break-words" style={{ fontFamily: UI, color: msg.tone === 'err' ? COLOR.red : 'var(--accent)' }}>
            {msg.text}
          </div>
        )}
      </HPanel>

      {leads.length === 0 ? (
        <HPanel title="The funnel">
          <Empty icon={Funnel} title="No leads yet" hint="Not a zero: this funnel has simply never fired. Research the first one above." />
        </HPanel>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6 gap-3 items-start mb-4">
          {STAGES.map((st) => {
            const inStage = leads.filter((l) => l.stage === st.id)
            return (
              <div key={st.id} className="min-w-0 p-3" style={{ background: 'var(--bg-2)', border: '1px solid var(--line-1)', borderRadius: 'var(--r-lg)', boxShadow: 'var(--shadow-card)' }}>
                <div className="flex items-center gap-2 mb-2.5">
                  <span aria-hidden="true" className="w-[6px] h-[6px] rounded-full shrink-0" style={{ background: st.color }} />
                  <span className="text-[11px] uppercase tracking-[0.08em] truncate" style={{ fontFamily: UI, fontWeight: 600, color: 'var(--text-3)' }}>{st.name}</span>
                  <span className="text-[11px] tnum ml-auto shrink-0" style={{ fontFamily: MONO, color: 'var(--text-3)' }}>{inStage.length}</span>
                </div>
                <div className="space-y-2">
                  {inStage.map((l) => (
                    <div key={l.leadId} className="min-w-0 p-3" style={{ ...CARD, opacity: l.suppressed ? 0.55 : 1 }}>
                      <div className="text-[13px] leading-[18px] break-words mb-0.5" style={{ fontFamily: UI, fontWeight: 600, color: 'var(--text-1)' }}>{l.name}</div>
                      <div className="text-[11.5px] leading-[16px] break-words" style={{ fontFamily: UI, color: 'var(--text-3)' }}>
                        {l.niche} · {l.geo}
                      </div>
                      <div className="text-[11.5px] leading-[16px] mb-2.5" style={{ fontFamily: UI, color: 'var(--text-3)' }}>
                        touches <span className="tnum" style={{ fontFamily: MONO }}>{leadTouchesInWindow(l)}/{LEADS_TOUCH_CAP}</span> this window
                      </div>
                      {l.suppressed && (
                        <div className="mb-2">
                          <Chip tone="red">Suppressed</Chip>
                        </div>
                      )}
                      <div className="flex flex-col gap-1.5">
                        {(st.id === 'researched' || st.id === 'contacted') && !l.suppressed && <Btn small onClick={() => send(l)}>Send outreach</Btn>}
                        {st.id === 'contacted' && <Btn small onClick={() => act(l, 'outreach.replied', `Reply from ${l.name} — auto-stop engaged · triage: interested`, { triage: 'interested' })}>Mark replied</Btn>}
                        {st.id === 'replied' && <Btn small onClick={() => act(l, 'meeting.booked', `Meeting booked with ${l.name} — needs-you: it is on your calendar`)}>Book meeting</Btn>}
                        {(st.id === 'meeting' || st.id === 'replied') && (
                          <>
                            <Btn small onClick={() => act(l, 'deal.won', `Deal WON: ${l.name} — first real revenue path opens (revenue.received only on actual ₹)`)}>Won</Btn>
                            <Btn small onClick={() => act(l, 'deal.lost', `Deal lost: ${l.name} — reason logged for calibration`)}>Lost</Btn>
                          </>
                        )}
                        {!l.suppressed && st.id !== 'won' && st.id !== 'lost' && (
                          <Btn small tone="danger" onClick={() => act(l, 'lead.suppressed', `Suppressed: ${l.name} — unsubscribe honored instantly, survives campaigns`, { reason: 'manual' })}>Suppress</Btn>
                        )}
                      </div>
                    </div>
                  ))}
                  {inStage.length === 0 && <div className="text-[12px] py-3 text-center" style={{ fontFamily: UI, color: 'var(--text-3)' }}>—</div>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
        <HPanel title="The caps" hint="values in config, enforcement in code" tone={sentToday >= LEADS_DAILY_CAP ? 'amber' : undefined}>
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-[12.5px] shrink-0" style={{ fontFamily: UI, color: 'var(--text-2)' }}>daily submitted sends</span>
            <div className="flex-1 min-w-0"><Meter value={sentToday / LEADS_DAILY_CAP} tone={sentToday >= LEADS_DAILY_CAP ? 'critical' : sentToday > 14 ? 'warn' : 'blue'} /></div>
            <span className="text-[12px] tnum shrink-0" style={{ fontFamily: MONO, color: 'var(--text-2)' }}>{sentToday}/{LEADS_DAILY_CAP}</span>
          </div>
          <ul className="mt-3 list-disc pl-4 space-y-1 text-[12px] leading-[18px] marker:text-(--text-3)" style={{ fontFamily: UI, color: 'var(--text-3)' }}>
            <li>≤2 touches per lead in any rolling 7-day window</li>
            <li>auto-stop on reply</li>
            <li>send window: IST business hours</li>
            <li>first bounce → HOLD</li>
            <li>spam complaint → FROZEN + <span style={{ fontFamily: MONO }}>incident.raised</span></li>
          </ul>
        </HPanel>
        <HPanel title="Suppression ledger" hint="event-backed, derived state · no way to reset it">
          {suppressed.length === 0 ? (
            <Empty icon={Prohibit} title="Empty" hint="And empty is the honest state. A suppressed lead lands here and never leaves." />
          ) : (
            <div className="-mx-2">
              {suppressed.map((l) => (
                <div key={l.leadId} className="flex items-center gap-2.5 px-2 py-[7px] text-[13px] min-w-0 transition-colors duration-200 hover:bg-(--bg-3)" style={{ borderBottom: '1px solid var(--line-1)', borderRadius: 'var(--r-sm)' }}>
                  <span aria-hidden="true" className="shrink-0" style={{ color: COLOR.red }}>✕</span>
                  <span className="truncate min-w-0" style={{ fontFamily: UI, color: 'var(--text-1)' }}>{l.name}</span>
                  <span className="text-[12px] shrink-0 ml-auto" style={{ fontFamily: UI, color: 'var(--text-3)' }}>never contacted again</span>
                </div>
              ))}
            </div>
          )}
        </HPanel>
      </div>
    </>
  )
}
