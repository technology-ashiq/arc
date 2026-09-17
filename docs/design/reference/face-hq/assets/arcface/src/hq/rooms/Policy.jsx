// POLICY — "Deny by default. Every capability earns its level."
// The subject table: one row per process (plus session:interactive),
// eight capabilities each, two keys per pair — the CEILING (a repo
// edit in a reviewed diff, this app refuses to fake one) and the CAP
// (event-earned, rises only on your stamp citing trial-ledger
// evidence). effective = min(ceiling, cap). Demotion never needs a key.
// The capability ladder (the old autonomy room) lives here now.
import { useState } from 'react'
import { Receipt } from '@phosphor-icons/react'
import { UI, MONO, COLOR, Btn, Field, TextInput, SimBadge, YoursBadge, Chip, tint } from '../../ui/kit.jsx'
import { RoomHead, HPanel, KpiStrip, EventRow, ReceiptDrawer, Empty } from '../bits.jsx'
import { useSpine } from '../useSpine.js'
import { spine, changeAutonomy } from '../../spine/store.js'
import { wsAppend, wsRequestApproval, newRef } from '../../spine/workspace.js'
import { policySubjects, policyLadder, LEVELS } from '../../spine/registries.js'
import { ladder } from '../../spine/derive.js'
import { FACTS } from '../../data/arcFacts.js'

const L_STYLE = {
  L0: { bg: 'var(--bg-4)', c: 'var(--text-2)' },
  L1: { bg: tint('cyan', 0.08), c: 'var(--accent)' },
  L2: { bg: tint('cyan', 0.18), c: 'var(--accent)' },
  L3: { bg: 'var(--accent)', c: 'var(--on-fill)' },
}
const NO_KEY_CAPS = new Set(['message', 'publish', 'deploy', 'spend'])
const TRAIL_KINDS = new Set(['policy.proposed', 'policy.changed', 'autonomy.changed', 'lane.born'])
const SUBJECT_RE = /^process:[a-z0-9-]+$/
const lv = (l) => Math.max(0, LEVELS.indexOf(l))
const PROSE = { fontFamily: UI, color: 'var(--text-2)' }
const NOTE = { fontFamily: UI, color: 'var(--text-3)' }
const SRC = { fontFamily: MONO, color: 'var(--text-3)' }
const WELL = { background: 'var(--well)', border: '1px solid var(--line-1)', borderRadius: 'var(--r-md)' }
const TH = 'text-[11px] uppercase tracking-[0.08em]'
const TH_STYLE = { fontFamily: UI, fontWeight: 600, color: 'var(--text-3)' }
const COLS = 'grid-cols-[72px_48px_48px_60px_minmax(0,1fr)]'

function Lvl({ level, small }) {
  const st = L_STYLE[level] || L_STYLE.L0
  return (
    <span className={`${small ? 'w-7 h-[18px] text-[10.5px]' : 'w-9 h-[22px] text-[12px]'} inline-flex items-center justify-center shrink-0 tnum`} style={{ fontFamily: MONO, fontWeight: 600, background: st.bg, color: st.c, borderRadius: 'var(--r-sm)' }}>
      {level}
    </span>
  )
}

