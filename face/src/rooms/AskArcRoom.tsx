// AskArcRoom -- "Ask in words. Every answer carries its receipt."
//
// A brain with no hands. That is REQ-07's phrase and it is a structural claim, not a slogan,
// so this room is built to let the owner CHECK it rather than believe it:
//
//   1. The room never holds a write. `readOnly(door, ASK_GRANTS)` builds a frozen handle
//      carrying five read methods and refuses at construction to copy a write-capable one
//      across. The raw Door -- with `decide` on it -- never enters this component.
//   2. The boundary panel prints what `noHandsAudit` COMPUTED by enumerating that handle's
//      real methods, own properties and prototype chain alike. It is not a sentence someone
//      typed; if a later edit hands this room the raw door, the panel says so by itself.
//   3. An unresolved citation is shouted, not hidden. A confident sentence carrying a ULID
//      that leads nowhere is the single failure this product exists to prevent, so the
//      verdict is the largest thing on the answer and the broken ids are listed by name.
//
// AND THE OFFLINE PATH IS FIRST-CLASS. `apiAsk` answers deterministic-first on purpose: a
// question about live state has an exact answer computed from the log, and an exact answer
// beats a fluent one, needs no model, no key and no spend, and cannot hallucinate a receipt.
// This room says WHICH HALF answered and treats the reader's answer as the better one -- not
// as a degraded fallback with an apology attached.
//
// No logic lives in this file. It is in ../lib/ask.mjs, where node can run it with no install.

