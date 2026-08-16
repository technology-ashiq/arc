// growth/feed -- REQ-05(c). The one visible readout of a clock that runs whether or not anyone is
// watching.
//
// RE-DERIVED FROM THE SPINE ON EVERY READ, NEVER CACHED. That is not a performance note, it is the
// requirement: a stale feed line already cost arc five silent days. A cache here would mean the
// line kept saying what was true the last time something wrote it, which is the exact failure the
// line exists to prevent.
//
// It reports FEED AGE and COMPLETE/MISSING counts, and it reports MISSING as MISSING. A window
// with no receipt is not a window with zero clicks, and printing 0 would be a claim nobody
// verified. This lane has already paid for that confusion once, when an emitter exited 0 while
// every receipt it wrote sat in quarantine.

export class FeedError extends Error {
  constructor(code, message) { super(message); this.name = "FeedError"; this.code = code; }
}

// The surface this lane registered. `module: growth`, `surface: title-template` -- dotless,
// because ADR-1109's D3 recorded that the dotted `growth.title-template` everyone's plan names is
// refused by the live DIMENSION_RE. The namespace lives in `module`; the dotted form survives as
// prose and never as a payload value.
export const FEED_MODULE = "growth";
export const FEED_SURFACE = "title-template";

const DAY_MS = 86400000;

/**
 * Derive the feed lines from spine events.
 *
 * `events` is whatever the spine reader returned THIS CALL. Nothing is stored between calls, and
 * `nowMs` is injected rather than read from the clock, so the age this prints is testable rather
 * than merely plausible.
 */
export function feedLines(events, nowMs, { expectedWeeks = null, includeEmpty = false } = {}) {
  if (!Array.isArray(events)) throw new FeedError("BAD_INPUT", "feedLines needs the events array");
  if (typeof nowMs !== "number" || !Number.isFinite(nowMs))
    throw new FeedError("BAD_NOW", "feedLines needs an explicit clock -- an implicit one cannot be tested");

  const mine = events
    .map((e) => (e && e.event) || e)
    .filter((e) => e && e.kind === "metric.observed" && e.payload &&
      e.payload.module === FEED_MODULE && e.payload.surface === FEED_SURFACE);

  if (mine.length === 0) {
    // NOT "0 windows". The distinction is the whole point: nobody has fed this surface, which is a
    // different fact from a week that genuinely had no clicks.
    //
    // BUT THE COMPANY BRIEF DOES NOT GET THIS LINE BY DEFAULT, and that is a correction. The first
    // version returned it unconditionally, which put a permanent two-line block about a lane whose
    // clock has not started into every brief, every day, for every other lane -- inside a renderer
    // with a deliberate 40-line one-screen budget whose own comments are about not burying
    // needs-you. It also broke `spine-brief.bats`, which is another lane's suite asserting the
    // brief's exact bytes, and that suite was right to break: growth had changed the company's
    // daily output to say something about growth.
    //
    // The empty state belongs to growth's own tracker, not to everyone's morning. Callers that
    // genuinely want it -- growth's tests and growth's own surfaces -- ask for it.
    return includeEmpty
      ? [`growth feed: NO metric.observed receipts for ${FEED_MODULE}/${FEED_SURFACE} — the clock has not started`]
      : [];
  }

  // Latest window end wins. Parsed from the payload's own bound rather than from the receipt's
  // write time: the feed's age is about the DATA, not about when someone happened to run a command.
  let newestEndMs = -Infinity;
  const windows = new Set();
  for (const e of mine) {
    const end = Date.parse(e.payload.window_end);
    if (Number.isFinite(end)) newestEndMs = Math.max(newestEndMs, end);
    windows.add(`${e.payload.window_start}..${e.payload.window_end}`);
  }
  const lines = [];
  if (Number.isFinite(newestEndMs)) {
    const ageDays = Math.floor((nowMs - newestEndMs) / DAY_MS);
    lines.push(`growth feed: ${windows.size} window(s), newest ends ${ageDays} day(s) ago`);
  } else {
    lines.push(`growth feed: ${windows.size} window(s), newest end UNPARSEABLE — the bound is not a timestamp this reader understands`);
  }

  // Completeness against an EXPECTED set, when the caller has one. Without it the line reports what
  // is present and says so, rather than implying that present means complete.
  if (Array.isArray(expectedWeeks) && expectedWeeks.length > 0) {
    const present = new Set(mine.map((e) => e.payload.source_id));
    const missing = expectedWeeks.filter((w) => !present.has(`gsc-${w}`));
    lines.push(missing.length === 0
      ? `growth feed: ${expectedWeeks.length} expected window(s), 0 MISSING`
      : `growth feed: ${expectedWeeks.length - missing.length} of ${expectedWeeks.length} expected window(s) present, MISSING ${missing.join(", ")}`);
  } else {
    lines.push("growth feed: no expected-week list given, so this counts what is PRESENT and claims nothing about what is missing");
  }
  return lines;
}
