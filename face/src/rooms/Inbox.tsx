// Inbox -- the ONE write path in this product.
//
// Everything else arc does, a machine may do. This room is the exception: an approval is
// raised by a machine and decided by a person, with a reason that person typed. So the
// room is built around what it REFUSES to offer.
//
//   no bulk action      there is no control that decides more than one thing
//   no default reason   the box starts empty and nothing ever writes into it
//   no undo             a decision is final; the card says so before the stamp, not after
//   no pre-fill         switching cards never carries a reason across
//   no retry            a write that may have landed is never sent twice
//
// `a` and `r` ARM a verdict and put the cursor in the reason box. They do not stamp: a
// keystroke that completed the act would have to supply the words, and supplying the
// words is the one thing this product may not do. (The reference implementation this room
// descends from stamped on `a` with the canned reason "cleared via keyboard" -- that is
// the exact defect, and it is fixed here.)
//
// The refusal codes ALREADY_DECIDED, UNKNOWN_APPROVAL and BAD_REASON reach the owner as
// the door's own sentences, under the door's own code. A machine that says precisely what
// was wrong deserves a client that repeats it.
//
// No logic lives in this file. It is in ../lib/inbox.mjs, where node can run it.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Door } from "../lib/door.mjs";
import {
  roomOpening, RAISED_KINDS, KEY_HINT, MAX_REASON_BYTES, REASON_PLACEHOLDER,
  readHealth, readInbox, readSpinePage, readStampResult, refusalOf, keyAction, clamp,
  validateReason, stamp, approvalBody, ageSentence, timeOfDay, shortId, fmtInt, tail, toneForKind,
} from "../lib/inbox.mjs";
import type { Approval, InboxView, SpinePage, Tone, Refused } from "../lib/inbox.mjs";

/* -------------------------------------------------------------------------- */

export type InboxProps = {
  /** The L2 client. The stamp goes through it and through nothing else. */
  door: Door;
  /**
   * The registry's own entry for this room, when the shell has read /api/rooms. Typed
   * structurally rather than as `Room` so the two files need not move together; its
   * strings arrive escaped, like everything the door serves, and are decoded here.
   */
  room?: { sentence?: string; lede?: string };
  /** Explicit overrides. They beat the registry, which beats the built-in constant. */
  sentence?: string;
  lede?: string;
};

type Panel<T> =
  | { phase: "loading" }
  | { phase: "ok"; data: T }
  | { phase: "error"; code: string; human: string };

/** One stamp this session made: the approval, the verdict, and the receipt it produced. */
type Stamped = { id: string; what: string; verdict: string; receipt: string | null };

/** How many recent non-approval needs-you receipts the second panel draws. */
const RAISED_ROWS = 8;
const RAISED_LIMIT = 1000;

const TONE_INK: Record<Tone, string> = {
  "needs-you": "var(--amber)",
  "real-money": "var(--green)",
  incident: "var(--red)",
  "non-real": "var(--sim-fg)",
  chrome: "var(--accent-dim)",
  quiet: "var(--prose)",
};

/* -------------------------------------------------------------------------- */

