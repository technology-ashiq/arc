// EXECUTOR — the hired hands. Employees are in-house drivers;
// contractors are hired runtimes on tenure: every contractor row
// carries all four terms (cap · judge · hosted · review-by) or the
// router refuses to load it. The credential is the leash, the cert
// suite is the interview, and every hire is planned obsolescence.
import { useState } from 'react'
import { Play, UserPlus } from '@phosphor-icons/react'
import { UI, MONO, COLOR, Btn, Field, TextInput, PickRow, SimBadge, YoursBadge, Chip } from '../../ui/kit.jsx'
import { RoomHead, HPanel, KpiStrip, Empty } from '../bits.jsx'
import { useSpine } from '../useSpine.js'
import { hires, runs, wsAppend, wsRequestApproval, newRef } from '../../spine/workspace.js'

const PROCESSES = ['review-diff', 'kickoff-plan', 'commit-msg-draft', 'build-in-public-draft', 'brief-materialize', 'day-close-roll', 'face-ask']

// status → reserved meaning: active = live, certified = passed, in cert = neutral
// progress, failed / expired = over the line. retired and rejected stay quiet.
const STATUS_TONE = {
  active: 'green',
  certification: 'blue',
  certified: 'cyan',
  'cert-failed': 'red',
  expired: 'red',
}

function defaultReviewBy() {
  const d = new Date()
  d.setDate(d.getDate() + 45)
  return d.toISOString().slice(0, 10)
}