import { useCallback, useMemo, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { tokenFromHash } from "../lib/door.mjs";
import type { Door } from "../lib/door.mjs";
import {
  ASK_GRANTS, EXAMPLE_QUESTIONS, ROUTE_EFFECT,
  askThrough, askable, claimsOf, commandsIn, inboxHandoff, noHandsAudit, readAnswer, readOnly,
  refusalOf, resolveClaims, roomOpening, segments, standingOf,
} from "../lib/ask.mjs";
import type { Asked, Claim, Resolution, Standing } from "../lib/ask.mjs";
import { buildHash, parseHash } from "../lib/shell.mjs";

/* -------------------------------------------------------------------------- */

export type AskArcRoomProps = {
  /** The L2 client. This room is handed a read-only facade of it and never the client itself. */
  door: Door;
  /** The registry's own entry, when the shell has one. Structural, so the files need not move together. */
  room?: { sentence?: string; lede?: string };
  sentence?: string;
  lede?: string;
  /** The door's data mode. "sim" means every number in an answer is fixture data. */
  mode?: string;
  /** How the shell opens another room. Optional: without it the Inbox link is a plain anchor. */
  onOpen?: (id: string) => void;
};

type Session = {
  question: string;
  asked: Asked;
  claims: Claim[];
  resolutions: Record<string, Resolution>;
};

/* -------------------------------------------------------------------------- */

export function AskArcRoom({ door, room, sentence, lede, mode, onOpen }: AskArcRoomProps) {
  const handle = useMemo(() => readOnly(door, ASK_GRANTS), [door]);
  const hands = useMemo(() => noHandsAudit(handle), [handle]);
  const opening = roomOpening("ask-arc", room, { sentence, lede });

  const [draft, setDraft] = useState("");
  const [asking, setAsking] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [refusal, setRefusal] = useState<{ code: string; human: string } | null>(null);
  const [blocked, setBlocked] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const box = useRef<HTMLTextAreaElement | null>(null);
  // Every ask gets a ticket. A slow answer that lands after a newer one must not overwrite it,
  // and `door.ask` takes no AbortSignal -- the door's own POST cannot be cancelled -- so the
  // ordering is enforced here rather than pretended away.
  const ticket = useRef(0);

  const ask = useCallback(async (text: string) => {
    const ok = askable(text);
    if (!ok.ok) { setBlocked(ok.why); return; }
    const mine = ++ticket.current;
    setBlocked(null);
    setRefusal(null);
    setAsking(true);
    setSession(null);
    try {
      const raw = await askThrough(handle, ok.q);
      if (ticket.current !== mine) return;
      const answer = readAnswer(raw);
      if (!answer.ok) { setRefusal({ code: answer.code, human: answer.human }); return; }
      const claims = claimsOf(answer);
      // The answer is shown BEFORE its citations have been checked, with the verdict reading
      // CHECKING -- never VERIFIED-by-default. `standingOf` returns "checking" while any claim
      // is still unsettled, so there is no window in which an unproven answer looks proven.
      setSession({ question: ok.q, asked: answer, claims, resolutions: {} });
      const resolutions = await resolveClaims(handle, claims);
      if (ticket.current !== mine) return;
      setSession({ question: ok.q, asked: answer, claims, resolutions });
    } catch (err) {
      if (ticket.current !== mine) return;
      setRefusal(refusalOf(err));
    } finally {
      if (ticket.current === mine) setAsking(false);
    }
    setHistory((prev) => (prev[0] === ok.q ? prev : [ok.q, ...prev.filter((h) => h !== ok.q)].slice(0, 6)));
  }, [handle]);

  const onSubmit = useCallback((ev: FormEvent) => { ev.preventDefault(); void ask(draft); }, [ask, draft]);

  const fill = useCallback((text: string) => {
    setDraft(text);
    setBlocked(null);
    box.current?.focus();
  }, []);

  // Location plumbing, the same thing App.tsx does inline: carry the door token through the
  // fragment so following a link inside the app does not drop it.
  const inboxHref = useMemo(() => {
    const hash = typeof window === "undefined" ? "" : window.location.hash;
    return buildHash("inbox", parseHash(hash).token ?? tokenFromHash(hash));
  }, []);

  const standing: Standing | null = session ? standingOf(session.asked, session.claims, session.resolutions) : null;
  const handoff = session ? inboxHandoff(session.claims, session.resolutions) : null;
  const commands = session ? commandsIn(session.asked.answer) : [];

  return (
    <div className="aa-room">
      <style>{CSS}</style>

      <header className="aa-head">
        <div className="aa-eyebrow">
          <span>command · ask-arc</span>
          <span className="aa-rule" aria-hidden="true" />
          {mode === "sim" ? <span className="aa-sim" title="fixture data: every number in an answer comes from the fixture spine named on the door's command line">SIMULATED</span> : null}
        </div>
        <h1 className="aa-sentence">{opening.sentence}</h1>
        <p className="aa-lede">{opening.lede}</p>
      </header>

      {/* ── the boundary, computed rather than promised ─────────────────── */}
      <section className={hands.clean ? "aa-panel aa-hands" : "aa-panel aa-hands aa-hands-broken"} aria-labelledby="aa-hands">
        <div className="aa-panel-head">
          <h2 className="aa-panel-title" id="aa-hands">{hands.clean ? "This room has no hands" : "The boundary is broken"}</h2>
          <span className="aa-panel-hint">enumerated from the handle this page is holding, not asserted</span>
        </div>
        <p className="aa-panel-note">
          Asking is a <em>read</em>. There is no approve here, no reject, no “do it for me”, and
          that is structural rather than a setting: this page is handed a frozen handle carrying
          the routes below and nothing else, and the one write path in this product —{" "}
          <code>{ROUTE_EFFECT.decide?.route}</code> — is not on it. If an answer points at a
          decision, the room links you to the Inbox. It never stamps.
        </p>
        <ul className="aa-routes">
          {hands.granted.map((name) => {
            const effect = ROUTE_EFFECT[name];
            return (
              <li key={name} className="aa-route">
                <code className="aa-route-name">{effect?.route ?? name}</code>
                <span className="aa-route-effect">spineEffect: {effect?.spineEffect ?? "unclassified"}</span>
                <span className="aa-route-note">{effect?.note ?? "this shell cannot name what this route does, which is itself the finding"}</span>
              </li>
            );
          })}
        </ul>
        <p className={hands.clean ? "aa-verdict-line" : "aa-verdict-line aa-verdict-broken"}>
          <span className="aa-verdict-tag">{hands.clean ? "0 WRITE ROUTES" : "WRITE REACHABLE"}</span>
          {hands.line}
        </p>
        {hands.unclassified.length ? (
          <p className="aa-panel-note aa-panel-foot">
            {hands.unclassified.length} method{hands.unclassified.length === 1 ? "" : "s"} on this
            handle {hands.unclassified.length === 1 ? "is" : "are"} not named by the door's route
            table: <code>{hands.unclassified.join(", ")}</code>. They are counted as write-capable.
            An audit that gave an unrecognised method the benefit of the doubt would pass the
            moment someone added a write.
          </p>
        ) : null}
      </section>

      {/* ── the question ────────────────────────────────────────────────── */}
      <section className="aa-panel" aria-labelledby="aa-ask">
        <div className="aa-panel-head">
          <h2 className="aa-panel-title" id="aa-ask">Ask</h2>
          <span className="aa-panel-hint">plain words · answered from live L2</span>
        </div>
        <form className="aa-form" onSubmit={onSubmit}>
          <label className="aa-label" htmlFor="aa-q">your question</label>
          <textarea
            id="aa-q"
            ref={box}
            className="aa-box"
            rows={3}
            value={draft}
            spellCheck={false}
            placeholder="What needs me today?"
            onChange={(ev) => { setDraft(ev.target.value); if (blocked) setBlocked(null); }}
            onKeyDown={(ev) => {
              // Enter sends, Shift+Enter is a newline. A question is one line far more often
              // than it is two, and nothing here is destructive: the worst a stray Enter can
              // do is perform a read.
              if (ev.key === "Enter" && !ev.shiftKey) { ev.preventDefault(); void ask(draft); }
            }}
          />
          <div className="aa-form-foot">
            <button className="aa-go" type="submit" disabled={asking}>{asking ? "reading…" : "Ask"}</button>
            <span className="aa-form-hint">Enter to ask · Shift+Enter for a new line</span>
          </div>
          {blocked ? <p className="aa-blocked" role="status">{blocked}</p> : null}
        </form>

        <div className="aa-examples">
          <span className="aa-examples-label">the reader answers these with no model at all</span>
          <div className="aa-example-row">
            {EXAMPLE_QUESTIONS.map((q) => (
              <button key={q} type="button" className="aa-example" onClick={() => fill(q)}>{q}</button>
            ))}
          </div>
        </div>

        {history.length ? (
          <div className="aa-examples">
            <span className="aa-examples-label">asked this session</span>
            <div className="aa-example-row">
              {history.map((q) => (
                <button key={q} type="button" className="aa-example aa-example-quiet" onClick={() => void ask(q)}>{q}</button>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      {asking && !session ? (
        <section className="aa-panel"><p className="aa-waiting">reading the live state through the door…</p></section>
      ) : null}

      {refusal ? (
        <section className="aa-panel aa-refusal" role="status">
          <div className="aa-panel-head">
            <h2 className="aa-panel-title">the door refused the question</h2>
            <span className="aa-code">{refusal.code}</span>
          </div>
          <p className="aa-refusal-line">{refusal.human}</p>
          <p className="aa-panel-note">
            No answer is shown and none has been assembled from what this page happens to know.
            A room that filled a refused read with its own guess would be the exact thing the
            citation check below exists to catch, one layer earlier.
          </p>
        </section>
      ) : null}

      {session && standing ? (
        <Answer
          session={session}
          standing={standing}
          commands={commands}
          handoff={handoff}
          inboxHref={inboxHref}
          onOpen={onOpen}
        />
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function Answer({
  session, standing, commands, handoff, inboxHref, onOpen,
}: {
  session: Session;
  standing: Standing;
  commands: string[];
  handoff: { ids: string[]; room: string; label: string; line: string } | null;
  inboxHref: string;
  onOpen?: (id: string) => void;
}) {
  const { asked, claims, resolutions } = session;
  return (
    <section className="aa-panel aa-answer" aria-labelledby="aa-answer" aria-live="polite">
      {/* THE VERDICT IS THE FIRST THING ON THE ANSWER, and it is the biggest.
          Not a tooltip, not a footnote, not a small grey word beside the text. */}
      <div className={`aa-standing aa-standing-${standing.klass}`}>
        <span className="aa-standing-label">{standing.label}</span>
        <span className="aa-standing-line">{standing.line}</span>
      </div>

      <h2 className="aa-panel-title aa-question" id="aa-answer">{session.question}</h2>

      <p className="aa-body"><Prose text={asked.answer} /></p>

      <div className="aa-half">
        <span className="aa-half-label">{asked.halfLabel}</span>
        <span className="aa-half-line">{asked.halfLine}</span>
      </div>

      {standing.broken.length ? (
        <div className="aa-broken">
          <p className="aa-broken-head">
            {standing.broken.length} claim{standing.broken.length === 1 ? "" : "s"} could not be
            resolved through the door
          </p>
          <ul className="aa-broken-list">
            {standing.broken.map((key) => <li key={key}><code>{key}</code></li>)}
          </ul>
          <p className="aa-panel-note">
            The answer above is kept exactly as it was written — deleting it would hide the
            failure rather than fix it. What it has lost is its standing: nothing in it has been
            proven against the log.
          </p>
        </div>
      ) : null}

      <div className="aa-cites">
        <div className="aa-panel-head">
          <h3 className="aa-panel-title">Citations</h3>
          <span className="aa-panel-hint">
            {claims.length === 0
              ? "none named"
              : `${standing.checked} of ${standing.total} put to the door`}
            {asked.selfVerified === null ? "" : ` · the brain marked itself ${asked.selfVerified ? "verified" : "UNVERIFIED"}`}
            {asked.shape === "text" ? " · the governed answer arrived as prose, so any id in it was read out of the sentence" : ""}
          </span>
        </div>
        {claims.length === 0 ? (
          <p className="aa-panel-note aa-no-cites">
            Nothing was cited. Whether that is honest or hollow is the verdict at the top of this
            answer, and the two cases are not drawn the same way.
          </p>
        ) : (
          <ul className="aa-cite-list">
            {claims.map((claim) => <CiteRow key={claim.key} claim={claim} resolution={resolutions[claim.key]} />)}
          </ul>
        )}
      </div>

      {commands.length ? (
        <div className="aa-commands">
          <div className="aa-panel-head">
            <h3 className="aa-panel-title">What the answer says to run</h3>
            <span className="aa-panel-hint">text, not a button — you run it, from the main clone</span>
          </div>
          <ul className="aa-command-list">
            {commands.map((c) => <li key={c}><code>{c}</code></li>)}
          </ul>
          <p className="aa-panel-note">
            These are printed so you can read them and type them. There is no control here that
            runs one: the acts arc reserves for you — approving, rejecting, merging, publishing,
            promoting, killing, sending — are forever-human, and a button that ran a command would
            be that rule with a bow on it.
          </p>
        </div>
      ) : null}

      {handoff ? (
        <div className="aa-handoff">
          <a
            className="aa-handoff-link"
            href={inboxHref}
            onClick={(ev) => { if (onOpen) { ev.preventDefault(); onOpen(handoff.room); } }}
          >
            {handoff.label} →
          </a>
          <span className="aa-handoff-line">{handoff.line}</span>
        </div>
      ) : null}
    </section>
  );
}

function CiteRow({ claim, resolution }: { claim: Claim; resolution: Resolution | undefined }) {
  const state = resolution?.state ?? "checking";
  return (
    <li className={`aa-cite aa-cite-${state}`}>
      <div className="aa-cite-top">
        <code className="aa-cite-key">{claim.key}</code>
        <span className="aa-cite-kind">{claim.kind}</span>
        <span className="aa-cite-from" title={claim.from === "cited" ? "listed in the answer's citations" : "found inside the answer's own prose — an id named in a sentence is a claim like any other"}>
          {claim.from === "cited" ? "cited" : "named in the prose"}
        </span>
        <span className="aa-cite-state">{state === "resolved" ? "RESOLVED" : state === "checking" ? "CHECKING" : state.toUpperCase()}</span>
      </div>
      <div className="aa-cite-body">
        <span className="aa-cite-line">{resolution?.line ?? "Being put to the door now. Nothing is called resolved before it answers."}</span>
        {resolution?.detail ? <span className="aa-cite-detail">{resolution.detail}</span> : null}
      </div>
      <div className="aa-cite-foot">
        {resolution ? <Receipt title="the door route that settled this claim">{resolution.how}</Receipt> : null}
        {resolution?.code ? <span className="aa-code">{resolution.code}</span> : null}
      </div>
    </li>
  );
}

/** A receipt chip — the signature element. Every claim on a page names where it came from. */
function Receipt({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <span className="aa-receipt" title={title}>
      <span aria-hidden="true" className="aa-receipt-mark">&#8983;</span>
      {children}
    </span>
  );
}

/**
 * Prose with the machine's own vocabulary in mono. The split is a MEANING and not a style:
 * display is what a human wrote, mono is what the log wrote — and in an answer that mixes the
 * two in one sentence, it is most of what makes the thing readable at a glance. The decision
 * is `segments` in ../lib/ask.mjs; this only draws it, and it draws TEXT, never HTML.
 */
function Prose({ text }: { text: string }) {
  return (
    <>
      {segments(text).map((seg, i) => {
        if (seg.type === "code") return <code key={i} className="aa-code-span">{seg.text}</code>;
        if (seg.type === "em") return <em key={i}>{seg.text}</em>;
        return <span key={i}>{seg.text}</span>;
      })}
    </>
  );
}

export default AskArcRoom;

/* -------------------------------------------------------------------------- *
 * Styles. Injected rather than imported, for the reason kit.tsx writes down:
 * `face/` carries no CSS framework and no ambient declaration for a stylesheet
 * import. Every colour is a var() from tokens.css; there is not one literal hex.
 *
 * WHY UNVERIFIED IS NOT RED, AND NOT AMBER.
 * The reserved four are law: --amber is needs-you ONLY, --green is real money
 * ONLY, --red is incident ONLY, --violet is the non-real family ONLY. An answer
 * whose citation did not resolve is none of those four. It is not waiting on the
 * owner, it is not an incident, and it is not simulated -- it is a claim that has
 * not been proven. Spending a reserved hue on it would cost the product one of
 * the four meanings it has left, permanently, to make one banner louder.
 *
 * So UNVERIFIED is made loud with the two channels that carry no meaning at all:
 * SIZE (--step-stat, the KPI numeral size, on a word) and TEXTURE (a neutral
 * diagonal hatch built from --hairline-strong). The texture also means the state
 * survives being read by someone who cannot see the hue difference -- the same
 * argument tokens.css makes for --sim-hatch, applied with a neutral thread.
 * -------------------------------------------------------------------------- */

const CSS = `
.aa-room{font-family:var(--font-display);color:var(--prose);padding:calc(var(--grid)*3) calc(var(--grid)*3) calc(var(--grid)*8);max-width:1080px;margin:0 auto;display:flex;flex-direction:column;gap:calc(var(--grid)*3);}

.aa-head{margin-bottom:var(--grid);}
.aa-eyebrow{display:flex;align-items:center;gap:calc(var(--grid)*1.5);font-family:var(--font-mono);font-size:var(--step-meta);text-transform:uppercase;letter-spacing:var(--track-wide);color:var(--accent-dim);margin-bottom:calc(var(--grid)*2);}
.aa-rule{height:1px;flex:1 1 40px;max-width:160px;background:var(--accent-line);}
.aa-sim{font-family:var(--font-mono);font-size:var(--step-micro);letter-spacing:var(--track-tight);color:var(--sim-fg);border:1px solid var(--sim-line);border-radius:var(--radius-pill);padding:4px 10px;background-image:var(--sim-hatch);}
.aa-sentence{font-size:clamp(28px,4vw,var(--step-room));line-height:1.04;letter-spacing:-0.02em;font-weight:600;margin:0 0 calc(var(--grid)*1.5) 0;max-width:20ch;}
.aa-lede{font-size:var(--step-lede);font-weight:300;line-height:1.6;color:var(--meta);margin:0;max-width:66ch;}

.aa-panel{position:relative;background:var(--panel);backdrop-filter:blur(var(--panel-blur));-webkit-backdrop-filter:blur(var(--panel-blur));border:1px solid var(--panel-border);border-radius:var(--radius-panel);padding:var(--pad-panel);min-width:0;}
.aa-panel-head{display:flex;align-items:baseline;justify-content:space-between;gap:var(--grid);flex-wrap:wrap;margin-bottom:calc(var(--grid)*1.5);}
.aa-panel-title{font-family:var(--font-mono);font-size:var(--step-meta);text-transform:uppercase;letter-spacing:var(--track-wide);color:var(--accent);margin:0;font-weight:400;}
.aa-panel-hint{font-family:var(--font-mono);font-size:var(--step-micro);color:var(--faint);overflow-wrap:anywhere;}
.aa-panel-note{font-size:var(--step-body);font-weight:300;line-height:1.65;color:var(--meta);margin:0 0 calc(var(--grid)*2) 0;max-width:76ch;}
.aa-panel-foot{margin:calc(var(--grid)*2) 0 0 0;padding-top:calc(var(--grid)*2);border-top:1px solid var(--hairline);}
.aa-panel-note code{font-family:var(--font-mono);font-size:var(--step-data);color:var(--prose);}
.aa-waiting{font-family:var(--font-mono);font-size:var(--step-data);color:var(--meta);margin:0;}
.aa-code-span{font-family:var(--font-mono);font-size:var(--step-data);color:var(--prose);}
.aa-code{font-family:var(--font-mono);font-size:var(--step-meta);color:var(--prose);border:1px solid var(--hairline-strong);border-radius:var(--radius-chip);padding:3px 9px;}

/* ── the boundary ─────────────────────────────────────────────────────── */
.aa-hands{border-color:var(--accent-line);}
.aa-routes{list-style:none;margin:0 0 calc(var(--grid)*2) 0;padding:0;display:flex;flex-direction:column;}
.aa-route{display:flex;align-items:baseline;gap:var(--grid);flex-wrap:wrap;padding:var(--grid) 0;border-bottom:1px solid var(--hairline);min-height:var(--row-h);}
.aa-route-name{font-family:var(--font-mono);font-size:var(--step-data);color:var(--prose);flex:0 0 auto;}
.aa-route-effect{font-family:var(--font-mono);font-size:var(--step-micro);text-transform:uppercase;letter-spacing:var(--track-tight);color:var(--accent-dim);}
.aa-route-note{font-family:var(--font-mono);font-size:var(--step-micro);line-height:1.55;color:var(--faint);flex:1 1 280px;min-width:0;}
.aa-verdict-line{display:flex;align-items:baseline;gap:var(--grid);flex-wrap:wrap;font-family:var(--font-mono);font-size:var(--step-meta);line-height:1.6;color:var(--meta);margin:0;border:1px solid var(--accent-line);border-radius:var(--radius-chip);padding:var(--grid) calc(var(--grid)*1.5);}
.aa-verdict-tag{text-transform:uppercase;letter-spacing:var(--track-mid);color:var(--accent);font-size:var(--step-micro);}
.aa-verdict-broken{border-color:var(--prose);color:var(--prose);background-image:repeating-linear-gradient(135deg,var(--hairline-strong) 0,var(--hairline-strong) 2px,transparent 2px,transparent 11px);}
.aa-verdict-broken .aa-verdict-tag{color:var(--prose);}
.aa-hands-broken{border-color:var(--prose);}

/* ── the question ─────────────────────────────────────────────────────── */
.aa-form{display:flex;flex-direction:column;gap:var(--grid);margin-bottom:calc(var(--grid)*2);}
.aa-label{font-family:var(--font-mono);font-size:var(--step-micro);text-transform:uppercase;letter-spacing:var(--track-mid);color:var(--faint);}
.aa-box{width:100%;box-sizing:border-box;resize:vertical;font-family:var(--font-display);font-size:var(--step-lede);font-weight:300;line-height:1.5;color:var(--prose);background:transparent;border:1px solid var(--hairline-strong);border-radius:var(--radius-chip);padding:calc(var(--grid)*1.5);min-height:calc(var(--row-h-live)*1.6);}
.aa-box::placeholder{color:var(--faint);}
.aa-form-foot{display:flex;align-items:center;gap:calc(var(--grid)*1.5);flex-wrap:wrap;}
.aa-go{min-height:var(--row-h-live);padding:0 calc(var(--grid)*3);font-family:var(--font-mono);font-size:var(--step-data);text-transform:uppercase;letter-spacing:var(--track-tight);color:var(--on-accent);background:var(--accent);border:1px solid var(--accent);border-radius:var(--radius-chip);cursor:pointer;}
.aa-go:disabled{background:transparent;color:var(--faint);border-color:var(--hairline-strong);cursor:default;}
.aa-form-hint{font-family:var(--font-mono);font-size:var(--step-micro);color:var(--faint);}
.aa-blocked{font-family:var(--font-mono);font-size:var(--step-meta);line-height:1.6;color:var(--prose);margin:0;border:1px solid var(--hairline-strong);border-radius:var(--radius-chip);padding:var(--grid) calc(var(--grid)*1.5);}

.aa-examples{margin-top:calc(var(--grid)*2);padding-top:calc(var(--grid)*2);border-top:1px solid var(--hairline);}
.aa-examples-label{display:block;font-family:var(--font-mono);font-size:var(--step-micro);text-transform:uppercase;letter-spacing:var(--track-mid);color:var(--faint);margin-bottom:var(--grid);}
.aa-example-row{display:flex;flex-wrap:wrap;gap:var(--grid);}
.aa-example{min-height:var(--row-h-live);padding:0 calc(var(--grid)*1.5);font-family:var(--font-display);font-size:var(--step-body);font-weight:300;color:var(--prose);background:transparent;border:1px solid var(--accent-line);border-radius:var(--radius-chip);cursor:pointer;text-align:left;}
.aa-example-quiet{border-color:var(--hairline);color:var(--meta);}

/* ── the answer ───────────────────────────────────────────────────────── */
.aa-answer{display:flex;flex-direction:column;gap:calc(var(--grid)*2);}
.aa-question{color:var(--faint);}
.aa-body{font-size:var(--step-lede);font-weight:300;line-height:1.7;color:var(--prose);margin:0;max-width:74ch;overflow-wrap:anywhere;}

.aa-standing{display:flex;flex-direction:column;gap:var(--grid);border:1px solid var(--hairline-strong);border-radius:var(--radius-chip);padding:calc(var(--grid)*2);}
.aa-standing-label{font-family:var(--font-mono);font-size:var(--step-stat);line-height:1;letter-spacing:var(--track-tight);color:var(--prose);}
.aa-standing-line{font-size:var(--step-body);font-weight:300;line-height:1.65;color:var(--meta);max-width:76ch;}
.aa-standing-verified{border-color:var(--accent-line);}
.aa-standing-verified .aa-standing-label{color:var(--accent);}
.aa-standing-checking .aa-standing-label{color:var(--faint);font-size:var(--step-lede);}
.aa-standing-absence .aa-standing-label,.aa-standing-uncited .aa-standing-label{font-size:var(--step-lede);}
.aa-standing-uncited{border-color:var(--prose);}
.aa-standing-unverified{border:1px solid var(--prose);background-image:repeating-linear-gradient(135deg,var(--hairline-strong) 0,var(--hairline-strong) 2px,transparent 2px,transparent 11px);}
.aa-standing-unverified .aa-standing-label{color:var(--prose);}
.aa-standing-unverified .aa-standing-line{color:var(--prose);}

.aa-half{display:flex;flex-direction:column;gap:var(--grid-in);border-left:2px solid var(--accent-line);padding-left:calc(var(--grid)*1.5);}
.aa-half-label{font-family:var(--font-mono);font-size:var(--step-micro);text-transform:uppercase;letter-spacing:var(--track-mid);color:var(--accent-dim);}
.aa-half-line{font-family:var(--font-mono);font-size:var(--step-meta);line-height:1.6;color:var(--faint);max-width:82ch;}

.aa-broken{border:1px solid var(--prose);border-radius:var(--radius-chip);padding:calc(var(--grid)*2);}
.aa-broken-head{font-family:var(--font-mono);font-size:var(--step-data);text-transform:uppercase;letter-spacing:var(--track-tight);color:var(--prose);margin:0 0 var(--grid) 0;}
.aa-broken-list{list-style:none;margin:0 0 var(--grid) 0;padding:0;display:flex;flex-wrap:wrap;gap:var(--grid);}
.aa-broken-list code{font-family:var(--font-mono);font-size:var(--step-data);color:var(--prose);border:1px solid var(--hairline-strong);border-radius:var(--radius-chip);padding:4px 9px;overflow-wrap:anywhere;}
.aa-broken .aa-panel-note{margin:0;}

.aa-cites{border-top:1px solid var(--hairline);padding-top:calc(var(--grid)*2);}
.aa-no-cites{margin:0;}
.aa-cite-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:var(--grid);}
.aa-cite{border:1px solid var(--hairline);border-left:3px solid var(--hairline-strong);border-radius:var(--radius-chip);padding:calc(var(--grid)*1.5);min-width:0;}
.aa-cite-resolved{border-left-color:var(--accent);}
.aa-cite-absent,.aa-cite-unreadable{border-left-color:var(--prose);background-image:repeating-linear-gradient(135deg,var(--hairline-strong) 0,var(--hairline-strong) 2px,transparent 2px,transparent 11px);}
.aa-cite-top{display:flex;align-items:baseline;gap:var(--grid);flex-wrap:wrap;margin-bottom:var(--grid-in);}
.aa-cite-key{font-family:var(--font-mono);font-size:var(--step-data);color:var(--prose);overflow-wrap:anywhere;}
.aa-cite-kind,.aa-cite-from{font-family:var(--font-mono);font-size:var(--step-micro);color:var(--faint);}
.aa-cite-state{font-family:var(--font-mono);font-size:var(--step-micro);text-transform:uppercase;letter-spacing:var(--track-mid);color:var(--accent-dim);margin-left:auto;}
.aa-cite-absent .aa-cite-state,.aa-cite-unreadable .aa-cite-state{color:var(--prose);}
.aa-cite-body{display:flex;flex-direction:column;gap:var(--grid-in);margin-bottom:var(--grid);}
.aa-cite-line{font-size:var(--step-body);font-weight:300;line-height:1.55;color:var(--meta);max-width:76ch;}
.aa-cite-detail{font-family:var(--font-mono);font-size:var(--step-meta);color:var(--faint);overflow-wrap:anywhere;}
.aa-cite-foot{display:flex;flex-wrap:wrap;gap:var(--grid-in);align-items:center;}

.aa-receipt{display:inline-flex;align-items:center;gap:6px;font-family:var(--font-mono);font-size:var(--step-meta);color:var(--accent);border:1px solid var(--accent-line);border-radius:var(--radius-chip);background:var(--panel);padding:3px 8px;overflow-wrap:anywhere;}
.aa-receipt-mark{opacity:0.85;}

.aa-commands{border-top:1px solid var(--hairline);padding-top:calc(var(--grid)*2);}
.aa-command-list{list-style:none;margin:0 0 calc(var(--grid)*2) 0;padding:0;display:flex;flex-direction:column;gap:var(--grid);}
.aa-command-list code{display:block;font-family:var(--font-mono);font-size:var(--step-data);line-height:1.6;color:var(--prose);border:1px solid var(--hairline-strong);border-radius:var(--radius-chip);padding:var(--grid) calc(var(--grid)*1.5);overflow-x:auto;user-select:all;}
.aa-commands .aa-panel-note{margin:0;}

.aa-handoff{display:flex;align-items:center;gap:calc(var(--grid)*1.5);flex-wrap:wrap;border-top:1px solid var(--hairline);padding-top:calc(var(--grid)*2);}
.aa-handoff-link{min-height:var(--row-h-live);display:inline-flex;align-items:center;padding:0 calc(var(--grid)*2);font-family:var(--font-mono);font-size:var(--step-data);letter-spacing:var(--track-tight);color:var(--accent);text-decoration:none;border:1px solid var(--accent-line);border-radius:var(--radius-chip);}
.aa-handoff-line{font-size:var(--step-body);font-weight:300;line-height:1.6;color:var(--meta);flex:1 1 320px;min-width:0;max-width:74ch;}

.aa-refusal{border-left:3px solid var(--hairline-strong);}
.aa-refusal-line{font-size:var(--step-body);font-weight:300;line-height:1.6;color:var(--prose);margin:0 0 var(--grid) 0;max-width:70ch;}

@media (max-width:640px){
  .aa-room{padding:calc(var(--grid)*2) var(--grid) calc(var(--grid)*6);}
  .aa-cite-state{margin-left:0;}
  .aa-standing-label{font-size:var(--step-room);}
}
`;
