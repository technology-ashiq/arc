// View.tsx -- command/ask-arc: v0.7's AskArc, drawing what fold() returned and deciding nothing (face v2
// Phase 03, ADR-1320, ADR-1325).
//
// Declared deltas from the reference: the answer comes from the door (deterministic-first) and not a
// browser engine with a key -- there is no key in the browser; each citation is checked through the door
// and the verdict is the largest thing on the answer; the "no hands" panel prints the computed audit of
// the handle this module asks through; answers are this visit's, since the answers the door keeps are
// its receipts and the spine module holds those; the chat-mcp panel reads the served planned room.
import { ChatCircleDots } from '@phosphor-icons/react'
import type { ModuleViewContext } from '../../../lib/registry.mjs'
import type { Folded } from './fold.mjs'
import { Btn, Chip, Field, FONT, MONO, SimBadge, TextInput, UI, YoursBadge } from '../../../ui/kit'
import { DoorRefusal, Empty, HPanel, RoomHead } from '../../../ui/bits'
export { ChatCircleDots as Icon } from '@phosphor-icons/react'

export default function View({ f, ctx }: { f: Folded; ctx: ModuleViewContext }) {
  return (
    <>
      <RoomHead title={f.sentence} hint={f.lede} right={<YoursBadge>ask-arc · answers from the door, every citation checked</YoursBadge>} />

      <div className="grid grid-cols-1 xl:grid-cols-[1.35fr_1fr] gap-4 items-start">
        <div className="min-w-0">
          <HPanel title="Ask" hint="the reader answers from the live state · no key in this browser">
            <form
              className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto] gap-3 items-end mb-3"
              onSubmit={(e) => {
                e.preventDefault()
                ctx.onAct('/api/ask', { q: f.draft })
                ctx.onPick('draft', '')
              }}
            >
              <Field label="Question" hint="Enter asks">
                <TextInput value={f.draft} onChange={(v) => ctx.onPick('draft', v)} placeholder="what needs me today · which lanes are LIVE · Tanglish works too" />
              </Field>
              <Btn tone="primary" type="submit" disabled={!f.canAsk}>
                {f.askLabel}
              </Btn>
            </form>
            {f.isBlocked && <p className="mb-3 text-[12px]" style={{ fontFamily: UI, color: 'var(--text-3)' }}>{f.blocked}</p>}
            <div className="flex flex-wrap gap-1.5">
              {f.examples.map((q) => (
                <Btn key={q} small disabled={f.isAsking} onClick={() => ctx.onAct('/api/ask', { q })}>
                  {q}
                </Btn>
              ))}
            </div>
          </HPanel>

          <HPanel title="Answers" hint="each answer names what it leaned on · each citation asked of the door" actions={<Chip>{f.answersChip}</Chip>}>
            <div className="space-y-3">
              {!f.hasAnswers && (
                <Empty icon={ChatCircleDots} title="Nothing asked yet" hint="Ask a question above, or pick one of the examples. The answer and every receipt it cites land here." />
              )}
              {f.answers.map((a) => (
                <div key={a.key} className="p-3.5 min-w-0" style={{ background: 'var(--well)', border: '1px solid var(--line-1)', borderRadius: 'var(--r-md)' }}>
                  <div className="flex items-baseline gap-2 flex-wrap mb-1.5">
                    <span className="text-[13.5px] min-w-0 break-words" style={{ fontFamily: UI, fontWeight: 600, color: 'var(--text-1)' }}>{a.question}</span>
                    {a.isAnswered && (
                      <span className="ml-auto shrink-0">
                        <Chip>{a.half}</Chip>
                      </span>
                    )}
                  </div>
                  {a.isPending && <div className="text-[12px]" style={{ fontFamily: UI, color: 'var(--text-3)' }}>reading the live state…</div>}
                  {a.isRefused && <DoorRefusal code={a.refusal.code} human={a.refusal.human} />}
                  {a.isAnswered && (
                    <div>
                      <div className="text-[18px] leading-[24px] mb-1" style={{ fontFamily: FONT, fontWeight: 600, color: a.standingInk }}>{a.standing}</div>
                      <div className="text-[12px] leading-[18px] mb-2.5" style={{ fontFamily: UI, color: 'var(--text-3)' }}>{a.standingLine}</div>
                      <div className="text-[13px] leading-[21px] break-words" style={{ fontFamily: UI, color: 'var(--text-1)' }}>
                        {a.parts.map((p) => (
                          <span key={p.key}>
                            {p.isText && p.text}
                            {p.isCode && <code className="text-[12px] px-1 rounded" style={{ fontFamily: MONO, background: 'var(--bg-4)' }}>{p.text}</code>}
                            {p.isEm && <em style={{ fontStyle: 'normal', fontWeight: 600 }}>{p.text}</em>}
                          </span>
                        ))}
                      </div>
                      {a.hasClaims && (
                        <div className="mt-2.5 space-y-1.5">
                          {a.claims.map((c) => (
                            <div key={c.key} className="text-[12px] leading-[18px]" style={{ fontFamily: UI, color: 'var(--text-2)' }}>
                              <span className="mr-1.5" style={{ fontFamily: MONO, color: 'var(--text-1)' }}>⌗ {c.raw}</span>
                              <span className="mr-1.5 uppercase text-[10.5px] tracking-[0.06em]" style={{ fontFamily: UI, fontWeight: 600, color: 'var(--text-3)' }}>{c.state}</span>
                              {c.line} <span style={{ color: 'var(--text-3)' }}>{c.detail}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {a.hasCommands && (
                        <div className="mt-2.5 space-y-1">
                          {a.commands.map((cmd) => (
                            <pre key={cmd} className="text-[11.5px] px-2 py-1 overflow-x-auto" style={{ fontFamily: MONO, color: 'var(--text-2)', background: 'var(--bg-1)', borderRadius: 'var(--r-sm)' }}>{cmd}</pre>
                          ))}
                        </div>
                      )}
                      {a.hasHandoff && (
                        <div className="mt-2.5 flex items-center gap-2 flex-wrap">
                          <span className="text-[12px] leading-[18px] min-w-0" style={{ fontFamily: UI, color: 'var(--text-2)' }}>{a.handoffLine}</span>
                          {f.canOpenInbox && <Btn small onClick={() => ctx.onOpen(f.inboxRoom)}>Open the inbox</Btn>}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </HPanel>
        </div>

        <div className="min-w-0">
          <HPanel title="No hands" hint="ADR-1325 · the reader, never a second truth">
            <div className="space-y-2 text-[12.5px] leading-[19px]" style={{ fontFamily: UI, color: 'var(--text-2)' }}>
              {f.noHands.map((line) => (
                <div key={line}>{line}</div>
              ))}
              <div className="pt-2 text-[12px]" style={{ fontFamily: MONO, color: 'var(--text-3)', borderTop: '1px solid var(--line-1)' }}>
                {f.audit}
              </div>
            </div>
          </HPanel>

          <HPanel title="The reader" hint="which half answered last">
            <div className="text-[12.5px] mb-2" style={{ fontFamily: MONO, color: 'var(--text-1)' }}>{f.reader}</div>
            <p className="text-[12.5px] leading-[19px]" style={{ fontFamily: UI, color: 'var(--text-2)' }}>{f.readerLine}</p>
          </HPanel>

          <HPanel title="chat-mcp" hint="planned · drawn dotted">
            {f.chatMcp.isServed && (
              <div>
                <SimBadge>{f.chatMcp.status}</SimBadge>
                <p className="text-[12.5px] leading-[19px] mt-2.5" style={{ fontFamily: UI, color: 'var(--text-1)' }}>{f.chatMcp.sentence}</p>
                <p className="text-[12.5px] leading-[19px] mt-1" style={{ fontFamily: UI, color: 'var(--text-2)' }}>{f.chatMcp.lede}</p>
              </div>
            )}
            {!f.chatMcp.isServed && (
              <p className="text-[12.5px] leading-[19px]" style={{ fontFamily: UI, color: 'var(--text-3)' }}>The registry serves no chat-mcp room.</p>
            )}
          </HPanel>
        </div>
      </div>
    </>
  )
}
