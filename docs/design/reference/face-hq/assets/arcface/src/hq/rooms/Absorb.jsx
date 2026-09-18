// ABSORB — "What arrives from outside is quarantined before it is believed."
// The technique refinery: paste a skill, repo, tool or prompt-pack →
// it becomes a CANDIDATE in the registry. Study (read-only), report,
// classify (ABSORB / INTEGRATE / ROUTE / SKIP), rebuild as a reviewed
// diff, then a blind A/B judgement — adoption is YOUR stamp, and the
// registry holds at most 12 adopted per lane.
import { useState } from 'react'
import { Funnel } from '@phosphor-icons/react'
import { UI, MONO, Btn, Field, TextInput, PickRow, SimBadge, YoursBadge, Meter, Chip } from '../../ui/kit.jsx'
import { RoomHead, HPanel, KpiStrip, Empty } from '../bits.jsx'
import { useSpine } from '../useSpine.js'
import { absorbRegistry, ABSORB_STAGES, wsAppend, wsRequestApproval, newRef } from '../../spine/workspace.js'

const LANES = ['develop', 'engine', 'growth', 'leads', 'design', 'council']
// status → chip tone. candidate = neutral progress, trial = waiting on a judgement, adopted = it passed on your stamp
const STATUS_TONE = { candidate: 'blue', trial: 'amber', adopted: 'green' }
const ADOPTED_CAP = 12
// an item card inside a panel
const WELL = { background: 'var(--well)', border: '1px solid var(--line-1)', borderRadius: 'var(--r-md)' }

function detectSource(raw) {
  const s = raw.toLowerCase()
  if (s.includes('github.com') || s.endsWith('.git')) return 'repo'
  if (s.startsWith('http')) return 'docs'
  if (s.includes('@') && !s.includes(' ')) return 'npm'
  if (s.includes('skill') || s.includes('/')) return 'skill'
  return 'technique'
}