export function Inbox({ door, room, sentence, lede }: InboxProps) {
  const opening = roomOpening("inbox", room, { sentence, lede });
  const [inbox, setInbox] = useState<Panel<InboxView>>({ phase: "loading" });
  const [raised, setRaised] = useState<Panel<SpinePage>>({ phase: "loading" });
  const [selected, setSelected] = useState(0);
  const [armed, setArmed] = useState<"approve" | "reject" | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [writing, setWriting] = useState<string | null>(null);
  const [refused, setRefused] = useState<Record<string, Refused | undefined>>({});
  // Every stamp made in this session, newest first. It outlives the refetch that removes
  // the card: a receipt that flashes for the length of one network round trip is a
  // receipt the owner never saw.
  const [stamped, setStamped] = useState<Stamped[]>([]);
  const boxes = useRef(new Map<string, HTMLTextAreaElement | null>());
  const now = useRef<string>("");

  const open: Approval[] = inbox.phase === "ok" ? inbox.data.open : [];

  const read = useCallback(async (signal: AbortSignal) => {
    try {
      const raw: unknown = await door.inbox(signal);
      if (!signal.aborted) setInbox({ phase: "ok", data: readInbox(raw) });
    } catch (err) {
      if (!signal.aborted) setInbox({ phase: "error", ...refusalOf(err) });
    }
    try {
      // Only for the "raised N days ago" line, and only from the DOOR's clock. If this
      // read fails the age is simply not drawn -- an age measured against the browser's
      // clock would be a different claim about how long something has been waiting.
      const raw: unknown = await door.health(signal);
      now.current = readHealth(raw).now;
    } catch { /* no age line this read */ }
    try {
      const raw: unknown = await door.spine({ kind: RAISED_KINDS.join(","), limit: RAISED_LIMIT }, signal);
      if (!signal.aborted) setRaised({ phase: "ok", data: readSpinePage(raw) });
    } catch (err) {
      if (!signal.aborted) setRaised({ phase: "error", ...refusalOf(err) });
    }
  }, [door]);

  useEffect(() => {
    const ac = new AbortController();
    void read(ac.signal);
    return () => ac.abort();
  }, [read]);

  // The selection is clamped to what is actually open. When a stamp closes a card the
  // list gets shorter under the cursor, and a cursor pointing past the end is a cursor
  // whose next keystroke arms a verdict against nothing.
  useEffect(() => { setSelected((s) => clamp(s, open.length)); }, [open.length]);

  const focusBox = useCallback((id: string) => {
    const el = boxes.current.get(id);
    if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const active = document.activeElement;
      const action = keyAction({
        key: e.key,
        typing: active !== null && (active.tagName === "INPUT" || active.tagName === "TEXTAREA"),
        modified: e.ctrlKey || e.metaKey || e.altKey,
        index: selected,
        count: open.length,
      });
      if (action.type === "ignore") return;
      e.preventDefault();
      if (action.type === "move") { setArmed(null); setSelected(action.index); return; }
      if (action.type === "disarm") {
        setArmed(null);
        if (active instanceof HTMLElement) active.blur();
        return;
      }
      const card = open[selected];
      if (card === undefined) return;
      setArmed(action.verdict);
      focusBox(card.id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, selected, focusBox]);

  const setDraft = useCallback((id: string, value: string) => {
    setDrafts((d) => ({ ...d, [id]: value }));
    // A refusal is about the words that were sent. The moment they change, it is stale.
    setRefused((r) => (r[id] === undefined ? r : { ...r, [id]: undefined }));
  }, []);

  /**
   * THE STAMP. One request, no retry, no queue, no confirmation dialog standing between
   * the owner and his own decision -- the reason he typed IS the confirmation.
   */
  const decide = useCallback(async (approval: Approval, verdict: "approve" | "reject") => {
    if (writing !== null) return;
    const reason = drafts[approval.id] ?? "";
    const check = validateReason(reason);
    if (!check.ok) {
      setRefused((r) => ({ ...r, [approval.id]: { code: check.code ?? "BAD_REASON", human: check.human } }));
      focusBox(approval.id);
      return;
    }
    setWriting(approval.id);
    setRefused((r) => ({ ...r, [approval.id]: undefined }));
    try {
      const raw: unknown = await stamp(door, { id: approval.id, verdict, reason: check.value });
      const result = readStampResult(raw);
      setStamped((s) => [
        { id: approval.id, what: approval.what, verdict: result.verdict === "" ? verdict : result.verdict, receipt: result.receipt },
        ...s.filter((x) => x.id !== approval.id),
      ]);
      setDrafts((d) => ({ ...d, [approval.id]: "" }));
      setArmed(null);
      const ac = new AbortController();
      await read(ac.signal);
    } catch (err) {
      // Named, verbatim, under the door's own code. ALREADY_DECIDED in particular is not
      // an error to swallow: it means someone -- the CLI, another tab -- decided this
      // while the card was on screen, and the record does not change.
      setRefused((r) => ({ ...r, [approval.id]: refusalOf(err) }));
    } finally {
      setWriting(null);
    }
  }, [door, drafts, writing, read, focusBox]);

  const counts = inbox.phase === "ok" ? inbox.data : null;
  const raisedRows = useMemo(
    () => (raised.phase === "ok" ? tail(raised.data.events, RAISED_ROWS) : []),
    [raised],
  );

  return (
    <section className="ib-room" aria-label="Inbox">
      <style>{CSS}</style>

      <header className="ib-head">
        <div className="ib-headtext">
          <h1 className="ib-sentence">{opening.sentence}</h1>
          <p className="ib-lede">{opening.lede}</p>
        </div>
        <div className="ib-chrome">
          {counts === null ? null : (
            <>
              <span className="ib-count" style={{ color: (counts.openCount ?? 0) > 0 ? "var(--amber)" : "var(--meta)" }}>
                {counts.openCount === null ? "—" : fmtInt(counts.openCount)} open
              </span>
              <span className="ib-count ib-count-quiet">
                {counts.decidedCount === null ? "—" : fmtInt(counts.decidedCount)} decided
              </span>
              {counts.mode === "sim"
                ? <span className="ib-sim" title="fixture data: a stamp here writes to the fixture spine named on the door's command line">SIMULATED</span>
                : null}
            </>
          )}
        </div>
      </header>

      <p className="ib-law">
        A machine raised every card below and no machine may close one. The stamp writes
        <code> decision.recorded </code> to the spine under your reason, once and finally —
        there is no undo, and nothing here decides more than the one card you are looking at.
        <span className="ib-keys">{KEY_HINT}</span>
      </p>

      {inbox.phase === "loading" ? <p className="ib-waiting">reading the open approvals from the door…</p> : null}
      {inbox.phase === "error" ? (
        <div className="ib-refusal" role="status">
          <span className="ib-code">{inbox.code}</span>
          <p>{inbox.human}</p>
          <p className="ib-refusal-what">No approval is shown, and none has been invented in its place.</p>
        </div>
      ) : null}

      {inbox.phase === "ok" && open.length === 0 ? (
        <div className="ib-zero">
          <p className="ib-zero-line">Nothing is waiting on you.</p>
          <p className="ib-zero-note">
            Measured, and it is zero: {counts?.decidedCount === null || counts === null ? "every" : fmtInt(counts.decidedCount)} approval
            {counts?.decidedCount === 1 ? " has" : "s have"} been raised and decided, and no
            <code> approval.requested </code> is currently open. This is not an empty screen —
            it is the fold of every approval against every decision, recomputed on this read.
          </p>
        </div>
      ) : null}

      <ol className="ib-list">
        {open.map((a, i) => (
          <ApprovalCard
            key={a.id}
            approval={a}
            selected={i === selected}
            armed={i === selected ? armed : null}
            draft={drafts[a.id] ?? ""}
            refusal={refused[a.id]}
            done={stamped.find((s) => s.id === a.id)}
            writing={writing === a.id}
            locked={writing !== null && writing !== a.id}
            now={now.current}
            onSelect={() => {
              // Only a CHANGE of card disarms. Arming focuses the reason box, and a focus
              // handler that also cleared `armed` would undo the keystroke that caused it.
              if (selected !== i) { setSelected(i); setArmed(null); }
            }}
            onDraft={(v) => setDraft(a.id, v)}
            onDecide={(v) => { void decide(a, v); }}
            boxRef={(el) => { boxes.current.set(a.id, el); }}
          />
        ))}
      </ol>

      {/* what this session stamped. Kept on screen after the fold removes the card. */}
      {stamped.length === 0 ? null : (
        <div className="ib-panel">
          <div className="ib-panel-head">
            <span className="ib-panel-title">decided by you, this session</span>
            <span className="ib-panel-hint">decision.recorded · final</span>
          </div>
          <ul className="ib-raised">
            {stamped.map((s) => (
              <li className="ib-raised-row" key={s.id}>
                <span className="ib-chip">{s.verdict}</span>
                <span className="ib-done-what">{s.what}</span>
                <span className="ib-receipt" title={s.receipt ?? s.id}>
                  ⌗ {s.receipt === null ? shortId(s.id) : shortId(s.receipt)}
                </span>
              </li>
            ))}
          </ul>
          <p className="ib-panel-note">
            Each is on the spine under the words you typed. There is no undo: a decision
            that must change is superseded on a new day, and both remain in the record.
          </p>
        </div>
      )}

      {/* needs-you kinds that are NOT approvals: cards with chips, never stamps */}
      <div className="ib-panel">
        <div className="ib-panel-head">
          <span className="ib-panel-title">also raised, and not stampable</span>
          <span className="ib-panel-hint">{RAISED_KINDS.join(" · ")}</span>
        </div>
        <p className="ib-panel-note">
          These kinds need a human and no button in this product decides one. The spine
          records that each was <b>raised</b>; nothing on it records that one was handled,
          so this list is what happened, not what is outstanding.
        </p>
        {raised.phase === "loading" ? <p className="ib-waiting">reading them from the log…</p> : null}
        {raised.phase === "error" ? (
          <div className="ib-refusal" role="status">
            <span className="ib-code">{raised.code}</span>
            <p>{raised.human}</p>
          </div>
        ) : null}
        {raised.phase === "ok" && raisedRows.length === 0 ? (
          <p className="ib-panel-note">
            Not one of these kinds has ever fired on this spine. That is not zero incidents
            measured — it is machinery that is built, tested and has never run in anger.
          </p>
        ) : null}
        {raisedRows.length > 0 ? (
          <ul className="ib-raised">
            {raisedRows.map((e) => (
              <li className="ib-raised-row" key={e.id}>
                <span className="ib-chip" style={{ color: TONE_INK[toneForKind(e.kind)], borderColor: TONE_INK[toneForKind(e.kind)] }}>{e.kind}</span>
                <span className="ib-raised-when">{e.day} {timeOfDay(e.ts)}</span>
                <span className="ib-raised-v">{e.venture}</span>
                <span className="ib-receipt" title={e.id}>⌗ {shortId(e.id)}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- *
 * one card
 * -------------------------------------------------------------------------- */

type CardProps = {
  approval: Approval;
  selected: boolean;
  armed: "approve" | "reject" | null;
  draft: string;
  refusal: Refused | undefined;
  done: Stamped | undefined;
  writing: boolean;
  locked: boolean;
  now: string;
  onSelect: () => void;
  onDraft: (v: string) => void;
  onDecide: (v: "approve" | "reject") => void;
  boxRef: (el: HTMLTextAreaElement | null) => void;
};

function ApprovalCard(p: CardProps) {
  const rows = approvalBody(p.approval.payload);
  const check = validateReason(p.draft);
  const age = ageSentence(p.approval.ts, p.now);

  return (
    <li
      className={`ib-card${p.selected ? " ib-card-on" : ""}`}
      data-approval={p.approval.id}
      aria-current={p.selected ? "true" : undefined}
      onFocusCapture={p.onSelect}
      onMouseDown={p.onSelect}
    >
      <div className="ib-card-head">
        <span className="ib-chip ib-chip-gate">{p.approval.gate}</span>
        <span className="ib-card-v">{p.approval.venture}</span>
        {age === "" ? null : <span className="ib-card-age">raised {age}</span>}
        <span className="ib-receipt" title={p.approval.id}>⌗ {shortId(p.approval.id)}</span>
      </div>

      <h2 className="ib-what">{p.approval.what === "" ? "(this approval carries no description — do not decide it blind)" : p.approval.what}</h2>

      {rows.length === 0 ? (
        <p className="ib-body-empty">Its payload is empty. Every field this approval carries is shown, and it carries none.</p>
      ) : (
        <dl className="ib-body">
          {rows.map((r) => (
            <div className="ib-body-row" key={r.key}>
              <dt>{r.key}</dt>
              <dd className={r.shape === "json" ? "ib-json" : undefined}>{r.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {p.done === undefined ? (
        <form
          className="ib-decide"
          // NO DEFAULT VERDICT, anywhere. Submitting with nothing armed does nothing at
          // all: a form whose Enter key falls back to "approve" has a default decision,
          // and the whole point of this room is that there is not one.
          onSubmit={(e) => { e.preventDefault(); if (p.armed !== null) p.onDecide(p.armed); }}
        >
          <label className="ib-reason-label" htmlFor={`reason-${p.approval.id}`}>
            your reason — required, and yours
          </label>
          <textarea
            id={`reason-${p.approval.id}`}
            ref={p.boxRef}
            className="ib-reason"
            rows={2}
            value={p.draft}
            spellCheck
            autoComplete="off"
            placeholder={REASON_PLACEHOLDER}
            disabled={p.writing || p.locked}
            onChange={(e) => p.onDraft(e.target.value)}
            onKeyDown={(e) => {
              // Enter records the ARMED verdict and never invents one. It also never
              // inserts a line break: the spine refuses a control character in a reason,
              // so a second line is a decision that could not be written anyway.
              if (e.key !== "Enter" || e.shiftKey) return;
              e.preventDefault();
              if (p.armed !== null) p.onDecide(p.armed);
            }}
          />
          <div className="ib-acts">
            <button
              type="button"
              className={`ib-btn ib-btn-approve${p.armed === "approve" ? " ib-armed" : ""}`}
              disabled={p.writing || p.locked}
              onClick={() => p.onDecide("approve")}
            >
              {p.writing ? "writing…" : "approve · a"}
            </button>
            <button
              type="button"
              className={`ib-btn ib-btn-reject${p.armed === "reject" ? " ib-armed" : ""}`}
              disabled={p.writing || p.locked}
              onClick={() => p.onDecide("reject")}
            >
              reject · r
            </button>
            <span className="ib-bytes" style={{ color: check.bytes > MAX_REASON_BYTES ? "var(--amber)" : "var(--faint)" }}>
              {fmtInt(check.bytes)}/{fmtInt(MAX_REASON_BYTES)} bytes
            </span>
            <span className="ib-final">final — no undo</span>
          </div>
          {p.armed === null ? (p.selected ? (
            // Only under the card the cursor is on. Thirteen copies of the same hint is
            // how a screen teaches its reader to stop reading it.
            <p className="ib-armed-note">
              Enter records the armed verdict — press <b>a</b> or <b>r</b> to arm one, or
              use the buttons. Nothing is armed, so Enter does nothing.
            </p>
          ) : null) : (
            <p className="ib-armed-note">
              <b style={{ color: "var(--amber)" }}>{p.armed}</b> is armed. It is not a
              decision until you have written why, and arc will not write that for you.
            </p>
          )}
          {p.refusal === undefined ? null : (
            <p className="ib-card-refusal" role="alert">
              <span className="ib-code">{p.refusal.code}</span> {p.refusal.human}
            </p>
          )}
        </form>
      ) : (
        <p className="ib-stamped" role="status">
          <span className="ib-code">decision.recorded</span> {p.done.verdict} —
          {p.done.receipt === null ? " written to the spine" : <> receipt <span className="ib-receipt">⌗ {shortId(p.done.receipt)}</span></>}.
          Decisions are final; supersede on a new day if it truly must change.
        </p>
      )}
    </li>
  );
}

/* -------------------------------------------------------------------------- *
 * style. Every colour is a token; there is no hex in this file.
 *
 * The two buttons deliberately do NOT wear green and red. Those hues are reserved for
 * real money and for an incident, and an approve/reject pair is neither. They are told
 * apart by fill and weight instead -- approve is the filled one, reject is the outlined
 * one -- which is also the pair that survives a colour-blind reader.
 * -------------------------------------------------------------------------- */

const CSS = `
.ib-room{font-family:var(--font-display);color:var(--prose);padding:calc(var(--grid)*3) calc(var(--grid)*3) calc(var(--grid)*6);max-width:1040px;margin:0 auto;display:flex;flex-direction:column;gap:calc(var(--grid)*2);}
.ib-head{display:flex;align-items:flex-start;gap:calc(var(--grid)*2);flex-wrap:wrap;}
.ib-headtext{flex:1 1 380px;min-width:0;}
.ib-sentence{font-size:clamp(24px,3.6vw,var(--step-room));line-height:1.04;letter-spacing:-0.02em;font-weight:600;margin:0 0 var(--grid) 0;color:var(--prose);}
.ib-lede{font-size:var(--step-lede);line-height:1.5;font-weight:300;color:var(--meta);margin:0;max-width:64ch;}
.ib-chrome{display:flex;align-items:center;gap:var(--grid);flex-wrap:wrap;margin-left:auto;}
.ib-count{font-family:var(--font-mono);font-size:var(--step-data);letter-spacing:var(--track-tight);text-transform:uppercase;font-variant-numeric:var(--numeric);}
.ib-count-quiet{color:var(--meta);}
.ib-sim{font-family:var(--font-mono);font-size:var(--step-micro);letter-spacing:var(--track-mid);color:var(--sim-fg);background:var(--sim-hatch);border-radius:var(--radius-pill);padding:calc(var(--grid-in)*1) calc(var(--grid-in)*2);}
.ib-law{font-size:var(--step-body);line-height:1.6;font-weight:300;color:var(--meta);margin:0;padding:calc(var(--grid)*2);border:1px solid var(--panel-border);border-left:2px solid var(--amber);border-radius:var(--radius-panel);background:var(--panel);backdrop-filter:blur(var(--panel-blur));-webkit-backdrop-filter:blur(var(--panel-blur));}
.ib-law code{font-family:var(--font-mono);font-size:var(--step-data);color:var(--prose);}
.ib-keys{display:block;margin-top:var(--grid);font-family:var(--font-mono);font-size:var(--step-meta);color:var(--faint);letter-spacing:var(--track-tight);}
.ib-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:var(--grid);}
.ib-card{border:1px solid var(--panel-border);border-radius:var(--radius-panel);background:var(--panel);backdrop-filter:blur(var(--panel-blur));-webkit-backdrop-filter:blur(var(--panel-blur));padding:var(--pad-panel);transition:border-color var(--dur-state) var(--ease),box-shadow var(--dur-state) var(--ease);}
.ib-card-on{border-color:var(--accent-line);box-shadow:inset 2px 0 0 var(--accent);}
.ib-card-head{display:flex;align-items:center;gap:var(--grid);flex-wrap:wrap;margin-bottom:var(--grid);}
.ib-chip{font-family:var(--font-mono);font-size:var(--step-meta);letter-spacing:var(--track-tight);border:1px solid var(--hairline-strong);border-radius:var(--radius-pill);padding:calc(var(--grid-in)*0.5) calc(var(--grid-in)*2);}
.ib-chip-gate{color:var(--amber);border-color:var(--amber);}
.ib-card-v,.ib-card-age{font-family:var(--font-mono);font-size:var(--step-meta);color:var(--meta);}
.ib-card-age{color:var(--faint);}
.ib-receipt{font-family:var(--font-mono);font-size:var(--step-meta);color:var(--accent-dim);border:1px solid var(--accent-line);border-radius:var(--radius-chip);padding:calc(var(--grid-in)*0.5) calc(var(--grid-in)*1.5);margin-left:auto;}
.ib-what{font-size:var(--step-lede);line-height:1.4;font-weight:500;margin:0 0 calc(var(--grid)*1.5);color:var(--prose);overflow-wrap:anywhere;}
.ib-body{margin:0 0 calc(var(--grid)*2);padding:var(--grid) 0;border-top:1px solid var(--hairline);border-bottom:1px solid var(--hairline);display:flex;flex-direction:column;gap:calc(var(--grid-in)*1);}
.ib-body-row{display:flex;gap:var(--grid);align-items:baseline;font-family:var(--font-mono);font-size:var(--step-data);line-height:1.55;}
.ib-body-row dt{flex:0 0 132px;color:var(--faint);letter-spacing:var(--track-tight);overflow-wrap:anywhere;}
.ib-body-row dd{margin:0;flex:1 1 auto;min-width:0;color:var(--prose);overflow-wrap:anywhere;}
.ib-json{white-space:pre-wrap;color:var(--meta);}
.ib-body-empty,.ib-waiting{font-family:var(--font-mono);font-size:var(--step-meta);color:var(--faint);line-height:1.6;}
.ib-decide{display:flex;flex-direction:column;gap:var(--grid);}
.ib-reason-label{font-family:var(--font-mono);font-size:var(--step-meta);letter-spacing:var(--track-mid);text-transform:uppercase;color:var(--amber);}
.ib-reason{font-family:var(--font-mono);font-size:var(--step-body);line-height:1.5;color:var(--prose);background:rgba(0,0,0,0.45);border:1px solid var(--hairline-strong);border-radius:var(--radius-chip);padding:var(--grid);resize:vertical;min-height:var(--row-h-live);width:100%;box-sizing:border-box;}
.ib-reason::placeholder{color:var(--faint);}
.ib-reason:focus-visible{border-color:var(--accent);}
.ib-reason:disabled{opacity:0.5;}
.ib-acts{display:flex;align-items:center;gap:var(--grid);flex-wrap:wrap;}
.ib-btn{font-family:var(--font-mono);font-size:var(--step-data);letter-spacing:var(--track-tight);text-transform:uppercase;min-height:var(--row-h-live);padding:0 calc(var(--grid)*2.5);border-radius:var(--radius-chip);cursor:pointer;transition:background var(--dur-fast) var(--ease),border-color var(--dur-fast) var(--ease);}
.ib-btn:disabled{opacity:0.45;cursor:not-allowed;}
.ib-btn-approve{background:var(--accent);color:var(--on-accent);border:1px solid var(--accent);font-weight:700;}
.ib-btn-approve:hover:not(:disabled){background:var(--accent-dim);}
.ib-btn-reject{background:transparent;color:var(--prose);border:1px solid var(--hairline-strong);font-weight:600;}
.ib-btn-reject:hover:not(:disabled){border-color:var(--prose);}
.ib-armed{outline:var(--focus-width) solid var(--focus-ring);outline-offset:var(--focus-offset);}
.ib-bytes,.ib-final{font-family:var(--font-mono);font-size:var(--step-meta);font-variant-numeric:var(--numeric);}
.ib-final{color:var(--faint);letter-spacing:var(--track-tight);text-transform:uppercase;margin-left:auto;}
.ib-armed-note,.ib-card-refusal,.ib-stamped{font-size:var(--step-body);line-height:1.55;font-weight:300;color:var(--meta);margin:0;}
.ib-card-refusal{color:var(--prose);}
.ib-code{font-family:var(--font-mono);font-size:var(--step-meta);letter-spacing:var(--track-tight);color:var(--amber);}
.ib-stamped{border-top:1px solid var(--hairline);padding-top:var(--grid);}
.ib-zero{padding:calc(var(--grid)*3);border:1px dashed var(--hairline-strong);border-radius:var(--radius-panel);}
.ib-zero-line{font-size:var(--step-lede);font-weight:500;color:var(--prose);margin:0 0 var(--grid);}
.ib-zero-note{font-size:var(--step-body);line-height:1.6;font-weight:300;color:var(--meta);margin:0;}
.ib-zero-note code{font-family:var(--font-mono);font-size:var(--step-data);color:var(--prose);}
.ib-refusal{border:1px solid var(--hairline-strong);border-left:2px solid var(--amber);border-radius:var(--radius-chip);padding:calc(var(--grid)*2);}
.ib-refusal p{margin:var(--grid) 0 0;font-size:var(--step-body);line-height:1.5;color:var(--prose);font-weight:300;}
.ib-refusal-what{color:var(--meta) !important;font-size:var(--step-meta) !important;}
.ib-panel{border:1px solid var(--panel-border);border-radius:var(--radius-panel);background:var(--panel);backdrop-filter:blur(var(--panel-blur));-webkit-backdrop-filter:blur(var(--panel-blur));padding:var(--pad-panel);}
.ib-panel-head{display:flex;align-items:baseline;justify-content:space-between;gap:var(--grid);flex-wrap:wrap;margin-bottom:var(--grid);}
.ib-panel-title{font-family:var(--font-mono);font-size:var(--step-meta);letter-spacing:var(--track-wide);text-transform:uppercase;color:var(--accent);}
.ib-panel-hint{font-family:var(--font-mono);font-size:var(--step-micro);color:var(--faint);overflow-wrap:anywhere;}
.ib-panel-note{font-size:var(--step-body);line-height:1.6;font-weight:300;color:var(--meta);margin:0 0 var(--grid);}
.ib-raised{list-style:none;margin:0;padding:0;}
.ib-raised-row{display:flex;align-items:center;gap:var(--grid);flex-wrap:wrap;min-height:var(--row-h);padding:calc(var(--grid-in)*1) 0;border-bottom:1px solid var(--hairline);}
.ib-raised-when,.ib-raised-v{font-family:var(--font-mono);font-size:var(--step-meta);color:var(--meta);}
.ib-done-what{font-size:var(--step-body);font-weight:300;color:var(--meta);min-width:0;overflow-wrap:anywhere;}
@media (max-width:640px){.ib-room{padding:calc(var(--grid)*2) var(--grid) calc(var(--grid)*4);}.ib-chrome{margin-left:0;}.ib-body-row{flex-direction:column;gap:0;}.ib-body-row dt{flex:0 0 auto;}}
`;

// Named and default both, for the same reason Today gives.
export default Inbox;
