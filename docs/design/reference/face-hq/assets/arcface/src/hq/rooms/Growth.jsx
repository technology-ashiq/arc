// GROWTH — "Reach is capped before it is measured."
// Two human gates stand between a draft and the internet: the
// review pack (one inbox item), and the merge. The machine writes
// the branch; it NEVER merges. Unedited := approved sha == published
// sha — that identity is the autonomy ladder's evidence.
import { useState } from 'react'
import { PencilSimpleLine } from '@phosphor-icons/react'
import { UI, MONO, COLOR, Btn, Field, TextInput, PickRow, YoursBadge, Chip } from '../../ui/kit.jsx'
import { RoomHead, HPanel, Empty } from '../bits.jsx'
import { useSpine } from '../useSpine.js'
import { growthState, slopLint, wsAppend, wsRequestApproval, newRef } from '../../spine/workspace.js'

const CHANNELS = ['seo-article', 'video', 'build-in-public', 'newsletter']
// draft = neutral progress · approved = waiting on your merge · published = live · rejected = quiet
const STATUS_TONE = { draft: 'blue', approved: 'amber', published: 'cyan', rejected: undefined }

export default function Growth() {
  useSpine()
  const [title, setTitle] = useState('')
  const [channel, setChannel] = useState('seo-article')
  const pieces = growthState()
  const liveSlop = slopLint(title)

  const draft = () => {
    const t = title.trim()
    if (!t) return
    const slop = slopLint(t)
    wsAppend('content.drafted', 'growth', `Draft: “${t}” (${channel}) · slop-lint ${slop.length === 0 ? 'clean' : `flagged: ${slop.join(', ')}`} · POV floor: needs one practitioner insight`, {
      contentId: newRef('c'), title: t, channel,
    })
    setTitle('')
  }

  const sendReviewPack = (p) => {
    wsRequestApproval({
      title: `Review pack: “${p.title}”`,
      tag: 'growth · gate 1 of 2',
      subject: 'growth.review-pack',
      data: { contentId: p.contentId },
      facts: [
        { k: 'council', v: `one bundle: preview URL + slop-lint + citation report + diff · target ≤5 min` },
        { k: 'money', v: '₹0 at stake · counts toward the unedited-approval ladder' },
        { k: 'kill', v: `channel ${p.channel} · every claim-of-fact carries a resolving source` },
      ],
      actions: [
        { label: 'approve — sha pinned', approved: true },
        { label: 'reject with notes', approved: false },
      ],
    })
  }

  const publish = (p) => {
    wsAppend('content.published', 'growth', `Published: “${p.title}” (${p.channel}) · human merge · published sha == approved sha (unedited) · INDEXABLE clock starts`, {
      contentId: p.contentId, title: p.title, channel: p.channel,
    })
  }

  const published = pieces.filter((p) => p.status === 'published')

  return (
    <>
      <RoomHead
        title="Reach is capped before it is measured."
        hint="draft → review pack (your inbox) → approve → publish. The machine writes the branch; it never merges."
        right={<YoursBadge>growth · persisted</YoursBadge>}
      />

      <div className="grid grid-cols-1 xl:grid-cols-[1.35fr_1fr] gap-4 items-start">
        <div className="min-w-0">
          <HPanel title="Draft a piece" hint="content.drafted — slop-lint runs live and negative-only: it catches bad patterns, never prescribes style">
            <form
              className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-end mb-3"
              onSubmit={(e) => {
                e.preventDefault()
                draft()
              }}
            >
              <Field label="Title / working headline">
                <TextInput value={title} onChange={setTitle} placeholder="e.g. 5 invoicing mistakes killing your firm's cash flow" />
              </Field>
              <Btn tone="primary" onClick={draft}>Draft it</Btn>
            </form>
            <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
              <Field label="Channel">
                <PickRow options={CHANNELS} value={channel} onPick={setChannel} />
              </Field>
              {title.trim() && (
                <span className="text-[12px] leading-[18px] pb-1.5 break-words min-w-0" style={{ fontFamily: UI, color: liveSlop.length ? COLOR.red : 'var(--text-2)' }}>
                  slop-lint: {liveSlop.length ? `flagged — ${liveSlop.join(', ')}` : 'clean'}
                </span>
              )}
            </div>
          </HPanel>

          <HPanel title={`The pipeline — ${pieces.length} pieces`} hint="status moves only on receipts">
            {pieces.length === 0 && (
              <Empty
                icon={PencilSimpleLine}
                title="Nothing drafted yet"
                hint="Not a zero: the pipeline has simply never fired. Draft a piece above and it lands here."
              />
            )}
            <div className="space-y-2">
              {pieces.map((p) => (
                <div key={p.contentId} className="min-w-0 p-3.5" style={{ background: 'var(--well)', border: '1px solid var(--line-1)', borderRadius: 'var(--r-md)', opacity: p.status === 'rejected' ? 0.55 : 1 }}>
                  <div className="flex items-center gap-2.5 flex-wrap mb-2.5 min-w-0">
                    <b className="text-[13.5px] leading-[19px] break-words min-w-0" style={{ fontFamily: UI, fontWeight: 600, color: 'var(--text-1)' }}>{p.title}</b>
                    <Chip tone={STATUS_TONE[p.status]}>{p.status}</Chip>
                    <span className="text-[12px]" style={{ fontFamily: UI, color: 'var(--text-3)' }}>{p.channel}</span>
                  </div>
                  <div className="flex gap-2 flex-wrap items-center">
                    {p.status === 'draft' && <Btn small onClick={() => sendReviewPack(p)}>Send review pack → inbox</Btn>}
                    {p.status === 'approved' && <Btn small tone="green" onClick={() => publish(p)}>Merge + publish (gate 2)</Btn>}
                    {p.status === 'rejected' && <Btn small onClick={() => sendReviewPack(p)}>Revise → new review pack</Btn>}
                    {p.status === 'published' && (
                      <span className="text-[12px]" style={{ fontFamily: UI, color: 'var(--text-2)' }}>
                        live · <span style={{ fontFamily: MONO }}>content.published ⌗</span>
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </HPanel>
        </div>

        <div className="min-w-0">
          <HPanel title="Channel scoreboard" hint="published counts derive from the log">
            <div className="-mx-2">
              {CHANNELS.map((c) => {
                const n = published.filter((p) => p.channel === c).length
                return (
                  <div key={c} className="flex items-center justify-between gap-3 px-2 py-[7px] text-[13px] transition-colors duration-200 hover:bg-(--bg-3)" style={{ borderBottom: '1px solid var(--line-1)', borderRadius: 'var(--r-sm)' }}>
                    <span className="truncate" style={{ fontFamily: UI, color: 'var(--text-1)' }}>{c}</span>
                    {n === 0 ? (
                      <span className="text-[12px] shrink-0" style={{ fontFamily: UI, color: 'var(--text-3)' }}>never-fired</span>
                    ) : (
                      <span className="text-[12px] tnum shrink-0" style={{ fontFamily: UI, color: 'var(--text-2)' }}>{n} published</span>
                    )}
                  </div>
                )
              })}
            </div>
          </HPanel>

          <HPanel title="The two gates">
            <ol className="space-y-2 text-[13px] leading-[20px]" style={{ fontFamily: UI, color: 'var(--text-2)' }}>
              <li><b style={{ fontWeight: 600, color: 'var(--text-1)' }}>gate 1 — the review pack</b>: one inbox item bundling preview + lints + diff. Your stamp pins the draft sha.</li>
              <li><b style={{ fontWeight: 600, color: 'var(--text-1)' }}>gate 2 — the merge</b>: a human merges; content.published carries the sha read from the merged tree. Unedited := the two shas match.</li>
            </ol>
          </HPanel>

          <HPanel title="Lints on duty">
            <ul className="list-disc pl-4 space-y-1.5 text-[13px] leading-[19px] marker:text-(--text-3)" style={{ fontFamily: UI, color: 'var(--text-2)' }}>
              <li>slop-lint — versioned marker list; compliance-shaped slop is still slop</li>
              <li>citation-lint — every claim-of-fact links a source AND the link resolves</li>
              <li>POV floor — ≥1 original practitioner insight per piece</li>
              <li>publishing under the owner's name stays human forever (E2)</li>
            </ul>
          </HPanel>
        </div>
      </div>
    </>
  )
}