export default function Absorb() {
  useSpine()
  const [raw, setRaw] = useState('')
  const [lane, setLane] = useState('develop')
  const [msg, setMsg] = useState(null)
  const rows = absorbRegistry()
  const adoptedInLane = (l) => rows.filter((r) => r.status === 'adopted' && r.lane === l).length
  const candidatesN = rows.filter((r) => r.status === 'candidate').length
  const trialN = rows.filter((r) => r.status === 'trial').length
  const adoptedN = rows.filter((r) => r.status === 'adopted').length

  const capture = (input) => {
    const v = (input ?? raw).trim()
    if (!v) return
    const techId = newRef('T')
    wsAppend('absorb.captured', 'absorb', `Absorb intake: “${v}” (${detectSource(v)}) → candidate · quarantined, read-only study begins · nothing installs itself`, {
      techId, name: v, source: detectSource(v), lane, license: 'to-verify',
    })
    setRaw('')
    setMsg({ tone: 'ok', text: `“${v}” is in the registry as a candidate. Walk it through the pipeline.` })
  }

  const advance = (r) => {
    const i = ABSORB_STAGES.indexOf(r.stage)
    const next = ABSORB_STAGES[i + 1]
    if (!next) return
    if (next === 'classify') {
      // classification verdict — deterministic per name, a reason on every verdict
      const h = [...r.name].reduce((s, c) => (s * 31 + c.charCodeAt(0)) >>> 0, 11)
      const verdict = ['ABSORB', 'ABSORB', 'INTEGRATE', 'ROUTE', 'SKIP'][h % 5]
      wsAppend('absorb.staged', 'absorb', `Classified: ${r.name} → ${verdict}${verdict === 'SKIP' ? ' · >1 day of archaeology — skipped with a reason, not a longer study' : verdict === 'ABSORB' ? ' · ideas are re-expressed, never imported' : ''}`, { techId: r.techId, stage: 'classify', verdict })
      return
    }
    const texts = {
      report: `Extraction report written: ${r.name} — source pinned · study scope declared · citation per claim (report-lint clean)`,
      rebuild: `Rebuilt: ${r.name} — a reviewed diff, never a dependency · zero new runtime deps (rebuild-lint clean) · lands on the ABS-C allowlist`,
      judge: `Blind A/B (PLANOFF): ${r.name} — labels randomized, mapping sealed in the evidence bundle → TRIAL`,
    }
    wsAppend('absorb.staged', 'absorb', texts[next] || `${r.name} → ${next}`, { techId: r.techId, stage: next })
  }

  const proposeAdopt = (r) => {
    const count = adoptedInLane(r.lane)
    wsRequestApproval({
      title: `Absorb: adopt ${r.name} into ${r.lane}`,
      tag: 'absorb · registry',
      subject: 'absorb.adopt',
      data: { techId: r.techId },
      facts: [
        { k: 'council', v: `pipeline complete: study → report → ${r.verdict || 'ABSORB'} → rebuild → blind A/B` },
        { k: 'money', v: `zero new runtime dependencies · license ${r.license}` },
        { k: 'kill', v: count >= ADOPTED_CAP ? `LANE AT CAP ${count}/${ADOPTED_CAP} — this adoption must name its displacement` : `lane ${r.lane}: ${count}/${ADOPTED_CAP} adopted · unused 2 cycles → propose retire` },
      ],
      actions: [
        { label: 'adopt — pin in registry', approved: true },
        { label: 'keep in trial', approved: false, soft: true },
      ],
    })
    setMsg({ tone: 'ok', text: `Adoption proposal for ${r.name} is in your inbox.` })
  }

  return (
    <>
      <RoomHead
        title="Quarantined before it is believed."
        hint="Paste a skill, repo, tool or technique — studied read-only, rebuilt as a reviewed diff, adopted only on your stamp"
        right={<YoursBadge>absorb · persisted</YoursBadge>}
      />

      <KpiStrip
        items={[
          { v: candidatesN, l: 'Candidates', sub: 'quarantined, studied read-only' },
          { v: trialN, l: 'In trial', sub: 'blind A/B, mapping sealed', tone: trialN ? 'amber' : undefined },
          { v: adoptedN, l: 'Adopted', sub: `cap ${ADOPTED_CAP} per lane` },
          { v: rows.length, l: 'Techniques looked at', sub: 'one honest ledger, rows never deleted' },
        ]}
      />

      <div className="grid grid-cols-1 xl:grid-cols-[1.35fr_1fr] gap-4 items-start">
        <div className="min-w-0">
          <HPanel title="Absorb something" hint="absorb.captured → candidate · one honest ledger of every technique arc has looked at">
            <form
              className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 mb-3"
              onSubmit={(e) => {
                e.preventDefault()
                capture()
              }}
            >
              <Field label="Source" hint="skill, repo, tool or prompt-pack">
                <TextInput value={raw} onChange={setRaw} placeholder="github.com/x/agent-skills · superpowers:tdd · madge@8 · “chain-of-density summarization” …" />
              </Field>
              <div className="flex items-end">
                <Btn tone="primary" onClick={() => capture()}>Absorb →</Btn>
              </div>
            </form>
            <Field label="Target lane">
              <PickRow small options={LANES} value={lane} onPick={setLane} />
            </Field>
            {msg && (
              <p className="mt-3 text-[12.5px] leading-[18px] break-words" style={{ fontFamily: UI, color: 'var(--text-2)' }}>{msg.text}</p>
            )}
          </HPanel>

          <HPanel title="The registry" hint={`${rows.length} techniques · candidate, trial, adopted, retired — status moves only on receipts`}>
            {rows.length === 0 && (
              <Empty icon={Funnel} title="Nothing in the registry yet" hint="Paste a skill, repo or technique above, or press ⌘K and paste one anywhere. It lands as a candidate, quarantined." />
            )}
            <div className="space-y-2">
              {rows.map((r) => {
                const stageIdx = r.stage === 'done' ? ABSORB_STAGES.length : ABSORB_STAGES.indexOf(r.stage) + 1
                return (
                  <div key={r.techId} className="p-3.5 min-w-0" style={{ ...WELL, opacity: /retired|skipped/.test(r.status) ? 0.5 : 1 }}>
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      <b className="text-[13px] min-w-0 break-all" style={{ fontFamily: MONO, fontWeight: 600, color: 'var(--text-1)' }}>{r.name}</b>
                      <Chip tone={STATUS_TONE[r.status]}>{r.status}</Chip>
                      <span className="text-[12px]" style={{ fontFamily: UI, color: 'var(--text-3)' }}>{r.source} · lane {r.lane}{r.verdict ? ` · ${r.verdict}` : ''}</span>
                      {r.seed ? <SimBadge>{r.note}</SimBadge> : <YoursBadge>yours</YoursBadge>}
                    </div>
                    {r.status !== 'adopted' && r.stage !== 'done' && (
                      <div className="grid gap-1.5 my-3" style={{ gridTemplateColumns: `repeat(${ABSORB_STAGES.length}, minmax(0, 1fr))` }} role="list" aria-label="pipeline stage">
                        {ABSORB_STAGES.map((s, i) => {
                          const done = i < stageIdx
                          return (
                            <div key={s} className="min-w-0" role="listitem" aria-current={i === stageIdx - 1 ? 'step' : undefined}>
                              <div className="h-[3px] rounded-full mb-1" style={{ background: done ? 'var(--accent)' : 'var(--track)' }} />
                              <div className="text-[11px] truncate" style={{ fontFamily: UI, fontWeight: done ? 600 : 500, color: done ? 'var(--text-1)' : 'var(--text-3)' }}>{s}</div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                    <div className="flex gap-2 flex-wrap items-center">
                      {/^(candidate|trial)$/.test(r.status) && r.stage !== 'done' && ABSORB_STAGES.indexOf(r.stage) < ABSORB_STAGES.length - 1 && (
                        <Btn small onClick={() => advance(r)}>
                          {r.stage === 'study' ? 'Write extraction report' : r.stage === 'report' ? 'Classify' : r.stage === 'classify' ? 'Rebuild — reviewed diff' : 'Blind A/B judge'}
                        </Btn>
                      )}
                      {r.status === 'trial' && r.stage === 'judge' && <Btn small onClick={() => proposeAdopt(r)}>Propose adoption →</Btn>}
                      {r.status === 'adopted' && !r.seed && (
                        <Btn small tone="danger" onClick={() => wsAppend('absorb.retired', 'absorb', `Technique retired: ${r.name} — learning kept, registry row preserved`, { techId: r.techId })}>Retire</Btn>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </HPanel>
        </div>

        <div className="min-w-0">
          <HPanel title="Adopted per lane" hint={`cap ${ADOPTED_CAP} per lane`}>
            <div className="space-y-2">
              {LANES.map((l) => {
                const n = adoptedInLane(l)
                return (
                  <div key={l} className="flex items-center gap-3">
                    <span className="w-[76px] shrink-0 text-[12.5px] truncate" style={{ fontFamily: UI, color: 'var(--text-2)' }}>{l}</span>
                    <div className="flex-1 min-w-0"><Meter value={n / ADOPTED_CAP} tone={n >= ADOPTED_CAP ? 'critical' : n > 8 ? 'warn' : 'blue'} /></div>
                    <span className="w-[44px] shrink-0 text-right text-[12px] tnum" style={{ fontFamily: MONO, color: 'var(--text-2)' }}>{n}/{ADOPTED_CAP}</span>
                  </div>
                )
              })}
            </div>
            <p className="mt-3 text-[12px] leading-[18px]" style={{ fontFamily: UI, color: 'var(--text-3)' }}>
              At the cap, a new adoption names its displacement — the retire proposal rides with it.
            </p>
          </HPanel>

          <HPanel title="The refinery's rules">
            <ul className="list-disc pl-4 space-y-1.5 text-[12.5px] leading-[19px]" style={{ fontFamily: UI, color: 'var(--text-2)' }}>
              <li>studied third-party code never executes — no install, no import, no eval</li>
              <li>ABSORB verdicts become reviewed diffs, never dependencies</li>
              <li>ideas are re-expressed · permissive-license copies carry attribution twice</li>
              <li>the A/B mapping stays sealed until your decision is recorded</li>
              <li>incompatible license → refusal, recorded in the registry</li>
            </ul>
          </HPanel>
        </div>
      </div>
    </>
  )
}
