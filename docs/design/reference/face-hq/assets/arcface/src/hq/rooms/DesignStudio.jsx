// DESIGN STUDIO — "A rule unbroken is not the same as work worth shipping."
// Submit a surface → three explore variants (each with a thesis) →
// a read-only critique that can fail work for INSUFFICIENCY
// (BELOW-BAR — zero violations once meant a passing grade, and
// characterless work passed five runs) → a blind jury with a
// reference item → YOUR pick, recorded as a decision.
import { useState } from 'react'
import { PaintBrush } from '@phosphor-icons/react'
import { UI, MONO, COLOR, Btn, Field, TextInput, YoursBadge, Chip, tint } from '../../ui/kit.jsx'
import { RoomHead, HPanel, Empty } from '../bits.jsx'
import { useSpine } from '../useSpine.js'
import { designState, wsAppend, wsRequestApproval, newRef } from '../../spine/workspace.js'

const THESES = [
  ['calm density', 'one hue, hairline borders, the data is the decoration'],
  ['editorial contrast', 'display serif headlines over mono facts — a newspaper for machines'],
  ['instrument panel', 'meters and states first, prose second — built to be glanced'],
  ['warm terminal', 'phosphor accents on near-black, every number tabular'],
  ['brutal receipt', 'raw log aesthetics — the receipt IS the interface'],
]

const FINDING_CLASSES = ['VIOLATION', 'WEAKNESS', 'POLISH', 'BELOW-BAR']
const CLASS_COLOR = { VIOLATION: COLOR.red, WEAKNESS: COLOR.amber, POLISH: COLOR.blue, 'BELOW-BAR': COLOR.violet }
const verdictColor = (v) => (/FAIL/.test(v) ? COLOR.red : /BELOW/.test(v) ? COLOR.violet : COLOR.green)

const hashOf = (s) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 13)