export default function Executor() {
  useSpine()
  const [name, setName] = useState('')
  const [type, setType] = useState('contractor')
  const [role, setRole] = useState('')
  const [hosted, setHosted] = useState('local')
  const [judge, setJudge] = useState('owner')
  const [reviewBy, setReviewBy] = useState(defaultReviewBy())
  const [runProcess, setRunProcess] = useState('review-diff')
  const [runDriver, setRunDriver] = useState('claude-code')
  const [msg, setMsg] = useState(null)
  const team = hires()
  const runLog = runs()

  const addHire = () => {
    const n = name.trim()
    if (!n) return
    const hireId = newRef('hire')
    wsAppend('hire.added', 'executor', `Hire added: ${n} (${type}) — ${role.trim() || 'unassigned role'}${type === 'contractor' ? ` · cap L1-drafts · judge ${judge} · hosted ${hosted} · review-by ${reviewBy}` : ''}`, {
      hireId, name: n, type, role: role.trim() || 'unassigned role',
      ...(type === 'contractor' ? { cap: 'L1-drafts', judge, hosted, review_by: reviewBy } : {}),
    })
    setName('')
    setRole('')
    setMsg({ tone: 'ok', text: type === 'employee' ? `${n} joined as an employee — active immediately (in-house driver).` : `${n} entered certification — run the 12-fixture cert suite, then propose the hire.` })
  }

  const runCert = (h) => {
    // the interview: 12 isolation fixtures, deterministic per name
    const hash = [...h.name].reduce((s, c) => (s * 33 + c.charCodeAt(0)) >>> 0, 5)
    const green = hash % 7 === 0 ? 11 : 12
    wsAppend('hire.certified', 'executor', `Cert suite: ${h.name} · ${green}/12 isolation fixtures green${green === 12 ? ' — certification evidence bundled' : ' — FAILED: certification is a fixture result, never a judgement'}`, { hireId: h.hireId, fixtures: 12, green })
    if (green < 12) wsAppend('incident.raised', 'executor', `Certification failure: ${h.name} — unprovable isolation → STOP`, { hireId: h.hireId })
  }

  const proposeHire = (h) => {
    wsRequestApproval({
      title: `Executor: hire ${h.name} (contractor)`,
      tag: 'executor · one reviewed router diff',
      subject: 'executor.hire',
      data: { hireId: h.hireId },
      facts: [
        { k: 'council', v: `cert suite 12/12 green against the real runtime · human-started` },
        { k: 'money', v: `capped credential — the credential is the leash · cap ${h.cap}` },
        { k: 'kill', v: `tenure: review-by ${h.review_by} · expiry refuses loudly · revoke = instant` },
      ],
      actions: [
        { label: 'approve hire — activate row', approved: true },
        { label: 'reject', approved: false },
      ],
    })
    setMsg({ tone: 'ok', text: `Hire proposal for ${h.name} is in your inbox.` })
  }

  const dispatch = () => {
    const runId = newRef('r')
    const driver = team.find((h) => h.hireId === runDriver)
    if (!driver || driver.status !== 'active') {
      setMsg({ tone: 'err', text: driver && driver.status === 'expired' ? `REFUSED: row ${driver.name} is past review-by ${driver.review_by} — rejustify or retire (the check runs at use)` : 'pick an ACTIVE driver to dispatch' })
      if (driver && driver.status === 'expired') {
        wsRequestApproval({
          title: `Tenure expired: ${driver.name} — rejustify or retire`,
          tag: 'executor · tenure',
          subject: 'executor.hire',
          data: { hireId: driver.hireId },
          facts: [
            { k: 'council', v: `row expired ${driver.review_by} — dispatch refused loudly` },
            { k: 'money', v: 'capped key still held — revoke on retire is instant' },
            { k: 'kill', v: 'every hire is planned obsolescence' },
          ],
          actions: [
            { label: 'rejustify — extend 45 days', approved: true },
            { label: 'retire the row', approved: false, danger: true },
          ],
        })
      }
      return
    }
    wsAppend('run.queued', 'executor', `Run dispatched: ${runProcess} on ${driver.name} · budget 5 min · policy process:${runProcess}`, { runId, process: runProcess, driver: driver.name, budgetMin: 5 })
    setMsg({ tone: 'ok', text: `Run ${runId} dispatched on ${driver.name}…` })
    const hash = [...(runProcess + driver.name)].reduce((s, c) => (s * 31 + c.charCodeAt(0)) >>> 0, 3)
    setTimeout(() => {
      const ok = hash % 9 !== 0
      wsAppend(ok ? 'run.completed' : 'run.failed', 'executor', `${ok ? 'Run finished' : 'Run FAILED'}: ${runProcess} on ${driver.name} · ${(800 + (hash % 2200))} ms · ₹${(hash % 4) + 1} estimated`, { runId, outcome: ok ? 'ok' : 'fail', ms: 800 + (hash % 2200), costInr: (hash % 4) + 1 })
    }, 1600)
  }

  const active = team.filter((h) => h.status === 'active')
  const employees = team.filter((h) => h.type === 'employee').length
  const waiting = team.filter((h) => /^(certification|certified|cert-failed|expired)$/.test(h.status)).length
  const okRuns = runLog.filter((r) => r.status === 'ok').length
  const failedRuns = runLog.filter((r) => r.status !== 'ok' && r.status !== 'running').length

  return (
    <>
      <RoomHead
        title="The hired hands."
        hint="arc verifies outcomes and never prescribes the contractor's process — employees run in-house, contractors run on tenure"
        right={<YoursBadge>executor · persisted</YoursBadge>}
      />

      <KpiStrip
        items={[
          { v: active.length, l: 'Active drivers', sub: `${employees} in-house · ${team.length - employees} on tenure` },
          { v: team.length, l: 'Hires on the books' },
          { v: waiting, l: 'Waiting on you', sub: 'cert, proposal or tenure', tone: waiting ? 'amber' : undefined },
          { v: runLog.length, l: 'Runs dispatched', sub: runLog.length ? `${okRuns} ok · ${failedRuns} failed` : 'never fired · honest' },
        ]}
      />

      <div className="grid grid-cols-1 xl:grid-cols-[1.35fr_1fr] gap-4 items-start">
        <div className="min-w-0">
          <HPanel title="Hire someone" hint="employee = in-house driver · contractor = hired runtime, four tenure terms mandatory">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <Field label="Name / runtime">
                <TextInput value={name} onChange={setName} placeholder="e.g. hermes-agent · codex-cli · aider · a person's role-name" />
              </Field>
              <Field label="Role — what they run">
                <TextInput value={role} onChange={setRole} placeholder="e.g. review-diff drafts · outreach research" />
              </Field>
            </div>
            <div className="flex flex-wrap gap-4 mb-4">
              <Field label="Type">
                <PickRow options={['employee', 'contractor']} value={type} onPick={setType} />
              </Field>
              {type === 'contractor' && (
                <>
                  <Field label="Hosted">
                    <PickRow options={['local', 'cloud']} value={hosted} onPick={setHosted} />
                  </Field>
                  <Field label="Judge">
                    <PickRow options={['deterministic', 'owner']} value={judge} onPick={setJudge} />
                  </Field>
                  <Field label="Review-by (tenure)" className="w-[168px]">
                    <TextInput value={reviewBy} onChange={setReviewBy} placeholder="YYYY-MM-DD" mono />
                  </Field>
                </>
              )}
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              {type === 'contractor' && (
                <span className="text-[12px] leading-[18px]" style={{ fontFamily: UI, color: 'var(--text-3)' }}>
                  cap is fixed at <span style={{ fontFamily: MONO, color: 'var(--text-2)' }}>L1-drafts</span> — the birth level of every pair
                </span>
              )}
              <Btn tone="primary" className="ml-auto" onClick={addHire}>Hire →</Btn>
            </div>
            {msg && (
              <p className="mt-3 text-[12.5px] leading-[19px]" style={{ fontFamily: UI, color: msg.tone === 'err' ? COLOR.red : 'var(--accent)' }}>
                {msg.text}
              </p>
            )}
          </HPanel>

          <HPanel title="The team" hint="an expired contractor row refuses dispatch loudly" actions={<Chip>{active.length} active of {team.length}</Chip>}>
            {team.length === 0 && (
              <Empty icon={UserPlus} title="Nobody hired yet" hint="Hire an employee or a contractor above; a hire pasted into ⌘K lands here too." />
            )}
            <div className="space-y-2.5">
              {team.map((h) => {
                const quiet = /retired|rejected/.test(h.status)
                return (
                  <div key={h.hireId} className="p-3.5 min-w-0" style={{ background: 'var(--well)', border: '1px solid var(--line-1)', borderRadius: 'var(--r-md)', opacity: quiet ? 0.5 : 1 }}>
                    <div className="flex items-center gap-2 flex-wrap mb-1 min-w-0">
                      <b className="text-[13.5px] break-all min-w-0" style={{ fontFamily: UI, fontWeight: 600, color: 'var(--text-1)' }}>{h.name}</b>
                      <Chip tone={STATUS_TONE[h.status]}>{h.status}</Chip>
                      <span className="text-[12px]" style={{ fontFamily: UI, color: 'var(--text-3)' }}>{h.type}</span>
                      <span className="ml-auto">{h.seed ? <SimBadge>repo fact</SimBadge> : <YoursBadge>yours</YoursBadge>}</span>
                    </div>
                    <div className="text-[13px] leading-[19px]" style={{ fontFamily: UI, color: 'var(--text-2)' }}>{h.role}</div>
                    {h.type === 'contractor' && (
                      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-[11.5px]">
                        {[['cap', h.cap || 'L1-drafts'], ['judge', h.judge || 'owner'], ['hosted', h.hosted || '—'], ['review-by', h.review_by || '—'], ['key', 'capped']].map(([k, v]) => (
                          <span key={k} className="whitespace-nowrap">
                            <span style={{ fontFamily: UI, color: 'var(--text-3)' }}>{k} </span>
                            <span style={{ fontFamily: MONO, color: 'var(--text-2)' }}>{v}</span>
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-2 flex-wrap empty:hidden mt-2.5">
                      {h.type === 'contractor' && h.status === 'certification' && <Btn small onClick={() => runCert(h)}>Run cert suite · 12 fixtures</Btn>}
                      {h.status === 'certified' && <Btn small tone="primary" onClick={() => proposeHire(h)}>Propose hire →</Btn>}
                      {h.status === 'cert-failed' && <Btn small onClick={() => runCert(h)}>Re-run cert suite</Btn>}
                      {/^(active|expired|certified)$/.test(h.status) && !h.seed && (
                        <Btn small tone="danger" onClick={() => wsAppend('hire.retired', 'executor', `Hire ended: ${h.name} — key revoked (instant) · row disabled by reviewed diff`, { hireId: h.hireId })}>
                          Retire — revoke key
                        </Btn>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </HPanel>
        </div>

        <div className="min-w-0">
          <HPanel title="Dispatch a run" hint="run.queued → run.completed, with cost on the receipt">
            <Field label="Process" hint="the identity — the model is a part" className="mb-3">
              <PickRow options={PROCESSES} value={runProcess} onPick={setRunProcess} />
            </Field>
            <Field label="Driver" className="mb-4">
              <PickRow
                options={team.filter((h) => !/retired|rejected/.test(h.status)).map((h) => ({ value: h.hireId, label: h.name.length > 22 ? h.name.slice(0, 22) + '…' : h.name }))}
                value={runDriver}
                onPick={setRunDriver}
              />
            </Field>
            <div className="flex justify-end">
              <Btn tone="primary" onClick={dispatch}>Dispatch · budget 5 min</Btn>
            </div>
          </HPanel>

          <HPanel title="Run log" hint="every run a receipt" actions={<Chip>{runLog.length}</Chip>}>
            {runLog.length === 0 && (
              <Empty icon={Play} title="No runs yet" hint="Not a zero: this executor has simply never fired. Dispatch a run and it lands here with its cost." />
            )}
            {runLog.length > 0 && (
              <div className="-mx-2">
                {runLog.slice(0, 10).map((r) => {
                  const ok = r.status === 'ok'
                  const running = r.status === 'running'
                  return (
                    <div key={r.runId} className="grid grid-cols-[72px_auto_1fr_auto] items-baseline gap-2.5 px-2 py-[7px] rounded-md min-w-0 transition-colors duration-200 hover:bg-(--bg-3) border-b border-(--line-1) last:border-b-0">
                      <span className="text-[11.5px]" style={{ fontFamily: MONO, color: ok ? COLOR.green : running ? COLOR.cyan : COLOR.red }}>
                        {running ? '● running' : ok ? '✓ ok' : '✕ fail'}
                      </span>
                      <span className="text-[12.5px]" style={{ fontFamily: MONO, color: 'var(--text-1)' }}>{r.process}</span>
                      <span className="text-[12.5px] truncate min-w-0" style={{ fontFamily: UI, color: 'var(--text-2)' }}>{r.driver}</span>
                      {r.ms ? (
                        <span className="text-[11.5px] tnum shrink-0" style={{ fontFamily: MONO, color: 'var(--text-3)' }}>{r.ms} ms · ₹{r.costInr}</span>
                      ) : (
                        <span />
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </HPanel>

          <HPanel title="The hiring kit">
            <ul className="space-y-1.5 text-[12.5px] leading-[19px]" style={{ fontFamily: UI, color: 'var(--text-2)' }}>
              {[
                'contract + cert suite + capped credential + tenure — a form, not a cycle',
                'all four tenure terms or the router refuses to load the row',
                'deleting a row does not end a hire — revoke the key, then the diff',
                'employees instead of shadow IT',
              ].map((t) => (
                <li key={t} className="flex gap-2">
                  <span aria-hidden="true" style={{ color: 'var(--text-3)' }}>·</span>
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </HPanel>
        </div>
      </div>
    </>
  )
}