export default function Policy() {
  useSpine()
  const [open, setOpen] = useState(null)
  const [name, setName] = useState('')
  const [note, setNote] = useState('')
  const [msg, setMsg] = useState(null)
  const [receipt, setReceipt] = useState(null)
  const subjects = policySubjects()
  const rungs = ladder()
  const trail = spine.events.filter((e) => TRAIL_KINDS.has(e.kind) && (e.kind !== 'lane.born' || (e.payload && e.payload.subject))).slice(-6).reverse()
  const waiting = subjects.reduce((n, s) => n + s.caps.filter((c) => c.proposed).length, 0)

  const canPropose = (s, c) => lv(c.capLevel) < lv(c.ceiling) && !(NO_KEY_CAPS.has(c.cap) && c.ceiling === 'L0') && s.e2.length === 0

  const propose = (s, c) => {
    const to = LEVELS[lv(c.capLevel) + 1]
    const cites = FACTS.memory.trial.filter((t) => (t.capability || '').toLowerCase().includes(c.cap)).length
    const evidence = cites ? `trial-ledger rows citing ${c.cap}: ${cites}` : `no trial-ledger row cites ${c.cap} — the proposal carries no evidence`
    const proposalId = newRef('pol')
    wsAppend('policy.proposed', 'policy', `policy: ${s.subject} · ${c.cap} ${c.capLevel}→${to} proposed · cap rises only on your stamp (POL-A) · ${evidence}`, { proposalId, subject: s.subject, cap: c.cap, from: c.capLevel, to, evidence })
    wsRequestApproval({
      title: `policy: ${s.subject} · ${c.cap} ${c.capLevel}→${to}`,
      tag: 'policy · two keys',
      subject: 'policy.change',
      data: { proposalId, subject: s.subject, cap: c.cap, to },
      facts: [
        { k: 'council', v: evidence },
        { k: 'money', v: 'spend stays L0 for every subject — no ₹ moves on this stamp' },
        { k: 'kill', v: `ceiling ${c.ceiling} is a repo edit in a reviewed diff — this stamp raises only the cap; effective = min(ceiling, cap)` },
      ],
    })
    setMsg(`${s.subject} · ${c.cap} ${c.capLevel}→${to} is in your inbox — nothing moved yet.`)
  }

  const demote = (s, c) => {
    wsAppend('policy.changed', 'policy', `policy: ${s.subject} · ${c.cap} ${c.capLevel}→L1 · incident — auto-demote, no key needed (A4)`, { subject: s.subject, cap: c.cap, from: c.capLevel, to: 'L1', reason: 'incident — auto-demote (A4)' })
    setMsg(`${s.subject} · ${c.cap} dropped to L1 — trust is re-earned, never argued back.`)
  }

  const declare = () => {
    const subject = name.trim()
    if (!SUBJECT_RE.test(subject) && subject !== 'session:interactive') {
      setMsg({ err: 'a subject is process:<name> (lowercase, digits, dashes) — ADR-0504 closes the form' })
      return
    }
    if (subjects.some((s) => s.subject === subject)) {
      setMsg({ err: `${subject} already has a row — declare once, promote by evidence` })
      return
    }
    wsAppend('lane.born', 'policy', `policy: subject ${subject} declared · born at L1 on every pair, read L3 · nothing granted by the row itself`, { subject, note: note.trim() || 'declared by you' })
    setName('')
    setNote('')
    setMsg(`${subject} is in the table at L1 — deny by default, every pair earns its level.`)
  }

  return (
    <>
      <RoomHead title="Deny by default. Every capability earns its level." hint="the subject table — what each process may touch, and the two keys that must turn for it to change" right={<YoursBadge>policy · caps persisted</YoursBadge>} />

      <KpiStrip
        items={[
          { v: subjects.length, l: 'Subjects', sub: subjects.filter((s) => !s.seed).length + ' declared by you' },
          { v: subjects.reduce((n, s) => n + s.caps.length, 0), l: 'Capability pairs', sub: 'effective = min(ceiling, cap)' },
          { v: waiting, l: 'Caps proposed', sub: waiting ? 'in your inbox' : 'nothing to stamp', tone: waiting ? 'amber' : undefined },
          { v: trail.length, l: 'Policy receipts' },
        ]}
      />

      <div className="grid grid-cols-1 xl:grid-cols-[1.4fr_1fr] gap-4 items-start">
        <div className="min-w-0">
          <HPanel title={`The subject table — ${subjects.length} subjects`} hint="ceiling · cap · effective = min — click a row for the eight pairs">
            <div className="space-y-2.5">
              {subjects.map((s) => {
                const isOpen = open === s.subject
                return (
                  <div key={s.subject} className="p-3.5 min-w-0" style={{ ...WELL, borderColor: isOpen ? 'var(--line-2)' : 'var(--line-1)' }}>
                    <button type="button" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : s.subject)} className="w-full text-left cursor-pointer min-w-0 rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-(--accent)">
                      <div className="flex items-center gap-2.5 flex-wrap mb-1">
                        <b className="text-[13.5px] break-all" style={{ fontFamily: MONO, fontWeight: 600, color: 'var(--text-1)' }}>{s.subject}</b>
                        <span className="text-[12px]" style={NOTE}>
                          ceiling <span style={{ fontFamily: MONO, color: 'var(--text-2)' }}>{s.ceilingNote}</span>
                        </span>
                        {s.seed ? <SimBadge>repo fact · {s.src}</SimBadge> : <YoursBadge>yours</YoursBadge>}
                        {s.e2.length > 0 && <span className="text-[12px]" style={{ fontFamily: UI, fontWeight: 500, color: COLOR.red }}>e2 — never above L1 · {s.e2.join(', ')}</span>}
                      </div>
                      <div className="text-[12px] leading-[18px] mb-2 break-words" style={NOTE}>{s.notes}</div>
                      <div className="flex flex-wrap gap-1.5">
                        {s.caps.map((c) => (
                          <span key={c.cap} className="inline-flex items-center gap-1.5 h-[24px] pl-2 pr-[3px] rounded-full text-[11px]" style={{ fontFamily: MONO, color: 'var(--text-2)', border: '1px solid var(--line-1)' }}>
                            {c.cap} <Lvl level={c.effective} small />
                          </span>
                        ))}
                      </div>
                    </button>
                    {isOpen && (
                      <div className="mt-3 pt-2 min-w-0" style={{ borderTop: '1px solid var(--line-1)' }}>
                        <div className={`grid ${COLS} gap-x-2 py-1 ${TH}`} style={TH_STYLE}>
                          <span>cap</span><span>ceiling</span><span>cap</span><span>effective</span><span>roots · action</span>
                        </div>
                        {s.caps.map((c) => (
                          <div key={c.cap} className={`grid ${COLS} gap-x-2 items-center py-1.5 text-[12.5px] transition-colors duration-200 hover:bg-(--bg-3)`} style={{ borderBottom: '1px solid var(--line-1)' }}>
                            <span className="truncate" style={{ fontFamily: MONO, color: 'var(--text-1)' }}>{c.cap}</span>
                            <span><Lvl level={c.ceiling} small /></span>
                            <span><Lvl level={c.capLevel} small /></span>
                            <span><Lvl level={c.effective} small /></span>
                            <span className="flex items-center gap-2 flex-wrap min-w-0">
                              <span className="text-[11px] truncate max-w-full" style={SRC}>{c.roots ? c.roots.join(' · ') : c.declared ? 'no roots' : 'undeclared → L0'}</span>
                              {c.proposed ? (
                                <span className="text-[12px]" style={{ fontFamily: UI, fontWeight: 500, color: COLOR.amber }}>proposed →{c.proposed} · in your inbox</span>
                              ) : canPropose(s, c) ? (
                                <Btn small onClick={() => propose(s, c)}>Propose cap ↑</Btn>
                              ) : null}
                              {lv(c.capLevel) > 1 && <Btn small tone="danger" onClick={() => demote(s, c)}>Demote</Btn>}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </HPanel>

          <HPanel title="Declare a subject" hint="lane.born → a row born at L1 · no row in the policy file, no job">
            <form className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-3" onSubmit={(e) => { e.preventDefault(); declare() }}>
              <Field label="Subject" hint="process:<name>"><TextInput mono value={name} onChange={setName} placeholder="process:weekly-digest" /></Field>
              <Field label="Note"><TextInput value={note} onChange={setNote} placeholder="processes/weekly-digest.process.yaml" /></Field>
              <div className="flex items-end"><Btn tone="primary" onClick={declare}>Declare →</Btn></div>
            </form>
            {msg && <div className="mt-3 text-[12.5px] leading-[19px] break-words" style={{ fontFamily: UI, color: msg.err ? COLOR.red : COLOR.green }}>{msg.err || msg}</div>}
          </HPanel>

          <HPanel title="The ladder — per capability (trial-ledger evidence)" hint="L0 observe · L1 draft · L2 act in caps · L3 act + weekly digest">
            <div className="-mx-2">
              {rungs.map((row) => {
                const canPromote = /proposed|promotion/.test(row.note) && row.level !== 'L3' && row.cap !== 'trading.real-money' && row.cap !== 'pricing.change'
                const canDemote = row.level !== 'L0' && row.level !== 'L1'
                return (
                  <div key={row.cap} className="flex items-center gap-3 px-2 py-2.5 flex-wrap transition-colors duration-200 hover:bg-(--bg-3)" style={{ borderBottom: '1px solid var(--line-1)' }}>
                    <Lvl level={row.level} />
                    <div className="flex-1 min-w-[180px]">
                      <div className="text-[13px] truncate" style={{ fontFamily: MONO, color: 'var(--text-1)' }}>{row.cap}</div>
                      <div className="text-[12px] leading-[17px]" style={PROSE}>{row.note}</div>
                    </div>
                    <span className="text-[12px]" style={NOTE}>{row.cap2}</span>
                    {canPromote && <Btn small tone="green" onClick={() => changeAutonomy(row.cap, row.level, 'L' + (parseInt(row.level.slice(1)) + 1), 'trial-ledger evidence verified — promoted by owner')}>Promote</Btn>}
                    {canDemote && <Btn small tone="danger" onClick={() => changeAutonomy(row.cap, row.level, 'L1', 'incident drill — auto-demote demonstrated (A4)')}>Demote</Btn>}
                  </div>
                )
              })}
            </div>
          </HPanel>

          <HPanel title="The trail" hint="every proposal, rung and birth is a receipt">
            {trail.length === 0 && <Empty icon={Receipt} title="No policy receipt yet" hint="Every pair sits at its birth level. Propose a cap or declare a subject and the receipt lands here." />}
            {trail.length > 0 && (
              <div className="-mx-2">
                {trail.map((e) => (
                  <EventRow key={e.id} e={e} onReceipt={setReceipt} />
                ))}
              </div>
            )}
          </HPanel>
        </div>

        <div className="min-w-0">
          <HPanel title="The levels">
            <div className="space-y-2">
              {policyLadder().map((l) => (
                <div key={l.level} className="flex items-start gap-3">
                  <Lvl level={l.level} small />
                  <span className="text-[12.5px] leading-[18px]" style={PROSE}>{l.text}</span>
                </div>
              ))}
            </div>
          </HPanel>

          <HPanel title="Two keys">
            <div className="space-y-3">
              {FACTS.policy.twoKeys.map((k) => (
                <div key={k.key}>
                  <div className="text-[12.5px] mb-0.5" style={{ fontFamily: UI, fontWeight: 600, color: 'var(--text-1)' }}>{k.key}</div>
                  <div className="text-[12.5px] leading-[19px]" style={PROSE}>{k.text.replace(/^#\s*/, '')}</div>
                  <div className="text-[11px] mt-0.5 truncate" style={SRC}>{k.src}</div>
                </div>
              ))}
            </div>
          </HPanel>

          <HPanel title="Forever human — ungrantable">
            <div className="flex flex-wrap gap-1.5 mb-2">
              {FACTS.policy.ungrantableActions.map((f) => (
                <Chip key={f} mono tone="red">{f}</Chip>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {FACTS.policy.ungrantableResources.map((f) => (
                <Chip key={f} mono>{f}</Chip>
              ))}
            </div>
            <p className="text-[12.5px] leading-[19px]" style={PROSE}>no ceiling, no cap, no streak reaches these — excluded from every write grant regardless of level (ADR-0502).</p>
          </HPanel>

          <HPanel title="Deny by default">
            <div className="space-y-2">
              {FACTS.policy.defaults.map((d) => (
                <div key={d.key} className="text-[12.5px] leading-[19px]" style={PROSE}>
                  {d.text.replace(/^#\s*/, '')} <span className="text-[11px]" style={SRC}>{d.src}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 pt-3 space-y-1" style={{ borderTop: '1px solid var(--line-1)' }}>
              {FACTS.policy.docsRules.slice(0, 3).map((r) => (
                <div key={r} className="text-[12px] leading-[18px]" style={NOTE}>· {r}</div>
              ))}
            </div>
          </HPanel>
        </div>
      </div>

      <ReceiptDrawer ev={receipt} onClose={() => setReceipt(null)} />
    </>
  )
}