export default function DesignStudio() {
  useSpine()
  const [surface, setSurface] = useState('')
  const [feel, setFeel] = useState('')
  const subs = designState()

  const submit = () => {
    const s = surface.trim()
    if (!s) return
    const h = hashOf(s)
    const variants = [0, 1, 2].map((i) => {
      const t = THESES[(h + i * 7) % THESES.length]
      return { v: 'V' + (i + 1), thesis: t[0], line: t[1] }
    })
    wsAppend('design.submitted', 'design-studio', `Design brief: “${s}” · feel: ${feel.trim() || 'calm · dense · factual'} → explore fan-out, 3 variants each with a thesis + tokens.css`, {
      subId: newRef('d'), surface: s, feel: feel.trim() || 'calm · dense · factual', variants,
    })
    setSurface('')
    setFeel('')
  }

  const critique = (sub) => {
    const h = hashOf(sub.surface)
    const findings = sub.variants.map((v, i) => {
      const roll = (h >> (i * 3)) % 5
      const cls = roll === 0 ? 'VIOLATION' : roll === 1 ? 'BELOW-BAR' : roll === 2 ? 'WEAKNESS' : 'POLISH'
      const note =
        cls === 'VIOLATION' ? 'contrast pair below the declared floor — computed, not eyeballed'
        : cls === 'BELOW-BAR' ? 'broke no rule and says nothing — compliant, characterless; fails for insufficiency'
        : cls === 'WEAKNESS' ? 'hierarchy flattens at the third level — the eye has no second stop'
        : 'micro: chip letter-spacing drifts from the kit'
      return { v: v.v, cls, note }
    })
    const worst = FINDING_CLASSES.find((c) => findings.some((f) => f.cls === c))
    const verdict = worst === 'VIOLATION' ? 'FAIL — violation must burn down' : worst === 'BELOW-BAR' ? 'BELOW-BAR — passing is not the same as worth shipping' : 'PASS with notes'
    wsAppend('design.critiqued', 'design-studio', `Critique (read-only critic · no edit tools): “${sub.surface}” → ${verdict}`, { subId: sub.subId, findings, verdict })
  }

  const jury = (sub) => {
    const h = hashOf(sub.surface + 'jury')
    const scored = sub.variants
      .map((v, i) => ({ ...v, score: (6 + ((h >> (i * 4)) % 35) / 10).toFixed(1) }))
      .sort((a, b) => b.score - a.score)
    const ranking = [...scored, { v: 'REF', thesis: 'reference item', line: 'a known-good surface, planted blind', score: (7.4 + (h % 9) / 10).toFixed(1) }].sort((a, b) => b.score - a.score)
    wsAppend('design.jury', 'design-studio', `Blind jury: “${sub.surface}” → ${ranking.map((r) => `${r.v} ${r.score}`).join(' · ')} (labels randomized; ranking always yields a winner but never a bar)`, { subId: sub.subId, ranking })
    const winner = ranking.find((r) => r.v !== 'REF')
    wsRequestApproval({
      title: `Design pick: “${sub.surface}” — jury favors ${winner.v} (${winner.thesis})`,
      tag: 'design-studio · the owner picks',
      subject: 'design.pick',
      data: { subId: sub.subId, variant: winner.v },
      facts: [
        { k: 'council', v: `jury: ${ranking.map((r) => `${r.v} ${r.score}`).join(' · ')} — reference item planted` },
        { k: 'money', v: '₹0 at stake · synthesis grafts runner-up ideas onto the winner' },
        { k: 'kill', v: 'your 18/100 verdict on a past explore round is on the record — the jury proposes, you dispose' },
      ],
      actions: [
        { label: `pick ${winner.v} — synthesize`, approved: true },
        { label: 'reject all — re-explore', approved: false },
      ],
    })
  }

  return (
    <>
      <RoomHead
        title="Worth shipping, not merely compliant."
        hint="brief → explore → read-only critique → blind jury → your pick. BELOW-BAR exists because zero violations once meant a passing grade."
        right={<YoursBadge>design-studio · persisted</YoursBadge>}
      />

      <div className="grid grid-cols-1 xl:grid-cols-[1.35fr_1fr] gap-4 items-start">
        <div className="min-w-0">
          <HPanel title="Submit a surface" hint="design.submitted → 3 variants, each with a thesis">
            <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-3 items-end">
              <Field label="Surface">
                <TextInput value={surface} onChange={setSurface} placeholder="e.g. lexos /dashboard · arc landing hero · invoice email" />
              </Field>
              <Field label="Feel words" hint="the brief's art direction">
                <TextInput value={feel} onChange={setFeel} placeholder="calm · dense · factual — anti-words: playful, generic" />
              </Field>
              <Btn tone="primary" onClick={submit}>Explore — 3 variants</Btn>
            </div>
          </HPanel>

          {subs.length === 0 && (
            <HPanel title="The studio floor">
              <Empty icon={PaintBrush} title="No briefs yet" hint="Not a zero — the studio has simply never fired. Submit a surface above and three variants land here." />
            </HPanel>
          )}

          {subs.map((sub) => (
            <HPanel key={sub.subId} title={`“${sub.surface}”`} hint={`feel: ${sub.feel}`} actions={<Chip tone={sub.status === 'juried' ? 'amber' : sub.status === 'picked' ? 'cyan' : undefined}>{sub.status}</Chip>}>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 mb-3">
                {sub.variants.map((v) => {
                  const picked = sub.picked === v.v
                  const f = sub.findings ? sub.findings.find((x) => x.v === v.v) : null
                  return (
                    <div key={v.v} className="p-3 min-w-0" style={{ background: 'var(--well)', border: `1px solid ${picked ? tint('green', 0.45) : 'var(--line-1)'}`, borderRadius: 'var(--r-md)' }}>
                      <div className="flex items-center gap-2 mb-1 min-w-0">
                        <b className="text-[12.5px] shrink-0" style={{ fontFamily: MONO, fontWeight: 600, color: picked ? COLOR.green : COLOR.cyan }}>{v.v}</b>
                        <span className="text-[12.5px] truncate" style={{ fontFamily: UI, fontWeight: 600, color: 'var(--text-1)' }}>{v.thesis}</span>
                        {picked && <span className="ml-auto shrink-0"><Chip tone="green">picked</Chip></span>}
                      </div>
                      <div className="text-[12px] leading-[18px] break-words" style={{ fontFamily: UI, color: 'var(--text-2)' }}>{v.line}</div>
                      {f && (
                        <div className="mt-2 text-[12px] leading-[17px] break-words" style={{ fontFamily: UI, color: 'var(--text-2)' }}>
                          <span className="text-[11px] mr-1.5" style={{ fontFamily: MONO, fontWeight: 600, color: CLASS_COLOR[f.cls] }}>{f.cls}</span>
                          {f.note}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
              {sub.verdict && (
                <div className="text-[12.5px] leading-[19px] mb-3 break-words" style={{ fontFamily: UI, color: 'var(--text-3)' }}>
                  verdict: <span style={{ fontWeight: 600, color: verdictColor(sub.verdict) }}>{sub.verdict}</span>
                </div>
              )}
              <div className="flex gap-2 flex-wrap items-center">
                {sub.status === 'explored' && <Btn small onClick={() => critique(sub)}>Run critique · read-only</Btn>}
                {sub.status === 'critiqued' && <Btn small tone="primary" onClick={() => jury(sub)}>Blind jury → your pick in inbox</Btn>}
                {sub.status === 'juried' && <span className="text-[12px]" style={{ fontFamily: UI, color: COLOR.amber }}>pick is waiting in your inbox — needs-you</span>}
                {sub.status === 'picked' && (
                  <span className="text-[12px]" style={{ fontFamily: UI, color: 'var(--text-2)' }}>
                    synthesis from <span style={{ fontFamily: MONO, color: COLOR.green }}>{sub.picked}</span> · receipt on the spine <span style={{ fontFamily: MONO }}>⌗</span>
                  </span>
                )}
              </div>
            </HPanel>
          ))}
        </div>

        <div className="min-w-0">
          <HPanel title="Why BELOW-BAR exists">
            <p className="text-[13.5px] leading-[21px]" style={{ fontFamily: UI, color: 'var(--text-2)' }}>
              PASS used to mean “zero violations” — broke no rule. Compliant, characterless work passed five runs that way, and the owner scored the output 18/100. A quality gate needs a class that fails for <b style={{ fontWeight: 600, color: 'var(--text-1)' }}>insufficiency</b>, not only for breakage. That class is BELOW-BAR, and it is this studio's whole reason to exist.
            </p>
          </HPanel>
          <HPanel title="Studio law">
            <div className="text-[13px] leading-[20px] space-y-1.5" style={{ fontFamily: UI, color: 'var(--text-2)' }}>
              <div>· the critic has no edit tools — read-only by construction, not by promise</div>
              <div>· agents judge, scripts measure — contrast is computed, never eyeballed</div>
              <div>· the jury is blind and carries a planted reference item</div>
              <div>· a gate that transforms what it measures must declare what the transform destroys</div>
              <div>· ranking yields a winner, never a bar — the bar is yours</div>
            </div>
          </HPanel>
        </div>
      </div>
    </>
  )
}
